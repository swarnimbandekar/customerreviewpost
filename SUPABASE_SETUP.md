# Supabase Setup Guide

This guide explains how to set up your Supabase project for the Complaint Management System.

## Overview

Your application uses:
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Edge Functions**: Two serverless functions for processing and managing complaints
- **Real-time Updates**: For the admin dashboard

## Step 1: Run Database Migration

You need to create the `complaints` table in your Supabase database.

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/twkmtbfuacwdriwngcep
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the SQL below
5. Click **Run** or press `Ctrl+Enter`

```sql
/*
  # Complaint Management System Schema

  1. New Tables
    - `complaints`
      - `id` (uuid, primary key) - Unique complaint identifier
      - `complaint_text` (text) - The complaint submitted by user
      - `category` (text) - AI-detected category (Delayed Delivery, Lost Package, Damaged Parcel, etc.)
      - `sentiment` (text) - Sentiment analysis result (Positive, Neutral, Negative)
      - `priority` (text) - Priority level (High, Medium, Low)
      - `ai_response` (text) - Auto-generated response from AI
      - `status` (text) - Complaint status (Pending, Resolved)
      - `feedback_helpful` (boolean, nullable) - User feedback on AI response
      - `created_at` (timestamptz) - Timestamp of complaint submission
      - `updated_at` (timestamptz) - Timestamp of last update

  2. Security
    - Enable RLS on `complaints` table
    - Add policies for public insert (complaint submission)
    - Add policies for public select (view complaints)
    - Add policies for public update (admin actions, feedback)

  3. Notes
    - Public access is enabled for MVP/demo purposes
    - In production, implement proper authentication for admin actions
    - Feedback data will be used for periodic model retraining
*/

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_text text NOT NULL,
  category text NOT NULL,
  sentiment text NOT NULL,
  priority text NOT NULL,
  ai_response text NOT NULL,
  status text DEFAULT 'Pending' NOT NULL,
  feedback_helpful boolean DEFAULT null,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit complaints (public form)
CREATE POLICY "Anyone can insert complaints"
  ON complaints
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to view complaints (for admin dashboard)
CREATE POLICY "Anyone can view complaints"
  ON complaints
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anyone to update complaints (for admin actions and feedback)
CREATE POLICY "Anyone can update complaints"
  ON complaints
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS complaints_created_at_idx ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints(status);
CREATE INDEX IF NOT EXISTS complaints_priority_idx ON complaints(priority);
```

### Option B: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

## Step 2: Deploy Edge Functions

Your application has two Edge Functions that need to be deployed:

### 1. process-complaint

This function processes new complaints and stores them in the database. It can integrate with an external ML service for AI predictions.

**Deploy via Supabase Dashboard:**

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Deploy a new function**
3. Name it: `process-complaint`
4. Copy the code from `supabase/functions/process-complaint/index.ts`
5. Click **Deploy function**

### 2. manage-complaints

This function handles fetching and updating complaints (for the admin dashboard).

**Deploy via Supabase Dashboard:**

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Deploy a new function**
3. Name it: `manage-complaints`
4. Copy the code from `supabase/functions/manage-complaints/index.ts`
5. Click **Deploy function**

## Step 3: Configure Environment Variables (Optional)

If you want to use an external ML service for AI predictions:

1. Go to **Edge Functions** → **Configuration** in your Supabase Dashboard
2. Add the environment variable:
   - Key: `ML_SERVICE_URL`
   - Value: Your ML service endpoint (e.g., `https://your-ml-service.com`)

**Note**: If this variable is not set, the system will use fallback values and still accept complaints.

## Step 4: Verify Setup

After completing the above steps, verify your setup:

### Check Database Table

1. Go to **Table Editor** in Supabase Dashboard
2. You should see a `complaints` table with all the columns listed above

### Check Edge Functions

1. Go to **Edge Functions** in Supabase Dashboard
2. You should see both functions listed and deployed:
   - `process-complaint`
   - `manage-complaints`

### Test the Application

1. Run your application: `npm run dev`
2. Submit a test complaint through the form
3. Check if it appears in the Admin Dashboard
4. Verify the data is stored in the `complaints` table in Supabase

## Architecture Overview

```
┌─────────────────┐
│   Frontend App  │
│  (React + Vite) │
└────────┬────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌────────────────────┐            ┌────────────────────┐
│  Edge Function:    │            │  Edge Function:    │
│ process-complaint  │            │ manage-complaints  │
└────────┬───────────┘            └────────┬───────────┘
         │                                  │
         │                                  │
         └──────────────┬───────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │   PostgreSQL  │
                │   Database    │
                │  (complaints) │
                └───────────────┘
```

## Database Schema

### complaints table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| complaint_text | text | The complaint submitted |
| category | text | AI-detected category |
| sentiment | text | Sentiment analysis |
| priority | text | Priority level |
| ai_response | text | Auto-generated response |
| status | text | Pending or Resolved |
| feedback_helpful | boolean | User feedback (nullable) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

## Security Notes

- **RLS is enabled** on the complaints table
- Public access is allowed for demo purposes
- For production, implement authentication and restrict policies
- Admin actions should be protected with proper auth checks

## Troubleshooting

### Edge Functions not working?

1. Check if functions are deployed in the Dashboard
2. Verify CORS headers are set correctly
3. Check function logs in the Dashboard for errors

### Database connection issues?

1. Verify your `.env` file has the correct credentials
2. Check if the `complaints` table exists
3. Verify RLS policies are created

### Cannot submit complaints?

1. Check browser console for errors
2. Verify Edge Functions are deployed
3. Check if CORS headers allow your domain

## Next Steps

- Consider adding authentication for admin dashboard
- Set up email notifications for new complaints
- Integrate with an ML service for better AI predictions
- Add more analytics and reporting features

## Support

For issues with Supabase:
- Documentation: https://supabase.com/docs
- Discord: https://discord.supabase.com
- GitHub: https://github.com/supabase/supabase
