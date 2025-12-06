#!/bin/bash
# Script to stop the Gemini clustering API server

echo "Stopping Gemini Clustering API server..."

# Find and kill the process
pkill -f "main_gemini.py" || pkill -f "uvicorn.*main_gemini"

if [ $? -eq 0 ]; then
    echo "✓ Server stopped successfully"
else
    echo "⚠️  No running server found"
fi

