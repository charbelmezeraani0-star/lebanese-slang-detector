import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc
} from "firebase/firestore";
import axios from "axios";

const ROOM_ID = "rooms_123";

function Chat() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);

  // ================= REALTIME LISTENER =================
  useEffect(() => {
    if (!joined) return;

    const q = query(
      collection(db, "rooms", ROOM_ID, "messages"),
      orderBy("timestamp")
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => doc.data());
      setMessages(list);
    });

    return () => unsubscribe();
  }, [joined]);

  // ================= JOIN ROOM =================
  const handleJoin = (e) => {
    if (e.key === "Enter" && username.trim()) {
      setJoined(true);
    }
  };

  // ================= SEND MESSAGE =================
  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);

    let analysis = { label: "NORMAL", confidence: 0 };

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/analyze",
        { text: message },
        { timeout: 3000 }
      );

      analysis.label = res.data.label || "NORMAL";
      analysis.confidence = res.data.confidence || 0;
    } catch {}

    await addDoc(collection(db, "rooms", ROOM_ID, "messages"), {
      sender: username,
      text: message,
      label: analysis.label,
      confidence: analysis.confidence,
      timestamp: Date.now()
    });

    setMessage("");
    setSending(false);
  };

  // ================= CLEAR CHAT =================
  const clearChat = async () => {
    if (!window.confirm("Are you sure you want to clear the chat?")) return;

    const messagesRef = collection(db, "rooms", ROOM_ID, "messages");
    const snapshot = await getDocs(messagesRef);

    const deletions = snapshot.docs.map(d =>
      deleteDoc(doc(db, "rooms", ROOM_ID, "messages", d.id))
    );

    await Promise.all(deletions);
  };

  // ================= JOIN SCREEN =================
  if (!joined) {
    return (
      <div style={styles.joinContainer}>
        <h2>Join Chat Room</h2>
        <input
          style={styles.joinInput}
          placeholder="Enter your name and press Enter..."
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={handleJoin}
        />
      </div>
    );
  }

  // ================= CHAT UI =================
  return (
    <div style={styles.chatPage}>
      {/* HEADER WITH CLEAR BUTTON */}
      <div style={styles.header}>
        <span>Group Chat</span>
        <button style={styles.clearBtn} onClick={clearChat}>
          🗑 Clear
        </button>
      </div>

      <div style={styles.chatWindow}>
        {messages.map((msg, index) => {
          const isMe = msg.sender === username;
          const suspicious = msg.label !== "NORMAL";

          return (
            <div
              key={index}
              style={{
                ...styles.messageRow,
                justifyContent: isMe ? "flex-end" : "flex-start"
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  background: isMe ? "#dcf8c6" : "#ffffff",
                  borderLeft: suspicious ? "5px solid red" : "none"
                }}
              >
                <div style={styles.sender}>{msg.sender}</div>
                <div>{msg.text}</div>

                {suspicious && (
                  <div style={styles.warning}>
                    🚨 {msg.label} ({(msg.confidence * 100).toFixed(1)}%)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.inputBar}>
        <input
          style={styles.textInput}
          placeholder="Type a message..."
          value={message}
          disabled={sending}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
        />
        <button style={styles.sendBtn} onClick={sendMessage}>
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  joinContainer: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial",
    background: "#e5ddd5"
  },
  joinInput: {
    padding: "12px",
    width: "260px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    outline: "none"
  },

  chatPage: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#e5ddd5",
    fontFamily: "Arial"
  },
  header: {
    padding: "15px",
    background: "#075e54",
    color: "white",
    fontWeight: "bold",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  clearBtn: {
    background: "#ff4444",
    border: "none",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: "15px",
    cursor: "pointer",
    fontSize: "12px"
  },
  chatWindow: {
    flex: 1,
    padding: "15px",
    overflowY: "auto"
  },
  messageRow: {
    display: "flex",
    marginBottom: "10px"
  },
  bubble: {
    padding: "10px",
    borderRadius: "10px",
    maxWidth: "65%",
    boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
  },
  sender: {
    fontSize: "12px",
    fontWeight: "bold",
    marginBottom: "4px"
  },
  warning: {
    color: "red",
    fontSize: "11px",
    marginTop: "5px"
  },
  inputBar: {
    display: "flex",
    padding: "10px",
    background: "#f0f0f0"
  },
  textInput: {
    flex: 1,
    padding: "10px",
    borderRadius: "20px",
    outline: "none",
    border: "1px solid #ccc"
  },
  sendBtn: {
    marginLeft: "10px",
    background: "#075e54",
    color: "white",
    border: "none",
    padding: "10px 15px",
    borderRadius: "20px",
    cursor: "pointer"
  }
};

export default Chat;
