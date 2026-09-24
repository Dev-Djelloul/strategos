"""Diagnostic : teste l'authentification OAuth ACLED en lisant .env
directement (évite les pièges de quoting shell avec des mots de passe
contenant des caractères spéciaux comme $ ou !).

Usage : .venv/bin/python scripts/test_acled_auth.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
import httpx

load_dotenv()

email = os.environ.get("ACLED_EMAIL")
password = os.environ.get("ACLED_PASSWORD")

if not email or not password:
    print("❌ ACLED_EMAIL / ACLED_PASSWORD absents de .env")
    sys.exit(1)

print(f"Email lu depuis .env : {email}")
print(f"Mot de passe lu depuis .env : {'*' * len(password)} ({len(password)} caractères)")

response = httpx.post(
    "https://acleddata.com/oauth/token",
    data={
        "username": email,
        "password": password,
        "grant_type": "password",
        "client_id": "acled",
    },
    timeout=15.0,
)

print(f"\nStatut HTTP : {response.status_code}")
print(f"Réponse : {response.text}")
