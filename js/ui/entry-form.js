// Formulário de lançamento (novo ou editar).
import { parseBRL, formatBRL } from '../money.js';
import { formatLong, todayKey } from '../dates.js';
import { escapeHtml, errorText, dayHash, toast } from './dom.js';

export async function renderEntryForm(root, ctx, { mode, type, date, id }) {
  let entry = null;
  if (mode === 'editar') {
    entry = (await ctx.store.listEntries()).find((e) => e.id === id);
    if (!entry) {
      root.innerHTML = '<p class="empty">Lançamento não encontrado. <a href="#/hoje">Voltar para hoje</a></p>';
      return;
    }
    type = entry.type;
    date = entry.date;
  }
  const isIn = type === 'entrada';
  const method = entry?.method ?? 'dinheiro';
  const amountText = entry ? formatBRL(entry.amountCents).replace('R$ ', '') : '';
  // Um novo lançamento aberto para "hoje" acompanha o dia em que for salvo
  // (ex.: formulário aberto antes da meia-noite e salvo de manhã).
  const followsToday = mode === 'novo' && date === todayKey(ctx.now());
  const currentDate = () => (followsToday ? todayKey(ctx.now()) : date);
  let back = dayHash(date, ctx.now());
  const noun = isIn ? 'entrada' : 'saída';

  root.innerHTML = `
    <form class="entry-form ${isIn ? 'is-in' : 'is-out'}" novalidate>
      <a class="back" href="${back}">Voltar</a>
      <h1>${mode === 'editar' ? 'Editar' : 'Nova'} ${noun} <span>${formatLong(date)}</span></h1>
      <label class="field">
        <span>Valor</span>
        <span class="money-input"><span aria-hidden="true">R$</span><input name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${escapeHtml(amountText)}"${mode === 'novo' ? ' autofocus' : ''}></span>
      </label>
      <label class="field">
        <span>Descrição (opcional)</span>
        <input name="description" maxlength="80" autocomplete="off" placeholder="${isIn ? 'ex.: venda balcão' : 'ex.: fornecedor'}" value="${escapeHtml(entry?.description ?? '')}">
      </label>
      ${isIn ? `
      <fieldset class="field method">
        <legend>Forma</legend>
        <label><input type="radio" name="method" value="dinheiro"${method === 'dinheiro' ? ' checked' : ''}><span>Dinheiro</span></label>
        <label><input type="radio" name="method" value="pix"${method === 'pix' ? ' checked' : ''}><span>Pix</span></label>
      </fieldset>` : ''}
      <p class="form-error" role="alert" hidden></p>
      <button type="submit" class="btn primary">Salvar ${noun}</button>
      ${mode === 'editar' ? '<button type="button" class="btn danger" data-action="delete">Excluir lançamento</button>' : ''}
    </form>`;

  const form = root.querySelector('form');
  const errorEl = form.querySelector('.form-error');
  const saveBtn = form.querySelector('button[type="submit"]');
  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };

  if (followsToday) {
    const titleDate = form.querySelector('h1 span');
    const onVisible = () => {
      if (!form.isConnected) return document.removeEventListener('visibilitychange', onVisible);
      if (document.visibilityState === 'visible') titleDate.textContent = formatLong(currentDate());
    };
    document.addEventListener('visibilitychange', onVisible);
  }

  let busy = false;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (busy) return; // evita lançamento repetido em toque duplo
    const amountCents = parseBRL(form.elements.amount.value);
    if (amountCents === null) {
      showError('Digite um valor maior que zero.');
      form.elements.amount.focus();
      return;
    }
    const fields = {
      amountCents,
      description: form.elements.description.value,
      method: isIn ? form.querySelector('input[name="method"]:checked')?.value ?? null : null,
    };
    busy = true;
    saveBtn.disabled = true;
    try {
      if (mode === 'editar') {
        await ctx.store.updateEntry(entry.id, fields);
      } else {
        const saveDate = currentDate();
        back = dayHash(saveDate, ctx.now());
        await ctx.store.addEntry({ date: saveDate, type, ...fields });
      }
      toast(mode === 'editar' ? 'Lançamento salvo' : `${isIn ? 'Entrada' : 'Saída'} salva`);
      ctx.navigate(back);
    } catch (err) {
      showError(errorText(err));
      busy = false;
      saveBtn.disabled = false;
    }
  });

  form.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      await ctx.store.deleteEntry(entry.id);
      toast('Lançamento excluído');
      ctx.navigate(back);
    } catch (err) {
      showError(errorText(err));
    }
  });
}
