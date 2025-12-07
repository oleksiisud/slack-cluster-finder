import requests
import os

backend_url = os.getenv("BACKEND_URL")
try:
    requests.get(f"{backend_url}/health", timeout=10)
    print("Backend pinged")
except:
    print("Ping failed")