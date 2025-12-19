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