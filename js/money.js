// Valores de dinheiro são sempre inteiros em centavos.

/**
 * Converte texto digitado em centavos.
 * Retorna null se for inválido ou se o valor não for maior que zero.
 */
export function parseBRL(text) {
  if (typeof text !== 'string') return null;
  let s = text.replace(/R\$/gi, '').replace(/\s+/g, '');
  if (!/^[\d.,]+$/.test(s)) return null;

  let intPart;
  let decPart = '';
  const commas = s.split(',').length - 1;

  if (commas > 1) return null;
  if (commas === 1) {
    [intPart, decPart] = s.split(',');
    if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(intPart)) return null;
    intPart = intPart.replace(/\./g, '');
  } else {
    const m = s.match(/^(\d+)\.(\d{1,2})$/);
    if (m) {
      intPart = m[1];
      decPart = m[2];
    } else {
      if (!/^(\d{1,3}(\.\d{3})*|\d+)$/.test(s)) return null;
      intPart = s.replace(/\./g, '');
    }
  }

  if (!/^\d*$/.test(decPart) || decPart.length > 2) return null;
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

/** Formata centavos como "R$ 1.234,56" (espaço comum depois de R$). */
export function formatBRL(cents) {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const reais = Math.floor(abs / 100).toString();
  const centavos = (abs % 100).toString().padStart(2, '0');
  const withThousands = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}R$ ${withThousands},${centavos}`;
}
