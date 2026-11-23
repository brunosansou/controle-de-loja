// Tela de um dia: "Hoje" e o detalhe de um dia do histórico.
import { findDay, numberClients, pendingLossForToday, unclosedPastDays } from '../calc.js';
import { formatLong, formatShort, todayKey } from '../dates.js';
import { escapeHtml, money, timeOf } from './dom.js';
import { icon } from './icons.js';

export async function renderDayView(root, ctx, date) {
  const { entries, ledger } = await ctx.refresh();
  const today = todayKey(ctx.now());
  const isToday = date === today;
  const day = findDay(ledger, date);
  const closed = day?.closed === true;

  const alert = (html) => `<p class="alert">${icon('info')}<span>${html}</span></p>`;
  const alerts = [];
  if (isToday) {
    const pending = pendingLossForToday(ledger, today);
    if (pending) {
      alerts.push(alert(`Prejuízo de ${formatShort(pending.fromDate)} (${money(pending.cents)}) entra como despesa no primeiro lançamento de hoje.`));
    }
    for (const d of unclosedPastDays(ledger, today)) {
      alerts.push(alert(`O dia ${formatShort(d)} não foi fechado. <a href="#/fechar/${d}">Fechar</a>`));
    }
  }

  const saldo = day?.saldoCents ?? 0;
  const clients = numberClients(entries, date);
  const rows = [];
  if (day?.prejuizoAnterior) {
    rows.push(`<li class="row auto">
      <span class="avatar out">${icon('receipt')}</span>
      <span class="what">Prejuízo de ${formatShort(day.prejuizoAnterior.fromDate)}<small>Lançado automaticamente</small></span>
      <span class="amount out">−${money(day.prejuizoAnterior.cents)}</span>
    </li>`);
  }
  for (const e of day?.entries ?? []) {
    const isIn = e.type === 'entrada';
    const label = e.description || (isIn ? 'Entrada' : 'Saída');
    const meta = isIn
      ? `Cliente ${clients.byId.get(e.id)} · ${e.method === 'pix' ? 'Pix' : 'Dinheiro'} às ${timeOf(e.createdAt)}`
      : `às ${timeOf(e.createdAt)}`;
    const inner = `<span class="avatar ${isIn ? 'in' : 'out'}">${icon(isIn ? 'add' : 'remove')}</span>
      <span class="what">${escapeHtml(label)}<small>${meta}</small></span>
      <span class="amount ${isIn ? 'in' : 'out'}">${isIn ? '+' : '−'}${money(e.amountCents)}</span>`;
    rows.push(closed ? `<li class="row">${inner}</li>` : `<li><a class="row" href="#/editar/${encodeURIComponent(e.id)}">${inner}</a></li>`);
  }

  const emptyText = closed ? 'Nenhum lançamento neste dia.' : 'Nenhum lançamento ainda. Toque em Entrada ou Saída para começar.';
  const actions = closed
    ? `<button type="button" class="btn tonal" data-action="reopen">${icon('lockOpen')}Reabrir dia</button>`
    : `${day ? `<a class="btn tonal" href="#/fechar/${date}">${icon('receipt')}Fechar dia</a>` : ''}
       <div class="add-pair">
         <a class="btn add-in" href="#/lancar/entrada/${date}">${icon('add')}Entrada</a>
         <a class="btn add-out" href="#/lancar/saida/${date}">${icon('remove')}Saída</a>
       </div>`;

  root.innerHTML = `
    <header class="day-head top-bar">
      ${isToday ? '' : `<a class="back icon-btn" href="#/historico" aria-label="Voltar para o histórico">${icon('back')}</a>`}
      <h1>${isToday ? 'Hoje' : 'Dia'} <span>${formatLong(date)}</span></h1>
      ${closed ? `<em class="badge">${icon('lock')}Fechado</em>` : ''}
    </header>
    <section class="hero${saldo < 0 ? ' negative' : ''}" aria-label="Resumo do dia">
      <dl class="totals">
        <div class="t-feria"><dt>Féria</dt><dd class="in">${money(day?.feriaCents ?? 0)}</dd></div>
        <div class="t-despesa"><dt>Despesa</dt><dd class="out">${money(day?.despesaCents ?? 0)}</dd></div>
        <div class="t-saldo"><dt>Saldo do dia</dt><dd>${money(saldo)}</dd></div>
      </dl>
    </section>
    <div class="alerts" data-alerts>${alerts.join('')}</div>
    ${rows.length ? `<ul class="ledger">${rows.join('')}</ul>` : `<p class="empty">${icon('receipt', 'big')}<span>${emptyText}</span></p>`}
    <div class="day-actions">${actions}</div>`;

  root.querySelector('[data-action="reopen"]')?.addEventListener('click', async () => {
    if (!confirm('Corrigir este dia pode alterar os dias seguintes. Reabrir?')) return;
    await ctx.store.reopenDay(date);
    ctx.navigate(location.hash);
  });

  if (isToday && ctx.todayExtras) await ctx.todayExtras(root.querySelector('[data-alerts]'), { entries });
}
