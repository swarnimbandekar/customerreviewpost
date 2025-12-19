# Edge Functions Update for User Authentication

## Overview

Your edge functions need to be updated to support user authentication. The main change is to link complaints to authenticated users.

---

## Updated process-complaint Function

Replace your existing `process-complaint` function with this updated version:

### Location in Supabase Dashboard
**Edge Functions** → **process-complaint** → **Edit**

### Updated Code

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
    ai_response: "Thank you for contacting Indian Postal Department. Your complaint has been received and will be reviewed by our support team. We will get back to you within 48 hours.",
    confidence_score: 50,
    explanation: "Using fallback values due to ML service unavailability.",
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

    // IMPORTANT: Get user from JWT token
    const authHeader = req.headers.get("Authorization");
    let userId = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (!error && user) {
        userId = user.id;
      }
    }

    let mlPredictions = await getMLPredictions(complaint_text);

    if (!mlPredictions) {
      mlPredictions = getFallbackValues();
    }

    const { category, sentiment, priority, ai_response, confidence_score, explanation } = mlPredictions;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert with user_id
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
        user_id: userId, // Link to authenticated user
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
```

---

## Key Changes Made

### 1. User Authentication Detection
```typescript
const authHeader = req.headers.get("Authorization");
let userId = null;

if (authHeader && authHeader.startsWith("Bearer ")) {
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (!error && user) {
    userId = user.id;
  }
}
```

### 2. Link Complaint to User
```typescript
const { data, error } = await supabase
  .from("complaints")
  .insert({
    // ... other fields ...
    user_id: userId, // NEW: Link to authenticated user
  })
```

---

## manage-complaints and complaint-messages Functions

**These functions DO NOT need changes.** They already work correctly because:

1. **manage-complaints**: Uses service role key to access all complaints (admin view)
2. **complaint-messages**: Works with any authenticated user through RLS policies

---

## Testing Your Updated Function

### 1. Deploy the Updated Function

1. Go to **Edge Functions** in Supabase Dashboard
2. Click on **process-complaint**
3. Replace the code with the updated version above
4. Click **Deploy**

### 2. Test from Your Application

The frontend is already configured to send the auth token:

```typescript
const session = await supabase.auth.getSession();

const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.data.session?.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ complaint_text: complaintText }),
});
```

### 3. Verify in Database

After submitting a complaint:

1. Go to **Table Editor** → **complaints**
2. Check that the `user_id` column is filled with the user's UUID
3. Verify the complaint shows up in the user's dashboard

---

## Troubleshooting

### Problem: user_id is NULL

**Solution**: Make sure:
- The database migration was run (adds user_id column)
- The user is logged in
- The auth token is being sent correctly

### Problem: "Permission denied" errors

**Solution**: Check RLS policies:
```sql
-- Verify policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'complaints';
```

### Problem: Function deployment fails

**Solution**:
- Check for syntax errors in the code
- Make sure all imports are correct
- Check the function logs in Supabase Dashboard

---

## Summary

1. **Database**: Run the migration to add `user_id` column ✓ (Already documented in DATABASE_UPDATE_INSTRUCTIONS.md)
2. **Edge Function**: Update process-complaint function (instructions above)
3. **Frontend**: Already updated and ready ✓
4. **Test**: Sign up, log in, submit complaint, verify user_id is set

Your application is now fully multi-user with proper authentication!
