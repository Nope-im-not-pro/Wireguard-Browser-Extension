'use strict';
// Controller-Schicht: Settings-Mutationen F-09..F-13 (Plan 2). models + logger.
(function (global) {
  const WG = global.WG || (global.WG = {});

  function deps() {
    return {
      Storage: WG.Storage,
      Settings: WG.Settings,
      Logger: WG.Logger || { info() {}, setLevel() {} }
    };
  }

  // Liefert normalisierte Settings (Defaults fuer fehlende Felder).
  async function get() {
    const { Storage, Settings } = deps();
    const raw = await Storage.getSettings();
    return Settings.normalize(raw);
  }

  // Patch-Merge + Persistenz. Consts bleiben erzwungen (normalize).
  async function update(payload) {
    const { Storage, Settings, Logger } = deps();
    const cur = Settings.normalize(await Storage.getSettings());
    const next = Settings.normalize(Object.assign({}, cur, payload || {}));
    await Storage.setSettings(next);
    Logger.setLevel(next.logLevel);
    Logger.info('Settings aktualisiert');
    return next;
  }

  function registerRoutes(router) {
    router.register('settings.get', get);
    router.register('settings.update', update);
  }

  const SettingsController = { get, update, registerRoutes };

  WG.SettingsController = SettingsController;
  if (typeof module !== 'undefined' && module.exports) module.exports = SettingsController;
})(typeof self !== 'undefined' ? self : globalThis);
