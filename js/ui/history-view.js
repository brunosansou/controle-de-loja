// Histórico: todos os dias com lançamentos, do mais recente ao mais antigo.
import { formatLong, parseKey, todayKey } from '../dates.js';
import { money } from './dom.js';
import { icon } from './icons.js';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export async function renderHistoryView(root, ctx) {
  const { ledger } = await ctx.refresh();
  const today = todayKey(ctx.now());
  const days = [...ledger.days].reverse();

  const rows = days.map((d) => {
    const dt = parseKey(d.date);
    return `
    <li><a class="hist-row" href="${d.date === today ? '#/hoje' : `#/dia/${d.date}`}">
      <span class="date-avatar${d.closed ? '' : ' open'}" aria-hidden="true"><b>${dt.getDate()}</b><small>${WEEKDAYS[dt.getDay()]}</small></span>
      <span class="hist-main">
        <span class="hist-date">${formatLong(d.date)}${d.closed ? '' : ' <em class="badge open">Aberto</em>'}</span>
        <span class="hist-nums">
          <span>Féria <b class="in">${money(d.feriaCents)}</b></span>
          <span>Despesa <b class="out">${money(d.despesaCents)}</b></span>
          <span class="hist-saldo">Saldo <b class="${d.saldoCents < 0 ? 'out' : ''}">${money(d.saldoCents)}</b></span>
        </span>
      </span>
    </a></li>`;
  });

  root.innerHTML = `
    <header class="top-bar"><h1>Histórico</h1></header>
    <form class="other-day" data-other-day>
      <label class="field outlined">
        <span class="field-label">Lançar em outro dia</span>
        <input id="other-date" type="date" max="${today}" required>
      </label>
      <button type="submit" class="btn tonal">Abrir dia</button>
    </form>
    ${rows.length
      ? `<ul class="ledger history">${rows.join('')}</ul>`
      : `<p class="empty">${icon('history', 'big')}<span>Nenhum dia lançado ainda.</span></p>`}`;

  root.querySelector('[data-other-day]').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const value = root.querySelector('#other-date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return;
    ctx.navigate(value === today ? '#/hoje' : `#/dia/${value}`);
  });
}
