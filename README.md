# Chat Agent UI

A lightweight React/Vite chat UI for the Refund Management Agent backend.

## Features

- Chats with FastAPI at `POST /api/v1/chat`
- Selects the demo account `siva`, `inba`, or `soundhu`
- Checks backend health at `GET /health`
- Starts a new thread for each conversation and account
- Uses a local Vite proxy so backend secrets never enter the browser

## Run locally

Start the backend separately at `http://127.0.0.1:8000`, then run:

```sh
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`. The chat request body includes `message`, `thread_id`, and `user_name`.

Set `REFUND_API_URL` in `.env` to change the Vite development proxy target. For a deployed backend, set `VITE_API_BASE_URL` to the API base URL and configure the backend's `FRONTEND_ORIGIN` to match the frontend origin.

The UI uses the backend's sample accounts, which are selectors rather than authentication. It does not process real payments.
