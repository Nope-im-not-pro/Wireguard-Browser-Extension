'use strict';
// View-Schicht Einstellungen (1-3-1..1-3-4 + OP-6 DNS/WebRTC, Plan 7).
(function (global) {
  const R = global.WGRouter;

  // Slider-Index -> Enum. Sonderposition "manual" am Ende (OP-2/1-3-3-1).
  const NOTIFY_ORDER = ['off', 'errors', 'important', 'all', 'manual'];
  const NOTIFY_LABEL = { off: 'Aus', errors: 'Nur Fehler', important: 'Wichtig', all: 'Alles', manual: 'Manuell' };
  const LOG_ORDER = ['off', 'error', 'info', 'debug'];
  const LOG_LABEL = { off: 'Aus', error: 'Fehler', info: 'Info', debug: 'Debug' };

  function el(id) { return document.getElementById(id); }

  async function load() {
    let s;
    try { s = await R.send('settings.get'); } catch (e) { return; }
    el('set-autoconnect').checked = !!s.autoConnect;
    el('set-killswitch').checked = !!s.killSwitch;

    const ni = Math.max(0, NOTIFY_ORDER.indexOf(s.notifyLevel));
    el('set-notify').value = String(ni);
    el('set-notify-label').textContent = NOTIFY_LABEL[NOTIFY_ORDER[ni]];
    el('notify-types').classList.toggle('hidden', s.notifyLevel !== 'manual');
    el('nt-status').checked = !!s.notifyTypes.status;
    el('nt-error').checked = !!s.notifyTypes.error;
    el('nt-killSwitch').checked = !!s.notifyTypes.killSwitch;
    el('nt-autoConnect').checked = !!s.notifyTypes.autoConnect;

    const li = Math.max(0, LOG_ORDER.indexOf(s.logLevel));
    el('set-log').value = String(li);
    el('set-log-label').textContent = LOG_LABEL[LOG_ORDER[li]];

    await loadAutoConnectTunnels(s.autoConnectTunnelId);
    applyWebrtcCoupling(s);
  }

  async function loadAutoConnectTunnels(selectedId) {
    const sel = el('set-autoconnect-tunnel');
    if (!sel) return;
    try {
      const tunnels = await R.send('tunnel.list');
      sel.innerHTML = '';
      const none = document.createElement('option'); none.value = ''; none.textContent = '(zuletzt aktiver)';
      sel.appendChild(none);
      tunnels.forEach(t => {
        const o = document.createElement('option'); o.value = t.id; o.textContent = t.name;
        if (t.id === selectedId) o.selected = true;
        sel.appendChild(o);
      });
    } catch (e) {}
  }

  // OP-6 L4: killSwitch ON -> WebRTC gesperrt + an; OFF -> frei.
  function applyWebrtcCoupling(s) {
    const cb = el('set-webrtc');
    const hint = el('webrtc-hint');
    if (s.killSwitch) {
      cb.checked = true; cb.disabled = true;
      if (hint) hint.textContent = 'Bei aktivem Kill-Switch erzwungen deaktiviert.';
    } else {
      cb.disabled = false; cb.checked = !!s.webrtcDisabled;
      if (hint) hint.textContent = 'Frei waehlbar (Kill-Switch aus).';
    }
  }

  function patch(p) { return R.send('settings.update', p).catch(() => {}); }

  function wire() {
    el('set-autoconnect').addEventListener('change', (e) => patch({ autoConnect: e.target.checked }));
    el('set-autoconnect-tunnel').addEventListener('change', (e) => patch({ autoConnectTunnelId: e.target.value || null }));

    el('set-killswitch').addEventListener('change', async (e) => {
      const s = await patch({ killSwitch: e.target.checked });
      // WebRTC-Kopplung sofort spiegeln.
      applyWebrtcCoupling(s || { killSwitch: e.target.checked, webrtcDisabled: el('set-webrtc').checked });
    });

    el('set-notify').addEventListener('input', async (e) => {
      const level = NOTIFY_ORDER[+e.target.value] || 'off';
      el('set-notify-label').textContent = NOTIFY_LABEL[level];
      el('notify-types').classList.toggle('hidden', level !== 'manual');
      await patch({ notifyLevel: level });
    });

    ['status', 'error', 'killSwitch', 'autoConnect'].forEach(k => {
      el('nt-' + k).addEventListener('change', async () => {
        const nt = {
          status: el('nt-status').checked, error: el('nt-error').checked,
          killSwitch: el('nt-killSwitch').checked, autoConnect: el('nt-autoConnect').checked
        };
        await patch({ notifyTypes: nt });
      });
    });

    el('set-log').addEventListener('input', async (e) => {
      const level = LOG_ORDER[+e.target.value] || 'off';
      el('set-log-label').textContent = LOG_LABEL[level];
      await patch({ logLevel: level });
    });

    el('set-webrtc').addEventListener('change', (e) => { if (!e.target.disabled) patch({ webrtcDisabled: e.target.checked }); });
  }

  document.addEventListener('wg:show', (e) => { if (e.detail === 'settings') load(); });
  document.addEventListener('DOMContentLoaded', () => { wire(); });
})(typeof window !== 'undefined' ? window : this);
