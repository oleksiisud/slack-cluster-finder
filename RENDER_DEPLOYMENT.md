# Render Deployment Guide

## Backend Deployment on Render

### Prerequisites
- GitHub account with your repository pushed
- Render account (free tier available)

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up using your GitHub account

### Step 2: Create a New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `oleksiisud/slack-cluster-finder`
3. Configure the service:

**Basic Settings:**
- **Name**: `slack-cluster-finder-backend`
- **Region**: Choose closest to your users (e.g., Oregon, Frankfurt)
- **Branch**: `backend-stuff` (or `main`)
- **Root Directory**: Leave empty (we'll specify in commands)
- **Runtime**: `Python 3`

**Build & Deploy:**
- **Build Command**: 
  ```bash
  pip install -r backend/requirements.txt
  ```
- **Start Command**: 
  ```bash
  cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

**Instance Type:**
- Free tier: Good for testing (spins down after inactivity)
- Starter ($7/month): Better for production (stays active)

### Step 3: Set Environment Variables
In the Environment section, add these variables:

**Required:**
```
PYTHON_VERSION=3.11
CORS_ORIGINS=https://cluster-gilt.vercel.app,https://cluster-gilt.vercel.app
HF_TOKEN=your_huggingface_token
GOOGLE_API_KEY=your_google_api_key
SUPABASE_URL=https://itdcawchhbcislmbdcmp.supabase.co
SUPABASE_KEY=your_supabase_service_key
SLACK_CLIENT_ID=9159662112897.9915063117203
SLACK_CLIENT_SECRET=your_slack_client_secret
```

**Optional (defaults work fine):**
```
MIN_CLUSTER_SIZE=3
MAX_CLUSTERS=15
DISTANCE_THRESHOLD=1.5
EMBEDDING_MODEL=all-MiniLM-L6-v2
PORT=10000
```

### Step 4: Deploy
1. Click **"Create Web Service"**
2. Render will:
   - Clone your repo
   - Install dependencies (~2-3 minutes, sentence-transformers is large)
   - Download ML models (~100MB, first time only)
   - Start the service

3. Once deployed, you'll get a URL like:
   ```
   https://slack-cluster-finder-backend.onrender.com
   ```

### Step 5: Update Frontend Environment Variables
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Update `VITE_API_BASE_URL`:
   ```
   VITE_API_BASE_URL=https://slack-cluster-finder-backend.onrender.com
   ```
3. Redeploy frontend

### Step 6: Test
Visit your backend URL:
```
https://slack-cluster-finder-backend.onrender.com/
```

You should see:
```json
{
  "service": "Chat Message Clustering API",
  "version": "1.0.0",
  "status": "healthy"
}
```

## Important Notes

### Free Tier Limitations
- Spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- Good for development/testing

### Paid Tier Benefits ($7/month Starter)
- Always active (no spin-down)
- Faster response times
- More memory (512MB → 2GB)

### Model Caching
- ML models (~100MB) are downloaded on first start
- Cached on disk between deploys
- Cold starts only download if cache is cleared

### Monitoring
- Check logs: Render Dashboard → Logs tab
- Set up alerts for errors
- Monitor memory usage (ML models use ~500MB)

## Troubleshooting

**Build fails:**
- Check `requirements.txt` is in `backend/` folder
- Verify Python version (3.10 or 3.11 recommended)

**Service won't start:**
- Check environment variables are set
- Review logs for missing dependencies
- Ensure `PORT` env var is used (Render assigns this)

**CORS errors:**
- Verify `CORS_ORIGINS` includes your Vercel domain
- Must be exact match (https, no trailing slash)

**Memory issues:**
- Upgrade to Starter plan (512MB → 2GB)
- sentence-transformers needs ~500MB

## Alternative: Use render.yaml

You can also use the included `render.yaml` file for automated setup:

1. Push `render.yaml` to your repo
2. In Render: New → Blueprint
3. Connect repo and select `render.yaml`
4. Set environment variables
5. Deploy

This automatically configures everything!
