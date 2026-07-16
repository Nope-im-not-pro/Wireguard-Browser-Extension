'use strict';
// Model-Schicht: Tunnel-Objekt + Schema (Plan 3.1).
// PrivateKey ist NIE persistentes Feld; nur privateKeyRef (BE-3/OP-4).
(function (global) {
  // Erzeugt ein persistierbares Tunnel-Objekt aus geparsten Feldern.
  // parsed: Ausgabe von conf-parser (ohne _privateKey). ref: Keystore-Referenz.
  function create(parsed, privateKeyRef, opts) {
    opts = opts || {};
    const iface = parsed.interface || {};
    const peer = parsed.peer || {};
    return {
      id: opts.id || genId(),
      name: opts.name || parsed.name || deriveName(peer.endpoint),
      interface: {
        privateKeyRef: privateKeyRef || null,
        address: iface.address || [],
        dns: iface.dns || []
      },
      peer: {
        publicKey: peer.publicKey || '',
        endpoint: peer.endpoint || '',
        allowedIPs: peer.allowedIPs || [],
        persistentKeepalive: (typeof peer.persistentKeepalive === 'number') ? peer.persistentKeepalive : null
      },
      createdAt: opts.createdAt || new Date().toISOString()
    };
  }

  // Version ohne Key-Referenz fuer connect-Payload (Host bekommt Ref separat).
  function withoutKey(tunnel) {
    const t = JSON.parse(JSON.stringify(tunnel));
    if (t.interface) delete t.interface.privateKeyRef;
    return t;
  }

  function deriveName(endpoint) {
    if (!endpoint) return 'Tunnel';
    const host = String(endpoint).split(':')[0];
    return host || 'Tunnel';
  }

  // Nicht-kryptografische UUID v4-artige ID (rein interne Referenz).
  function genId() {
    const c = (typeof crypto !== 'undefined') ? crypto : null;
    if (c && c.randomUUID) return c.randomUUID();
    let s = '';
    for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-4' + s.slice(13, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
  }

  const Tunnel = { create, withoutKey, deriveName, genId };

  global.WG = global.WG || {};
  global.WG.Tunnel = Tunnel;
  if (typeof module !== 'undefined' && module.exports) module.exports = Tunnel;
})(typeof self !== 'undefined' ? self : globalThis);
