"""
FastAPI Backend for Nigerian Tax Reform Bills Q&A Assistant
Provides RESTful API endpoints for the frontend
"""

import sys
import os
from pathlib import Path

# Add backend directory to path to ensure rag module can be found
backend_dir = Path(__file__).parent.resolve()
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Load environment variables from backend/.env file
from dotenv import load_dotenv
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ Loaded environment variables from {env_path}")
else:
    print(f"⚠️ No .env file found at {env_path}")
    
from supabase import create_client, Client
from rag.rag_engine import RAGEngine
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import uuid
from openai import OpenAI
import io
import httpx
import hashlib
import secrets
import jwt

# Database imports
from database import (
    get_db, get_db_session, get_user_by_id, get_user_by_email,
    create_user, update_user_last_login, is_new_ip_for_user,
    register_user_ip, update_ip_last_seen, create_user_session, get_user_sessions,
    update_session_title, update_session_activity, get_session_owner,
    verify_session_ownership, delete_user_session
)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# Security
security = HTTPBearer(auto_error=False)

# Paystack configuration
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PUBLIC_KEY = os.getenv("PAYSTACK_PUBLIC_KEY", "")
PAYSTACK_BASE_URL = "https://api.paystack.co"

# Global RAG engine instance
# rag_engine: Optional[RAGEngine] = None

# Session storage with owner tracking
# Format: {session_id: {"owner_id": user_id or None, "created_at": ..., ...}}
sessions: Dict[str, Dict[str, Any]] = {}

# Track which sessions belong to which user (for fast lookup)
user_session_map: Dict[str, set] = {}  # {user_id: {session_id1, session_id2, ...}}

rag_engine = RAGEngine()
openai_client = OpenAI()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """

    print("Starting up Policy Assistant API...")
    print("Initializing RAG Engine...")

    # Explicitly initialize the RAG engine (loads vector DB, etc.)
    try:
        rag_engine.initialize(force_reload=False)
        print("RAG Engine initialized successfully!")
    except Exception as e:
        print(f"Error initializing RAG engine: {e}")
        print("API will start but RAG functionality may be unavailable.")

    yield

    # Shutdown
    print("Shutting down Policy Assistant API...")


# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Policy Assistant API",
    description="AI-powered assistant for Nigerian tax and revenue policy documents",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # specify exact origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Content-Disposition"],
)


# Pydantic models
class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str = Field(..., description="User message", min_length=1)
    session_id: Optional[str] = Field(
        None, description="Session ID for conversation continuity")
    user_role: Optional[str] = Field(
        "taxpayer", 
        description="User role: tax_lawyer, taxpayer, or company"
    )


class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    response: str = Field(..., description="AI assistant response")
    session_id: str = Field(...,
                            description="Session ID for this conversation")
    session_title: str = Field(...,
                               description="Generated title for this session")
    sources: List[Dict[str, Any]] = Field(
        default_factory=list, description="Source documents referenced")
    used_retrieval: bool = Field(...,
                                 description="Whether document retrieval was used")
    timestamp: str = Field(..., description="Response timestamp")


class SessionInfo(BaseModel):
    """Session information model"""
    session_id: str
    title: str
    created_at: str
    message_count: int
    last_activity: str


class ConversationHistory(BaseModel):
    """Conversation history model"""
    session_id: str
    messages: List[Dict[str, str]]
    created_at: str
    message_count: int
    last_activity: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    message: str
    rag_initialized: bool


class FeedbackRequest(BaseModel):
    """Request model for feedback endpoint"""
    session_id: str = Field(..., description="Session ID")
    message_index: int = Field(..., description="Index of the message being rated")
    feedback_type: str = Field(..., description="Type of feedback: 'liked' or 'disliked'")
    message_content: Optional[str] = Field(None, description="Content of the message for context")


class RegenerateRequest(BaseModel):
    """Request model for regenerate endpoint"""
    session_id: str = Field(..., description="Session ID")
    user_role: Optional[str] = Field("taxpayer", description="User role")


# =============================================
# AUTHENTICATION MODELS
# =============================================

class SignupRequest(BaseModel):
    """Request model for user signup"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    username: str = Field(..., min_length=2, max_length=30, description="Username")


class LoginRequest(BaseModel):
    """Request model for user login"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class AuthResponse(BaseModel):
    """Response model for authentication"""
    status: str
    message: str
    token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None


class UserProfile(BaseModel):
    """User profile model"""
    id: str
    email: str
    username: str
    created_at: str
    last_login: Optional[str] = None


# =============================================
# AUTHENTICATION HELPER FUNCTIONS
# =============================================

def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt"""
    salt = JWT_SECRET[:16]
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed


def create_jwt_token(user_id: str, email: str) -> str:
    """Create JWT token for authenticated user"""
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[Dict[str, Any]]:
    """Get current user from JWT token"""
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = decode_jwt_token(token)
    
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if user_id:
        db = get_db_session()
        try:
            user = get_user_by_id(db, user_id)
            if user:
                return user.to_dict()
        finally:
            db.close()
    
    return None


# Feedback storage (in production, use a database)
feedback_store: Dict[str, List[Dict[str, Any]]] = {}


# API Endpoints

@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint - health check"""
    return {
        "status": "online",
        "message": "Policy Assistant API is running",
        "rag_initialized": rag_engine is not None
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy" if rag_engine is not None else "degraded",
        "message": "All systems operational" if rag_engine else "RAG engine not initialized",
        "rag_initialized": rag_engine is not None
    }


# =============================================
# AUTHENTICATION ENDPOINTS
# =============================================

@app.post("/auth/signup", response_model=AuthResponse)
async def signup(request: SignupRequest, req: Request):
    """
    Register a new user
    
    Creates a new user account with email and password
    Also registers the IP and creates an initial session
    """
    db = get_db_session()
    try:
        # Get client IP address
        client_ip = req.client.host if req.client else "unknown"
        forwarded_for = req.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        user_agent = req.headers.get("user-agent", "")
        
        # Check if email already exists
        existing_user = get_user_by_email(db, request.email)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="An account with this email already exists"
            )
        
        # Create new user
        user_id = str(uuid.uuid4())
        hashed_password = hash_password(request.password)
        
        user = create_user(
            db=db,
            user_id=user_id,
            email=request.email,
            username=request.username,
            password=hashed_password,
            auth_provider="local"
        )
        
        # Register the IP address for this new user
        register_user_ip(db, user_id, client_ip, user_agent)
        
        # Create initial session for this user
        new_session_id = create_user_session(db, user_id, client_ip)
        
        # Create JWT token
        token = create_jwt_token(user_id, user.email)
        
        print(f"👤 New user registered: {request.email} from IP {client_ip}")
        
        return AuthResponse(
            status="success",
            message="Account created successfully",
            token=token,
            user={
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "created_at": user.created_at.isoformat(),
                "new_session_id": new_session_id,
                "is_new_ip": True
            }
        )
    finally:
        db.close()


@app.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest, req: Request):
    """
    Authenticate user and return JWT token
    Creates a new session if logging in from a new IP address
    """
    db = get_db_session()
    try:
        # Get client IP address
        client_ip = req.client.host if req.client else "unknown"
        # Check for forwarded IP (if behind proxy)
        forwarded_for = req.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        user_agent = req.headers.get("user-agent", "")
        
        # Find user by email
        user = get_user_by_email(db, request.email)
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Check if user has a password (not OAuth-only user)
        if not user.password:
            raise HTTPException(
                status_code=401,
                detail="Please use Google Sign-In for this account"
            )
        
        # Verify password
        if not verify_password(request.password, user.password):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Update last login
        user = update_user_last_login(db, user)
        
        # Check if this is a new IP address for this user
        new_session_id = None
        is_new_ip = is_new_ip_for_user(db, user.id, client_ip)
        
        if is_new_ip:
            # Register the new IP
            register_user_ip(db, user.id, client_ip, user_agent)
            # Create a new session for this IP
            new_session_id = create_user_session(db, user.id, client_ip)
            print(f"🌐 New IP detected for {request.email}: {client_ip} - Created session {new_session_id}")
        else:
            # Update last seen for existing IP
            update_ip_last_seen(db, user.id, client_ip)
            print(f"🔑 User logged in from known IP: {request.email} ({client_ip})")
        
        # Create JWT token
        token = create_jwt_token(user.id, user.email)
        
        return AuthResponse(
            status="success",
            message="Login successful",
            token=token,
            user={
                "id": user.id,
                "email": user.email,
                "username": user.username or user.email.split("@")[0],
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "new_session_id": new_session_id,
                "is_new_ip": is_new_ip
            }
        )
    finally:
        db.close()


@app.get("/auth/me")
async def get_current_user_profile(current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """
    Get current authenticated user's profile
    """
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )
    
    return {
        "status": "success",
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "username": current_user.get("username", current_user["email"].split("@")[0]),
            "created_at": current_user["created_at"],
            "last_login": current_user.get("last_login")
        }
    }


@app.post("/auth/logout")
async def logout():
    """
    Logout endpoint (client should discard the token)
    """
    return {
        "status": "success",
        "message": "Logged out successfully"
    }


class GoogleAuthRequest(BaseModel):
    """Request model for Google OAuth"""
    credential: str = Field(..., description="Google ID token from Sign-In")


@app.post("/auth/google")
async def google_auth(google_request: GoogleAuthRequest, request: Request):
    """
    Authenticate user with Google Sign-In
    
    Verifies the Google ID token and creates/logs in the user
    Creates a new session if logging in from a new IP address
    """
    db = get_db_session()
    
    # Get client IP address
    client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Verify Google ID token
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={google_request.credential}"
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid Google token"
                )
            
            google_data = response.json()
            
            # Verify the token is for our app (if GOOGLE_CLIENT_ID is set)
            if GOOGLE_CLIENT_ID and google_data.get("aud") != GOOGLE_CLIENT_ID:
                raise HTTPException(
                    status_code=401,
                    detail="Token was not issued for this application"
                )
            
            email = google_data.get("email")
            if not email:
                raise HTTPException(
                    status_code=400,
                    detail="Email not provided by Google"
                )
            
            # Check if user exists
            existing_user = get_user_by_email(db, email)
            
            if existing_user:
                # Login existing user
                existing_user = update_user_last_login(db, existing_user)
                token = create_jwt_token(existing_user.id, existing_user.email)
                
                # Check if this is a new IP for this user
                is_new_ip = is_new_ip_for_user(db, existing_user.id, client_ip)
                new_session_id = None
                
                if is_new_ip:
                    # Register the new IP
                    register_user_ip(db, existing_user.id, client_ip)
                    # Create a new session for this IP
                    new_session_id = create_user_session(db, existing_user.id, client_ip)
                    print(f"🔑 Google user logged in from NEW IP: {email} ({client_ip}) - New session: {new_session_id}")
                else:
                    # Update last seen for this IP
                    update_ip_last_seen(db, existing_user.id, client_ip)
                    print(f"🔑 Google user logged in: {email} ({client_ip})")
                
                return {
                    "status": "success",
                    "message": "Login successful",
                    "token": token,
                    "is_new_ip": is_new_ip,
                    "new_session_id": new_session_id,
                    "user": {
                        "id": existing_user.id,
                        "email": existing_user.email,
                        "username": existing_user.username or existing_user.email.split("@")[0],
                        "created_at": existing_user.created_at.isoformat() if existing_user.created_at else None,
                        "last_login": existing_user.last_login.isoformat() if existing_user.last_login else None
                    }
                }
            else:
                # Create new user
                user_id = str(uuid.uuid4())
                google_name = google_data.get("name", email.split("@")[0])
                
                new_user = create_user(
                    db=db,
                    user_id=user_id,
                    email=email,
                    username=google_name,
                    password=None,
                    auth_provider="google"
                )
                
                # Update last login for new user
                new_user = update_user_last_login(db, new_user)
                
                # Register IP and create initial session for new user
                register_user_ip(db, user_id, client_ip)
                new_session_id = create_user_session(db, user_id, client_ip)
                
                token = create_jwt_token(user_id, email.lower())
                print(f"👤 New Google user registered: {email} ({client_ip}) - Session: {new_session_id}")
                
                return {
                    "status": "success",
                    "message": "Account created successfully",
                    "token": token,
                    "is_new_ip": True,
                    "new_session_id": new_session_id,
                    "user": {
                        "id": new_user.id,
                        "email": new_user.email,
                        "username": new_user.username,
                        "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
                        "last_login": new_user.last_login.isoformat() if new_user.last_login else None
                    }
                }
                
    except httpx.RequestError as e:
        print(f"Google auth error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to verify Google token"
        )
    finally:
        db.close()


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """
    Main chat endpoint

    Processes user messages and returns AI responses with source citations
    Maintains conversation context across messages in the same session
    For authenticated users, sessions are linked to their account
    """
    if rag_engine is None:
        raise HTTPException(
            status_code=503,
            detail="RAG engine not initialized. Please try again later."
        )

    db = get_db_session()
    user_id = current_user["user_id"] if current_user else None
    
    # Get or create session ID
    session_id = request.session_id or str(uuid.uuid4())

    # SECURITY: Verify session ownership if a session_id was provided
    if request.session_id:
        # Check in-memory ownership first
        if request.session_id in sessions:
            session_owner_id = sessions[request.session_id].get("owner_id")
            if session_owner_id and session_owner_id != user_id:
                raise HTTPException(
                    status_code=403, 
                    detail="Access denied: This conversation belongs to another user"
                )
        
        # Also check database ownership
        db_session_owner = get_session_owner(db, request.session_id)
        if db_session_owner:
            if db_session_owner != user_id:
                raise HTTPException(
                    status_code=403, 
                    detail="Access denied: This conversation belongs to another user"
                )

    # Track if this is a new session
    is_new_session = session_id not in sessions

    # Update session info in memory WITH OWNER TRACKING
    if is_new_session:
        sessions[session_id] = {
            "owner_id": user_id,  # Track who owns this session
            "created_at": datetime.now().isoformat(),
            "message_count": 0,
            "title": "New Conversation"
        }
        
        # Track session for user lookup
        if user_id:
            if user_id not in user_session_map:
                user_session_map[user_id] = set()
            user_session_map[user_id].add(session_id)
        
        # If authenticated and this is a brand new session not from login, create it in DB
        if current_user and not request.session_id:
            try:
                create_user_session(db, user_id, None, session_id)
            except Exception as e:
                print(f"Warning: Could not save session to database: {e}")

    sessions[session_id]["message_count"] += 1
    sessions[session_id]["last_activity"] = datetime.now().isoformat()

    # Validate and set user role
    valid_roles = ["tax_lawyer", "taxpayer", "company"]
    user_role = request.user_role if request.user_role in valid_roles else "taxpayer"

    try:
        # Get response from RAG engine with user role
        result = rag_engine.chat(request.message, session_id=session_id, user_role=user_role)

        # Generate title for new sessions after first message
        if is_new_session:
            title = rag_engine.generate_session_title(session_id=session_id)
            sessions[session_id]["title"] = title
            
            # Update session title in database for authenticated users
            if current_user:
                try:
                    update_session_title(db, session_id, title)
                except Exception as e:
                    print(f"Warning: Could not update session title in database: {e}")

        session_title = sessions[session_id].get("title", "New Conversation")

        return ChatResponse(
            response=result["response"],
            session_id=session_id,
            session_title=session_title,
            sources=result.get("sources", []),
            used_retrieval=result.get("used_retrieval", False),
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat request: {str(e)}"
        )


@app.get("/sessions", response_model=List[SessionInfo])
async def list_sessions(current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """
    List sessions for authenticated users only.
    Guests do NOT get any session history - they must sign in to save conversations.
    """
    # SECURITY: Guests should NOT see any session history
    if not current_user:
        return []  # Empty list for guests - no session history without an account
    
    db = get_db_session()
    
    # Get ONLY this user's sessions from database
    try:
        user_sessions = get_user_sessions(db, current_user["user_id"])
        result = []
        for session in user_sessions:
            session_id = session.get("session_id")
            # Get message count from memory if available
            memory_info = sessions.get(session_id, {})
            result.append(SessionInfo(
                session_id=session_id,
                title=memory_info.get("title", session.get("title", "New Conversation")),
                created_at=session.get("created_at") or memory_info.get("created_at", datetime.utcnow().isoformat()),
                message_count=memory_info.get("message_count", 0),
                last_activity=session.get("last_activity") or memory_info.get("last_activity", session.get("created_at"))
            ))
        return result
    except Exception as e:
        print(f"Error fetching user sessions: {e}")
        return []  # Return empty on error for safety


@app.get("/sessions/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str, current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """Get information about a specific session (with ownership verification)"""
    db = get_db_session()
    user_id = current_user["user_id"] if current_user else None
    
    # SECURITY: Check in-memory ownership first
    if session_id in sessions:
        session_owner_id = sessions[session_id].get("owner_id")
        if session_owner_id and session_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied: This session does not belong to you")
    
    # Also check database ownership
    if current_user:
        if not verify_session_ownership(db, session_id, user_id):
            # Check if session exists in DB but belongs to someone else
            db_owner = get_session_owner(db, session_id)
            if db_owner and db_owner != user_id:
                raise HTTPException(status_code=403, detail="Access denied: This session does not belong to you")
    else:
        # Guest - deny access if session has any owner
        session_owner = get_session_owner(db, session_id)
        if session_owner:
            raise HTTPException(status_code=403, detail="Access denied: This session belongs to another user")
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    info = sessions[session_id]
    return SessionInfo(
        session_id=session_id,
        title=info.get("title", "New Conversation"),
        created_at=info["created_at"],
        message_count=info["message_count"],
        last_activity=info.get("last_activity", info["created_at"])
    )


@app.get("/sessions/{session_id}/history", response_model=ConversationHistory)
async def get_conversation_history(session_id: str, current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """Get conversation history for a session (with ownership verification)"""
    if rag_engine is None:
        raise HTTPException(
            status_code=503,
            detail="RAG engine not initialized"
        )
    
    db = get_db_session()
    user_id = current_user["user_id"] if current_user else None
    
    # SECURITY: Check in-memory ownership first
    if session_id in sessions:
        session_owner_id = sessions[session_id].get("owner_id")
        if session_owner_id and session_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied: This session does not belong to you")
    
    # Also check database ownership
    if current_user:
        db_owner = get_session_owner(db, session_id)
        if db_owner and db_owner != user_id:
            raise HTTPException(status_code=403, detail="Access denied: This session does not belong to you")
    else:
        # Guest - deny access if session has any owner
        session_owner = get_session_owner(db, session_id)
        if session_owner:
            raise HTTPException(status_code=403, detail="Access denied: This session belongs to another user")

    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        messages = rag_engine.get_conversation_history(session_id=session_id)
        info = sessions[session_id]

        return ConversationHistory(
            session_id=session_id,
            messages=messages,
            created_at=info["created_at"],
            message_count=info["message_count"],
            last_activity=info.get("last_activity", 
            info["created_at"])
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving conversation history: {str(e)}"
        )


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """Delete a session and its conversation history (with ownership verification)"""
    db = get_db_session()
    user_id = current_user["user_id"] if current_user else None
    
    # SECURITY: Check in-memory ownership first
    if session_id in sessions:
        session_owner_id = sessions[session_id].get("owner_id")
        if session_owner_id and session_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied: This session does not belong to you")
    
    # Check database ownership and delete if authenticated
    if current_user:
        db_owner = get_session_owner(db, session_id)
        if db_owner and db_owner != user_id:
            raise HTTPException(status_code=403, detail="Access denied: This session does not belong to you")
        # Delete from database
        delete_user_session(db, session_id, user_id)
    else:
        # For guests, only allow deletion of sessions not owned by anyone
        session_owner = get_session_owner(db, session_id)
        if session_owner:
            raise HTTPException(status_code=403, detail="Access denied: This session belongs to another user")
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # Remove from sessions storage
    del sessions[session_id]

    return {"message": f"Session {session_id} deleted successfully"}


@app.post("/sessions/{session_id}/clear")
async def clear_session_history(session_id: str, current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """Clear conversation history for a session while keeping the session active (with ownership verification)"""
    db = get_db_session()
    user_id = current_user["user_id"] if current_user else None
    
    # SECURITY: Check in-memory ownership first
    if session_id in sessions:
        session_owner_id = sessions[session_id].get("owner_id")
        if session_owner_id and session_owner_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied: This session does not belong to you")
    
    # Also check database ownership
    if current_user:
        db_owner = get_session_owner(db, session_id)
        if db_owner and db_owner != user_id:
            raise HTTPException(status_code=403, detail="Access denied: This session does not belong to you")
    else:
        # For guests, only allow clearing of sessions not owned by anyone
        session_owner = get_session_owner(db, session_id)
        if session_owner:
            raise HTTPException(status_code=403, detail="Access denied: This session belongs to another user")
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # Reset message count (session metadata) but note this does not clear LangGraph memory
    sessions[session_id]["message_count"] = 0
    sessions[session_id]["last_activity"] = datetime.now().isoformat()

    # Note: LangGraph's MemorySaver doesn't have a direct clear method
    # In production, you'd want to implement a custom checkpointer with clear functionality

    return {
        "message": f"Session {session_id} metadata reset; underlying conversation history may still exist",
        "session_id": session_id,
        "history_cleared": False,
        "note": "Only the session's message count and last_activity were reset; LangGraph MemorySaver history was not cleared."
    }


@app.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    """
    Submit feedback for an AI response
    
    This stores user feedback which can be used to:
    - Track response quality
    - Identify problematic responses
    - Improve the RAG system over time
    """
    # Validate feedback type
    if request.feedback_type not in ["liked", "disliked"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid feedback type. Must be 'liked' or 'disliked'"
        )
    
    # Create feedback entry
    feedback_entry = {
        "session_id": request.session_id,
        "message_index": request.message_index,
        "feedback_type": request.feedback_type,
        "message_content": request.message_content[:500] if request.message_content else None,
        "timestamp": datetime.now().isoformat()
    }
    
    # Store feedback
    if request.session_id not in feedback_store:
        feedback_store[request.session_id] = []
    
    # Check if feedback already exists for this message
    existing_idx = next(
        (i for i, f in enumerate(feedback_store[request.session_id]) 
         if f["message_index"] == request.message_index),
        None
    )
    
    if existing_idx is not None:
        # Update existing feedback
        feedback_store[request.session_id][existing_idx] = feedback_entry
    else:
        # Add new feedback
        feedback_store[request.session_id].append(feedback_entry)
    
    # Log feedback for monitoring
    print(f"📊 Feedback received: {request.feedback_type} for session {request.session_id[:8]}... message #{request.message_index}")
    
    return {
        "status": "success",
        "message": f"Feedback '{request.feedback_type}' recorded successfully",
        "session_id": request.session_id,
        "message_index": request.message_index
    }


@app.delete("/feedback/{session_id}/{message_index}")
async def remove_feedback(session_id: str, message_index: int):
    """Remove feedback for a specific message"""
    if session_id not in feedback_store:
        raise HTTPException(status_code=404, detail="No feedback found for this session")
    
    # Find and remove feedback
    feedback_list = feedback_store[session_id]
    original_len = len(feedback_list)
    feedback_store[session_id] = [f for f in feedback_list if f["message_index"] != message_index]
    
    if len(feedback_store[session_id]) == original_len:
        raise HTTPException(status_code=404, detail="Feedback not found for this message")
    
    return {
        "status": "success",
        "message": "Feedback removed successfully"
    }


@app.get("/feedback/{session_id}")
async def get_session_feedback(session_id: str):
    """Get all feedback for a session"""
    if session_id not in feedback_store:
        return {"session_id": session_id, "feedback": []}
    
    return {
        "session_id": session_id,
        "feedback": feedback_store[session_id]
    }


@app.get("/feedback/stats/summary")
async def get_feedback_stats():
    """Get overall feedback statistics"""
    total_liked = 0
    total_disliked = 0
    
    for session_feedback in feedback_store.values():
        for f in session_feedback:
            if f["feedback_type"] == "liked":
                total_liked += 1
            else:
                total_disliked += 1
    
    total = total_liked + total_disliked
    
    return {
        "total_feedback": total,
        "liked": total_liked,
        "disliked": total_disliked,
        "satisfaction_rate": round(total_liked / total * 100, 1) if total > 0 else None,
        "sessions_with_feedback": len(feedback_store)
    }


@app.post("/regenerate", response_model=ChatResponse)
async def regenerate_response(request: RegenerateRequest, current_user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """
    Regenerate the last AI response for a session (with ownership verification)
    
    This retrieves the last user message and generates a new response
    """
    if rag_engine is None:
        raise HTTPException(
            status_code=503,
            detail="RAG engine not initialized. Please try again later."
        )
    
    db = get_db_session()
    
    # SECURITY: Verify session ownership
    session_owner = get_session_owner(db, request.session_id)
    if session_owner:
        if current_user:
            if session_owner != current_user["user_id"]:
                raise HTTPException(
                    status_code=403, 
                    detail="Access denied: This conversation belongs to another user"
                )
        else:
            raise HTTPException(
                status_code=403, 
                detail="Access denied: This conversation belongs to another user"
            )
    
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Validate user role
    valid_roles = ["tax_lawyer", "taxpayer", "company"]
    user_role = request.user_role if request.user_role in valid_roles else "taxpayer"
    
    try:
        # Get conversation history
        messages = rag_engine.get_conversation_history(session_id=request.session_id)
        
        if not messages or len(messages) < 2:
            raise HTTPException(
                status_code=400,
                detail="Not enough conversation history to regenerate"
            )
        
        # Find the last human message
        last_human_msg = None
        for msg in reversed(messages):
            if msg.get("role") == "human":
                last_human_msg = msg.get("content")
                break
        
        if not last_human_msg:
            raise HTTPException(
                status_code=400,
                detail="No user message found to regenerate response for"
            )
        
        # Generate new response with the same message
        result = rag_engine.chat(last_human_msg, session_id=request.session_id, user_role=user_role)
        
        session_title = sessions[request.session_id].get("title", "New Conversation")
        sessions[request.session_id]["last_activity"] = datetime.now().isoformat()
        
        print(f"🔄 Response regenerated for session {request.session_id[:8]}...")
        
        return ChatResponse(
            response=result["response"],
            session_id=request.session_id,
            session_title=session_title,
            sources=result.get("sources", []),
            used_retrieval=result.get("used_retrieval", False),
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error regenerating response: {str(e)}"
        )


@app.post("/reload-documents")
async def reload_documents():
    """
    Reload policy documents and rebuild vector database
    Use this endpoint when documents are updated
    """
    if rag_engine is None:
        raise HTTPException(
            status_code=503,
            detail="RAG engine not initialized"
        )

    try:
        rag_engine.create_vector_database(force_reload=True)
        return {
            "message": "Documents reloaded and vector database rebuilt successfully",
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error reloading documents: {str(e)}"
        )


class TTSRequest(BaseModel):
    """Request model for text-to-speech"""
    text: str = Field(..., description="Text to convert to speech")
    voice: str = Field(default="alloy", description="Voice to use (alloy, echo, fable, onyx, nova, shimmer)")


# OpenAI TTS voices
OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]


@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech using OpenAI TTS API
    Returns audio stream with proper CORS headers
    """
    if not request.text or not request.text.strip():
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty"
        )
    
    try:
        # Validate voice
        voice = request.voice.lower() if request.voice.lower() in OPENAI_VOICES else "alloy"
        
        # Limit text length to prevent excessive API usage
        text_to_speak = request.text[:4096].strip()
        
        print(f"🎙️ Generating TTS with OpenAI voice '{voice}' for {len(text_to_speak)} chars")
        
        # Generate speech using OpenAI
        response = openai_client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text_to_speak
        )
        
        # Get audio data
        audio_data = response.content
        
        return StreamingResponse(
            iter([audio_data]),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        )
            
    except Exception as e:
        print(f"TTS Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating speech: {str(e)}"
        )
        
@app.get("/documents")
async def list_documents():
    """
    List all available PDF documents
    Returns document names and their URLs for linking
    """
    docs_dir = Path(__file__).parent / "rag" / "docs"
    
    if not docs_dir.exists():
        return {"documents": []}
    
    documents = []
    for pdf_file in docs_dir.glob("*.pdf"):
        # Create URL-safe filename
        safe_name = pdf_file.name.replace(" ", "%20")
        documents.append({
            "filename": pdf_file.name,
            "display_name": pdf_file.stem,
            "url": f"/documents/{safe_name}"
        })
    
    return {"documents": documents}


@app.get("/documents/{filename:path}")
async def serve_document(filename: str, page: int = None):
    """
    Serve a PDF document by filename
    
    Args:
        filename: The PDF filename to serve
        page: Optional page number for PDF viewers that support page fragments
    
    Returns:
        The PDF file with appropriate headers for inline viewing
    """
    # Decode URL-encoded filename
    from urllib.parse import unquote
    decoded_filename = unquote(filename)
    
    docs_dir = Path(__file__).parent / "rag" / "docs"
    file_path = docs_dir / decoded_filename
    
    # Security: ensure the file is within docs directory
    try:
        file_path = file_path.resolve()
        docs_dir = docs_dir.resolve()
        if not str(file_path).startswith(str(docs_dir)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Document not found: {decoded_filename}")
    
    if not file_path.suffix.lower() == ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Return PDF with inline disposition for browser viewing
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=decoded_filename,
        headers={
            "Content-Disposition": f"inline; filename=\"{decoded_filename}\"",
            "Access-Control-Allow-Origin": "*",
        }
    )


@app.post("/healthcheck")
async def healthcheck():
    return {"status": "ok"}


# =============================================
# PAYSTACK "BUY ME A COFFEE" ENDPOINTS
# =============================================

class DonationRequest(BaseModel):
    """Request model for initiating a donation"""
    email: str = Field(..., description="Donor's email address")
    amount: int = Field(..., description="Amount in Naira (will be converted to kobo)", ge=100)
    name: Optional[str] = Field(None, description="Donor's name (optional)")
    message: Optional[str] = Field(None, description="Optional message from donor")


class DonationResponse(BaseModel):
    """Response model for donation initialization"""
    status: bool
    message: str
    authorization_url: Optional[str] = None
    access_code: Optional[str] = None
    reference: Optional[str] = None


# Store donations (in production, use a database)
donations_store: Dict[str, Dict[str, Any]] = {}


@app.get("/donate/config")
async def get_donation_config():
    """
    Get Paystack public key and donation options for frontend
    """
    return {
        "public_key": PAYSTACK_PUBLIC_KEY,
        "currency": "NGN",
        "coffee_prices": [
            {"label": "☕ 1 Coffee", "amount": 1000, "description": "Buy me a coffee!"},
            {"label": "☕☕ 2 Coffees", "amount": 2000, "description": "Extra caffeine boost!"},
            {"label": "☕☕☕ 3 Coffees", "amount": 3000, "description": "You're amazing!"},
            {"label": "🎉 Custom", "amount": None, "description": "Choose your amount"},
        ],
        "recipient_name": "Nigerian Tax AI Assistant Team",
        "thank_you_message": "Thank you for supporting the Nigerian Tax AI Assistant! Your contribution helps us keep improving."
    }


@app.post("/donate/initialize", response_model=DonationResponse)
async def initialize_donation(request: DonationRequest):
    """
    Initialize a Paystack payment for donation
    
    This creates a payment session and returns an authorization URL
    that the user should be redirected to for payment.
    """
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Payment service not configured. Please set PAYSTACK_SECRET_KEY."
        )
    
    # Generate unique reference
    reference = f"coffee_{uuid.uuid4().hex[:12]}"
    
    # Convert Naira to Kobo (Paystack uses kobo)
    amount_in_kobo = request.amount * 100
    
    # Prepare metadata
    metadata = {
        "donor_name": request.name or "Anonymous",
        "message": request.message or "",
        "donation_type": "buy_me_a_coffee",
        "custom_fields": [
            {
                "display_name": "Donor Name",
                "variable_name": "donor_name",
                "value": request.name or "Anonymous"
            },
            {
                "display_name": "Message",
                "variable_name": "message",
                "value": request.message or "No message"
            }
        ]
    }
    
    # Initialize transaction with Paystack
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/transaction/initialize",
                headers={
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "email": request.email,
                    "amount": amount_in_kobo,
                    "reference": reference,
                    "currency": "NGN",
                    "metadata": metadata,
                    "callback_url": os.getenv("PAYSTACK_CALLBACK_URL", "http://localhost:5173/donate/callback")
                }
            )
            
            result = response.json()
            
            if result.get("status"):
                # Store donation info
                donations_store[reference] = {
                    "email": request.email,
                    "amount": request.amount,
                    "name": request.name,
                    "message": request.message,
                    "status": "pending",
                    "created_at": datetime.now().isoformat()
                }
                
                print(f"☕ Donation initialized: {reference} - ₦{request.amount} from {request.email}")
                
                return DonationResponse(
                    status=True,
                    message="Payment initialized successfully",
                    authorization_url=result["data"]["authorization_url"],
                    access_code=result["data"]["access_code"],
                    reference=reference
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=result.get("message", "Failed to initialize payment")
                )
                
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Payment service unavailable: {str(e)}"
        )


@app.api_route("/donate/verify/{reference}", methods=["GET", "POST"])
async def verify_donation(reference: str, request: Request):
    """
    Verify a donation payment status
    
    Call this after payment callback to confirm the transaction was successful.
    Accepts both GET and POST (POST can include donor name/message for inline payments)
    """
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Payment service not configured"
        )
    
    # Get optional body data (for inline payments)
    donor_name = "Anonymous"
    donor_message = ""
    try:
        if request.method == "POST":
            body = await request.json()
            donor_name = body.get("name", "Anonymous")
            donor_message = body.get("message", "")
    except:
        pass
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
                headers={
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"
                }
            )
            
            result = response.json()
            
            if result.get("status") and result.get("data"):
                data = result["data"]
                payment_status = data.get("status")
                
                # Update or create stored donation
                if reference in donations_store:
                    donations_store[reference]["status"] = payment_status
                    donations_store[reference]["verified_at"] = datetime.now().isoformat()
                    donations_store[reference]["payment_data"] = {
                        "gateway_response": data.get("gateway_response"),
                        "channel": data.get("channel"),
                        "paid_at": data.get("paid_at")
                    }
                else:
                    # For inline payments, create the donation record now
                    donations_store[reference] = {
                        "email": data.get("customer", {}).get("email"),
                        "amount": data.get("amount", 0) // 100,
                        "name": donor_name,
                        "message": donor_message,
                        "status": payment_status,
                        "created_at": datetime.now().isoformat(),
                        "verified_at": datetime.now().isoformat(),
                        "payment_data": {
                            "gateway_response": data.get("gateway_response"),
                            "channel": data.get("channel"),
                            "paid_at": data.get("paid_at")
                        }
                    }
                
                if payment_status == "success":
                    print(f"☕ Donation successful: {reference} - ₦{data.get('amount', 0) // 100}")
                    return {
                        "status": "success",
                        "message": "Thank you for your donation! ☕",
                        "amount": data.get("amount", 0) // 100,  # Convert back to Naira
                        "reference": reference,
                        "paid_at": data.get("paid_at"),
                        "donor_email": data.get("customer", {}).get("email")
                    }
                else:
                    return {
                        "status": payment_status,
                        "message": f"Payment {payment_status}",
                        "reference": reference
                    }
            else:
                raise HTTPException(
                    status_code=404,
                    detail="Transaction not found"
                )
                
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Payment verification failed: {str(e)}"
        )


@app.post("/donate/webhook")
async def paystack_webhook(request: Request):
    """
    Paystack webhook endpoint for payment notifications
    
    Configure this URL in your Paystack dashboard to receive
    real-time payment notifications.
    """
    # Verify webhook signature (in production, verify the signature)
    # signature = request.headers.get("x-paystack-signature")
    
    try:
        payload = await request.json()
        event = payload.get("event")
        data = payload.get("data", {})
        
        if event == "charge.success":
            reference = data.get("reference")
            amount = data.get("amount", 0) // 100  # Convert kobo to Naira
            email = data.get("customer", {}).get("email")
            
            # Update donation status
            if reference in donations_store:
                donations_store[reference]["status"] = "success"
                donations_store[reference]["webhook_received"] = datetime.now().isoformat()
            
            print(f"☕ Webhook: Donation received - {reference} - ₦{amount} from {email}")
            
        return {"status": "ok"}
        
    except Exception as e:
        print(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/donate/stats")
async def get_donation_stats():
    """
    Get donation statistics (public endpoint for transparency)
    """
    successful_donations = [d for d in donations_store.values() if d.get("status") == "success"]
    
    total_amount = sum(d.get("amount", 0) for d in successful_donations)
    total_count = len(successful_donations)
    
    # Get recent donors (anonymized)
    recent_donors = []
    for d in sorted(successful_donations, key=lambda x: x.get("created_at", ""), reverse=True)[:5]:
        recent_donors.append({
            "name": d.get("name", "Anonymous") or "Anonymous",
            "amount": d.get("amount", 0),
            "message": d.get("message", "")[:100] if d.get("message") else None,
            "date": d.get("created_at", "")[:10]
        })
    
    return {
        "total_coffees": total_count,
        "total_amount": total_amount,
        "currency": "NGN",
        "recent_supporters": recent_donors,
        "goal": 50000,  # Example goal
        "goal_progress": min(100, (total_amount / 50000) * 100) if total_amount > 0 else 0
    }


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "path": str(request.url)
        }
    )


if __name__ == "__main__":
    import uvicorn

    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
