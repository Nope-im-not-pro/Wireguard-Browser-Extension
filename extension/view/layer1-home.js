'use strict';
// View-Schicht Home (1-1-1/1-1-2/1-1-3 + Status F-03, Plan 7).
(function (global) {
  const R = global.WGRouter;

  function badge(status) {
    const el = document.getElementById('status-badge');
    if (!el) return;
    const map = { disconnected: 'getrennt', connecting: 'verbindet...', connected: 'verbunden', error: 'Fehler' };
    el.textContent = map[status] || status;
    el.className = 'badge badge-' + status;
  }

  function renderState(state) {
    badge(state.status);
    const toggle = document.getElementById('conn-toggle');
    if (toggle) toggle.checked = (state.status === 'connected' || state.status === 'connecting');

    const ksWarn = document.getElementById('killswitch-warning');
    const homeErr = document.getElementById('home-error');
    if (ksWarn) {
      const active = state.lastError && state.lastError.code === 'E_KILLSWITCH_ACTIVE';
      ksWarn.textContent = active ? 'Kill-Switch aktiv: Tunnel ausgefallen, Traffic blockiert.' : '';
      ksWarn.classList.toggle('hidden', !active);
    }
    if (homeErr) {
      const showErr = state.status === 'error' && (!state.lastError || state.lastError.code !== 'E_KILLSWITCH_ACTIVE');
      homeErr.textContent = showErr && state.lastError ? state.lastError.message : '';
      homeErr.classList.toggle('hidden', !showErr);
    }
  }

  async function loadTunnels() {
    const sel = document.getElementById('active-tunnel');
    if (!sel) return;
    try {
      const [tunnels, state] = await Promise.all([R.send('tunnel.list'), R.send('connection.status')]);
      sel.innerHTML = '';
      tunnels.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id; o.textContent = t.name;
        if (t.id === state.activeTunnelId) o.selected = true;
        sel.appendChild(o);
      });
      renderState(state);
    } catch (e) { /* Background evtl. nicht bereit */ }
  }

  function wire() {
    const toggle = document.getElementById('conn-toggle');
    const sel = document.getElementById('active-tunnel');
    if (toggle) toggle.addEventListener('change', async () => {
      try {
        if (toggle.checked) await R.send('connection.connect', { tunnelId: sel ? sel.value : undefined });
        else await R.send('connection.disconnect');
      } catch (e) {
        toggle.checked = false;
        const homeErr = document.getElementById('home-error');
        if (homeErr) { homeErr.textContent = e.message; homeErr.classList.remove('hidden'); }
      }
    });
    if (sel) sel.addEventListener('change', () => R.send('connection.selectActive', { tunnelId: sel.value }).catch(() => {}));

    R.onBackgroundMessage((msg) => {
      if (msg.action === 'connection.stateChanged') renderState(msg.payload);
    });
  }

  document.addEventListener('wg:show', (e) => { if (e.detail === 'home') loadTunnels(); });
  document.addEventListener('DOMContentLoaded', () => { wire(); loadTunnels(); });
})(typeof window !== 'undefined' ? window : this);
