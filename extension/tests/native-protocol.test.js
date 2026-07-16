'use strict';
const test = require('node:test');
const assert = require('node:assert');

// Mock-Port + browser.runtime.connectNative vor require setzen.
function mkMockRuntime() {
  const state = { posted: [], msgListeners: [], discListeners: [] };
  const port = {
    onMessage: { addListener: (f) => state.msgListeners.push(f) },
    onDisconnect: { addListener: (f) => state.discListeners.push(f) },
    postMessage: (m) => state.posted.push(m),
    disconnect: () => {}
  };
  state.emit = (m) => state.msgListeners.forEach(f => f(m));
  state.disconnect = () => state.discListeners.forEach(f => f());
  return { runtime: { connectNative: () => port }, _state: state };
}

test('Request-Envelope hat id/type/profileId/payload, Response wird aufgeloest', async () => {
  global.browser = mkMockRuntime();
  const st = global.browser._state;
  const NativeClient = require('../services/native-client.js');
  const client = NativeClient.createClient('profile-xyz', { timeoutMs: 500 });

  const p = client.connect({ id: 't1' }, 'ref-1');
  assert.strictEqual(st.posted.length, 1);
  const req = st.posted[0];
  assert.strictEqual(req.type, 'connect');
  assert.strictEqual(req.profileId, 'profile-xyz');
  assert.strictEqual(req.payload.privateKeyRef, 'ref-1');
  assert.ok(req.id >= 1);

  st.emit({ id: req.id, ok: true, payload: { socksPort: 40000 } });
  const res = await p;
  assert.strictEqual(res.socksPort, 40000);
  delete global.browser;
});

test('Fehler-Response wird zu Error mit code', async () => {
  global.browser = mkMockRuntime();
  const st = global.browser._state;
  delete require.cache[require.resolve('../services/native-client.js')];
  const NativeClient = require('../services/native-client.js');
  const client = NativeClient.createClient('p2', { timeoutMs: 500 });

  const p = client.health();
  const req = st.posted[0];
  st.emit({ id: req.id, ok: false, error: { code: 'E_WIREPROXY_SPAWN', message: 'boom' } });
  await assert.rejects(p, (e) => e.code === 'E_WIREPROXY_SPAWN');
  delete global.browser;
});

test('Host-Event (id:0) erreicht onEvent-Handler', async () => {
  global.browser = mkMockRuntime();
  const st = global.browser._state;
  delete require.cache[require.resolve('../services/native-client.js')];
  const NativeClient = require('../services/native-client.js');
  const client = NativeClient.createClient('p3', { timeoutMs: 500 });
  client.health().catch(() => {});   // erzwingt Port-Erzeugung

  let got = null;
  client.onEvent((evt) => { got = evt; });
  st.emit({ id: 0, type: 'status-changed', payload: { status: 'connected', socksPort: 41000 } });
  assert.ok(got);
  assert.strictEqual(got.type, 'status-changed');
  assert.strictEqual(got.payload.socksPort, 41000);
  delete global.browser;
});
