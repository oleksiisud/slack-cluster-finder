# Discord OAuth Integration Setup Guide

This guide will walk you through setting up Discord OAuth for the Slack Cluster Finder application.

## Prerequisites

- A Discord account
- Access to the [Discord Developer Portal](https://discord.com/developers/applications)
- Backend and frontend applications running locally

## Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** in the top right
3. Give your application a name (e.g., "Slack Cluster Finder")
4. Click **"Create"**

## Step 2: Configure OAuth2 Settings

1. In your application dashboard, click **"OAuth2"** in the left sidebar
2. Click **"General"** under OAuth2
3. Find the **"Redirects"** section
4. Click **"Add Redirect"**
5. Add the following redirect URI:
   ```
   http://localhost:5173/discord/callback
   ```
6. Click **"Save Changes"**

## Step 3: Get Your Credentials

1. Still in the OAuth2 section, scroll to **"Client information"**
2. Copy the **Client ID** - you'll need this
3. Click **"Reset Secret"** to generate a new Client Secret
4. Copy the **Client Secret** immediately (you won't be able to see it again!)

## Step 4: Configure Backend Environment Variables

1. Navigate to your backend directory:
   ```bash
   cd /Users/test/slack-cluster-finder/backend
   ```

2. Open or create a `.env` file:
   ```bash
   nano .env
   ```

3. Add the following Discord OAuth variables:
   ```bash
   # Discord OAuth Configuration
   DISCORD_CLIENT_ID=your_discord_client_id_here
   DISCORD_CLIENT_SECRET=your_discord_client_secret_here
   DISCORD_REDIRECT_URI=http://localhost:5173/discord/callback
   ```

4. Replace `your_discord_client_id_here` and `your_discord_client_secret_here` with the values you copied in Step 3

5. Save and close the file (Ctrl+X, then Y, then Enter)

## Step 5: Configure Frontend Environment Variables

1. Navigate to your frontend directory:
   ```bash
   cd /Users/test/slack-cluster-finder/frontend
   ```

2. Open your `.env` file:
   ```bash
   nano .env
   ```

3. Add the following Discord variable:
   ```bash
   # Discord OAuth Configuration
   VITE_DISCORD_CLIENT_ID=your_discord_client_id_here
   VITE_DISCORD_REDIRECT_URI=http://localhost:5173/discord/callback
   ```

4. Replace `your_discord_client_id_here` with your Discord Client ID

5. Save and close the file

## Step 6: Set Required OAuth2 Scopes

The Discord OAuth integration requires the following scopes (these are already configured in the code):

- `identify` - Read user information
- `guilds` - Read user's Discord servers
- `guilds.members.read` - Read guild member information
- `messages.read` - Read message history

These scopes are automatically requested during the OAuth flow.

## Step 7: Restart Your Applications

1. **Restart the backend** (if it's running):
   ```bash
   # Kill the current backend process (Ctrl+C)
   # Then restart it
   cd /Users/test/slack-cluster-finder/backend
   source .venv/bin/activate
   python -m uvicorn main:app --reload --port 8000
   ```

2. **Restart the frontend** (if it's running):
   ```bash
   # Kill the current frontend process (Ctrl+C)
   # Then restart it
   cd /Users/test/slack-cluster-finder/frontend
   npm run dev
   ```

## Step 8: Create Supabase Tables (Optional, for token storage)

If you're using Supabase for token storage, create the following table:

```sql
CREATE TABLE discord_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE discord_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own tokens"
  ON discord_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON discord_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON discord_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON discord_tokens FOR DELETE
  USING (auth.uid() = user_id);
```

## Step 9: Test the Integration

1. Open your application in a browser: http://localhost:5173
2. Sign in to your account
3. Navigate to the Settings/Data Collection page
4. Click the **"Connect"** button under Discord Integration
5. You should be redirected to Discord's authorization page
6. Click **"Authorize"** to grant permissions
7. You should be redirected back to your application with a success message

## Troubleshooting

### "Invalid redirect_uri" Error
- Ensure the redirect URI in Discord Developer Portal exactly matches: `http://localhost:5173/discord/callback`
- Make sure there are no trailing slashes
- Check that you saved changes in the Discord Developer Portal

### "Invalid client" Error
- Double-check that your `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are correct
- Make sure there are no extra spaces in your `.env` file

### Backend Not Receiving Callback
- Verify backend is running on port 8000
- Check backend logs for any errors
- Ensure CORS is properly configured

### Frontend Environment Variables Not Loading
- Make sure to restart the frontend after changing `.env` file
- Vite requires environment variables to be prefixed with `VITE_`
- Check that the variable names are exactly as shown above

### State Parameter Mismatch
- Clear your browser's session storage
- Try the OAuth flow again in an incognito/private window

## Security Best Practices

1. **Never commit `.env` files** - Add them to `.gitignore`
2. **Keep your Client Secret private** - Don't share it or commit it to version control
3. **Use HTTPS in production** - Discord requires HTTPS for production redirect URIs
4. **Rotate secrets regularly** - Generate new secrets periodically in the Discord Developer Portal
5. **Limit scope permissions** - Only request the scopes your application actually needs

## Production Deployment Checklist

When deploying to production:

- [ ] Update redirect URI in Discord Developer Portal to your production URL (e.g., `https://yourdomain.com/discord/callback`)
- [ ] Update `DISCORD_REDIRECT_URI` in backend `.env` to production URL
- [ ] Update `VITE_DISCORD_REDIRECT_URI` in frontend `.env` to production URL
- [ ] Ensure your production domain uses HTTPS
- [ ] Update `VITE_API_BASE_URL` to point to your production backend
- [ ] Verify all environment variables are set in your production environment
- [ ] Test the OAuth flow on production before launching

## Additional Resources

- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)
- [Discord API Documentation](https://discord.com/developers/docs/intro)
- [Discord Developer Portal](https://discord.com/developers/applications)

## Need Help?

If you encounter issues not covered in this guide, please:
1. Check the browser console for error messages
2. Check backend logs for detailed error information
3. Verify all environment variables are set correctly
4. Ensure both backend and frontend are running
