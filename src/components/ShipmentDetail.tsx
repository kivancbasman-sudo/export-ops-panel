import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { PalletData, ProductRow, Shipment } from '../types';
import { NumberInput } from './ui/NumberInput';
import { EditableDocField } from './ui/EditableDocField';
import { calculateFreight, formatNumber, formatShipmentDateDetailed, parseDateFlexible, getShipmentMissingFields, generateId, findDocumentConflicts, UniqueDocFieldKey } from '../utils/calculations';
import { ArrowLeft, Save, Trash2, Plus, Calendar, Type, User, Upload, Download, FileText, AlertCircle, AlertTriangle, CheckCircle2, Mail, Ban } from 'lucide-react';
import { exportPalletDataToExcel, importPalletDataFromExcel } from '../utils/excel';
import { EmailTemplateModal } from './EmailTemplateModal';
import { WeeklyShipmentSwitcher } from './WeeklyShipmentSwitcher';

interface ShipmentDetailProps {
  id: string; // 'new' or actual id
  onBack: () => void;
  onIdChange?: (id: string) => void;
  onNavigateToCalculator?: (prefill: { grossWeight?: number; chargeableWeight?: number; title?: string }) => void;
}

const emptyShipment: Omit<Shipment, 'id' | 'createdAt'> = {
  title: '',
  shipmentDate: '',
  bookingNo: '',
  awbNo: '',
  poNo: [],
  customInvoiceNo: [],
  i7xNo: '',
  d7xNo: '',
  diNo: '',
  eArsivNo: '',
  eIrsaliyeNo: '',
  sbifNo: '',
  sbifId: '',
  invoiceTotalAmount: 0,
  chargeableWeight: 0,
  checklistProgress: {},
  notes: '',
  isCancelled: false,
  pallets: []
};

export function ShipmentDetail({ id, onBack, onIdChange, onNavigateToCalculator }: ShipmentDetailProps) {
  const { shipments, addShipment, updateShipment, deleteShipment, checklistTemplates, settings } = useAppStore();
  const [data, setData] = useState<Omit<Shipment, 'id' | 'createdAt'>>(emptyShipment);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Email template modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTemplateToOpen, setEmailTemplateToOpen] = useState<string | undefined>(undefined);

  const handleOpenEmailModal = (templateId?: string) => {
    setEmailTemplateToOpen(templateId);
    setIsEmailModalOpen(true);
  };

  // Single cell date input state
  const [isDateInputFocused, setIsDateInputFocused] = useState(false);
  const [dateInputText, setDateInputText] = useState('');

  // Keep dateInputText in sync when not focused
  useEffect(() => {
    if (!isDateInputFocused) {
      if (data.shipmentDate) {
        const d = parseDateFlexible(data.shipmentDate);
        if (d) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          setDateInputText(`${dd}.${mm}.${yyyy}`);
        } else {
          setDateInputText(data.shipmentDate);
        }
      } else {
        setDateInputText('');
      }
    }
  }, [data.shipmentDate, isDateInputFocused]);

  // References to prevent infinite loop
  const loadedIdRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);
  const lastSavedRef = useRef<string>('');
  const pendingPayloadRef = useRef<{ id: string; payload: any } | null>(null);

  // Dynamic weight calculations based on pallets and products
  const totalPallets = data.pallets.length;
  const totalBoxes = data.pallets.reduce((acc, p) => acc + p.products.reduce((prAcc, pr) => prAcc + (pr.boxCount || 0), 0), 0);
  const totalItems = data.pallets.reduce((acc, p) => acc + p.products.reduce((prAcc, pr) => prAcc + ((pr.boxCount || 0) * (pr.itemsPerBox || 0)), 0), 0);
  const totalNetWeight = data.pallets.reduce((acc, p) => acc + p.products.reduce((prAcc, pr) => prAcc + ((pr.boxCount || 0) * (pr.boxWeight || 0)), 0), 0);
  const totalPalletTare = data.pallets.reduce((acc, p) => acc + (p.palletWeight || 0), 0);
  const rawChargeableWeight = totalNetWeight + totalPalletTare;
  const totalGrossWeight = rawChargeableWeight;

  const weightFraction = rawChargeableWeight - Math.floor(rawChargeableWeight);
  const computedChargeableWeight = weightFraction > 0.5 
    ? Math.floor(rawChargeableWeight) + 1 
    : Math.floor(rawChargeableWeight);

  // Flush any pending uncommitted save immediately (zero data loss guarantee)
  const flushPendingSave = useCallback(() => {
    if (!pendingPayloadRef.current) return;
    const { id: targetId, payload } = pendingPayloadRef.current;
    const currentSerialized = JSON.stringify(payload);
    if (currentSerialized === lastSavedRef.current) {
      pendingPayloadRef.current = null;
      return;
    }

    lastSavedRef.current = currentSerialized;
    if (targetId === 'new') {
      if (JSON.stringify(payload) !== JSON.stringify(emptyShipment)) {
        const newShipment = addShipment(payload);
        loadedIdRef.current = newShipment.id;
        if (onIdChange) onIdChange(newShipment.id);
      }
    } else {
      updateShipment(targetId, payload);
    }
    pendingPayloadRef.current = null;
  }, [addShipment, updateShipment, onIdChange]);

  // Load initial data only when ID changes or first becomes available in shipments
  useEffect(() => {
    if (id !== 'new') {
      if (loadedIdRef.current !== id) {
        const existing = shipments.find(s => s.id === id);
        if (existing) {
          setData(existing);
          loadedIdRef.current = id;
          lastSavedRef.current = JSON.stringify({ ...existing, chargeableWeight: existing.chargeableWeight || 0 });
          isInitialMountRef.current = true;
          pendingPayloadRef.current = null;
        }
      }
    } else {
      if (loadedIdRef.current !== 'new') {
        loadedIdRef.current = 'new';
        setData(emptyShipment);
        lastSavedRef.current = JSON.stringify({ ...emptyShipment, chargeableWeight: 0 });
        isInitialMountRef.current = true;
        pendingPayloadRef.current = null;
      }
    }
  }, [id, shipments]);

  // Cleanup & unmount: ALWAYS flush any pending unsaved edit immediately!
  useEffect(() => {
    const handleFlushEvent = () => {
      flushPendingSave();
    };
    window.addEventListener('app:flush-pending-inputs', handleFlushEvent);

    return () => {
      window.removeEventListener('app:flush-pending-inputs', handleFlushEvent);
      flushPendingSave();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [flushPendingSave]);

  // Safe auto-save logic: only saves when data is actually edited and differs from last saved state
  useEffect(() => {
    // Skip initial load
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const payload = { ...data, chargeableWeight: computedChargeableWeight };
    const currentSerialized = JSON.stringify(payload);

    // If nothing changed from last saved state, do not trigger a save
    if (currentSerialized === lastSavedRef.current) {
      pendingPayloadRef.current = null;
      return;
    }

    // Do not auto-save an untouched empty new shipment
    if (id === 'new' && JSON.stringify(data) === JSON.stringify(emptyShipment)) {
      pendingPayloadRef.current = null;
      return;
    }

    // Store pending payload for immediate flush if unmounted or user clicks back
    pendingPayloadRef.current = { id, payload };

    const handler = setTimeout(() => {
      lastSavedRef.current = currentSerialized;
      pendingPayloadRef.current = null;

      if (id === 'new') {
        const newShipment = addShipment(payload);
        loadedIdRef.current = newShipment.id;
        if (onIdChange) onIdChange(newShipment.id);
      } else {
        updateShipment(id, payload);
      }

      setShowSaveSuccess(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setShowSaveSuccess(false);
      }, 2500);
    }, 800); // 800ms debounce with instant unmount flush

    return () => clearTimeout(handler);
  }, [data, computedChargeableWeight, id, addShipment, updateShipment, onIdChange]);

  const handleDelete = () => {
    if (isDeleting) {
      deleteShipment(id);
      onBack();
    } else {
      setIsDeleting(true);
      setTimeout(() => setIsDeleting(false), 3000);
    }
  };

  const handleChange = (field: keyof Shipment, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  // Freight calculations
  const { rate, amount: calculatedFreightAmount, isMinAmount: rawIsMinAmount } = calculateFreight(
    computedChargeableWeight,
    settings.freightTiers,
    settings.minFreightAmount
  );
  const navlunAwbHaric = computedChargeableWeight > 0 ? calculatedFreightAmount : 0;
  const isMinAmount = computedChargeableWeight > 0 && rawIsMinAmount;
  const navlunAwbDahil = computedChargeableWeight > 0 ? navlunAwbHaric + settings.awbFee : 0;

  const handlePalletChange = (index: number, field: keyof PalletData, value: any) => {
    const newPallets = [...data.pallets];
    newPallets[index] = { ...newPallets[index], [field]: value };
    setData(prev => ({ ...prev, pallets: newPallets }));
  };

  const handleProductChange = (palletIndex: number, productIndex: number, field: keyof ProductRow, value: any) => {
    const newPallets = [...data.pallets];
    const newProducts = [...newPallets[palletIndex].products];
    newProducts[productIndex] = { ...newProducts[productIndex], [field]: value };
    newPallets[palletIndex] = { ...newPallets[palletIndex], products: newProducts };
    setData(prev => ({ ...prev, pallets: newPallets }));
  };

  const addPallet = () => {
    setData(prev => ({
      ...prev,
      pallets: [
        ...prev.pallets,
        {
          id: generateId('pal'),
          palletDimensions: '',
          palletWeight: 7.5,
          products: []
        }
      ]
    }));
  };

  const removePallet = (id: string) => {
    setData(prev => ({
      ...prev,
      pallets: prev.pallets.filter(p => p.id !== id)
    }));
  };

  const addProduct = (palletId: string) => {
    setData(prev => ({
      ...prev,
      pallets: prev.pallets.map(p => {
        if (p.id === palletId) {
          return {
            ...p,
            products: [
              ...p.products,
              {
                id: generateId('prod'),
                boxDimensions: '',
                materialCode: '',
                materialDescription: '',
                itemsPerBox: 0,
                boxCount: 0,
                boxWeight: 0
              }
            ]
          };
        }
        return p;
      })
    }));
  };

  const removeProduct = (palletId: string, productId: string) => {
    setData(prev => ({
      ...prev,
      pallets: prev.pallets.map(p => {
        if (p.id === palletId) {
          return {
            ...p,
            products: p.products.filter(pr => pr.id !== productId)
          };
        }
        return p;
      })
    }));
  };

  const missingFields = getShipmentMissingFields(data);

  // Çakışan / Mükerrer Belge Kontrolü (AWB No ve PO No hariç tüm belge alanları)
  const documentConflicts = useMemo(() => {
    const effectiveId = id !== 'new' ? id : loadedIdRef.current;
    return findDocumentConflicts(data, effectiveId, shipments);
  }, [data, id, shipments]);

  const getFieldConflictInfo = (field: UniqueDocFieldKey) => {
    const fieldConflicts = documentConflicts.filter(c => c.field === field);
    if (fieldConflicts.length === 0) {
      return { conflictMessage: undefined, conflictingValues: undefined };
    }
    const messages = fieldConflicts.map(c => {
      const parts: string[] = [];
      if (c.isSelfDuplicate) {
        parts.push('Bu sevkiyatta mükerrer girilmiş');
      }
      if (c.otherShipments.length > 0) {
        const names = c.otherShipments
          .map(s => `${s.title}${s.isCancelled ? ' (İptal)' : ''}`)
          .join(', ');
        parts.push(`Şu sevkiyatlarda da kayıtlı: ${names}`);
      }
      return `${c.value}: ${parts.join(' • ')}`;
    });
    return {
      conflictMessage: messages.join('\n'),
      conflictingValues: fieldConflicts.map(c => c.value),
    };
  };

  const bookingConflict = getFieldConflictInfo('bookingNo');
  const customInvoiceConflict = getFieldConflictInfo('customInvoiceNo');
  const i7xConflict = getFieldConflictInfo('i7xNo');
  const d7xConflict = getFieldConflictInfo('d7xNo');
  const diConflict = getFieldConflictInfo('diNo');
  const eArsivConflict = getFieldConflictInfo('eArsivNo');
  const eIrsaliyeConflict = getFieldConflictInfo('eIrsaliyeNo');
  const sbifNoConflict = getFieldConflictInfo('sbifNo');
  const sbifIdConflict = getFieldConflictInfo('sbifId');

  const handleBack = () => {
    flushPendingSave();
    onBack();
  };

  const handleSwitchShipment = (targetId: string) => {
    if (targetId === id) return;
    flushPendingSave();
    if (onIdChange) {
      onIdChange(targetId);
    }
  };

  return (
    <div className="bg-slate-100 dark:bg-stone-900 border border-slate-400 dark:border-stone-800 shadow-sm flex flex-col h-full min-h-0 transition-colors">
      <div className="bg-slate-200 dark:bg-stone-800/90 border-b border-slate-400 dark:border-stone-700 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="text-slate-600 hover:text-slate-900 dark:text-stone-400 dark:hover:text-stone-100 cursor-pointer" title="Listeye Geri Dön"><ArrowLeft className="w-5 h-5" /></button>
          <h2 
            className={`text-lg sm:text-xl font-extrabold tracking-wide uppercase truncate max-w-[260px] sm:max-w-md lg:max-w-xl ${
              data.isCancelled ? 'text-rose-900 dark:text-rose-300 line-through' : 'text-slate-900 dark:text-stone-100'
            }`}
            title={data.title || (id === 'new' ? 'Yeni Sevkiyat' : 'Sevkiyat Detayı')}
          >
            {data.title 
              ? `${data.title}${data.bookingNo ? ` (${data.bookingNo})` : ''}`
              : (id === 'new' ? 'Yeni Sevkiyat' : `Sevkiyat Detayı${data.bookingNo ? ` (${data.bookingNo})` : ''}`)}
          </h2>
          {data.isCancelled && (
            <span 
              className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-black bg-rose-600 text-white rounded shadow-xs select-none tracking-wider shrink-0"
              title={data.cancelledAt ? `İptal Edilme Tarihi: ${new Date(data.cancelledAt).toLocaleString('tr-TR')}` : 'Bu sevkiyat iptal edilmiştir'}
            >
              <Ban className="w-3.5 h-3.5" />
              İPTAL EDİLDİ
            </span>
          )}
          {missingFields.length > 0 ? (
            <span 
              title={`Eksik Bilgiler (${missingFields.length}):\n• ${missingFields.join('\n• ')}`} 
              className="hidden md:flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 rounded select-none cursor-help"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              {missingFields.length} Eksik Bilgi
            </span>
          ) : (
            <span 
              title="Tüm zorunlu alanlar eksiksiz dolduruldu" 
              className="hidden md:flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded select-none"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Eksiksiz
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-stone-400 italic ml-2 mt-1">Yerel hafızaya otomatik kaydedilir</span>
        </div>
        <div className="flex items-center gap-2">
          {/* İptal İşareti / Durumu */}
          <button
            type="button"
            onClick={() => {
              const nextCancelled = !data.isCancelled;
              setData(prev => {
                const next = {
                  ...prev,
                  isCancelled: nextCancelled
                };
                if (nextCancelled) {
                  next.cancelledAt = new Date().toISOString();
                } else {
                  delete next.cancelledAt;
                }
                return next;
              });
            }}
            className={`font-semibold text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-sm rounded-sm transition-colors cursor-pointer border ${
              data.isCancelled
                ? 'bg-rose-700 hover:bg-rose-800 text-white border-rose-800'
                : 'bg-white dark:bg-stone-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
            }`}
            title={data.isCancelled ? 'Sevkiyat iptal edilmiş durumda. İptali geri almak için tıklayın.' : 'Sevkiyatı iptal edildi olarak işaretle'}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>{data.isCancelled ? 'İptali Geri Al' : 'Sevkiyatı İptal Et'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenEmailModal()}
            className="bg-blue-600 dark:bg-amber-600 hover:bg-blue-700 dark:hover:bg-amber-500 text-white font-semibold text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-sm rounded-sm transition-colors cursor-pointer"
            title="E-posta şablonlarını görüntüle, otomatik doldur ve kopyala"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>E-Posta Hazırla</span>
          </button>
          {showSaveSuccess && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded shadow-sm border select-none transition-all duration-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800">
              Kaydedildi ✓
            </span>
          )}
          {id !== 'new' && (
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> {isDeleting ? "Emin misiniz?" : "Sil"}
            </Button>
          )}
        </div>
      </div>

      {/* İptal Edildi Bilgilendirme Şeridi */}
      {data.isCancelled && (
        <div className="bg-rose-100 border-b border-rose-300 px-4 py-2 flex items-center justify-between text-rose-900 text-xs shrink-0 select-none">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-700 shrink-0 font-bold" />
            <span>
              <strong>DİKKAT:</strong> Bu sevkiyat <strong>İPTAL EDİLMİŞTİR</strong>. Sevkiyat listesinde "İPTAL" rozetiyle ve üstü çizili olarak gösterilir.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setData(prev => {
              const next = { ...prev, isCancelled: false };
              delete next.cancelledAt;
              return next;
            })}
            className="text-xs text-rose-800 hover:text-rose-950 underline font-bold cursor-pointer ml-3"
          >
            İptali Kaldır
          </button>
        </div>
      )}

      {/* Haftalık Sevkiyatlar Arasında Hızlı Geçiş Barı & Küçük Ekran (Mini Panel) */}
      <WeeklyShipmentSwitcher
        currentShipmentId={id}
        currentShipmentDate={data.shipmentDate}
        onSwitchShipment={handleSwitchShipment}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* LEFT COLUMN: Operasyon Takip & Notlar */}
        <div className="w-full lg:w-1/3 shrink-0 flex flex-col gap-5">
          <section className="border border-slate-400 dark:border-stone-700 relative p-4 bg-slate-200 dark:bg-stone-900/60 flex flex-col rounded-sm">
            <h3 className="absolute -top-3 left-4 bg-slate-100 dark:bg-stone-900 px-2 text-xs font-bold text-slate-600 dark:text-stone-400 tracking-wider z-10">OPERASYON TAKİP</h3>
            <div className="flex flex-col gap-y-0.5">
              {checklistTemplates.sort((a,b)=>a.order - b.order).map(item => {
                const isCompleted = !!data.checklistProgress[item.id];
                return (
                <label 
                  key={item.id} 
                  className={`flex items-start cursor-pointer transition-all shrink-0 rounded-md border ${
                    isCompleted 
                      ? 'gap-1.5 p-1.5 border-transparent opacity-60 grayscale hover:bg-slate-300/50 dark:hover:bg-stone-800/60' 
                      : 'gap-2 p-2 bg-slate-50 dark:bg-stone-800/90 border-slate-300 dark:border-stone-700 shadow-sm hover:border-blue-400 dark:hover:border-amber-400 hover:bg-white dark:hover:bg-stone-700/80'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    className={`mt-0.5 shrink-0 text-blue-600 dark:text-amber-500 border-slate-400 dark:border-stone-600 focus:ring-blue-600 dark:focus:ring-amber-500 rounded-sm transition-all ${isCompleted ? 'w-3 h-3' : 'w-3.5 h-3.5'}`}
                    checked={isCompleted}
                    onChange={e => {
                      setData(prev => ({
                        ...prev,
                        checklistProgress: {
                          ...prev.checklistProgress,
                          [item.id]: e.target.checked
                        }
                      }));
                    }}
                  />
                  <span className={`leading-snug transition-all ${isCompleted ? 'text-[10px] text-slate-700 dark:text-stone-400' : 'text-xs text-slate-900 dark:text-stone-100 font-semibold'}`}>
                    {item.text}
                  </span>
                </label>
              )})}
            </div>
          </section>

          {/* Notlar Bölümü */}
          <section className="border border-slate-400 dark:border-stone-700 relative p-4 bg-slate-200 dark:bg-stone-900/60 flex flex-col flex-1 min-h-[150px] rounded-sm">
            <h3 className="absolute -top-3 left-4 bg-slate-100 dark:bg-stone-900 px-2 text-xs font-bold text-slate-600 dark:text-stone-400 tracking-wider z-10 flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-amber-500" />
              NOTLAR
            </h3>
            <textarea
              className="w-full flex-1 p-2.5 bg-slate-100 dark:bg-stone-950 border border-slate-400 dark:border-stone-700 focus:outline-none focus:border-blue-600 dark:focus:border-amber-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-amber-400 focus:bg-white dark:focus:bg-stone-900 text-xs text-slate-900 dark:text-stone-100 rounded-sm resize-y min-h-[110px] leading-relaxed shadow-inner placeholder:text-slate-500 dark:placeholder:text-stone-500"
              placeholder="Bu sevkiyata dair özel notlar, yükleme talimatları, müşteri talepleri veya hatırlatmalar..."
              value={data.notes || ''}
              onChange={e => handleChange('notes', e.target.value)}
            />
          </section>
        </div>

        {/* RIGHT COLUMN: Belgeler, Finans, Paletler */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">

        {/* SECTION 0: Genel Bilgiler */}
        <section className="border border-slate-400 dark:border-stone-700 p-4 relative rounded-sm">
          <h3 className="absolute -top-3 left-4 bg-slate-100 dark:bg-stone-900 px-2 text-xs font-bold text-slate-600 dark:text-stone-400 tracking-wider">GENEL BİLGİLER</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wide flex items-center gap-1">
                <Type className="w-3 h-3 text-amber-500" />
                Sevkiyat Başlığı / İsim
              </label>
              <div className="mt-0.5">
                <input 
                  type="text" 
                  placeholder="Örn: Haftalık Almanya Sevkiyatı"
                  className="border border-slate-500 dark:border-stone-700 bg-slate-100 dark:bg-stone-900 text-slate-900 dark:text-stone-100 placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-blue-600 dark:focus:border-amber-400 focus:ring-1 focus:ring-blue-600 dark:focus:ring-amber-400 h-9 shadow-sm px-3 text-base font-bold transition-none w-full"
                  value={data.title || ''}
                  onChange={e => handleChange('title', e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-500" />
                Sevkiyat Tarihi
              </label>
              <div className="relative mt-0.5 flex items-center">
                <input 
                  type="text" 
                  placeholder="Örn: 18.09.2026 veya takvimden seçin"
                  className="border border-slate-500 dark:border-stone-700 bg-slate-100 dark:bg-stone-900 text-slate-900 dark:text-stone-100 placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-blue-600 dark:focus:border-amber-400 focus:ring-1 focus:ring-blue-600 dark:focus:ring-amber-400 h-9 shadow-sm pl-3 pr-9 text-sm font-semibold transition-none w-full"
                  value={
                    isDateInputFocused
                      ? dateInputText
                      : (data.shipmentDate ? formatShipmentDateDetailed(data.shipmentDate) : '')
                  }
                  onFocus={() => {
                    setIsDateInputFocused(true);
                    if (data.shipmentDate) {
                      const d = parseDateFlexible(data.shipmentDate);
                      if (d) {
                        const dd = String(d.getDate()).padStart(2, '0');
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        setDateInputText(`${dd}.${mm}.${yyyy}`);
                      }
                    }
                  }}
                  onChange={e => setDateInputText(e.target.value)}
                  onBlur={() => {
                    setIsDateInputFocused(false);
                    const trimmed = dateInputText.trim();
                    if (!trimmed) {
                      handleChange('shipmentDate', '');
                      return;
                    }
                    const parsed = parseDateFlexible(trimmed);
                    if (parsed) {
                      const yyyy = parsed.getFullYear();
                      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
                      const dd = String(parsed.getDate()).padStart(2, '0');
                      handleChange('shipmentDate', `${yyyy}-${mm}-${dd}`);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  title={data.shipmentDate ? formatShipmentDateDetailed(data.shipmentDate) : 'Tarih yazın (örn: 18.09.2026) veya takvimden seçin'}
                />

                {/* Takvimden Seçim Butonu & Entegre Seçici */}
                <div 
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded hover:bg-slate-200 dark:hover:bg-stone-800 text-slate-500 dark:text-stone-400 hover:text-blue-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                  title="Takvimden Tarih Seç"
                >
                  <Calendar className="w-4 h-4 pointer-events-none" />
                  <input 
                    type="date"
                    tabIndex={-1}
                    aria-label="Takvimden Tarih Seç"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={(() => {
                      if (!data.shipmentDate) return '';
                      const d = parseDateFlexible(data.shipmentDate);
                      if (!d) return '';
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    })()}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) {
                        handleChange('shipmentDate', val);
                        const d = parseDateFlexible(val);
                        if (d) {
                          const dd = String(d.getDate()).padStart(2, '0');
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const yyyy = d.getFullYear();
                          setDateInputText(`${dd}.${mm}.${yyyy}`);
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wide flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-amber-500" />
                  Sorumlu Personel
                </span>
              </label>
              <div className="mt-0.5">
                <select
                  className="border border-slate-500 dark:border-stone-700 bg-slate-100 dark:bg-stone-900 text-slate-900 dark:text-stone-100 focus:outline-none focus:border-blue-600 dark:focus:border-amber-400 focus:ring-1 focus:ring-blue-600 dark:focus:ring-amber-400 h-9 shadow-sm px-2 text-sm font-medium transition-none w-full"
                  value={data.responsiblePerson || ''}
                  onChange={e => handleChange('responsiblePerson', e.target.value)}
                >
                  <option value="" className="dark:bg-stone-900 dark:text-stone-100">-- Seçiniz --</option>
                  <option value="Boş Bırak" className="dark:bg-stone-900 dark:text-stone-100">Boş Bırak</option>
                  {settings.users.map(user => (
                    <option key={user} value={user} className="dark:bg-stone-900 dark:text-stone-100">{user}</option>
                  ))}
                  {data.responsiblePerson && data.responsiblePerson !== 'Boş Bırak' && !settings.users.includes(data.responsiblePerson) && (
                    <option value={data.responsiblePerson} className="dark:bg-stone-900 dark:text-stone-100">{data.responsiblePerson}</option>
                  )}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: Belgeler */}
        <section className={`border p-2.5 sm:p-3 relative rounded-sm transition-colors ${
          documentConflicts.length > 0
            ? 'border-rose-400 dark:border-rose-700'
            : 'border-slate-400 dark:border-stone-700'
        }`}>
          <h3 className="absolute -top-3 left-4 bg-slate-100 dark:bg-stone-900 px-2 text-xs font-bold text-slate-600 dark:text-stone-400 tracking-wider flex items-center gap-1.5">
            <span>BELGELER</span>
            {documentConflicts.length > 0 && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold tracking-normal normal-case rounded bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                title={`${documentConflicts.length} adet çakışan/mükerrer belge numarası tespit edildi`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                {documentConflicts.length} Mükerrer Belge
              </span>
            )}
          </h3>
          <div className="flex flex-col gap-2 w-full min-w-0">
            {/* Çakışan / Mükerrer Belge Uyarı Şeridi */}
            {documentConflicts.length > 0 && (
              <div
                role="alert"
                className="bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-md px-2.5 py-2 text-xs text-rose-900 dark:text-rose-200 flex flex-col gap-1"
              >
                <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Çakışan / Mükerrer Belge Numarası Tespit Edildi</span>
                </div>
                <ul className="space-y-1 pl-5 list-disc text-[11px] leading-snug">
                  {documentConflicts.map((conflict, idx) => (
                    <li key={`${conflict.field}-${conflict.normalizedValue}-${idx}`}>
                      <span className="font-semibold">{conflict.label}</span>{' '}
                      (<span className="font-mono font-bold text-rose-700 dark:text-rose-300">{conflict.value}</span>):{' '}
                      {conflict.isSelfDuplicate && (
                        <span className="font-medium">
                          Bu sevkiyatta birden fazla kez girilmiş
                          {conflict.otherShipments.length > 0 ? ' • ' : ''}
                        </span>
                      )}
                      {conflict.otherShipments.length > 0 && (
                        <span>
                          Diğer sevkiyat:{' '}
                          {conflict.otherShipments.map((ref, rIdx) => (
                            <React.Fragment key={ref.id}>
                              {rIdx > 0 && ', '}
                              <button
                                type="button"
                                onClick={() => handleSwitchShipment(ref.id)}
                                className="underline font-semibold text-rose-800 dark:text-rose-300 hover:text-rose-950 dark:hover:text-rose-100 cursor-pointer"
                                title="Bu sevkiyatı açmak için tıklayın"
                              >
                                {ref.title}
                                {ref.isCancelled ? ' (İptal)' : ''}
                              </button>
                            </React.Fragment>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bölüm 1 (Üst Bölüm): Sevkiyat, Sipariş & Dahili Belgeler */}
            <div className="flex flex-wrap items-start gap-2 w-full min-w-0">
              {/* Group 1: Booking & AWB */}
              <div className="flex flex-nowrap items-start gap-3 p-2 bg-slate-200 dark:bg-stone-800/80 rounded-md border border-slate-300 dark:border-stone-700 shrink-0 min-w-[310px]">
                <EditableDocField label="Booking No" value={data.bookingNo} copyable conflictMessage={bookingConflict.conflictMessage} onChange={val => handleChange('bookingNo', val)} className="flex-1 min-w-[120px]" />
                <EditableDocField label="AWB No" value={data.awbNo} copyable onChange={val => handleChange('awbNo', val)} className="flex-1 min-w-[150px]" />
              </div>

              {/* Group 2: PO No & Yurtdışı Fatura No */}
              <div className="flex flex-nowrap items-start gap-3 p-2 bg-slate-200 dark:bg-stone-800/80 rounded-md border border-slate-300 dark:border-stone-700 shrink-0 w-fit">
                <EditableDocField label="PO No" value={data.poNo} copyable isMulti multiCols={2} onChange={val => handleChange('poNo', val)} className="shrink-0 w-fit" />
                <EditableDocField label="Yurtdışı Fatura No" value={data.customInvoiceNo || []} copyable isMulti multiCols={2} conflictMessage={customInvoiceConflict.conflictMessage} conflictingValues={customInvoiceConflict.conflictingValues} onChange={val => handleChange('customInvoiceNo', val)} className="shrink-0 w-fit" />
              </div>

              {/* Group 3: I7X, D7X, DI (Fix 8 Karakter) */}
              <div className="flex flex-nowrap items-start gap-3 p-2 bg-slate-200 dark:bg-stone-800/80 rounded-md border border-slate-300 dark:border-stone-700 flex-1 min-w-[260px]">
                <EditableDocField label="I7X Fatura" value={data.i7xNo.replace(/^I7X-/, '')} prefixStr="I7X-" maxLength={8} copyable copyWithoutPrefix conflictMessage={i7xConflict.conflictMessage} onChange={val => handleChange('i7xNo', val ? `I7X-${val.replace(/^I7X-/, '')}` : '')} />
                <EditableDocField label="D7X İrsaliye" value={data.d7xNo.replace(/^D7X-/, '')} prefixStr="D7X-" maxLength={8} copyable copyWithoutPrefix conflictMessage={d7xConflict.conflictMessage} onChange={val => handleChange('d7xNo', val ? `D7X-${val.replace(/^D7X-/, '')}` : '')} />
                <EditableDocField label="DI Paketleme" value={data.diNo.replace(/^DI-/, '')} prefixStr="DI-" maxLength={8} copyable copyWithoutPrefix conflictMessage={diConflict.conflictMessage} onChange={val => handleChange('diNo', val ? `DI-${val.replace(/^DI-/, '')}` : '')} />
              </div>
            </div>

            {/* Bölüm 2 (Alt Bölüm): Resmi & E-Belgeler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full min-w-0">
              {/* Group 4: E-Arşiv & E-İrsaliye */}
              <div className="flex flex-nowrap items-start gap-3 p-2 bg-slate-200 dark:bg-stone-800/80 rounded-md border border-slate-300 dark:border-stone-700 min-w-0 w-full">
                <EditableDocField label="E-Arşiv Fatura No" value={data.eArsivNo} maxLength={16} copyable conflictMessage={eArsivConflict.conflictMessage} onChange={val => handleChange('eArsivNo', val)} className="flex-1 min-w-0" />
                <EditableDocField label="E-İrsaliye No" value={data.eIrsaliyeNo} maxLength={16} copyable conflictMessage={eIrsaliyeConflict.conflictMessage} onChange={val => handleChange('eIrsaliyeNo', val)} className="flex-1 min-w-0" />
              </div>

              {/* Group 5: SBİF Belgeleri */}
              <div id="sbif-group" className="flex flex-nowrap items-start gap-3 p-2 bg-slate-200 dark:bg-stone-800/80 rounded-md border border-slate-300 dark:border-stone-700 min-w-0 w-full">
                <EditableDocField label="SBİF No" value={data.sbifNo || ''} maxLength={5} copyable conflictMessage={sbifNoConflict.conflictMessage} onChange={val => handleChange('sbifNo', val)} className="w-16 sm:w-20 shrink-0" />
                <EditableDocField label="SBİF ID" value={data.sbifId || ''} maxLength={23} copyable conflictMessage={sbifIdConflict.conflictMessage} onChange={val => handleChange('sbifId', val)} className="flex-1 min-w-0" />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Palet ve Koli Bilgileri */}
        <section className="border border-slate-400 dark:border-stone-700 relative mt-2 rounded-sm">
          <h3 className="absolute -top-3 left-4 bg-slate-100 dark:bg-stone-900 px-2 text-xs font-bold text-slate-600 dark:text-stone-400 tracking-wider">PALET VE KOLİ BİLGİLERİ</h3>
          <div className="absolute -top-3.5 right-4 flex items-center gap-2">
            <button onClick={() => exportPalletDataToExcel(data.pallets, data.bookingNo || 'Yeni')} className="bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 shadow-sm px-3 py-1 text-xs flex items-center text-slate-700 dark:text-stone-200 hover:bg-slate-50 dark:hover:bg-stone-700 hover:text-blue-700 dark:hover:text-amber-400 font-bold transition-colors rounded-sm cursor-pointer" title="Palet Şablonu / Verisi İndir">
              <Download className="w-3.5 h-3.5 mr-1"/> Dışa Aktar
            </button>
            <label className="bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 shadow-sm px-3 py-1 text-xs flex items-center text-slate-700 dark:text-stone-200 hover:bg-slate-50 dark:hover:bg-stone-700 hover:text-blue-700 dark:hover:text-amber-400 font-bold transition-colors rounded-sm cursor-pointer" title="Palet Excel'i Yükle">
              <Upload className="w-3.5 h-3.5 mr-1"/> İçe Aktar
              <input 
                type="file" 
                accept=".xlsx" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const pallets = await importPalletDataFromExcel(file);
                    setData(prev => ({ ...prev, pallets }));
                  } catch(err) {
                    alert("Hata: Palet verisi yüklenemedi.");
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <button onClick={addPallet} className="bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 shadow-sm px-3 py-1 text-xs flex items-center text-slate-700 dark:text-stone-200 hover:bg-slate-50 dark:hover:bg-stone-700 hover:text-blue-700 dark:hover:text-amber-400 font-bold transition-colors rounded-sm cursor-pointer">
              <Plus className="w-3.5 h-3.5 mr-1"/> Palet Ekle
            </button>
          </div>
          
          <div className="p-3.5 pt-4 flex flex-col gap-3.5">
            {/* GENEL SEVKİYAT TOPLAMLARI (AĞIRLIK & MİKTAR) - EN ÜSTTE */}
            {data.pallets.length > 0 && (
              <div id="shipment-general-totals" className="border border-slate-400 dark:border-stone-700 rounded-md bg-slate-200 dark:bg-stone-800 px-3 py-1.5 flex flex-nowrap items-center justify-between gap-3 text-xs shadow-sm overflow-x-auto">
                <span className="font-bold text-xs text-slate-700 dark:text-stone-300 shrink-0 whitespace-nowrap uppercase tracking-wider">
                  Genel Toplamlar:
                </span>
                <div className="flex flex-nowrap items-center gap-2 shrink-0">
                  <div className="bg-white dark:bg-stone-900 px-2.5 py-0.5 rounded border border-slate-300 dark:border-stone-700 shadow-2xs whitespace-nowrap flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-stone-400 font-medium">Palet:</span>
                    <b className="text-slate-900 dark:text-stone-100 font-semibold">{totalPallets}</b>
                  </div>
                  <div className="bg-white dark:bg-stone-900 px-2.5 py-0.5 rounded border border-slate-300 dark:border-stone-700 shadow-2xs whitespace-nowrap flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-stone-400 font-medium">Koli:</span>
                    <b className="text-slate-900 dark:text-stone-100 font-semibold">{formatNumber(totalBoxes, 0)}</b>
                  </div>
                  <div className="bg-white dark:bg-stone-900 px-2.5 py-0.5 rounded border border-slate-300 dark:border-stone-700 shadow-2xs whitespace-nowrap flex items-center gap-1.5">
                    <span className="text-slate-500 dark:text-stone-400 font-medium">Ürün:</span>
                    <b className="text-slate-900 dark:text-stone-100 font-semibold">{formatNumber(totalItems, 0)}</b>
                  </div>
                  <div className="bg-white dark:bg-stone-900 px-2.5 py-0.5 rounded border border-slate-300 dark:border-stone-700 shadow-2xs whitespace-nowrap flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-stone-400 font-medium">Net:</span>
                    <b className="text-slate-950 dark:text-stone-100 font-bold font-mono">{formatNumber(totalNetWeight, 2)} kg</b>
                  </div>
                  <div className="bg-blue-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded border border-blue-300 dark:border-amber-800 shadow-2xs whitespace-nowrap flex items-center gap-1.5">
                    <span className="text-blue-800 dark:text-amber-300 font-bold">Brüt:</span>
                    <b className="text-blue-900 dark:text-amber-200 font-extrabold font-mono">{formatNumber(totalGrossWeight, 2)} kg</b>
                  </div>
                </div>
              </div>
            )}

            {data.pallets.map((pallet, pIdx) => {
              const palletNet = pallet.products.reduce((acc, pr) => acc + ((pr.boxCount || 0) * (pr.boxWeight || 0)), 0);
              const palletGross = palletNet + (pallet.palletWeight || 0);
              const palletTotalBoxes = pallet.products.reduce((acc, pr) => acc + (pr.boxCount || 0), 0);
              const palletTotalItems = pallet.products.reduce((acc, pr) => acc + ((pr.boxCount || 0) * (pr.itemsPerBox || 0)), 0);

              return (
                <div key={pallet.id} className="border border-slate-400 dark:border-stone-700 rounded-md bg-slate-100 dark:bg-stone-900 shadow-sm overflow-hidden">
                  <div className="bg-slate-200 dark:bg-stone-800 px-2 py-1 border-b border-slate-400 dark:border-stone-700 flex items-center justify-between gap-1.5 min-w-0 overflow-hidden">
                    {/* Sol Kısım: Palet No, Ölçü ve Dara */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-[11px] px-1.5 py-0.5 bg-slate-700 dark:bg-stone-700 text-white rounded shadow-2xs shrink-0 whitespace-nowrap">
                        {pIdx + 1}. Palet
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-stone-400 whitespace-nowrap">Ölçü:</span>
                        <Input 
                          containerClassName="w-20" 
                          className="h-6.5 text-[11px] font-medium px-1.5" 
                          placeholder="80x120x114" 
                          value={pallet.palletDimensions} 
                          onChange={e => handlePalletChange(pIdx, 'palletDimensions', e.target.value)} 
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-stone-400 whitespace-nowrap">Dara:</span>
                        <NumberInput 
                          decimals={2} 
                          containerClassName="w-12" 
                          className="h-6.5 text-[11px] font-mono font-medium px-0.5 text-center" 
                          value={pallet.palletWeight || 0} 
                          onChange={val => handlePalletChange(pIdx, 'palletWeight', val)} 
                        />
                        <span className="text-[10px] text-slate-500 dark:text-stone-400 font-semibold">kg</span>
                      </div>
                    </div>
                    
                    {/* Sağ Kısım: Özet Değerler ve Aksiyon Butonları */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                      <div className="flex items-center gap-1.5 text-[10.5px] bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded px-1.5 py-0.5 shadow-2xs whitespace-nowrap">
                        <span>Koli: <strong className="text-slate-900 dark:text-stone-100 font-bold">{formatNumber(palletTotalBoxes, 0)}</strong></span>
                        <span className="text-slate-300 dark:text-stone-600">|</span>
                        <span>Ürün: <strong className="text-slate-900 dark:text-stone-100 font-bold">{formatNumber(palletTotalItems, 0)}</strong></span>
                        <span className="text-slate-300 dark:text-stone-600">|</span>
                        <span>Net: <strong className="text-slate-900 dark:text-stone-100 font-mono font-bold">{formatNumber(palletNet, 2)}</strong></span>
                        <span className="text-slate-300 dark:text-stone-600">|</span>
                        <span className="text-blue-800 dark:text-amber-300">Brüt: <strong className="text-blue-900 dark:text-amber-200 font-mono font-bold">{formatNumber(palletGross, 2)} kg</strong></span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => addProduct(pallet.id)}
                          className="h-6.5 px-1.5 text-[10.5px] font-semibold bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 hover:bg-slate-50 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 hover:text-blue-700 dark:hover:text-amber-400 rounded shadow-2xs flex items-center gap-1 shrink-0 transition-colors whitespace-nowrap cursor-pointer"
                          title="Bu palete yeni ürün satırı ekle"
                        >
                          <Plus className="w-3 h-3 text-blue-600 dark:text-amber-400" /> Ürün Ekle
                        </button>
                        <button 
                          onClick={() => removePallet(pallet.id)} 
                          className="h-6.5 w-6.5 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors shrink-0 cursor-pointer" 
                          title="Paleti Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs table-fixed">
                      <colgroup>
                        <col className="w-[12%]" />
                        <col className="w-[14%]" />
                        <col className="w-[24%]" />
                        <col className="w-[8%]" />
                        <col className="w-[8%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[12%]" />
                        <col className="w-[4%]" />
                      </colgroup>
                      <thead className="bg-slate-200 dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-b border-slate-300 dark:border-stone-700">
                        <tr>
                          <th className="p-1 font-semibold text-[10.5px] truncate" title="Koli Ölçüleri">Koli Ölçüsü</th>
                          <th className="p-1 font-semibold text-[10.5px] truncate" title="Malzeme Kodu">Malz. Kodu</th>
                          <th className="p-1 font-semibold text-[10.5px] truncate" title="Malzeme Tanımı">Malz. Tanımı</th>
                          <th className="p-1 font-semibold text-[10.5px] text-center truncate" title="Koli İçi Adet">Koli İçi</th>
                          <th className="p-1 font-semibold text-[10.5px] text-center truncate" title="Koli Adedi">Koli Adet</th>
                          <th className="p-1 font-semibold text-[10.5px] bg-blue-50/50 dark:bg-amber-950/30 text-center truncate" title="Toplam Adet">Top. Adet</th>
                          <th className="p-1 font-semibold text-[10.5px] text-center truncate" title="Koli Ağırlığı (kg)">Koli (kg)</th>
                          <th className="p-1 font-semibold text-[10.5px] bg-blue-50/50 dark:bg-amber-950/30 text-center truncate" title="Net Ağırlık (kg)">Net (kg)</th>
                          <th className="p-1 font-semibold text-[10.5px] text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pallet.products.map((prod, prIdx) => {
                          const toplamAdet = (prod.itemsPerBox || 0) * (prod.boxCount || 0);
                          const netAgirlik = (prod.boxCount || 0) * (prod.boxWeight || 0);
                          return (
                            <tr key={prod.id} className="border-b border-slate-200 dark:border-stone-800 hover:bg-slate-200/70 dark:hover:bg-stone-800/60">
                              <td className="p-0.5 sm:p-1">
                                <Input 
                                  containerClassName="w-full" 
                                  className="h-7 text-[11px] font-medium px-1.5" 
                                  placeholder="Örn: 40x30x25"
                                  value={prod.boxDimensions} 
                                  onChange={e => handleProductChange(pIdx, prIdx, 'boxDimensions', e.target.value)} 
                                />
                              </td>
                              <td className="p-0.5 sm:p-1">
                                <Input 
                                  containerClassName="w-full" 
                                  className="h-7 text-[11px] font-mono font-medium px-1.5" 
                                  placeholder="Kod"
                                  value={prod.materialCode} 
                                  onChange={e => handleProductChange(pIdx, prIdx, 'materialCode', e.target.value)} 
                                />
                              </td>
                              <td className="p-0.5 sm:p-1">
                                <Input 
                                  containerClassName="w-full" 
                                  className="h-7 text-[11px] font-medium px-1.5" 
                                  placeholder="Tanım"
                                  value={prod.materialDescription} 
                                  onChange={e => handleProductChange(pIdx, prIdx, 'materialDescription', e.target.value)} 
                                />
                              </td>
                              <td className="p-0.5 sm:p-1 text-center">
                                <NumberInput 
                                  decimals={0} 
                                  containerClassName="w-full" 
                                  className="h-7 text-[11px] font-mono font-medium text-center px-1" 
                                  value={prod.itemsPerBox || 0} 
                                  onChange={val => handleProductChange(pIdx, prIdx, 'itemsPerBox', val)} 
                                />
                              </td>
                              <td className="p-0.5 sm:p-1 text-center">
                                <NumberInput 
                                  decimals={0} 
                                  containerClassName="w-full" 
                                  className="h-7 text-[11px] font-mono font-medium text-center px-1" 
                                  value={prod.boxCount || 0} 
                                  onChange={val => handleProductChange(pIdx, prIdx, 'boxCount', val)} 
                                />
                              </td>
                              <td className="p-0.5 sm:p-1 font-mono font-bold text-[11px] bg-blue-50/30 dark:bg-amber-950/30 text-center truncate text-slate-900 dark:text-stone-100" title={formatNumber(toplamAdet, 0)}>
                                {formatNumber(toplamAdet, 0)}
                              </td>
                              <td className="p-0.5 sm:p-1 text-center">
                                <NumberInput 
                                  decimals={2} 
                                  containerClassName="w-full" 
                                  className="h-7 text-[11px] font-mono font-medium text-center px-1" 
                                  value={prod.boxWeight || 0} 
                                  onChange={val => handleProductChange(pIdx, prIdx, 'boxWeight', val)} 
                                />
                              </td>
                              <td className="p-0.5 sm:p-1 font-mono font-bold text-[11px] bg-blue-50/30 dark:bg-amber-950/30 text-center truncate text-slate-900 dark:text-stone-100" title={`${formatNumber(netAgirlik, 2)} kg`}>
                                {formatNumber(netAgirlik, 2)}
                              </td>
                              <td className="p-0.5 sm:p-1 text-center">
                                <button 
                                  onClick={() => removeProduct(pallet.id, prod.id)} 
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                  title="Ürünü Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {pallet.products.length === 0 && (
                          <tr>
                            <td colSpan={9} className="p-3 text-center text-slate-600 dark:text-stone-400 italic">Bu palete henüz ürün eklenmedi. "Ürün Ekle" butonunu kullanın.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            
            {data.pallets.length === 0 && (
              <div className="text-center text-slate-600 dark:text-stone-400 py-8 border-2 border-dashed border-slate-400 dark:border-stone-700 rounded-lg">
                Henüz palet kaydı yok. "Palet Ekle" butonuna tıklayarak başlayabilirsiniz.
              </div>
            )}
            
            {/* PRODUCT TOTALS SECTION */}
            {data.pallets.length > 0 && (
              <div className="mt-2 border border-slate-400 dark:border-stone-700 rounded-md bg-slate-100 dark:bg-stone-900 shadow-sm overflow-hidden">
                <div className="bg-slate-200 dark:bg-stone-800 p-3 border-b border-slate-400 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-stone-100">Ürün Toplamları Özeti (Malzeme Koduna Göre)</h4>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="text-slate-700 dark:text-stone-300 bg-white/70 dark:bg-stone-800 px-2 py-0.5 rounded border border-slate-300 dark:border-stone-700">
                      Toplam Net: <b className="text-slate-950 dark:text-stone-100 font-mono">{formatNumber(totalNetWeight, 2)} kg</b>
                    </span>
                    <span className="text-blue-900 dark:text-amber-200 bg-blue-100/70 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-blue-300 dark:border-amber-800">
                      Toplam Brüt: <b className="text-blue-950 dark:text-amber-100 font-mono">{formatNumber(totalGrossWeight, 2)} kg</b>
                    </span>
                  </div>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-200 dark:bg-stone-800 text-slate-600 dark:text-stone-300 border-b border-slate-300 dark:border-stone-700">
                      <tr>
                        <th className="p-3 font-semibold">Malz. Kodu</th>
                        <th className="p-3 font-semibold">Malz. Tanımı</th>
                        <th className="p-3 font-semibold text-right">Toplam Koli</th>
                        <th className="p-3 font-semibold text-right">Toplam Adet</th>
                        <th className="p-3 font-semibold text-right bg-blue-50/40 dark:bg-amber-950/30">Toplam Ağırlık (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(
                        data.pallets.reduce((acc, pallet) => {
                          pallet.products.forEach(prod => {
                            const code = (prod.materialCode || '').trim() || 'TANIMSIZ';
                            if (!acc[code]) {
                              acc[code] = {
                                desc: prod.materialDescription || '',
                                totalBoxes: 0,
                                totalItems: 0,
                                totalWeight: 0,
                              };
                            }
                            acc[code].totalBoxes += (prod.boxCount || 0);
                            acc[code].totalItems += ((prod.boxCount || 0) * (prod.itemsPerBox || 0));
                            acc[code].totalWeight += ((prod.boxCount || 0) * (prod.boxWeight || 0));
                            if (!acc[code].desc && prod.materialDescription) {
                                acc[code].desc = prod.materialDescription;
                            }
                          });
                          return acc;
                        }, {} as Record<string, { desc: string; totalBoxes: number; totalItems: number; totalWeight: number }>)
                      ).sort(([a], [b]) => a.localeCompare(b)).map(([code, stats]: [string, any], idx, arr) => (
                        <tr key={code} className={idx < arr.length - 1 ? "border-b border-slate-200 dark:border-stone-800 hover:bg-slate-200/50 dark:hover:bg-stone-800/50" : "hover:bg-slate-200/50 dark:hover:bg-stone-800/50"}>
                          <td className="p-3 font-mono font-medium text-slate-900 dark:text-stone-100">{code}</td>
                          <td className="p-3 text-slate-700 dark:text-stone-300">{stats.desc || '-'}</td>
                          <td className="p-3 font-bold text-right text-slate-900 dark:text-stone-100">{formatNumber(stats.totalBoxes, 0)}</td>
                          <td className="p-3 font-bold text-right text-blue-700 dark:text-amber-400">{formatNumber(stats.totalItems, 0)}</td>
                          <td className="p-3 font-bold font-mono text-right text-slate-900 dark:text-stone-100 bg-blue-50/20 dark:bg-amber-950/20">{formatNumber(stats.totalWeight, 2)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-200/90 dark:bg-stone-800/90 font-bold border-t-2 border-slate-400 dark:border-stone-700 text-slate-900 dark:text-stone-100 text-xs">
                      <tr>
                        <td className="py-1.5 px-3 font-bold whitespace-nowrap">GENEL TOPLAM</td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-stone-400 font-normal">
                          {totalPallets} Palet <span className="text-slate-500 dark:text-stone-400 text-[11px]">(Dara: {formatNumber(totalPalletTare, 2)} kg • Brüt: {formatNumber(totalGrossWeight, 2)} kg)</span>
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-900 dark:text-stone-100 font-bold">{formatNumber(totalBoxes, 0)}</td>
                        <td className="py-1.5 px-3 text-right text-blue-700 dark:text-amber-400 font-bold">{formatNumber(totalItems, 0)}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-950 dark:text-stone-100 bg-blue-50/40 dark:bg-amber-950/40 whitespace-nowrap">
                          {formatNumber(totalNetWeight, 2)} kg
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 4: Navlun */}
        <section className="border border-slate-400 dark:border-stone-700 p-4 relative rounded-sm">
          <h3 className="absolute -top-3 left-4 bg-slate-100 dark:bg-stone-900 px-2 text-xs font-bold text-slate-600 dark:text-stone-400 tracking-wider">NAVLUN</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Input 
              label="Toplam Net Ağırlık" 
              type="text" 
              value={`${formatNumber(totalNetWeight, 2)} kg`} 
              readOnly 
              className="bg-slate-200 dark:bg-stone-800 font-bold text-slate-900 dark:text-stone-100 cursor-not-allowed font-mono"
            />
            <Input 
              label="Toplam Brüt Ağırlık" 
              type="text" 
              value={`${formatNumber(totalGrossWeight, 2)} kg`} 
              readOnly 
              className="bg-slate-200 dark:bg-stone-800 font-bold text-slate-900 dark:text-stone-100 cursor-not-allowed font-mono"
            />
            <Input 
              label="Hesaplanabilir Ağırlık" 
              type="text" 
              value={`${formatNumber(computedChargeableWeight, 0)} kg`} 
              readOnly 
              className="bg-slate-200 dark:bg-stone-800 font-bold text-blue-900 dark:text-amber-300 cursor-not-allowed font-mono"
            />
          </div>
          
          <div className="bg-slate-200 dark:bg-stone-900 border border-slate-300 dark:border-stone-800 grid grid-cols-1 md:grid-cols-2 text-sm rounded-sm shadow-inner overflow-hidden transition-colors">
            <div className="p-3.5">
              <span className="block text-slate-600 dark:text-stone-400 text-xs font-bold mb-1 uppercase tracking-wider">Navlun (AWB Hariç)</span>
              <span className="font-mono text-xl font-bold text-slate-900 dark:text-stone-100">${formatNumber(navlunAwbHaric, 2)}</span>
              <span className="block text-xs text-slate-600 dark:text-stone-400 mt-1">
                {computedChargeableWeight <= 0
                  ? 'Ağırlık bilgisi girilmedi'
                  : isMinAmount
                  ? `Min. Tutar (${settings.minFreightAmount} USD)`
                  : `Barem: $${formatNumber(rate, 2)} / kg`}
              </span>
            </div>
            <div className="p-3.5 border-t md:border-t-0 md:border-l border-slate-400 dark:border-stone-800 bg-blue-50/50 dark:bg-amber-950/20">
              <span className="block text-blue-800 dark:text-amber-400 text-xs font-bold mb-1 uppercase tracking-wider">Navlun (AWB Dahil)</span>
              <span className="font-mono text-xl font-bold text-blue-900 dark:text-amber-300">${formatNumber(navlunAwbDahil, 2)}</span>
              <span className="block text-xs text-blue-700 dark:text-amber-400/80 mt-1 font-medium">
                {computedChargeableWeight <= 0
                  ? `AWB Bedeli: $${formatNumber(settings.awbFee, 2)}`
                  : `Navlun + AWB ($${formatNumber(settings.awbFee, 2)})`}
              </span>
            </div>
          </div>
        </section>

        </div>
      </div>

      <EmailTemplateModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        shipment={data}
        defaultTemplateId={emailTemplateToOpen}
      />
    </div>
  );
}
