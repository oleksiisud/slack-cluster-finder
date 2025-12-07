# Cloudflare Tunneling and Deployment Guide

## Overview

This document explains how to use Cloudflare tunnels for local development with Slack OAuth and how to deploy the application to production.

## Table of Contents

1. [Why Tunneling is Required](#why-tunneling-is-required)
2. [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
3. [Development Workflow](#development-workflow)
4. [Environment Configuration](#environment-configuration)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Why Tunneling is Required

### The Problem

Slack OAuth **requires** a publicly accessible redirect URI. During development:
- Frontend runs on `http://localhost:5173`
- Backend runs on `http://localhost:8000`
- Slack cannot redirect to `localhost` URLs

### The Solution

Use **Cloudflare Tunnel** to create temporary public URLs that tunnel to your localhost.

### Architecture

```
Slack OAuth
    ↓
https://random-subdomain.trycloudflare.com/slack/callback
    ↓ (tunnel)
http://localhost:5173/slack/callback
    ↓
Frontend receives OAuth code
    ↓
Frontend calls: https://backend-subdomain.trycloudflare.com/auth/slack/callback
    ↓ (tunnel)
http://localhost:8000/auth/slack/callback
    ↓
Backend exchanges code for token
```

---

## Cloudflare Tunnel Setup

### Installation

Cloudflare tunnel (`cloudflared`) is already available if you see it in your terminals.

If not installed:
```powershell
# Windows - Using Chocolatey
choco install cloudflared

# Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### Starting Tunnels

You need **TWO separate tunnels**:

#### 1. Frontend Tunnel (Port 5173)

```powershell
# Terminal 1 - Frontend Tunnel
cloudflared tunnel --url http://localhost:5173
```

**Output:**
```
Your quick Tunnel has been created! Visit it at:
https://ebook-retro-weeks-mouse.trycloudflare.com
```

**What this does:**
- Creates a temporary public URL
- Routes all traffic to `localhost:5173`
- **This is your Slack redirect URI**

#### 2. Backend Tunnel (Port 8000)

```powershell
# Terminal 2 - Backend Tunnel
cloudflared tunnel --url http://localhost:8000
```

**Output:**
```
Your quick Tunnel has been created! Visit it at:
https://cohen-stan-narrative-symbols.trycloudflare.com
```

**What this does:**
- Creates a temporary public URL
- Routes all traffic to `localhost:8000`
- **This is your backend API URL**

### Critical Notes

⚠️ **The tunnel URLs are random and temporary!**
- New URLs generated each time you start `cloudflared`
- Must update environment variables with new URLs
- Must update Slack app redirect URI

⚠️ **Tunnels must be running during development**
- Keep terminal windows open
- If tunnel disconnects, OAuth will fail

---

## Development Workflow

### Complete Setup Process

**1. Start Backend**
```powershell
# Terminal: python
cd backend
python main.py
```

**Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**2. Start Backend Tunnel**
```powershell
# Terminal: cloudflared (backend)
cloudflared tunnel --url http://localhost:8000
```

**Copy the URL:** `https://YOUR-BACKEND-URL.trycloudflare.com`

**3. Start Frontend**
```powershell
# Terminal: esbuild
cd frontend
npm run dev
```

**Output:**
```
VITE ready in 500ms
➜  Local:   http://localhost:5173/
```

**4. Start Frontend Tunnel**
```powershell
# Terminal: cloudflared (frontend)
cloudflared tunnel --url http://localhost:5173
```

**Copy the URL:** `https://YOUR-FRONTEND-URL.trycloudflare.com`

**5. Update Environment Variables**

**Backend `.env`:**
```env
SLACK_REDIRECT_URI=https://YOUR-FRONTEND-URL.trycloudflare.com/slack/callback
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://YOUR-FRONTEND-URL.trycloudflare.com
```

**Frontend `.env`:**
```env
VITE_API_URL=https://YOUR-BACKEND-URL.trycloudflare.com
```

**6. Update Slack App Settings**

Go to: https://api.slack.com/apps → Your App → OAuth & Permissions

Update **Redirect URLs:**
```
https://YOUR-FRONTEND-URL.trycloudflare.com/slack/callback
```

**7. Restart Backend**
```powershell
# Stop with Ctrl+C
python main.py
```

**8. Access via Tunnel URL**

Open in browser:
```
https://YOUR-FRONTEND-URL.trycloudflare.com
```

---

## Environment Configuration

### Backend `.env` Template

```env
# Hugging Face API Token
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# CORS - Include tunnel URL
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://YOUR-TUNNEL.trycloudflare.com

# Slack OAuth Configuration
SLACK_CLIENT_ID=1234567890.9876543210
SLACK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_REDIRECT_URI=https://YOUR-FRONTEND-TUNNEL.trycloudflare.com/slack/callback
SLACK_OAUTH_SCOPES=channels:read,channels:history,groups:read,groups:history,users:read,team:read
```

### Frontend `.env` Template

```env
# Backend API - Use tunnel URL in development
VITE_API_URL=https://YOUR-BACKEND-TUNNEL.trycloudflare.com

# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_SUPABASE_ACCESS_TOKEN=xapp-1-xxxxxxxxxxxxx-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Configuration Checklist

Before testing Slack OAuth:
- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173
- [ ] Backend tunnel active (check URL)
- [ ] Frontend tunnel active (check URL)
- [ ] `SLACK_REDIRECT_URI` matches frontend tunnel URL
- [ ] `VITE_API_URL` matches backend tunnel URL
- [ ] Slack app redirect URI updated with frontend tunnel URL
- [ ] `CORS_ORIGINS` includes frontend tunnel URL
- [ ] Backend restarted after `.env` changes

---

## Production Deployment

### Deployment Checklist

Production deployment eliminates the need for tunneling by using real domains.

#### 1. Domain Setup

**Frontend domain:** `https://app.yourdomain.com`  
**Backend domain:** `https://api.yourdomain.com`

#### 2. SSL/TLS Certificates

- Use Let's Encrypt or cloud provider SSL
- **Slack requires HTTPS** for OAuth redirects
- Ensure valid certificates

#### 3. Environment Variables

**Backend `.env` (Production):**
```env
SLACK_REDIRECT_URI=https://app.yourdomain.com/slack/callback
CORS_ORIGINS=https://app.yourdomain.com
```

**Frontend `.env` (Production):**
```env
VITE_API_URL=https://api.yourdomain.com
```

#### 4. Slack App Configuration

Update Slack app with production redirect URIs:
```
https://app.yourdomain.com/slack/callback
```

Remove development tunnel URLs.

#### 5. Deployment Platforms

##### Option A: Vercel (Frontend) + Render (Backend)

**Frontend (Vercel):**
```bash
cd frontend
npm install
npm run build
# Deploy to Vercel
```

**Backend (Render):**
```python
# Procfile or render.yaml
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

##### Option B: Docker Deployment

**Dockerfile (Backend):**
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Dockerfile (Frontend):**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json .
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html
EXPOSE 80
```

##### Option C: Cloud Platforms

**AWS:**
- Frontend: S3 + CloudFront
- Backend: Elastic Beanstalk or ECS

**Google Cloud:**
- Frontend: Firebase Hosting
- Backend: Cloud Run

**Azure:**
- Frontend: Static Web Apps
- Backend: App Service

#### 6. Security Hardening

**Backend:**
```python
# Strict CORS in production
CORS_ORIGINS=https://app.yourdomain.com  # Only your domain

# Rate limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# HTTPS redirect
if not request.url.scheme == "https":
    return RedirectResponse(url=request.url.replace(scheme="https"))
```

**Environment Security:**
- Use cloud secret managers (AWS Secrets Manager, etc.)
- Never commit `.env` files
- Rotate API keys regularly
- Use separate keys for dev/prod

#### 7. Database for Token Storage

**DO NOT use localStorage in production!**

**Recommended: PostgreSQL with encryption**

```python
# models.py
class UserSlackToken(Base):
    __tablename__ = "user_slack_tokens"
    
    user_id = Column(String, ForeignKey("users.id"))
    encrypted_token = Column(String)  # Use Fernet encryption
    team_id = Column(String)
    created_at = Column(DateTime)
    expires_at = Column(DateTime)
```

**Encryption:**
```python
from cryptography.fernet import Fernet

# Store key in environment variable
cipher = Fernet(os.getenv("ENCRYPTION_KEY"))

# Encrypt before storing
encrypted_token = cipher.encrypt(access_token.encode())

# Decrypt when needed
access_token = cipher.decrypt(encrypted_token).decode()
```

---

## Troubleshooting

### Common Issues

#### 1. "redirect_uri_mismatch"

**Problem:** Slack redirect URI doesn't match

**Solution:**
```bash
# Check current URLs
echo $SLACK_REDIRECT_URI  # Backend
echo $VITE_API_URL        # Frontend

# Verify they match Slack app settings
```

**Debugging:**
```python
# In main.py, log the redirect URI
logger.info(f"Configured redirect URI: {config.SLACK_REDIRECT_URI}")
```

#### 2. CORS Errors

**Problem:** Frontend can't call backend API

**Solution:**
```python
# Check CORS_ORIGINS includes frontend tunnel URL
CORS_ORIGINS=http://localhost:5173,https://frontend-tunnel.trycloudflare.com

# Verify middleware is configured
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 3. Tunnel Disconnects

**Problem:** Cloudflare tunnel stops working

**Solution:**
- Check terminal for errors
- Restart `cloudflared`
- Update `.env` with new URL
- Update Slack app settings
- Restart backend

#### 4. 502 Bad Gateway

**Problem:** Tunnel can't reach localhost

**Solution:**
```bash
# Verify backend is running
curl http://localhost:8000/health

# Check tunnel is pointing to correct port
cloudflared tunnel --url http://localhost:8000  # Not 5173!
```

#### 5. OAuth Flow Stuck

**Problem:** User redirected but nothing happens

**Debugging checklist:**
1. Open browser DevTools → Network tab
2. Check redirect after Slack approval
3. Verify callback URL is called
4. Check for CORS errors in console
5. Inspect backend logs for errors

**Common fix:**
```javascript
// In SlackCallback.jsx
console.log("Callback URL:", window.location.href);
console.log("Code parameter:", urlParams.get('code'));
```

---

## Development Best Practices

### 1. Use Scripts for Common Tasks

**start-dev.ps1:**
```powershell
# Start all services
Start-Process powershell -ArgumentList "cd backend; python main.py"
Start-Process powershell -ArgumentList "cd frontend; npm run dev"
Start-Process powershell -ArgumentList "cloudflared tunnel --url http://localhost:8000"
Start-Process powershell -ArgumentList "cloudflared tunnel --url http://localhost:5173"
```

### 2. Keep Tunnel URLs in Comments

```env
# Backend .env
# Current tunnel URLs (updated 2024-12-05):
# Frontend: https://ebook-retro-weeks-mouse.trycloudflare.com
# Backend: https://cohen-stan-narrative-symbols.trycloudflare.com

SLACK_REDIRECT_URI=https://ebook-retro-weeks-mouse.trycloudflare.com/slack/callback
```

### 3. Use Ngrok as Alternative

If Cloudflare tunnels are unstable:

```bash
# Install ngrok
choco install ngrok

# Start tunnels
ngrok http 5173  # Frontend
ngrok http 8000  # Backend
```

### 4. Test Locally First

Before using tunnels:
```bash
# Test backend health
curl http://localhost:8000/health

# Test OAuth URL generation
curl http://localhost:8000/auth/slack

# Verify frontend loads
curl http://localhost:5173
```

---

## Monitoring and Logging

### Backend Logs

```python
# main.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Log important events
logger.info(f"OAuth started for user")
logger.info(f"Token exchanged successfully")
logger.error(f"Slack API error: {error}")
```

### Frontend Logs

```javascript
// Log OAuth flow
console.log("Starting OAuth flow");
console.log("Redirecting to:", oauthUrl);
console.log("Callback received with code:", code);
```

### Tunnel Status

```bash
# Check if tunnel is running
curl https://your-tunnel.trycloudflare.com/health

# Should return: {"status": "ok"}
```

---

## Summary

### Development Setup
1. Start backend and frontend locally
2. Create two Cloudflare tunnels
3. Update `.env` files with tunnel URLs
4. Update Slack app redirect URI
5. Restart backend
6. Access via frontend tunnel URL

### Production Setup
1. Deploy frontend to static hosting
2. Deploy backend to server/container
3. Configure real domains with SSL
4. Update Slack app with production URLs
5. Implement secure token storage
6. Enable monitoring and logging

### Key Takeaways
- **Tunnels are temporary** - URLs change each restart
- **Two tunnels required** - One for frontend, one for backend
- **Update Slack app** - Redirect URI must match frontend tunnel
- **CORS matters** - Include tunnel URLs in CORS_ORIGINS
- **Production = Real domains** - No tunnels needed with proper deployment
