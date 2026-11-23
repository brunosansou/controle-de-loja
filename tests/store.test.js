process.env.TZ = 'America/Sao_Paulo';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, StoreError } from '../js/store.js';
import { createMemoryBackend } from './memory-backend.js';

function makeOpts() {
  let n = 0;
  return { now: () => new Date(2026, 10, 15, 14, 0), newId: () => `id${++n}` };
}
const rejectsCode = (promise, code) =>
  assert.rejects(promise, (err) => err instanceof StoreError && err.code === code);

test('addEntry grava entrada com forma e saída sem forma', async () => {
  const s = createStore(createMemoryBackend(), makeOpts());
  const a = await s.addEntry({ date: '2026-11-15', type: 'entrada', amountCents: 8000, description: '  venda  ', method: 'pix' });
  assert.equal(a.id, 'id1');
  assert.equal(a.description, 'venda');
  assert.equal(a.method, 'pix');
  assert.ok(a.createdAt && a.updatedAt);
  const b = await s.addEntry({ date: '2026-11-15', type: 'saida', amountCents: 500, description: '', method: 'pix' });
  assert.equal(b.method, null);
  assert.equal((await s.listEntries()).length, 2);
});

test('recusas', async () => {
  const s = createStore(createMemoryBackend(), makeOpts());
  const base = { date: '2026-11-15', type: 'entrada', amountCents: 100, description: '', method: 'dinheiro' };
  await rejectsCode(s.addEntry({ ...base, amountCents: 0 }), 'VALOR_INVALIDO');
  await rejectsCode(s.addEntry({ ...base, amountCents: 10.5 }), 'VALOR_INVALIDO');
  await rejectsCode(s.addEntry({ ...base, method: null }), 'FORMA_INVALIDA');
  await rejectsCode(s.addEntry({ ...base, type: 'outro' }), 'TIPO_INVALIDO');
  await rejectsCode(s.addEntry({ ...base, date: '2026-11-16' }), 'DATA_FUTURA');
  await rejectsCode(s.updateEntry('nao-existe', { amountCents: 5 }), 'NAO_ENCONTRADO');
  await rejectsCode(s.deleteEntry('nao-existe'), 'NAO_ENCONTRADO');
  assert.equal((await s.listEntries()).length, 0);
});

test('updateEntry valida e atualiza updatedAt sem mudar tipo/data', async () => {
  let t = new Date(2026, 10, 15, 14, 0);
  const s = createStore(createMemoryBackend(), { now: () => t, newId: () => 'x' });
  const a = await s.addEntry({ date: '2026-11-15', type: 'entrada', amountCents: 100, description: '', method: 'dinheiro' });
  t = new Date(2026, 10, 15, 15, 0);
  const u = await s.updateEntry(a.id, { amountCents: 300, method: 'pix', description: ' ok ', type: 'saida', date: '2026-11-01' });
  assert.equal(u.amountCents, 300);
  assert.equal(u.method, 'pix');
  assert.equal(u.description, 'ok');
  assert.equal(u.type, 'entrada');
  assert.equal(u.date, '2026-11-15');
  assert.equal(u.createdAt, a.createdAt);
  assert.notEqual(u.updatedAt, a.updatedAt);
  await rejectsCode(s.updateEntry(a.id, { amountCents: -1 }), 'VALOR_INVALIDO');
  await rejectsCode(s.updateEntry(a.id, { method: null }), 'FORMA_INVALIDA');
});

test('dia fechado bloqueia lançar/editar/excluir até reabrir', async () => {
  const s = createStore(createMemoryBackend(), makeOpts());
  const a = await s.addEntry({ date: '2026-11-15', type: 'saida', amountCents: 100, description: '', method: null });
  await s.closeDay('2026-11-15');
  const st = (await s.getDayStates())['2026-11-15'];
  assert.equal(st.closed, true);
  assert.ok(st.closedAt);
  await rejectsCode(s.addEntry({ date: '2026-11-15', type: 'saida', amountCents: 1, description: '', method: null }), 'DIA_FECHADO');
  await rejectsCode(s.updateEntry(a.id, { amountCents: 200 }), 'DIA_FECHADO');
  await rejectsCode(s.deleteEntry(a.id), 'DIA_FECHADO');
  await s.reopenDay('2026-11-15');
  assert.equal((await s.getDayStates())['2026-11-15'].closed, false);
  const u = await s.updateEntry(a.id, { amountCents: 200 });
  assert.equal(u.amountCents, 200);
  await s.deleteEntry(a.id);
  assert.equal((await s.listEntries()).length, 0);
});

test('replaceAll substitui tudo e grava lastBackupAt', async () => {
  const s = createStore(createMemoryBackend(), makeOpts());
  assert.equal(await s.getLastBackupAt(), null);
  await s.addEntry({ date: '2026-11-15', type: 'saida', amountCents: 100, description: '', method: null });
  await s.closeDay('2026-11-15');
  await s.replaceAll({ entries: [], days: [], lastBackupAt: '2026-11-10T10:00:00.000Z' });
  assert.equal((await s.listEntries()).length, 0);
  assert.deepEqual(await s.getDayStates(), {});
  assert.equal(await s.getLastBackupAt(), '2026-11-10T10:00:00.000Z');
  await s.setLastBackupAt('2026-11-15T10:00:00.000Z');
  assert.equal(await s.getLastBackupAt(), '2026-11-15T10:00:00.000Z');
});

test('addEntry numera os clientes do dia; saída não tem número; editar mantém', async () => {
  let t = new Date(2026, 10, 15, 14, 0);
  let n = 0;
  const s = createStore(createMemoryBackend(), { now: () => t, newId: () => `id${++n}` });
  const base = { type: 'entrada', amountCents: 100, description: '', method: 'pix' };
  const a = await s.addEntry({ ...base, date: '2026-11-15' });
  const saida = await s.addEntry({ ...base, date: '2026-11-15', type: 'saida', method: null });
  const b = await s.addEntry({ ...base, date: '2026-11-15' });
  const c = await s.addEntry({ ...base, date: '2026-11-15' });
  assert.equal(a.clientNumber, 1);
  assert.equal(b.clientNumber, 2);
  assert.equal(c.clientNumber, 3);
  assert.equal('clientNumber' in saida, false);
  await s.deleteEntry(b.id);
  const d = await s.addEntry({ ...base, date: '2026-11-15' });
  assert.equal(d.clientNumber, 4);
  const u = await s.updateEntry(c.id, { amountCents: 500, clientNumber: 99 });
  assert.equal(u.clientNumber, 3);
  t = new Date(2026, 10, 16, 9, 0);
  const amanha = await s.addEntry({ ...base, date: '2026-11-16' });
  assert.equal(amanha.clientNumber, 1);
});
