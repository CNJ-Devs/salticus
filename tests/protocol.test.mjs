import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventGate, targetTime, parseInvite, makeInvite, validateEvent } from '../shared/protocol.mjs';

const event = extra => ({ v: 1, id: randomUUID(), session: randomUUID(), seq: 1, sender: 'a'.repeat(64),
  room: randomUUID(), context: 'Episode 1', action: 'sync', position: 60, paused: false, ...extra });

test('different local anchors preserve the same scene without clamping', () => {
  assert.equal(targetTime(660 - 600, 588, 3600), 648);
  assert.equal(targetTime(-12, 20, 3600), 8);
  assert.throws(() => targetTime(-12, 0, 3600));
  assert.throws(() => targetTime(500, 588, 1000));
  assert.throws(() => targetTime(NaN, 0));
});
test('duplicate and late operations are ignored while a restarted sender can send again', () => {
  const gate = new EventGate(), first = event();
  assert.equal(gate.accept(first), true);
  assert.equal(gate.accept(first), false);
  assert.equal(gate.accept({ ...first, id: randomUUID(), seq: 3 }), true);
  assert.equal(gate.accept({ ...first, id: randomUUID(), seq: 2 }), false);
  assert.equal(gate.accept(event()), true);
});
test('invites round trip Unicode room names and reject executable addresses or oversized input', () => {
  const data = { v: 1, room: randomUUID(), name: 'Watch together 🕷️', peer: 'a'.repeat(64), endpoints: [{ host: '::1', port: 37843 }] };
  assert.deepEqual(parseInvite(makeInvite(data)), data);
  assert.throws(() => makeInvite({ ...data, endpoints: [{ host: 'https://evil.invalid/', port: 80 }] }));
  assert.throws(() => makeInvite({ ...data, room: '__proto__' }));
  assert.throws(() => parseInvite(`salticus://join/${'a'.repeat(9000)}`));
  assert.throws(() => validateEvent(event({ paused: 'false' })));
});
