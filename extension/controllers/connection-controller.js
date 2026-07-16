'use strict';
// Controller-Schicht: Verbindungs-Kern F-01/F-02/F-03 + Kill-Switch F-10 (Plan 6).
// Zentrale Kill-Switch-Zustandslogik. proxy-control/privacy-control bleiben zustandslos.
(function (global) {
  const WG = global.WG || (global.WG = {});

  function deps() {
    return {
      Storage: WG.Storage,
      Tunnel: WG.Tunnel,
      Settings: WG.Settings,
      ProxyControl: WG.ProxyControl,
      PrivacyControl: WG.PrivacyControl,
      Notifications: WG.Notifications,
      Logger: WG.Logger || { info() {}, error() {}, debug() {} }
    };
  }

  let getClient = null;                 // vom background injiziert
  function setClientProvider(fn) { getClient = fn; }

  // Runtime-Zustand (nicht persistent, Plan 3.3).
  const state = {
    status: 'disconnected',             // disconnected|connecting|connected|error
    activeTunnelId: null,
    socksPort: null,
    lastError: null
  };

  const listeners = new Set();          // Status-Broadcast an Popup/Background
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function setState(patch) {
    Object.assign(state, patch);
    listeners.forEach(fn => { try { fn(getState()); } catch (e) {} });
  }
  function getState() { return Object.assign({}, state); }

  // Verdrahtet Host-Events (vom background nach Client-Erzeugung aufgerufen).
  function bindClientEvents(client) {
    client.onEvent(async (evt) => {
      const { Logger } = deps();
      if (evt.type === 'status-changed') {
        const p = evt.payload || {};
        setState({ status: p.status || state.status, socksPort: p.socksPort != null ? p.socksPort : state.socksPort });
      } else if (evt.type === 'wireproxy-exit') {
        await handleWireproxyExit(evt.payload || {});
      } else if (evt.type === 'error') {
        Logger.error('Host-Event error', evt.payload);
        await fail((evt.payload && evt.payload.code) || 'E_HANDSHAKE', (evt.payload && evt.payload.message) || 'Host-Fehler');
      }
    });
    client.onDisconnect(async () => {
      await handleWireproxyExit({ unexpected: true, code: 0 });
    });
  }

  // F-01/F-02: aktiven Tunnel verbinden.
  async function connect(payload) {
    const { Storage, Tunnel, Settings, ProxyControl, PrivacyControl, Notifications, Logger } = deps();
    const tunnelId = (payload && payload.tunnelId) || await Storage.getActiveTunnelId();
    if (!tunnelId) { const e = new Error('Kein Tunnel gewaehlt'); e.code = 'E_NO_TUNNEL'; throw e; }
    const tunnel = await Storage.getTunnel(tunnelId);
    if (!tunnel) { const e = new Error('Tunnel nicht gefunden'); e.code = 'E_NO_TUNNEL'; throw e; }

    const client = getClient ? getClient() : null;
    if (!client) { await fail('E_HOST_UNAVAILABLE', 'Native-Host nicht verfuegbar'); const e = new Error('Native-Host nicht verfuegbar'); e.code = 'E_HOST_UNAVAILABLE'; throw e; }

    setState({ status: 'connecting', activeTunnelId: tunnelId, lastError: null });
    await Storage.setActiveTunnelId(tunnelId);

    const settings = Settings.normalize(await Storage.getSettings());
    try {
      const res = await client.connect(Tunnel.withoutKey(tunnel), tunnel.interface.privateKeyRef);
      const port = res.socksPort;
      await ProxyControl.setSocks(port);       // socks5h erzwungen (OP-6 DNS L2)
      // OP-6 WebRTC L4: killSwitch=true -> erzwingt aus; sonst User-Toggle.
      try { await PrivacyControl.setWebrtcDisabled(Settings.webrtcEffective(settings)); } catch (e) { Logger.error('WebRTC-Set fehlgeschlagen', e.message); }
      setState({ status: 'connected', socksPort: port, lastError: null });
      Notifications.notify(settings, 'connect', 'WireGuard', 'Verbunden: ' + tunnel.name);
      Logger.info('connected', tunnel.name, 'port', port);
      return getState();
    } catch (e) {
      await fail(e.code || 'E_HANDSHAKE', e.message || 'Verbindungsfehler');
      const err = new Error(e.message || 'Verbindungsfehler'); err.code = e.code || 'E_HANDSHAKE'; throw err;
    }
  }

  // F-01: regulaeres Trennen.
  async function disconnect() {
    const { ProxyControl, PrivacyControl, Settings, Storage, Notifications, Logger } = deps();
    const client = getClient ? getClient() : null;
    if (client) { try { await client.disconnect(); } catch (e) { Logger.error('disconnect Host-Fehler', e.code); } }
    try { await ProxyControl.clear(); } catch (e) {}
    try { await PrivacyControl.clear(); } catch (e) {}
    const settings = Settings.normalize(await Storage.getSettings());
    setState({ status: 'disconnected', socksPort: null, lastError: null });
    Notifications.notify(settings, 'disconnect', 'WireGuard', 'Getrennt.');
    Logger.info('disconnected');
    return getState();
  }

  // F-10 Kern: unerwarteter wireproxy-Ausfall. Verhalten je killSwitch.
  async function handleWireproxyExit(payload) {
    const { ProxyControl, Settings, Storage, Notifications, Logger } = deps();
    if (!payload.unexpected) { return; } // regulaerer Stop wurde schon behandelt
    const settings = Settings.normalize(await Storage.getSettings());
    if (settings.killSwitch) {
      // fail-closed: proxy.settings NICHT clearen (zeigt auf toten Port).
      setState({ status: 'error', lastError: { code: 'E_KILLSWITCH_ACTIVE', message: 'Tunnel ausgefallen, Traffic blockiert.' } });
      Notifications.notify(settings, 'killSwitch', 'Kill-Switch aktiv', 'Tunnel ausgefallen. Traffic blockiert (fail-closed).');
      Logger.error('wireproxy-exit + killSwitch -> fail-closed');
    } else {
      try { await ProxyControl.clear(); } catch (e) {}
      setState({ status: 'error', socksPort: null, lastError: { code: 'E_WIREPROXY_SPAWN', message: 'Tunnel ausgefallen (kein Kill-Switch).' } });
      Notifications.notify(settings, 'error', 'Verbindungsfehler', 'Tunnel ausgefallen. Direktverbindung aktiv.');
      Logger.error('wireproxy-exit, killSwitch aus -> proxy geloescht');
    }
  }

  async function fail(code, message) {
    const { Settings, Storage, Notifications } = deps();
    setState({ status: 'error', lastError: { code, message } });
    try {
      const settings = Settings.normalize(await Storage.getSettings());
      Notifications.notify(settings, 'error', 'Verbindungsfehler', message);
    } catch (e) {}
  }

  async function selectActive(payload) {
    await deps().Storage.setActiveTunnelId(payload.tunnelId);
    setState({ activeTunnelId: payload.tunnelId });
    return getState();
  }

  async function status() { return getState(); }

  function registerRoutes(router) {
    router.register('connection.connect', connect);
    router.register('connection.disconnect', disconnect);
    router.register('connection.status', status);
    router.register('connection.selectActive', selectActive);
  }

  const ConnectionController = {
    setClientProvider, bindClientEvents, onChange, getState, setState,
    connect, disconnect, handleWireproxyExit, selectActive, status, registerRoutes, _state: state
  };

  WG.ConnectionController = ConnectionController;
  if (typeof module !== 'undefined' && module.exports) module.exports = ConnectionController;
})(typeof self !== 'undefined' ? self : globalThis);
