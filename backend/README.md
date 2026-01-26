# Backend — Zacceus Policy Assistant

This folder contains the FastAPI backend and the RAG engine used by the Zacceus assistant.

**Key responsibilities**:
- Receive chat requests from the frontend and maintain session metadata
- Run the RAG workflow (document retrieval + LLM response generation)
- Persist vector database (Chroma) for document embeddings

**Important files**:
- `main.py` — FastAPI application and REST endpoints
- `rag/rag_engine.py` — RAGEngine: loads documents, creates the Chroma vector store, builds LangGraph agent, and handles conversation state
- `requirements.txt` — Python dependencies

## Environment

Create a `.env` file in `backend/` with keys required by your LLM provider (example):

```
OPENAI_API_KEY=your_api_key_here
# Add any other provider keys as required by your setup
```

## Run locally

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /` — basic health
- `GET /health` — detailed health and RAG initialization status
- `POST /chat` — send `message` and optional `session_id`; backend returns `response`, `session_id`, `session_title`, `sources`, `used_retrieval`, `timestamp`
- `GET /sessions` — list sessions and metadata
- `GET /sessions/{session_id}/history` — fetch conversation history
- `DELETE /sessions/{session_id}` — delete session
- `POST /sessions/{session_id}/clear` — clear session metadata
- `POST /reload-documents` — rebuild vector database from `rag/docs`

## Notes & Recommendations

- The backend uses an in-memory `sessions` dictionary for metadata. For production, persist sessions to a durable store.
- The `RAGEngine` persists Chroma DB under `backend/rag/chroma_db`; to refresh documents call `/reload-documents` or restart with `force_reload=True`.
- Ensure your `.env` contains valid API keys and that the vector DB can be written (permissions).
