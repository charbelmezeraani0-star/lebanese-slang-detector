// Content script — runs on every page
// Highlights suspicious text detected by the API

const API = "http://127.0.0.1:8000";

const LABEL_STYLES = {
  "WEED SLANG":    "background: rgba(139,195,74,0.3); border-bottom: 2px solid #8bc34a;",
  "PILLS SLANG":   "background: rgba(255,152,0,0.3);  border-bottom: 2px solid #ff9800;",
  "COCAINE SLANG": "background: rgba(156,39,176,0.3); border-bottom: 2px solid #9c27b0;",
  "WEAPONS SLANG": "background: rgba(244,67,54,0.3);  border-bottom: 2px solid #f44336;",
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "HIGHLIGHT_PAGE") highlightPage();
});

async function highlightPage() {
  const walker = document.createTreeWalker(
    document.body, NodeFilter.SHOW_TEXT,
    { acceptNode: n => n.nodeValue.trim().length > 10 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
  );

  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);

  const texts = [...new Set(nodes.map(n => n.nodeValue.trim()))].slice(0, 50);
  if (!texts.length) return;

  try {
    const res = await fetch(`${API}/analyze/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    const results = await res.json();

    const flaggedMap = {};
    results.forEach(r => {
      if (r.label !== "NORMAL" && r.original) flaggedMap[r.original.trim()] = r.label;
    });

    nodes.forEach(textNode => {
      const text = textNode.nodeValue.trim();
      const label = flaggedMap[text];
      if (!label || !LABEL_STYLES[label]) return;

      const span = document.createElement("span");
      span.style.cssText = LABEL_STYLES[label] + " border-radius: 2px; cursor: help;";
      span.title = `⚠️ ${label}`;
      span.textContent = textNode.nodeValue;
      textNode.parentNode?.replaceChild(span, textNode);
    });
  } catch {}
}
