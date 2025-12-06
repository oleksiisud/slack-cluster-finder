# Quick Start Guide - Slack Integration

## Prerequisites
- Slack workspace with admin access (to create apps)
- Node.js and npm installed
- Python 3.8+ installed

## Step 1: Set Up Slack App

1. Go to https://api.slack.com/apps and create a new app
2. Add these OAuth scopes under "User Token Scopes":
   - `channels:read`
   - `channels:history`
   - `groups:read`
   - `groups:history`
   - `users:read`
   - `team:read`
3. Add redirect URL: `http://localhost:5173/slack/callback`
4. Copy your Client ID, Client Secret, and Signing Secret

## Step 2: Configure Backend

```bash
cd backend

# Create .env file from example
cp .env.example .env

# Edit .env and add your Slack credentials:
# SLACK_CLIENT_ID=your_client_id
# SLACK_CLIENT_SECRET=your_client_secret
# SLACK_SIGNING_SECRET=your_signing_secret
```

## Step 3: Install Backend Dependencies

```bash
# Make sure you're in the backend directory
pip install -r requirements.txt
```

## Step 4: Configure Frontend

```bash
cd ../frontend

# Create .env file if it doesn't exist
# Add:
# VITE_API_URL=http://localhost:8000
```

## Step 5: Install Frontend Dependencies

```bash
npm install
```

## Step 6: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Step 7: Test the Integration

1. Open http://localhost:5173 in your browser
2. Log in (or sign up if needed)
3. Click "Connect Slack Workspace" on the home page
4. Authorize the app with your Slack workspace
5. You'll be redirected to the workspace selection page
6. Select channels and users, then click "Extract"

## Architecture Overview

```
User clicks "Connect Slack Workspace"
    ↓
Frontend navigates to /slack/auth
    ↓
Backend returns Slack OAuth URL
    ↓
User authorizes on Slack
    ↓
Slack redirects to /slack/callback
    ↓
Backend exchanges code for access token
    ↓
Token stored (localStorage for now)
    ↓
SlackWorkspaces component loads workspace data
    ↓
User selects channels and users
    ↓
Messages extracted and ready for clustering
```

## Files Created/Modified

### Backend
- `backend/config.py` - Added Slack OAuth config
- `backend/models.py` - Added Slack data models
- `backend/slack_service.py` - NEW: Slack API integration
- `backend/main.py` - Added OAuth and workspace endpoints
- `backend/.env.example` - NEW: Environment template

### Frontend
- `frontend/src/components/slack/SlackAuth.jsx` - NEW: Auth initiation page
- `frontend/src/components/slack/SlackAuth.css` - NEW: Styles
- `frontend/src/components/slack/SlackCallback.jsx` - NEW: OAuth callback handler
- `frontend/src/components/slack/SlackCallback.css` - NEW: Styles
- `frontend/src/components/slack/SlackWorkspaces.jsx` - NEW: Workspace selection UI
- `frontend/src/components/slack/SlackWorkspaces.css` - NEW: Styles
- `frontend/src/main.jsx` - Added Slack routes
- `frontend/src/App.jsx` - Added Slack connect button
- `frontend/src/components/DataCard.jsx` - Updated navigation

### Documentation
- `SLACK_INTEGRATION.md` - NEW: Comprehensive integration guide
- `QUICKSTART_SLACK.md` - NEW: This quick start guide

## Troubleshooting

### Backend won't start
- Check that all environment variables are set in `backend/.env`
- Verify Python dependencies are installed: `pip install -r requirements.txt`
- Check port 8000 isn't already in use

### Frontend won't start
- Check that `VITE_API_URL` is set correctly
- Run `npm install` to ensure dependencies are installed
- Check port 5173 isn't already in use

### OAuth redirect fails
- Verify redirect URI in Slack app settings matches exactly: `http://localhost:5173/slack/callback`
- Check that backend is running and accessible
- Ensure no firewall is blocking localhost connections

### No channels/users appear
- Verify you granted all required scopes when authorizing
- Check that you have access to channels in the workspace
- Look at browser console for error messages
- Check backend logs for API errors

## Next Steps

After successfully connecting:
1. Extract messages from selected channels
2. Use the clustering API to analyze messages
3. View results in the dashboard
4. Explore different clustering parameters

## Security Note

⚠️ **Important**: The current implementation stores Slack tokens in browser localStorage, which is suitable for development only. For production:
- Store tokens in a secure backend database
- Associate tokens with authenticated users
- Implement token encryption
- Use HTTPS everywhere
- Set up proper session management

See `SLACK_INTEGRATION.md` for production deployment guidelines.
