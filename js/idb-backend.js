// Backend IndexedDB com o mesmo contrato do backend em memória dos testes.
const DB_NAME = 'controle-loja';
const DB_VERSION = 1;
const STORES = { entries: 'id', days: 'date', meta: 'key' };

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transação abortada'));
  });

export async function openIdbBackend() {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    for (const [name, keyPath] of Object.entries(STORES)) {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
    }
  };
  const db = await wrap(req);

  return {
    async getAll(store) {
      return wrap(db.transaction(store, 'readonly').objectStore(store).getAll());
    },
    async put(store, obj) {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(obj);
      await done(tx);
    },
    async delete(store, key) {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      await done(tx);
    },
    async replaceAll(data) {
      const names = Object.keys(STORES);
      const tx = db.transaction(names, 'readwrite');
      for (const name of names) {
        const os = tx.objectStore(name);
        os.clear();
        for (const obj of data[name] ?? []) os.put(obj);
      }
      await done(tx);
    },
  };
}
