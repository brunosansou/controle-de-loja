// Cálculos do dia. Nada aqui é gravado: tudo é derivado dos lançamentos.

/** Divide o saldo: Arnaldo 70% (arredondado ao centavo), Gilmar o resto. */
export function splitSaldo(saldoCents) {
  if (saldoCents <= 0) return { arnaldoCents: 0, gilmarCents: 0 };
  const arnaldoCents = Math.round((saldoCents * 7) / 10);
  return { arnaldoCents, gilmarCents: saldoCents - arnaldoCents };
}

/**
 * Monta o resumo de todos os dias com lançamentos, em ordem crescente,
 * levando o prejuízo de um dia como despesa para o próximo dia com movimento.
 */
export function computeLedger(entries, dayStates) {
  const byDate = new Map();
  for (const entry of entries) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }

  const days = [];
  let carry = null;
  for (const date of [...byDate.keys()].sort()) {
    const dayEntries = byDate.get(date).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    let dinheiroCents = 0;
    let pixCents = 0;
    let saidasCents = 0;
    for (const x of dayEntries) {
      if (x.type === 'saida') saidasCents += x.amountCents;
      else if (x.method === 'pix') pixCents += x.amountCents;
      else dinheiroCents += x.amountCents;
    }
    const feriaCents = dinheiroCents + pixCents;
    const prejuizoAnterior = carry;
    const despesaCents = saidasCents + (carry ? carry.cents : 0);
    const saldoCents = feriaCents - despesaCents;
    days.push({
      date,
      entries: dayEntries,
      dinheiroCents,
      pixCents,
      feriaCents,
      saidasCents,
      prejuizoAnterior,
      despesaCents,
      saldoCents,
      ...splitSaldo(saldoCents),
      closed: dayStates[date]?.closed === true,
    });
    carry = saldoCents < 0 ? { fromDate: date, cents: -saldoCents } : null;
  }

  return { days, carryOut: carry };
}

export function findDay(ledger, date) {
  return ledger.days.find((d) => d.date === date) ?? null;
}

/** Prejuízo que vai entrar no primeiro lançamento de hoje, se houver. */
export function pendingLossForToday(ledger, today) {
  if (findDay(ledger, today)) return null;
  const c = ledger.carryOut;
  return c && c.fromDate < today ? c : null;
}

/** Dias passados com lançamentos que não foram fechados. */
export function unclosedPastDays(ledger, today) {
  return ledger.days.filter((d) => d.date < today && !d.closed).map((d) => d.date);
}

/**
 * Números de cliente das entradas de um dia. Entradas novas já trazem o
 * número gravado; as antigas (de antes da numeração) recebem pela ordem.
 * `next` é o número do próximo cliente do dia.
 */
export function numberClients(entries, date) {
  const dayIn = entries
    .filter((x) => x.date === date && x.type === 'entrada')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map();
  let last = 0;
  for (const x of dayIn) {
    const n = Number.isSafeInteger(x.clientNumber) && x.clientNumber > 0 ? x.clientNumber : last + 1;
    byId.set(x.id, n);
    last = Math.max(last, n);
  }
  return { byId, next: last + 1 };
}
