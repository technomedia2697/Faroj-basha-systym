import test from 'node:test';
import assert from 'node:assert/strict';
import { cairoDay, cairoDayRange, orderRef } from '../server/src/models/Counter.js';
import { orderDay, orderRefText } from '../src/utils/orderDay.js';

test('Cairo day cutoff is local midnight (winter and summer)', () => {
  assert.equal(cairoDay(new Date('2026-11-25T21:59:59Z')), '2026-11-25');
  assert.equal(cairoDay(new Date('2026-11-25T22:00:00Z')), '2026-11-26');
  assert.equal(cairoDay(new Date('2026-07-01T20:59:59Z')), '2026-07-01');
  assert.equal(cairoDay(new Date('2026-07-01T21:00:00Z')), '2026-07-02');
});

test('cairoDayRange covers exactly one Cairo day', () => {
  const [s, e] = cairoDayRange('2026-11-26');
  assert.equal(s.toISOString(), '2026-11-25T22:00:00.000Z');
  assert.equal(e.toISOString(), '2026-11-26T22:00:00.000Z');
  const [s2, e2] = cairoDayRange('2026-07-02');
  assert.equal(s2.toISOString(), '2026-07-01T21:00:00.000Z');
  assert.equal(e2.toISOString(), '2026-07-02T21:00:00.000Z');
  assert.equal(cairoDayRange('bad'), null);
});

test('same number on two days gives different refs; legacy orders fall back to createdAt', () => {
  assert.notEqual(orderRef({ order_day: '2026-11-25', order_number: '1' }), orderRef({ order_day: '2026-11-26', order_number: '1' }));
  assert.equal(orderDay({ createdAt: '2026-11-25T22:30:00Z', order_number: 'ORD-X' }), '2026-11-26');
  assert.ok(orderRefText({ order_day: '2026-11-26', order_number: '5' }).includes('2026-11-26 #5'));
});
