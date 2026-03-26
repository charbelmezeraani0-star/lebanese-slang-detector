import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { useTheme } from "./ThemeContext";

function timeAgo(ts) {
  if (!ts) return "";
  const seconds = Math.floor((Date.now() - (ts.seconds ? ts.seconds * 1000 : ts)) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function RoomSelector({ username, onSetUsername }) {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [nameInput, setNameInput] = useState(username || "");
  const [creating, setCreating] = useState(false);
  const [msgCounts, setMsgCounts] = useState({});
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "rooms"), snapshot => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setRooms(list);

      // Fetch message counts for each room
      list.forEach(async (room) => {
        try {
          const snap = await getDocs(collection(db, "rooms", room.id, "messages"));
          setMsgCounts(prev => ({ ...prev, [room.id]: snap.size }));
        } catch {
          // ignore
        }
      });
    });
    return () => unsub();
  }, []);

  const handleJoinRoom = (roomId) => {
    if (!nameInput.trim()) return alert("Please enter your name first.");
    onSetUsername(nameInput.trim());
    navigate(`/room/${roomId}`);
  };

  const handleCreateRoom = async () => {
    if (!nameInput.trim()) return alert("Please enter your name first.");
    if (!newRoomName.trim()) return alert("Please enter a room name.");
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, "rooms"), {
        name: newRoomName.trim(),
        createdBy: nameInput.trim(),
        createdAt: serverTimestamp(),
      });
      onSetUsername(nameInput.trim());
      navigate(`/room/${docRef.id}`);
    } catch (e) {
      alert("Failed to create room. Try again.");
    }
    setCreating(false);
  };

  const bg = dark ? "#1a1a2e" : "#e5ddd5";
  const cardBg = dark ? "#16213e" : "#fff";
  const textPrimary = dark ? "#eee" : "#222";
  const textSecondary = dark ? "#aaa" : "#555";
  const inputBg = dark ? "#0f3460" : "#fff";
  const inputBorder = dark ? "#444" : "#ddd";
  const inputColor = dark ? "#eee" : "#222";
  const roomCardBg = dark ? "#0f3460" : "#f7f7f7";
  const roomCardHoverBg = dark ? "#1a4a7a" : "#edf7f5";

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif", padding: "20px", transition: "background 0.3s" }}>
      <div style={{ background: cardBg, borderRadius: "20px", width: "100%", maxWidth: "480px", boxShadow: dark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.14)", overflow: "hidden", transition: "background 0.3s" }}>

        {/* Gradient Header */}
        <div style={{ background: "linear-gradient(135deg, #128C7E 0%, #075e54 100%)", padding: "32px 28px 24px", position: "relative" }}>
          <button
            onClick={toggle}
            style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <div style={{ fontSize: "28px", marginBottom: "6px" }}>💬</div>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", color: "#fff", fontWeight: "bold" }}>Lebanese Slang Detector</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.8)" }}>Real-time Chat Moderation</p>
        </div>

        <div style={{ padding: "28px" }}>
          {/* Name Input */}
          <input
            style={{ width: "100%", padding: "11px 16px", borderRadius: "24px", border: `1.5px solid ${inputBorder}`, outline: "none", fontSize: "14px", marginBottom: "20px", boxSizing: "border-box", background: inputBg, color: inputColor, transition: "border 0.2s" }}
            placeholder="Your name..."
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
          />

          {/* Create Room */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "11px", color: "#25D366", fontWeight: "bold", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>Create a New Room</h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                style={{ flex: 1, padding: "11px 16px", borderRadius: "24px", border: `1.5px solid ${inputBorder}`, outline: "none", fontSize: "14px", background: inputBg, color: inputColor, boxSizing: "border-box" }}
                placeholder="Room name..."
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateRoom()}
              />
              <button
                style={{ background: "linear-gradient(135deg, #128C7E, #075e54)", color: "#fff", border: "none", padding: "11px 20px", borderRadius: "24px", cursor: creating ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "bold", whiteSpace: "nowrap", opacity: creating ? 0.7 : 1 }}
                onClick={handleCreateRoom}
                disabled={creating}
              >
                {creating ? "..." : "Create"}
              </button>
            </div>
          </div>

          {/* Room List */}
          <div>
            <h3 style={{ fontSize: "11px", color: "#25D366", fontWeight: "bold", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>Join a Room</h3>
            {rooms.length === 0 ? (
              <p style={{ color: textSecondary, fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No rooms yet. Create one above!</p>
            ) : (
              rooms.map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  msgCount={msgCounts[room.id] || 0}
                  onJoin={() => handleJoinRoom(room.id)}
                  dark={dark}
                  roomCardBg={roomCardBg}
                  roomCardHoverBg={roomCardHoverBg}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                />
              ))
            )}
          </div>

          {/* Admin Button */}
          <button
            style={{ marginTop: "20px", width: "100%", background: "none", border: `1.5px solid ${inputBorder}`, color: textSecondary, padding: "10px", borderRadius: "24px", cursor: "pointer", fontSize: "13px", transition: "border-color 0.2s" }}
            onClick={() => navigate("/admin")}
          >
            📊 Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomCard({ room, msgCount, onJoin, dark, roomCardBg, roomCardHoverBg, textPrimary, textSecondary }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 14px",
        background: hovered ? roomCardHoverBg : roomCardBg,
        borderRadius: "14px",
        marginBottom: "8px",
        cursor: "pointer",
        transition: "background 0.2s, transform 0.15s",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "0 4px 12px rgba(18,140,126,0.15)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #128C7E, #25D366)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", fontSize: "18px", flexShrink: 0 }}>
          {room.name ? room.name[0].toUpperCase() : "#"}
        </div>
        <div>
          <div style={{ fontWeight: "bold", fontSize: "14px", color: textPrimary }}>{room.name}</div>
          <div style={{ fontSize: "11px", color: textSecondary, marginTop: "2px" }}>
            by {room.createdBy || "unknown"} &bull; {timeAgo(room.createdAt)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {msgCount > 0 && (
          <div style={{ background: "#25D366", color: "#fff", borderRadius: "12px", padding: "2px 8px", fontSize: "11px", fontWeight: "bold", minWidth: "22px", textAlign: "center" }}>
            {msgCount}
          </div>
        )}
        <button
          style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "#fff", border: "none", padding: "7px 16px", borderRadius: "15px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap" }}
          onClick={onJoin}
        >
          Join
        </button>
      </div>
    </div>
  );
}

export default RoomSelector;
