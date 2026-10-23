import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Trash2, Plus, Download, Upload, User, DollarSign, Mail, HardDrive, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Palette, KeyRound, Lock, ShieldCheck, FileSpreadsheet, CheckSquare, ChevronUp, ChevronDown } from 'lucide-react';
import { FreightTier } from '../types';
import { EmailTemplateModal } from './EmailTemplateModal';
import { SunMoonSwitch } from './ui/SunMoonSwitch';
import { exportGeneralDataToExcel, importGeneralDataFromExcel } from '../utils/excel';

export function Settings() {
  const {
    shipments,
    addShipment,
    updateShipment,
    checklistTemplates,
    emailTemplates,
    settings,
    updateChecklistTemplates,
    updateEmailTemplates,
    updateSettings,
    importData,
    exportDataNow,
    localFileState,
    connectLocalFile,
    disconnectLocalFile,
    saveToLocalFileNow,
    reloadFromLocalFileNow,
    exportDatedArchiveNow,
    updatePin
  } = useAppStore();
  
  // States
  const [items, setItems] = useState(checklistTemplates);
  const [newItemText, setNewItemText] = useState('');
  
  const [users, setUsers] = useState(settings.users);
  const [newUserText, setNewUserText] = useState('');

  const [freightTiers, setFreightTiers] = useState<FreightTier[]>(settings.freightTiers);
  const [awbFee, setAwbFee] = useState(settings.awbFee.toString());
  const [minFreightAmount, setMinFreightAmount] = useState(settings.minFreightAmount.toString());
  
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Sync states when store changes (e.g. after import or reload from file)
  useEffect(() => {
    setItems(checklistTemplates);
  }, [checklistTemplates]);

  useEffect(() => {
    setUsers(settings.users);
    setFreightTiers(settings.freightTiers);
    setAwbFee(settings.awbFee.toString());
    setMinFreightAmount(settings.minFreightAmount.toString());
  }, [settings]);

  // Track latest references for immediate unmount flush
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const currentSettingsRef = React.useRef({
    users,
    freightTiers,
    awbFee: Number(awbFee) || 0,
    minFreightAmount: Number(minFreightAmount) || 0,
  });
  currentSettingsRef.current = {
    users,
    freightTiers,
    awbFee: Number(awbFee) || 0,
    minFreightAmount: Number(minFreightAmount) || 0,
  };

  // Immediate flush on unmount or on global PWA update flush trigger
  useEffect(() => {
    const handleFlushEvent = () => {
      updateChecklistTemplates(itemsRef.current);
      updateSettings(currentSettingsRef.current);
    };
    window.addEventListener('app:flush-pending-inputs', handleFlushEvent);

    return () => {
      window.removeEventListener('app:flush-pending-inputs', handleFlushEvent);
      updateChecklistTemplates(itemsRef.current);
      updateSettings(currentSettingsRef.current);
    };
  }, [updateChecklistTemplates, updateSettings]);

  // PIN management states
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  // Local File Sync states
  const [customFileName, setCustomFileName] = useState('ihracat_operasyon_otomatik_yedek.json');
  const [localFileActionMsg, setLocalFileActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Email Template Modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedTplId, setSelectedTplId] = useState<string | undefined>(undefined);
  const [tplToDelete, setTplToDelete] = useState<{ id: string; name: string } | null>(null);
  const [tplMessage, setTplMessage] = useState<string | null>(null);

  // Auto-save Checklist
  useEffect(() => {
    if (JSON.stringify(items) !== JSON.stringify(checklistTemplates)) {
      const handler = setTimeout(() => {
        updateChecklistTemplates(items);
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 2000);
      }, 1000);
      return () => clearTimeout(handler);
    }
  }, [items, checklistTemplates, updateChecklistTemplates]);

  // Auto-save Settings (Users, Freight)
  useEffect(() => {
    const parsedAwb = Number(awbFee) || 0;
    const parsedMin = Number(minFreightAmount) || 0;
    
    // Create a local state object for settings to compare against
    const currentSettings = {
      users,
      freightTiers,
      awbFee: parsedAwb,
      minFreightAmount: parsedMin
    };

    const storeSettings = {
      users: settings.users,
      freightTiers: settings.freightTiers,
      awbFee: settings.awbFee,
      minFreightAmount: settings.minFreightAmount
    };

    if (JSON.stringify(currentSettings) !== JSON.stringify(storeSettings)) {
      const handler = setTimeout(() => {
        updateSettings(currentSettings);
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 2000);
      }, 1500);
      return () => clearTimeout(handler);
    }
  }, [users, freightTiers, awbFee, minFreightAmount, settings, updateSettings]);

  // --- Checklist Handlers ---
  const handleAddChecklist = () => {
    if (!newItemText.trim()) return;
    setItems([
      ...items,
      {
        id: `item_${Date.now()}`,
        text: newItemText.trim(),
        order: items.length + 1
      }
    ]);
    setNewItemText('');
  };

  const handleRemoveChecklist = (id: string) => {
    setItems(items.filter(i => i.id !== id).map((item, index) => ({ ...item, order: index + 1 })));
  };

  const moveUpChecklist = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    newItems.forEach((item, i) => { item.order = i + 1; });
    setItems(newItems);
  };

  const moveDownChecklist = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    newItems.forEach((item, i) => { item.order = i + 1; });
    setItems(newItems);
  };

  // --- User Handlers ---
  const handleAddUser = () => {
    if (!newUserText.trim()) return;
    if (!users.includes(newUserText.trim())) {
      setUsers([...users, newUserText.trim()]);
    }
    setNewUserText('');
  };

  const handleRemoveUser = (userToRemove: string) => {
    setUsers(users.filter(u => u !== userToRemove));
  };

  // --- Freight Tier Handlers ---
  const handleAddTier = () => {
    setFreightTiers([...freightTiers, { id: `ft_${Date.now()}`, maxWeight: 0, rate: 0 }]);
  };

  const handleRemoveTier = (id: string) => {
    setFreightTiers(freightTiers.filter(t => t.id !== id));
  };

  const handleUpdateTier = (index: number, field: keyof FreightTier, value: string) => {
    const newTiers = [...freightTiers];
    let val = Number(value) || 0;
    if (field === 'maxWeight' && value === '') {
      val = 999999;
    }
    newTiers[index] = { ...newTiers[index], [field]: val };
    setFreightTiers(newTiers);
  };

  const handleExport = () => {
    exportDataNow('sevkiyat_tam_yedek');
    setLocalFileActionMsg({
      type: 'success',
      text: 'Yedek dosyası güvenle bilgisayarınıza indirildi.',
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importData(text);
        setLocalFileActionMsg({
          type: 'success',
          text: `Yedek başarıyla yüklendi: ${res.message}`,
        });
      } catch (err: any) {
        setLocalFileActionMsg({
          type: 'error',
          text: `İçe aktarma hatası: ${err?.message || 'Bozuk veya geçersiz dosya formatı.'}`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportExcel = () => {
    if (!shipments || shipments.length === 0) {
      setLocalFileActionMsg({
        type: 'error',
        text: 'İndirilecek herhangi bir sevkiyat kaydı bulunmuyor.',
      });
      return;
    }
    exportGeneralDataToExcel(shipments);
    setLocalFileActionMsg({
      type: 'success',
      text: `${shipments.length} adet sevkiyat Excel (.xlsx) dosyası olarak başarıyla indirildi.`,
    });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const importedDataList = await importGeneralDataFromExcel(file);
      if (importedDataList && importedDataList.length > 0) {
        let updatedCount = 0;
        let addedCount = 0;
        for (const data of importedDataList) {
          const existing = data.bookingNo ? shipments.find(s => s.bookingNo === data.bookingNo) : null;
          if (existing) {
            updateShipment(existing.id, data);
            updatedCount++;
          } else {
            addShipment({
              ...data,
              poNo: data.poNo || [],
              customInvoiceNo: data.customInvoiceNo || [],
              checklistProgress: {},
              pallets: [],
            } as any);
            addedCount++;
          }
        }
        setLocalFileActionMsg({
          type: 'success',
          text: `Excel içe aktarımı başarılı: ${addedCount} yeni sevkiyat eklendi, ${updatedCount} kayıt güncellendi.`,
        });
      } else {
        setLocalFileActionMsg({
          type: 'error',
          text: 'Excel dosyasında işlenebilecek geçerli sevkiyat satırı bulunamadı.',
        });
      }
    } catch (err: any) {
      setLocalFileActionMsg({
        type: 'error',
        text: `Excel yükleme hatası: ${err?.message || 'Bozuk dosya'}`,
      });
    }
    e.target.value = '';
  };

  const handleConnectLocalFile = async (nameToUse?: string) => {
    setIsConnecting(true);
    setLocalFileActionMsg(null);
    try {
      const res = await connectLocalFile(nameToUse);
      if (res.success) {
        setLocalFileActionMsg({ type: 'success', text: res.message || 'Dosya başarıyla bağlandı.' });
      } else {
        setLocalFileActionMsg({ type: 'error', text: res.message || 'Bağlantı kurulamadı.' });
      }
    } catch (err: any) {
      setLocalFileActionMsg({ type: 'error', text: err?.message || 'Bir hata oluştu.' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectLocalFile = async () => {
    await disconnectLocalFile();
    setLocalFileActionMsg({ type: 'success', text: 'Dosya bağlantısı sonlandırıldı.' });
  };

  const handleSaveToLocalFileNow = async () => {
    const res = await saveToLocalFileNow();
    if (res.success) {
      setLocalFileActionMsg({ type: 'success', text: res.message || 'Veriler dosyaya yazıldı.' });
    } else {
      setLocalFileActionMsg({ type: 'error', text: res.message || 'Kayıt başarısız.' });
    }
  };

  const handleReloadFromLocalFile = async () => {
    const res = await reloadFromLocalFileNow();
    if (res.success) {
      setLocalFileActionMsg({ type: 'success', text: res.message || 'Veriler dosyadan güncellendi.' });
    } else {
      setLocalFileActionMsg({ type: 'error', text: res.message || 'Dosyadan okunamadı.' });
    }
  };

  const handleExportDatedArchive = () => {
    exportDatedArchiveNow();
    setLocalFileActionMsg({ type: 'success', text: 'Tarihli otomatik arşiv dosyası bilgisayarınıza indirildi.' });
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    if (!currentPinInput) {
      setPinMessage({ type: 'error', text: 'Lütfen mevcut PIN kodunuzu giriniz.' });
      return;
    }
    if (!newPinInput || newPinInput.trim().length < 4) {
      setPinMessage({ type: 'error', text: 'Yeni PIN kodu en az 4 karakter olmalıdır.' });
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinMessage({ type: 'error', text: 'Yeni PIN kodu ile tekrarı birbiriyle eşleşmiyor.' });
      return;
    }

    setIsUpdatingPin(true);
    try {
      const res = await updatePin(currentPinInput, newPinInput.trim());
      if (res.success) {
        setPinMessage({ type: 'success', text: res.message || 'PIN kodunuz başarıyla değiştirildi.' });
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
      } else {
        setPinMessage({ type: 'error', text: res.message || 'PIN güncellenemedi.' });
      }
    } catch (err: any) {
      setPinMessage({ type: 'error', text: err?.message || 'Bir hata oluştu.' });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <div className="bg-slate-100 dark:bg-stone-900 border border-slate-400 dark:border-stone-800 shadow-sm flex flex-col h-full min-h-0 transition-colors">
      <div className="bg-slate-200 dark:bg-stone-800/90 border-b border-slate-400 dark:border-stone-700 px-4 py-2 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-bold text-slate-800 dark:text-stone-100">Ayarlar</h2>
        <div className="flex items-center gap-2">
          {showSaveSuccess && (
            <span className="text-xs font-medium px-2 py-1 rounded text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/60">
              Kaydedildi ✓
            </span>
          )}
        </div>
      </div>
      
      <div className="p-4 flex-1 min-h-0 overflow-auto space-y-4">

        {/* Üst Sıra: Erişim PIN Kodu & Görünüm / Tema */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {/* Panel Erişim PIN Kodu */}
          <section className="bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 p-3.5 shadow-sm rounded-sm flex flex-col justify-between">
            <form onSubmit={handlePinChange} className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-stone-700 mb-2.5">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-stone-100 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    Erişim PIN Kodu
                  </h3>
                  <button
                    type="submit"
                    disabled={isUpdatingPin || !currentPinInput || !newPinInput}
                    className="h-6.5 px-2.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 dark:disabled:bg-stone-800 disabled:text-slate-500 dark:disabled:text-stone-600 text-white rounded transition-colors flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
                  >
                    <KeyRound className="w-3 h-3" />
                    {isUpdatingPin ? 'Kaydediliyor...' : 'Güncelle'}
                  </button>
                </div>

                {pinMessage && (
                  <div className={`mb-2 p-1.5 rounded text-[11px] border flex items-center gap-1.5 ${
                    pinMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
                  }`}>
                    {pinMessage.type === 'success' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                    <span className="truncate">{pinMessage.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="password"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    placeholder="Mevcut PIN"
                    className="w-full h-7.5 px-2 text-xs font-mono bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 text-slate-900 dark:text-stone-100 rounded focus:border-amber-500 focus:outline-none placeholder:text-slate-400 placeholder:text-[11px]"
                  />
                  <input
                    type="password"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="Yeni PIN"
                    className="w-full h-7.5 px-2 text-xs font-mono bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 text-slate-900 dark:text-stone-100 rounded focus:border-amber-500 focus:outline-none placeholder:text-slate-400 placeholder:text-[11px]"
                  />
                  <input
                    type="password"
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    placeholder="Yeni (Tekrar)"
                    className="w-full h-7.5 px-2 text-xs font-mono bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 text-slate-900 dark:text-stone-100 rounded focus:border-amber-500 focus:outline-none placeholder:text-slate-400 placeholder:text-[11px]"
                  />
                </div>
              </div>
            </form>
          </section>

          {/* Görünüm & Tema */}
          <section className="bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 p-3.5 shadow-sm rounded-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-stone-700 mb-2.5">
              <h3 className="text-xs font-bold text-slate-800 dark:text-stone-100 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
                Görünüm & Tema
              </h3>
            </div>
            <div className="flex items-center justify-between h-7.5">
              <span className="text-xs text-slate-600 dark:text-stone-300 font-medium">Arayüz Teması</span>
              <SunMoonSwitch showText={true} />
            </div>
          </section>
        </div>
        
        {/* Masaüstü Dosya Senkronizasyonu & Yedekleme */}
        <section className="bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 p-4 shadow-sm rounded-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-stone-700">
            <h3 className="text-sm font-bold text-slate-800 dark:text-stone-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Masaüstü Dosya Senkronizasyonu
            </h3>
            {localFileState.isConnected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Bağlı
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400 border border-slate-300 dark:border-stone-700">
                Bağlı Değil
              </span>
            )}
          </div>

          <div className="mt-3">
            {localFileState.isConnected ? (
              <div className="bg-slate-50 dark:bg-stone-900/60 border border-slate-300 dark:border-stone-700 p-3 rounded space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-stone-400 font-medium">Dosya:</span>
                    <span className="font-mono bg-white dark:bg-stone-800 px-2 py-0.5 rounded border border-slate-300 dark:border-stone-600 font-bold text-slate-900 dark:text-stone-100">
                      📄 {localFileState.fileName}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-stone-400 flex items-center gap-2">
                    <span>Son Kayıt:</span>
                    <strong className="text-slate-900 dark:text-stone-100 font-mono bg-white/80 dark:bg-stone-800 px-2 py-0.5 rounded border border-slate-300 dark:border-stone-700">
                      {localFileState.lastSavedAt || '-'}
                    </strong>
                    {localFileState.status === 'saving' && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold animate-pulse inline-flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Kaydediliyor...
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-stone-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={handleSaveToLocalFileNow} 
                      disabled={localFileState.status === 'saving'}
                      className="flex items-center gap-1.5 text-xs h-7 px-2.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${localFileState.status === 'saving' ? 'animate-spin' : ''}`} />
                      Dosyaya Yaz
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={handleReloadFromLocalFile} 
                      className="flex items-center gap-1.5 text-xs h-7 px-2.5 text-emerald-800 dark:text-emerald-300 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Dosyadan Oku
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => handleConnectLocalFile(localFileState.fileName || undefined)} 
                      className="flex items-center gap-1.5 text-xs h-7 px-2.5 text-slate-700 dark:text-stone-200"
                    >
                      Dosya Değiştir
                    </Button>
                  </div>
                  <button
                    onClick={handleDisconnectLocalFile}
                    className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors cursor-pointer"
                  >
                    Bağlantıyı Kes
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-stone-900/60 border border-slate-300 dark:border-stone-700 p-3 rounded">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="ihracat_operasyon_otomatik_yedek.json"
                    className="flex-1 w-full h-8.5 px-3 text-xs font-mono bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 text-slate-900 dark:text-stone-100 rounded focus:border-amber-500 focus:outline-none"
                  />
                  <Button
                    onClick={() => handleConnectLocalFile(customFileName)}
                    disabled={isConnecting}
                    className="w-full sm:w-auto h-8.5 px-4 flex items-center justify-center gap-2 text-xs bg-blue-700 dark:bg-amber-600 hover:bg-blue-800 dark:hover:bg-amber-500 text-white font-semibold shrink-0 cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    {isConnecting ? 'Bağlanıyor...' : 'Masaüstü Dosyası Bağla'}
                  </Button>
                </div>
              </div>
            )}

            {localFileActionMsg && (
              <div className={`mt-2 p-2.5 rounded text-xs border ${
                localFileActionMsg.type === 'success' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium leading-relaxed">{localFileActionMsg.text}</div>
                      {localFileActionMsg.text.includes('iFrame') && (
                        <div className="mt-2 pt-2 border-t border-amber-200/80 dark:border-amber-800/80">
                          <a
                            href={window.location.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-700 dark:bg-amber-600 hover:bg-blue-800 dark:hover:bg-amber-500 text-white rounded font-semibold text-xs"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Yeni Sekmede Aç
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setLocalFileActionMsg(null)} 
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 ml-2 font-bold px-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Manuel Yedekleme */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-stone-700 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-stone-300">
              Manuel Yedekleme (JSON)
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                variant="secondary" 
                onClick={handleExport} 
                className="flex items-center gap-1.5 text-xs h-7 px-3 font-semibold bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-600 text-slate-800 dark:text-stone-200"
              >
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
                Yedek İndir
              </Button>

              <label className="flex items-center gap-1.5 px-3 h-7 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 text-slate-800 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700 cursor-pointer text-xs font-semibold rounded transition-colors">
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Yedek Yükle
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImport} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* Toplu Sevkiyat Aktarımı (Excel) */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-stone-300 block">
                Toplu Sevkiyat Aktarımı (Excel .xlsx)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-stone-400">
                Tüm sevkiyat kayıtlarını Excel tablosuna aktarın veya Excel dosyasından toplu sevkiyat yükleyin.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                variant="secondary" 
                onClick={handleExportExcel} 
                className="flex items-center gap-1.5 text-xs h-7 px-3 font-semibold bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-600 text-slate-800 dark:text-stone-200 cursor-pointer"
                title="Tüm sevkiyatları Excel dosyası olarak indir"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Excel İndir
              </Button>

              <label className="flex items-center gap-1.5 px-3 h-7 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 text-slate-800 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700 cursor-pointer text-xs font-semibold rounded transition-colors shadow-2xs" title="Excel dosyasından toplu sevkiyat yükle">
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
                Excel'den Yükle
                <input 
                  type="file" 
                  accept=".xlsx" 
                  onChange={handleImportExcel} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>
        </section>

        {/* E-Posta Şablonları Yönetimi Section */}
        <section className="bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 p-4 shadow-sm rounded-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-stone-700">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-stone-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600 dark:text-amber-400" />
                E-Posta Şablonları
              </h3>
            </div>
            <button
              onClick={() => {
                setSelectedTplId(undefined);
                setIsEmailModalOpen(true);
              }}
              className="bg-blue-600 dark:bg-amber-600 hover:bg-blue-700 dark:hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              Şablonları Düzenle / Yeni Ekle
            </button>
          </div>

          {/* Inline Delete Confirmation */}
          {tplToDelete && (
            <div className="mb-4 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-red-950 dark:text-red-200">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>
                  <strong>"{tplToDelete.name}"</strong> adlı şablonu silmek istediğinizden emin misiniz?
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (emailTemplates.length <= 1) {
                      setTplMessage('En az bir e-posta şablonu kalmalıdır. Bu şablon silinemez.');
                      setTplToDelete(null);
                      setTimeout(() => setTplMessage(null), 3500);
                      return;
                    }
                    const updated = emailTemplates.filter(t => t.id !== tplToDelete.id);
                    updateEmailTemplates(updated);
                    setTplToDelete(null);
                    setTplMessage('Şablon başarıyla silindi.');
                    setTimeout(() => setTplMessage(null), 3000);
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Evet, Sil
                </button>
                <button
                  type="button"
                  onClick={() => setTplToDelete(null)}
                  className="px-3 py-1 bg-white dark:bg-stone-700 hover:bg-slate-100 dark:hover:bg-stone-600 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-600 font-semibold rounded transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}

          {/* Inline Feedback Message */}
          {tplMessage && (
            <div className="mb-4 bg-blue-50 dark:bg-stone-800 border border-blue-200 dark:border-amber-800 text-blue-900 dark:text-stone-200 text-xs px-3 py-2 rounded flex items-center justify-between">
              <span>{tplMessage}</span>
              <button 
                type="button" 
                onClick={() => setTplMessage(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 ml-2"
              >
                ✕
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {emailTemplates.map(tpl => (
              <div 
                key={tpl.id}
                onClick={() => {
                  setSelectedTplId(tpl.id);
                  setIsEmailModalOpen(true);
                }}
                className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-900/60 hover:bg-amber-50/40 dark:hover:bg-stone-800 hover:border-amber-400 dark:hover:border-amber-500/60 cursor-pointer transition-all flex flex-col justify-between shadow-2xs group relative"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-800 dark:text-stone-200 group-hover:text-blue-700 dark:group-hover:text-amber-400 transition-colors">{tpl.name}</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-stone-800 text-slate-700 dark:text-stone-300 px-1.5 py-0.5 rounded font-mono">
                      {tpl.attachments?.length || 0} Belge
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-stone-400 truncate font-mono bg-white dark:bg-stone-950 p-1.5 rounded border border-slate-200 dark:border-stone-800">
                    {tpl.subject}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-stone-700 flex items-center justify-between text-[11px]">
                  <span className="text-blue-600 dark:text-amber-400 font-semibold flex items-center gap-1 group-hover:underline">
                    Önizle / Düzenle →
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (emailTemplates.length <= 1) {
                        setTplMessage('En az bir e-posta şablonu kalmalıdır. Bu şablon silinemez.');
                        setTimeout(() => setTplMessage(null), 3500);
                        return;
                      }
                      setTplToDelete({ id: tpl.id, name: tpl.name });
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                    title="Bu şablonu sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Personnel Settings Section */}
          <section className="bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 p-4 shadow-sm rounded-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-stone-100 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-600 dark:text-stone-400" />
              Sorumlu Personel Yönetimi
            </h3>
            <div className="flex gap-2 mb-4 items-end">
              <div className="flex-1">
                <Input
                  label="Yeni Personel Ekle"
                  value={newUserText}
                  onChange={(e) => setNewUserText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddUser(); }}
                  placeholder="Personel Adı Soyadı"
                />
              </div>
              <Button onClick={handleAddUser} className="w-10 px-0"><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="border border-slate-400 dark:border-stone-700 bg-slate-200/50 dark:bg-stone-900/50">
              {users.map((user) => (
                <div key={user} className="flex items-center justify-between p-2 border-b border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800 hover:bg-slate-200/50 dark:hover:bg-stone-700/50">
                  <span className="text-sm text-slate-800 dark:text-stone-200 font-medium pl-2">{user}</span>
                  <button 
                    onClick={() => handleRemoveUser(user)}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {users.length === 0 && (
                <div className="p-4 text-sm text-slate-600 dark:text-stone-400 text-center">Personel bulunamadı.</div>
              )}
            </div>
          </section>

          {/* Freight Settings Section */}
          <section className="bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 p-4 shadow-sm rounded-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-stone-100 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-slate-600 dark:text-stone-400" />
              Navlun Barem Ayarları
            </h3>
            <div className="flex gap-4 mb-6">
              <Input
                label="Sabit AWB Ücreti ($)"
                value={awbFee}
                onChange={(e) => setAwbFee(e.target.value)}
                containerClassName="flex-1"
              />
              <Input
                label="Min. Navlun ($)"
                value={minFreightAmount}
                onChange={(e) => setMinFreightAmount(e.target.value)}
                containerClassName="flex-1"
              />
            </div>
            
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-600 dark:text-stone-400 tracking-wider">AĞIRLIK BAREMLERİ</h4>
              <button onClick={handleAddTier} className="text-xs bg-slate-200 dark:bg-stone-700 hover:bg-slate-300 dark:hover:bg-stone-600 text-slate-700 dark:text-stone-200 px-2 py-1 rounded flex items-center gap-1 cursor-pointer">
                <Plus className="w-3 h-3" /> Ekle
              </button>
            </div>
            
            <div className="border border-slate-400 dark:border-stone-700 bg-slate-200/50 dark:bg-stone-900/50 flex flex-col">
              <div className="flex p-2 text-xs font-bold text-slate-600 dark:text-stone-400 border-b border-slate-300 dark:border-stone-700">
                <div className="flex-1">Maks Ağırlık (&lt;) kg</div>
                <div className="flex-1">Fiyat ($/kg)</div>
                <div className="w-6"></div>
              </div>
              
              {[...freightTiers].sort((a,b) => a.maxWeight - b.maxWeight).map((tier) => {
                // Find original index
                const originalIndex = freightTiers.findIndex(t => t.id === tier.id);
                return (
                  <div key={tier.id} className="flex items-center gap-2 p-2 border-b border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800 hover:bg-slate-200/50 dark:hover:bg-stone-700/50">
                    <input 
                      type="number"
                      value={tier.maxWeight === 999999 ? '' : tier.maxWeight}
                      onChange={(e) => handleUpdateTier(originalIndex, 'maxWeight', e.target.value)}
                      placeholder="Sınırsız"
                      className="flex-1 h-8 px-2 text-sm border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-950 text-slate-900 dark:text-stone-100 rounded-sm"
                    />
                    <input 
                      type="number"
                      value={tier.rate}
                      onChange={(e) => handleUpdateTier(originalIndex, 'rate', e.target.value)}
                      className="flex-1 h-8 px-2 text-sm border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-950 text-slate-900 dark:text-stone-100 rounded-sm"
                    />
                    <button 
                      onClick={() => handleRemoveTier(tier.id)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {freightTiers.length === 0 && (
                <div className="p-4 text-sm text-slate-600 dark:text-stone-400 text-center">Barem bulunamadı.</div>
              )}
            </div>
          </section>

        </div>

        {/* Checklist Settings Section */}
        <section className="bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 p-3 sm:p-3.5 shadow-sm rounded-sm">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200 dark:border-stone-700">
            <h3 className="text-xs font-bold text-slate-800 dark:text-stone-100 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
              Operasyon Takip Şablonu
            </h3>
            <span className="text-[11px] font-mono text-slate-500 dark:text-stone-400 bg-slate-100 dark:bg-stone-800 px-2 py-0.5 rounded border border-slate-200 dark:border-stone-700">
              {items.length} Madde
            </span>
          </div>

          <div className="flex gap-2 mb-2.5">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddChecklist(); }}
              placeholder="Yeni kontrol maddesi yazın (Enter)..."
              className="flex-1 h-7.5 px-2.5 text-xs bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 text-slate-900 dark:text-stone-100 rounded focus:border-amber-500 focus:outline-none placeholder:text-slate-400 placeholder:text-[11px]"
            />
            <Button 
              onClick={handleAddChecklist} 
              disabled={!newItemText.trim()}
              className="h-7.5 px-3 text-xs bg-blue-700 dark:bg-amber-600 hover:bg-blue-800 dark:hover:bg-amber-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Ekle
            </Button>
          </div>
          
          <div className="max-h-72 sm:max-h-80 overflow-y-auto border border-slate-300 dark:border-stone-700 bg-slate-50/60 dark:bg-stone-900/40 rounded-sm divide-y divide-slate-200 dark:divide-stone-700/60">
            {items.map((item, index) => (
              <div 
                key={item.id} 
                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-white dark:hover:bg-stone-800/80 transition-colors group"
              >
                <div className="flex items-center gap-0.5 shrink-0 text-slate-400 dark:text-stone-500">
                  <button 
                    type="button"
                    onClick={() => moveUpChecklist(index)} 
                    disabled={index === 0} 
                    className="p-0.5 hover:text-slate-800 dark:hover:text-stone-200 disabled:opacity-20 cursor-pointer rounded hover:bg-slate-200 dark:hover:bg-stone-700"
                    title="Yukarı taşı"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => moveDownChecklist(index)} 
                    disabled={index === items.length - 1} 
                    className="p-0.5 hover:text-slate-800 dark:hover:text-stone-200 disabled:opacity-20 cursor-pointer rounded hover:bg-slate-200 dark:hover:bg-stone-700"
                    title="Aşağı taşı"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-stone-400 w-5 shrink-0 text-right">
                  {index + 1}.
                </span>

                <div className="flex-1 min-w-0">
                  <input 
                    type="text" 
                    value={item.text}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[index].text = e.target.value;
                      setItems(newItems);
                    }}
                    className="w-full text-xs text-slate-800 dark:text-stone-200 bg-transparent px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 dark:hover:border-stone-700 focus:bg-white dark:focus:bg-stone-950 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>

                <button 
                  type="button"
                  onClick={() => handleRemoveChecklist(item.id)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors opacity-70 group-hover:opacity-100 cursor-pointer shrink-0"
                  title="Maddeyi sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <div className="p-4 text-xs text-slate-500 dark:text-stone-400 text-center">Henüz şablon maddesi eklenmedi.</div>
            )}
          </div>
        </section>
      </div>

      {isEmailModalOpen && (
        <EmailTemplateModal
          isOpen={true}
          onClose={() => setIsEmailModalOpen(false)}
          defaultTemplateId={selectedTplId}
          shipment={shipments[0] || {
            bookingNo: '020-99881122',
            awbNo: '020-12345678',
            d7xNo: 'D7X-102938',
            i7xNo: 'I7X-554433',
            diNo: 'DI-776655',
            poNo: ['PO-8819', 'PO-8820'],
            customInvoiceNo: ['EXP-2026-001'],
            shipmentDate: '2026-09-22',
            responsiblePerson: users[0] || 'Kıvanç',
            title: 'Örnek Sevkiyat',
            chargeableWeight: 1450,
            invoiceTotalAmount: 18500
          }}
        />
      )}
    </div>
  );
}
