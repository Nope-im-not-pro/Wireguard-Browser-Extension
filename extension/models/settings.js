'use strict';
// Model-Schicht: Settings-Objekt, Enums, Defaults, abgeleitete Zustaende (Plan 3.2).
// Kein UI, kein browser.* ausser storage (Persistenz liegt in storage.js).
(function (global) {
  // OP-2 Enums.
  const NOTIFY_LEVELS = ['manual', 'off', 'errors', 'important', 'all'];
  const LOG_LEVELS = ['off', 'error', 'info', 'debug'];
  // OP-3 Benachrichtigungstypen.
  const NOTIFY_TYPES = ['status', 'error', 'killSwitch', 'autoConnect'];

  function defaults() {
    return {
      autoConnect: false,
      autoConnectTunnelId: null,
      killSwitch: false,
      notifyLevel: 'important',
      notifyTypes: { status: true, error: true, killSwitch: true, autoConnect: true },
      logLevel: 'error',
      dnsRemoteForced: true,   // OP-6 L2: const, UI read-only
      webrtcCoupled: true,     // OP-6 L4: const
      webrtcDisabled: true     // B1: Default WebRTC aus (Leak-Schutz ohne User-Eingriff); frei bei killSwitch=false
    };
  }

  // Merge unbekannter/fehlender Felder auf Defaults (Vorwaerts-Kompatibilitaet).
  function normalize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    const out = Object.assign({}, d, raw);
    out.notifyTypes = Object.assign({}, d.notifyTypes, raw.notifyTypes || {});
    // Consts hart erzwingen.
    out.dnsRemoteForced = true;
    out.webrtcCoupled = true;
    if (!NOTIFY_LEVELS.includes(out.notifyLevel)) out.notifyLevel = d.notifyLevel;
    if (!LOG_LEVELS.includes(out.logLevel)) out.logLevel = d.logLevel;
    return out;
  }

  // OP-6 L4: effektiver WebRTC-Aus-Zustand.
  // killSwitch=true erzwingt WebRTC aus; sonst folgt dem User-Toggle.
  function webrtcEffective(settings) {
    return settings.killSwitch ? true : !!settings.webrtcDisabled;
  }

  const Settings = { NOTIFY_LEVELS, LOG_LEVELS, NOTIFY_TYPES, defaults, normalize, webrtcEffective };

  global.WG = global.WG || {};
  global.WG.Settings = Settings;
  if (typeof module !== 'undefined' && module.exports) module.exports = Settings;
})(typeof self !== 'undefined' ? self : globalThis);
