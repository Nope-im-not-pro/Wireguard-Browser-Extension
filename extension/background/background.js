'use strict';
// Background: Lifecycle, Native-Port-Halter, Auto-Connect F-09, Status-Broadcast (Plan 2).
// Verdrahtet Controller mit message-router; injiziert native-client-Provider.
(function (global) {
  const WG = global.WG;
  const {
    Storage, Settings, NativeClient, Logger,
    MessageRouter, TunnelController, SettingsController, ConnectionController
  } = WG;

  let client = null;
  let profileId = null;

  // Lazy Client-Erzeugung: erst bei erstem Bedarf connectNative.
  function getClient() {
    if (client) return client;
    if (!profileId) return null;
    client = NativeClient.createClient(profileId, { timeoutMs: 15000 });
    ConnectionController.bindClientEvents(client);
    Logger.info('Native-Client erzeugt');
    return client;
  }

  // Status-Broadcast an offene Popups.
  function broadcast(stateObj) {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!b || !b.runtime || !b.runtime.sendMessage) return;
    try { b.runtime.sendMessage({ action: 'connection.stateChanged', payload: stateObj }); } catch (e) {}
  }

  async function init() {
    profileId = await Storage.getProfileId();
    Logger.setLevel((Settings.normalize(await Storage.getSettings())).logLevel);

    // Client-Provider in Controller injizieren.
    TunnelController.setClientProvider(getClient);
    ConnectionController.setClientProvider(getClient);

    // Routen registrieren.
    TunnelController.registerRoutes(MessageRouter);
    SettingsController.registerRoutes(MessageRouter);
    ConnectionController.registerRoutes(MessageRouter);
    MessageRouter.register('logger.dump', async () => Logger.dump());
    MessageRouter.register('host.health', async () => {
      const c = getClient();
      if (!c) { const e = new Error('Host nicht verfuegbar'); e.code = 'E_HOST_UNAVAILABLE'; throw e; }
      return c.health();
    });

    MessageRouter.attach();
    ConnectionController.onChange(broadcast);

    // F-09 Auto-Connect.
    const settings = Settings.normalize(await Storage.getSettings());
    if (settings.autoConnect) {
      const tid = settings.autoConnectTunnelId || await Storage.getActiveTunnelId();
      if (tid) {
        Logger.info('Auto-Connect', tid);
        try {
          await ConnectionController.connect({ tunnelId: tid });
          const s = Settings.normalize(await Storage.getSettings());
          WG.Notifications.notify(s, 'autoConnect', 'WireGuard', 'Auto-Connect ausgefuehrt.');
        } catch (e) { Logger.error('Auto-Connect fehlgeschlagen', e.code); }
      }
    }
    Logger.info('Background initialisiert, Profil', profileId);
  }

  // Init beim Laden.
  init().catch(e => { if (Logger) Logger.error('init-Fehler', e.message); });

  WG.Background = { getClient, init, broadcast };
})(typeof self !== 'undefined' ? self : globalThis);
