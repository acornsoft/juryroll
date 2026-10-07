import { verifyChain, type AuditEntry } from '../../shared/src/policy/audit.ts';

const DB_NAME = 'juryroll-audit';
const STORE = 'log';

export function openAuditDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'seq' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

export function readAudit(db: IDBDatabase): Promise<AuditEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => {
      const rows = (request.result as AuditEntry[]).slice().sort((a, b) => a.seq - b.seq);
      resolve(rows);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
  });
}

export function writeAudit(db: IDBDatabase, entry: AuditEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
}

export function chainStatus(entries: readonly AuditEntry[]): { ok: true } | { ok: false; seq: number } {
  return verifyChain(entries);
}
