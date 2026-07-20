// Armazena arquivos enviados (capas, galerias, materiais, avatares) em
// IndexedDB. localStorage tem limite de ~5MB e não comporta uploads reais;
// os metadados continuam no localStorage junto das demais tabelas.

const DB_NAME = "acervo-blobs";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function putBlob(key: string, blob: Blob): Promise<unknown> {
  return tx("readwrite", (s) => s.put(blob, key));
}

export function getBlob(key: string): Promise<Blob | undefined> {
  return tx("readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>);
}

export function deleteBlob(key: string): Promise<unknown> {
  return tx("readwrite", (s) => s.delete(key));
}
