// Verificação no navegador da tela Hoje e dos lançamentos.
// Uso: node tests/e2e/task5.e2e.mjs [url] [pasta-de-screenshots]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const url = process.argv[2] ?? 'http://127.0.0.1:8765/';
const shots = process.argv[3];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());

const totals = async () => (await page.locator('.totals dd').allTextContents()).map((t) => t.trim());

async function lancar(kind, valor, desc, forma) {
  await page.click(kind === 'entrada' ? 'a.add-in' : 'a.add-out');
  await page.fill('input[name="amount"]', valor);
  if (desc) await page.fill('input[name="description"]', desc);
  if (forma) await page.click(`.method label:has(input[value="${forma}"])`);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.day-head');
}

await page.goto(url);
await page.waitForSelector('.day-head');
assert.deepEqual(await totals(), ['R$ 0,00', 'R$ 0,00', 'R$ 0,00']);

await lancar('entrada', '1.200,00', 'venda balcão', 'dinheiro');
await lancar('entrada', '800', 'pix cliente', 'pix');
await lancar('saida', '500', 'fornecedor');
assert.deepEqual(await totals(), ['R$ 2.000,00', 'R$ 500,00', 'R$ 1.500,00']);
if (shots) await page.screenshot({ path: `${shots}/hoje.png`, fullPage: true });

// Recarregar mantém os dados
await page.reload();
await page.waitForSelector('.day-head');
assert.deepEqual(await totals(), ['R$ 2.000,00', 'R$ 500,00', 'R$ 1.500,00']);
assert.equal(await page.locator('.ledger li').count(), 3);

// Valor inválido mostra erro e não grava
await page.click('a.add-out');
await page.fill('input[name="amount"]', '0');
await page.click('button[type="submit"]');
assert.equal((await page.locator('.form-error').textContent()).trim(), 'Digite um valor maior que zero.');
if (shots) await page.screenshot({ path: `${shots}/form.png` });
await page.click('a.back');
await page.waitForSelector('.day-head');

// Editar
await page.click('.ledger a.row:has-text("fornecedor")');
await page.fill('input[name="amount"]', '600');
await page.click('button[type="submit"]');
await page.waitForSelector('.day-head');
assert.deepEqual(await totals(), ['R$ 2.000,00', 'R$ 600,00', 'R$ 1.400,00']);

// Excluir
await page.click('.ledger a.row:has-text("fornecedor")');
await page.click('[data-action="delete"]');
await page.waitForSelector('.day-head');
assert.deepEqual(await totals(), ['R$ 2.000,00', 'R$ 0,00', 'R$ 2.000,00']);

// Toque duplo em Salvar grava um só lançamento
await page.click('a.add-out');
await page.fill('input[name="amount"]', '10');
await page.locator('button[type="submit"]').dblclick();
await page.waitForSelector('.day-head');
await page.waitForTimeout(300);
assert.equal(await page.locator('.ledger li').count(), 3);

// Descrição com HTML aparece como texto
await lancar('saida', '1', '<b>x</b>');
assert.equal(await page.locator('.ledger b').count(), 0);
assert.ok((await page.locator('.ledger').textContent()).includes('<b>x</b>'));

assert.deepEqual(errors, []);
await browser.close();
console.log('E2E task5: OK');
