# Email Notification Setup Guide

This guide will help you configure email notifications for your complaint system using Resend.

## Overview

The system sends email notifications to administrators whenever a new complaint is submitted. This feature requires:
- A Resend account and API key
- An admin email address to receive notifications

## Step 1: Get Your Resend API Key

### Option A: If You Already Have a Resend Account

1. Go to [Resend Dashboard](https://resend.com/login)
2. Log in to your account
3. Navigate to **API Keys** section
4. Click **Create API Key**
5. Give it a name (e.g., "Complaint System")
6. Copy the API key (it starts with `re_`)

### Option B: If You Don't Have a Resend Account

1. Go to [Resend](https://resend.com)
2. Click **Sign Up** or **Get Started**
3. Create your account (free tier available)
4. Verify your email address
5. Once logged in, go to **API Keys**
6. Click **Create API Key**
7. Give it a name (e.g., "Complaint System")
8. Copy the API key (it starts with `re_`)

## Step 2: Configure Environment Variables in Supabase

You need to add two environment variables to your Supabase Edge Functions:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Edge Functions** in the left sidebar
4. Click on **Manage secrets** or **Environment Variables**
5. Add the following secrets:

### Required Secrets

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `RESEND_API_KEY` | Your Resend API key | `re_123abc456def789...` |
| `ADMIN_EMAIL` | Email address to receive notifications | `admin@yourdomain.com` |

### How to Add Secrets

For each secret:
1. Click **Add new secret**
2. Enter the **Name** (exactly as shown above)
3. Enter the **Value**
4. Click **Save** or **Add**

## Step 3: Verify Domain (Optional but Recommended)

For production use, you should verify your domain in Resend:

1. In Resend Dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain name
4. Add the DNS records shown to your domain's DNS settings
5. Wait for verification (usually a few minutes)

Once verified, update the `from` address in the edge function code (see below).

## Step 4: Update Email Sender Address (Optional)

By default, emails are sent from `noreply@resend.dev`. To use your own domain:

1. Verify your domain in Resend (see Step 3)
2. The edge function will automatically use your verified domain

**Note:** The current code in `supabase/functions/process-complaint/index.ts` uses:
```typescript
from: "Complaint System <noreply@resend.dev>"
```

If you want to use your own domain, you can update this to:
```typescript
from: "Complaint System <noreply@yourdomain.com>"
```

## Step 5: Test Email Notifications

1. Submit a test complaint through your application
2. Check if you receive an email at the admin email address
3. If you don't receive an email, check:
   - Spam/Junk folder
   - Supabase Edge Function logs for errors
   - Verify your API key is correct
   - Verify your admin email is correct

## Troubleshooting

### Email Not Sending

Check the Edge Function logs:
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click on **process-complaint** function
4. View the **Logs** tab
5. Look for errors related to email sending

### Common Issues

**Issue:** "Email service returned status 401"
- **Solution:** Your RESEND_API_KEY is invalid or missing. Double-check the API key.

**Issue:** "Email service returned status 403"
- **Solution:** Your domain is not verified, or you're using an email address from an unverified domain.

**Issue:** "Email not configured"
- **Solution:** ADMIN_EMAIL or RESEND_API_KEY environment variables are not set in Supabase.

### Email Format

Notifications include:
- Complaint ID
- Category (e.g., Delivery Issue, Lost Package)
- Priority (High, Medium, Low)
- Sentiment (Positive, Neutral, Negative)
- Full complaint text
- AI-generated response
- AI confidence score
- Submission timestamp

## Resend Free Tier Limits

The free tier includes:
- 100 emails per day
- 3,000 emails per month
- Rate limit: 2 emails per second

For higher volumes, check [Resend Pricing](https://resend.com/pricing).

## Security Best Practices

1. **Never commit API keys** to your repository
2. Store API keys only in Supabase Edge Function secrets
3. Use environment variables for sensitive data
4. Regularly rotate API keys
5. Use a dedicated email address for admin notifications

## Need Help?

- [Resend Documentation](https://resend.com/docs)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- Check the logs in Supabase Dashboard for specific error messages
