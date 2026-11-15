// Tela de fechamento do dia: a fita da calculadora.
import { findDay } from '../calc.js';
import { formatLong, formatShort } from '../dates.js';
import { money, dayHash, toast } from './dom.js';

export async function renderClosingView(root, ctx, date) {
  const { ledger } = await ctx.refresh();
  const day = findDay(ledger, date);
  const back = dayHash(date, ctx.now());

  if (!day) {
    root.innerHTML = `
      <a class="back" href="${back}">Voltar</a>
      <h1>Fechamento <span>${formatLong(date)}</span></h1>
      <p class="empty">Nada para fechar neste dia.</p>`;
    return;
  }

  let note;
  if (day.saldoCents < 0) {
    note = `Prejuízo de ${money(-day.saldoCents)} vai como despesa para o próximo dia com movimento.`;
  } else if (day.saldoCents === 0) {
    note = 'Sem sobra hoje.';
  } else {
    note = '';
  }

  root.innerHTML = `
    <a class="back" href="${back}">Voltar</a>
    <h1>Fechamento <span>${formatLong(date)}</span></h1>
    <section class="tape" aria-label="Resumo do fechamento">
      <dl>
        <div class="big"><dt>Féria</dt><dd class="in">${money(day.feriaCents)}</dd></div>
        <div class="sub"><dt>Dinheiro</dt><dd>${money(day.dinheiroCents)}</dd></div>
        <div class="sub"><dt>Pix</dt><dd>${money(day.pixCents)}</dd></div>
        <div class="big"><dt>Despesa</dt><dd class="out">${money(day.despesaCents)}</dd></div>
        ${day.prejuizoAnterior ? `<div class="sub"><dt>inclui prejuízo de ${formatShort(day.prejuizoAnterior.fromDate)}</dt><dd>${money(day.prejuizoAnterior.cents)}</dd></div>` : ''}
        <div class="big total"><dt>Saldo</dt><dd class="${day.saldoCents < 0 ? 'out' : ''}">${money(day.saldoCents)}</dd></div>
        <div class="partner"><dt>Arnaldo (70%)</dt><dd>${money(day.arnaldoCents)}</dd></div>
        <div class="partner"><dt>Gilmar (30%)</dt><dd>${money(day.gilmarCents)}</dd></div>
      </dl>
      ${note ? `<p class="tape-note">${note}</p>` : ''}
    </section>
    ${day.closed
      ? '<p class="empty">Este dia já está fechado.</p>'
      : '<button type="button" class="btn primary" data-action="close">Confirmar fechamento</button>'}`;

  root.querySelector('[data-action="close"]')?.addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    await ctx.store.closeDay(date);
    toast('Dia fechado');
    ctx.navigate(back);
  });
}
