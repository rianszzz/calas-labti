"""Minimal API tests for DocuChat backend.
Run: python -m pytest test_api.py -v
Requires: pip install pytest httpx
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
TOKEN = "demo-token-123"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_login_fail():
    r = client.post("/api/login", json={"username": "wrong", "password": "wrong"})
    assert r.status_code == 401

def test_login_success():
    r = client.post("/api/login", json={"username": "user", "password": "123"})
    assert r.status_code == 200
    assert "token" in r.json()

def test_upload_non_pdf():
    from io import BytesIO
    r = client.post("/api/upload", files={"file": ("test.txt", BytesIO(b"hello"), "text/plain")}, headers=HEADERS)
    assert r.status_code == 400

def test_folder_empty_name():
    r = client.post("/api/folders", json={"name": "  "}, headers=HEADERS)
    assert r.status_code == 400

def test_folder_too_long():
    r = client.post("/api/folders", json={"name": "x" * 81}, headers=HEADERS)
    assert r.status_code == 400

def test_move_doc_invalid_folder():
    # Moving to a non-existent folder should fail
    r = client.patch("/api/documents/00000000-0000-0000-0000-000000000000/folder",
                     json={"folder_id": "00000000-0000-0000-0000-000000000001"}, headers=HEADERS)
    # Should be 403 (doc not found) or 400 (folder not found)
    assert r.status_code in [400, 403]

def test_retry_non_failed():
    # Retry on non-existent doc should fail
    r = client.post("/api/documents/00000000-0000-0000-0000-000000000000/retry", headers=HEADERS)
    assert r.status_code in [403, 404]

def test_chat_doc_not_ready():
    r = client.post("/api/chat", json={"query": "test", "document_id": "00000000-0000-0000-0000-000000000000"}, headers=HEADERS)
    assert r.status_code in [400, 403]
