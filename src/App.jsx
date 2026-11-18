import { useEffect, useRef, useState } from "react";
import {
  Activity, ArrowDown, ArrowUp, Bot, Check, ChevronDown, CircleHelp,
  MessageSquarePlus, Settings2, ShieldCheck, Sparkles, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ENDPOINTS_KEY = "chat-agent-ui:endpoints";
const ACTIVE_ENDPOINT_KEY = "chat-agent-ui:active-endpoint";
const BACKEND_URL_KEY = "chat-agent-ui:backend-url";
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const DEFAULT_TEMPLATE = "{\n  \"message\": \"{{message}}\",\n  \"thread_id\": \"{{thread_id}}\",\n  \"user_name\": \"{{user_name}}\"\n}";
const SUGGESTIONS = [
  { title: "Say hello", text: "Hello! What can you help me with?" },
  { title: "Test a question", text: "Give me a short example of what you can do." },
  { title: "Try a detailed prompt", text: "Summarize the key things you can help with." },
];

function makeEndpoint(name = "Local FastAPI") {
  return {
    id: crypto.randomUUID(),
    name,
    baseUrl: localStorage.getItem(BACKEND_URL_KEY) || DEFAULT_BACKEND_URL,
    url: "/api/v1/chat",
    requestTemplate: DEFAULT_TEMPLATE,
    responsePath: "answer",
  };
}

function loadEndpoints() {
  try {
    const saved = JSON.parse(localStorage.getItem(ENDPOINTS_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    // Start with the local backend profile when browser storage has no valid settings.
  }
  return [makeEndpoint()];
}

function newThreadId() {
  return "chat-" + crypto.randomUUID();
}

function displayTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function fillTemplate(value, variables) {
  if (Array.isArray(value)) return value.map((item) => fillTemplate(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillTemplate(item, variables)]));
  }
  if (typeof value === "string") {
    return value.replace(/\{\{(message|thread_id|user_name)\}\}/g, (_, key) => variables[key]);
  }
  return value;
}

function getResponseValue(payload, path) {
  if (!path) return payload;
  return path.split(".").filter(Boolean).reduce((value, key) => value?.[key], payload);
}

function responseText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

function formatApiError(payload, status) {
  const detail = payload?.detail ?? payload?.message ?? payload?.error ?? payload;
  if (Array.isArray(detail)) return "HTTP " + status + ": " + detail.map((item) => {
    const path = Array.isArray(item.loc) ? item.loc.filter((part) => part !== "body").join(".") : "";
    return (path ? path + ": " : "") + (item.msg || item.type || "Invalid value");
  }).join("; ");
  if (typeof detail === "string") return "HTTP " + status + ": " + detail;
  if (detail && typeof detail === "object") return "HTTP " + status + ": " + JSON.stringify(detail);
  return "HTTP " + status + ": Check the required request fields in the endpoint schema.";
}
function resolveSchema(schema, components) {
  if (!schema || typeof schema !== "object") return {};
  if (schema.$ref) return resolveSchema(components?.schemas?.[schema.$ref.split("/").pop()], components);
  return schema;
}
function templateFromSchema(schema) {
  const body = {};
  for (const [name, field] of Object.entries(schema?.properties || {})) {
    if (/^(message|prompt|query|input)$/i.test(name)) body[name] = "{{message}}";
    else if (/^(thread_?id|conversation_?id)$/i.test(name)) body[name] = "{{thread_id}}";
    else if (/^(user_?name|username)$/i.test(name)) body[name] = "{{user_name}}";
    else if (field.type === "integer" || field.type === "number") body[name] = 0;
    else if (field.type === "boolean") body[name] = false;
    else if (field.type === "array") body[name] = [];
    else if (field.type === "object") body[name] = {};
    else body[name] = "";
  }
  return Object.keys(body).length ? JSON.stringify(body, null, 2) : DEFAULT_TEMPLATE;
}

export default function App() {
  const [initialState] = useState(() => {
    const savedEndpoints = loadEndpoints();
    const savedId = localStorage.getItem(ACTIVE_ENDPOINT_KEY);
    return {
      endpoints: savedEndpoints,
      activeId: savedEndpoints.some((item) => item.id === savedId) ? savedId : savedEndpoints[0].id,
      firstRun: !localStorage.getItem(ENDPOINTS_KEY),
    };
  });
  const [endpoints, setEndpoints] = useState(initialState.endpoints);
  const [activeId, setActiveId] = useState(initialState.activeId);
  const [username, setUsername] = useState("");
  const [started, setStarted] = useState(false);
  const [postOperations, setPostOperations] = useState([]);
  const [schemaNotice, setSchemaNotice] = useState("");
  const [threadId, setThreadId] = useState(newThreadId);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(initialState.firstRun);
  const [editing, setEditing] = useState({ ...initialState.endpoints[0] });
  const [settingsError, setSettingsError] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const activeEndpoint = endpoints.find((item) => item.id === activeId) || endpoints[0];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function persistEndpoints(nextEndpoints, nextActiveId = activeId) {
    setEndpoints(nextEndpoints);
    setActiveId(nextActiveId);
    try {
      localStorage.setItem(ENDPOINTS_KEY, JSON.stringify(nextEndpoints));
      localStorage.setItem(ACTIVE_ENDPOINT_KEY, nextActiveId);
    } catch {
      setSettingsError("Browser storage is unavailable. Endpoint settings may not persist.");
    }
  }

  function startNewChat() {
    setThreadId(newThreadId());
    setUsername(""); setStarted(false);
    setMessages([]); setError("");
  }

  function beginConversation(event) {
    event.preventDefault();
    if (!username.trim()) return;
    setUsername(username.trim()); setStarted(true); inputRef.current?.focus();
  }

  function selectEndpoint(event) {
    const id = event.target.value;
    setActiveId(id); setUsername(""); setStarted(false);
    localStorage.setItem(ACTIVE_ENDPOINT_KEY, id);
    setThreadId(newThreadId());
    setMessages([]);
    setError("");
  }

  function openNewEndpoint() {
    setSettingsError(""); setSchemaNotice(""); setPostOperations([]);
    setEditing({ ...makeEndpoint("New endpoint"), url: "", baseUrl: localStorage.getItem(BACKEND_URL_KEY) || DEFAULT_BACKEND_URL, requestTemplate: DEFAULT_TEMPLATE, responsePath: "answer" });
    setSettingsOpen(true);
  }

  function openEndpointSettings() {
    setSettingsError(""); setSchemaNotice(""); setPostOperations([]);
    setEditing({ ...activeEndpoint, baseUrl: activeEndpoint.baseUrl || localStorage.getItem(BACKEND_URL_KEY) || DEFAULT_BACKEND_URL });
    setSettingsOpen(true);
  }

  async function discoverPostOperations() {
    setSettingsError(""); setSchemaNotice("");
    try {
      const base = (editing.baseUrl || localStorage.getItem(BACKEND_URL_KEY) || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(base)) throw new Error("Enter a backend URL starting with http:// or https://.");
      const response = await fetch(base + "/openapi.json");
      if (!response.ok) throw new Error("Could not load OpenAPI schema (HTTP " + response.status + ").");
      const spec = await response.json(); const operations = [];
      for (const [path, methods] of Object.entries(spec.paths || {})) {
        if (!methods?.post) continue;
        const schema = resolveSchema(methods.post.requestBody?.content?.["application/json"]?.schema, spec.components);
        operations.push({ key: "POST " + path, path, title: methods.post.summary || methods.post.operationId || path, schema, properties: schema.properties || {}, required: schema.required || [] });
      }
      if (!operations.length) throw new Error("The OpenAPI document has no POST endpoints.");
      setPostOperations(operations); setSchemaNotice("Found " + operations.length + " POST endpoint(s). Select your chat route.");
    } catch (err) { setSettingsError(err.message || "Could not read schema. Check backend URL and CORS settings."); }
  }
  function choosePostOperation(event) {
    const operation = postOperations.find((item) => item.key === event.target.value);
    if (!operation) return;
    const base = (editing.baseUrl || localStorage.getItem(BACKEND_URL_KEY) || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
    setEditing((current) => ({ ...current, baseUrl: base, url: base + operation.path, name: operation.title,
      requestTemplate: templateFromSchema(operation.schema),
      schemaSummary: operation.key + " · fields: " + Object.keys(operation.properties).join(", ") + (operation.required.length ? " · required: " + operation.required.join(", ") : "") }));
  }

  function saveEndpoint(event) {
    event.preventDefault();
    setSettingsError("");
    let parsedTemplate;
    try {
      parsedTemplate = JSON.parse(editing.requestTemplate);
    } catch {
      setSettingsError("Request body must be valid JSON.");
      return;
    }
    if (!parsedTemplate || Array.isArray(parsedTemplate) || typeof parsedTemplate !== "object") {
      setSettingsError("Request body must be a JSON object.");
      return;
    }
    if (!editing.name.trim() || !editing.url.trim()) {
      setSettingsError("Add a name and a chat endpoint URL.");
      return;
    }
    const next = endpoints.some((item) => item.id === editing.id)
      ? endpoints.map((item) => item.id === editing.id ? { ...editing, name: editing.name.trim(), url: editing.url.trim() } : item)
      : [...endpoints, { ...editing, name: editing.name.trim(), url: editing.url.trim() }];
    persistEndpoints(next, editing.id);
    localStorage.setItem(BACKEND_URL_KEY, editing.baseUrl || DEFAULT_BACKEND_URL);
    setThreadId(newThreadId());
    setMessages([]);
    setSettingsOpen(false);
    setEditing(null);
  }

  function removeEndpoint() {
    if (endpoints.length < 2) {
      setSettingsError("Keep at least one endpoint profile.");
      return;
    }
    const remaining = endpoints.filter((item) => item.id !== activeId);
    persistEndpoints(remaining, remaining[0].id);
    setThreadId(newThreadId());
    setMessages([]);
    setSettingsOpen(false);
    setEditing(null);
  }

  async function sendMessage(text = draft) {
    const message = text.trim();
    if (!message || sending || !activeEndpoint || !started || !username.trim()) return;

    let requestBody;
    try {
      requestBody = fillTemplate(JSON.parse(activeEndpoint.requestTemplate), {
        message,
        thread_id: threadId,
        user_name: username.trim(),
      });
    } catch {
      setError("This endpoint has an invalid request template. Open endpoint settings to fix it.");
      return;
    }

    setDraft("");
    setError("");
    setSending(true);
    setMessages((current) => [...current, {
      id: crypto.randomUUID(), role: "user", content: message, time: new Date(),
    }]);

    try {
      const response = await fetch(activeEndpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const raw = await response.text();
      let payload = raw;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        // Plain text responses are valid too.
      }
      if (!response.ok) {
        throw new Error(formatApiError(payload, response.status));
      }
      const answer = responseText(getResponseValue(payload, activeEndpoint.responsePath));
      if (!answer) throw new Error("No response value found. Check the response field in endpoint settings.");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "assistant", content: answer, time: new Date(),
      }]);
    } catch (sendError) {
      setError(sendError.message || "Could not reach this endpoint. Check the URL and its CORS settings.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function submit(event) {
    event.preventDefault();
    sendMessage();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <button className="new-chat-button" onClick={startNewChat}>
          <MessageSquarePlus size={17} /><span>New conversation</span>
        </button>

        <div className="side-label">CHAT</div>
        <div className="workspace-item active"><MessageSquarePlus size={15} /><span>Assistant</span><span className="active-dot" /></div>

        <div className="endpoint-card">
          <div className="endpoint-card-heading">
            <div className="side-label">ENDPOINT</div>
            <button className="icon-button endpoint-settings-button" onClick={openEndpointSettings} aria-label="Configure endpoint" title="Configure endpoint">
              <Settings2 size={15} />
            </button>
          </div>
          <label className="endpoint-select">
            <select value={activeId} onChange={selectEndpoint} aria-label="Choose endpoint">
              {endpoints.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <ChevronDown size={15} />
          </label>
          <div className="endpoint-url">{activeEndpoint?.url}</div>
          <button className="add-endpoint-button" onClick={openNewEndpoint}>+ Add endpoint</button>
        </div>

        <div className="sidebar-spacer" />
        <div className="connection-card">
          <div className="status-icon ready"><Check size={14} /></div>
          <div className="connection-copy"><strong>Endpoint selected</strong><span>{activeEndpoint?.name}</span></div>
          <span className="status-indicator ready" />
        </div>
        <div className="sidebar-footer">
          <ShieldCheck size={15} /><span>Profiles stored in this browser</span>
          <button className="icon-button help-button" aria-label="Endpoint help" title="Endpoint settings are stored in this browser">
            <CircleHelp size={16} />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><Brand compact /></div>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-separator">/</span><strong>Assistant</strong></div>
          <div className="topbar-actions">
            <div className="api-pill ready"><span />{activeEndpoint?.name || "No endpoint"}</div>
            <button className="icon-button top-settings" onClick={openEndpointSettings} aria-label="Configure endpoint" title="Configure endpoint"><Settings2 size={17} /></button>
            <button className="icon-button top-new-chat" onClick={startNewChat} aria-label="New conversation" title="New conversation"><MessageSquarePlus size={17} /></button>
          </div>
        </header>

        <section className="chat-area">
          <div className="conversation-heading">
            <div className="assistant-avatar"><Bot size={21} /></div>
            <div><h1>Assistant</h1><p>Chat with any compatible endpoint.</p></div>
            <div className="conversation-endpoint"><Activity size={14} /><span>{activeEndpoint?.name}</span></div>
          </div>

          <div className="message-list" ref={listRef}>
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-icon"><Sparkles size={22} /></div>
                <div className="eyebrow">CHAT WORKSPACE</div>
                <h2>What would you<br />like to explore?</h2>
                <p>Choose an endpoint and start a conversation. You can save multiple endpoints for testing.</p>
                {started ? <div className="suggestion-grid">
                  {SUGGESTIONS.map((item) => (
                    <button className="suggestion-card" key={item.title} onClick={() => sendMessage(item.text)} disabled={sending}>
                      <span>{item.title}</span><ArrowUp size={15} />
                    </button>
                  ))}
                </div> : <form className="conversation-start" onSubmit={beginConversation}>
                  <label htmlFor="conversation-username">Username</label>
                  <input id="conversation-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Enter your username" autoComplete="username" />
                  <button className="save-button" type="submit" disabled={!username.trim()}>Start conversation</button>
                </form>}
              </div>
            ) : (
              <div className="messages">
                {messages.map((message) => (
                  <article className={"message-row " + message.role} key={message.id}>
                    {message.role === "assistant"
                      ? <div className="message-avatar assistant-small"><Bot size={15} /></div>
                      : <div className="message-avatar user-small">{username.slice(0, 1).toUpperCase()}</div>}
                    <div className="message-content">
                      <div className="message-meta"><strong>{message.role === "assistant" ? "Assistant" : username}</strong><time>{displayTime(message.time)}</time></div>
                      {message.role === "assistant" ? (
                        <div className="message-bubble assistant markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="message-bubble user">{message.content}</div>
                      )}
                    </div>
                  </article>
                ))}
                {sending && <article className="message-row assistant"><div className="message-avatar assistant-small"><Bot size={15} /></div><div className="typing-bubble" aria-label="Assistant is responding"><i /><i /><i /></div></article>}
              </div>
            )}
          </div>

          <div className="composer-wrap">
            {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
            <form className="composer" onSubmit={submit}>
              <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown}
                placeholder={started ? "Message as " + username + "…" : "Enter a username to start chatting…"} rows={1} aria-label="Message" disabled={!started || sending} />
              <div className="composer-toolbar"><span className="composer-hint">{started ? username + " · " + threadId : activeEndpoint?.name}</span>
                <div className="composer-actions"><span className="enter-hint">Enter to send · Shift+Enter for new line</span>
                  <button className="send-button" type="submit" aria-label="Send message" disabled={!started || !draft.trim() || sending}><ArrowDown size={16} /></button>
                </div>
              </div>
            </form>
            <div className="disclaimer">Responses are provided by the selected endpoint. Verify important information.</div>
          </div>
        </section>
      </main>

      {settingsOpen && editing && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) { setSettingsOpen(false); setEditing(null); }
        }}>
          <section className="endpoint-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-heading">
              <div><div className="eyebrow">CONNECTION SETTINGS</div><h2 id="settings-title">{initialState.firstRun ? "Connect your API" : "Configure endpoint"}</h2></div>
              <button className="icon-button" onClick={() => { setSettingsOpen(false); setEditing(null); }} aria-label="Close settings"><X size={18} /></button>
            </div>
            <p className="modal-description">Enter your backend base URL, load its OpenAPI schema, then choose the POST route your chat uses.</p>
            <div className="settings-form">
            <label>Backend base URL<input value={editing.baseUrl || localStorage.getItem(BACKEND_URL_KEY) || DEFAULT_BACKEND_URL} onChange={(event) => setEditing({ ...editing, baseUrl: event.target.value })} placeholder="http://127.0.0.1:8000" /></label>
            <button type="button" className="cancel-button" onClick={discoverPostOperations}>Load POST endpoints from /openapi.json</button>
            {schemaNotice && <div className="schema-summary">{schemaNotice}</div>}
            {postOperations.length > 0 && <label>POST endpoint<select className="schema-select" onChange={choosePostOperation} defaultValue=""><option value="">Choose a chat endpoint…</option>{postOperations.map((item) => <option key={item.key} value={item.key}>{item.key} — {item.title}</option>)}</select></label>}
            {editing.schemaSummary && <div className="schema-summary">{editing.schemaSummary}</div>}
            </div>
            <form className="settings-form" onSubmit={saveEndpoint}>
              <label>Endpoint name
                <input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="My FastAPI agent" />
              </label>
              <label>Chat endpoint URL
                <input value={editing.url} onChange={(event) => setEditing({ ...editing, url: event.target.value })} placeholder="https://api.example.com/api/v1/chat" />
              </label>
              <label>Request body template
                <textarea className="template-input" value={editing.requestTemplate} onChange={(event) => setEditing({ ...editing, requestTemplate: event.target.value })} spellCheck="false" />
              </label>
              <div className="template-help">Use <code>{"{{message}}"}</code>, <code>{"{{thread_id}}"}</code>, and <code>{"{{user_name}}"}</code>. Username is entered at the start of each conversation.</div>
              <label>Response field
                <input value={editing.responsePath} onChange={(event) => setEditing({ ...editing, responsePath: event.target.value })} placeholder="answer or choices.0.message.content" />
              </label>
              <div className="template-help">Use a dot path such as <code>answer</code> or <code>choices.0.message.content</code>. Leave blank for plain text or the full response.</div>
              {settingsError && <div className="error-banner settings-error" role="alert">{settingsError}</div>}
              <div className="modal-actions">
                {endpoints.length > 1 && endpoints.some((item) => item.id === editing.id) && (
                  <button type="button" className="remove-endpoint" onClick={removeEndpoint}>Remove profile</button>
                )}
                <button type="button" className="cancel-button" onClick={() => { setSettingsOpen(false); setEditing(null); }}>Cancel</button>
                <button type="submit" className="save-button">Save endpoint</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <>
      <div className="brand-mark"><Sparkles size={compact ? 16 : 18} /></div>
      {compact ? <div className="brand-name">agent<span>desk</span></div> : <div><div className="brand-name">agent<span>desk</span></div><div className="brand-caption">API chat workspace</div></div>}
    </>
  );
}
