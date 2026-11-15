// Backup: exportar para um arquivo e importar de um arquivo.
import { buildBackup, backupFileName, parseBackup, BackupError, needsBackupReminder } from '../backup.js';
import { formatShort, todayKey } from '../dates.js';
import { timeOf, toast } from './dom.js';

function describeWhen(iso) {
  return `${formatShort(todayKey(new Date(iso)))} às ${timeOf(iso)}`;
}

export async function renderBackupView(root, ctx) {
  const last = await ctx.store.getLastBackupAt();

  root.innerHTML = `
    <h1>Backup</h1>
    <p class="backup-status">${last ? `Último backup: ${describeWhen(last)}` : 'Nenhum backup feito ainda.'}</p>
    <p class="backup-help">Os dados ficam só neste celular. Exporte um backup e guarde o arquivo no Drive ou mande para o seu WhatsApp. Se trocar de celular, é só importar o arquivo.</p>
    <div class="backup-actions">
      <button type="button" class="btn primary" data-action="export">Exportar backup</button>
      <button type="button" class="btn secondary" data-action="import">Importar backup</button>
      <input type="file" accept=".json,application/json" hidden data-file>
    </div>
    <p class="form-error" role="alert" hidden></p>`;

  const errorEl = root.querySelector('.form-error');
  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  };

  root.querySelector('[data-action="export"]').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    showError('');
    try {
      const now = ctx.now();
      const [entries, dayStates] = await Promise.all([ctx.store.listEntries(), ctx.store.getDayStates()]);
      const data = buildBackup({ entries, days: Object.values(dayStates) }, now);
      const file = new File([JSON.stringify(data)], backupFileName(now), { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Backup Controle de Loja' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      }
      await ctx.store.setLastBackupAt(now.toISOString());
      toast('Backup exportado');
      ctx.navigate('#/backup');
    } catch (err) {
      if (err?.name !== 'AbortError') showError('Não foi possível exportar o backup. Tente de novo.');
      btn.disabled = false;
    }
  });

  const fileInput = root.querySelector('[data-file]');
  root.querySelector('[data-action="import"]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    showError('');
    let data;
    try {
      data = parseBackup(await file.text());
    } catch (err) {
      if (err instanceof BackupError) {
        showError('Este arquivo não é um backup válido do Controle de Loja. Nada foi alterado.');
        return;
      }
      throw err;
    }
    const n = data.entries.length;
    const ok = confirm(
      `Isto vai substituir TODOS os dados deste celular pelos do backup de ${describeWhen(data.exportedAt)} (${n} ${n === 1 ? 'lançamento' : 'lançamentos'}). Continuar?`,
    );
    if (!ok) return;
    await ctx.store.replaceAll({ entries: data.entries, days: data.days, lastBackupAt: data.exportedAt });
    toast('Backup restaurado');
    ctx.navigate('#/backup');
  });
}

/** Aviso na tela Hoje quando faz 7 dias ou mais sem backup. */
export async function backupReminder(alertsEl, ctx, { entries }) {
  const lastBackupAt = await ctx.store.getLastBackupAt();
  if (!needsBackupReminder({ now: ctx.now(), lastBackupAt, entries })) return;
  const p = document.createElement('p');
  p.className = 'alert';
  p.innerHTML = 'Faz mais de 7 dias sem backup. <a href="#/backup">Fazer backup</a>';
  alertsEl.appendChild(p);
}
