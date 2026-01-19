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

from rag.rag_engine import RAGEngine
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from contextlib import asynccontextmanager
import uuid
from openai import OpenAI
import io

# Global RAG engine instance
# rag_engine: Optional[RAGEngine] = None

# Session storage (to use database in production)
sessions: Dict[str, Dict[str, Any]] = {}

rag_engine = RAGEngine()
openai_client = OpenAI()

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

    # Track if this is a new session
    is_new_session = session_id not in sessions

    # Update session info
    if is_new_session:
        sessions[session_id] = {
            "created_at": datetime.now().isoformat(),
            "message_count": 0,
            "title": "New Conversation"  # Default title
        }

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
async def list_sessions():
    """List all active sessions"""
    return [
        SessionInfo(
            session_id=session_id,
            title=info.get("title", "New Conversation"),
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
        title=info.get("title", "New Conversation"),
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
async def regenerate_response(request: RegenerateRequest):
    """
    Regenerate the last AI response for a session
    
    This retrieves the last user message and generates a new response
    """
    if rag_engine is None:
        raise HTTPException(
            status_code=503,
            detail="RAG engine not initialized. Please try again later."
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
        
@app.post("/healthcheck")
async def healthcheck():
    return {"status": "ok"}


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
