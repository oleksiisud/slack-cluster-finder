# Slack Integration Guide

This guide explains how to set up and use the Slack authentication and workspace selection features in AstralSearch.

## Overview

The Slack integration allows users to:
- Authenticate with their Slack account via OAuth 2.0
- View all workspaces they have access to
- Select specific channels and users for message extraction
- Extract messages for clustering and analysis

## Setup Instructions

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter an app name (e.g., "AstralSearch")
5. Select a workspace for development
6. Click **"Create App"**

### 2. Configure OAuth & Permissions

1. In your app settings, go to **"OAuth & Permissions"**
2. Under **"Redirect URLs"**, add:
   ```
   http://localhost:5173/slack/callback
   ```
   (Update this for production with your actual domain)

3. Under **"Scopes"** → **"User Token Scopes"**, add:
   - `channels:read` - View basic information about public channels
   - `channels:history` - View messages in public channels
   - `groups:read` - View basic information about private channels
   - `groups:history` - View messages in private channels
   - `users:read` - View users in the workspace
   - `team:read` - View workspace information

4. Save changes

### 3. Get Your Credentials

1. Go to **"Basic Information"** in your app settings
2. Under **"App Credentials"**, you'll find:
   - **Client ID**
   - **Client Secret**
   - **Signing Secret** (for webhooks)

### 4. Configure Backend Environment

1. Copy `backend/.env.example` to `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edit `backend/.env` and add your Slack credentials:
   ```env
   SLACK_CLIENT_ID=your_client_id_here
   SLACK_CLIENT_SECRET=your_client_secret_here
   SLACK_REDIRECT_URI=http://localhost:5173/slack/callback
   SLACK_OAUTH_SCOPES=channels:read,channels:history,groups:read,groups:history,users:read,team:read
   SLACK_SIGNING_SECRET=your_signing_secret_here
   ```

### 5. Configure Frontend Environment

Create or update `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage Flow

### 1. Start Authentication

Users click **"Connect Slack Workspace"** from the home page, which navigates to `/slack/auth`.

### 2. OAuth Authorization

The app redirects users to Slack's OAuth page where they:
- Choose which workspace to authorize
- Review the permissions being requested
- Approve or deny access

### 3. Callback Handling

After authorization, Slack redirects back to `/slack/callback` with an authorization code. The app:
- Exchanges the code for an access token
- Stores the token securely
- Displays the workspace selection UI

### 4. Workspace Selection

Users see a UI showing:
- Workspace information (name, domain, icon)
- List of all accessible channels (public and private)
- List of active users
- Selection controls for filtering

### 5. Message Extraction

After selecting channels and users, clicking **"Extract"** will:
- Fetch messages from selected channels
- Filter by selected users
- Prepare data for clustering analysis

## API Endpoints

### Backend Endpoints

#### `GET /auth/slack`
Initiates the Slack OAuth flow.

**Response:**
```json
{
  "oauth_url": "https://slack.com/oauth/v2/authorize?client_id=..."
}
```

#### `GET /auth/slack/callback`
Handles the OAuth callback and exchanges code for token.

**Parameters:**
- `code` (query): Authorization code from Slack

**Response:**
```json
{
  "access_token": "xoxp-...",
  "team_id": "T01234567",
  "team_name": "My Workspace",
  "user_id": "U01234567"
}
```

#### `GET /slack/workspaces`
Fetches workspace data including channels and users.

**Parameters:**
- `access_token` (query): User's Slack access token

**Response:**
```json
{
  "workspace": {
    "id": "T01234567",
    "name": "My Workspace",
    "domain": "myworkspace",
    "icon": {...}
  },
  "channels": [...],
  "users": [...]
}
```

#### `POST /slack/extract`
Extracts messages from selected channels.

**Request Body:**
```json
{
  "access_token": "xoxp-...",
  "channel_ids": ["C01234567", "C01234568"],
  "user_ids": ["U01234567", "U01234568"]
}
```

**Response:**
```json
{
  "status": "success",
  "message_count": 150,
  "messages": [...]
}
```

## Frontend Components

### `SlackAuth.jsx`
Landing page for initiating Slack authentication. Displays:
- Slack logo and branding
- "Connect with Slack" button
- Information about what permissions are requested
- Privacy notice

### `SlackCallback.jsx`
Handles the OAuth callback flow:
- Exchanges authorization code for access token
- Stores token in localStorage (should use secure storage in production)
- Displays loading state during exchange
- Shows error messages if authentication fails
- Renders `SlackWorkspaces` component on success

### `SlackWorkspaces.jsx`
Main workspace selection interface:
- Displays workspace information card
- Lists all accessible channels with selection controls
- Lists active users with selection controls
- Provides filter buttons (All, None, Public Only, Private Only)
- Extract button to fetch messages

## Security Considerations

### Production Checklist

1. **Token Storage**
   - Move from localStorage to secure backend storage
   - Associate tokens with authenticated users
   - Implement token encryption at rest

2. **HTTPS**
   - Use HTTPS for all OAuth redirects
   - Update redirect URIs in Slack app settings

3. **Token Rotation**
   - Implement refresh token logic
   - Handle token expiration gracefully
   - Re-authenticate when tokens expire

4. **Environment Variables**
   - Never commit `.env` files to version control
   - Use secrets management in production (AWS Secrets Manager, etc.)
   - Rotate credentials regularly

5. **Rate Limiting**
   - Implement rate limiting for API endpoints
   - Handle Slack API rate limits gracefully
   - Cache workspace data when appropriate

## Architecture

```
Frontend (React)
    ↓
SlackAuth Component → /auth/slack
    ↓
Slack OAuth Page
    ↓
/slack/callback → Backend /auth/slack/callback
    ↓
Access Token Stored
    ↓
SlackWorkspaces Component → /slack/workspaces
    ↓
Display Workspace UI
    ↓
Extract Messages → /slack/extract
    ↓
Clustering Analysis
```

## Backend Service Architecture

```
slack_service.py
├── SlackService class
│   ├── _make_request() - HTTP client for Slack API
│   ├── test_auth() - Verify token validity
│   ├── get_team_info() - Fetch workspace details
│   ├── get_channels() - List all channels
│   ├── get_users() - List all users
│   ├── get_workspace_data() - Combined workspace info
│   └── get_channel_messages() - Extract channel messages
```

## Troubleshooting

### "OAuth error: invalid_client_id"
- Verify `SLACK_CLIENT_ID` matches your app's Client ID
- Ensure no extra spaces in environment variable

### "OAuth error: redirect_uri_mismatch"
- Verify redirect URI in Slack app settings matches `SLACK_REDIRECT_URI`
- Check for http vs https mismatch
- Ensure no trailing slashes

### "Failed to fetch workspace data"
- Check that all required scopes are granted
- Verify access token is valid
- Check backend logs for API errors

### No channels or users shown
- Ensure user has appropriate workspace permissions
- Verify scopes include `channels:read` and `users:read`
- Check that channels aren't archived

## Development vs Production

### Development
- Use `http://localhost:5173` for frontend
- Use `http://localhost:8000` for backend
- Store tokens in localStorage (temporary)

### Production
- Use HTTPS for both frontend and backend
- Store tokens in secure backend database
- Implement proper session management
- Use environment-specific redirect URIs
- Enable CORS only for your domain

## Future Enhancements

- [ ] Support for multiple workspace connections
- [ ] Persistent token storage in database
- [ ] Real-time message streaming
- [ ] Webhook integration for automatic updates
- [ ] Message threading support
- [ ] Advanced filtering options
- [ ] Export functionality
- [ ] Workspace analytics dashboard
