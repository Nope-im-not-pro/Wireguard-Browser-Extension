'use strict';
// Service-Schicht: WireGuard-INI -> Tunnel-Rohobjekt (F-04/F-06, Plan 4).
// Reine Logik, kein browser.*, kein DOM. PrivateKey transient in ._privateKey.
(function (global) {
  // Zerlegt Multi-Value-Felder (Komma-getrennt) in getrimmtes Array.
  function splitList(v) {
    return String(v).split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  // Parst WireGuard-.conf-Text. Toleriert Kommentare (#/;), Whitespace, unbekannte Keys.
  // Rueckgabe: { interface:{address,dns}, peer:{...}, _privateKey, unknownKeys:[] }
  function parse(text) {
    const result = {
      interface: { address: [], dns: [] },
      peer: { publicKey: '', endpoint: '', allowedIPs: [], persistentKeepalive: null },
      _privateKey: '',
      unknownKeys: []
    };
    if (text == null) return result;

    let section = null; // 'interface' | 'peer' | null
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');

    for (let raw of lines) {
      // Kommentare + Whitespace entfernen.
      let line = raw.replace(/[#;].*$/, '').trim();
      if (line.length === 0) continue;

      const sec = line.match(/^\[(.+?)\]$/);
      if (sec) {
        const name = sec[1].trim().toLowerCase();
        section = (name === 'interface') ? 'interface' : (name === 'peer' ? 'peer' : null);
        continue;
      }

      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim().toLowerCase();
      const val = line.slice(eq + 1).trim();
      if (val.length === 0) continue;

      if (section === 'interface') {
        switch (key) {
          case 'privatekey': result._privateKey = val; break;
          case 'address': result.interface.address = splitList(val); break;
          case 'dns': result.interface.dns = splitList(val); break;
          default: result.unknownKeys.push('Interface.' + key);
        }
      } else if (section === 'peer') {
        switch (key) {
          case 'publickey': result.peer.publicKey = val; break;
          case 'endpoint': result.peer.endpoint = val; break;
          case 'allowedips': result.peer.allowedIPs = splitList(val); break;
          case 'persistentkeepalive': {
            const n = parseInt(val, 10);
            result.peer.persistentKeepalive = Number.isFinite(n) ? n : null;
            break;
          }
          default: result.unknownKeys.push('Peer.' + key);
        }
      } else {
        result.unknownKeys.push(key);
      }
    }
    return result;
  }

  const ConfParser = { parse, splitList };

  global.WG = global.WG || {};
  global.WG.ConfParser = ConfParser;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConfParser;
})(typeof self !== 'undefined' ? self : globalThis);
