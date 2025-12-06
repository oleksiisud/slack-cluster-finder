# Running the Gemini Clustering API

## Quick Start

### Option 1: Using the run script (Easiest)
```bash
cd backend
./run_gemini.sh
```

### Option 2: Using Python directly
```bash
cd backend
source venv/bin/activate  # If using virtual environment
python main_gemini.py
```

### Option 3: Using uvicorn directly
```bash
cd backend
source venv/bin/activate  # If using virtual environment
uvicorn main_gemini:app --host 0.0.0.0 --port 8001 --reload
```

## Environment Variables

Make sure you have your Gemini API key set:
```bash
export GEMINI_API_KEY=your_api_key_here
```

Or create a `.env` file in the backend directory:
```
GEMINI_API_KEY=your_api_key_here
```

## Testing the Server

Once running, test these endpoints:

1. **Root endpoint**: http://localhost:8001/
2. **Health check**: http://localhost:8001/health
3. **API docs**: http://localhost:8001/docs

## Troubleshooting

### 404 Error on `/`
- This is normal if you're accessing it before the root endpoint was added
- Try accessing `/health` instead to verify the server is running

### Port already in use
- Change the port: `uvicorn main_gemini:app --host 0.0.0.0 --port 8002 --reload`
- Or kill the process using port 8001

### Import errors
- Make sure you're in the `backend` directory
- Activate your virtual environment: `source venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`

