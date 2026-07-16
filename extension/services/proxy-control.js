'use strict';
// Service-Schicht: proxy.settings setzen/loeschen (Plan 6). Zustandsloser API-Wrapper.
// Kill-Switch-Logik liegt im connection-controller, nicht hier.
(function (global) {
  function api() {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!b || !b.proxy || !b.proxy.settings) throw new Error('proxy.settings nicht verfuegbar');
    return b.proxy.settings;
  }

  // Setzt SOCKS5 auf 127.0.0.1:port. proxyDNS=true erzwingt Remote-DNS (socks5h, OP-6 L2).
  async function setSocks(port) {
    await api().set({
      value: {
        proxyType: 'manual',
        socks: '127.0.0.1:' + port,
        socksVersion: 5,
        proxyDNS: true
      }
    });
  }

  // Loescht Proxy -> Direktverbindung.
  async function clear() {
    await api().clear({});
  }

  const ProxyControl = { setSocks, clear };

  global.WG = global.WG || {};
  global.WG.ProxyControl = ProxyControl;
  if (typeof module !== 'undefined' && module.exports) module.exports = ProxyControl;
})(typeof self !== 'undefined' ? self : globalThis);
