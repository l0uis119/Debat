/* ============================================================
   MIROIR DE DÉBAT — app.js
   ============================================================ */

const PERSONAS = {
  philosopher: { label: "Philosophe",       icon: "🏛" },
  economist:   { label: "Économiste",       icon: "📊" },
  scientist:   { label: "Scientifique",     icon: "🔬" },
  lawyer:      { label: "Juriste",          icon: "⚖" },
  activist:    { label: "Militant",         icon: "✊" },
  devil:       { label: "Avocat du diable", icon: "👁" },
};

const FEROCITY_LABELS = { soft: "Douce", normal: "Vive", brutal: "Brutale" };

let state = {
  conviction: "",
  persona:    "philosopher",
  ferocity:   "normal",
  mode:       "attack",
  history:    [],
  turns:      0,
  loading:    false,
  waitingBinary: false, // true quand l'IA attend un oui/non
};

const $  = (id) => document.getElementById(id);
const show = (screenId) => {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(screenId).classList.add("active");
};

// ── Setup ──
const convictionEl = $("conviction");
const charCountEl  = $("charCount");
const startBtn     = $("startBtn");

convictionEl.addEventListener("input", () => {
  const len = convictionEl.value.length;
  charCountEl.textContent = len;
  startBtn.disabled = len < 12 || len > 300;
});

document.querySelectorAll(".persona-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".persona-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.persona = btn.dataset.persona;
  });
});

document.querySelectorAll("#ferocityGroup .toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#ferocityGroup .toggle-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.ferocity = btn.dataset.value;
  });
});

document.querySelectorAll("#modeGroup .toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#modeGroup .toggle-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.mode = btn.dataset.value;
  });
});

startBtn.addEventListener("click", startDebate);

// ── Debate ──
$("backBtn").addEventListener("click", () => {
  if (confirm("Abandonner ce débat ?")) { resetState(); show("screen-home"); }
});

$("verdictTriggerBtn").addEventListener("click", requestVerdict);

const userInputEl = $("userInput");
const sendBtnEl   = $("sendBtn");

userInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

userInputEl.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

sendBtnEl.addEventListener("click", sendMessage);

// ── Verdict ──
$("backToDebateBtn").addEventListener("click", () => show("screen-debate"));
$("newDebateBtn").addEventListener("click", () => {
  resetState();
  convictionEl.value = "";
  charCountEl.textContent = "0";
  startBtn.disabled = true;
  show("screen-home");
});

// ============================================================
// CORE LOGIC
// ============================================================

async function startDebate() {
  state.conviction    = convictionEl.value.trim();
  state.history       = [];
  state.turns         = 0;
  state.waitingBinary = false;

  const p = PERSONAS[state.persona];
  $("personaBadge").textContent     = `${p.icon} ${p.label}`;
  $("ferocityBadge").textContent    = FEROCITY_LABELS[state.ferocity];
  $("convictionBanner").textContent = state.conviction;
  $("messages").innerHTML           = "";
  $("turnCounter").textContent      = "0 échange";
  $("verdictTriggerBtn").disabled   = true;

  show("screen-debate");
  setLoading(true);

  const firstUserMsg = `Je soutiens que : ${state.conviction}`;
  state.history.push({ role: "user", content: firstUserMsg });

  try {
    const reply = await callAPI(state.history);
    state.history.push({ role: "assistant", content: reply });
    hideTyping();
    appendAIMessage(reply);
    state.turns = 1;
    updateTurnCounter();
  } catch (err) {
    hideTyping();
    appendAIMessage("Une erreur est survenue. Vérifie ta connexion et réessaie.");
    console.error(err);
  }

  setLoading(false);
}

async function sendMessage(textOverride) {
  const text = textOverride ?? userInputEl.value.trim();
  if (!text || state.loading) return;

  if (!textOverride) {
    userInputEl.value = "";
    userInputEl.style.height = "auto";
  }

  // Masque les boutons oui/non s'ils sont affichés
  removeBinaryButtons();
  state.waitingBinary = false;

  appendUserMessage(text);
  state.history.push({ role: "user", content: text });

  setLoading(true);

  try {
    const reply = await callAPI(state.history);
    state.history.push({ role: "assistant", content: reply });
    hideTyping();
    appendAIMessage(reply);
    state.turns++;
    updateTurnCounter();
    if (state.turns >= 3) $("verdictTriggerBtn").disabled = false;
  } catch (err) {
    hideTyping();
    appendAIMessage("Erreur réseau. Réessaie.");
    console.error(err);
  }

  setLoading(false);
}

async function requestVerdict() {
  $("verdictConviction").textContent = state.conviction;
  $("verdictBody").innerHTML = `
    <div class="verdict-loading">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <p>Analyse du débat en cours…</p>
    </div>`;
  show("screen-verdict");

  try {
    const verdictText = await callVerdictAPI(state.history, state.conviction);
    renderVerdict(verdictText);
  } catch (err) {
    $("verdictBody").innerHTML = `<p style="color:var(--cream-dim);font-style:italic">Erreur lors de la génération du verdict.</p>`;
    console.error(err);
  }
}

// ============================================================
// API CALLS
// ============================================================

async function callAPI(history) {
  showTyping();
  const res = await fetch("/api/debate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      history,
      persona:    state.persona,
      ferocity:   state.ferocity,
      mode:       state.mode,
      conviction: state.conviction,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.reply;
}

async function callVerdictAPI(history, conviction) {
  const res = await fetch("/api/verdict", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, conviction }),
  });
  if (!res.ok) throw new Error(`Verdict API error ${res.status}`);
  const data = await res.json();
  return data.verdict;
}

// ============================================================
// DOM — MESSAGES
// ============================================================

function appendUserMessage(content) {
  const msgs = $("messages");
  const div  = document.createElement("div");
  div.className = "msg user";
  div.innerHTML = `
    <div class="msg-label">Toi</div>
    <div class="msg-bubble">${escapeHtml(content)}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendAIMessage(rawContent) {
  const msgs = $("messages");
  const p    = PERSONAS[state.persona];

  // Nettoie le marqueur [Réponds par oui ou non] pour l'affichage
  const hasBinary = rawContent.includes("[Réponds par oui ou non]");
  const displayContent = rawContent
    .replace("[Réponds par oui ou non]", "")
    .trim();

  const div = document.createElement("div");
  div.className = "msg ai";
  div.innerHTML = `
    <div class="msg-label">${p.icon} ${p.label}</div>
    <div class="msg-bubble">${escapeHtml(displayContent)}</div>`;
  msgs.appendChild(div);

  // Si l'IA attend une réponse binaire → affiche les boutons oui/non
  if (hasBinary) {
    state.waitingBinary = true;
    showBinaryButtons();
    // Désactive la zone de texte libre pendant l'attente
    userInputEl.disabled = true;
    sendBtnEl.disabled   = true;
  }

  msgs.scrollTop = msgs.scrollHeight;
}

function showBinaryButtons() {
  removeBinaryButtons(); // évite les doublons

  const msgs    = $("messages");
  const wrapper = document.createElement("div");
  wrapper.id    = "binaryButtons";
  wrapper.className = "binary-btns";

  const ouiBtn = document.createElement("button");
  ouiBtn.className   = "binary-btn binary-oui";
  ouiBtn.textContent = "Oui";
  ouiBtn.onclick = () => sendMessage("Oui.");

  const nonBtn = document.createElement("button");
  nonBtn.className   = "binary-btn binary-non";
  nonBtn.textContent = "Non";
  nonBtn.onclick = () => sendMessage("Non.");

  wrapper.appendChild(ouiBtn);
  wrapper.appendChild(nonBtn);
  msgs.appendChild(wrapper);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeBinaryButtons() {
  const existing = $("binaryButtons");
  if (existing) existing.remove();
  // Réactive la zone de texte
  userInputEl.disabled = state.loading;
  sendBtnEl.disabled   = state.loading;
}

function showTyping() {
  const msgs = $("messages");
  const p    = PERSONAS[state.persona];
  const div  = document.createElement("div");
  div.className = "msg ai";
  div.id = "typingMsg";
  div.innerHTML = `
    <div class="msg-label">${p.icon} ${p.label}</div>
    <div class="typing-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function hideTyping() {
  const t = $("typingMsg");
  if (t) t.remove();
}

function setLoading(on) {
  state.loading = on;
  if (!state.waitingBinary) {
    userInputEl.disabled = on;
    sendBtnEl.disabled   = on;
  }
  if (!on && !state.waitingBinary) userInputEl.focus();
}

function updateTurnCounter() {
  const t = state.turns;
  $("turnCounter").textContent = `${t} échange${t > 1 ? "s" : ""}`;
}

function renderVerdict(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch {
    $("verdictBody").innerHTML = `<div class="verdict-section"><p class="verdict-section-text">${escapeHtml(text)}</p></div>`;
    return;
  }

  const sections = [
    { key: "strengths",  label: "Tes arguments solides" },
    { key: "weaknesses", label: "Tes failles exposées" },
    { key: "fatal",      label: "L'argument que tu n'as pas su contrer" },
  ];

  let html = sections.map(({ key, label }) => {
    if (!parsed[key]) return "";
    return `<div class="verdict-section">
      <p class="verdict-section-label">${label}</p>
      <p class="verdict-section-text">${escapeHtml(parsed[key])}</p>
    </div>`;
  }).join("");

  if (parsed.verdict) {
    html += `<div class="verdict-section verdict-final-block">
      <p class="verdict-section-label">Verdict global</p>
      <p class="verdict-section-text">${escapeHtml(parsed.verdict)}</p>
    </div>`;
  }

  $("verdictBody").innerHTML = html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resetState() {
  state = {
    conviction: "", persona: "philosopher", ferocity: "normal",
    mode: "attack", history: [], turns: 0, loading: false, waitingBinary: false,
  };
}
