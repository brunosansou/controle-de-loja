process.env.TZ = 'America/Sao_Paulo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, backupFileName, parseBackup, BackupError, needsBackupReminder } from '../js/backup.js';

const entrada = {
  id: 'a1', date: '2026-11-15', type: 'entrada', amountCents: 8000, description: 'venda',
  method: 'dinheiro', createdAt: '2026-11-15T14:00:00.000Z', updatedAt: '2026-11-15T14:00:00.000Z',
};
const diaFechado = { date: '2026-11-15', closed: true, closedAt: '2026-11-15T21:00:00.000Z' };

test('ida e volta', () => {
  const now = new Date(2026, 10, 15, 22, 0);
  const data = buildBackup({ entries: [entrada], days: [diaFechado] }, now);
  assert.equal(data.app, 'controle-de-loja');
  assert.equal(data.version, 1);
  assert.equal(data.exportedAt, now.toISOString());
  const back = parseBackup(JSON.stringify(data));
  assert.deepEqual(back.entries, [entrada]);
  assert.deepEqual(back.days, [diaFechado]);
  assert.equal(back.exportedAt, data.exportedAt);
  assert.equal(backupFileName(new Date(2026, 10, 15, 22, 0)), 'controle-loja-backup-2026-11-15.json');
});

test('recusa arquivos inválidos', () => {
  const ok = buildBackup({ entries: [entrada], days: [] }, new Date());
  const bads = [
    '', 'não é json', '{}', 'null', '[]',
    JSON.stringify({ ...ok, app: 'outro' }),
    JSON.stringify({ ...ok, version: 2 }),
    JSON.stringify({ ...ok, entries: 'x' }),
    JSON.stringify({ ...ok, days: null }),
    JSON.stringify({ ...ok, entries: [{ ...entrada, amountCents: -1 }] }),
    JSON.stringify({ ...ok, entries: [{ ...entrada, amountCents: 1.5 }] }),
    JSON.stringify({ ...ok, entries: [{ ...entrada, id: '' }] }),
    JSON.stringify({ ...ok, entries: [{ ...entrada, date: '15/11/2026' }] }),
    JSON.stringify({ ...ok, entries: [{ ...entrada, type: 'x' }] }),
    JSON.stringify({ ...ok, entries: [{ ...entrada, type: 'saida', method: 'pix' }] }),
    JSON.stringify({ ...ok, entries: [{ ...entrada, method: null }] }),
    JSON.stringify({ ...ok, days: [{ date: 'x', closed: true }] }),
  ];
  for (const bad of bads) assert.throws(() => parseBackup(bad), BackupError, bad);
});

test('lembrete de backup', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const old = { ...entrada, createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-01T12:00:00Z' };
  assert.equal(needsBackupReminder({ now, lastBackupAt: null, entries: [] }), false);
  assert.equal(needsBackupReminder({ now, lastBackupAt: null, entries: [old] }), true);
  assert.equal(needsBackupReminder({ now, lastBackupAt: null, entries: [{ ...old, createdAt: '2026-11-14T12:00:00Z' }] }), false);
  assert.equal(needsBackupReminder({ now, lastBackupAt: '2026-11-05T12:00:00Z', entries: [old] }), false);
  assert.equal(needsBackupReminder({ now, lastBackupAt: '2026-11-05T12:00:00Z', entries: [old, { ...old, id: 'n', updatedAt: '2026-11-06T12:00:00Z' }] }), true);
  assert.equal(needsBackupReminder({ now, lastBackupAt: '2026-11-10T12:00:00Z', entries: [{ ...old, updatedAt: '2026-11-11T12:00:00Z' }] }), false);
});
