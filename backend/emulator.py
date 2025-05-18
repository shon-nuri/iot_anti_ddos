import os, random, requests

BASE   = os.environ["BASE_URL"]
EMAIL  = os.environ["EMAIL"]
PWD    = os.environ["PASSWORD"]

def _get_access():
    r = requests.post(f"{BASE}/auth/token/", json={"email": EMAIL, "password": PWD})
    r.raise_for_status()
    return r.json()["access"]

def handler(request):   
    # Vercel Python‑function entrypoint
    temp = round(random.uniform(24.0, 33.0), 2)
    token = _get_access()
    headers = {"Authorization": f"Bearer {token}"}
    requests.post(f"{BASE}/temperature/", json={"value": temp}, headers=headers).raise_for_status()
    return { "statusCode": 200, "body": f"sent {temp}°C" }
