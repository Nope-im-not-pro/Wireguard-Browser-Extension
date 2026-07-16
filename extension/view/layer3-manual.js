'use strict';
// View-Schicht Manuelle Anlage (1-2-2-1-1 Formular F-05 + 1-2-2-1-2 Bulk F-06, Plan 7).
// Live-Validierung F-18 pro Feld (blur/input). Client-seitig leichtgewichtig; harte
// Pruefung erfolgt server-seitig (validation.js via tunnel-controller).
(function (global) {
  const R = global.WGRouter;

  // Minimal-Validatoren fuer Inline-Hinweise (Spiegel der services/validation.js-Regeln).
  function b64len(s) { if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s || '')) return -1; try { return atob(s).length; } catch (e) { return -1; } }
  const V = {
    key: (v) => v === '' || b64len(v) === 32,
    endpoint: (v) => v === '' || /^(\[[0-9A-Fa-f:]+\]|[^:\s]+):\d{1,5}$/.test(v),
    cidrlist: (v) => v === '' || v.split(',').every(p => /\/\d{1,3}$/.test(p.trim()))
  };

  function wireLiveValidation() {
    document.querySelectorAll('#manual-form [data-validate]').forEach(inp => {
      const kind = inp.getAttribute('data-validate');
      const check = () => {
        const ok = V[kind] ? V[kind](inp.value.trim()) : true;
        inp.classList.toggle('invalid', !ok);
      };
      inp.addEventListener('blur', check);
      inp.addEventListener('input', check);
    });
  }

  function readForm(form) {
    const fd = new FormData(form);
    const g = (k) => (fd.get(k) || '').toString().trim();
    return {
      name: g('name') || undefined,
      privateKey: g('privateKey'),
      address: g('address'),
      dns: g('dns'),
      publicKey: g('publicKey'),
      endpoint: g('endpoint'),
      allowedIPs: g('allowedIPs'),
      persistentKeepalive: g('persistentKeepalive')
    };
  }

  function showErrors(elId, e) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (e.errors && e.errors.length) el.textContent = e.errors.map(x => x.field + ': ' + x.message).join('\n');
    else el.textContent = e.message || 'Fehler';
  }

  // B3: fehlt ::/0 im angelegten Tunnel, kann reale IPv6 am Tunnel vorbei leaken.
  // Nicht-blockierend, nur aus zurueckgegebenem Tunnel-Objekt (keine Key-Beruehrung).
  function ipv6LeakWarn(t) {
    const ips = (t && t.peer && Array.isArray(t.peer.allowedIPs)) ? t.peer.allowedIPs : [];
    const hasV6 = ips.some(a => String(a).trim() === '::/0');
    return hasV6 ? '' : '\nWarnung: IPv6 nicht getunnelt - reale IPv6 kann leaken. AllowedIPs ::/0 ergaenzen.';
  }

  function wire() {
    wireLiveValidation();
    const mf = document.getElementById('manual-form');
    if (mf) mf.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      document.getElementById('form-errors').textContent = '';
      try {
        const t = await R.send('tunnel.createManual', readForm(mf));
        document.getElementById('form-errors').textContent = 'Gespeichert: ' + t.name + ipv6LeakWarn(t);
        mf.reset();
      } catch (e) { showErrors('form-errors', e); }
    });

    const bf = document.getElementById('bulk-form');
    if (bf) bf.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      document.getElementById('bulk-errors').textContent = '';
      const fd = new FormData(bf);
      try {
        const t = await R.send('tunnel.import', { text: (fd.get('text') || '').toString(), name: (fd.get('name') || '').toString().trim() || undefined });
        document.getElementById('bulk-errors').textContent = 'Gespeichert: ' + t.name + ipv6LeakWarn(t);
        bf.reset();
      } catch (e) { showErrors('bulk-errors', e); }
    });
  }

  document.addEventListener('DOMContentLoaded', wire);
})(typeof window !== 'undefined' ? window : this);
