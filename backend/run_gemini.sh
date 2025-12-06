#!/bin/bash
# Script to run the Gemini clustering API server

cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Load .env file if it exists
if [ -f ".env" ]; then
    echo "📝 Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Override PORT to 8001 for Gemini API (frontend expects this)
export PORT=8001

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  ERROR: GEMINI_API_KEY environment variable is not set!"
    echo ""
    echo "   Please set it using one of these methods:"
    echo ""
    echo "   Method 1: Create a .env file in the backend directory:"
    echo "   echo 'GEMINI_API_KEY=your_api_key_here' > .env"
    echo ""
    echo "   Method 2: Export it in your terminal:"
    echo "   export GEMINI_API_KEY=your_api_key_here"
    echo ""
    echo "   Get your API key from: https://makersuite.google.com/app/apikey"
    echo ""
    exit 1
fi

echo "✓ GEMINI_API_KEY is set (length: ${#GEMINI_API_KEY})"

# Run the server
echo "🚀 Starting Gemini Clustering API on port 8001..."
echo "   Health check: http://localhost:8001/health"
echo "   API docs: http://localhost:8001/docs"
echo "   Press Ctrl+C to stop"
echo ""

# Check if running in background mode
if [ "$1" == "--background" ] || [ "$1" == "-b" ]; then
    echo "Running in background mode..."
    nohup python main_gemini.py > gemini_server.log 2>&1 &
    echo "Backend started in background (PID: $!)"
    echo "Logs: tail -f backend/gemini_server.log"
    echo "Stop: kill $!"
else
    python main_gemini.py
fi

