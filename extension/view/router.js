'use strict';
// View-Schicht: Schicht-Navigation + Popup->Background-Messaging-Helper (Plan 2/7).
// Kein Geschaeftslogik; sendet Actions an message-router im Background.
(function (global) {
  const LAYERS = ['home', 'tunnel', 'manual', 'settings'];

  function show(layer) {
    LAYERS.forEach(l => {
      const el = document.getElementById('layer-' + l);
      if (el) el.classList.toggle('hidden', l !== layer);
    });
    document.dispatchEvent(new CustomEvent('wg:show', { detail: layer }));
  }

  // Sendet {action,payload} an Background, liefert data oder wirft mit .code.
  function send(action, payload) {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!b || !b.runtime || !b.runtime.sendMessage) return Promise.reject(new Error('runtime nicht verfuegbar'));
    return Promise.resolve(b.runtime.sendMessage({ action, payload: payload || {} })).then(res => {
      if (!res) throw new Error('Keine Antwort vom Background');
      if (res.ok) return res.data;
      const err = new Error((res.error && res.error.message) || 'Fehler');
      err.code = res.error && res.error.code;
      err.errors = res.error && res.error.errors;
      throw err;
    });
  }

  function onBackgroundMessage(handler) {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!b || !b.runtime || !b.runtime.onMessage) return;
    b.runtime.onMessage.addListener((msg) => { if (msg && msg.action) handler(msg); });
  }

  const Router = { LAYERS, show, send, onBackgroundMessage };
  global.WGRouter = Router;

  // Back-Buttons + Layer-Wechsel-Buttons verdrahten.
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => show(btn.getAttribute('data-goto')));
    });
    const nt = document.getElementById('btn-new-tunnel');
    const st = document.getElementById('btn-settings');
    const mn = document.getElementById('btn-manual');
    if (nt) nt.addEventListener('click', () => show('tunnel'));
    if (st) st.addEventListener('click', () => show('settings'));
    if (mn) mn.addEventListener('click', () => show('manual'));
    show('home');
  });
})(typeof window !== 'undefined' ? window : this);
