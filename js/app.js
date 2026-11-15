// Inicialização e roteador por hash.
import { openIdbBackend } from './idb-backend.js';
import { createStore } from './store.js';
import { computeLedger } from './calc.js';
import { renderDayView } from './ui/day-view.js';
import { renderEntryForm } from './ui/entry-form.js';
import { renderClosingView } from './ui/closing-view.js';
import { renderHistoryView } from './ui/history-view.js';
import { renderBackupView, backupReminder } from './ui/backup-view.js';
import { todayKey } from './dates.js';

const DATE = '(\\d{4}-\\d{2}-\\d{2})';
const routes = [
  { re: /^#\/hoje$/, tab: 'hoje', render: (root, ctx) => renderDayView(root, ctx, todayKey(ctx.now())) },
  { re: new RegExp(`^#/dia/${DATE}$`), tab: 'historico', render: (root, ctx, [date]) => renderDayView(root, ctx, date) },
  {
    re: new RegExp(`^#/lancar/(entrada|saida)/${DATE}$`),
    tab: 'hoje',
    render: (root, ctx, [type, date]) => renderEntryForm(root, ctx, { mode: 'novo', type, date }),
  },
  { re: /^#\/editar\/([\w-]+)$/, tab: 'hoje', render: (root, ctx, [id]) => renderEntryForm(root, ctx, { mode: 'editar', id }) },
  { re: new RegExp(`^#/fechar/${DATE}$`), tab: 'hoje', render: (root, ctx, [date]) => renderClosingView(root, ctx, date) },
  { re: /^#\/historico$/, tab: 'historico', render: (root, ctx) => renderHistoryView(root, ctx) },
  { re: /^#\/backup$/, tab: 'backup', render: (root, ctx) => renderBackupView(root, ctx) },
];

async function main() {
  const root = document.getElementById('app');
  let store;
  try {
    store = createStore(await openIdbBackend());
  } catch (err) {
    root.innerHTML = '<p class="fatal">Não foi possível abrir os dados deste celular. Feche e abra o app de novo.</p>';
    throw err;
  }

  const ctx = {
    store,
    now: () => new Date(),
    navigate(hash) {
      if (location.hash === hash) render();
      else location.hash = hash;
    },
    async refresh() {
      const [entries, dayStates] = await Promise.all([store.listEntries(), store.getDayStates()]);
      return { entries, dayStates, ledger: computeLedger(entries, dayStates) };
    },
    todayExtras: (alertsEl, data) => backupReminder(alertsEl, ctx, data),
  };

  let renderSeq = 0;
  async function render() {
    const seq = ++renderSeq;
    const hash = location.hash || '#/hoje';
    for (const route of routes) {
      const m = hash.match(route.re);
      if (!m) continue;
      document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === route.tab));
      const view = document.createElement('div');
      view.className = 'view';
      await route.render(view, ctx, m.slice(1));
      if (seq !== renderSeq) return; // uma navegação mais nova já começou
      root.replaceChildren(view);
      window.scrollTo(0, 0);
      view.querySelector('[autofocus]')?.focus();
      return;
    }
    location.replace('#/hoje');
  }

  window.addEventListener('hashchange', render);
  // Ao voltar para o app (ex.: depois da meia-noite), redesenha para recalcular "hoje".
  // Não redesenha com um formulário aberto, para não perder o que está sendo digitado.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !document.querySelector('form.entry-form')) render();
  });
  await render();
}

// Pede ao navegador para não apagar os dados deste app quando faltar espaço.
navigator.storage?.persist?.().catch(() => {});

main();
