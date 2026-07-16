'use strict';
// Service-Schicht: Notification-Ausgabe + Stufen/Typen-Filter (F-11/F-12/F-17, Plan 8).
// shouldNotify ist reine Logik (Node-testbar). notify() kapselt browser.notifications.
(function (global) {
  // Ereignis-Typ -> Notify-Kategorie (OP-3). connect/disconnect => 'status'.
  const TYPE_MAP = {
    connect: 'status',
    disconnect: 'status',
    error: 'error',
    killSwitch: 'killSwitch',
    autoConnect: 'autoConnect'
  };

  // Reine Filterlogik: darf Ereignis eventType bei diesen settings benachrichtigen?
  function shouldNotify(settings, eventType) {
    const cat = TYPE_MAP[eventType] || eventType;
    const level = settings.notifyLevel;
    switch (level) {
      case 'off': return false;
      case 'errors': return cat === 'error' || cat === 'killSwitch';
      case 'important': return cat === 'error' || cat === 'killSwitch' || cat === 'status';
      case 'all': return true;
      case 'manual': {
        const t = settings.notifyTypes || {};
        return !!t[cat];
      }
      default: return false;
    }
  }

  function api() {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    return (b && b.notifications) ? b.notifications : null;
  }

  // Gibt Notification aus, wenn Filter es erlaubt. settings aus Settings-Model.
  function notify(settings, eventType, title, message) {
    if (!shouldNotify(settings, eventType)) return false;
    const n = api();
    if (!n) return false;
    n.create('', {
      type: 'basic',
      title: title || 'WireGuard',
      message: message || ''
    });
    return true;
  }

  const Notifications = { TYPE_MAP, shouldNotify, notify };

  global.WG = global.WG || {};
  global.WG.Notifications = Notifications;
  if (typeof module !== 'undefined' && module.exports) module.exports = Notifications;
})(typeof self !== 'undefined' ? self : globalThis);
