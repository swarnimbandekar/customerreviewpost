# Quick Start Guide

Get your new complaint management system up and running in 3 simple steps!

---

## Step 1: Database Migration (5 minutes)

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the SQL from `DATABASE_UPDATE_INSTRUCTIONS.md` (Step 2)
5. Paste and click **Run**
6. Verify in **Table Editor** that `complaints` table has `user_id` column

---

## Step 2: Enable Authentication (2 minutes)

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. **Disable** "Confirm email" (for easier testing)
4. Click **Save**

---

## Step 3: Update Edge Function (3 minutes)

1. Go to **Edge Functions** in Supabase
2. Click on **process-complaint**
3. Copy the updated code from `EDGE_FUNCTIONS_UPDATE.md`
4. Paste and click **Deploy**
5. Wait for deployment to complete

---

## Step 4: Setup Admin Access (5 minutes)

Only `swarnimbandekar9@gmail.com` should access the admin panel.

1. Follow **ADMIN_ACCESS_SETUP.md**
2. Run Step 1 SQL (create admins table)
3. Sign up with `swarnimbandekar9@gmail.com` in your app
4. Run Step 2 SQL (grant admin access)
5. Log in as that email to access `/admin`

**Important**: Regular users will see "Access Denied" at `/admin`

---

## Step 5: Test Your App!

### Test User Flow
1. Run `npm run dev`
2. Open http://localhost:5173
3. You'll see the beautiful login page
4. Click **Sign Up**
5. Create an account (email + password)
6. You're logged in! See your user dashboard
7. Click **New Complaint** button
8. Submit a test complaint
9. Watch it appear with AI analysis and emojis

### Test Admin Flow
1. Open http://localhost:5173/admin in a new tab
2. Log in with your account
3. See the amazing admin dashboard with left navigation
4. Click through Dashboard, Complaints, and Analytics tabs
5. Click on a complaint to view details
6. Test message threading
7. Click "Resolve" to change status

---

## What You Should See

### User Dashboard
- ✅ Statistics cards (Total, Pending, Resolved, High Priority)
- ✅ Filter buttons (All, Pending, Resolved)
- ✅ Search bar
- ✅ "New Complaint" button
- ✅ List of your complaints with emojis
- ✅ Click any complaint to see details

### Admin Dashboard
- ✅ Left sidebar with navigation
- ✅ Dashboard tab with overview metrics
- ✅ Complaints tab with all user complaints
- ✅ Analytics tab with charts and insights
- ✅ Beautiful gradient designs
- ✅ Animated hover effects

---

## Troubleshooting

### "No complaints found" in user dashboard
- Make sure you're logged in
- Try submitting a new complaint
- Check that database migration ran successfully

### "Permission denied" errors
- Verify RLS policies were created (check DATABASE_UPDATE_INSTRUCTIONS.md)
- Make sure you're logged in
- Check browser console for detailed errors

### Edge function errors
- Check function logs in Supabase Dashboard
- Verify the function code was updated correctly
- Make sure CORS headers are present

### Can't log in
- Verify email/password auth is enabled in Supabase
- Check that you're using a valid email format
- Try creating a new account

---

## Features to Try

1. **Submit multiple complaints** with different text
2. **Watch AI categorization** - it detects categories automatically
3. **See emoji reactions** based on sentiment
4. **Test the search** - search by text or category
5. **Use filters** - switch between All, Pending, Resolved
6. **Try messaging** - click a complaint and send a message
7. **Admin resolution** - mark complaints as resolved
8. **Check analytics** - view charts and statistics

---

## Important URLs

- **User Dashboard**: http://localhost:5173
- **Admin Dashboard**: http://localhost:5173/admin
- **Supabase Dashboard**: https://supabase.com/dashboard

---

## Default Behavior

- **All users** see the login page first
- **After login**, regular URL shows user dashboard
- **Admin users** can access `/admin` for admin panel
- **Logout** button available in both dashboards

---

## Production Deployment

When you're ready to deploy:

1. Build your app: `npm run build`
2. Deploy `dist` folder to your hosting (Vercel, Netlify, etc.)
3. Update environment variables on hosting platform
4. Your Supabase backend is already deployed!

---

## Need Help?

Check these files for detailed info:
- `DATABASE_UPDATE_INSTRUCTIONS.md` - Database setup
- `EDGE_FUNCTIONS_UPDATE.md` - Edge function updates
- `IMPLEMENTATION_SUMMARY.md` - Complete feature list

---

## You're All Set!

Your complaint management system is now:
- ✅ Secure with user authentication
- ✅ Beautiful with modern UI/UX
- ✅ Functional with all features working
- ✅ Ready for production

Enjoy your awesome new dashboard!
