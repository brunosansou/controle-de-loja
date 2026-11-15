// Verificação no navegador: app instalável e funcionando sem internet.
// Uso: node tests/e2e/task8.e2e.mjs [url]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:8765/';
// Perfil normal (não anônimo): o Chrome não oferece instalar app em janela anônima.
const profile = await mkdtemp(join(tmpdir(), 'loja-pwa-'));
const context = await chromium.launchPersistentContext(profile, { channel: 'chrome', viewport: { width: 360, height: 740 } });
const browser = context;
const page = context.pages()[0] ?? (await context.newPage());
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url);
await page.waitForSelector('.day-head');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload(); // agora a página é controlada pelo service worker
await page.waitForSelector('.day-head');
assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);

// Instalável segundo o próprio Chrome
const cdp = await context.newCDPSession(page);
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
assert.deepEqual(installabilityErrors, []);
const manifest = await cdp.send('Page.getAppManifest');
assert.deepEqual(manifest.errors, []);

// Lança algo e depois funciona offline, com os dados
await page.click('a.add-in');
await page.fill('input[name="amount"]', '42');
await page.click('button[type="submit"]');
await page.waitForSelector('.ledger');
await context.setOffline(true);
await page.reload();
await page.waitForSelector('.day-head');
assert.equal((await page.locator('.totals dd').first().textContent()).trim(), 'R$ 42,00');
await page.click('.tabs a[data-tab="historico"]');
await page.waitForSelector('.history');
await page.click('.tabs a[data-tab="backup"]');
await page.waitForSelector('.backup-status');

assert.deepEqual(errors, []);
await browser.close();
console.log('E2E task8: OK');
