// Regras de gravação. Fala com um backend de armazenamento injetado
// (IndexedDB no navegador, memória nos testes).
import { isFuture } from './dates.js';
import { numberClients } from './calc.js';

export class StoreError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalize(entry, now) {
  const e = { ...entry, description: (entry.description ?? '').trim() };
  if (e.type !== 'entrada' && e.type !== 'saida') throw new StoreError('TIPO_INVALIDO');
  if (!Number.isSafeInteger(e.amountCents) || e.amountCents <= 0) throw new StoreError('VALOR_INVALIDO');
  if (typeof e.date !== 'string' || !DATE_RE.test(e.date)) throw new StoreError('DATA_INVALIDA');
  if (isFuture(e.date, now)) throw new StoreError('DATA_FUTURA');
  if (e.type === 'saida') {
    e.method = null;
    delete e.clientNumber;
  }
  else if (e.method !== 'dinheiro' && e.method !== 'pix') throw new StoreError('FORMA_INVALIDA');
  return e;
}

export function createStore(backend, { now = () => new Date(), newId = () => crypto.randomUUID() } = {}) {
  async function getDayStates() {
    const map = {};
    for (const d of await backend.getAll('days')) map[d.date] = d;
    return map;
  }

  async function assertOpen(date) {
    const st = (await getDayStates())[date];
    if (st?.closed) throw new StoreError('DIA_FECHADO');
  }

  async function findEntry(id) {
    const found = (await backend.getAll('entries')).find((x) => x.id === id);
    if (!found) throw new StoreError('NAO_ENCONTRADO');
    return found;
  }

  async function getMeta(key) {
    const row = (await backend.getAll('meta')).find((m) => m.key === key);
    return row ? row.value : null;
  }

  return {
    listEntries: () => backend.getAll('entries'),
    getDayStates,

    async addEntry({ date, type, amountCents, description, method }) {
      const ts = now().toISOString();
      const entry = normalize(
        { id: newId(), date, type, amountCents, description, method, createdAt: ts, updatedAt: ts },
        now(),
      );
      await assertOpen(entry.date);
      if (entry.type === 'entrada') entry.clientNumber = numberClients(await backend.getAll('entries'), entry.date).next;
      await backend.put('entries', entry);
      return entry;
    },

    async updateEntry(id, changes) {
      const current = await findEntry(id);
      await assertOpen(current.date);
      const merged = { ...current };
      for (const k of ['amountCents', 'description', 'method']) {
        if (k in changes) merged[k] = changes[k];
      }
      merged.updatedAt = now().toISOString();
      const entry = normalize(merged, now());
      await backend.put('entries', entry);
      return entry;
    },

    async deleteEntry(id) {
      const current = await findEntry(id);
      await assertOpen(current.date);
      await backend.delete('entries', id);
    },

    async closeDay(date) {
      await backend.put('days', { date, closed: true, closedAt: now().toISOString() });
    },

    async reopenDay(date) {
      await backend.put('days', { date, closed: false, closedAt: null });
    },

    getLastBackupAt: () => getMeta('lastBackupAt'),

    async setLastBackupAt(iso) {
      await backend.put('meta', { key: 'lastBackupAt', value: iso });
    },

    async replaceAll({ entries, days, lastBackupAt }) {
      await backend.replaceAll({
        entries,
        days,
        meta: [{ key: 'lastBackupAt', value: lastBackupAt ?? null }],
      });
    },
  };
}
