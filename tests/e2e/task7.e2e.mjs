// Verificação no navegador do backup (exportar, importar) e do lembrete.
// Uso: node tests/e2e/task7.e2e.mjs [url] [pasta-de-screenshots]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:8765/';
const shots = process.argv[3];
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const dir = await mkdtemp(join(tmpdir(), 'loja-e2e-'));

async function newPage(time) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, acceptDownloads: true });
  // Força o caminho de download (sem a tela de compartilhar do sistema).
  await context.addInitScript(() => { navigator.canShare = undefined; });
  const page = await context.newPage();
  await page.clock.setFixedTime(time);
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.goto(url);
  await page.waitForSelector('.day-head');
  return page;
}
const text = async (page, sel) => ((await page.locator(sel).textContent()) ?? '').replace(/\s+/g, ' ').trim();
const totals = async (page) => (await page.locator('.totals dd').allTextContents()).map((t) => t.trim());

// Lançamento em 01/11, nunca houve backup
const page = await newPage(new Date(2026, 10, 1, 10, 0));
await page.click('a.add-in');
await page.fill('input[name="amount"]', '250');
await page.click('button[type="submit"]');
await page.waitForSelector('.ledger');
assert.ok(!(await text(page, '[data-alerts]')).includes('sem backup'));

// 15/11: 14 dias depois, aparece o lembrete
await page.clock.setFixedTime(new Date(2026, 10, 15, 14, 0));
await page.reload();
await page.waitForSelector('h1:text-matches("^Hoje")');
assert.ok((await text(page, '[data-alerts]')).includes('Faz mais de 7 dias sem backup.'));

// Exportar baixa o arquivo e some o lembrete
await page.click('.tabs a[data-tab="backup"]');
await page.waitForSelector('.backup-status');
assert.equal(await text(page, '.backup-status'), 'Nenhum backup feito ainda.');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export"]')]);
assert.equal(download.suggestedFilename(), 'controle-loja-backup-2026-11-15.txt');
const saved = join(dir, download.suggestedFilename());
await download.saveAs(saved);
const data = JSON.parse(await readFile(saved, 'utf8'));
assert.equal(data.app, 'controle-de-loja');
assert.equal(data.entries.length, 1);
await page.waitForSelector('.backup-status:text-matches("Último backup")');
assert.equal(await text(page, '.backup-status'), 'Último backup: 15/11 às 14:00');
if (shots) await page.screenshot({ path: `${shots}/backup.png`, fullPage: true });
await page.click('.tabs a[data-tab="hoje"]');
await page.waitForSelector('h1:text-matches("^Hoje")');
assert.ok(!(await text(page, '[data-alerts]')).includes('sem backup'));

// Arquivo inválido não altera nada
await page.click('.tabs a[data-tab="backup"]');
await page.waitForSelector('.backup-status');
await page.setInputFiles('[data-file]', { name: 'qualquer.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
await page.waitForSelector('.form-error:not([hidden])');
assert.equal(await text(page, '.form-error'), 'Este arquivo não é um backup válido do Controle de Loja. Nada foi alterado.');
await page.goto(`${url}#/dia/2026-11-01`);
await page.waitForSelector('.day-head');
assert.deepEqual(await totals(page), ['R$ 250,00', 'R$ 0,00', 'R$ 250,00']);

// Celular "novo" (dados vazios): importar restaura tudo
const fresh = await newPage(new Date(2026, 10, 15, 15, 0));
await fresh.click('.tabs a[data-tab="backup"]');
await fresh.waitForSelector('.backup-status');
await fresh.setInputFiles('[data-file]', saved);
await fresh.waitForSelector('.backup-status:text-matches("Último backup")');
await fresh.goto(`${url}#/dia/2026-11-01`);
await fresh.waitForSelector('.day-head');
assert.deepEqual(await totals(fresh), ['R$ 250,00', 'R$ 0,00', 'R$ 250,00']);

assert.deepEqual(errors, []);
await browser.close();
console.log('E2E task7: OK');
