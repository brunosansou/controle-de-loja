import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBRL, formatBRL } from '../js/money.js';

test('parseBRL aceita formatos comuns', () => {
  assert.equal(parseBRL('10'), 1000);
  assert.equal(parseBRL('10,5'), 1050);
  assert.equal(parseBRL('10,50'), 1050);
  assert.equal(parseBRL('10,'), 1000);
  assert.equal(parseBRL('1.234,56'), 123456);
  assert.equal(parseBRL('1234.56'), 123456);
  assert.equal(parseBRL('10.5'), 1050);
  assert.equal(parseBRL('1.234'), 123400); // ponto + 3 dígitos = milhar
  assert.equal(parseBRL('R$ 1.234,56'), 123456);
  assert.equal(parseBRL(' 80 '), 8000);
});

test('parseBRL recusa inválidos', () => {
  for (const t of ['', '0', '0,00', '-5', 'abc', '10,555', '1,2,3']) {
    assert.equal(parseBRL(t), null, t);
  }
});

test('formatBRL', () => {
  assert.equal(formatBRL(123456), 'R$ 1.234,56');
  assert.equal(formatBRL(5), 'R$ 0,05');
  assert.equal(formatBRL(0), 'R$ 0,00');
  assert.equal(formatBRL(100000000), 'R$ 1.000.000,00');
  assert.equal(formatBRL(-30000), '-R$ 300,00');
});
