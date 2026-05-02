import React, { useState, useRef, useEffect } from "react";
import { AGENT_URL, AGENT_KEY } from "../config/constants";

const SUGGESTED = [
  "How does private credit scoring work?",
  "How can I improve my score?",
  "What documents should I upload?",
  "How is my interest rate calculated?",
];

export default function ChatAgent({ account, aiScore, aiEligible, loanRemaining, interestRate }) {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([
    { role: "assistant", text: "Hi! I'm the ShadowLend AI assistant. Ask me anything about private lending, your credit score, or how FHE protects your data." },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  async function send(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs((p) => [...p, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const resp = await fetch(`${AGENT_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agent-key": AGENT_KEY },
        body: JSON.stringify({
          message: msg,
          userContext: {
            connected:     !!account,
            address:       account || null,
            score:         aiScore  || null,
            eligible:      aiEligible ?? null,
            loanRemaining: loanRemaining || 0,
            interestRate:  interestRate  || null,
          },
        }),
      });
      const data = await resp.json();
      setMsgs((p) => [...p, { role: "assistant", text: data.reply || "Sorry, I couldn't get a response." }]);
    } catch {
      setMsgs((p) => [...p, { role: "assistant", text: "Connection error — make sure the agent server is running." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Toggle bubble */}
      <button
        className="chat-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle chat"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        )}
        {!open && <span className="chat-badge">AI</span>}
      </button>

      {/* Chat window */}
      {open && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-left">
              <div className="fs-dot g" style={{ marginRight: 8 }} />
              <span>ShadowLend Assistant</span>
            </div>
            <span className="chat-model">Llama 3.3-70B</span>
          </div>

          <div className="chat-messages">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === "assistant" && (
                  <div className="chat-avatar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </div>
                )}
                <div className="chat-bubble">{m.text}</div>
              </div>
            ))}

            {loading && (
              <div className="chat-msg assistant">
                <div className="chat-avatar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <div className="chat-bubble chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {msgs.length === 1 && !loading && (
              <div className="chat-suggestions">
                {SUGGESTED.map((s) => (
                  <button key={s} className="chat-suggestion" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Ask about your score, loans, or FHE..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={loading}
            />
            <button className="chat-send" onClick={() => send()} disabled={loading || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
