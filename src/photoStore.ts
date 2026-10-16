// Toile photos for the client book, kept in this browser's IndexedDB: too big for local storage, and
// never sent anywhere. Storage can be missing or blocked (a private window), so every call is guarded
// and the client book still works without photos.
const DB = 'pattern-maker-photos';
const STORE = 'photos';

function open(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export const putPhoto = async (id: string, blob: Blob) => (await run('readwrite', (s) => s.put(blob, id))) !== undefined;
export const getPhoto = (id: string) => run<Blob>('readonly', (s) => s.get(id));
export const deletePhoto = (id: string) => run('readwrite', (s) => s.delete(id));

/** A photo made small enough to keep many: the long side 1400 px, as a JPEG. */
export async function shrink(file: File, max = 1400): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((resolve) => c.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}
