import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { collectionGroup, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { useTheme } from "./ThemeContext";

const LABEL_COLORS = {
  "NORMAL": "#25d366",
  "WEED SLANG": "#8bc34a",
  "PILLS SLANG": "#ff9800",
  "COCAINE SLANG": "#9c27b0",
  "WEAPONS SLANG": "#f44336",
};

function AdminDashboard() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  useEffect(() => {
    const q = query(collectionGroup(db, "messages"), orderBy("timestamp", "desc"), limit(200));
    const unsub = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => doc.data());
      setMessages(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const flagged = messages.filter(m => m.label !== "NORMAL");

  const counts = {
    "NORMAL": 0,
    "WEED SLANG": 0,
    "PILLS SLANG": 0,
    "COCAINE SLANG": 0,
    "WEAPONS SLANG": 0,
  };
  messages.forEach(m => {
    if (counts[m.label] !== undefined) counts[m.label]++;
  });

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const exportCSV = () => {
    const rows = [["Timestamp", "Sender", "Text", "Label", "Confidence"]];
    flagged.forEach(m => {
      rows.push([
        new Date(m.timestamp).toISOString(),
        m.sender || "",
        (m.text || "").replace(/,/g, ";"),
        m.label || "",
        m.confidence ? (m.confidence * 100).toFixed(1) + "%" : ""
      ]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flagged_messages_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dark mode colors
  const bgPage = dark ? "#1a1a2e" : "#f4f4f4";
  const cardBg = dark ? "#16213e" : "#fff";
  const textPrimary = dark ? "#eee" : "#333";
  const textSecondary = dark ? "#aaa" : "#888";
  const borderColor = dark ? "#333" : "#eee";
  const flaggedRowBg = dark ? "#2a1a1a" : "#fff5f5";
  const barTrackBg = dark ? "#2d2d44" : "#eee";

  return (
    <div style={{ minHeight: "100vh", background: bgPage, fontFamily: "Arial, sans-serif", transition: "background 0.3s" }}>
      {/* Gradient Header */}
      <div style={{ background: "linear-gradient(135deg, #128C7E 0%, #075e54 100%)", color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.25)" }}>
        <button
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.5)", color: "#fff", padding: "6px 14px", borderRadius: "15px", cursor: "pointer", fontSize: "13px" }}
          onClick={() => navigate("/")}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "bold" }}>Admin Dashboard</h2>
          <div style={{ fontSize: "12px", opacity: 0.75, marginTop: "2px" }}>Last 200 messages</div>
        </div>
        <button
          onClick={toggle}
          style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: "36px", height: "36px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "8px" }}
          title="Toggle theme"
        >
          {dark ? "☀️" : "🌙"}
        </button>
        <button
          onClick={exportCSV}
          disabled={flagged.length === 0}
          style={{ background: flagged.length === 0 ? "rgba(255,255,255,0.2)" : "#25D366", border: "none", color: "#fff", padding: "8px 16px", borderRadius: "20px", cursor: flagged.length === 0 ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap" }}
        >
          ⬇ Export CSV
        </button>
      </div>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "24px 16px" }}>
        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "24px" }}>
          <div style={{ background: cardBg, borderRadius: "14px", padding: "20px", textAlign: "center", boxShadow: dark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.08)", transition: "background 0.3s" }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#128C7E" }}>{messages.length}</div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "4px" }}>Total Messages</div>
          </div>
          <div style={{ background: cardBg, borderRadius: "14px", padding: "20px", textAlign: "center", boxShadow: dark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.08)", transition: "background 0.3s" }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#f44336" }}>{flagged.length}</div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "4px" }}>Flagged</div>
          </div>
          <div style={{ background: cardBg, borderRadius: "14px", padding: "20px", textAlign: "center", boxShadow: dark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.08)", transition: "background 0.3s" }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", color: "#128C7E" }}>
              {messages.length > 0 ? Math.round((flagged.length / messages.length) * 100) : 0}%
            </div>
            <div style={{ fontSize: "12px", color: textSecondary, marginTop: "4px" }}>Flag Rate</div>
          </div>
        </div>

        {/* Label Breakdown */}
        <div style={{ background: cardBg, borderRadius: "14px", padding: "20px", marginBottom: "20px", boxShadow: dark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.08)", transition: "background 0.3s" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#25D366", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>
            Breakdown by Category
          </h3>
          {Object.entries(counts).map(([label, count]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "10px" }}>
              <div style={{ width: "140px", fontSize: "12px", color: textPrimary, flexShrink: 0 }}>{label}</div>
              <div style={{ flex: 1, height: "10px", background: barTrackBg, borderRadius: "5px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  borderRadius: "5px",
                  background: LABEL_COLORS[label] || "#ccc",
                  width: messages.length > 0 ? `${(count / messages.length) * 100}%` : "0%",
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ width: "30px", fontSize: "12px", color: textSecondary, textAlign: "right" }}>{count}</div>
            </div>
          ))}
        </div>

        {/* Flagged Messages */}
        <div style={{ background: cardBg, borderRadius: "14px", padding: "20px", marginBottom: "20px", boxShadow: dark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.08)", transition: "background 0.3s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "12px", color: "#25D366", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>
              Flagged Messages ({flagged.length})
            </h3>
          </div>

          {loading ? (
            <p style={{ color: textSecondary, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>Loading...</p>
          ) : flagged.length === 0 ? (
            <p style={{ color: textSecondary, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>No flagged messages found.</p>
          ) : (
            flagged.map((msg, i) => (
              <div key={i} style={{ borderLeft: "4px solid #f44336", padding: "10px 12px", marginBottom: "10px", background: flaggedRowBg, borderRadius: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: "bold", fontSize: "13px", color: textPrimary }}>{msg.sender}</span>
                  <span style={{ color: "#fff", fontSize: "10px", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold", background: LABEL_COLORS[msg.label] || "#ccc" }}>
                    {msg.label}
                  </span>
                  <span style={{ fontSize: "11px", color: textSecondary }}>
                    {msg.confidence ? `${(msg.confidence * 100).toFixed(0)}%` : ""}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: dark ? "#ccc" : "#444", fontStyle: "italic", marginBottom: "4px" }}>"{msg.text}"</div>
                <div style={{ fontSize: "11px", color: textSecondary }}>{formatTime(msg.timestamp)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
