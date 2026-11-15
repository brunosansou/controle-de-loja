// Tela de um dia: "Hoje" e o detalhe de um dia do histórico.
import { findDay, pendingLossForToday, unclosedPastDays } from '../calc.js';
import { formatLong, formatShort, todayKey } from '../dates.js';
import { escapeHtml, money, timeOf } from './dom.js';

export async function renderDayView(root, ctx, date) {
  const { entries, ledger } = await ctx.refresh();
  const today = todayKey(ctx.now());
  const isToday = date === today;
  const day = findDay(ledger, date);
  const closed = day?.closed === true;

  const alerts = [];
  if (isToday) {
    const pending = pendingLossForToday(ledger, today);
    if (pending) {
      alerts.push(`<p class="alert">Prejuízo de ${formatShort(pending.fromDate)} (${money(pending.cents)}) entra como despesa no primeiro lançamento de hoje.</p>`);
    }
    for (const d of unclosedPastDays(ledger, today)) {
      alerts.push(`<p class="alert">O dia ${formatShort(d)} não foi fechado. <a href="#/fechar/${d}">Fechar</a></p>`);
    }
  }

  const saldo = day?.saldoCents ?? 0;
  const rows = [];
  if (day?.prejuizoAnterior) {
    rows.push(`<li class="row auto">
      <span class="time"></span>
      <span class="what">Prejuízo de ${formatShort(day.prejuizoAnterior.fromDate)}<small>automático</small></span>
      <span class="amount out">−${money(day.prejuizoAnterior.cents)}</span>
    </li>`);
  }
  for (const e of day?.entries ?? []) {
    const label = e.description || (e.type === 'entrada' ? 'Entrada' : 'Saída');
    const method = e.type === 'entrada' ? `<small>${e.method === 'pix' ? 'Pix' : 'Dinheiro'}</small>` : '';
    const sign = e.type === 'entrada' ? '+' : '−';
    const inner = `<span class="time">${timeOf(e.createdAt)}</span>
      <span class="what">${escapeHtml(label)}${method}</span>
      <span class="amount ${e.type === 'entrada' ? 'in' : 'out'}">${sign}${money(e.amountCents)}</span>`;
    rows.push(closed ? `<li class="row">${inner}</li>` : `<li><a class="row" href="#/editar/${encodeURIComponent(e.id)}">${inner}</a></li>`);
  }

  const emptyText = closed ? 'Nenhum lançamento.' : 'Nenhum lançamento ainda. Use os botões abaixo.';
  const actions = closed
    ? '<button type="button" class="btn secondary" data-action="reopen">Reabrir dia</button>'
    : `${day ? `<a class="btn secondary" href="#/fechar/${date}">Fechar dia</a>` : ''}
       <div class="add-pair">
         <a class="btn add-in" href="#/lancar/entrada/${date}">+ Entrada</a>
         <a class="btn add-out" href="#/lancar/saida/${date}">− Saída</a>
       </div>`;

  root.innerHTML = `
    <header class="day-head">
      ${isToday ? '' : '<a class="back" href="#/historico">Histórico</a>'}
      <h1>${isToday ? 'Hoje' : 'Dia'} <span>${formatLong(date)}</span>${closed ? ' <em class="badge">Fechado</em>' : ''}</h1>
      <dl class="totals">
        <div><dt>Féria</dt><dd class="in">${money(day?.feriaCents ?? 0)}</dd></div>
        <div><dt>Despesa</dt><dd class="out">${money(day?.despesaCents ?? 0)}</dd></div>
        <div><dt>Saldo</dt><dd class="${saldo < 0 ? 'out' : ''}">${money(saldo)}</dd></div>
      </dl>
    </header>
    <div class="alerts" data-alerts>${alerts.join('')}</div>
    ${rows.length ? `<ul class="ledger">${rows.join('')}</ul>` : `<p class="empty">${emptyText}</p>`}
    <div class="day-actions">${actions}</div>`;

  root.querySelector('[data-action="reopen"]')?.addEventListener('click', async () => {
    if (!confirm('Corrigir este dia pode alterar os dias seguintes. Reabrir?')) return;
    await ctx.store.reopenDay(date);
    ctx.navigate(location.hash);
  });

  if (isToday && ctx.todayExtras) await ctx.todayExtras(root.querySelector('[data-alerts]'), { entries });
}
