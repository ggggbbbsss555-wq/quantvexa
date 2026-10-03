/**
 * QuantVexa API Client — shared across all 4 pages
 * Connects to the Node.js backend on Railway.
 */

const API_URL = 'https://backend-server-production-4c03.up.railway.app';
const WS_URL  = 'wss://backend-server-production-4c03.up.railway.app/ws';

// --- Session ---
function getInitData() {
  // Telegram WebApp provides initData via window.Telegram.WebApp.initData
  if (window.Telegram?.WebApp?.initData) return window.Telegram.WebApp.initData;
  // Fallback: URL params (for testing outside Telegram)
  const p = new URLSearchParams(location.search);
  return p.get('init_data') || p.get('tg-init-data') || '';
}

function getSessionToken() { return sessionStorage.getItem('qv_session') || ''; }
function setSessionToken(t) { sessionStorage.setItem('qv_session', t); }
function isLoggedIn() { return !!getSessionToken(); }

// --- API helper ---
async function api(path, options = {}) {
  const initData = getInitData();
  const headers = { 'Content-Type': 'application/json' };
  if (initData) headers['Authorization'] = `tma ${initData}`;

  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: options.method || 'GET',
      headers: { ...headers, ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error?.message || 'API error');
    return data.data;
  } catch (err) {
    console.error('API error:', path, err.message);
    return null;
  }
}

// --- Auth ---
async function authTelegram() {
  const initData = getInitData();
  if (!initData) return null;
  const result = await api('/api/auth/telegram', { method: 'POST', body: { init_data: initData } });
  if (result?.session_token) setSessionToken(result.session_token);
  return result;
}

// --- Plans + Payments ---
async function getPlans() { return api('/api/plans'); }
async function getPaymentMethods() { return api('/api/payment-methods'); }
async function validateDiscount(code) { return api('/api/discounts/validate', { method: 'POST', body: { code } }); }

// --- Subscriptions ---
async function createSubRequest(planId, paymentMethod, transactionId, receiptImage, note) {
  return api('/api/subscriptions/request', { method: 'POST', body: { planId, paymentMethod, transactionId, receiptImage, note } });
}
async function getSubStatus() { return api('/api/subscriptions/status'); }
async function getSubMine() { return api('/api/subscriptions/mine'); }

// --- Signals + Candles ---
async function getSignals(limit = 50) { return api(`/api/signals?limit=${limit}`); }
async function getSymbols() { return api('/api/symbols'); }
async function getCandles(symbol, timeframe = '1m', limit = 200) {
  return api(`/api/candles/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=${limit}`);
}

// --- Support ---
async function getConvos() { return api('/api/support/convos'); }
async function sendMessage(text, image) { return api('/api/support/messages', { method: 'POST', body: { text, image } }); }
async function markConvoRead(convoId) { return api(`/api/support/mark-read/${convoId}`, { method: 'POST' }); }

// --- Bots ---
async function getStrategies() { return api('/api/bots/strategies'); }
async function getPlatforms() { return api('/api/bots/platforms'); }
async function getBotStatus() { return api('/api/bots/status'); }
async function startBotSession() { return api('/api/bots/session/start', { method: 'POST' }); }
async function stopBotSession() { return api('/api/bots/session/stop', { method: 'POST' }); }

// --- Profile ---
async function getMe() { return api('/api/me'); }
async function updateMe(platform, strategy) { return api('/api/me', { method: 'PUT', body: { platform, strategy } }); }

// --- WebSocket ---
let ws = null;
function connectWS(onSignal, onSupport) {
  const initData = getInitData();
  if (!initData) return;
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', init_data: initData }));
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.channel === 'signals' && onSignal) onSignal(msg.data);
      if (msg.channel === 'support' && onSupport) onSupport(msg.data);
    } catch {}
  };
  ws.onclose = () => { setTimeout(() => connectWS(onSignal, onSupport), 3000); };
  return ws;
}
function disconnectWS() { if (ws) { ws.close(); ws = null; } }

// --- Init: authenticate on page load ---
async function initAPI() {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
  if (!isLoggedIn()) {
    await authTelegram();
  }
}
