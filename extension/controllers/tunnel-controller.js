'use strict';
// Controller-Schicht: Tunnel-CRUD F-04..F-08 (Plan 2). Orchestriert models + services.
// Registriert Actions am message-router.
(function (global) {
  const WG = global.WG || (global.WG = {});

  function deps() {
    return {
      Storage: WG.Storage,
      Tunnel: WG.Tunnel,
      ConfParser: WG.ConfParser,
      Validation: WG.Validation,
      NativeClient: WG.NativeClient,
      Logger: WG.Logger || { info() {}, error() {}, debug() {} }
    };
  }

  // getClient: Funktion die einen native-client liefert (vom background injiziert).
  let getClient = null;
  function setClientProvider(fn) { getClient = fn; }

  // F-04/F-06: Konfig-Text parsen, validieren, Key an Host uebergeben, Tunnel speichern.
  // Rueckgabe bei Fehler: { error:{ errors:[...] } } (F-14). Bei Erfolg: gespeicherter Tunnel.
  async function importConf(payload) {
    const { ConfParser, Validation, Tunnel, Storage, Logger } = deps();
    const text = payload && payload.text;
    const parsed = ConfParser.parse(text);
    const v = Validation.validateParsed(parsed);
    if (!v.valid) { const e = new Error('Validierung fehlgeschlagen'); e.code = 'E_VALIDATION'; e.errors = v.errors; throw e; }

    // BE-3/OP-4: PrivateKey transient an Host, Ref zurueck, Klartext nullen.
    let privateKeyRef = null;
    const client = getClient ? getClient() : null;
    if (client) {
      try {
        const res = await client.importKey(parsed._privateKey);
        privateKeyRef = res.privateKeyRef;
      } catch (e) {
        Logger.error('import-key fehlgeschlagen', e.code);
        const err = new Error('Key-Import am Host fehlgeschlagen: ' + e.message); err.code = e.code || 'E_KEYSTORE'; throw err;
      }
    }
    parsed._privateKey = null;

    const tunnel = Tunnel.create(parsed, privateKeyRef, { name: payload && payload.name });
    await Storage.saveTunnel(tunnel);
    Logger.info('Tunnel importiert', tunnel.id);
    return tunnel;
  }

  // F-05: manuelle Einzelfelder -> gleicher Pfad wie importConf (baut .conf-Text).
  async function createManual(payload) {
    const text = fieldsToConf(payload || {});
    return importConf({ text, name: payload && payload.name });
  }

  function fieldsToConf(f) {
    const lines = ['[Interface]'];
    if (f.privateKey) lines.push('PrivateKey = ' + f.privateKey);
    if (f.address) lines.push('Address = ' + toCsv(f.address));
    if (f.dns) lines.push('DNS = ' + toCsv(f.dns));
    lines.push('', '[Peer]');
    if (f.publicKey) lines.push('PublicKey = ' + f.publicKey);
    if (f.endpoint) lines.push('Endpoint = ' + f.endpoint);
    if (f.allowedIPs) lines.push('AllowedIPs = ' + toCsv(f.allowedIPs));
    if (f.persistentKeepalive != null && f.persistentKeepalive !== '') lines.push('PersistentKeepalive = ' + f.persistentKeepalive);
    return lines.join('\n');
  }

  function toCsv(v) { return Array.isArray(v) ? v.join(', ') : String(v); }

  async function list() { return deps().Storage.getTunnels(); }
  async function get(payload) { return deps().Storage.getTunnel(payload.id); }
  async function rename(payload) { return deps().Storage.renameTunnel(payload.id, payload.name); }

  // F-08: Loeschen. Key-Ref am Host verwerfen (drop-key).
  async function remove(payload) {
    const { Storage, Logger } = deps();
    const t = await Storage.getTunnel(payload.id);
    if (t && t.interface && t.interface.privateKeyRef) {
      const client = getClient ? getClient() : null;
      if (client) { try { await client.dropKey(t.interface.privateKeyRef); } catch (e) { Logger.error('drop-key fehlgeschlagen', e.code); } }
    }
    const ok = await Storage.deleteTunnel(payload.id);
    return { deleted: ok };
  }

  function registerRoutes(router) {
    router.register('tunnel.import', importConf);
    router.register('tunnel.createManual', createManual);
    router.register('tunnel.list', list);
    router.register('tunnel.get', get);
    router.register('tunnel.rename', rename);
    router.register('tunnel.delete', remove);
  }

  const TunnelController = {
    setClientProvider, importConf, createManual, fieldsToConf, list, get, rename, remove, registerRoutes
  };

  WG.TunnelController = TunnelController;
  if (typeof module !== 'undefined' && module.exports) module.exports = TunnelController;
})(typeof self !== 'undefined' ? self : globalThis);
