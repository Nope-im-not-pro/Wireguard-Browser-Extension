'use strict';
// View-Schicht Neuer Tunnel (1-2-1 Datei-Import / 1-2-2 Haendisch, Plan 7).
(function (global) {
  const R = global.WGRouter;

  function msg(text, ok) {
    const el = document.getElementById('tunnel-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'msg ' + (ok ? 'ok' : 'bad');
    el.classList.remove('hidden');
  }

  function wire() {
    const btnFile = document.getElementById('btn-file-import');
    const fileInput = document.getElementById('file-input');
    if (btnFile && fileInput) {
      btnFile.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        const text = await f.text();
        const name = f.name.replace(/\.conf$/i, '');
        try {
          const t = await R.send('tunnel.import', { text, name });
          msg('Tunnel gespeichert: ' + t.name + ipv6LeakWarn(t), true);
        } catch (e) {
          msg(formatErr(e), false);
        }
        fileInput.value = '';
      });
    }
  }

  // F-14: Fehlerliste mit Feldbezug lesbar aufbereiten.
  function formatErr(e) {
    if (e.errors && e.errors.length) {
      return 'Import-Fehler:\n' + e.errors.map(x => '- ' + x.field + ': ' + x.message).join('\n');
    }
    return e.message || 'Import fehlgeschlagen';
  }

  // B3: fehlt ::/0 im importierten Tunnel, kann reale IPv6 am Tunnel vorbei leaken.
  // Nicht-blockierend, nur aus zurueckgegebenem Tunnel-Objekt (keine Key-Beruehrung).
  function ipv6LeakWarn(t) {
    const ips = (t && t.peer && Array.isArray(t.peer.allowedIPs)) ? t.peer.allowedIPs : [];
    const hasV6 = ips.some(a => String(a).trim() === '::/0');
    return hasV6 ? '' : '\nWarnung: IPv6 nicht getunnelt - reale IPv6 kann leaken. AllowedIPs ::/0 ergaenzen.';
  }

  global.WGTunnelView = { formatErr, ipv6LeakWarn };
  document.addEventListener('DOMContentLoaded', wire);
})(typeof window !== 'undefined' ? window : this);
