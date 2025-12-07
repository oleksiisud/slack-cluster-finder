# Slack Backend Architecture Documentation

## Overview

This document explains how the Slack integration works on the backend, including OAuth flow, message extraction, and the complete data pipeline from Slack to clustering.

## Table of Contents

1. [OAuth 2.0 Flow](#oauth-20-flow)
2. [Backend Architecture](#backend-architecture)
3. [Slack Service Layer](#slack-service-layer)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Message Extraction Pipeline](#message-extraction-pipeline)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)

---

## OAuth 2.0 Flow

### How Slack Authentication Works

The Slack integration uses **OAuth 2.0** to authenticate users and obtain access tokens that allow the app to read workspace data.

#### Step-by-Step Flow

```
1. User clicks "Connect Slack Workspace" in frontend
   ↓
2. Frontend requests OAuth URL from: GET /auth/slack
   ↓
3. Backend returns Slack authorization URL with client_id and scopes
   ↓
4. User is redirected to Slack's authorization page
   ↓
5. User approves the requested permissions
   ↓
6. Slack redirects back to: /slack/callback?code=XXXXX
   ↓
7. Backend exchanges code for access_token via Slack API
   ↓
8. Backend returns access_token to frontend
   ↓
9. Frontend stores token (localStorage in dev, should be secure storage in prod)
   ↓
10. Token is used for all subsequent Slack API calls
```

### Configuration Required

All OAuth configuration is in `config.py`:

```python
SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID", "")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET", "")
SLACK_REDIRECT_URI = os.getenv("SLACK_REDIRECT_URI", "http://localhost:5173/slack/callback")
SLACK_OAUTH_SCOPES = os.getenv("SLACK_OAUTH_SCOPES", 
    "channels:read,channels:history,groups:read,groups:history,users:read,team:read")
```

### Environment Variables

**Backend `.env`:**
```env
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:5173/slack/callback  # Dev
# Production: https://yourdomain.com/slack/callback
```

**IMPORTANT:** The redirect URI must be:
- Registered in your Slack app settings
- Match exactly (including http/https)
- Point to your FRONTEND (not backend)

---

## Backend Architecture

### File Structure

```
backend/
├── main.py                 # FastAPI app with Slack endpoints
├── slack_service.py        # Slack API integration service
├── config.py               # Configuration (OAuth, scopes)
├── models.py               # Pydantic models for Slack data
├── cluster_orchestrator.py # Clustering logic (receives messages)
└── .env                    # Secrets (NEVER commit this)
```

### Tech Stack

- **FastAPI** - Web framework for API endpoints
- **httpx** - Async HTTP client for Slack API calls
- **Pydantic** - Data validation and serialization
- **python-dotenv** - Environment variable management

---

## Slack Service Layer

### `slack_service.py` - Core Integration

This service handles all communication with Slack's API.

#### Key Class: `SlackService`

```python
class SlackService:
    """Service for interacting with Slack API"""
    
    BASE_URL = "https://slack.com/api"
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
```

#### Core Methods

##### 1. `_make_request(endpoint, params)`
- Generic method for all Slack API calls
- Handles authentication headers
- Validates response (`ok` field)
- Raises exceptions on errors

##### 2. `test_auth()`
- Calls `auth.test` endpoint
- Verifies token validity
- Returns user and workspace info

##### 3. `get_team_info()`
- Calls `team.info` endpoint
- Returns workspace details (name, icon, domain)
- Used to display workspace card in UI

##### 4. `get_channels(types="public_channel,private_channel")`
- Calls `conversations.list` endpoint
- Supports pagination (handles >1000 channels)
- Returns list of channels user has access to
- Includes public and private channels

**Pagination Logic:**
```python
while True:
    params = {"types": types, "limit": 1000}
    if cursor:
        params["cursor"] = cursor
    
    data = await self._make_request("conversations.list", params)
    channels.extend(data.get("channels", []))
    
    cursor = data.get("response_metadata", {}).get("next_cursor")
    if not cursor:
        break
```

##### 5. `get_users()`
- Calls `users.list` endpoint
- Supports pagination
- Returns all workspace users
- Filters can be applied (bots, deleted users)

##### 6. `get_workspace_data()`
- **Composite method** - calls all the above
- Returns complete workspace snapshot:
  - Team info
  - All channels
  - All users
- Used by frontend to populate selection UI

##### 7. `get_channel_messages(channel_id, limit=1000, oldest=None, latest=None)`
- Calls `conversations.history` endpoint
- Extracts messages from a specific channel
- Supports:
  - Pagination (multiple requests for >1000 messages)
  - Time filtering (`oldest`, `latest` timestamps)
  - Configurable limits

**Message Structure:**
```python
{
    "text": "Hello world",
    "user": "U01234567",
    "ts": "1638360000.000100",  # Unix timestamp
    "type": "message"
}
```

---

## API Endpoints

### 1. `GET /auth/slack`

**Purpose:** Initiate OAuth flow

**Response:**
```json
{
  "oauth_url": "https://slack.com/oauth/v2/authorize?client_id=...&scope=...&redirect_uri=..."
}
```

**Implementation:**
```python
@app.get("/auth/slack")
async def slack_oauth_start():
    if not config.SLACK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Slack OAuth not configured")
    
    params = {
        "client_id": config.SLACK_CLIENT_ID,
        "scope": config.SLACK_OAUTH_SCOPES,
        "redirect_uri": config.SLACK_REDIRECT_URI
    }
    oauth_url = f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"
    
    return {"oauth_url": oauth_url}
```

### 2. `GET /auth/slack/callback`

**Purpose:** Exchange OAuth code for access token

**Parameters:**
- `code` (query): Authorization code from Slack

**Response:**
```json
{
  "access_token": "xoxp-1234567890-...",
  "team_id": "T01234567",
  "team_name": "My Workspace",
  "user_id": "U01234567"
}
```

**Implementation:**
```python
@app.get("/auth/slack/callback")
async def slack_oauth_callback(code: str, error: Optional[str] = None):
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    
    # Exchange code for token
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": config.SLACK_CLIENT_ID,
                "client_secret": config.SLACK_CLIENT_SECRET,
                "code": code,
                "redirect_uri": config.SLACK_REDIRECT_URI
            }
        )
        data = response.json()
    
    if not data.get("ok"):
        raise HTTPException(status_code=400, detail=data.get('error'))
    
    return {
        "access_token": data.get("authed_user", {}).get("access_token"),
        "team_id": data.get("team", {}).get("id"),
        "team_name": data.get("team", {}).get("name"),
        "user_id": data.get("authed_user", {}).get("id")
    }
```

**Critical Note:** The redirect URI in the POST request **must exactly match** the one used in the OAuth URL and registered in Slack.

### 3. `GET /slack/workspaces`

**Purpose:** Fetch complete workspace data

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
  "channels": [
    {
      "id": "C01234567",
      "name": "general",
      "is_private": false,
      "is_archived": false,
      "num_members": 42
    }
  ],
  "users": [
    {
      "id": "U01234567",
      "name": "john.doe",
      "real_name": "John Doe",
      "is_bot": false,
      "deleted": false,
      "profile": {...}
    }
  ]
}
```

**Implementation:**
```python
@app.get("/slack/workspaces", response_model=SlackWorkspaceData)
async def get_slack_workspaces(access_token: str):
    try:
        slack_service = get_slack_service(access_token)
        workspace_data = await slack_service.get_workspace_data()
        return workspace_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 4. `POST /slack/extract`

**Purpose:** Extract messages from selected channels

**Request Body:**
```json
{
  "access_token": "xoxp-...",
  "channel_ids": ["C01234567", "C01234568"],
  "user_ids": ["U01234567", "U01234568"]  // Optional filter
}
```

**Response:**
```json
{
  "status": "success",
  "message_count": 1523,
  "messages": [
    {
      "text": "Hello world",
      "user": "U01234567",
      "channel": "C01234567",
      "timestamp": "1638360000.000100"
    }
  ]
}
```

**Implementation:**
```python
@app.post("/slack/extract")
async def extract_slack_messages(
    access_token: str,
    channel_ids: list[str],
    user_ids: Optional[list[str]] = None
):
    slack_service = get_slack_service(access_token)
    
    all_messages = []
    for channel_id in channel_ids:
        messages = await slack_service.get_channel_messages(channel_id)
        
        # Filter by user if specified
        if user_ids:
            messages = [m for m in messages if m.get("user") in user_ids]
        
        all_messages.extend(messages)
    
    return {
        "status": "success",
        "message_count": len(all_messages),
        "messages": all_messages
    }
```

---

## Data Models

All models are in `models.py` using Pydantic for validation.

### `SlackWorkspace`

```python
class SlackWorkspace(BaseModel):
    id: str
    name: str
    domain: Optional[str] = None
    icon: Optional[Dict[str, Any]] = None
```

### `SlackChannel`

```python
class SlackChannel(BaseModel):
    id: str
    name: str
    is_private: bool = False
    is_archived: bool = False
    is_member: bool = False
    num_members: Optional[int] = None
    topic: Optional[str] = None
    purpose: Optional[str] = None
```

### `SlackUser`

```python
class SlackUser(BaseModel):
    id: str
    name: str
    real_name: Optional[str] = None
    is_bot: bool = False
    deleted: bool = False
    profile: Optional[Dict[str, Any]] = None
```

### `SlackWorkspaceData`

```python
class SlackWorkspaceData(BaseModel):
    """Complete workspace data with channels and users"""
    workspace: SlackWorkspace
    channels: List[SlackChannel]
    users: List[SlackUser]
```

---

## Message Extraction Pipeline

### Complete Flow from Slack to Clustering

```
1. User selects channels & users in frontend
   ↓
2. POST /slack/extract with selections
   ↓
3. Backend loops through each channel:
   - Calls conversations.history for each channel
   - Handles pagination (1000 messages per request)
   - Filters by selected users
   ↓
4. Messages aggregated into single array
   ↓
5. Messages returned to frontend
   ↓
6. Frontend can then send to clustering endpoint:
   POST /cluster with message array
   ↓
7. Clustering service processes messages
   ↓
8. Results displayed in dashboard
```

### Message Transformation

**Raw Slack Message:**
```json
{
  "type": "message",
  "user": "U01234567",
  "text": "Hello world",
  "ts": "1638360000.000100",
  "thread_ts": "1638360000.000100",
  "reactions": [...]
}
```

**Transformed for Clustering:**
```json
{
  "text": "Hello world",
  "user": "U01234567",
  "channel": "C01234567",
  "timestamp": "2021-12-01T12:00:00Z"
}
```

---

## Error Handling

### Common Errors and Solutions

#### 1. `invalid_auth` - Invalid Access Token

**Cause:** Token expired or revoked

**Solution:**
```python
try:
    workspace_data = await slack_service.get_workspace_data()
except Exception as e:
    if "invalid_auth" in str(e):
        # Trigger re-authentication
        raise HTTPException(status_code=401, detail="Token expired. Please re-authenticate.")
```

#### 2. `redirect_uri_mismatch`

**Cause:** Redirect URI doesn't match Slack app settings

**Solution:**
- Verify `SLACK_REDIRECT_URI` in `.env`
- Check Slack app OAuth settings
- Ensure exact match (http vs https, trailing slash)

#### 3. `missing_scope`

**Cause:** Token doesn't have required permissions

**Solution:**
- Add missing scopes to Slack app
- User must re-authorize app
- Update `SLACK_OAUTH_SCOPES` in config

#### 4. Rate Limiting

**Slack API limits:**
- Tier 3: 50+ requests per minute
- Tier 4: 100+ requests per minute

**Solution:**
```python
import asyncio

# Add delay between requests
for channel_id in channel_ids:
    messages = await slack_service.get_channel_messages(channel_id)
    await asyncio.sleep(0.1)  # 100ms delay
```

---

## Security Considerations

### 1. Token Storage

**Current Implementation (Development):**
- Token stored in browser localStorage
- Passed as query parameter to API

**Production Requirements:**
- Store tokens in backend database
- Associate with authenticated users
- Encrypt at rest
- Use session tokens for API calls

### 2. CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,  # Specific domains only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Production:**
```env
CORS_ORIGINS=https://yourdomain.com
```

### 3. Environment Variables

**NEVER commit:**
- `.env` file
- Any file containing `SLACK_CLIENT_SECRET`
- Access tokens

**Always use:**
- Environment variables
- Secret management services (AWS Secrets Manager, etc.)
- `.gitignore` for `.env`

### 4. HTTPS Requirements

**Production deployment MUST use HTTPS:**
- Slack requires HTTPS redirect URIs in production
- OAuth tokens transmitted over HTTPS only
- Use SSL/TLS certificates

---

## Testing the Integration

### Manual Testing Checklist

1. **OAuth Flow:**
   ```bash
   # Start backend
   cd backend
   python main.py
   
   # Test OAuth URL generation
   curl http://localhost:8000/auth/slack
   ```

2. **Token Exchange:**
   - Click OAuth URL
   - Approve permissions
   - Check callback receives code
   - Verify token returned

3. **Workspace Data:**
   ```bash
   # Replace TOKEN with actual token
   curl "http://localhost:8000/slack/workspaces?access_token=xoxp-..."
   ```

4. **Message Extraction:**
   ```bash
   curl -X POST http://localhost:8000/slack/extract \
     -H "Content-Type: application/json" \
     -d '{
       "access_token": "xoxp-...",
       "channel_ids": ["C01234567"],
       "user_ids": ["U01234567"]
     }'
   ```

### Debugging Tips

**Enable detailed logging:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Check Slack API responses:**
```python
logger.debug(f"Slack API response: {data}")
```

**Verify environment variables:**
```python
print(f"CLIENT_ID: {config.SLACK_CLIENT_ID}")
print(f"REDIRECT_URI: {config.SLACK_REDIRECT_URI}")
```

---

## Common Development Scenarios

### Scenario 1: Adding New Slack API Call

```python
# In slack_service.py
async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
    """Get detailed user profile"""
    data = await self._make_request("users.info", {"user": user_id})
    return data.get("user", {})
```

### Scenario 2: Processing Message Threads

```python
async def get_thread_messages(self, channel_id: str, thread_ts: str):
    """Get all messages in a thread"""
    params = {
        "channel": channel_id,
        "ts": thread_ts
    }
    data = await self._make_request("conversations.replies", params)
    return data.get("messages", [])
```

### Scenario 3: Real-time Updates with Webhooks

**Not currently implemented**, but would require:
1. Set up Slack Events API subscription
2. Create webhook endpoint to receive events
3. Verify signing secret
4. Process events in real-time

---

## References

- [Slack OAuth Documentation](https://api.slack.com/authentication/oauth-v2)
- [Slack API Methods](https://api.slack.com/methods)
- [Slack Web API](https://api.slack.com/web)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
