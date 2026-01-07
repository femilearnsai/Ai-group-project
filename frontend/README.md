# Frontend — TaxNG Assistant UI

This folder contains the React + Vite frontend for the TaxNG assistant. It provides the chat UI, session list sidebar, and statutory calculator.

**Key files**
- `index.jsx` — main app wiring (chat UI, calculator, session handling)
- `components/` — modular UI components (`ChatWindow.jsx`, `ChatInput.jsx`, `Header.jsx`, etc.)
- `package.json` — Node dependencies and scripts

## Run locally

```bash
cd frontend
npm install
npm run dev
```

The app runs on the Vite dev server (usually http://localhost:5173). The frontend expects the backend at `http://localhost:8000` by default; change URLs in `index.jsx` if your backend is hosted elsewhere.

## Notes

- The UI components are intentionally separated under `components/`. Avoid changing component contracts unless you update all usages.
- Session handling: the frontend now allows the backend to create canonical `session_id`s (omit `session_id` when creating a new chat; the backend returns one).
- The sidebar shows session titles and metadata; it is responsive and closes automatically on small screens.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
