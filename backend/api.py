# api.py
import uvicorn
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

# --- IMPORTS FOR OTHER MODULES ---
# Make sure you have these files (lilypond.py, audio.py) in the same folder
from lilypond import convert_to_lilypond 

# --- CONFIGURATION ---
DATABASE_FILE = "music_transcriber.db"
# In production, use a fixed secure key!
SECRET_KEY = "DEV_SECRET_KEY_123" 

# --- SECURITY UTILS ---
def hash_password(password: str) -> str:
    """Securely hash password using PBKDF2 with a random salt."""
    salt = secrets.token_hex(16)
    # 100,000 iterations of SHA256
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
        # 1. Users Table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # 2. Tokens Table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
        """)
        # 3. Sessions Table
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

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Adjust to your React port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security_scheme = HTTPBearer()

# --- AUTH DEPENDENCY ---
async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security_scheme)):
    token = creds.credentials
    async with aiosqlite.connect(DATABASE_FILE) as db:
        cursor = await db.execute(
            "SELECT user_id, expires_at FROM auth_tokens WHERE token = ?", 
            (token,)
        )
        row = await cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        user_id, expires_at_str = row
        expires_at = datetime.fromisoformat(expires_at_str)
        
        if datetime.now() > expires_at:
            await db.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
            await db.commit()
            raise HTTPException(status_code=401, detail="Token expired")
            
        # Get user details
        cursor = await db.execute(
            "SELECT user_id, email, name FROM users WHERE user_id = ?", 
            (user_id,)
        )
        user = await cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
            
        return {"user_id": user[0], "email": user[1], "name": user[2]}

# --- ROUTES ---

@app.post("/api/auth/register")
async def register(data: UserRegister):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        try:
            # Check existing
            cursor = await db.execute("SELECT 1 FROM users WHERE email = ?", (data.email,))
            if await cursor.fetchone():
                raise HTTPException(status_code=400, detail="Email already registered")
            
            # Create user
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
        cursor = await db.execute(
            "SELECT user_id, password_hash, name, email FROM users WHERE email = ?", 
            (data.email,)
        )
        row = await cursor.fetchone()
        
        if not row or not verify_password(row[1], data.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        user_id, _, name, email = row
        
        # Generate Token
        token = secrets.token_urlsafe(32)
        expires = (datetime.now() + timedelta(days=7)).isoformat()
        
        await db.execute(
            "INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires)
        )
        await db.commit()
        
        return {
            "token": token,
            "user": {
                "user_id": user_id,
                "email": email,
                "name": name,
                "subscription_tier": "free"
            }
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

# --- SESSION ROUTES (Protected) ---

@app.post("/api/sessions")
async def save_session(data: SessionCreate, user = Depends(get_current_user)):
    async with aiosqlite.connect(DATABASE_FILE) as db:
        session_id = str(uuid.uuid4())
        # Convert Pydantic models to list of dicts for JSON storage
        notes_dict = [note.dict() for note in data.notes]
        
        await db.execute("""
            INSERT INTO sessions (session_id, user_id, title, bpm, notes_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id, 
            user['user_id'], 
            data.title, 
            data.bpm, 
            json.dumps(notes_dict), 
            data.createdAt,
            datetime.now().isoformat()
        ))
        await db.commit()
        return {"session_id": session_id, "status": "saved"}

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

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=5000, reload=True)