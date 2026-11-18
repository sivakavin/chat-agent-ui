import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, ArrowDown, ArrowUp, Bot, Check, ChevronDown, CircleHelp,
  MessageSquarePlus, ShieldCheck, Sparkles,
  UserRound, X,
} from "lucide-react";

const USERS = ["siva", "inba", "soundhu"];
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SUGGESTIONS = [
  { title: "View my orders", text: "List my orders" },
  { title: "Check an order", text: "Check order 4521" },
  { title: "Request a refund", text: "Request a refund for order 4521 because it arrived damaged" },
];

function newThreadId() {
  return "chat-" + crypto.randomUUID();
}

function displayTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export default function App() {
  const [userName, setUserName] = useState("siva");
  const [threadId, setThreadId] = useState(newThreadId);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const apiUrl = useCallback((path) => API_BASE + path, []);

  useEffect(() => {
    let active = true;
    async function checkHealth() {
      try {
        const response = await fetch(apiUrl("/health"));
        if (!response.ok) throw new Error();
        if (active) setApiStatus("online");
      } catch {
        if (active) setApiStatus("offline");
      }
    }
    checkHealth();
    const timer = window.setInterval(checkHealth, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [apiUrl]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function startNewChat() {
    setThreadId(newThreadId());
    setMessages([]);
    setError("");
    inputRef.current?.focus();
  }

  function changeAccount(event) {
    setUserName(event.target.value);
    setThreadId(newThreadId());
    setMessages([]);
    setError("");
  }

  async function sendMessage(text = draft) {
    const message = text.trim();
    if (!message || sending) return;
    setDraft("");
    setError("");
    setSending(true);
    setMessages((current) => [...current, {
      id: crypto.randomUUID(), role: "user", content: message, time: new Date(),
    }]);

    try {
      const response = await fetch(apiUrl("/api/v1/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, thread_id: threadId, user_name: userName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "The assistant request failed.");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.answer || "The assistant returned an empty response.",
        time: new Date(),
      }]);
    } catch (sendError) {
      setError(sendError.message || "Could not reach the refund assistant.");
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

  const statusText = { checking: "Connecting", online: "API connected", offline: "API offline" }[apiStatus];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div><div className="brand-name">refund<span>desk</span></div><div className="brand-caption">AI support workspace</div></div>
        </div>

        <button className="new-chat-button" onClick={startNewChat}>
          <MessageSquarePlus size={17} /><span>New conversation</span>
        </button>

        <div className="side-label">WORKSPACE</div>
        <div className="workspace-item active"><MessageSquarePlus size={15} /><span>Refund assistant</span><span className="active-dot" /></div>

        <div className="account-card">
          <div className="side-label">DEMO ACCOUNT</div>
          <label className="account-select">
            <span className="avatar">{userName.slice(0, 1).toUpperCase()}</span>
            <select value={userName} onChange={changeAccount} aria-label="Choose demo account">
              {USERS.map((user) => <option key={user} value={user}>{user}</option>)}
            </select>
            <ChevronDown size={15} />
          </label>
          <p>Orders and tools are scoped to this demo account.</p>
        </div>

        <div className="sidebar-spacer" />
        <div className="connection-card">
          <div className={"status-icon " + apiStatus}>{apiStatus === "online" ? <Check size={14} /> : <Activity size={14} />}</div>
          <div className="connection-copy"><strong>{statusText}</strong><span>{API_BASE || "Local API proxy"}</span></div>
          <span className={"status-indicator " + apiStatus} />
        </div>
        <div className="sidebar-footer">
          <ShieldCheck size={15} /><span>Demo mode · no real payments</span>
          <button className="icon-button help-button" aria-label="About this demo" title="Refund approvals are simulated"><CircleHelp size={16} /></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><Sparkles size={16} /></div><span className="brand-name">refund<span>desk</span></span></div>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-separator">/</span><strong>Refund assistant</strong></div>
          <div className="topbar-actions">
            <div className={"api-pill " + apiStatus}><span />{statusText}</div>
            <button className="icon-button top-new-chat" onClick={startNewChat} aria-label="New conversation"><MessageSquarePlus size={17} /></button>
          </div>
        </header>

        <section className="chat-area">
          <div className="conversation-heading">
            <div className="assistant-avatar"><Bot size={21} /></div>
            <div><h1>Refund assistant</h1><p>Ask about orders, eligibility, or a simulated refund.</p></div>
            <div className="conversation-account"><UserRound size={14} /><span>{userName}</span></div>
          </div>

          <div className="message-list" ref={listRef}>
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-icon"><Sparkles size={22} /></div>
                <div className="eyebrow">YOUR SUPPORT ASSISTANT</div>
                <h2>How can I help<br />with your order?</h2>
                <p>I can find your orders, check refund eligibility, and record a simulated refund request.</p>
                <div className="suggestion-grid">
                  {SUGGESTIONS.map((item) => (
                    <button className="suggestion-card" key={item.title} onClick={() => sendMessage(item.text)} disabled={sending}>
                      <span>{item.title}</span><ArrowUp size={15} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="messages">
                {messages.map((message) => (
                  <article className={"message-row " + message.role} key={message.id}>
                    {message.role === "assistant"
                      ? <div className="message-avatar assistant-small"><Bot size={15} /></div>
                      : <div className="message-avatar user-small">{userName.slice(0, 1).toUpperCase()}</div>}
                    <div className="message-content">
                      <div className="message-meta"><strong>{message.role === "assistant" ? "Refund assistant" : userName}</strong><time>{displayTime(message.time)}</time></div>
                      <div className={"message-bubble " + message.role}>{message.content}</div>
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
                placeholder={"Message the assistant as " + userName + "…"} rows={1} aria-label="Message" disabled={sending} />
              <div className="composer-toolbar"><span className="composer-hint">Refund approvals are simulated</span>
                <div className="composer-actions"><span className="enter-hint">Enter to send · Shift+Enter for new line</span>
                  <button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || sending}><ArrowDown size={16} /></button>
                </div>
              </div>
            </form>
            <div className="disclaimer">The assistant can make mistakes. Verify order details before taking action.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
