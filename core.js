// ══════════════════════════════════════════════════════════════
//  core.js — Basanos
//  Code partagé entre index.html et hardcore.html.
//  Chaque page définit ses propres PERSONAS, SCREENS, S (état),
//  buildSystemPrompt() et appelle renderVerdict() avec ses options.
// ══════════════════════════════════════════════════════════════

// ── Supabase ──
const { createClient } = supabase;

// Fallback mémoire pour Safari/Edge qui bloquent localStorage
const memStorage = (() => {
  const store = {};
  return {
    getItem:    (k) => store[k] ?? null,
    setItem:    (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
})();

function safeStorage() {
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    return localStorage;
  } catch(e) {
    return memStorage;
  }
}

const SB = createClient(
  'https://bsabkjrnebzdrvleciva.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzYWJranJuZWJ6ZHJ2bGVjaXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjY0NDksImV4cCI6MjA5MDk0MjQ0OX0.eL7IKkb_KNJ3LSITFY2fzLtAQxWCghZiHLvB3IM6N9M',
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sb-objection-auth', storage: safeStorage() } }
);

let currentUser   = null;
let currentPseudo = null;

// ── Auth ──
// initAuth() lit d'abord sessionStorage pour afficher le nom immédiatement
// (évite le flash "non connecté"), puis vérifie en arrière-plan avec Supabase.
// onSessionReady(user) est un callback optionnel : chaque page peut y brancher
// sa logique post-connexion (ex: loadWinsFromSupabase dans index.html).
async function initAuth(onSessionReady) {
  try {
    const email  = sessionStorage.getItem('obj_email');
    const pseudo = sessionStorage.getItem('obj_pseudo');
    if (email) {
      currentUser   = { email };
      currentPseudo = pseudo || null;
      renderAuthZone();
      SB.auth.getSession().then(({ data: sd }) => {
        if (sd?.session?.user) {
          currentUser = sd.session.user;
          renderAuthZone();
          if (typeof onSessionReady === 'function') onSessionReady(currentUser);
        }
      }).catch(() => {});
    }
  } catch(e) {}
  renderAuthZone();
}

SB.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    currentUser   = null;
    currentPseudo = null;
    try {
      sessionStorage.removeItem('obj_email');
      sessionStorage.removeItem('obj_pseudo');
    } catch(e) {}
    renderAuthZone();
  }
});

// renderAuthZone() met à jour la topbar.
// menuAuthZone est optionnel : présent dans index.html (menu mobile),
// absent dans hardcore.html.
function renderAuthZone() {
  const z  = document.getElementById('authZone');
  const mz = document.getElementById('menuAuthZone');
  if (!z) return;

  if (currentUser) {
    const initial = (currentPseudo || currentUser.email || '?')[0].toUpperCase();
    const name    = currentPseudo || currentUser.email;
    z.innerHTML   = `<a class="user-chip" href="/profil" title="Mon profil">
      <div class="user-avatar">${esc(initial)}</div>
      <span class="user-name">${esc(name)}</span>
    </a>`;
    if (mz) mz.innerHTML = '';
  } else {
    z.innerHTML = `<a class="auth-btn btn-login" href="/profil">Connexion</a>
                   <a class="auth-btn btn-signup" href="/profil">Créer un compte</a>`;
    if (mz) mz.innerHTML = `<hr class="menu-sep"/>
      <a class="menu-item" href="/profil">Connexion</a>
      <a class="menu-item" href="/profil" style="font-weight:700;color:var(--terra)">Créer un compte</a>`;
  }
}

// ── Utilitaires ──
const $   = id => document.getElementById(id);
const esc = s  => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Router hash-based ──
// SCREENS doit être défini dans la page avant que ce fichier soit chargé.
// showScreen() masque tous les écrans puis affiche celui demandé.
// Le débat utilise display:flex et non display:block, d'où le traitement spécial.
function showScreen(id, push = true) {
  SCREENS.forEach(s => {
    const el = $(s); if (!el) return;
    el.classList.remove('active');
    if (s === 'debate') el.style.display = 'none';
  });
  const t = $(id); if (!t) return;
  t.classList.add('active');
  if (id === 'debate') t.style.display = 'flex';
  window.scrollTo(0, 0);
  if (push) history.pushState({ screen: id }, '', '#' + id);
}

// initRouter() initialise le router et branche le bouton retour.
// Appelé après que SCREENS et S sont définis dans le script inline.
// Le listener popstate est enregistré ici — pas au chargement de core.js —
// pour garantir que SCREENS et S existent déjà.
function initRouter(defaultScreen) {
  const hash    = location.hash.replace('#', '');
  const initial = SCREENS.includes(hash) ? hash : (defaultScreen || SCREENS[0]);
  showScreen(initial, false);
  history.replaceState({ screen: initial }, '', '#' + initial);

  window.addEventListener('popstate', e => {
    const to = e.state?.screen || SCREENS[0];
    if (document.querySelector('.screen.active')?.id === 'debate' && S.history.length > 0) {
      history.pushState({ screen: 'debate' }, '', '#debate');
      $('confirmOverlay').classList.add('open');
      return;
    }
    showScreen(to, false);
  });
}

// ── Menu hamburger ──
function setupMenu() {
  const trigger  = $('menuTrigger');
  const dropdown = $('menuDropdown');
  if (!trigger || !dropdown) return;
  trigger.onclick = e => { e.stopPropagation(); dropdown.classList.toggle('open'); };
  document.addEventListener('click', () => dropdown.classList.remove('open'));
}

// ── Modal confirmation quitter débat ──
// onLeave est appelé quand l'utilisateur confirme vouloir quitter.
function setupConfirmModal(onLeave) {
  $('confirmCancel').onclick = () => $('confirmOverlay').classList.remove('open');
  $('confirmLeave').onclick  = () => {
    $('confirmOverlay').classList.remove('open');
    if (typeof onLeave === 'function') onLeave();
  };
  if ($('backBtn')) $('backBtn').onclick = () => $('confirmOverlay').classList.add('open');
}

// ── Appels API ──
// api() envoie l'historique à /api/debate.
// maxTokens est paramétrable car hardcore l'ajuste selon le persona.
async function api(history, maxTokens) {
  showTyping();
  const res = await fetch('/api/debate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ history, systemPrompt: buildSystemPrompt(), maxTokens }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()).reply;
}

// verdictApi() envoie le transcript à /api/verdict.
// personaOverride permet à hardcore de remapper 'hc-devil' → 'devil'
// pour que verdict.js utilise le bon template de scoring.
async function verdictApi(userName, aiName, personaOverride) {
  const stripMd    = t => t.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/^#+\s/gm,'').replace(/\*/g,'');
  const transcript = S.history.map(m =>
    `${m.role === 'user' ? userName : aiName} : ${stripMd(m.content)}`
  ).join('\n\n');
  const persona = personaOverride || S.persona;
  const res = await fetch('/api/verdict', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ conviction: S.conviction, transcript, userName, aiName, persona }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()).verdict;
}

// ── Helpers DOM du débat ──

function renderUser(text) {
  const msgs = $('messages'), div = document.createElement('div');
  const name = currentPseudo || (currentUser?.email?.split('@')[0]) || 'Toi';
  div.className = 'msg u';
  div.innerHTML = `<div class="mwho">${esc(name)}</div><div class="mbub">${esc(text)}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function renderAI(raw) {
  const msgs    = $('messages'), p = PERSONAS[S.persona];
  const hasBin  = raw.includes('[Réponds par oui ou non]');
  const display = raw.replace('[Réponds par oui ou non]', '').trim();
  const div     = document.createElement('div');
  div.className = 'msg a';
  div.innerHTML = `<div class="mwho">${p.icon} ${p.label}</div><div class="mbub">${esc(display)}</div>`;
  msgs.appendChild(div);
  if (hasBin) { S.waitingBinary = true; showBinary(); }
  msgs.scrollTop = msgs.scrollHeight;
}

function showBinary() {
  removeBinaryOnly();
  const msgs = $('messages'), wrap = document.createElement('div');
  wrap.id        = 'binaryWrap';
  wrap.className = 'binwrap';
  const oui = document.createElement('button');
  oui.className  = 'binbtn boui';
  oui.textContent = 'Oui';
  oui.onclick    = () => sendMsg('Oui.');
  const non = document.createElement('button');
  non.className  = 'binbtn bnon';
  non.textContent = 'Non';
  non.onclick    = () => sendMsg('Non.');
  wrap.appendChild(oui);
  wrap.appendChild(non);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeBinaryOnly() {
  const el = $('binaryWrap');
  if (el) el.remove();
}

function showTyping() {
  const msgs = $('messages'), p = PERSONAS[S.persona], div = document.createElement('div');
  div.className = 'msg a';
  div.id        = 'typing';
  div.innerHTML = `<div class="mwho">${p.icon} ${p.label}</div>
    <div class="tyb">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function hideTyping() {
  const t = $('typing');
  if (t) t.remove();
}

// setLoading() active/désactive le champ et le bouton d'envoi
// pendant qu'on attend la réponse de l'IA.
function setLoading(on) {
  S.loading = on;
  const inputEl = $('userInput');
  const sendEl  = $('sendBtn');
  if (inputEl) inputEl.disabled = on;
  if (sendEl)  sendEl.disabled  = on;
  if (!on && inputEl) inputEl.focus();
}

// refreshTurns() met à jour le compteur et la barre de progression.
// La barre change de couleur à 5 échanges pour signaler que l'analyse est disponible.
function refreshTurns() {
  const t      = S.turns;
  const capped = Math.min(t, 5);
  const tc     = $('turnCount');
  const pb     = $('progressBar');
  const pl     = $('progressLabel');
  if (tc) tc.textContent = `${t} échange${t > 1 ? 's' : ''}`;
  if (pb) {
    pb.style.width = `${(capped / 5) * 100}%`;
    pb.classList.toggle('done', capped >= 5);
  }
  if (pl) pl.textContent = `${capped} / 5`;
}

// ── Rendu du verdict ──
// renderVerdict() est partagé mais chaque page lui passe ses propres options :
//
// scoreColors : { high, mid, low } — les couleurs du bloc de score.
//   index.html utilise var(--sage) pour high ; hardcore utilise '#8B6914'.
//
// onVerdictParsed(data, robustesse) : callback exécuté après le parsing JSON.
//   Chaque page y branche sa logique propre :
//   - index.html : addWin(), renderHardcoreBtn(), activer le bouton save
//   - hardcore.html : rien de spécial (pas de compteur de victoires)
function renderVerdict(raw, userName, aiName, persona, scoreColors, onVerdictParsed) {
  let d;
  try {
    let c = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const s = c.indexOf('{'), e = c.lastIndexOf('}');
    if (s !== -1 && e !== -1) c = c.slice(s, e + 1);
    else throw new Error('no JSON');
    d = JSON.parse(c);
    if (typeof d !== 'object' || d === null) throw new Error('invalid');
  } catch(err) {
    $('verdictBody').innerHTML = `<div class="v-section">
      <p class="v-section-label">Analyse</p>
      <p class="v-section-text">${esc(raw.replace(/```json|```/g, '').trim())}</p>
    </div>`;
    return;
  }

  const robustesse = typeof d.robustesse === 'number' ? d.robustesse : null;
  const label      = d.robustesse_label || '';

  if (typeof onVerdictParsed === 'function') onVerdictParsed(d, robustesse);

  const colors     = scoreColors || { high: 'var(--sage)', mid: '#B07D2A', low: 'var(--terra)' };
  let scoreColor   = colors.low;
  if (robustesse !== null) {
    if (robustesse >= 71)      scoreColor = colors.high;
    else if (robustesse >= 51) scoreColor = colors.mid;
  }

  let html = '';

  if (robustesse !== null) {
    html += `<div class="v-winner-block" style="background:${scoreColor}">
      <div class="v-winner-label">Robustesse de l'idée</div>
      <div class="v-winner-name">Ton idée tient à ${robustesse}%</div>
      ${label ? `<div class="v-winner-pct">${esc(label)}</div>` : ''}
    </div>`;
  }

  if (d.conseil) {
    html += `<div class="v-conseil">
      <p class="v-section-label">Pour aller plus loin</p>
      <p class="v-section-text">${esc(d.conseil)}</p>
    </div>`;
  }

  if (d.categories?.length) {
    html += '<div class="v-cats">';
    d.categories.forEach((cat, i) => {
      const pct   = cat.pct || 50;
      const uWins = cat.winner && (
        cat.winner === 'Défenseur' ||
        cat.winner?.toLowerCase().includes(userName.toLowerCase())
      );
      const uPct = uWins ? pct : 100 - pct;
      const aPct = 100 - uPct;
      html += `<div class="vcat" style="animation-delay:${i * 0.08}s">
        <div class="vcat-head">
          <span class="vcat-label">${esc(cat.label)}</span>
          <span class="vcat-winner-badge ${uWins ? '' : 'sage'}" title="${esc(uWins ? userName : aiName)}">${esc(uWins ? userName : aiName)}</span>
        </div>
        <div class="vbar-wrap">
          <span class="vbar-name" title="${esc(userName)}">${esc(userName)}</span>
          <div class="vbar"><div class="vbar-fill-user" style="width:${uPct}%"></div></div>
          <span class="vbar-pct">${uPct}%</span>
        </div>
        <div class="vbar-wrap">
          <span class="vbar-name" title="${esc(aiName)}">${esc(aiName)}</span>
          <div class="vbar"><div class="vbar-fill-ai" style="width:${aPct}%"></div></div>
          <span class="vbar-pct">${aPct}%</span>
        </div>
        <p class="vcat-comment">${esc(cat.comment || '')}</p>
      </div>`;
    });
    html += '</div>';
  }

  // Blocs exclusifs à l'Avocat du diable (normal et hardcore)
  if (persona === 'devil' || persona === 'hc-devil') {
    if (d.coup_fatal) {
      html += `<div class="v-devil-block">
        <p class="v-section-label">⚡ Le coup fatal</p>
        <p class="v-section-text">${esc(d.coup_fatal)}</p>
      </div>`;
    }
    if (d.analyse_faiblesses_ia) {
      html += `<div class="v-critique">
        <p class="v-section-label">Où l'IA a failli</p>
        <p class="v-section-text">${esc(d.analyse_faiblesses_ia)}</p>
      </div>`;
    }
  }

  if (d.summary) {
    html += `<div class="v-section">
      <p class="v-section-label">Analyse</p>
      <p class="v-section-text">${esc(d.summary)}</p>
    </div>`;
  }

  $('verdictBody').innerHTML = html;
}
