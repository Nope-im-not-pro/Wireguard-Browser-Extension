'use strict';
// Service-Schicht: WebRTC-Abschaltung via privacy.network (OP-6 WebRTC L4, Plan 6).
// Zustandsloser Wrapper. Kopplung an killSwitch entscheidet der connection-controller.
(function (global) {
  function api() {
    const b = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    if (!b || !b.privacy || !b.privacy.network || !b.privacy.network.peerConnectionEnabled) {
      throw new Error('privacy.network.peerConnectionEnabled nicht verfuegbar');
    }
    return b.privacy.network.peerConnectionEnabled;
  }

  // disabled=true -> WebRTC aus (peerConnectionEnabled=false).
  async function setWebrtcDisabled(disabled) {
    await api().set({ value: !disabled });
  }

  // Setzt WebRTC zurueck auf Browser-Default (Kontrolle abgeben).
  async function clear() {
    await api().clear({});
  }

  const PrivacyControl = { setWebrtcDisabled, clear };

  global.WG = global.WG || {};
  global.WG.PrivacyControl = PrivacyControl;
  if (typeof module !== 'undefined' && module.exports) module.exports = PrivacyControl;
})(typeof self !== 'undefined' ? self : globalThis);
