// Datas como chave 'YYYY-MM-DD' no fuso local do aparelho.
// Nunca usar toISOString() nem new Date('YYYY-MM-DD') para o dia.

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad = (n) => String(n).padStart(2, '0');

export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatShort(key) {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
}

export function formatLong(key) {
  return `${WEEKDAYS[parseKey(key).getDay()]} ${formatShort(key)}`;
}

export function isFuture(key, now = new Date()) {
  return key > todayKey(now);
}
