'use strict';
// Service-Schicht: Logging mit Stufen (F-13, OP-2) + Ringpuffer.
// Stufen: off < error < info < debug. logLevel steuert Detailtiefe.
(function (global) {
  const ORDER = { off: 0, error: 1, info: 2, debug: 3 };
  const RING_MAX = 200;

  let level = 'error';
  const ring = [];

  function setLevel(l) { if (l in ORDER) level = l; }
  function getLevel() { return level; }

  function enabled(l) { return ORDER[l] <= ORDER[level] && ORDER[level] > 0; }

  function push(l, args) {
    if (!enabled(l)) return;
    const entry = { ts: new Date().toISOString(), level: l, msg: args.map(stringify).join(' ') };
    ring.push(entry);
    if (ring.length > RING_MAX) ring.shift();
    const sink = (typeof console !== 'undefined') ? console : null;
    if (sink) {
      const fn = l === 'error' ? sink.error : (l === 'debug' ? sink.debug || sink.log : sink.log);
      if (fn) fn.call(sink, '[WG:' + l + ']', ...args);
    }
  }

  function stringify(a) {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }

  const error = (...a) => push('error', a);
  const info = (...a) => push('info', a);
  const debug = (...a) => push('debug', a);
  function dump() { return ring.slice(); }
  function clear() { ring.length = 0; }

  const Logger = { setLevel, getLevel, error, info, debug, dump, clear, ORDER };

  global.WG = global.WG || {};
  global.WG.Logger = Logger;
  if (typeof module !== 'undefined' && module.exports) module.exports = Logger;
})(typeof self !== 'undefined' ? self : globalThis);
