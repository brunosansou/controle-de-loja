// Backend em memória com o mesmo contrato do IndexedDB (só para testes).
const KEYS = { entries: 'id', days: 'date', meta: 'key' };

export function createMemoryBackend() {
  const stores = { entries: new Map(), days: new Map(), meta: new Map() };
  const clone = (o) => structuredClone(o);
  return {
    async getAll(store) {
      return [...stores[store].values()].map(clone);
    },
    async put(store, obj) {
      stores[store].set(obj[KEYS[store]], clone(obj));
    },
    async delete(store, key) {
      stores[store].delete(key);
    },
    async replaceAll({ entries, days, meta }) {
      const next = { entries: new Map(), days: new Map(), meta: new Map() };
      for (const [store, list] of Object.entries({ entries, days, meta })) {
        for (const obj of list) next[store].set(obj[KEYS[store]], clone(obj));
      }
      Object.assign(stores, next);
    },
  };
}
