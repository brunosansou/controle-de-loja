// Histórico: todos os dias com lançamentos, do mais recente ao mais antigo.
import { formatLong, todayKey } from '../dates.js';
import { money } from './dom.js';

export async function renderHistoryView(root, ctx) {
  const { ledger } = await ctx.refresh();
  const today = todayKey(ctx.now());
  const days = [...ledger.days].reverse();

  const rows = days.map((d) => `
    <li><a class="hist-row" href="${d.date === today ? '#/hoje' : `#/dia/${d.date}`}">
      <span class="hist-date">${formatLong(d.date)}${d.closed ? '' : ' <em class="badge open">Aberto</em>'}</span>
      <span class="hist-nums">
        <span>Féria <b class="in">${money(d.feriaCents)}</b></span>
        <span>Despesa <b class="out">${money(d.despesaCents)}</b></span>
        <span>Saldo <b class="${d.saldoCents < 0 ? 'out' : ''}">${money(d.saldoCents)}</b></span>
      </span>
    </a></li>`);

  root.innerHTML = `
    <h1>Histórico</h1>
    <form class="other-day" data-other-day>
      <label for="other-date">Lançar em outro dia</label>
      <div class="other-day-row">
        <input id="other-date" type="date" max="${today}" required>
        <button type="submit" class="btn secondary">Abrir dia</button>
      </div>
    </form>
    ${rows.length ? `<ul class="ledger history">${rows.join('')}</ul>` : '<p class="empty">Nenhum dia lançado ainda.</p>'}`;

  root.querySelector('[data-other-day]').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const value = root.querySelector('#other-date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return;
    ctx.navigate(value === today ? '#/hoje' : `#/dia/${value}`);
  });
}
