// Helpers de interface.
import { formatBRL } from '../money.js';
import { todayKey } from '../dates.js';

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const money = (cents) => escapeHtml(formatBRL(cents));

export function timeOf(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Rota da tela de um dia: "Hoje" usa #/hoje. */
export function dayHash(date, now = new Date()) {
  return date === todayKey(now) ? '#/hoje' : `#/dia/${date}`;
}

const ERROR_TEXT = {
  VALOR_INVALIDO: 'Digite um valor maior que zero.',
  FORMA_INVALIDA: 'Escolha Dinheiro ou Pix.',
  TIPO_INVALIDO: 'Tipo de lançamento inválido.',
  DATA_INVALIDA: 'Data inválida.',
  DATA_FUTURA: 'Não dá para lançar em uma data futura.',
  DIA_FECHADO: 'Este dia está fechado. Reabra para alterar.',
  NAO_ENCONTRADO: 'Lançamento não encontrado.',
};

export function errorText(err) {
  return ERROR_TEXT[err?.code] ?? 'Não foi possível salvar. Tente de novo.';
}

let toastTimer;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
