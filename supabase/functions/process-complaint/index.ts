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
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`ML service returned status ${response.status}`);
      return null;
    }

    const predictions = await response.json();
    
    // Validate response structure
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
  };
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

    // Call external ML service for AI predictions
    // The ML service runs the trained models (complaint_model.pkl, vectorizer.pkl)
    let mlPredictions = await getMLPredictions(complaint_text);
    
    // Fallback safety: If ML service is down, use default values
    // This ensures complaints are still accepted and stored
    if (!mlPredictions) {
      console.warn("Using fallback values due to ML service unavailability");
      mlPredictions = getFallbackValues();
    }

    const { category, sentiment, priority, ai_response } = mlPredictions;

    // Store complaint in Supabase database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("complaints")
      .insert({
        complaint_text,
        category,
        sentiment,
        priority,
        ai_response,
        status: "Pending",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

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