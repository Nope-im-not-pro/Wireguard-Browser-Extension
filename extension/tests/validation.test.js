'use strict';
const test = require('node:test');
const assert = require('node:assert');
const V = require('../services/validation.js');

// 32-Byte-Base64: 43 Zeichen + '='.
const KEY32 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

test('isWgKey akzeptiert 32-Byte-Base64, lehnt anderes ab', () => {
  assert.ok(V.isWgKey(KEY32));
  assert.ok(!V.isWgKey('kurz'));
  assert.ok(!V.isWgKey('AAAA'));           // 3 Byte
  assert.ok(!V.isWgKey('!!!nichtbase64'));
});

test('isEndpoint prueft host:port inkl. IPv6-Brackets', () => {
  assert.ok(V.isEndpoint('vpn.example.com:51820'));
  assert.ok(V.isEndpoint('10.0.0.1:1'));
  assert.ok(V.isEndpoint('[fd00::1]:51820'));
  assert.ok(!V.isEndpoint('vpn.example.com'));       // kein Port
  assert.ok(!V.isEndpoint('host:0'));                // Port < 1
  assert.ok(!V.isEndpoint('host:70000'));            // Port > 65535
});

test('isCidr prueft IPv4/IPv6-Prefix', () => {
  assert.ok(V.isCidr('10.0.0.0/24'));
  assert.ok(V.isCidr('0.0.0.0/0'));
  assert.ok(V.isCidr('fd00::/64'));
  assert.ok(!V.isCidr('10.0.0.0'));      // kein Prefix
  assert.ok(!V.isCidr('10.0.0.0/33'));   // Prefix zu gross
});

test('fullTunnelGaps: erkennt Praesenz von 0.0.0.0/0 und ::/0 (B3)', () => {
  assert.deepStrictEqual(V.fullTunnelGaps(['0.0.0.0/0']), { ipv4: true, ipv6: false });
  assert.deepStrictEqual(V.fullTunnelGaps(['0.0.0.0/0', '::/0']), { ipv4: true, ipv6: true });
  assert.deepStrictEqual(V.fullTunnelGaps([' ::/0 ']), { ipv4: false, ipv6: true });
  assert.deepStrictEqual(V.fullTunnelGaps([]), { ipv4: false, ipv6: false });
  assert.deepStrictEqual(V.fullTunnelGaps(undefined), { ipv4: false, ipv6: false });
});

test('validateParsed: valide Konfig ist gruen', () => {
  const parsed = {
    _privateKey: KEY32,
    interface: { address: ['10.0.0.2/32'], dns: ['1.1.1.1'] },
    peer: { publicKey: KEY32, endpoint: 'h.example:51820', allowedIPs: ['0.0.0.0/0'], persistentKeepalive: 25 }
  };
  const r = V.validateParsed(parsed);
  assert.ok(r.valid, JSON.stringify(r.errors));
  assert.strictEqual(r.errors.length, 0);
});

test('validateParsed: fehlende Pflichtfelder werden gemeldet', () => {
  const r = V.validateParsed({ _privateKey: '', interface: { address: [] }, peer: {} });
  const fields = r.errors.map(e => e.field);
  assert.ok(!r.valid);
  assert.ok(fields.includes('PrivateKey'));
  assert.ok(fields.includes('Address'));
  assert.ok(fields.includes('Peer.PublicKey'));
  assert.ok(fields.includes('Peer.Endpoint'));
});

test('validateParsed: Formatfehler bei falschem Key/Endpoint', () => {
  const r = V.validateParsed({
    _privateKey: 'zukurz', interface: { address: ['nope'] },
    peer: { publicKey: 'zukurz', endpoint: 'kein-port', allowedIPs: ['x'] }
  });
  const codes = r.errors.map(e => e.code);
  assert.ok(codes.includes('FORMAT'));
  assert.ok(!r.valid);
});
