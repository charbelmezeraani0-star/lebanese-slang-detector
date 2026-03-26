import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, storage } from "./firebase";
import {
  collection, addDoc, onSnapshot,
  query, orderBy, getDocs, deleteDoc, doc,
  setDoc, updateDoc, arrayUnion, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import axios from "axios";
import { useTheme } from "./ThemeContext";

const API_BASE = "http://127.0.0.1:8000";

// ===== Avatar helpers =====
const AVATAR_COLORS = [
  "#e57373","#f06292","#ba68c8","#64b5f6","#4db6ac",
  "#81c784","#ffb74d","#ff8a65","#a1887f","#90a4ae",
];
function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function avatarInitial(name) {
  return name ? name[0].toUpperCase() : "?";
}

// ===== Notification sound =====
function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

// ===== Emoji picker options =====
const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "🚨"];

function Chat({ username }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  const bottomRef = useRef(null);
  const prevCountRef = useRef(0);
  const typingTimerRef = useRef(null);
  const onlineIntervalRef = useRef(null);
  const fileRef = useRef(null);
  const observerRef = useRef(null);
  const longPressTimerRef = useRef(null);

  // ===== Colors based on dark mode =====
  const bgPage = dark ? "#1a1a2e" : "#e5ddd5";
  const bgBubbleMe = dark ? "#1e3a4a" : "#dcf8c6";
  const bgBubbleOther = dark ? "#2d2d44" : "#fff";
  const textColor = dark ? "#eee" : "#111";
  const inputBarBg = dark ? "#16213e" : "#f0f0f0";
  const inputBg = dark ? "#0f3460" : "#fff";
  const inputBorder = dark ? "#444" : "#ccc";
  const searchBarBg = dark ? "#16213e" : "#f0f0f0";
  const timestampColor = dark ? "#888" : "#aaa";

  // ===== API health check =====
  useEffect(() => {
    axios.get(`${API_BASE}/health`, { timeout: 3000 })
      .then(() => setApiStatus("connected"))
      .catch(() => setApiStatus("offline"));
  }, []);

  // ===== Online presence: join =====
  const writeOnline = useCallback(async () => {
    if (!roomId || !username) return;
    try {
      await setDoc(doc(db, "rooms", roomId, "online", username), {
        name: username,
        ts: Date.now(),
      });
    } catch {}
  }, [roomId, username]);

  useEffect(() => {
    writeOnline();
    onlineIntervalRef.current = setInterval(writeOnline, 30000);
    return () => {
      clearInterval(onlineIntervalRef.current);
      if (roomId && username) {
        deleteDoc(doc(db, "rooms", roomId, "online", username)).catch(() => {});
      }
    };
  }, [roomId, username, writeOnline]);

  // ===== Online users listener =====
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(collection(db, "rooms", roomId, "online"), snapshot => {
      const now = Date.now();
      const active = snapshot.docs
        .map(d => d.data())
        .filter(u => u.ts && now - u.ts < 60000);
      setOnlineUsers(active);
    });
    return () => unsub();
  }, [roomId]);

  // ===== Realtime messages listener =====
  useEffect(() => {
    if (!roomId) return;
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("timestamp")
    );
    const unsub = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length > prevCountRef.current) {
        const newMsgs = list.slice(prevCountRef.current);
        newMsgs.forEach(m => {
          if (m.label !== "NORMAL" && m.sender !== username) playAlert();
        });
      }
      prevCountRef.current = list.length;
      setMessages(list);
    });
    return () => unsub();
  }, [roomId, username]);

  // ===== Auto-scroll =====
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ===== Typing indicator listener =====
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(collection(db, "rooms", roomId, "typing"), snapshot => {
      const now = Date.now();
      const active = snapshot.docs
        .map(d => d.data())
        .filter(u => u.name !== username && u.ts && now - u.ts < 5000);
      setTypingUsers(active.map(u => u.name));
    });
    return () => unsub();
  }, [roomId, username]);

  // ===== Intersection Observer for read receipts =====
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const msgId = entry.target.dataset.msgid;
            const sender = entry.target.dataset.sender;
            if (msgId && sender !== username) {
              updateDoc(doc(db, "rooms", roomId, "messages", msgId), {
                readBy: arrayUnion(username),
              }).catch(() => {});
            }
          }
        });
      },
      { threshold: 0.5 }
    );
    return () => observerRef.current?.disconnect();
  }, [roomId, username]);

  const attachObserver = useCallback((el) => {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  }, []);

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ===== Typing state management =====
  const handleTyping = async (val) => {
    setMessage(val);
    if (!roomId || !username) return;
    clearTimeout(typingTimerRef.current);
    if (val.trim()) {
      try {
        await setDoc(doc(db, "rooms", roomId, "typing", username), {
          name: username,
          ts: Date.now(),
        });
      } catch {}
      typingTimerRef.current = setTimeout(async () => {
        try {
          await deleteDoc(doc(db, "rooms", roomId, "typing", username));
        } catch {}
      }, 4000);
    } else {
      try {
        await deleteDoc(doc(db, "rooms", roomId, "typing", username));
      } catch {}
    }
  };

  const clearTyping = async () => {
    clearTimeout(typingTimerRef.current);
    try {
      await deleteDoc(doc(db, "rooms", roomId, "typing", username));
    } catch {}
  };

  // ===== Send message =====
  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    await clearTyping();

    let analysis = { label: "NORMAL", confidence: 0, unverified: false };
    try {
      const res = await axios.post(`${API_BASE}/analyze`, { text: message }, { timeout: 3000 });
      analysis.label = res.data.label || "NORMAL";
      analysis.confidence = res.data.confidence || 0;
    } catch {
      analysis.unverified = true;
    }

    await addDoc(collection(db, "rooms", roomId, "messages"), {
      sender: username,
      text: message,
      label: analysis.label,
      confidence: analysis.confidence,
      unverified: analysis.unverified,
      timestamp: Date.now(),
      readBy: [],
      reactions: {},
    });

    setMessage("");
    setSending(false);
  };

  // ===== Image upload =====
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    const storageRef = ref(storage, `rooms/${roomId}/images/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on("state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(pct);
      },
      () => { setUploadProgress(null); alert("Upload failed."); },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setUploadProgress(null);
        await addDoc(collection(db, "rooms", roomId, "messages"), {
          sender: username,
          text: "📷 Image",
          imageUrl: url,
          label: "NORMAL",
          confidence: 0,
          unverified: false,
          timestamp: Date.now(),
          readBy: [],
          reactions: {},
        });
      }
    );
  };

  // ===== Clear chat =====
  const clearChat = async () => {
    if (!window.confirm("Clear all messages in this room?")) return;
    const snap = await getDocs(collection(db, "rooms", roomId, "messages"));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "rooms", roomId, "messages", d.id))));
  };

  // ===== Reactions =====
  const handleReaction = async (msgId, emoji) => {
    setReactionPickerMsgId(null);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const current = (msg.reactions || {})[emoji] || [];
    const updatedUsers = current.includes(username)
      ? current.filter(u => u !== username)
      : [...current, username];
    const msgRef = doc(db, "rooms", roomId, "messages", msgId);
    await updateDoc(msgRef, { [`reactions.${emoji}`]: updatedUsers }).catch(() => {});
  };

  // ===== Long press handlers =====
  const handleLongPressStart = (msgId) => {
    longPressTimerRef.current = setTimeout(() => {
      setReactionPickerMsgId(msgId);
    }, 500);
  };
  const handleLongPressEnd = () => {
    clearTimeout(longPressTimerRef.current);
  };

  // ===== Filter messages by search =====
  const displayed = searchQuery.trim()
    ? messages.filter(m =>
        m.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const statusColor = apiStatus === "connected" ? "#a8f0a8"
    : apiStatus === "offline" ? "#ffaaaa" : "#ffe4aa";

  const typingText = (() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
  })();

  const visibleOnline = onlineUsers.slice(0, 5);
  const extraOnline = onlineUsers.length - 5;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: bgPage, fontFamily: "Arial, sans-serif", transition: "background 0.3s" }}
      onClick={() => reactionPickerMsgId && setReactionPickerMsgId(null)}
    >
      {/* HEADER */}
      <div style={{ padding: "12px 15px", background: "linear-gradient(135deg, #128C7E 0%, #075e54 100%)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer", padding: "0 6px" }} onClick={() => navigate("/")}>←</button>
          <div>
            <div style={{ fontWeight: "bold", fontSize: "16px" }}>Group Chat</div>
            <div style={{ fontSize: "11px", color: statusColor, opacity: 0.95 }}>
              API: {apiStatus === "connected" ? "Connected" : apiStatus === "offline" ? "Offline" : "Checking..."}
            </div>
          </div>
        </div>

        {/* Online avatars */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {visibleOnline.map((u, i) => (
            <div key={i} title={u.name} style={{ width: "28px", height: "28px", borderRadius: "50%", background: avatarColor(u.name), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", fontSize: "12px", border: "2px solid rgba(255,255,255,0.5)", marginLeft: i > 0 ? "-6px" : 0, zIndex: visibleOnline.length - i }}>
              {avatarInitial(u.name)}
            </div>
          ))}
          {extraOnline > 0 && (
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: "bold", marginLeft: "-6px" }}>
              +{extraOnline}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button style={{ background: "none", border: "none", fontSize: "16px", cursor: "pointer", padding: "4px" }} onClick={toggle} title="Toggle theme">
            {dark ? "☀️" : "🌙"}
          </button>
          <button style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px" }} onClick={() => setShowSearch(s => !s)} title="Search">🔍</button>
          <button style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px" }} onClick={() => navigate("/admin")} title="Admin">📊</button>
          <button style={{ background: "#ff4444", border: "none", color: "#fff", padding: "6px 12px", borderRadius: "15px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }} onClick={clearChat}>Clear</button>
        </div>
      </div>

      {/* SEARCH BAR */}
      {showSearch && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: searchBarBg, borderBottom: `1px solid ${inputBorder}` }}>
          <input
            style={{ flex: 1, padding: "8px 14px", borderRadius: "20px", border: `1px solid ${inputBorder}`, outline: "none", fontSize: "13px", background: inputBg, color: textColor }}
            placeholder="Search messages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <span style={{ fontSize: "12px", color: timestampColor, whiteSpace: "nowrap" }}>
              {displayed.length} result{displayed.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div style={{ background: "#128C7E", color: "#fff", padding: "6px 16px", fontSize: "12px", textAlign: "center" }}>
          Uploading image... {uploadProgress}%
        </div>
      )}

      {/* CHAT WINDOW */}
      <div style={{ flex: 1, padding: "15px", overflowY: "auto" }}>
        {displayed.map((msg) => {
          const isMe = msg.sender === username;
          const suspicious = msg.label !== "NORMAL";
          const color = avatarColor(msg.sender || "");
          const reactions = msg.reactions || {};
          const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);
          const readBy = msg.readBy || [];
          const readByOthers = readBy.filter(u => u !== username);
          const isRead = readByOthers.length > 0;

          return (
            <div
              key={msg.id}
              data-msgid={msg.id}
              data-sender={msg.sender}
              ref={attachObserver}
              style={{ display: "flex", alignItems: "flex-end", marginBottom: "10px", gap: "8px", justifyContent: isMe ? "flex-end" : "flex-start" }}
            >
              {!isMe && (
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: `linear-gradient(135deg, ${color}, ${color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", fontSize: "14px", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>
                  {avatarInitial(msg.sender)}
                </div>
              )}

              <div style={{ position: "relative", maxWidth: "65%" }}>
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isMe ? bgBubbleMe : bgBubbleOther,
                    borderLeft: suspicious ? "4px solid #f44336" : "none",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                    cursor: "context-menu",
                    userSelect: "none",
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setReactionPickerMsgId(msg.id); }}
                  onTouchStart={() => handleLongPressStart(msg.id)}
                  onTouchEnd={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart(msg.id)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                >
                  {!isMe && (
                    <div style={{ fontSize: "12px", fontWeight: "bold", color: color, marginBottom: "3px" }}>{msg.sender}</div>
                  )}

                  {msg.imageUrl ? (
                    <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={msg.imageUrl} alt="shared" style={{ maxWidth: "200px", borderRadius: "10px", cursor: "pointer", display: "block" }} />
                    </a>
                  ) : (
                    <div style={{ fontSize: "14px", lineHeight: "1.4", color: textColor }}>{msg.text}</div>
                  )}

                  {msg.unverified && (
                    <div style={{ color: "#999", fontSize: "10px", fontStyle: "italic", marginTop: "4px" }}>(unverified)</div>
                  )}
                  {suspicious && !msg.unverified && (
                    <div style={{ color: "#c62828", fontSize: "11px", fontWeight: "bold", marginTop: "5px" }}>
                      🚨 {msg.label} ({(msg.confidence * 100).toFixed(0)}%)
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "4px" }}>
                    <div style={{ fontSize: "10px", color: timestampColor }}>{formatTime(msg.timestamp)}</div>
                    {isMe && (
                      <span style={{ fontSize: "11px", color: isRead ? "#4fc3f7" : timestampColor }}>
                        {isRead ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reaction counts */}
                {reactionEntries.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                    {reactionEntries.map(([emoji, users]) => (
                      <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }}
                        style={{
                          background: users.includes(username) ? (dark ? "#1e3a5a" : "#e8f5e9") : (dark ? "#2d2d44" : "#f0f0f0"),
                          border: `1px solid ${users.includes(username) ? "#128C7E" : (dark ? "#444" : "#ddd")}`,
                          borderRadius: "12px",
                          padding: "2px 8px",
                          cursor: "pointer",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                          color: textColor,
                        }}
                      >
                        {emoji} <span style={{ fontSize: "11px" }}>{users.length}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Reaction picker */}
                {reactionPickerMsgId === msg.id && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      [isMe ? "right" : "left"]: 0,
                      background: dark ? "#16213e" : "#fff",
                      border: `1px solid ${dark ? "#444" : "#ddd"}`,
                      borderRadius: "28px",
                      padding: "8px 12px",
                      display: "flex",
                      gap: "8px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                      zIndex: 100,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", padding: "2px", borderRadius: "50%", transition: "transform 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.3)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {displayed.length === 0 && searchQuery && (
          <div style={{ textAlign: "center", color: "#999", fontSize: "13px", padding: "30px 0" }}>
            No messages match "{searchQuery}"
          </div>
        )}

        {/* Typing indicator */}
        {typingText && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px", opacity: 0.8 }}>
            <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#128C7E", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <span style={{ fontSize: "12px", color: dark ? "#aaa" : "#666", fontStyle: "italic" }}>{typingText}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* INPUT BAR */}
      <div style={{ display: "flex", padding: "10px", background: inputBarBg, alignItems: "center", gap: "8px" }}>
        <input
          type="file"
          accept="image/*"
          hidden
          ref={fileRef}
          onChange={handleImageSelect}
        />
        <button
          style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", padding: "4px", color: dark ? "#aaa" : "#888", flexShrink: 0 }}
          onClick={() => fileRef.current?.click()}
          title="Share image"
        >
          📎
        </button>
        <input
          style={{ flex: 1, padding: "10px 14px", borderRadius: "20px", outline: "none", border: `1px solid ${inputBorder}`, fontSize: "14px", background: inputBg, color: textColor }}
          placeholder="Type a message..."
          value={message}
          disabled={sending}
          onChange={e => handleTyping(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
        />
        <button
          style={{
            background: sending ? "#aaa" : "linear-gradient(135deg, #128C7E, #075e54)",
            color: "#fff",
            border: "none",
            padding: "10px 18px",
            borderRadius: "20px",
            cursor: sending ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "bold",
            flexShrink: 0,
            transition: "background 0.2s, transform 0.1s",
            transform: sending ? "scale(0.95)" : "scale(1)",
          }}
          onClick={sendMessage}
          disabled={sending}
        >
          {sending ? "..." : "Send ➤"}
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

export default Chat;
