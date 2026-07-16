'use strict';
// Service-Schicht: Feld-Validierung (F-07/F-14/F-18, Plan 4).
// Reine Logik. Rueckgabe { valid, errors:[{field,code,message}] }.
(function (global) {
  // Base64 dekodieren -> Byte-Laenge (browser atob / Node Buffer).
  function base64ByteLength(s) {
    if (typeof s !== 'string' || s.length === 0) return -1;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return -1;
    try {
      if (typeof atob === 'function') {
        return atob(s).length;
      }
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(s, 'base64').length;
      }
    } catch (e) {
      return -1;
    }
    return -1;
  }

  function isWgKey(s) { return base64ByteLength(s) === 32; }

  function isIPv4(h) {
    const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    return m.slice(1).every(o => { const n = +o; return n >= 0 && n <= 255; });
  }

  // Grobe IPv6-Syntaxpruefung (Hextets + ::-Kompression).
  function isIPv6(h) {
    if (h.indexOf(':') < 0) return false;
    if (!/^[0-9A-Fa-f:]+$/.test(h)) return false;
    const parts = h.split('::');
    if (parts.length > 2) return false;
    return true;
  }

  function isHostname(h) {
    if (h.length > 253) return false;
    return /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(h);
  }

  function isPort(p) { const n = +p; return Number.isInteger(n) && n >= 1 && n <= 65535; }

  // Endpoint: host:port. IPv6 in eckigen Klammern.
  function isEndpoint(s) {
    if (typeof s !== 'string' || s.length === 0) return false;
    let host, port;
    if (s[0] === '[') {
      const close = s.indexOf(']');
      if (close < 0 || s[close + 1] !== ':') return false;
      host = s.slice(1, close);
      port = s.slice(close + 2);
      if (!isIPv6(host)) return false;
    } else {
      const idx = s.lastIndexOf(':');
      if (idx < 0) return false;
      host = s.slice(0, idx);
      port = s.slice(idx + 1);
      if (!(isIPv4(host) || isHostname(host))) return false;
    }
    return isPort(port);
  }

  // CIDR: addr/prefix. IPv4 (0-32) oder IPv6 (0-128).
  function isCidr(s) {
    if (typeof s !== 'string') return false;
    const slash = s.indexOf('/');
    if (slash < 0) return false;
    const addr = s.slice(0, slash);
    const prefix = s.slice(slash + 1);
    const p = +prefix;
    if (!Number.isInteger(p)) return false;
    if (isIPv4(addr)) return p >= 0 && p <= 32;
    if (isIPv6(addr)) return p >= 0 && p <= 128;
    return false;
  }

  // B3: Full-Tunnel-Abdeckung je IP-Familie. Prueft Praesenz der Voll-Routen
  // 0.0.0.0/0 (IPv4) bzw. ::/0 (IPv6) in AllowedIPs. true = Familie voll getunnelt.
  // Fehlt ::/0, kann reale IPv6 am Tunnel vorbei leaken (nicht-blockierende Warnung).
  function fullTunnelGaps(allowedIPs) {
    const list = Array.isArray(allowedIPs) ? allowedIPs : [];
    const norm = list.map(a => String(a).trim());
    return {
      ipv4: norm.includes('0.0.0.0/0'),
      ipv6: norm.includes('::/0')
    };
  }

  // parsed = conf-parser-Ausgabe (mit ._privateKey). Prueft Pflichtfelder + Formate.
  function validateParsed(parsed) {
    const errors = [];
    const add = (field, code, message) => errors.push({ field, code, message });

    const pk = parsed && parsed._privateKey;
    if (!pk) add('PrivateKey', 'REQUIRED', 'PrivateKey fehlt.');
    else if (!isWgKey(pk)) add('PrivateKey', 'FORMAT', 'PrivateKey ist kein 32-Byte-Base64-Schluessel.');

    const iface = (parsed && parsed.interface) || {};
    if (!iface.address || iface.address.length === 0) add('Address', 'REQUIRED', 'Address fehlt.');
    else iface.address.forEach((a, i) => { if (!isCidr(a)) add('Address[' + i + ']', 'FORMAT', 'Address ist kein CIDR: ' + a); });

    const peer = (parsed && parsed.peer) || {};
    if (!peer.publicKey) add('Peer.PublicKey', 'REQUIRED', 'Peer.PublicKey fehlt.');
    else if (!isWgKey(peer.publicKey)) add('Peer.PublicKey', 'FORMAT', 'Peer.PublicKey ist kein 32-Byte-Base64-Schluessel.');

    if (!peer.endpoint) add('Peer.Endpoint', 'REQUIRED', 'Endpoint fehlt.');
    else if (!isEndpoint(peer.endpoint)) add('Peer.Endpoint', 'FORMAT', 'Endpoint ist kein host:port: ' + peer.endpoint);

    if (peer.allowedIPs && peer.allowedIPs.length) {
      peer.allowedIPs.forEach((a, i) => { if (!isCidr(a)) add('Peer.AllowedIPs[' + i + ']', 'FORMAT', 'AllowedIPs ist kein CIDR: ' + a); });
    }

    if (peer.persistentKeepalive != null && (!Number.isInteger(peer.persistentKeepalive) || peer.persistentKeepalive < 0)) {
      add('Peer.PersistentKeepalive', 'FORMAT', 'PersistentKeepalive muss >= 0 sein.');
    }

    return { valid: errors.length === 0, errors };
  }

  const Validation = {
    base64ByteLength, isWgKey, isIPv4, isIPv6, isHostname, isPort, isEndpoint, isCidr, fullTunnelGaps, validateParsed
  };

  global.WG = global.WG || {};
  global.WG.Validation = Validation;
  if (typeof module !== 'undefined' && module.exports) module.exports = Validation;
})(typeof self !== 'undefined' ? self : globalThis);
