import SERVER_URL from "../config";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function playNotif() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 520;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

export default function Chat({ roomId, username }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [users, setUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const isTyping = useRef(false);

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;
    socket.emit("join-room", { roomId, username });
    socket.on("chat-history", (h) => setMessages(h));
    socket.on("receive-message", (msg) => {
      setMessages((p) => [...p, msg]);
      if (msg.username !== username) playNotif();
    });
    socket.on("user-joined", ({ users }) => setUsers(users));
    socket.on("user-left", ({ username: left, users }) => {
      setUsers(users);
      setMessages((p) => [...p, { id: Math.random().toString(), username: "System", message: `${left} left`, time: new Date().toISOString(), reactions: {} }]);
    });
    socket.on("user-typing", ({ username: u }) => setTypingUsers((p) => p.includes(u) ? p : [...p, u]));
    socket.on("user-stop-typing", ({ username: u }) => setTypingUsers((p) => p.filter((x) => x !== u)));
    socket.on("message-reacted", ({ msgId, reactions }) => setMessages((p) => p.map((m) => m.id === msgId ? { ...m, reactions } : m)));
    socket.on("message-deleted", ({ msgId }) => setMessages((p) => p.map((m) => m.id === msgId ? { ...m, deleted: true, message: "", fileUrl: null } : m)));
    socket.on("message-edited", ({ msgId, newMessage }) => setMessages((p) => p.map((m) => m.id === msgId ? { ...m, message: newMessage, edited: true } : m)));
    return () => socket.disconnect();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingUsers]);
  useEffect(() => { if (replyTo || editingMsg) inputRef.current?.focus(); }, [replyTo, editingMsg]);

  const handleTyping = () => {
    if (!isTyping.current) { isTyping.current = true; socketRef.current.emit("typing", { roomId, username }); }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      isTyping.current = false;
      socketRef.current.emit("stop-typing", { roomId, username });
    }, 1500);
  };

  const sendMessage = (msgData = {}) => {
    if (editingMsg) {
      if (!input.trim()) return;
      socketRef.current.emit("edit-message", { roomId, username, msgId: editingMsg.id, newMessage: input.trim() });
      setEditingMsg(null); setInput(""); return;
    }
    const message = msgData.message ?? input;
    if (!message.trim() && !msgData.fileUrl) return;
    socketRef.current.emit("send-message", {
      roomId, username, message: message.trim(),
      replyTo: replyTo ? { id: replyTo.id, username: replyTo.username, message: replyTo.message } : null,
      ...msgData,
    });
    setInput(""); setReplyTo(null);
    isTyping.current = false;
    socketRef.current.emit("stop-typing", { roomId, username });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${SERVER_URL}/upload`, { method: "POST", body: form });
      const data = await res.json();
      sendMessage({ message: "", fileUrl: data.url, fileName: data.name, isImage: data.isImage });
    } catch { alert("Upload failed"); }
    setUploading(false);
    e.target.value = "";
  };

  const reactToMessage = (msgId) => socketRef.current.emit("react-message", { roomId, msgId, emoji: "❤️", username });
  const deleteMessage = (msgId) => socketRef.current.emit("delete-message", { roomId, msgId, username });
  const startEdit = (msg) => { setEditingMsg({ id: msg.id }); setInput(msg.message); setReplyTo(null); setHoveredMsg(null); };
  const startReply = (msg) => { setReplyTo({ id: msg.id, username: msg.username, message: msg.message }); setEditingMsg(null); setInput(""); setHoveredMsg(null); };
  const cancelAction = () => { setReplyTo(null); setEditingMsg(null); setInput(""); };
  const scrollToMsg = (msgId) => document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const copyLink = () => { navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="chat-wrapper">

      {/* Mobile sidebar overlay */}
      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

      {/* Sidebar */}
      <div className={`sidebar ${showSidebar ? "sidebar-open" : ""}`}>
        <div className="sidebar-inner">
          <div className="side-logo-row">
            <span className="side-logo">🌌</span>
            <span className="side-appname">RuuSpace</span>
            <button className="sidebar-close" onClick={() => setShowSidebar(false)}>✕</button>
          </div>

          <div className="side-section">
            <p className="side-label">ROOM</p>
            <div className="room-code-box">{roomId}</div>
            <button className="copy-link-btn" onClick={copyLink}>
              {copied ? "✅ Copied!" : "🔗 Copy Invite Link"}
            </button>
          </div>

          <div className="side-section">
            <p className="side-label">ONLINE — {users.length}</p>
            <div className="user-list">
              {users.map((u) => (
                <div key={u.username} className="user-row">
                  <div className="avatar-wrap">
                    <span className="avatar-letter">{u.username[0].toUpperCase()}</span>
                    <span className="avatar-dot" style={{ background: u.color }} />
                  </div>
                  <span style={{ color: u.color, fontSize: 13, fontWeight: 500 }}>
                    {u.username}{u.username === username ? " (you)" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="chat-main">

        {/* Header */}
        <div className="chat-header">
          <button className="menu-btn" onClick={() => setShowSidebar(true)}>☰</button>
          <div className="header-center">
            <span className="header-hash">#</span>
            <span className="header-room">{roomId}</span>
            <span className="header-dot-sep" />
            <span className="header-online">{users.length} online</span>
          </div>
          <div style={{ width: 36 }} /> {/* spacer */}
        </div>

        {/* Messages */}
        <div className="messages-area">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🌌</div>
              <p className="empty-text">No messages yet</p>
              <p className="empty-sub">Be the first to say something!</p>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.username === username;
            const isSystem = msg.username === "System";
            const heartCount = msg.reactions?.["❤️"]?.length || 0;
            const iReacted = msg.reactions?.["❤️"]?.includes(username);

            return (
              <div
                id={`msg-${msg.id}`}
                key={msg.id}
                className={`msg-row ${isSystem ? "msg-system-row" : isMe ? "msg-me-row" : "msg-them-row"}`}
                onMouseEnter={() => !isSystem && setHoveredMsg(msg.id)}
                onMouseLeave={() => setHoveredMsg(null)}
                onTouchStart={() => !isSystem && setHoveredMsg(msg.id)}
              >
                {isSystem ? (
                  <div className="system-msg">{msg.message}</div>
                ) : (
                  <div className={`bubble-wrap ${isMe ? "bubble-wrap-me" : ""}`}>

                    {/* Actions */}
                    {hoveredMsg === msg.id && !msg.deleted && (
                      <div className={`actions-bar ${isMe ? "actions-me" : "actions-them"}`}>
                        <button className="act-btn" onClick={() => startReply(msg)}>↩️</button>
                        {isMe && <>
                          <button className="act-btn" onClick={() => startEdit(msg)}>✏️</button>
                          <button className="act-btn" onClick={() => deleteMessage(msg.id)}>🗑️</button>
                        </>}
                      </div>
                    )}

                    {!isMe && <span className="sender-name" style={{ color: msg.color }}>{msg.username}</span>}

                    <div
                      className="bubble"
                      style={{
                        background: msg.deleted
                          ? "rgba(255,255,255,0.03)"
                          : isMe
                          ? `linear-gradient(135deg, ${msg.color || "#22d3ee"}22, ${msg.color || "#22d3ee"}11)`
                          : "rgba(255,255,255,0.05)",
                        border: msg.deleted
                          ? "1px solid rgba(255,255,255,0.05)"
                          : isMe
                          ? `1px solid ${msg.color || "#22d3ee"}44`
                          : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      }}
                      onDoubleClick={() => !msg.deleted && reactToMessage(msg.id)}
                    >
                      {msg.replyTo && !msg.deleted && (
                        <div className="reply-preview" onClick={() => scrollToMsg(msg.replyTo.id)}>
                          <span style={{ color: "#22d3ee", fontWeight: 600, fontSize: 11 }}>{msg.replyTo.username}</span>
                          <span className="reply-text">{msg.replyTo.message?.slice(0, 60)}{msg.replyTo.message?.length > 60 ? "…" : ""}</span>
                        </div>
                      )}

                      {msg.deleted ? <span className="deleted-text">This message was deleted</span> : (
                        <>
                          {msg.isImage && msg.fileUrl && <img src={msg.fileUrl} alt="img" className="msg-image" />}
                          {msg.fileUrl && !msg.isImage && <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="file-link">📎 {msg.fileName}</a>}
                          {msg.message && <div className="msg-text">{msg.message}</div>}
                        </>
                      )}

                      <div className="msg-meta">
                        {msg.edited && !msg.deleted && <span className="edited-tag">edited</span>}
                        <span className="msg-time">{new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>

                    {heartCount > 0 && (
                      <div className={`heart-badge ${isMe ? "heart-me" : "heart-them"}`}>
                        <span style={{ filter: iReacted ? "none" : "grayscale(0.5)", fontSize: 12 }}>❤️</span>
                        {heartCount > 1 && <span className="heart-count">{heartCount}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {typingUsers.length > 0 && (
            <div className="typing-row">
              <div className="typing-bubble">
                <span className="tdot" /><span className="tdot" /><span className="tdot" />
              </div>
              <span className="typing-text">{typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Banner */}
        {(replyTo || editingMsg) && (
          <div className="banner">
            <div className="banner-left">
              <span>{replyTo ? "↩️" : "✏️"}</span>
              <span className="banner-text">
                {replyTo
                  ? <><strong style={{ color: "#22d3ee" }}>{replyTo.username}</strong>: {replyTo.message?.slice(0, 40)}{replyTo.message?.length > 40 ? "…" : ""}</>
                  : "Editing message"
                }
              </span>
            </div>
            <button className="banner-close" onClick={cancelAction}>✕</button>
          </div>
        )}

        {/* Input */}
        <div className="input-area">
          <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.txt" />
          <button className="attach-btn" onClick={() => fileInputRef.current.click()}>{uploading ? "⏳" : "📎"}</button>
          <input
            ref={inputRef}
            className="chat-input"
            style={{ borderColor: editingMsg ? "#f59e0b55" : replyTo ? "#22d3ee55" : "rgba(255,255,255,0.08)" }}
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTyping(); }}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); if (e.key === "Escape") cancelAction(); }}
            placeholder={editingMsg ? "Edit your message..." : replyTo ? `Reply to ${replyTo.username}...` : "Type a message..."}
          />
          <button
            className="send-btn"
            style={{ background: editingMsg ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#22d3ee,#0e9daf)" }}
            onClick={() => sendMessage()}
          >
            {editingMsg ? "Save" : "➤"}
          </button>
        </div>
      </div>

      <style>{`
        .chat-wrapper {
          display: flex;
          height: 100vh;
          height: 100dvh;
          background: #020817;
          overflow: hidden;
          position: relative;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 240px;
          background: rgba(15,23,42,0.97);
          border-right: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease;
        }
        .sidebar-inner { padding: 20px 16px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; flex: 1; }
        .side-logo-row { display: flex; align-items: center; gap: 10px; }
        .side-logo { font-size: 20px; filter: drop-shadow(0 0 8px rgba(34,211,238,0.5)); }
        .side-appname { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 16px; color: #f0f9ff; flex: 1; }
        .sidebar-close { display: none; background: none; border: none; color: #64748b; font-size: 18px; cursor: pointer; padding: 4px; }
        .side-section { display: flex; flex-direction: column; gap: 8px; }
        .side-label { font-size: 10px; color: #334155; letter-spacing: 2px; font-weight: 700; }
        .room-code-box {
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 22px;
          letter-spacing: 6px; color: #22d3ee; text-align: center; padding: 12px;
          background: rgba(34,211,238,0.05); border: 1px solid rgba(34,211,238,0.15);
          border-radius: 10px; text-shadow: 0 0 20px rgba(34,211,238,0.3);
        }
        .copy-link-btn {
          background: rgba(34,211,238,0.07); border: 1px solid rgba(34,211,238,0.15);
          color: #22d3ee; border-radius: 8px; padding: 8px; cursor: pointer;
          font-size: 12px; font-weight: 600;
        }
        .user-list { display: flex; flex-direction: column; gap: 10px; }
        .user-row { display: flex; align-items: center; gap: 10px; }
        .avatar-wrap { position: relative; width: 28px; height: 28px; flex-shrink: 0; }
        .avatar-letter {
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #94a3b8;
        }
        .avatar-dot {
          position: absolute; bottom: 0; right: 0;
          width: 8px; height: 8px; border-radius: 50%;
          border: 2px solid #0f172a;
        }

        /* ── Header ── */
        .chat-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
        .chat-header {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(15,23,42,0.8);
          backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
        }
        .menu-btn {
          background: none; border: none; color: #64748b;
          font-size: 20px; cursor: pointer; padding: 4px 8px;
          border-radius: 6px; display: none;
          -webkit-tap-highlight-color: transparent;
        }
        .header-center { display: flex; align-items: center; gap: 8px; }
        .header-hash { font-size: 16px; color: #334155; font-weight: 700; }
        .header-room { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; color: #f0f9ff; }
        .header-dot-sep { width: 4px; height: 4px; border-radius: 50%; background: #334155; }
        .header-online { font-size: 12px; color: #22d3ee; }

        /* ── Messages ── */
        .messages-area {
          flex: 1; overflow-y: auto;
          padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .empty-state { margin: auto; text-align: center; opacity: 0.35; }
        .empty-icon { font-size: 40px; margin-bottom: 12px; filter: grayscale(1); }
        .empty-text { font-size: 15px; color: #64748b; font-weight: 600; }
        .empty-sub { font-size: 13px; color: #334155; margin-top: 4px; }
        .msg-row { display: flex; }
        .msg-system-row { justify-content: center; }
        .msg-me-row { justify-content: flex-end; }
        .msg-them-row { justify-content: flex-start; }
        .system-msg {
          font-size: 11px; color: #334155; padding: 4px 14px;
          background: rgba(255,255,255,0.03); border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .bubble-wrap {
          position: relative; max-width: 75%;
          display: flex; flex-direction: column; align-items: flex-start;
        }
        .bubble-wrap-me { align-items: flex-end; }
        .actions-bar {
          position: absolute; top: -36px;
          background: rgba(15,23,42,0.97);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 4px 8px;
          display: flex; gap: 2px; z-index: 10;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .actions-me { right: 0; }
        .actions-them { left: 0; }
        .act-btn { background: none; border: none; cursor: pointer; font-size: 13px; padding: 3px 5px; border-radius: 6px; }
        .sender-name { font-size: 11px; font-weight: 700; margin-bottom: 4px; padding-left: 4px; }
        .bubble { padding: 10px 14px; max-width: 100%; word-break: break-word; cursor: default; }
        .reply-preview {
          border-left: 2px solid #22d3ee; margin-bottom: 8px;
          cursor: pointer; display: flex; flex-direction: column; gap: 2px;
          background: rgba(34,211,238,0.05); border-radius: 0 6px 6px 0;
          padding: 4px 8px;
        }
        .reply-text { font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .deleted-text { font-size: 13px; color: #334155; font-style: italic; }
        .msg-text { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
        .msg-image { max-width: 100%; max-height: 200px; border-radius: 10px; display: block; margin-bottom: 4px; }
        .file-link { color: #22d3ee; text-decoration: none; font-size: 13px; }
        .msg-meta { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
        .edited-tag { font-size: 10px; color: #334155; font-style: italic; }
        .msg-time { font-size: 10px; color: #334155; margin-left: auto; }
        .heart-badge {
          position: absolute; bottom: -10px;
          background: rgba(15,23,42,0.97);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 2px 7px;
          display: flex; align-items: center; gap: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .heart-me { left: 8px; }
        .heart-them { right: 8px; }
        .heart-count { font-size: 11px; color: #64748b; font-weight: 600; }
        .typing-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
        .typing-bubble {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 6px 10px;
          display: flex; align-items: center;
        }
        .typing-text { font-size: 12px; color: #334155; }

        /* ── Banner ── */
        .banner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px;
          background: rgba(34,211,238,0.05);
          border-top: 1px solid rgba(34,211,238,0.1);
          flex-shrink: 0;
        }
        .banner-left { display: flex; align-items: center; gap: 10px; overflow: hidden; }
        .banner-text { font-size: 13px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .banner-close { background: none; border: none; color: #334155; cursor: pointer; font-size: 16px; flex-shrink: 0; }

        /* ── Input ── */
        .input-area {
          display: flex; gap: 8px; padding: 12px 14px;
          border-top: 1px solid rgba(255,255,255,0.05);
          background: rgba(15,23,42,0.9);
          backdrop-filter: blur(10px);
          align-items: center; flex-shrink: 0;
        }
        .attach-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 10px 11px;
          cursor: pointer; font-size: 15px; color: #64748b;
          flex-shrink: 0; -webkit-tap-highlight-color: transparent;
        }
        .chat-input {
          flex: 1; padding: 11px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid; border-radius: 12px;
          color: #e2e8f0; font-size: 14px; outline: none;
          transition: border-color 0.2s;
          font-family: 'DM Sans', sans-serif;
          min-width: 0; -webkit-appearance: none;
        }
        .chat-input:focus { border-color: #22d3ee88 !important; }
        .send-btn {
          padding: 11px 16px; border: none; border-radius: 12px;
          color: #020817; font-size: 14px; font-weight: 700;
          cursor: pointer; flex-shrink: 0;
          font-family: 'Syne', sans-serif;
          -webkit-tap-highlight-color: transparent;
          transition: opacity 0.2s;
        }
        .send-btn:active { opacity: 0.8; }

        /* ── Tablet (≤768px) ── */
        @media (max-width: 768px) {
          .sidebar {
            position: fixed; top: 0; left: 0;
            height: 100%; width: 260px; z-index: 100;
            transform: translateX(-100%);
          }
          .sidebar-open { transform: translateX(0) !important; }
          .sidebar-close { display: block; }
          .sidebar-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 99;
            backdrop-filter: blur(2px);
          }
          .menu-btn { display: block; }
          .bubble-wrap { max-width: 82%; }
          .messages-area { padding: 12px; }
        }

        /* ── Mobile (≤480px) ── */
        @media (max-width: 480px) {
          .chat-header { padding: 12px 12px; }
          .header-room { font-size: 14px; }
          .messages-area { padding: 10px 10px; gap: 8px; }
          .bubble { padding: 9px 12px; }
          .msg-text { font-size: 13px; }
          .bubble-wrap { max-width: 88%; }
          .input-area { padding: 10px 10px; gap: 6px; }
          .chat-input { padding: 10px 12px; font-size: 13px; }
          .send-btn { padding: 10px 14px; font-size: 13px; }
          .attach-btn { padding: 10px; }
        }
      `}</style>
    </div>
  );
}