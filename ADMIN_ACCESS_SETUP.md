# Admin Access Setup

## Restrict Admin Panel to Specific Email

Only `swarnimbandekar9@gmail.com` will be able to access the admin panel.

---

## Step 1: Create Admins Table

Run this SQL in your **Supabase SQL Editor**:

```sql
/*
  # Create Admins Table

  1. New Tables
    - `admins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text, unique)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Only admins can read their own admin status
*/

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Policy: Users can check if they are admin
CREATE POLICY "Users can check their admin status"
  ON admins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS admins_user_id_idx ON admins(user_id);
CREATE INDEX IF NOT EXISTS admins_email_idx ON admins(email);
```

---

## Step 2: Grant Admin Access

After creating your admin account with email `swarnimbandekar9@gmail.com`, run this SQL:

### Option A: If Account Already Exists

```sql
-- Add admin access for swarnimbandekar9@gmail.com
INSERT INTO admins (user_id, email)
SELECT id, email
FROM auth.users
WHERE email = 'swarnimbandekar9@gmail.com'
ON CONFLICT (email) DO NOTHING;
```

### Option B: If Account Doesn't Exist Yet

1. Sign up with `swarnimbandekar9@gmail.com` in your app
2. Then run the SQL above

---

## Step 3: Verify Admin Access

Check if admin was added successfully:

```sql
-- Verify admin exists
SELECT * FROM admins WHERE email = 'swarnimbandekar9@gmail.com';
```

You should see one row with the email and user_id.

---

## How It Works

### For Admin User (swarnimbandekar9@gmail.com)
1. Log in with swarnimbandekar9@gmail.com
2. Visit `/admin`
3. Full access to admin dashboard with all features:
   - View all user complaints
   - Dashboard overview
   - Analytics
   - Message threading
   - Mark complaints as resolved

### For Regular Users
1. Log in with any other email (e.g., test@example.com)
2. Try to visit `/admin`
3. See beautiful "Access Denied" page with warning icon
4. Button redirects back to their user dashboard
5. Can only:
   - View their own complaints
   - Submit new complaints
   - Message about their complaints
   - Cannot see other users' data

---

## Adding More Admins (Optional)

If you want to add more admin users in the future:

```sql
-- Add another admin
INSERT INTO admins (user_id, email)
SELECT id, email
FROM auth.users
WHERE email = 'another-admin@example.com'
ON CONFLICT (email) DO NOTHING;
```

---

## Removing Admin Access (Optional)

To remove admin access from a user:

```sql
-- Remove admin access
DELETE FROM admins WHERE email = 'user@example.com';
```

---

## Testing

### Test Admin Access
1. Log in as swarnimbandekar9@gmail.com
2. Go to `/admin`
3. You should see the admin dashboard

### Test Regular User
1. Sign up with a different email (e.g., test@example.com)
2. Try to go to `/admin`
3. You should see "Access Denied - Admins Only"
4. Can only access your own complaints at `/`

---

## Security Notes

- Admin status is stored in database, not in frontend code
- Users cannot grant themselves admin access (RLS prevents this)
- Only database administrators can modify the admins table via SQL
- Frontend checks admin status on every page load
- Protected by Supabase Row Level Security

---

## Troubleshooting

### "Access Denied" even as admin
- Verify you're logged in with swarnimbandekar9@gmail.com
- Check that the email exists in admins table (run verification query)
- Check browser console for errors
- Try logging out and logging back in

### Can't add admin user
- Make sure the user account exists first (sign up in app)
- Check that you're running SQL as database owner
- Verify no typos in email address

### Regular users can still access admin
- Check that frontend code was updated correctly
- Clear browser cache and reload
- Verify RLS policies are enabled on admins table

---

## Summary

1. Create admins table (Step 1)
2. Sign up with swarnimbandekar9@gmail.com
3. Run SQL to grant admin access (Step 2)
4. Test by visiting /admin

Only swarnimbandekar9@gmail.com will have admin access!
