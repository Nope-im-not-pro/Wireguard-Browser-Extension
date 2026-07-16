'use strict';
// Model-Schicht: storage.local CRUD fuer Tunnel-Liste, aktive Tunnel-ID, Settings, profileId.
// Kapselt browser.storage.local. Keine Geschaeftslogik.
(function (global) {
  const KEY_TUNNELS = 'tunnels';
  const KEY_ACTIVE = 'activeTunnelId';
  const KEY_SETTINGS = 'settings';
  const KEY_PROFILE = 'profileId';

  // browser.* (Firefox) mit chrome-Fallback; in Node-Tests undefined.
  function api() {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!b || !b.storage || !b.storage.local) throw new Error('storage.local nicht verfuegbar');
    return b.storage.local;
  }

  async function getRaw(key, fallback) {
    const res = await api().get(key);
    return (res && key in res) ? res[key] : fallback;
  }
  async function setRaw(key, value) {
    await api().set({ [key]: value });
  }

  async function getTunnels() { return getRaw(KEY_TUNNELS, []); }
  async function getTunnel(id) { return (await getTunnels()).find(t => t.id === id) || null; }

  async function saveTunnel(tunnel) {
    const list = await getTunnels();
    const idx = list.findIndex(t => t.id === tunnel.id);
    if (idx >= 0) list[idx] = tunnel; else list.push(tunnel);
    await setRaw(KEY_TUNNELS, list);
    return tunnel;
  }

  async function deleteTunnel(id) {
    const list = await getTunnels();
    const next = list.filter(t => t.id !== id);
    await setRaw(KEY_TUNNELS, next);
    const active = await getActiveTunnelId();
    if (active === id) await setActiveTunnelId(null);
    return list.length !== next.length;
  }

  async function renameTunnel(id, name) {
    const t = await getTunnel(id);
    if (!t) return null;
    t.name = name;
    return saveTunnel(t);
  }

  async function getActiveTunnelId() { return getRaw(KEY_ACTIVE, null); }
  async function setActiveTunnelId(id) { await setRaw(KEY_ACTIVE, id); }

  async function getSettings() { return getRaw(KEY_SETTINGS, null); }
  async function setSettings(s) { await setRaw(KEY_SETTINGS, s); }

  // Stabile Profil-ID (Broker-Key OP-7), einmalig generiert.
  async function getProfileId() {
    let id = await getRaw(KEY_PROFILE, null);
    if (!id) {
      id = (global.WG && global.WG.Tunnel) ? global.WG.Tunnel.genId() : String(Date.now());
      await setRaw(KEY_PROFILE, id);
    }
    return id;
  }

  const Storage = {
    KEY_TUNNELS, KEY_ACTIVE, KEY_SETTINGS, KEY_PROFILE,
    getTunnels, getTunnel, saveTunnel, deleteTunnel, renameTunnel,
    getActiveTunnelId, setActiveTunnelId, getSettings, setSettings, getProfileId
  };

  global.WG = global.WG || {};
  global.WG.Storage = Storage;
  if (typeof module !== 'undefined' && module.exports) module.exports = Storage;
})(typeof self !== 'undefined' ? self : globalThis);
