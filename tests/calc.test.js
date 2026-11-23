import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSaldo, computeLedger, findDay, pendingLossForToday, unclosedPastDays, numberClients } from '../js/calc.js';

let seq = 0;
function e(date, type, amountCents, method = null) {
  seq += 1;
  const ts = new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString();
  return { id: `e${seq}`, date, type, amountCents, description: '', method, createdAt: ts, updatedAt: ts };
}

test('splitSaldo', () => {
  assert.deepEqual(splitSaldo(150000), { arnaldoCents: 105000, gilmarCents: 45000 });
  assert.deepEqual(splitSaldo(1), { arnaldoCents: 1, gilmarCents: 0 });
  assert.deepEqual(splitSaldo(5), { arnaldoCents: 4, gilmarCents: 1 });
  assert.deepEqual(splitSaldo(0), { arnaldoCents: 0, gilmarCents: 0 });
  assert.deepEqual(splitSaldo(-300), { arnaldoCents: 0, gilmarCents: 0 });
});

test('exemplo da spec: féria 2.000, despesa 500', () => {
  const L = computeLedger([
    e('2026-11-15', 'entrada', 120000, 'dinheiro'),
    e('2026-11-15', 'entrada', 80000, 'pix'),
    e('2026-11-15', 'saida', 50000),
  ], {});
  const d = L.days[0];
  assert.equal(d.dinheiroCents, 120000);
  assert.equal(d.pixCents, 80000);
  assert.equal(d.feriaCents, 200000);
  assert.equal(d.saidasCents, 50000);
  assert.equal(d.despesaCents, 50000);
  assert.equal(d.prejuizoAnterior, null);
  assert.equal(d.saldoCents, 150000);
  assert.equal(d.arnaldoCents, 105000);
  assert.equal(d.gilmarCents, 45000);
  assert.equal(d.closed, false);
  assert.equal(L.carryOut, null);
});

test('lançamentos do dia em ordem decrescente de criação', () => {
  const a = e('2026-11-15', 'entrada', 100, 'pix');
  const b = e('2026-11-15', 'saida', 50);
  const L = computeLedger([a, b], {});
  assert.deepEqual(L.days[0].entries.map((x) => x.id), [b.id, a.id]);
});

test('prejuízo pula dia sem movimento e vira despesa no próximo dia com lançamento', () => {
  const L = computeLedger([
    e('2026-11-16', 'entrada', 100000, 'pix'),
    e('2026-11-14', 'entrada', 10000, 'dinheiro'),
    e('2026-11-14', 'saida', 40000),
    e('2026-11-16', 'saida', 10000),
  ], {});
  assert.equal(L.days.length, 2);
  assert.equal(L.days[0].date, '2026-11-14');
  assert.equal(L.days[0].saldoCents, -30000);
  assert.equal(L.days[0].arnaldoCents, 0);
  assert.equal(L.days[0].gilmarCents, 0);
  assert.deepEqual(L.days[1].prejuizoAnterior, { fromDate: '2026-11-14', cents: 30000 });
  assert.equal(L.days[1].despesaCents, 40000);
  assert.equal(L.days[1].saldoCents, 60000);
  assert.equal(L.days[1].arnaldoCents, 42000);
  assert.equal(L.days[1].gilmarCents, 18000);
  assert.equal(L.carryOut, null);
});

test('prejuízo acumula em sequência', () => {
  const L = computeLedger([
    e('2026-11-14', 'saida', 30000),
    e('2026-11-15', 'entrada', 10000, 'dinheiro'),
    e('2026-11-16', 'entrada', 50000, 'dinheiro'),
  ], {});
  assert.equal(L.days[1].saldoCents, -20000);
  assert.deepEqual(L.days[2].prejuizoAnterior, { fromDate: '2026-11-15', cents: 20000 });
  assert.equal(L.days[2].saldoCents, 30000);
});

test('saldo zero não leva nada adiante', () => {
  const L = computeLedger([e('2026-11-14', 'entrada', 100, 'pix'), e('2026-11-14', 'saida', 100)], {});
  assert.equal(L.carryOut, null);
});

test('correção num dia anterior muda o dia seguinte', () => {
  const base = [e('2026-11-14', 'saida', 30000), e('2026-11-15', 'entrada', 50000, 'pix')];
  assert.equal(computeLedger(base, {}).days[1].saldoCents, 20000);
  const corrigido = [{ ...base[0], amountCents: 10000 }, base[1]];
  assert.equal(computeLedger(corrigido, {}).days[1].saldoCents, 40000);
});

test('findDay', () => {
  const L = computeLedger([e('2026-11-14', 'saida', 100)], {});
  assert.equal(findDay(L, '2026-11-14').date, '2026-11-14');
  assert.equal(findDay(L, '2026-11-15'), null);
});

test('pendingLossForToday e unclosedPastDays', () => {
  const L = computeLedger([e('2026-11-14', 'saida', 30000)], {});
  assert.deepEqual(L.carryOut, { fromDate: '2026-11-14', cents: 30000 });
  assert.deepEqual(pendingLossForToday(L, '2026-11-15'), { fromDate: '2026-11-14', cents: 30000 });
  assert.equal(pendingLossForToday(L, '2026-11-14'), null);
  assert.deepEqual(unclosedPastDays(L, '2026-11-15'), ['2026-11-14']);
  assert.deepEqual(unclosedPastDays(L, '2026-11-14'), []);
  const L2 = computeLedger([e('2026-11-14', 'saida', 30000)], {
    '2026-11-14': { date: '2026-11-14', closed: true, closedAt: 'x' },
  });
  assert.deepEqual(unclosedPastDays(L2, '2026-11-15'), []);
  assert.equal(L2.days[0].closed, true);
});

test('numberClients: usa o número gravado e numera entradas antigas pela ordem', () => {
  const legado1 = e('2026-11-15', 'entrada', 100, 'pix');
  const saida = e('2026-11-15', 'saida', 50);
  const legado2 = e('2026-11-15', 'entrada', 100, 'dinheiro');
  const novo = { ...e('2026-11-15', 'entrada', 100, 'pix'), clientNumber: 3 };
  const outroDia = { ...e('2026-11-14', 'entrada', 100, 'pix'), clientNumber: 7 };
  const r = numberClients([novo, legado2, outroDia, saida, legado1], '2026-11-15');
  assert.equal(r.byId.get(legado1.id), 1);
  assert.equal(r.byId.get(legado2.id), 2);
  assert.equal(r.byId.get(novo.id), 3);
  assert.equal(r.byId.has(saida.id), false);
  assert.equal(r.byId.has(outroDia.id), false);
  assert.equal(r.next, 4);
});

test('numberClients: dia vazio começa em 1 e número excluído no meio não volta', () => {
  assert.equal(numberClients([], '2026-11-15').next, 1);
  const a = { ...e('2026-11-15', 'entrada', 100, 'pix'), clientNumber: 1 };
  const c = { ...e('2026-11-15', 'entrada', 100, 'pix'), clientNumber: 3 };
  const r = numberClients([a, c], '2026-11-15');
  assert.equal(r.byId.get(c.id), 3);
  assert.equal(r.next, 4);
});
