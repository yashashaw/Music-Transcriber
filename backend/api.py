# api.py
import uvicorn
import os
from fastapi import FastAPI, Response, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from contextlib import asynccontextmanager
import aiosqlite
import hashlib
import secrets
import uuid
import json
from datetime import datetime, timedelta
from lilypond import convert_to_lilypond

# --- CONFIGURATION ---
DATABASE_FILE = "music_transcriber.db"
SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY_123") # ### CHANGED: Use Env var for security

# --- SECURITY UTILS ---
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}:{key.hex()}"

def verify_password(stored_hash: str, password: str) -> bool:
    try:
        salt, key_hex = stored_hash.split(':')
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return key.hex() == key_hex
    except ValueError:
        return False

# --- PYDANTIC MODELS ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str = "Musician"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class NoteData(BaseModel):
    id: str
    keys: list[str]
    duration: str
    rawDuration: float
    startTimeOffset: float
    isRest: bool
    color: str = None

class SessionCreate(BaseModel):
    title: str
    bpm: int
    notes: list[NoteData]
    createdAt: str

# --- DB LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT,
                bpm INTEGER,
                notes_json TEXT,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
        """)
        await db.commit()
    yield

app = FastAPI(lifespan=lifespan)

# AWS change
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

origins = [
    "http://localhost:5173", # Local for testing
    frontend_url,            # Frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # WARNING: Set to ["*"] to allow ALL during initial AWS setup. Change back to 'origins' later for security.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security_scheme = HTTPBearer()

# --- AUTH DEPENDENCY ---
async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security_scheme)):
    token = creds.credentials
    async with aiosqlite.connect(DATABASE_FILE) as db:
        cursor = await db.execute("SELECT user_id, expires_at FROM auth_tokens WHERE token = ?", (token,))
        row = await cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user_id, expires_at_str = row
        if datetime.now() > datetime.fromisoformat(expires_at_str):
            await db.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
            await db.commit()
            raise HTTPException(status_code=401, detail="Token expired")
            
        cursor = await db.execute("SELECT user_id, email, name FROM users WHERE user_id = ?", (user_id,))
        user = await cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
            
        return {"user_id": user[0], "email": user[1], "name": user[2]}

# --- AUTH ROUTES ---
@app.post("/api/auth/register")
async def register(data: UserRegister):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        try:
            cursor = await db.execute("SELECT 1 FROM users WHERE email = ?", (data.email,))
            if await cursor.fetchone():
                raise HTTPException(status_code=400, detail="Email already registered")
            
            user_id = str(uuid.uuid4())
            hashed = hash_password(data.password)
            
            await db.execute(
                "INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)",
                (user_id, data.email, hashed, data.name)
            )
            await db.commit()
            return {"message": "Registration successful"}
        except HTTPException as he:
            raise he
        except Exception as e:
            print(f"Register Error: {e}")
            raise HTTPException(status_code=500, detail="Server error")

@app.post("/api/auth/login")
async def login(data: UserLogin):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        cursor = await db.execute("SELECT user_id, password_hash, name, email FROM users WHERE email = ?", (data.email,))
        row = await cursor.fetchone()
        
        if not row or not verify_password(row[1], data.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        user_id, _, name, email = row
        token = secrets.token_urlsafe(32)
        expires = (datetime.now() + timedelta(days=7)).isoformat()
        
        await db.execute("INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires))
        await db.commit()
        
        return {
            "token": token,
            "user": {"user_id": user_id, "email": email, "name": name, "subscription_tier": "free"}
        }

@app.post("/api/auth/logout")
async def logout(creds: HTTPAuthorizationCredentials = Depends(security_scheme)):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        await db.execute("DELETE FROM auth_tokens WHERE token = ?", (creds.credentials,))
        await db.commit()
    return {"message": "Logged out"}

@app.get("/api/auth/me")
async def get_me(user = Depends(get_current_user)):
    return user

# --- SESSION ROUTES ---
@app.post("/api/sessions")
async def save_session(data: SessionCreate, user = Depends(get_current_user)):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        session_id = str(uuid.uuid4())
        notes_dict = [note.dict() for note in data.notes]
        
        await db.execute("""
            INSERT INTO sessions (session_id, user_id, title, bpm, notes_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (session_id, user['user_id'], data.title, data.bpm, json.dumps(notes_dict), data.createdAt, datetime.now().isoformat()))
        await db.commit()
        return {"session_id": session_id, "status": "saved"}

@app.get("/api/notes")
async def get_latest_notes(user = Depends(get_current_user)):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT notes_json FROM sessions 
            WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT 1
        """, (user['user_id'],))
        row = await cursor.fetchone()
        
        if not row: return []
        try:
            return json.loads(row['notes_json'])
        except:
            return []

@app.get("/api/sessions")
async def list_sessions(user = Depends(get_current_user)):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT session_id, title, bpm, created_at, updated_at 
            FROM sessions 
            WHERE user_id = ? 
            ORDER BY updated_at DESC
        """, (user['user_id'],))
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

# --- EXPORT PDF ROUTE (ADDED BACK IN) ---
@app.get("/api/export")
async def export_pdf(user = Depends(get_current_user)):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT notes_json FROM sessions 
            WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT 1
        """, (user['user_id'],))
        row = await cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="No session found to export.")
        try:
            notes_data = json.loads(row['notes_json'])
        except:
            raise HTTPException(status_code=500, detail="Database error: Corrupt note data.")

    pdf_bytes, error_msg = await convert_to_lilypond(notes_data)

    if error_msg:
        print(f"LilyPond Export Failed: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

    return Response(content=pdf_bytes, media_type="application/pdf")

if __name__ == "__main__":
    # ### CHANGED: Configured for AWS (usually port 8000 or 5000, 0.0.0.0 is required)
    # Disable 'reload' in production to save resources
    uvicorn.run("api:app", host="0.0.0.0", port=5000, reload=False)