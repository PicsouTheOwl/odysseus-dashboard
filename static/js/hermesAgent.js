/**
 * hermesAgent.js — OWL Agent Chat pour Boubane
 * Panneau de chat intégré pour discuter avec l'agent Hermes (OWL)
 * à propos des emails et de la gestion du dashboard.
 */

const API_BASE = window.location.origin;
const BRIDGE_URL = API_BASE + '/api/agent';

let _owlPanel = null;
let _owlSession = null;
let _owlMessages = [];

// ── Crée le panel OWL ────────────────────────────────────────

function _createOwlPanel() {
  if (_owlPanel) return _owlPanel;

  const panel = document.createElement('div');
  panel.id = 'owl-agent-panel';
  panel.className = 'owl-agent-panel';

  panel.innerHTML = `
    <div class="owl-panel-header">
      <div class="owl-panel-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>
        <span>OWL Agent</span>
      </div>
      <div class="owl-panel-actions">
        <button class="owl-panel-min-btn" title="Minimize">─</button>
        <button class="owl-panel-close-btn" title="Close">✕</button>
      </div>
    </div>
    <div class="owl-panel-context" id="owl-context" style="display:none"></div>
    <div class="owl-panel-messages" id="owl-messages"></div>
    <div class="owl-panel-input">
      <textarea id="owl-input" placeholder="Pose une question à OWL..." rows="1"></textarea>
      <button id="owl-send-btn" title="Envoyer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>
  `;

  document.body.appendChild(panel);

  // Events
  panel.querySelector('.owl-panel-close-btn').addEventListener('click', closeOwlPanel);
  panel.querySelector('.owl-panel-min-btn').addEventListener('click', () => panel.classList.toggle('minimized'));
  panel.querySelector('#owl-send-btn').addEventListener('click', _sendOwlMessage);
  panel.querySelector('#owl-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendOwlMessage(); }
  });

  // Auto-resize textarea
  const textarea = panel.querySelector('#owl-input');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });

  _owlPanel = panel;
  return panel;
}

// ── Ouvre le panel avec un contexte email ────────────────────

export async function openOwlAgent(opts = {}) {
  const { emailData = null, initialMessage = '' } = opts;

  const panel = _createOwlPanel();
  panel.classList.remove('minimized');
  panel.classList.add('open');

  const messagesEl = panel.querySelector('#owl-messages');
  const contextEl = panel.querySelector('#owl-context');
  const inputEl = panel.querySelector('#owl-input');

  // Afficher le contexte email
  if (emailData) {
    const subject = emailData.subject || '(pas de sujet)';
    const from = emailData.from_name || emailData.from_address || '';
    contextEl.style.display = 'block';
    contextEl.innerHTML = `
      <div class="owl-context-email">
        <div class="owl-context-subject">${_esc(subject)}</div>
        <div class="owl-context-from">De: ${_esc(from)}</div>
      </div>
    `;
    contextEl.dataset.uid = emailData.uid || '';
    contextEl.dataset.folder = emailData.folder || 'INBOX';
  } else {
    contextEl.style.display = 'none';
    contextEl.innerHTML = '';
  }

  // Message initial
  if (initialMessage) {
    inputEl.value = initialMessage;
    inputEl.focus();
  } else if (emailData) {
    inputEl.value = '';
    inputEl.placeholder = 'Pose une question à propos de cet email...';
    inputEl.focus();
  } else {
    inputEl.placeholder = 'Pose une question à OWL...';
    inputEl.focus();
  }

  // Charger les messages existants
  _renderMessages();
}

// ── Envoie un message à OWL ──────────────────────────────────

async function _sendOwlMessage() {
  if (!_owlPanel) return;

  const input = _owlPanel.querySelector('#owl-input');
  const sendBtn = _owlPanel.querySelector('#owl-send-btn');
  const contextEl = _owlPanel.querySelector('#owl-context');

  const message = input.value.trim();
  if (!message) return;

  // Afficher le message utilisateur
  _owlMessages.push({ role: 'user', content: message });
  _renderMessages();

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  sendBtn.classList.add('sending');

  // Indicateur de typing
  _showTypingIndicator();

  try {
    const payload = {
      message,
      session_id: _owlSession,
    };

    // Ajouter le contexte email si présent
    if (contextEl.dataset.uid) {
      payload.email_uid = contextEl.dataset.uid;
      payload.email_folder = contextEl.dataset.folder || 'INBOX';
    }

    const r = await fetch(BRIDGE_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    _owlSession = data.session_id || _owlSession;

    // Ajouter la réponse
    _owlMessages.push({ role: 'assistant', content: data.response || 'Pas de réponse.' });
  } catch (err) {
    _owlMessages.push({ role: 'assistant', content: '⚠️ Erreur de connexion à OWL. ' + err.message });
  }

  _hideTypingIndicator();
  _renderMessages();
  sendBtn.disabled = false;
  sendBtn.classList.remove('sending');
}

// ── Rendu des messages ───────────────────────────────────────

function _renderMessages() {
  if (!_owlPanel) return;
  const el = _owlPanel.querySelector('#owl-messages');
  el.innerHTML = '';

  for (const msg of _owlMessages) {
    const div = document.createElement('div');
    div.className = `owl-msg owl-msg-${msg.role}`;
    div.innerHTML = `<div class="owl-msg-content">${_esc(msg.content).replace(/\n/g, '<br>')}</div>`;
    el.appendChild(div);
  }

  el.scrollTop = el.scrollHeight;
}

function _showTypingIndicator() {
  if (!_owlPanel) return;
  const el = _owlPanel.querySelector('#owl-messages');
  const div = document.createElement('div');
  div.className = 'owl-msg owl-msg-assistant owl-typing';
  div.id = 'owl-typing';
  div.innerHTML = '<div class="owl-msg-content"><span class="owl-dots"><span>.</span><span>.</span><span>.</span></span></div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function _hideTypingIndicator() {
  const el = document.getElementById('owl-typing');
  if (el) el.remove();
}

// ── Ferme le panel ───────────────────────────────────────────

export function closeOwlPanel() {
  if (_owlPanel) {
    _owlPanel.classList.remove('open');
  }
}

// ── Utilitaire ───────────────────────────────────────────────

function _esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Export global ────────────────────────────────────────────

window.openOwlAgent = openOwlAgent;
window.closeOwlPanel = closeOwlPanel;
