# Chat Agent UI

A generic React/Vite chat workspace for testing FastAPI and other JSON chat endpoints.

## Features

- Configure and save multiple chat endpoint profiles in the browser.
- Customize the request JSON template with `{{message}}` and `{{thread_id}}`.
- Select a response field with a dot path, such as `answer` or `choices.0.message.content`.
- Render Markdown tables, lists, headings, code, and links in assistant responses.
- Keep endpoint settings in browser local storage; no endpoint credentials are built into the UI.

## Run locally

The default profile uses the Vite proxy path `/api/v1/chat`. The proxy sends requests to `http://127.0.0.1:8000`.

```sh
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`. You can change the proxy target with `REFUND_API_URL` in a local `.env` file, or configure any full endpoint URL from the UI's endpoint settings.

For remote endpoints, the endpoint must allow browser requests from the UI origin through CORS. Do not place API secrets in the request template. Add authentication only through a secure backend proxy.

## Default API shape

The default request template sends:

```json
{"message":"...","thread_id":"..."}
```

The default response field is `answer`. Both can be changed per endpoint profile.
