// Verificação do caminho real de "Exportar backup" com a tela de compartilhar.
// Uso: node tests/e2e/share.e2e.mjs [url]
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const url = process.argv[2] ?? 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ channel: 'chrome' });

async function backupPage(initScript) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, acceptDownloads: true });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  await page.goto(`${url}#/backup`);
  await page.waitForSelector('.backup-status');
  return page;
}

// 1) O Chrome aceita compartilhar o arquivo que o app gera (não recusa com NotAllowedError).
{
  const page = await backupPage(() => {
    const realShare = navigator.share.bind(navigator);
    window.__shareResult = new Promise((resolve) => {
      navigator.share = (data) => {
        const p = realShare(data);
        p.then(() => resolve('ok'), (e) => resolve(e.name));
        // Se a tela de compartilhar abriu, a promessa fica pendente: conta como aceito.
        setTimeout(() => resolve('pending'), 1500);
        return p;
      };
    });
  });
  await page.click('[data-action="export"]');
  const result = await page.evaluate(() => window.__shareResult);
  assert.notEqual(result, 'NotAllowedError', 'o Chrome recusou compartilhar o arquivo de backup');
  await page.context().close();
}

// 2) Se compartilhar falhar por outro motivo, o app baixa o arquivo em vez de dar erro.
{
  const page = await backupPage(() => {
    navigator.canShare = () => true;
    navigator.share = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('[data-action="export"]')]);
  assert.match(download.suggestedFilename(), /^controle-loja-backup-\d{4}-\d{2}-\d{2}\.txt$/);
  await page.waitForSelector('.backup-status:text-matches("Último backup")');
  await page.context().close();
}

await browser.close();
console.log('E2E share: OK');
