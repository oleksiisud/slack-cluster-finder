# AstralSearch - Complete System Documentation

## Overview

AstralSearch is a chat message clustering application that uses AI to organize Slack messages into meaningful topic clusters. This document provides a comprehensive understanding of the entire system architecture, from message extraction to cluster visualization.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Complete Data Flow](#complete-data-flow)
4. [Slack Integration Details](#slack-integration-details)
5. [Local Development Setup](#local-development-setup)
6. [Production Deployment](#production-deployment)
7. [Critical Configuration](#critical-configuration)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## System Architecture

### High-Level Overview

```
┌────────────────────────────────────────────────────────────────┐
│                         User Interface                         │
│                      (React + Vite Frontend)                   │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Login/     │  │    Slack     │  │  Clustering  │          │
│  │   Signup     │  │  Integration │  │  Dashboard   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────────────────────────────────────────┘
                              ↕
┌────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                           │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    OAuth     │  │    Slack     │  │  Clustering  │          │
│  │  Endpoints   │  │   Service    │  │    Engine    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────────────────────────────────────────┘
         ↕                    ↕                    ↕
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Supabase   │    │  Slack API  │    │ Hugging Face│
│   (Auth)    │    │   (OAuth)   │    │   (Models)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Component Breakdown

#### Frontend (Port 5173)
- **Framework:** React with Vite
- **Routing:** React Router
- **Authentication:** Supabase Auth
- **State:** React hooks (useState, useEffect)
- **Styling:** Custom CSS (no UI library)

#### Backend (Port 8000)
- **Framework:** FastAPI
- **API Client:** httpx (async HTTP)
- **Validation:** Pydantic models
- **ML Models:** Hugging Face Transformers
- **Clustering:** Scikit-learn (HDBSCAN, KMeans)

#### External Services
- **Supabase:** User authentication and database
- **Slack API:** OAuth and message retrieval
- **Hugging Face:** Embedding models and LLMs

---

## Technology Stack

### Backend Technologies

```python
# requirements.txt (key dependencies)
fastapi==0.104.1          # Web framework
uvicorn==0.24.0           # ASGI server
httpx==0.25.0             # Async HTTP client
pydantic==2.5.0           # Data validation
transformers==4.35.0      # ML models
sentence-transformers==2.2.2  # Embeddings
scikit-learn==1.3.2       # Clustering
hdbscan==0.8.33           # Density-based clustering
python-dotenv==1.0.0      # Environment variables
```

### Frontend Technologies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@supabase/supabase-js": "^2.38.4",
    "bootstrap": "^5.3.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

---

## Complete Data Flow

### End-to-End Message Journey

```
1. USER AUTHENTICATION
   User → Login Page → Supabase Auth → Session Token → Home Page

2. SLACK CONNECTION
   User → "Connect Slack" → OAuth Flow:
      a) GET /auth/slack → OAuth URL
      b) User authorizes on Slack
      c) Slack → /slack/callback?code=XXX
      d) POST /auth/slack/callback → Access Token
      e) Store token (localStorage in dev)

3. WORKSPACE SELECTION
   Frontend → GET /slack/workspaces?access_token=XXX → Backend:
      a) Call Slack API: team.info
      b) Call Slack API: conversations.list
      c) Call Slack API: users.list
      d) Aggregate data
      e) Return workspace data → Frontend
   Frontend displays channels and users

4. MESSAGE EXTRACTION
   User selects channels/users → POST /slack/extract → Backend:
      a) Loop through selected channels
      b) For each channel: conversations.history
      c) Filter by selected users
      d) Aggregate all messages
      e) Return messages → Frontend
   
5. CLUSTERING
   Frontend → POST /cluster with messages → Backend:
      a) Load embedding model (sentence-transformers)
      b) Generate embeddings for each message
      c) Apply clustering algorithm (HDBSCAN or KMeans)
      d) Group messages by cluster
      e) Generate cluster labels (LLM)
      f) Return clustered data → Frontend

6. VISUALIZATION
   Frontend receives clusters → Display in Dashboard:
      a) Cluster graph (nodes and edges)
      b) Message lists per cluster
      c) Search and filter
      d) Interactive exploration
```

---

## Slack Integration Details

### OAuth 2.0 Complete Flow

#### Prerequisites

1. **Slack App Created** at https://api.slack.com/apps
2. **OAuth Scopes Configured:**
   - `channels:read` - View public channels
   - `channels:history` - Read public channel messages
   - `groups:read` - View private channels
   - `groups:history` - Read private channel messages
   - `users:read` - View workspace users
   - `team:read` - View workspace information

3. **Redirect URI Registered:**
   - Development: `https://TUNNEL-URL.trycloudflare.com/slack/callback`
   - Production: `https://yourdomain.com/slack/callback`

#### Flow Diagram

```
┌──────────┐
│  User    │
│ (Browser)│
└────┬─────┘
     │ 1. Click "Connect Slack"
     ↓
┌──────────────┐
│   Frontend   │
│ /slack/auth  │
└────┬─────────┘
     │ 2. GET /auth/slack
     ↓
┌──────────────┐
│   Backend    │ 3. Generate OAuth URL with:
│              │    - client_id
│              │    - scopes
│              │    - redirect_uri
└────┬─────────┘
     │ 4. Return oauth_url
     ↓
┌──────────────┐
│   Frontend   │ 5. window.location.href = oauth_url
└────┬─────────┘
     │ 6. Redirect to Slack
     ↓
┌──────────────┐
│  Slack OAuth │ 7. User approves permissions
│     Page     │
└────┬─────────┘
     │ 8. Redirect to: redirect_uri?code=XXXXX
     ↓
┌──────────────┐
│   Frontend   │
│/slack/callback│ 9. Extract code from URL
└────┬─────────┘
     │ 10. GET /auth/slack/callback?code=XXXXX
     ↓
┌──────────────┐
│   Backend    │ 11. POST to Slack:
│              │     https://slack.com/api/oauth.v2.access
│              │     - client_id
│              │     - client_secret
│              │     - code
│              │     - redirect_uri (must match!)
└────┬─────────┘
     │ 12. Slack returns:
     │     - access_token
     │     - team_id
     │     - user_id
     ↓
┌──────────────┐
│   Frontend   │ 13. Store token
│              │     localStorage.setItem('slack_access_token', token)
│              │ 14. Render workspace UI
└──────────────┘
```

#### Critical Configuration Points

**Backend `.env`:**
```env
SLACK_CLIENT_ID=1234567890.9876543210
SLACK_CLIENT_SECRET=abc123def456ghi789jkl012mno345pq
SLACK_REDIRECT_URI=https://YOUR-FRONTEND-TUNNEL.trycloudflare.com/slack/callback
SLACK_OAUTH_SCOPES=channels:read,channels:history,groups:read,groups:history,users:read,team:read
```

**Frontend `.env`:**
```env
VITE_API_URL=https://YOUR-BACKEND-TUNNEL.trycloudflare.com
```

**Slack App Settings:**
- Redirect URL must **exactly match** `SLACK_REDIRECT_URI`
- Must use HTTPS in production
- Case-sensitive, including trailing slashes

### Message Extraction Details

#### API Call Sequence

```python
# 1. Get workspace info
team_data = await slack_service.get_team_info()
# Slack API: GET https://slack.com/api/team.info
# Returns: team name, icon, domain

# 2. Get all channels
channels = await slack_service.get_channels()
# Slack API: GET https://slack.com/api/conversations.list
# Parameters: types=public_channel,private_channel, limit=1000
# Handles pagination automatically

# 3. Get all users
users = await slack_service.get_users()
# Slack API: GET https://slack.com/api/users.list
# Parameters: limit=1000
# Handles pagination automatically

# 4. Get messages from each channel
for channel_id in selected_channels:
    messages = await slack_service.get_channel_messages(channel_id)
    # Slack API: GET https://slack.com/api/conversations.history
    # Parameters: channel=C123, limit=1000
    # Handles pagination for >1000 messages
```

#### Message Format

**Raw Slack Message:**
```json
{
  "type": "message",
  "user": "U01234567",
  "text": "Hello team! Let's discuss the project.",
  "ts": "1701878400.123456",
  "thread_ts": "1701878400.123456",
  "reactions": [
    {"name": "thumbsup", "users": ["U98765432"], "count": 1}
  ]
}
```

**Transformed for Clustering:**
```json
{
  "text": "Hello team! Let's discuss the project.",
  "user": "U01234567",
  "channel": "C01234567",
  "timestamp": "2023-12-06T12:00:00Z",
  "message_id": "C01234567_1701878400.123456"
}
```

---

## Local Development Setup

### Complete Step-by-Step Guide

#### 1. Clone and Install

```powershell
# Clone repository
git clone https://github.com/oleksiisud/slack-cluster-finder.git
cd slack-cluster-finder

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install
```

#### 2. Configure Slack App

1. Go to https://api.slack.com/apps
3. Name: "AstralSearch"
4. Select workspace
5. Go to "OAuth & Permissions"
6. Add scopes (see OAuth section above)
7. Copy **Client ID** and **Client Secret**

#### 3. Set Up Environment Variables

**Backend `.env`:**
```env
# Hugging Face (get from https://huggingface.co/settings/tokens)
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase (get from Supabase dashboard)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Slack OAuth
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_REDIRECT_URI=http://localhost:5173/slack/callback  # Temporary
SLACK_OAUTH_SCOPES=channels:read,channels:history,groups:read,groups:history,users:read,team:read

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:8000

# Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_SUPABASE_ACCESS_TOKEN=xapp-xxxxxxxxxxxxx
```

#### 4. Start Services

**Terminal 1 - Backend:**
```powershell
cd backend
python main.py
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

**Terminal 3 - Backend Tunnel:**
```powershell
cloudflared tunnel --url http://localhost:8000
```
Copy the URL (e.g., `https://abc-123.trycloudflare.com`)

**Terminal 4 - Frontend Tunnel:**
```powershell
cloudflared tunnel --url http://localhost:5173
```
Copy the URL (e.g., `https://xyz-456.trycloudflare.com`)

#### 5. Update Configuration with Tunnel URLs

**Backend `.env`:**
```env
SLACK_REDIRECT_URI=https://xyz-456.trycloudflare.com/slack/callback
CORS_ORIGINS=http://localhost:5173,https://xyz-456.trycloudflare.com
```

**Frontend `.env`:**
```env
VITE_API_URL=https://abc-123.trycloudflare.com
```

#### 6. Update Slack App Redirect URI

1. Go to Slack app settings
2. OAuth & Permissions
3. Add redirect URL: `https://xyz-456.trycloudflare.com/slack/callback`
4. Save changes

#### 7. Restart Backend

```powershell
# In Terminal 1 (backend)
Ctrl+C
python main.py
```

#### 8. Access Application

Open browser: `https://xyz-456.trycloudflare.com` (frontend tunnel URL)

---

## Production Deployment

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Setup                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (Vercel/Netlify/Static Hosting)                   │
│  https://app.yourdomain.com                                  │
│                                                              │
│  ├─ React app (static files)                                │
│  ├─ Served via CDN                                           │
│  └─ SSL certificate (automatic)                              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Backend (Render/Railway/AWS/Docker)                         │
│  https://api.yourdomain.com                                  │
│                                                              │
│  ├─ FastAPI application                                     │
│  ├─ Uvicorn ASGI server                                     │
│  ├─ Environment variables from secrets manager              │
│  └─ SSL certificate                                          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Database (PostgreSQL)                                       │
│  Managed service or self-hosted                              │
│                                                              │
│  ├─ User accounts                                            │
│  ├─ Slack tokens (encrypted)                                │
│  ├─ Clustered data                                           │
│  └─ Usage analytics                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Checklist

#### Frontend Deployment

**Option 1: Vercel**
```bash
cd frontend
npm run build
vercel --prod
```

**Option 2: Netlify**
```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

**Environment variables to set:**
- `VITE_API_URL=https://api.yourdomain.com`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

#### Backend Deployment

**Option 1: Render (Recommended)**

1. Create `render.yaml`:
```yaml
services:
  - type: web
    name: astralsearch-api
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "uvicorn main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: HF_TOKEN
        sync: false
      - key: SLACK_CLIENT_ID
        sync: false
      - key: SLACK_CLIENT_SECRET
        sync: false
      - key: SLACK_REDIRECT_URI
        value: https://app.yourdomain.com/slack/callback
      - key: CORS_ORIGINS
        value: https://app.yourdomain.com
```

2. Connect GitHub repo
3. Add environment variables
4. Deploy

**Option 2: Docker**

`Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Deploy to:
- AWS ECS/Fargate
- Google Cloud Run
- Azure Container Apps
- DigitalOcean App Platform

#### Database Setup

**PostgreSQL for Token Storage:**

```sql
CREATE TABLE user_slack_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    encrypted_token TEXT NOT NULL,
    team_id VARCHAR(255),
    team_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, team_id)
);

CREATE INDEX idx_user_id ON user_slack_tokens(user_id);
CREATE INDEX idx_team_id ON user_slack_tokens(team_id);
```

**Token Encryption:**

```python
from cryptography.fernet import Fernet
import os

# Store key in environment variable
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
cipher = Fernet(ENCRYPTION_KEY)

def encrypt_token(token: str) -> str:
    return cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    return cipher.decrypt(encrypted_token.encode()).decode()
```

#### Slack App Configuration

Update redirect URIs in Slack app:
```
https://app.yourdomain.com/slack/callback
```

Remove all development/tunnel URLs.

---

## Critical Configuration

### Environment Variables Master List

#### Backend Required Variables

```env
# ML/AI Models
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Hugging Face API token

# Database (if using)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Slack OAuth
SLACK_CLIENT_ID=1234567890.9876543210
SLACK_CLIENT_SECRET=abc123def456ghi789jkl012mno345pq
SLACK_REDIRECT_URI=https://app.yourdomain.com/slack/callback
SLACK_OAUTH_SCOPES=channels:read,channels:history,groups:read,groups:history,users:read,team:read

# Security
ENCRYPTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # For token encryption
CORS_ORIGINS=https://app.yourdomain.com

# Server
HOST=0.0.0.0
PORT=8000
```

#### Frontend Required Variables

```env
# API
VITE_API_URL=https://api.yourdomain.com

# Authentication
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_SUPABASE_ACCESS_TOKEN=xapp-xxxxxxxxxxxxx  # For admin operations
```

### Security Best Practices

1. **Never commit `.env` files**
   - Add to `.gitignore`
   - Use `.env.example` for templates

2. **Use secrets managers in production**
   - AWS Secrets Manager
   - Google Cloud Secret Manager
   - Azure Key Vault
   - Render/Railway built-in secrets

3. **Rotate credentials regularly**
   - Change API keys every 90 days
   - Regenerate OAuth secrets if compromised

4. **Encrypt sensitive data**
   - Database encryption at rest
   - Token encryption before storage
   - HTTPS everywhere

5. **Implement rate limiting**
   ```python
   from slowapi import Limiter
   
   limiter = Limiter(key_func=get_remote_address)
   
   @app.get("/auth/slack")
   @limiter.limit("5/minute")
   async def slack_oauth_start():
       ...
   ```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. OAuth "redirect_uri_mismatch"

**Symptom:** Error message from Slack after authorization

**Causes:**
- Redirect URI in Slack app doesn't match `SLACK_REDIRECT_URI`
- HTTP vs HTTPS mismatch
- Trailing slash difference

**Solution:**
```bash
# Check configuration
echo $SLACK_REDIRECT_URI  # Backend
# Should exactly match Slack app settings

# Common fixes:
# ❌ http://localhost:5173/slack/callback
# ✅ https://tunnel.trycloudflare.com/slack/callback

# ❌ https://app.com/slack/callback/
# ✅ https://app.com/slack/callback
```

#### 2. CORS Errors

**Symptom:** Browser console shows CORS policy errors

**Solution:**
```python
# Backend config.py
CORS_ORIGINS = "https://frontend.com,http://localhost:5173"

# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 3. Token Invalid/Expired

**Symptom:** `invalid_auth` error from Slack API

**Solutions:**
- Token was revoked by user
- Token expired (long-lived but can expire)
- App permissions changed

**Fix:** Re-authenticate through OAuth flow

#### 4. Tunnel Disconnected

**Symptom:** 502 Bad Gateway on tunnel URL

**Solutions:**
```bash
# Check if backend is running
curl http://localhost:8000/health

# Restart tunnel
cloudflared tunnel --url http://localhost:8000

# Update .env with new URL
# Update Slack app redirect URI
# Restart backend
```

#### 5. Messages Not Extracting

**Symptom:** Empty message list returned

**Debugging:**
```python
# In slack_service.py, add logging
logger.debug(f"Fetching from channel: {channel_id}")
logger.debug(f"Response: {data}")
logger.debug(f"Message count: {len(messages)}")

# Check scopes
# Ensure channels:history or groups:history scope is approved

# Check user access
# User must be member of private channels
```

#### 6. Clustering Fails

**Symptom:** Error during POST /cluster

**Common causes:**
- Too few messages (need at least 10)
- Empty or invalid text content
- Embedding model not loaded

**Solutions:**
```python
# Check message format
messages = [
    {"text": "Hello", "user": "U1", "channel": "C1", "timestamp": "..."},
    # ... at least 10 messages
]

# Verify model loaded
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
```

#### 7. Frontend Build Fails

**Symptom:** `npm run build` errors

**Solutions:**
```bash
# Clear cache
rm -rf node_modules
rm package-lock.json
npm install

# Check environment variables
# Ensure all VITE_ variables are set

# Check for import errors
npm run build 2>&1 | grep "error"
```

---

## Monitoring and Logging

### Backend Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Log important events
logger.info("OAuth flow started")
logger.info(f"Messages extracted: {count}")
logger.error(f"Slack API error: {error}")
```

### Frontend Logging

```javascript
// Development only
if (import.meta.env.DEV) {
    console.log('OAuth URL:', oauthUrl);
    console.log('Messages extracted:', messages.length);
}
```

### Production Monitoring

- **Error tracking:** Sentry
- **Performance:** New Relic, DataDog
- **Uptime:** Pingdom, UptimeRobot
- **Logs:** CloudWatch, LogDNA

---

## Additional Resources

### Documentation Files

- `backend/SLACK_BACKEND_ARCHITECTURE.md` - Detailed backend implementation
- `backend/TUNNELING_AND_DEPLOYMENT.md` - Tunneling and deployment guide
- `frontend/SLACK_FRONTEND_ARCHITECTURE.md` - Frontend implementation details
- `SLACK_INTEGRATION.md` - Slack setup guide
- `QUICKSTART_SLACK.md` - Quick start instructions

### External Links

- [Slack API Documentation](https://api.slack.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Supabase Documentation](https://supabase.com/docs)

---

## Quick Reference

### Common Commands

```bash
# Start development
cd backend && python main.py
cd frontend && npm run dev
cloudflared tunnel --url http://localhost:8000
cloudflared tunnel --url http://localhost:5173

# Build for production
cd frontend && npm run build

# Test API
curl http://localhost:8000/health
curl http://localhost:8000/auth/slack

# Check logs
tail -f backend/app.log

# Git commands
git status
git add .
git commit -m "Your message"
git push origin implement_slack
```

### Environment Checklist

Before testing:
- [ ] Backend running on 8000
- [ ] Frontend running on 5173
- [ ] Backend tunnel active
- [ ] Frontend tunnel active
- [ ] `.env` files updated with tunnel URLs
- [ ] Slack app redirect URI updated
- [ ] Backend restarted after `.env` changes
- [ ] Browser open to frontend tunnel URL

---

This documentation should provide a complete understanding of the system for both human developers and AI assistants working on the project.
