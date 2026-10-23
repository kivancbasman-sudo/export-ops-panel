import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Shipment, DeletedShipment, ChecklistItemTemplate, AppSettings, EmailTemplate } from '../types';
import { defaultChecklist } from '../data/defaultChecklist';
import { defaultEmailTemplates } from '../data/defaultEmailTemplates';
import { generateId } from '../utils/calculations';
import {
  isFileSystemAccessSupported,
  storeFileHandle,
  getStoredFileHandle,
  clearStoredFileHandle,
  checkFilePermission,
  verifyPermission,
  writeDataToFileHandle,
  readDataFromFileHandle,
  exportDatedArchive
} from '../utils/fileSync';
import {
  DEFAULT_PIN_HASH,
  AUTH_STORAGE_KEY,
  hashText,
  verifyPin,
  generateSessionToken
} from '../utils/security';
import { exportAppState, validateAndParseImportData } from '../utils/dataIO';

const STORAGE_KEY = 'ihracat_operasyon_data';

export interface LocalFileState {
  isSupported: boolean;
  isConnected: boolean;
  fileName: string | null;
  lastSavedAt: string | null;
  status: 'idle' | 'saving' | 'connected' | 'error' | 'disconnected';
  errorMessage: string | null;
}

interface AppData {
  shipments: Shipment[];
  deletedShipments: DeletedShipment[];
  checklistTemplates: ChecklistItemTemplate[];
  emailTemplates: EmailTemplate[];
  settings: AppSettings;
}

interface AppContextType extends AppData {
  addShipment: (shipment: Omit<Shipment, 'id' | 'createdAt'>) => Shipment;
  updateShipment: (id: string, updates: Partial<Shipment>) => void;
  deleteShipment: (id: string) => void;
  restoreShipment: (id: string) => void;
  restoreAllShipments: () => void;
  permanentlyDeleteShipment: (id: string) => void;
  emptyTrash: () => void;
  lastDeletedNotice: { id: string; title: string } | null;
  dismissDeletedNotice: () => void;
  undoLastDelete: () => void;
  updateChecklistTemplates: (templates: ChecklistItemTemplate[]) => void;
  updateEmailTemplates: (templates: EmailTemplate[]) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  importData: (importedData: any) => Promise<{ success: boolean; message: string; stats?: any }>;
  exportDataNow: (customPrefix?: string) => void;
  flushAllPendingData: () => Promise<void>;
  localFileState: LocalFileState;
  connectLocalFile: (suggestedFileName?: string) => Promise<{ success: boolean; message?: string; isIframeBlocked?: boolean }>;
  disconnectLocalFile: () => Promise<void>;
  saveToLocalFileNow: () => Promise<{ success: boolean; message?: string }>;
  reloadFromLocalFileNow: () => Promise<{ success: boolean; message?: string }>;
  exportDatedArchiveNow: () => void;
  isStorageQuotaExceeded: boolean;
  dismissStorageQuotaWarning: () => void;
  isUnlocked: boolean;
  unlockWithPin: (pin: string, remember: boolean) => Promise<{ success: boolean; message?: string }>;
  lockApp: () => void;
  updatePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; message?: string }>;
}

const AppContext = createContext<AppContextType | null>(null);

const defaultSettings: AppSettings = {
  users: ['Kıvanç', 'Meltem', 'Şükriye'],
  awbFee: 110,
  minFreightAmount: 270,
  pinHash: DEFAULT_PIN_HASH,
  freightTiers: [
    { id: '1', maxWeight: 45, rate: 7.7 },
    { id: '2', maxWeight: 100, rate: 6.9 },
    { id: '3', maxWeight: 300, rate: 5.0 },
    { id: '4', maxWeight: 500, rate: 4.28 },
    { id: '5', maxWeight: 1000, rate: 3.9 },
    { id: '6', maxWeight: 999999, rate: 3.54 }
  ]
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        return {
          shipments: Array.isArray(parsed.shipments) ? parsed.shipments : [],
          deletedShipments: Array.isArray(parsed.deletedShipments) ? parsed.deletedShipments : [],
          checklistTemplates: parsed.checklistTemplates || defaultChecklist,
          emailTemplates: parsed.emailTemplates || defaultEmailTemplates,
          settings: { ...defaultSettings, ...(parsed.settings || {}) }
        };
      } catch (e) {
        console.warn("Failed to parse cached local data:", e);
      }
    }
    return {
      shipments: [],
      deletedShipments: [],
      checklistTemplates: defaultChecklist,
      emailTemplates: defaultEmailTemplates,
      settings: defaultSettings
    };
  });

  // Reference always holding the latest data state for immediate flushes and unmount handlers
  const dataRef = React.useRef(data);
  dataRef.current = data;

  // Local Storage Quota Alert State
  const [isStorageQuotaExceeded, setIsStorageQuotaExceeded] = useState(false);

  // Local File Auto-Sync State (File System Access API & IndexedDB)
  const [localFileHandle, setLocalFileHandle] = useState<FileSystemFileHandle | null>(null);
  const localFileHandleRef = React.useRef<FileSystemFileHandle | null>(null);
  localFileHandleRef.current = localFileHandle;

  const [localFileState, setLocalFileState] = useState<LocalFileState>(() => ({
    isSupported: isFileSystemAccessSupported(),
    isConnected: false,
    fileName: null,
    lastSavedAt: null,
    status: 'idle',
    errorMessage: null,
  }));

  // On mount: check if there is a previously connected file handle in IndexedDB
  // CRITICAL RULE: If a local JSON file is connected, IT IS ALWAYS THE MASTER TRUTH.
  useEffect(() => {
    if (!isFileSystemAccessSupported()) return;

    let isMounted = true;
    getStoredFileHandle().then(async (handle) => {
      if (!isMounted || !handle) return;
      try {
        const perm = await checkFilePermission(handle);
        if (perm === 'granted') {
          setLocalFileHandle(handle);

          // ALWAYS READ FROM LOCAL FILE FIRST (File data is master truth):
          const readRes = await readDataFromFileHandle(handle);
          if (readRes.status === 'corrupted') {
            setLocalFileState(prev => ({
              ...prev,
              isConnected: false,
              fileName: handle.name,
              status: 'error',
              errorMessage: readRes.error || 'Dosya bozuk veya okunamıyor. Veri kaybını önlemek için üzerine yazma durduruldu.',
            }));
            return;
          }

          if (readRes.status === 'valid' && readRes.data) {
            const fileData = readRes.data;
            setData(prev => ({
              shipments: Array.isArray(fileData.shipments) ? fileData.shipments : prev.shipments,
              checklistTemplates: fileData.checklistTemplates || prev.checklistTemplates,
              emailTemplates: fileData.emailTemplates || prev.emailTemplates,
              settings: {
                ...defaultSettings,
                ...(fileData.settings || {}),
                pinHash: prev.settings.pinHash || defaultSettings.pinHash,
              }
            }));
          }

          setLocalFileState(prev => ({
            ...prev,
            isConnected: true,
            fileName: handle.name,
            status: 'connected',
            lastSavedAt: new Date().toLocaleTimeString('tr-TR'),
            errorMessage: null,
          }));
        } else {
          setLocalFileHandle(handle);
          setLocalFileState(prev => ({
            ...prev,
            isConnected: false,
            fileName: handle.name,
            status: 'disconnected',
            errorMessage: 'Masaüstü dosyasına erişim izni gerekiyor ("Bağlan / İzin Ver" butonuna tıklayın)',
          }));
        }
      } catch (err: any) {
        console.warn('Startup getStoredFileHandle check failed:', err);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-sync to local file whenever `data` changes (debounced by 500ms)
  useEffect(() => {
    const handle = localFileHandleRef.current;
    if (!handle || !localFileState.isConnected) return;

    const timer = setTimeout(async () => {
      try {
        setLocalFileState(prev => ({ ...prev, status: 'saving' }));
        await writeDataToFileHandle(handle, data);
        const time = new Date().toLocaleTimeString('tr-TR');
        setLocalFileState(prev => ({
          ...prev,
          status: 'connected',
          lastSavedAt: time,
          errorMessage: null,
        }));
      } catch (err: any) {
        console.warn('Auto-save to local file failed:', err);
        setLocalFileState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: 'Masaüstü dosyasına kayıt başarısız: ' + (err?.message || 'Yazma izni kesildi'),
        }));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [data, localFileState.isConnected]);

  // Connect local file (File System Access API)
  // CRITICAL RULE: If chosen file contains data, IT IS ALWAYS THE MASTER TRUTH.
  const connectLocalFile = useCallback(async (customSuggestedName?: string): Promise<{ success: boolean; message?: string; isIframeBlocked?: boolean }> => {
    if (!isFileSystemAccessSupported()) {
      return { success: false, message: 'Tarayıcınız yerel dosya bağlama (File System Access) API desteklemiyor. Lütfen güncel Google Chrome veya Microsoft Edge kullanın.' };
    }

    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isInIframe) {
      const msg = 'Önizleme Çerçevesi (iFrame) Kısıtlaması: Tarayıcınız güvenlik sebebiyle yerel dosya penceresini gömülü önizleme penceresinde engelliyor. Masaüstündeki dosyaya canlı bağlanmak için lütfen uygulamayı bağımsız bir sekmede açın.';
      setLocalFileState(prev => ({ ...prev, errorMessage: msg, status: 'error' }));
      return { success: false, message: msg, isIframeBlocked: true };
    }

    try {
      // Re-verify existing handle if present
      if (localFileHandleRef.current) {
        const hasPerm = await verifyPermission(localFileHandleRef.current, true);
        if (hasPerm) {
          const activeHandle = localFileHandleRef.current;
          
          // MASTER SOURCE RULE: Read from file first
          const readRes = await readDataFromFileHandle(activeHandle);
          if (readRes.status === 'corrupted') {
            const errorMsg = readRes.error || 'Dosya bozuk veya okunamıyor. Veri kaybını önlemek için üzerine yazma durduruldu.';
            setLocalFileState(prev => ({
              ...prev,
              isConnected: false,
              fileName: activeHandle.name,
              status: 'error',
              errorMessage: errorMsg,
            }));
            return { success: false, message: errorMsg };
          }

          if (readRes.status === 'valid' && readRes.data) {
            const fileData = readRes.data;
            setData(prev => ({
              shipments: Array.isArray(fileData.shipments) ? fileData.shipments : prev.shipments,
              checklistTemplates: fileData.checklistTemplates || prev.checklistTemplates,
              emailTemplates: fileData.emailTemplates || prev.emailTemplates,
              settings: {
                ...defaultSettings,
                ...(fileData.settings || {}),
                pinHash: prev.settings.pinHash || defaultSettings.pinHash,
              }
            }));
          } else {
            await writeDataToFileHandle(activeHandle, data);
          }

          const time = new Date().toLocaleTimeString('tr-TR');
          setLocalFileState({
            isSupported: true,
            isConnected: true,
            fileName: activeHandle.name,
            lastSavedAt: time,
            status: 'connected',
            errorMessage: null,
          });
          return { success: true, message: `"${activeHandle.name}" dosyasına bağlanıldı ve esas veri kaynağı yapıldı.` };
        }
      }

      const defaultName = (customSuggestedName && customSuggestedName.trim())
        ? (customSuggestedName.trim().endsWith('.json') ? customSuggestedName.trim() : `${customSuggestedName.trim()}.json`)
        : 'ihracat_operasyon_otomatik_yedek.json';

      // @ts-ignore
      const handle: FileSystemFileHandle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [
          {
            description: 'JSON Veri Dosyası',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
      });

      if (!handle) {
        return { success: false, message: 'Dosya seçilmedi.' };
      }

      const hasPerm = await verifyPermission(handle, true);
      if (!hasPerm) {
        return { success: false, message: 'Dosyaya yazma izni verilmedi.' };
      }

      // CRITICAL DATA INTEGRITY CHECK:
      // Check if file already exists and has data!
      const readRes = await readDataFromFileHandle(handle);
      if (readRes.status === 'corrupted') {
        const errorMsg = readRes.error || 'Dosya bozuk veya okunamıyor. Veri kaybını önlemek için üzerine yazma durduruldu.';
        setLocalFileState(prev => ({
          ...prev,
          isConnected: false,
          fileName: handle.name,
          status: 'error',
          errorMessage: errorMsg,
        }));
        return { success: false, message: errorMsg };
      }

      let loadedShipmentsCount = 0;
      
      if (readRes.status === 'valid' && readRes.data) {
        // The selected file contains valid application records -> ALWAYS MASTER TRUTH:
        const fileData = readRes.data;
        setData(prev => ({
          shipments: Array.isArray(fileData.shipments) ? fileData.shipments : prev.shipments,
          checklistTemplates: fileData.checklistTemplates || prev.checklistTemplates,
          emailTemplates: fileData.emailTemplates || prev.emailTemplates,
          settings: {
            ...defaultSettings,
            ...(fileData.settings || {}),
            pinHash: prev.settings.pinHash || defaultSettings.pinHash,
          }
        }));
        loadedShipmentsCount = Array.isArray(fileData.shipments) ? fileData.shipments.length : 0;
      } else {
        // File is newly created or empty -> initialize it with current state
        await writeDataToFileHandle(handle, data);
      }

      await storeFileHandle(handle);

      const time = new Date().toLocaleTimeString('tr-TR');
      setLocalFileHandle(handle);
      setLocalFileState({
        isSupported: true,
        isConnected: true,
        fileName: handle.name,
        lastSavedAt: time,
        status: 'connected',
        errorMessage: null,
      });

      const successMsg = loadedShipmentsCount > 0
        ? `"${handle.name}" başarıyla bağlandı. Dosyadaki ${loadedShipmentsCount} adet sevkiyat yüklendi ve dosya esas veri kaynağı olarak bağlandı.`
        : `"${handle.name}" başarıyla bağlandı. Yaptığınız tüm değişiklikler anında bu dosyaya otomatik kaydedilecektir.`;

      return {
        success: true,
        message: successMsg
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, message: 'Dosya seçimi iptal edildi.' };
      }
      const isIframeBlocked = err?.name === 'SecurityError' || 
        String(err?.message || '').toLowerCase().includes('sub frame') || 
        String(err?.message || '').toLowerCase().includes('failed to execute');
      
      const msg = isIframeBlocked
        ? 'Önizleme Çerçevesi (iFrame) Kısıtlaması: Tarayıcınız güvenlik sebebiyle yerel dosya penceresini gömülü önizleme penceresinde engelliyor. Masaüstündeki dosyaya canlı bağlanmak için lütfen uygulamayı bağımsız bir sekmede açın.'
        : (err?.message || 'Dosya bağlanırken bir hata oluştu.');

      if (isIframeBlocked) {
        console.warn('IFrame file picker restriction:', msg);
      } else {
        console.error('connectLocalFile error:', err);
      }

      setLocalFileState(prev => ({ ...prev, errorMessage: msg, status: 'error' }));
      return { success: false, message: msg, isIframeBlocked };
    }
  }, [data]);

  const disconnectLocalFile = useCallback(async () => {
    await clearStoredFileHandle();
    setLocalFileHandle(null);
    setLocalFileState({
      isSupported: isFileSystemAccessSupported(),
      isConnected: false,
      fileName: null,
      lastSavedAt: null,
      status: 'disconnected',
      errorMessage: null,
    });
  }, []);

  const saveToLocalFileNow = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    const handle = localFileHandleRef.current;
    if (!handle) {
      return { success: false, message: 'Bağlı bir yerel dosya bulunamadı.' };
    }
    try {
      setLocalFileState(prev => ({ ...prev, status: 'saving' }));
      await writeDataToFileHandle(handle, data);
      const time = new Date().toLocaleTimeString('tr-TR');
      setLocalFileState(prev => ({
        ...prev,
        status: 'connected',
        lastSavedAt: time,
        errorMessage: null,
      }));
      return { success: true, message: `Veriler "${handle.name}" dosyasına başarıyla kaydedildi.` };
    } catch (err: any) {
      console.error('saveToLocalFileNow error:', err);
      setLocalFileState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: err?.message || 'Kaydetme hatası',
      }));
      return { success: false, message: err?.message || 'Dosyaya kaydedilemedi.' };
    }
  }, [data]);

  const reloadFromLocalFileNow = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    const handle = localFileHandleRef.current;
    if (!handle) {
      return { success: false, message: 'Bağlı bir yerel dosya bulunamadı.' };
    }
    try {
      const readRes = await readDataFromFileHandle(handle);
      if (readRes.status === 'corrupted') {
        const errorMsg = readRes.error || 'Dosya bozuk veya okunamıyor. Veri kaybını önlemek için üzerine yazma durduruldu.';
        setLocalFileState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: errorMsg,
        }));
        return { success: false, message: errorMsg };
      }

      if (readRes.status === 'valid' && readRes.data) {
        const fileData = readRes.data;
        setData(prev => ({
          shipments: Array.isArray(fileData.shipments) ? fileData.shipments : prev.shipments,
          checklistTemplates: fileData.checklistTemplates || prev.checklistTemplates,
          emailTemplates: fileData.emailTemplates || prev.emailTemplates,
          settings: {
            ...defaultSettings,
            ...(fileData.settings || {}),
            pinHash: prev.settings.pinHash || defaultSettings.pinHash,
          }
        }));
        const count = Array.isArray(fileData.shipments) ? fileData.shipments.length : 0;
        const time = new Date().toLocaleTimeString('tr-TR');
        setLocalFileState(prev => ({
          ...prev,
          status: 'connected',
          lastSavedAt: time,
          errorMessage: null,
        }));
        return { success: true, message: `"${handle.name}" dosyasındaki en güncel veriler (${count} sevkiyat) tarayıcıya aktarıldı.` };
      }
      return { success: false, message: 'Dosya boş veya geçerli bir kayıt içermiyor.' };
    } catch (err: any) {
      return { success: false, message: 'Dosyadan okuma hatası: ' + (err?.message || '') };
    }
  }, []);

  const exportDatedArchiveNow = useCallback(() => {
    exportDatedArchive(data);
  }, [data]);

  // Always maintain local storage persistence with QuotaExceeded detection
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setIsStorageQuotaExceeded(false);
    } catch (e: any) {
      console.error("LocalStorage write error / Quota exceeded:", e);
      setIsStorageQuotaExceeded(true);
    }
  }, [data]);

  const dismissStorageQuotaWarning = useCallback(() => {
    setIsStorageQuotaExceeded(false);
  }, []);

  const addShipment = useCallback((shipment: Omit<Shipment, 'id' | 'createdAt'>) => {
    const id = generateId();
    const newShipment: Shipment = {
      ...shipment,
      id,
      createdAt: new Date().toISOString()
    };
    
    setData(prev => ({
      ...prev,
      shipments: [newShipment, ...prev.shipments]
    }));

    return newShipment;
  }, []);

  const updateShipment = useCallback((id: string, updates: Partial<Shipment>) => {
    setData(prev => ({
      ...prev,
      shipments: prev.shipments.map(s => {
        if (s.id === id) {
          const next = { ...s, ...updates };
          for (const [k, v] of Object.entries(updates)) {
            if (v === undefined) {
              delete (next as any)[k];
            }
          }
          return next;
        }
        return s;
      })
    }));
  }, []);

  // Undo notice state for deleted shipments
  const [lastDeletedNotice, setLastDeletedNotice] = useState<{ id: string; title: string } | null>(null);
  const deletedNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissDeletedNotice = useCallback(() => {
    setLastDeletedNotice(null);
    if (deletedNoticeTimerRef.current) {
      clearTimeout(deletedNoticeTimerRef.current);
      deletedNoticeTimerRef.current = null;
    }
  }, []);

  const deleteShipment = useCallback((id: string) => {
    setData(prev => {
      const target = prev.shipments.find(s => s.id === id);
      if (!target) return prev;
      const deletedEntry: DeletedShipment = {
        ...target,
        deletedAt: new Date().toISOString()
      };

      if (deletedNoticeTimerRef.current) {
        clearTimeout(deletedNoticeTimerRef.current);
      }
      setLastDeletedNotice({ id, title: target.title || target.bookingNo || 'Sevkiyat' });
      deletedNoticeTimerRef.current = setTimeout(() => {
        setLastDeletedNotice(null);
      }, 7000);

      return {
        ...prev,
        shipments: prev.shipments.filter(s => s.id !== id),
        deletedShipments: [deletedEntry, ...(prev.deletedShipments || [])]
      };
    });
  }, []);

  const restoreShipment = useCallback((id: string) => {
    setData(prev => {
      const target = (prev.deletedShipments || []).find(s => s.id === id);
      if (!target) return prev;
      const { deletedAt, ...restoredShipment } = target;
      return {
        ...prev,
        shipments: [restoredShipment, ...prev.shipments],
        deletedShipments: (prev.deletedShipments || []).filter(s => s.id !== id)
      };
    });
    setLastDeletedNotice(prev => (prev?.id === id ? null : prev));
  }, []);

  const restoreAllShipments = useCallback(() => {
    setData(prev => {
      if (!prev.deletedShipments || prev.deletedShipments.length === 0) return prev;
      const restored = prev.deletedShipments.map(({ deletedAt, ...s }) => s);
      return {
        ...prev,
        shipments: [...restored, ...prev.shipments],
        deletedShipments: []
      };
    });
    setLastDeletedNotice(null);
  }, []);

  const permanentlyDeleteShipment = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      deletedShipments: (prev.deletedShipments || []).filter(s => s.id !== id)
    }));
    setLastDeletedNotice(prev => (prev?.id === id ? null : prev));
  }, []);

  const emptyTrash = useCallback(() => {
    setData(prev => ({
      ...prev,
      deletedShipments: []
    }));
    setLastDeletedNotice(null);
  }, []);

  const undoLastDelete = useCallback(() => {
    if (lastDeletedNotice) {
      restoreShipment(lastDeletedNotice.id);
      dismissDeletedNotice();
    }
  }, [lastDeletedNotice, restoreShipment, dismissDeletedNotice]);

  const updateChecklistTemplates = useCallback((templates: ChecklistItemTemplate[]) => {
    setData(prev => ({
      ...prev,
      checklistTemplates: templates
    }));
  }, []);

  const updateEmailTemplates = useCallback((templates: EmailTemplate[]) => {
    setData(prev => ({
      ...prev,
      emailTemplates: templates
    }));
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setData(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }));
  }, []);

  // Flush all pending state immediately to localStorage and local file handle
  const flushAllPendingData = useCallback(async (): Promise<void> => {
    // 1. Force active form components (ShipmentDetail, Settings) to flush pending in-flight inputs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:flush-pending-inputs'));
    }

    const currentData = dataRef.current;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
    } catch (e) {
      console.warn('Flush to localStorage warning:', e);
    }
    const handle = localFileHandleRef.current;
    if (handle && localFileState.isConnected) {
      try {
        await writeDataToFileHandle(handle, currentData);
      } catch (e) {
        console.warn('Flush to localFile warning:', e);
      }
    }
  }, [localFileState.isConnected]);

  // Window beforeunload listener to guarantee zero data loss on browser close
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataRef.current));
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const exportDataNow = useCallback((customPrefix?: string) => {
    exportAppState(dataRef.current, customPrefix);
  }, []);

  const importData = useCallback(async (importedData: any): Promise<{ success: boolean; message: string; stats?: any }> => {
    const currentDevicePinHash = dataRef.current.settings.pinHash || defaultSettings.pinHash;
    const validation = validateAndParseImportData(importedData, {
      shipments: [],
      checklistTemplates: defaultChecklist,
      emailTemplates: defaultEmailTemplates,
      settings: { ...defaultSettings, pinHash: currentDevicePinHash },
    });

    if (!validation.success || !validation.data) {
      throw new Error(validation.error || 'Veri formatı geçersiz');
    }

    const nextData = validation.data;
    setData(nextData);

    // Synchronously commit to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
      setIsStorageQuotaExceeded(false);
    } catch (e) {
      console.error('LocalStorage write error on import:', e);
      setIsStorageQuotaExceeded(true);
    }

    // Immediately sync to connected local file without waiting for debounce
    const handle = localFileHandleRef.current;
    if (handle && localFileState.isConnected) {
      try {
        setLocalFileState(prev => ({ ...prev, status: 'saving' }));
        await writeDataToFileHandle(handle, nextData);
        setLocalFileState(prev => ({
          ...prev,
          status: 'connected',
          lastSavedAt: new Date().toLocaleTimeString('tr-TR'),
          errorMessage: null,
        }));
      } catch (err: any) {
        console.warn('Import immediate file write failed:', err);
      }
    }

    return {
      success: true,
      message: validation.summary || 'Veriler başarıyla içe aktarıldı.',
      stats: validation.stats,
    };
  }, [localFileState.isConnected]);

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      const session = sessionStorage.getItem(AUTH_STORAGE_KEY);
      const local = localStorage.getItem(AUTH_STORAGE_KEY);
      const token = session || local;
      // Allow valid session token or legacy unlocked
      if (token && (token.length === 64 || token === 'unlocked')) {
        return true;
      }
    } catch (e) {
      console.warn('Auth token check warning:', e);
    }
    return false;
  });

  const unlockWithPin = useCallback(async (pin: string, remember: boolean): Promise<{ success: boolean; message?: string }> => {
    const activeHash = data.settings.pinHash || DEFAULT_PIN_HASH;
    const isValid = await verifyPin(pin, activeHash);
    if (isValid) {
      setIsUnlocked(true);
      try {
        const token = await generateSessionToken(activeHash);
        sessionStorage.setItem(AUTH_STORAGE_KEY, token);
        if (remember) {
          localStorage.setItem(AUTH_STORAGE_KEY, token);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Could not store auth session:', e);
      }
      return { success: true };
    }
    return { success: false, message: 'Hatalı PIN kodu! Lütfen tekrar deneyin.' };
  }, [data.settings.pinHash]);

  const lockApp = useCallback(() => {
    setIsUnlocked(false);
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear auth session:', e);
    }
  }, []);

  const updatePin = useCallback(async (currentPin: string, newPin: string): Promise<{ success: boolean; message?: string }> => {
    const activeHash = data.settings.pinHash || DEFAULT_PIN_HASH;
    const isCurrentValid = await verifyPin(currentPin, activeHash);
    if (!isCurrentValid) {
      return { success: false, message: 'Mevcut PIN kodu hatalı.' };
    }
    if (!newPin || newPin.trim().length < 4) {
      return { success: false, message: 'Yeni PIN kodu en az 4 karakter olmalıdır.' };
    }
    const newHash = await hashText(newPin.trim());
    updateSettings({ pinHash: newHash });
    try {
      const token = await generateSessionToken(newHash);
      sessionStorage.setItem(AUTH_STORAGE_KEY, token);
      if (localStorage.getItem(AUTH_STORAGE_KEY)) {
        localStorage.setItem(AUTH_STORAGE_KEY, token);
      }
    } catch {}
    return { success: true, message: 'Güvenlik PIN kodu başarıyla güncellendi.' };
  }, [data.settings.pinHash, updateSettings]);

  return (
    <AppContext.Provider value={{
      ...data,
      addShipment,
      updateShipment,
      deleteShipment,
      restoreShipment,
      restoreAllShipments,
      permanentlyDeleteShipment,
      emptyTrash,
      lastDeletedNotice,
      dismissDeletedNotice,
      undoLastDelete,
      updateChecklistTemplates,
      updateEmailTemplates,
      updateSettings,
      importData,
      exportDataNow,
      flushAllPendingData,
      localFileState,
      connectLocalFile,
      disconnectLocalFile,
      saveToLocalFileNow,
      reloadFromLocalFileNow,
      exportDatedArchiveNow,
      isStorageQuotaExceeded,
      dismissStorageQuotaWarning,
      isUnlocked,
      unlockWithPin,
      lockApp,
      updatePin
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}
