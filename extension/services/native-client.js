'use strict';
// Service-Schicht: runtime.connectNative-Wrapper + Message-Schema (Plan 5).
// Envelope: Request{id,type,profileId,payload} / Response{id,ok,payload|error} / Event{id:0,type,payload}.
// Framing (4-Byte-Laenge) macht Firefox selbst; hier nur JSON-Objekte.
(function (global) {
  const HOST_NAME = 'wireguard_browser_host';

  function runtimeApi() {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!b || !b.runtime || !b.runtime.connectNative) throw new Error('nativeMessaging nicht verfuegbar');
    return b.runtime;
  }

  function createClient(profileId, opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs || 15000;
    let port = null;
    let nextId = 1;
    const pending = new Map(); // id -> {resolve, reject, timer}
    const eventHandlers = new Set();
    const disconnectHandlers = new Set();

    function ensurePort() {
      if (port) return port;
      port = runtimeApi().connectNative(HOST_NAME);
      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(onDisconnect);
      return port;
    }

    function onMessage(msg) {
      if (msg && msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.ok) p.resolve(msg.payload || {});
        else p.reject(mkError(msg.error));
        return;
      }
      // Host-initiiertes Event (id:0).
      if (msg && (msg.id === 0 || msg.id == null) && msg.type) {
        eventHandlers.forEach(h => { try { h(msg); } catch (e) {} });
      }
    }

    function onDisconnect() {
      const err = mkError({ code: 'E_HOST_UNAVAILABLE', message: 'Native-Host getrennt.' });
      pending.forEach(p => { clearTimeout(p.timer); p.reject(err); });
      pending.clear();
      port = null;
      disconnectHandlers.forEach(h => { try { h(err); } catch (e) {} });
    }

    function mkError(e) {
      const err = new Error((e && e.message) || 'Native-Host-Fehler');
      err.code = (e && e.code) || 'E_HOST_UNAVAILABLE';
      return err;
    }

    // Sendet Request, erwartet Response mit gleicher id.
    function request(type, payload) {
      return new Promise((resolve, reject) => {
        let p;
        try { p = ensurePort(); } catch (e) { reject(mkError({ code: 'E_HOST_UNAVAILABLE', message: e.message })); return; }
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(mkError({ code: 'E_HOST_UNAVAILABLE', message: 'Timeout auf ' + type }));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        try {
          p.postMessage({ id, type, profileId, payload: payload || {} });
        } catch (e) {
          pending.delete(id); clearTimeout(timer);
          reject(mkError({ code: 'E_HOST_UNAVAILABLE', message: e.message }));
        }
      });
    }

    return {
      HOST_NAME,
      onEvent: (h) => { eventHandlers.add(h); return () => eventHandlers.delete(h); },
      onDisconnect: (h) => { disconnectHandlers.add(h); return () => disconnectHandlers.delete(h); },
      health: () => request('health', {}),
      importKey: (privateKey) => request('import-key', { privateKey }),
      dropKey: (privateKeyRef) => request('drop-key', { privateKeyRef }),
      connect: (tunnelWithoutKey, privateKeyRef) => request('connect', { tunnel: tunnelWithoutKey, privateKeyRef }),
      disconnect: () => request('disconnect', { profileId }),
      status: () => request('status', {}),
      close: () => { if (port) { try { port.disconnect(); } catch (e) {} } port = null; }
    };
  }

  const NativeClient = { HOST_NAME, createClient };

  global.WG = global.WG || {};
  global.WG.NativeClient = NativeClient;
  if (typeof module !== 'undefined' && module.exports) module.exports = NativeClient;
})(typeof self !== 'undefined' ? self : globalThis);
