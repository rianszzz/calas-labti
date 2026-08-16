from fastapi import APIRouter, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

router = APIRouter()
security = HTTPBearer()

class LoginRequest(BaseModel):
    username: str
    password: str

import os
from supabase import create_client

# Initialize Supabase client for auth validation
supa_url = os.environ.get("SUPABASE_URL", "")
supa_key = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(supa_url, supa_key) if supa_url and supa_key else None

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
        
    try:
        token = credentials.credentials
        user_res = supabase.auth.get_user(token)
        if not user_res or not user_res.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_res.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
