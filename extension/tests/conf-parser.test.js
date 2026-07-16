'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('../services/conf-parser.js');

const SAMPLE = `# Beispiel
[Interface]
PrivateKey = AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
Address = 10.0.0.2/32, fd00::2/128
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=
Endpoint = vpn.example.com:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25 ; kommentar
`;

test('parst Interface-Felder inkl. Multi-Value', () => {
  const r = P.parse(SAMPLE);
  assert.strictEqual(r._privateKey, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
  assert.deepStrictEqual(r.interface.address, ['10.0.0.2/32', 'fd00::2/128']);
  assert.deepStrictEqual(r.interface.dns, ['1.1.1.1', '1.0.0.1']);
});

test('parst Peer-Felder inkl. Keepalive-Zahl', () => {
  const r = P.parse(SAMPLE);
  assert.strictEqual(r.peer.publicKey, 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=');
  assert.strictEqual(r.peer.endpoint, 'vpn.example.com:51820');
  assert.deepStrictEqual(r.peer.allowedIPs, ['0.0.0.0/0', '::/0']);
  assert.strictEqual(r.peer.persistentKeepalive, 25);
});

test('ignoriert Kommentare und Whitespace, sammelt unbekannte Keys', () => {
  const r = P.parse('[Interface]\n  Address = 10.0.0.1/32  \nFwMark = 0x1\n');
  assert.deepStrictEqual(r.interface.address, ['10.0.0.1/32']);
  assert.ok(r.unknownKeys.includes('Interface.fwmark'));
});

test('leerer/None-Input liefert Grundgeruest', () => {
  const r = P.parse('');
  assert.strictEqual(r._privateKey, '');
  assert.deepStrictEqual(r.peer.allowedIPs, []);
  const r2 = P.parse(null);
  assert.strictEqual(r2.peer.persistentKeepalive, null);
});

test('Keys sind case-insensitiv', () => {
  const r = P.parse('[interface]\naddress=10.0.0.9/32\n[peer]\nendpoint=h:1\n');
  assert.deepStrictEqual(r.interface.address, ['10.0.0.9/32']);
  assert.strictEqual(r.peer.endpoint, 'h:1');
});
