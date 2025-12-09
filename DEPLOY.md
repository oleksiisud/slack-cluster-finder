# Quick Render Deployment Steps

## 1. Push Your Code
```powershell
git add -A
git commit -m "Add Render deployment config and Slack OAuth to main.py"
git push
```

## 2. Create Render Web Service

Go to [render.com](https://render.com) → Sign in with GitHub

Click **"New +"** → **"Web Service"**

### Configuration:
- **Repository**: `oleksiisud/slack-cluster-finder`
- **Name**: `slack-cluster-finder-backend`
- **Root Directory**: Leave blank
- **Runtime**: `Python 3`
- **Build Command**: 
  ```
  pip install -r backend/requirements.txt
  ```
- **Start Command**: 
  ```
  cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

### Environment Variables (click "Add Environment Variable"):
```
PYTHON_VERSION = 3.11
HF_TOKEN = your_huggingface_token
GOOGLE_API_KEY = your_google_gemini_api_key
SUPABASE_URL = https://itdcawchhbcislmbdcmp.supabase.co
SUPABASE_KEY = your_supabase_service_role_key
SLACK_CLIENT_ID = 9159662112897.9915063117203
SLACK_CLIENT_SECRET = your_slack_client_secret
CORS_ORIGINS = https://cluster-gilt.vercel.app
```

### Instance Type:
- **Free** (for testing) - spins down after 15 min inactivity
- **Starter $7/month** (recommended) - always on, 512MB RAM

Click **"Create Web Service"**

## 3. Wait for Deployment (~3-5 minutes)
- Installing dependencies
- Downloading ML models (~100MB)
- Starting server

You'll get a URL like: `https://slack-cluster-finder-backend.onrender.com`

## 4. Update Frontend (Vercel)

Add environment variable in Vercel:
```
VITE_API_BASE_URL = https://slack-cluster-finder-backend.onrender.com
```

Redeploy frontend (or push a commit to trigger auto-deploy)

## 5. Test

Visit: `https://slack-cluster-finder-backend.onrender.com/`

Should return:
```json
{
  "service": "Chat Message Clustering API",
  "version": "1.0.0",
  "status": "running"
}
```

## Done! 🎉

Your backend is now live on Render and your frontend on Vercel.

### Costs:
- **Render Free**: $0 (with spin-down)
- **Render Starter**: $7/month (always on)
- **Vercel**: Free
- **Supabase**: Free tier
- **Total**: $0-7/month

### Next Steps:
- Monitor logs in Render dashboard
- Set up custom domain (optional)
- Configure health checks
- Add error monitoring (Sentry, etc.)
