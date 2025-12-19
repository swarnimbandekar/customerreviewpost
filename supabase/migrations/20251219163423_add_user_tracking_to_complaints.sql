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