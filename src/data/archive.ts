import type { BouquetV1 } from './schema';

export interface LocalBouquetRecord {
  id: string;
  recipe: BouquetV1;
  updatedAt: string;
  thumbnail?: Blob;
  finished: boolean;
  revision: number;
}

export class SerializedSaveQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(write: () => Promise<T>): Promise<T> {
    const operation = this.tail.then(write);
    this.tail = operation.catch(() => undefined);
    return operation;
  }
}

const DB_NAME = 'love-parametrically';
const DB_VERSION = 1;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.')); });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

export function openArchive(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const bouquets = database.createObjectStore('bouquets', { keyPath: 'id' });
      bouquets.createIndex('updatedAt', 'updatedAt');
      database.createObjectStore('settings', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The local archive could not open.'));
  });
}

export class ArchiveRepository {
  private writes = new SerializedSaveQueue();
  private databasePromise: Promise<IDBDatabase> | null;

  constructor(databasePromise?: Promise<IDBDatabase>) {
    this.databasePromise = databasePromise ?? null;
  }

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= openArchive();
    return this.databasePromise;
  }

  save(recipe: BouquetV1, revision: number, finished = false, thumbnail?: Blob): Promise<void> {
    const record: LocalBouquetRecord = { id: recipe.id, recipe: structuredClone(recipe), updatedAt: new Date().toISOString(), finished, revision, ...(thumbnail ? { thumbnail } : {}) };
    return this.writes.enqueue(async () => {
      const database = await this.database();
      const readTransaction = database.transaction('bouquets', 'readonly');
      const current = await requestResult(readTransaction.objectStore('bouquets').get(recipe.id)) as LocalBouquetRecord | undefined;
      if (current && current.revision > revision) return;
      const writeTransaction = database.transaction('bouquets', 'readwrite');
      const completion = transactionDone(writeTransaction);
      await requestResult(writeTransaction.objectStore('bouquets').put(record));
      await completion;
    });
  }

  async list(): Promise<LocalBouquetRecord[]> {
    const database = await this.database();
    const transaction = database.transaction('bouquets', 'readonly');
    const records = await requestResult(transaction.objectStore('bouquets').getAll()) as LocalBouquetRecord[];
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<LocalBouquetRecord | undefined> {
    const database = await this.database();
    return requestResult(database.transaction('bouquets', 'readonly').objectStore('bouquets').get(id)) as Promise<LocalBouquetRecord | undefined>;
  }

  async delete(id: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction('bouquets', 'readwrite');
    const completion = transactionDone(transaction);
    await requestResult(transaction.objectStore('bouquets').delete(id));
    await completion;
  }
}

export function createDebouncedAutosave(repository: ArchiveRepository, onSaving: () => void, onSaved: (revision: number) => void, onError: (message: string) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { recipe: BouquetV1; revision: number } | null = null;
  return (recipe: BouquetV1, revision: number) => {
    pending = { recipe, revision };
    onSaving();
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const current = pending;
      if (!current) return;
      try { await repository.save(current.recipe, current.revision); onSaved(current.revision); }
      catch { onError('Local save failed. Export a file now.'); }
    }, 500);
  };
}
