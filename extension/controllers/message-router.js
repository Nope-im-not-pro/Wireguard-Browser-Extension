'use strict';
// Controller-Schicht: zentraler interner Dispatch background <-> popup (Plan 2).
// Popup sendet {action, payload} via runtime.sendMessage; hier auf Controller gemappt.
(function (global) {
  const handlers = new Map();

  // Registriert einen Action-Handler. fn: async (payload) => result.
  function register(action, fn) { handlers.set(action, fn); }

  // Dispatch eines Requests. Rueckgabe { ok, data } | { ok:false, error }.
  async function dispatch(msg) {
    const action = msg && msg.action;
    const fn = handlers.get(action);
    if (!fn) return { ok: false, error: { code: 'E_UNKNOWN_ACTION', message: 'Unbekannte Action: ' + action } };
    try {
      const data = await fn(msg.payload || {});
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: { code: e.code || 'E_INTERNAL', message: e.message || String(e) } };
    }
  }

  // Bindet runtime.onMessage an dispatch (nur im Background-Kontext).
  function attach() {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!b || !b.runtime || !b.runtime.onMessage) return;
    b.runtime.onMessage.addListener((msg) => dispatch(msg));
  }

  const MessageRouter = { register, dispatch, attach, handlers };

  global.WG = global.WG || {};
  global.WG.MessageRouter = MessageRouter;
  if (typeof module !== 'undefined' && module.exports) module.exports = MessageRouter;
})(typeof self !== 'undefined' ? self : globalThis);
