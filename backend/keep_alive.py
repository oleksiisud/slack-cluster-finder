import requests
import os
import sys

backend_url = os.getenv("BACKEND_URL")

if not backend_url:
    print("ERROR: BACKEND_URL environment variable is not set")
    sys.exit(1)

try:
    response = requests.get(f"{backend_url}/health", timeout=10)
    print(f"Backend pinged successfully: {response.status_code}")
except requests.exceptions.RequestException as e:
    print(f"Ping failed: {type(e).__name__}: {e}")