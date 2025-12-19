# Supabase Migration Guide

This guide will help you migrate your complaint management system to your own Supabase server.

---

## Prerequisites

1. A Supabase account ([Sign up here](https://supabase.com))
2. A new Supabase project created
3. Your Supabase project credentials:
   - `SUPABASE_URL` (found in Project Settings → API)
   - `SUPABASE_ANON_KEY` (found in Project Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` (found in Project Settings → API - keep this secret!)

---

## Step 1: Clean Up Existing Database (Optional)

If you need to remove all existing tables, run this SQL in your Supabase SQL Editor:

```sql
-- Drop all policies first
DROP POLICY IF EXISTS "Anyone can insert complaints" ON complaints;
DROP POLICY IF EXISTS "Anyone can view complaints" ON complaints;
DROP POLICY IF EXISTS "Anyone can update complaints" ON complaints;
DROP POLICY IF EXISTS "Anyone can insert messages" ON complaint_messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON complaint_messages;

-- Drop all indexes
DROP INDEX IF EXISTS complaints_created_at_idx;
DROP INDEX IF EXISTS complaints_status_idx;
DROP INDEX IF EXISTS complaints_priority_idx;
DROP INDEX IF EXISTS complaint_messages_complaint_id_idx;
DROP INDEX IF EXISTS complaint_messages_created_at_idx;

-- Drop all tables
DROP TABLE IF EXISTS complaint_messages CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
```

---

## Step 2: Create Database Schema

Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
/*
  # Complaint Management System - Full Database Schema

  1. Tables Created:
     A. complaints
        - id (uuid, primary key)
        - complaint_text (text)
        - category (text) - AI-detected category
        - sentiment (text) - AI sentiment analysis
        - priority (text) - Priority level
        - ai_response (text) - Auto-generated response
        - ai_confidence_score (integer) - AI confidence 0-100
        - ai_explanation (text) - Optional AI explanation
        - status (text) - Pending or Resolved
        - feedback_helpful (boolean) - User feedback
        - created_at (timestamptz)
        - updated_at (timestamptz)

     B. complaint_messages
        - id (uuid, primary key)
        - complaint_id (uuid, foreign key)
        - message_text (text)
        - sender_role (text) - 'user' or 'admin'
        - created_at (timestamptz)

  2. Security:
     - RLS enabled on all tables
     - Public access for demo purposes
     - In production, implement proper authentication

  3. Indexes:
     - Performance indexes on frequently queried columns
*/

-- Create complaints table
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_text text NOT NULL,
  category text NOT NULL,
  sentiment text NOT NULL,
  priority text NOT NULL,
  ai_response text NOT NULL,
  ai_confidence_score integer DEFAULT 0 NOT NULL,
  ai_explanation text DEFAULT '',
  status text DEFAULT 'Pending' NOT NULL,
  feedback_helpful boolean DEFAULT null,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create complaint_messages table for threaded conversations
CREATE TABLE IF NOT EXISTS complaint_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_messages ENABLE ROW LEVEL SECURITY;

-- Complaints policies (public access for demo)
CREATE POLICY "Anyone can insert complaints"
  ON complaints
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view complaints"
  ON complaints
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update complaints"
  ON complaints
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Complaint messages policies (public access for demo)
CREATE POLICY "Anyone can insert messages"
  ON complaint_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view messages"
  ON complaint_messages
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS complaints_created_at_idx ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints(status);
CREATE INDEX IF NOT EXISTS complaints_priority_idx ON complaints(priority);
CREATE INDEX IF NOT EXISTS complaint_messages_complaint_id_idx ON complaint_messages(complaint_id);
CREATE INDEX IF NOT EXISTS complaint_messages_created_at_idx ON complaint_messages(created_at);
```

**Verify the migration:**
- Go to Table Editor in your Supabase dashboard
- You should see `complaints` and `complaint_messages` tables
- Check that RLS is enabled (green shield icon)

---

## Step 3: Deploy Edge Functions

You have 3 edge functions to deploy. For each function, follow these steps:

### 3.1 Deploy process-complaint Function

1. Go to **Edge Functions** in your Supabase dashboard
2. Click **Create a new function**
3. Name: `process-complaint`
4. Copy and paste this code:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    let mlPredictions = await getMLPredictions(complaint_text);

    if (!mlPredictions) {
      console.warn("Using fallback values due to ML service unavailability");
      mlPredictions = getFallbackValues();
    }

    const { category, sentiment, priority, ai_response, confidence_score, explanation } = mlPredictions;

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
        ai_confidence_score: confidence_score || 0,
        ai_explanation: explanation || '',
        status: "Pending",
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
```

5. Click **Deploy**

### 3.2 Deploy manage-complaints Function

1. Click **Create a new function**
2. Name: `manage-complaints`
3. Copy and paste this code:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, complaints: data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "PUT") {
      const { id, status, feedback_helpful } = await req.json();

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Complaint ID is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const updateData: any = { updated_at: new Date().toISOString() };

      if (status) updateData.status = status;
      if (feedback_helpful !== undefined) updateData.feedback_helpful = feedback_helpful;

      const { data, error } = await supabase
        .from("complaints")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, complaint: data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error managing complaints:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

4. Click **Deploy**

### 3.3 Deploy complaint-messages Function

1. Click **Create a new function**
2. Name: `complaint-messages`
3. Copy and paste this code:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const complaintId = url.searchParams.get("complaint_id");

      if (!complaintId) {
        return new Response(
          JSON.stringify({ error: "complaint_id is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data, error } = await supabase
        .from("complaint_messages")
        .select("*")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, messages: data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (req.method === "POST") {
      const { complaint_id, message_text, sender_role } = await req.json();

      if (!complaint_id || !message_text || !sender_role) {
        return new Response(
          JSON.stringify({ error: "complaint_id, message_text, and sender_role are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (sender_role !== "user" && sender_role !== "admin") {
        return new Response(
          JSON.stringify({ error: "sender_role must be 'user' or 'admin'" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data, error } = await supabase
        .from("complaint_messages")
        .insert({
          complaint_id,
          message_text,
          sender_role,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error managing messages:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

4. Click **Deploy**

---

## Step 4: Update Your .env File

Update your local `.env` file with your new Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these:**
1. Go to your Supabase Dashboard
2. Click on **Project Settings** (gear icon)
3. Go to **API** section
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

---

## Step 5: Configure Optional Environment Variables (Edge Functions)

If you want email notifications or ML service integration, configure these in Supabase:

1. Go to **Edge Functions** → **Configuration**
2. Add these environment variables:

```
ML_SERVICE_URL=https://your-ml-service.com
ADMIN_EMAIL=admin@yourdomain.com
RESEND_API_KEY=re_xxxxxxxxx
```

**Note:** These are optional. The system will work without them using fallback values.

---

## Step 6: Test Your Setup

### Test Database Connection

1. Run your application locally: `npm run dev`
2. Try submitting a complaint through the form
3. Check if it appears in the Supabase Table Editor

### Test Edge Functions

You can test edge functions directly in Supabase:

1. Go to **Edge Functions**
2. Click on a function
3. Use the **Invoke** button to test

Or use curl:

```bash
# Test process-complaint
curl -X POST 'https://your-project-id.supabase.co/functions/v1/process-complaint' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"complaint_text": "Test complaint"}'

# Test manage-complaints (GET)
curl 'https://your-project-id.supabase.co/functions/v1/manage-complaints' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

---

## Troubleshooting

### Database Issues

**Problem:** Tables not showing up
- **Solution:** Make sure you ran the SQL in Step 2 completely
- Check the SQL Editor logs for any errors

**Problem:** Permission denied errors
- **Solution:** Check that RLS policies are created correctly
- Verify in Table Editor that RLS is enabled (green shield icon)

### Edge Function Issues

**Problem:** Functions not deploying
- **Solution:** Check the function logs in the Supabase dashboard
- Make sure you copied the entire code including imports

**Problem:** CORS errors in browser
- **Solution:** Verify corsHeaders are set in all functions
- Check that OPTIONS method is handled

**Problem:** Function returns 500 error
- **Solution:** Check function logs in Supabase dashboard
- Verify environment variables are set correctly

### Connection Issues

**Problem:** Frontend can't connect to Supabase
- **Solution:** Double-check your `.env` file
- Verify the URL and anon key are correct
- Restart your dev server after changing `.env`

---

## Security Notes

**IMPORTANT:** This setup uses public access for demo purposes. For production:

1. **Enable Supabase Auth:**
   - Implement user authentication
   - Update RLS policies to check `auth.uid()`

2. **Restrict Admin Access:**
   - Add role-based access control
   - Only allow authenticated admins to update complaints

3. **Secure Edge Functions:**
   - Add authentication checks in functions
   - Validate all input data
   - Rate limit API calls

4. **Protect Sensitive Data:**
   - Never commit service role key to git
   - Use environment variables for all secrets
   - Enable email confirmation for user signups

---

## Next Steps

1. Set up authentication (optional but recommended)
2. Configure email notifications with Resend
3. Set up ML service for AI predictions
4. Add custom domain for Edge Functions
5. Enable database backups
6. Set up monitoring and alerts

---

## Support

If you encounter issues:

1. Check Supabase dashboard logs
2. Review the browser console for errors
3. Verify all environment variables are set
4. Test each component individually

For Supabase-specific issues, visit [Supabase Documentation](https://supabase.com/docs)

---

## Migration Checklist

- [ ] Created new Supabase project
- [ ] Ran cleanup SQL (if needed)
- [ ] Ran database schema SQL
- [ ] Verified tables exist in Table Editor
- [ ] Deployed process-complaint function
- [ ] Deployed manage-complaints function
- [ ] Deployed complaint-messages function
- [ ] Updated .env file with new credentials
- [ ] Tested database connection
- [ ] Tested form submission
- [ ] Verified data in Supabase Table Editor
- [ ] (Optional) Configured email notifications
- [ ] (Optional) Configured ML service URL

**Migration Complete!** Your complaint management system is now running on your own Supabase server.
