// Formulário de novo lançamento aberto antes da meia-noite e salvo depois:
// o lançamento tem que cair no dia em que foi salvo (hoje), não no dia anterior.
// Uso: node tests/e2e/midnight.e2e.mjs [url]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const url = process.argv[2] ?? 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.clock.setFixedTime(new Date(2026, 10, 14, 23, 58));
await page.goto(url);
await page.waitForSelector('h1:text-matches("^Hoje")');

await page.click('a.add-in');
await page.waitForSelector('form.entry-form');
await page.clock.setFixedTime(new Date(2026, 10, 15, 8, 0)); // passou a noite
await page.fill('input[name="amount"]', '50');
await page.click('button[type="submit"]');
await page.waitForSelector('h1:text-matches("^Hoje")');
assert.ok((await page.locator('h1').textContent()).includes('15/11'));
assert.equal((await page.locator('.totals dd').first().textContent()).trim(), 'R$ 50,00');

await page.goto(`${url}#/dia/2026-11-14`);
await page.waitForSelector('.day-head');
assert.equal((await page.locator('.totals dd').first().textContent()).trim(), 'R$ 0,00');

assert.deepEqual(errors, []);
await browser.close();
console.log('E2E midnight: OK');
