import SERVER_URL from "../config";
import { useState, useEffect } from "react";


export default function Home({ setPage, setRoomId, setUsername }) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [createdRoom, setCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setJoinCode(room);
  }, []);

  const createRoom = async () => {
    if (!name.trim()) return setError("Enter your name first");
    setError("");
    const res = await fetch(`${SERVER_URL}/create-room`, { method: "POST" });
    const data = await res.json();
    setCreatedRoom(data.roomId);
  };

  const enterRoom = () => { setUsername(name); setRoomId(createdRoom); setPage("chat"); };

  const joinRoom = async () => {
    if (!name.trim()) return setError("Enter your name first");
    if (!joinCode.trim()) return setError("Enter a room code");
    const code = joinCode.trim().toUpperCase();
    const res = await fetch(`${SERVER_URL}/room/${code}`);
    if (res.ok) { setUsername(name); setRoomId(code); setPage("chat"); }
    else setError("Room not found. Check the code!");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${createdRoom}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="home-page">
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />

      <div className={`home-card ${mounted ? "mounted" : ""}`}>
        {/* Logo */}
        <div className="logo-row">
          <span className="logo-icon">🌌</span>
          <div>
            <h1 className="app-title">RuuSpace</h1>
            <p className="app-sub">Your space. Your people. Your vibe.</p>
          </div>
        </div>

        <div className="divider" />

        <label className="field-label">Your Name</label>
        <input
          className="field-input"
          placeholder="Enter your name..."
          value={name}
          onChange={e => { setName(e.target.value); setError(""); }}
        />

        {!createdRoom ? (
          <button className="btn-primary" onClick={createRoom}>
            ✦ Create New Room
          </button>
        ) : (
          <div className="created-box">
            <p className="created-label">✦ Room ready! Share with friends</p>
            <div className="code-display">{createdRoom}</div>
            <div className="link-display">{`${window.location.origin}?room=${createdRoom}`}</div>
            <div className="btn-row">
              <button className="btn-copy" onClick={copyLink}>
                {copied ? "✅ Copied!" : "📋 Copy Link"}
              </button>
              <button className="btn-enter" onClick={enterRoom}>Enter →</button>
            </div>
          </div>
        )}

        <div className="or-divider"><span className="or-text">or join existing</span></div>

        <label className="field-label">Room Code</label>
        <input
          className="field-input"
          placeholder="e.g. A3X9KL"
          value={joinCode}
          onChange={e => { setJoinCode(e.target.value); setError(""); }}
        />

        <button className="btn-secondary" onClick={joinRoom}>🔗 Join Room</button>

        {error && <div className="error-box">⚠ {error}</div>}
      </div>

      <style>{`
        .home-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #020817;
          padding: 16px;
          position: relative;
          overflow: hidden;
        }
        .orb {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
        }
        .orb1 {
          width: min(500px, 80vw); height: min(500px, 80vw);
          background: radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%);
          top: -100px; left: -100px;
          animation: float1 8s ease-in-out infinite;
        }
        .orb2 {
          width: min(400px, 60vw); height: min(400px, 60vw);
          background: radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%);
          bottom: -80px; right: -80px;
          animation: float2 10s ease-in-out infinite;
        }
        .orb3 {
          width: min(300px, 50vw); height: min(300px, 50vw);
          background: radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 70%);
          top: 50%; right: 20%;
          animation: float3 12s ease-in-out infinite;
        }
        .home-card {
          width: 100%;
          max-width: 420px;
          background: rgba(15,23,42,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(34,211,238,0.1);
          border-radius: 20px;
          padding: 32px 28px;
          box-shadow: 0 0 60px rgba(34,211,238,0.05), 0 25px 50px rgba(0,0,0,0.5);
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .home-card.mounted {
          opacity: 1;
          transform: translateY(0);
        }
        .logo-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }
        .logo-icon {
          font-size: clamp(28px, 6vw, 36px);
          filter: drop-shadow(0 0 12px rgba(34,211,238,0.5));
        }
        .app-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(20px, 5vw, 26px);
          font-weight: 800;
          color: #f0f9ff;
          letter-spacing: -0.5px;
        }
        .app-sub {
          font-size: clamp(10px, 2.5vw, 12px);
          color: #475569;
          margin-top: 2px;
          letter-spacing: 0.5px;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(34,211,238,0.15), transparent);
          margin-bottom: 24px;
        }
        .field-label {
          display: block;
          font-size: 11px;
          color: #64748b;
          letter-spacing: 1.5px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .field-input {
          display: block;
          width: 100%;
          padding: 12px 16px;
          margin-bottom: 14px;
          background: rgba(15,23,42,0.8);
          border: 1px solid #1e293b;
          border-radius: 10px;
          color: #e2e8f0;
          font-size: clamp(13px, 3.5vw, 15px);
          outline: none;
          transition: border-color 0.2s;
          font-family: 'DM Sans', sans-serif;
          -webkit-appearance: none;
        }
        .field-input:focus { border-color: #22d3ee; }
        .btn-primary {
          width: 100%;
          padding: 13px;
          margin-bottom: 6px;
          background: linear-gradient(135deg, #22d3ee, #0e9daf);
          color: #020817;
          border: none;
          border-radius: 10px;
          font-size: clamp(13px, 3.5vw, 14px);
          font-weight: 700;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          letter-spacing: 0.5px;
          transition: opacity 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .btn-primary:active { opacity: 0.85; }
        .btn-secondary {
          width: 100%;
          padding: 13px;
          background: transparent;
          color: #22d3ee;
          border: 1px solid #1e3a52;
          border-radius: 10px;
          font-size: clamp(13px, 3.5vw, 14px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
          -webkit-tap-highlight-color: transparent;
        }
        .btn-secondary:active { background: #0c2d3a; border-color: #22d3ee; }
        .created-box {
          background: rgba(34,211,238,0.04);
          border: 1px solid rgba(34,211,238,0.15);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 6px;
        }
        .created-label {
          font-size: 12px;
          color: #22d3ee;
          font-weight: 600;
          margin-bottom: 10px;
          letter-spacing: 0.5px;
        }
        .code-display {
          font-family: 'Syne', sans-serif;
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 800;
          letter-spacing: clamp(4px, 2vw, 8px);
          color: #22d3ee;
          text-align: center;
          margin-bottom: 8px;
          text-shadow: 0 0 20px rgba(34,211,238,0.4);
        }
        .link-display {
          font-size: 11px;
          color: #475569;
          word-break: break-all;
          background: rgba(0,0,0,0.3);
          padding: 6px 10px;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .btn-row { display: flex; gap: 8px; }
        .btn-copy {
          flex: 1;
          padding: 9px 6px;
          background: #0c2d3a;
          color: #22d3ee;
          border: 1px solid rgba(34,211,238,0.2);
          border-radius: 8px;
          cursor: pointer;
          font-size: clamp(11px, 3vw, 12px);
          font-weight: 600;
          transition: background 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .btn-enter {
          flex: 1;
          padding: 9px 6px;
          background: linear-gradient(135deg, #22d3ee, #0e9daf);
          color: #020817;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: clamp(12px, 3vw, 13px);
          font-weight: 700;
          font-family: 'Syne', sans-serif;
          -webkit-tap-highlight-color: transparent;
        }
        .or-divider {
          display: flex;
          align-items: center;
          margin: 20px 0 16px;
          gap: 12px;
        }
        .or-divider::before, .or-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #1e293b;
        }
        .or-text { font-size: 11px; color: #334155; white-space: nowrap; }
        .error-box {
          margin-top: 12px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          color: #f87171;
          font-size: 13px;
        }

        /* Tablet */
        @media (max-width: 768px) {
          .home-card { padding: 28px 22px; border-radius: 16px; }
        }
        /* Mobile */
        @media (max-width: 480px) {
          .home-page { align-items: flex-end; padding: 0; }
          .home-card {
            max-width: 100%;
            border-radius: 24px 24px 0 0;
            padding: 28px 20px 36px;
            border-bottom: none;
          }
        }
      `}</style>
    </div>
  );
}