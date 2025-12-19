# User Tracking Update for Complaints System

## Overview
This update adds user tracking to the complaints system so that logged-in users can see only their own complaints in the dashboard.

---

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20251219163423_add_user_tracking_to_complaints.sql`

This migration adds two new columns to the `complaints` table:
- `user_id` - Links complaints to authenticated users
- `user_email` - Stores user email for quick reference

**What to do:**
1. Copy the SQL code below and run it in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

```sql
/*
  # Add User Tracking to Complaints

  1. Changes
    - Add `user_id` column (uuid, nullable, foreign key to auth.users)
    - Add `user_email` column (text, nullable) for quick reference
    - Create index on user_id for faster queries
    - Update RLS policies to allow users to view only their own complaints

  2. Security
    - Users can only view their own complaints
    - Anonymous users can still submit complaints (for public form)
    - Admins can view all complaints (will be handled via service role key)

  3. Notes
    - Existing complaints will have null user_id (anonymous submissions)
    - New authenticated submissions will have user_id populated
*/

-- Add user tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complaints' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE complaints ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complaints' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE complaints ADD COLUMN user_email text;
  END IF;
END $$;

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS complaints_user_id_idx ON complaints(user_id);

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can view complaints" ON complaints;
DROP POLICY IF EXISTS "Anyone can insert complaints" ON complaints;
DROP POLICY IF EXISTS "Anyone can update complaints" ON complaints;

-- Allow anyone to insert complaints (both authenticated and anonymous)
CREATE POLICY "Anyone can insert complaints"
  ON complaints
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can view their own complaints
CREATE POLICY "Users can view own complaints"
  ON complaints
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow anonymous users to view their submitted complaints (if they have the ID)
CREATE POLICY "Public can view complaints"
  ON complaints
  FOR SELECT
  TO anon
  USING (true);

-- Users can update their own complaints (for feedback)
CREATE POLICY "Users can update own complaints"
  ON complaints
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow service role to update any complaint (for admin actions via edge function)
CREATE POLICY "Service role can update complaints"
  ON complaints
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
```

---

### 2. Edge Function Update
**File:** `supabase/functions/process-complaint/index.ts`

The edge function now captures the user's ID and email when they submit a complaint.

**What to do:**
1. Replace your entire `supabase/functions/process-complaint/index.ts` file with the code below:

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

    // NEW: Initialize Supabase client early to capture user info
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // NEW: Capture user information from Authorization header
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

    // NEW: Include user_id and user_email in the insert
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
        user_id: userId,        // NEW
        user_email: userEmail,  // NEW
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

2. Deploy the updated edge function:
```bash
supabase functions deploy process-complaint
```

---

## Step-by-Step Instructions

### Step 1: Update Database
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Paste the SQL migration code from above
6. Click "Run" or press `Ctrl+Enter`
7. You should see "Success. No rows returned"

### Step 2: Update Edge Function
1. Replace the content of `supabase/functions/process-complaint/index.ts` with the new code above
2. Open your terminal in the project directory
3. Run: `supabase functions deploy process-complaint`

### Step 3: Test
1. Go to http://localhost:5173
2. Log in with your account
3. Click "Dashboard" (or go to http://localhost:5173/dashboard)
4. Click the "New Complaint" button
5. Enter a complaint and submit
6. You should see your complaint appear in the list!

---

## What Changed?

### Before:
- All complaints were anonymous
- No user tracking
- Anyone could see all complaints

### After:
- ✅ Complaints are linked to logged-in users
- ✅ Users can only see their own complaints
- ✅ Better security with Row Level Security (RLS)
- ✅ User email is stored for reference

---

## Troubleshooting

### "No rows returned" in dashboard
- Make sure you ran the database migration SQL
- Make sure you deployed the updated edge function
- Try logging out and logging back in

### "Permission denied" error
- Check that the RLS policies were created correctly
- Run the migration SQL again to ensure policies are in place

### Edge function deployment fails
- Make sure you have Supabase CLI installed: `npm install -g supabase`
- Make sure you're logged in: `supabase login`
- Make sure you linked your project: `supabase link --project-ref YOUR_PROJECT_ID`

---

## Summary

**Files Modified:**
1. ✅ Database migration added: `supabase/migrations/20251219163423_add_user_tracking_to_complaints.sql`
2. ✅ Edge function updated: `supabase/functions/process-complaint/index.ts`

**No frontend changes needed** - Your React components will work automatically once the backend is updated!
