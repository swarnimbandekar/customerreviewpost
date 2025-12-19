# Database Update Instructions

## IMPORTANT: Run this SQL in your Supabase SQL Editor

This update adds user authentication and links complaints to specific users.

### Step 1: Run this SQL in your Supabase Dashboard

Go to: **SQL Editor** → **New Query** → Paste and run this:

```sql
/*
  # Add User Authentication Support

  1. Changes:
     - Add user_id column to complaints table
     - Add user_email column for non-authenticated users (guest mode)
     - Update RLS policies to show users only their own complaints
     - Keep admin access to all complaints

  2. Security:
     - Users can only see their own complaints
     - Authenticated users' complaints are linked to auth.uid()
     - Guest users can track via email (optional)
*/

-- Add user_id column to complaints table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complaints' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE complaints ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_email column for guest tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'complaints' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE complaints ADD COLUMN user_email text;
  END IF;
END $$;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS complaints_user_id_idx ON complaints(user_id);

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can insert complaints" ON complaints;
DROP POLICY IF EXISTS "Anyone can view complaints" ON complaints;
DROP POLICY IF EXISTS "Anyone can update complaints" ON complaints;

-- New policies for user-specific access

-- Users can insert their own complaints
CREATE POLICY "Users can insert own complaints"
  ON complaints
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow anonymous complaints (guest mode)
CREATE POLICY "Allow anonymous complaint submission"
  ON complaints
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Users can view their own complaints
CREATE POLICY "Users can view own complaints"
  ON complaints
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can view all complaints (for admin dashboard)
CREATE POLICY "Service role can view all complaints"
  ON complaints
  FOR SELECT
  TO service_role
  USING (true);

-- Users can update their own complaints (feedback)
CREATE POLICY "Users can update own complaints"
  ON complaints
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can update all complaints (admin actions)
CREATE POLICY "Service role can update all complaints"
  ON complaints
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Step 2: Enable Email/Password Authentication

1. Go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. **Disable** "Confirm email" (for easier testing)
4. Click **Save**

### Step 3: Update Edge Functions

Your edge functions need to be updated to support user authentication. I'll create updated versions in the app.

### Step 4: Test the Migration

1. Run the SQL above in your Supabase SQL Editor
2. Verify no errors appear
3. Check that the `user_id` and `user_email` columns exist in the `complaints` table
4. Check that new RLS policies are in place

### Verification Queries

Run these to verify everything is set up correctly:

```sql
-- Check if columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'complaints'
AND column_name IN ('user_id', 'user_email');

-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'complaints';
```

---

## What Changed?

- **user_id**: Links complaints to authenticated users
- **user_email**: Allows guest users to optionally track complaints
- **RLS Policies**: Users now only see their own complaints
- **Admin Access**: Admin dashboard uses service role key to see all complaints

## Important Notes

1. Existing complaints will have `user_id = NULL` (they're orphaned)
2. New complaints will be linked to the logged-in user
3. Users must be logged in to see their complaints
4. Admin dashboard still sees all complaints

