// File System Access API & IndexedDB Helper for Local File Auto-Sync

const DB_NAME = 'ihracat_local_file_db';
const STORE_NAME = 'file_handles';
const HANDLE_KEY = 'active_backup_handle';

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB bu tarayıcıda desteklenmiyor.'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeFileHandle(handle: FileSystemFileHandle): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('File handle could not be stored in IndexedDB:', e);
  }
}

export async function getStoredFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearStoredFileHandle(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function checkFilePermission(fileHandle: FileSystemFileHandle): Promise<'granted' | 'prompt' | 'denied'> {
  try {
    const handle = fileHandle as any;
    if (typeof handle.queryPermission === 'function') {
      return await handle.queryPermission({ mode: 'readwrite' });
    }
  } catch (e) {
    console.warn('checkFilePermission failed:', e);
  }
  return 'prompt';
}

export async function verifyPermission(fileHandle: FileSystemFileHandle, readWrite: boolean = true): Promise<boolean> {
  const options = {
    mode: readWrite ? ('readwrite' as const) : ('read' as const)
  };
  try {
    const handle = fileHandle as any;
    if (typeof handle.queryPermission === 'function') {
      const q = await handle.queryPermission(options);
      if (q === 'granted') return true;
    }
    if (typeof handle.requestPermission === 'function') {
      const r = await handle.requestPermission(options);
      if (r === 'granted') return true;
    }
  } catch (e) {
    console.warn('Permission query/request failed:', e);
  }
  return false;
}

// Sequential Promise queue to prevent concurrent createWritable() collisions
let writeQueue: Promise<void> = Promise.resolve();

export function writeDataToFileHandle(handle: FileSystemFileHandle, data: any): Promise<void> {
  const jsonString = JSON.stringify(data, null, 2);

  // Chain write task so each write executes only after the previous one finishes
  const operation = writeQueue.then(async () => {
    const writable = await (handle as any).createWritable();
    try {
      await writable.write(jsonString);
    } finally {
      await writable.close();
    }
  });

  // Catch errors on the queue tail so one failure doesn't block subsequent writes
  writeQueue = operation.catch((err) => {
    console.warn('Queued file write failed:', err);
  });

  return operation;
}

export interface ReadFileResult {
  status: 'empty' | 'valid' | 'corrupted';
  data?: any;
  error?: string;
}

/**
 * Reads and parses JSON data from the file handle with strict corruption detection.
 */
export async function readDataFromFileHandle(handle: FileSystemFileHandle): Promise<ReadFileResult> {
  try {
    const file = await (handle as any).getFile();
    const text = await file.text();
    if (!text || !text.trim()) {
      return { status: 'empty' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        status: 'corrupted',
        error: 'Dosya bozuk veya okunamıyor. Veri kaybını önlemek için üzerine yazma durduruldu.'
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        status: 'corrupted',
        error: 'Dosya bozuk veya okunamıyor. Veri kaybını önlemek için üzerine yazma durduruldu.'
      };
    }

    // Support both envelope format and raw root format
    const actualData = parsed.format === 'ihracat_operasyon_backup' && parsed.data ? parsed.data : parsed;
    const hasValidKeys = 'shipments' in actualData || 'settings' in actualData || 'checklistTemplates' in actualData || 'emailTemplates' in actualData;
    
    if (!hasValidKeys) {
      return {
        status: 'corrupted',
        error: 'Dosya bozuk veya okunamıyor. Veri kaybını önlemek için üzerine yazma durduruldu.'
      };
    }

    return {
      status: 'valid',
      data: actualData
    };
  } catch (err: any) {
    console.warn('readDataFromFileHandle error:', err);
    return {
      status: 'corrupted',
      error: 'Dosya bozuk veya okunamıyor. Veri kaybını önlemek için üzerine yazma durduruldu.'
    };
  }
}

/**
 * Generates an automatic dated snapshot file for daily archival.
 */
export function exportDatedArchive(data: any): void {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const filename = `ihracat_operasyon_arsiv_${dateStr}_${timeStr}.json`;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

