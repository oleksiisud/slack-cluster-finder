# Quick Start Guide

## Running the Application

You need **both** the backend and frontend running simultaneously.

### Step 1: Start the Backend Server

Open a terminal and run:

```bash
cd backend
./run_gemini.sh
```

You should see:
```
[INFO] Loaded environment variables from .env file
[INFO] Gemini API configured (key length: XX)
✓ GEMINI_API_KEY is set (length: XX)
🚀 Starting Gemini Clustering API on port 8001...
```

**Keep this terminal open** - the backend must stay running.

### Step 2: Start the Frontend

Open a **new terminal** (or new tab) and run:

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173` (or similar).

### Step 3: Use the App

1. Open your browser to the frontend URL
2. Sign in/Sign up
3. Click "New Chat" (+ button)
4. Upload your JSON file
5. Wait for clustering to complete

## Troubleshooting

### "Cannot connect to clustering service"

**Problem**: Backend server is not running or not accessible.

**Solution**:
1. Check if backend is running: Look for the terminal with `🚀 Starting Gemini Clustering API`
2. If not running, start it: `cd backend && ./run_gemini.sh`
3. Verify it's working: Open http://localhost:8001/health in your browser
4. Should show: `{"status": "healthy", "service": "Gemini Clustering API"}`

### Supabase 404 Error for slack_tokens

**Problem**: The `slack_tokens` table doesn't exist (this is normal if you're not using Slack OAuth).

**Solution**: This is now handled gracefully - the error won't show up anymore. Slack connection is optional.

### Backend shows "GEMINI_API_KEY not set"

**Problem**: The API key isn't being loaded.

**Solution**:
1. Make sure you have a `.env` file in the `backend` directory
2. It should contain: `GEMINI_API_KEY=your_key_here`
3. Restart the backend server

## Ports

- **Frontend**: Usually `5173` (Vite default) or `3000`
- **Backend**: `8001` (Gemini clustering API)

Make sure these ports aren't being used by other applications.

