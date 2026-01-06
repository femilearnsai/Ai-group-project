"""
FastAPI Backend for Nigerian Tax Reform Bills Q&A Assistant
Provides RESTful API endpoints for the frontend
"""

from rag.rag_engine import RAGEngine
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager
import uuid
import sys
from pathlib import Path

# Add parent directory to path to import rag_engine
# sys.path.append(str(Path(__file__).parent.parent))

# Global RAG engine instance
# rag_engine: Optional[RAGEngine] = None

# Session storage (to use database in production)
sessions: Dict[str, Dict[str, Any]] = {}

rag_engine = RAGEngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """

    print("Starting up Policy Assistant API...")
    print("Initializing RAG Engine...")

    try:
        rag_engine.initialize(force_reload=False)
        print("RAG Engine initialized successfully!")
    except Exception as e:
        print(f"Error initializing RAG engine: {e}")
        print("API will start but RAG functionality will be unavailable")

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
)


# Pydantic models
class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str = Field(..., description="User message", min_length=5)
    session_id: Optional[str] = Field(
        None, description="Session ID for conversation continuity")


class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    response: str = Field(..., description="AI assistant response")
    session_id: str = Field(...,
                            description="Session ID for this conversation")
    sources: List[Dict[str, Any]] = Field(
        default_factory=list, description="Source documents referenced")
    used_retrieval: bool = Field(...,
                                 description="Whether document retrieval was used")
    timestamp: str = Field(..., description="Response timestamp")


class SessionInfo(BaseModel):
    """Session information model"""
    session_id: str
    created_at: str
    message_count: int
    last_activity: str


class ConversationHistory(BaseModel):
    """Conversation history model"""
    session_id: str
    messages: List[Dict[str, str]]


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    message: str
    rag_initialized: bool


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


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint

    Processes user messages and returns AI responses with source citations
    Maintains conversation context across messages in the same session
    """
    if rag_engine is None:
        raise HTTPException(
            status_code=503,
            detail="RAG engine not initialized. Please try again later."
        )

    # Get or create session ID
    session_id = request.session_id or str(uuid.uuid4())

    # Update session info
    if session_id not in sessions:
        sessions[session_id] = {
            "created_at": datetime.now().isoformat(),
            "message_count": 0
        }

    sessions[session_id]["message_count"] += 1
    sessions[session_id]["last_activity"] = datetime.now().isoformat()

    try:
        # Get response from RAG engine
        result = rag_engine.chat(request.message, session_id=session_id)

        return ChatResponse(
            response=result["response"],
            session_id=session_id,
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
async def list_sessions():
    """List all active sessions"""
    return [
        SessionInfo(
            session_id=session_id,
            created_at=info["created_at"],
            message_count=info["message_count"],
            last_activity=info.get("last_activity", info["created_at"])
        )
        for session_id, info in sessions.items()
    ]


@app.get("/sessions/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    """Get information about a specific session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    info = sessions[session_id]
    return SessionInfo(
        session_id=session_id,
        created_at=info["created_at"],
        message_count=info["message_count"],
        last_activity=info.get("last_activity", info["created_at"])
    )


@app.get("/sessions/{session_id}/history", response_model=ConversationHistory)
async def get_conversation_history(session_id: str):
    """Get conversation history for a session"""
    if rag_engine is None:
        raise HTTPException(
            status_code=503,
            detail="RAG engine not initialized"
        )

    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        messages = rag_engine.get_conversation_history(session_id=session_id)

        return ConversationHistory(
            session_id=session_id,
            messages=messages
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving conversation history: {str(e)}"
        )


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its conversation history"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # Remove from sessions storage
    del sessions[session_id]

    return {"message": f"Session {session_id} deleted successfully"}


@app.post("/sessions/{session_id}/clear")
async def clear_session_history(session_id: str):
    """Clear conversation history for a session while keeping the session active"""
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
