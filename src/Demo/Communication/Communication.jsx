import React, { useState, useEffect, useRef } from "react";
import "./Communication.css";

const init = [
  {
    id: 1,
    with: "Parent - Rajesh",
    role: "Parent",
    avatar: "https://ui-avatars.com/api/?name=Rajesh&background=4154f1&color=fff",
    messages: [
      {
        from: "Admin",
        type: "outgoing",
        text: "Welcome to School CRM",
        date: "2025-11-01",
      },
    ],
  },
  {
    id: 2,
    with: "Teacher - Neha",
    role: "Teacher",
    avatar: "https://ui-avatars.com/api/?name=Neha&background=6c5ce7&color=fff",
    messages: [
      {
        from: "Teacher",
        type: "incoming",
        text: "Monthly report shared",
        date: "2025-11-03",
      },
    ],
  },
];

export default function Communication() {
  const [threads, setThreads] = useState(init);
  const [sel, setSel] = useState(init[0].id);
  const [msg, setMsg] = useState("");

  const msgEndRef = useRef(null);

  const current = threads.find((t) => t.id === sel);

  function send() {
    if (!msg.trim()) return;

    const newMsg = {
      from: "Admin",
      type: "outgoing",
      text: msg,
      date: new Date().toISOString().split("T")[0],
    };

    const updated = threads.map((t) =>
      t.id === sel
        ? { ...t, messages: [...t.messages, newMsg] }
        : t
    );

    setThreads(updated);
    setMsg("");
  }

  // auto scroll to bottom
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current.messages]);

  return (
    <div className="comm-wrapper">

      <h1 className="comm-title">Communication Center</h1>

      <div className="comm-container">

        {/* LEFT PANEL */}
        <div className="comm-left">
          <h3>Inbox</h3>
          <div className="thread-list">
            {threads.map((t) => {
              const last = t.messages[t.messages.length - 1];
              return (
                <div
                  key={t.id}
                  className={`thread-item ${sel === t.id ? "active" : ""}`}
                  onClick={() => setSel(t.id)}
                >
                  <img src={t.avatar} alt="" className="avatar" />

                  <div className="thread-info">
                    <div className="thread-top">
                      <span className="thread-with">{t.with}</span>
                      <span className="thread-date">{last.date}</span>
                    </div>

                    <div className="thread-preview">
                      {last.text.length > 28
                        ? last.text.slice(0, 27) + "..."
                        : last.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="comm-right">
          <div className="chat-header">
            <img src={current.avatar} alt="" className="avatar-big" />
            <div>
              <h2>{current.with}</h2>
              <p className="chat-role">{current.role}</p>
            </div>
          </div>

          <div className="chat-box">
            {current.messages.map((m, i) => (
              <div key={i} className={`msg-row ${m.type}`}>
                <div className="msg-bubble">
                  <div className="msg-text">{m.text}</div>
                  <div className="msg-date">{m.date}</div>
                </div>
              </div>
            ))}
            <div ref={msgEndRef}></div>
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Type a message..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button className="chat-send-btn" onClick={send}>
              ➤
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
