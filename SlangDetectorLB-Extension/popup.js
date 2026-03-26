const API = "http://127.0.0.1:8000";

const LABEL_COLORS = {
  "NORMAL": "#25d366",
  "WEED SLANG": "#8bc34a",
  "PILLS SLANG": "#ff9800",
  "COCAINE SLANG": "#9c27b0",
  "WEAPONS SLANG": "#f44336",
};

// Check API status on load
window.addEventListener("load", async () => {
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      document.getElementById("statusDot").className = "dot online";
      document.getElementById("statusText").textContent = "API Connected";
    } else {
      throw new Error();
    }
  } catch {
    document.getElementById("statusDot").className = "dot offline";
    document.getElementById("statusText").textContent = "API Offline — start the backend";
  }
});

async function analyzeText() {
  const text = document.getElementById("inputText").value.trim();
  if (!text) return;

  const btn = document.getElementById("analyzeBtn");
  btn.disabled = true;
  btn.textContent = "Analyzing...";

  try {
    const res = await fetch(`${API}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();

    const resultEl = document.getElementById("result");
    const labelEl = document.getElementById("resultLabel");
    const confEl = document.getElementById("resultConf");

    resultEl.style.display = "block";
    resultEl.className = `result ${data.label === "NORMAL" ? "normal" : "flagged"}`;
    labelEl.textContent = data.label;
    labelEl.style.color = LABEL_COLORS[data.label] || "#333";
    confEl.textContent = `Confidence: ${(data.confidence * 100).toFixed(1)}% · Source: ${data.source || "—"}`;
  } catch {
    alert("Failed to connect to API. Make sure the backend is running.");
  }

  btn.disabled = false;
  btn.textContent = "Analyze Text";
}

async function scanPage() {
  const findingsEl = document.getElementById("findings");
  findingsEl.innerHTML = '<div class="empty">Scanning page...</div>';

  // Get all visible text nodes from the page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const sentences = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        { acceptNode: n => n.nodeValue.trim().length > 5 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
      );
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue.trim();
        if (text.length > 5 && text.length < 300) sentences.push(text);
      }
      return [...new Set(sentences)].slice(0, 50);
    }
  });

  const texts = results[0]?.result || [];
  if (texts.length === 0) {
    findingsEl.innerHTML = '<div class="empty">No text found on page.</div>';
    return;
  }

  try {
    const res = await fetch(`${API}/analyze/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    const flagged = data.filter(r => r.label !== "NORMAL");
    if (flagged.length === 0) {
      findingsEl.innerHTML = '<div class="empty">✅ No suspicious content found.</div>';
      return;
    }

    findingsEl.innerHTML = flagged.map(r => `
      <div class="finding-item">
        <div class="finding-label" style="color:${LABEL_COLORS[r.label] || '#f44336'}">
          ${r.label} · ${(r.confidence * 100).toFixed(0)}%
        </div>
        <div class="finding-text">"${(r.original || "").substring(0, 80)}${(r.original || "").length > 80 ? "..." : ""}"</div>
      </div>
    `).join("");
  } catch {
    findingsEl.innerHTML = '<div class="empty">Failed to scan. Is the API running?</div>';
  }
}
