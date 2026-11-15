process.env.TZ = 'America/Sao_Paulo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayKey, parseKey, formatShort, formatLong, isFuture } from '../js/dates.js';

test('todayKey usa fuso local, não UTC', () => {
  assert.equal(todayKey(new Date(2026, 10, 15, 22, 30)), '2026-11-15');
  assert.equal(todayKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('parseKey dá meia-noite local', () => {
  const d = parseKey('2026-11-15');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10);
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 0);
});

test('formatShort / formatLong', () => {
  assert.equal(formatShort('2026-11-14'), '14/11');
  assert.equal(formatLong('2026-11-15'), 'dom 15/11');
  assert.equal(formatLong('2026-11-14'), 'sáb 14/11');
});

test('isFuture', () => {
  const now = new Date(2026, 10, 15, 23, 59);
  assert.equal(isFuture('2026-11-16', now), true);
  assert.equal(isFuture('2026-11-15', now), false);
  assert.equal(isFuture('2026-11-01', now), false);
});
