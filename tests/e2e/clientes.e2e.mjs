// Verificação no navegador: Pix primeiro e marcado, e numeração de clientes por dia.
// Uso: node tests/e2e/clientes.e2e.mjs [url] [pasta-de-screenshots]
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

async function lancar(kind, valor, desc, forma) {
  await page.click(kind === 'entrada' ? 'a.add-in' : 'a.add-out');
  await page.fill('input[name="amount"]', valor);
  if (desc) await page.fill('input[name="description"]', desc);
  if (forma) await page.click(`.method label:has(input[value="${forma}"])`);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.day-head');
}
const meta = (desc) => page.locator(`.ledger .row:has-text("${desc}") small`).textContent();

await page.goto(url);
await page.waitForSelector('.day-head');

// Pix vem primeiro e já marcado
await page.click('a.add-in');
await page.waitForSelector('form.entry-form .method');
assert.deepEqual(await page.locator('.method input').evaluateAll((els) => els.map((i) => i.value)), ['pix', 'dinheiro']);
assert.equal(await page.locator('.method input:checked').getAttribute('value'), 'pix');
if (shots) await page.screenshot({ path: `${shots}/form-pix.png` });
await page.click('a.back');
await page.waitForSelector('.day-head');

// Sem escolher forma, a entrada é gravada como Pix e numerada
await lancar('entrada', '50', 'primeira');
await lancar('saida', '5', 'troco');
await lancar('entrada', '30', 'segunda', 'dinheiro');
await lancar('entrada', '20', 'terceira');
assert.match(await meta('primeira'), /^Cliente 1 · Pix às /);
assert.match(await meta('segunda'), /^Cliente 2 · Dinheiro às /);
assert.match(await meta('terceira'), /^Cliente 3 · Pix às /);
assert.doesNotMatch(await meta('troco'), /Cliente/);

// Excluir um cliente do meio não muda os outros números
await page.click('.ledger a.row:has-text("segunda")');
await page.waitForSelector('form.entry-form');
assert.match(await page.locator('form.entry-form h1 span').textContent(), /Cliente 2$/);
await page.click('[data-action="delete"]');
await page.waitForSelector('.day-head');
await lancar('entrada', '10', 'quarta');
assert.match(await meta('terceira'), /^Cliente 3 /);
assert.match(await meta('quarta'), /^Cliente 4 /);

// Recarregar mantém os números
await page.reload();
await page.waitForSelector('.day-head');
assert.match(await meta('primeira'), /^Cliente 1 /);
assert.match(await meta('quarta'), /^Cliente 4 /);
if (shots) await page.screenshot({ path: `${shots}/hoje-clientes.png`, fullPage: true });

assert.deepEqual(errors, []);
await browser.close();
console.log('E2E clientes: OK');
