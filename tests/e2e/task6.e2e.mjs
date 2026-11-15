// Verificação no navegador do fechamento e do histórico.
// Uso: node tests/e2e/task6.e2e.mjs [url] [pasta-de-screenshots]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const url = process.argv[2] ?? 'http://127.0.0.1:8765/';
const shots = process.argv[3];
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(2026, 10, 15, 14, 0));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.goto(url);
  await page.waitForSelector('.day-head');
  return page;
}

const text = async (page, sel) => (await page.locator(sel).textContent()).replace(/\s+/g, ' ').trim();
const totals = async (page) => (await page.locator('.totals dd').allTextContents()).map((t) => t.trim());
const tapeValue = async (page, label) =>
  (await page.locator(`.tape dl > div:has(dt:text-is("${label}")) dd`).textContent()).trim();

async function lancar(page, kind, valor, desc, forma) {
  await page.click(kind === 'entrada' ? 'a.add-in' : 'a.add-out');
  await page.fill('input[name="amount"]', valor);
  if (desc) await page.fill('input[name="description"]', desc);
  if (forma) await page.click(`.method label:has(input[value="${forma}"])`);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.day-head');
}

async function abrirDia(page, date) {
  await page.click('.tabs a[data-tab="historico"]');
  await page.waitForSelector('[data-other-day]');
  await page.fill('#other-date', date);
  await page.click('[data-other-day] button');
  await page.waitForSelector('.day-head');
}

// --- Fechamento do exemplo da spec
const page = await newPage();
await lancar(page, 'entrada', '1200', 'venda', 'dinheiro');
await lancar(page, 'entrada', '800', 'pix', 'pix');
await lancar(page, 'saida', '500', 'fornecedor');
await page.click('a.btn:has-text("Fechar dia")');
await page.waitForSelector('.tape');
assert.equal(await tapeValue(page, 'Féria'), 'R$ 2.000,00');
assert.equal(await tapeValue(page, 'Dinheiro'), 'R$ 1.200,00');
assert.equal(await tapeValue(page, 'Pix'), 'R$ 800,00');
assert.equal(await tapeValue(page, 'Despesa'), 'R$ 500,00');
assert.equal(await tapeValue(page, 'Saldo'), 'R$ 1.500,00');
assert.equal(await tapeValue(page, 'Arnaldo (70%)'), 'R$ 1.050,00');
assert.equal(await tapeValue(page, 'Gilmar (30%)'), 'R$ 450,00');
if (shots) await page.screenshot({ path: `${shots}/fechamento.png`, fullPage: true });
await page.click('[data-action="close"]');
await page.waitForSelector('.day-head .badge');
assert.equal(await page.locator('a.add-in').count(), 0);
assert.equal(await page.locator('.ledger a.row').count(), 0); // lançamentos não editáveis

// --- Prejuízo pula dia sem movimento
await abrirDia(page, '2026-11-12');
await lancar(page, 'saida', '400', 'aluguel');
await lancar(page, 'entrada', '100', 'venda', 'dinheiro');
assert.deepEqual(await totals(page), ['R$ 100,00', 'R$ 400,00', '-R$ 300,00']);
await abrirDia(page, '2026-11-14');
await lancar(page, 'entrada', '1000', 'venda', 'pix');
assert.ok((await text(page, '.ledger')).includes('Prejuízo de 12/11'));
assert.deepEqual(await totals(page), ['R$ 1.000,00', 'R$ 300,00', 'R$ 700,00']);

// --- Corrigir o dia 12 atualiza o dia 14
await abrirDia(page, '2026-11-12');
await page.click('.ledger a.row:has-text("aluguel")');
await page.fill('input[name="amount"]', '200');
await page.click('button[type="submit"]');
await page.waitForSelector('.day-head');
await abrirDia(page, '2026-11-14');
assert.deepEqual(await totals(page), ['R$ 1.000,00', 'R$ 100,00', 'R$ 900,00']);

// --- Avisos de dias não fechados na tela Hoje
await page.click('.tabs a[data-tab="hoje"]');
await page.waitForSelector('h1:text-matches("^Hoje")');
const alerts = await text(page, '[data-alerts]');
assert.ok(alerts.includes('O dia 12/11 não foi fechado.'), alerts);
assert.ok(alerts.includes('O dia 14/11 não foi fechado.'), alerts);
if (shots) await page.screenshot({ path: `${shots}/hoje-avisos.png`, fullPage: true });

// --- Fechar dia com prejuízo pelo aviso, depois reabrir
await page.click('[data-alerts] a[href="#/fechar/2026-11-12"]');
await page.waitForSelector('.tape');
assert.equal(await tapeValue(page, 'Arnaldo (70%)'), 'R$ 0,00');
assert.equal(await tapeValue(page, 'Gilmar (30%)'), 'R$ 0,00');
assert.equal(await text(page, '.tape-note'), 'Prejuízo de R$ 100,00 vai como despesa para o próximo dia com movimento.');
await page.click('[data-action="close"]');
await page.waitForSelector('.day-head .badge');
await page.click('[data-action="reopen"]');
await page.waitForSelector('a.add-in');

// --- Dia sem lançamentos
await page.goto(`${url}#/fechar/2026-11-13`);
await page.waitForSelector('.empty');
assert.equal(await text(page, '.empty'), 'Nada para fechar neste dia.');

// --- Histórico em ordem decrescente
await page.click('.tabs a[data-tab="historico"]');
await page.waitForSelector('.history');
const dates = (await page.locator('.hist-date').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
assert.deepEqual(dates, ['dom 15/11', 'sáb 14/11 Aberto', 'qui 12/11 Aberto']);
if (shots) await page.screenshot({ path: `${shots}/historico.png`, fullPage: true });

// --- Prejuízo pendente aparece em Hoje sem lançamentos
const p2 = await newPage();
await abrirDia(p2, '2026-11-14');
await lancar(p2, 'saida', '300', 'conta');
await p2.click('.tabs a[data-tab="hoje"]');
await p2.waitForSelector('h1:text-matches("^Hoje")');
const a2 = await text(p2, '[data-alerts]'); assert.ok(a2.includes('Prejuízo de 14/11 (R$ 300,00) entra como despesa no primeiro lançamento de hoje.'), a2);

assert.deepEqual(errors, []);
await browser.close();
console.log('E2E task6: OK');
