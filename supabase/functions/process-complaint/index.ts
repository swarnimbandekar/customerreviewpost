import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * ARCHITECTURE NOTES:
 * 
 * This Edge Function acts as an orchestrator, NOT as an inference engine.
 * 
 * Why ML runs in a separate Python service:
 * 1. Trained .pkl models require Python runtime with scikit-learn
 * 2. Edge Functions (Deno) cannot load Python pickle files
 * 3. Separation of concerns: Edge Functions handle API logic, ML service handles inference
 * 4. ML service can be scaled independently based on inference load
 * 5. Multiple Edge Functions can share the same ML service
 * 
 * Flow:
 * Frontend -> Edge Function (this file) -> External ML Service -> Edge Function -> Database -> Frontend
 * 
 * The ML service is a separate Python Flask/FastAPI application that:
 * - Loads complaint_model.pkl and vectorizer.pkl on startup
 * - Exposes a /predict endpoint
 * - Returns: category, sentiment, priority, ai_response
 */

/**
 * Calls the external ML service to get AI predictions
 * @param complaintText - The complaint text to analyze
 * @returns AI predictions or null if service is unavailable
 */
async function getMLPredictions(complaintText: string) {
  const mlServiceUrl = Deno.env.get("ML_SERVICE_URL");
  
  if (!mlServiceUrl) {
    console.warn("ML_SERVICE_URL not configured. Using fallback values.");
    return null;
  }

  try {
    console.log("Calling ML service at:", mlServiceUrl);
    
    const response = await fetch(`${mlServiceUrl}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ complaint_text: complaintText }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`ML service returned status ${response.status}`);
      return null;
    }

    const predictions = await response.json();
    
    if (!predictions.category || !predictions.sentiment || !predictions.priority || !predictions.ai_response) {
      console.error("ML service returned incomplete data:", predictions);
      return null;
    }

    return predictions;
  } catch (error) {
    console.error("Error calling ML service:", error.message);
    return null;
  }
}

/**
 * Provides fallback values when ML service is unavailable
 * This ensures the system continues to accept complaints even if AI is down
 */
function getFallbackValues() {
  return {
    category: "Other",
    sentiment: "Neutral",
    priority: "Low",
    ai_response: "Thank you for contacting Indian Postal Department. Your complaint has been received and will be reviewed by our support team. We will get back to you within 48 hours. For urgent matters, please call our helpline.",
    confidence_score: 50,
    explanation: "Using fallback values due to ML service unavailability.",
  };
}

async function sendEmailNotification(complaint: any) {
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!adminEmail || !resendApiKey) {
    console.warn("Email not configured. Set ADMIN_EMAIL and RESEND_API_KEY environment variables.");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Complaint System <noreply@resend.dev>",
        to: [adminEmail],
        subject: `New ${complaint.priority} Priority Complaint - ${complaint.category}`,
        html: `
          <h2>New Complaint Received</h2>
          <p><strong>ID:</strong> ${complaint.id}</p>
          <p><strong>Category:</strong> ${complaint.category}</p>
          <p><strong>Priority:</strong> ${complaint.priority}</p>
          <p><strong>Sentiment:</strong> ${complaint.sentiment}</p>
          <hr>
          <p><strong>Complaint Text:</strong></p>
          <p>${complaint.complaint_text}</p>
          <hr>
          <p><strong>AI Response:</strong></p>
          <p>${complaint.ai_response}</p>
          <hr>
          <p><strong>AI Confidence:</strong> ${complaint.ai_confidence_score}%</p>
          <p><strong>Submitted:</strong> ${new Date(complaint.created_at).toLocaleString()}</p>
        `,
      }),
    });

    if (!response.ok) {
      console.error(`Email service returned status ${response.status}`);
    } else {
      console.log("Email notification sent successfully");
    }
  } catch (error) {
    console.error("Error sending email:", error.message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { complaint_text } = await req.json();

    if (!complaint_text || complaint_text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Complaint text is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId = null;
    let userEmail = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
        userEmail = user.email;
      }
    }

    let mlPredictions = await getMLPredictions(complaint_text);
    
    if (!mlPredictions) {
      console.warn("Using fallback values due to ML service unavailability");
      mlPredictions = getFallbackValues();
    }

    const { category, sentiment, priority, ai_response, confidence_score, explanation } = mlPredictions;

    const { data, error } = await supabase
      .from("complaints")
      .insert({
        complaint_text,
        category,
        sentiment,
        priority,
        ai_response,
        ai_confidence_score: confidence_score || 0,
        ai_explanation: explanation || '',
        status: "Pending",
        user_id: userId,
        user_email: userEmail,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    sendEmailNotification(data).catch(err => {
      console.error('Email notification failed (non-blocking):', err);
    });

    return new Response(
      JSON.stringify({
        success: true,
        complaint: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing complaint:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});