# TaxNG 2025 — Agentic RAG-powered Policy Assistant

## 🎯 Mission

As a group, build an Agentic RAG-powered AI Assistant that helps Nigerians understand complex policy documents (Nigeria Tax Act 2025, NTAA, JRBA, etc.). The system demonstrates LangChain & LangGraph usage, vector search (Chroma), document chunking, conditional retrieval, and a full-stack React + FastAPI UI.

## Overview

- Backend: FastAPI + RAG engine (LangChain / LangGraph) exposing REST endpoints for chats and session management.
- Frontend: React (Vite) single-page app providing an assistant UI and statutory calculator.
- Vector DB: Chroma persisted under `backend/rag/chroma_db`.

## Architecture

- User interacts with the React UI (frontend). The UI sends chat messages to the FastAPI backend (`/chat`).
- Backend orchestrates the RAG workflow via `RAGEngine` (document retrieval, agent decisioning, response generation). Conversation memory is kept via LangGraph checkpointer and the backend `sessions` map.

## Quick Start

1. Backend

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
# Create a .env with keys used by your LLM provider (e.g. OPENAI_API_KEY)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the app in your browser at the Vite dev server URL (usually http://localhost:5173). The frontend expects the backend at `http://localhost:8000` by default — change base URLs in `frontend/index.jsx` if needed for deployment.

## Endpoints (high level)

- `GET /` health
- `GET /health` detailed health
- `POST /chat` send user message (optionally include `session_id`)
- `GET /sessions` list sessions
- `GET /sessions/{session_id}/history` conversation history
- `DELETE /sessions/{session_id}` delete session
- `POST /sessions/{session_id}/clear` clear metadata
- `POST /reload-documents` rebuild vector DB

## Project Structure (important files)

- `backend/main.py` — FastAPI app and REST endpoints
- `backend/rag/rag_engine.py` — RAG engine using LangChain/LangGraph
- `frontend/index.jsx` — main React app (UI + calculator + chat)
- `frontend/components/` — UI components

## Participants

- Oluwaseyi Egunjobi — https://github.com/oluwaseyi-egunjobi
- <Member Name> — https://github.com/<github-handle>
- <Member Name> — https://github.com/<github-handle>

If you want, provide the names/handles and I will update this README with the real list.

## Contributing

- Follow the Quick Start to run locally.
- Implement features in branches and open PRs for review.
- Keep secrets out of the repo; use `.env` for API keys.

