'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('../models/settings.js');
const N = require('../services/notifications.js');

test('defaults enthaelt erwartete Enums und Consts', () => {
  const d = S.defaults();
  assert.strictEqual(d.notifyLevel, 'important');
  assert.strictEqual(d.logLevel, 'error');
  assert.strictEqual(d.dnsRemoteForced, true);
  assert.strictEqual(d.webrtcCoupled, true);
  assert.strictEqual(d.webrtcDisabled, true);   // B1: WebRTC per Default aus
  assert.strictEqual(d.killSwitch, false);
});

test('normalize fuellt fehlende Felder und erzwingt Consts', () => {
  const n = S.normalize({ notifyLevel: 'quatsch', dnsRemoteForced: false, notifyTypes: { status: false } });
  assert.strictEqual(n.notifyLevel, 'important');       // ungueltig -> Default
  assert.strictEqual(n.dnsRemoteForced, true);          // Const erzwungen
  assert.strictEqual(n.notifyTypes.status, false);      // uebernommen
  assert.strictEqual(n.notifyTypes.error, true);        // aus Default gemergt
});

test('webrtcEffective: killSwitch erzwingt aus, sonst User-Toggle (OP-6 L4)', () => {
  assert.strictEqual(S.webrtcEffective({ killSwitch: true, webrtcDisabled: false }), true);
  assert.strictEqual(S.webrtcEffective({ killSwitch: false, webrtcDisabled: false }), false);
  assert.strictEqual(S.webrtcEffective({ killSwitch: false, webrtcDisabled: true }), true);
});

test('shouldNotify: Stufen-Filter', () => {
  const base = S.defaults();
  const off = Object.assign({}, base, { notifyLevel: 'off' });
  assert.ok(!N.shouldNotify(off, 'error'));

  const errors = Object.assign({}, base, { notifyLevel: 'errors' });
  assert.ok(N.shouldNotify(errors, 'error'));
  assert.ok(N.shouldNotify(errors, 'killSwitch'));
  assert.ok(!N.shouldNotify(errors, 'connect'));       // status wird bei 'errors' nicht gemeldet

  const important = Object.assign({}, base, { notifyLevel: 'important' });
  assert.ok(N.shouldNotify(important, 'connect'));      // status
  assert.ok(N.shouldNotify(important, 'error'));

  const all = Object.assign({}, base, { notifyLevel: 'all' });
  assert.ok(N.shouldNotify(all, 'autoConnect'));
});

test('shouldNotify: manual folgt notifyTypes (OP-3)', () => {
  const s = Object.assign({}, S.defaults(), {
    notifyLevel: 'manual',
    notifyTypes: { status: false, error: true, killSwitch: false, autoConnect: false }
  });
  assert.ok(!N.shouldNotify(s, 'connect'));   // status aus
  assert.ok(N.shouldNotify(s, 'error'));      // error an
  assert.ok(!N.shouldNotify(s, 'killSwitch'));
});
