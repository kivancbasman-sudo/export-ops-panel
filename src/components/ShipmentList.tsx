import React, { useState, useRef, useEffect, useMemo, MouseEvent as ReactMouseEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Button } from './ui/Button';
import { Plus, Search, ArrowRight, Calendar, Hash, X, ArrowUpDown, ArrowUp, ArrowDown, FileText, AlertCircle, Mail, CheckCircle2, Clock, Ban, User, Plane, Trash2 } from 'lucide-react';
import { formatNumber, formatShipmentDateDetailed, getISOWeekNumber, parseDateFlexible, getShipmentListMissingFields, calculateShipmentWeights } from '../utils/calculations';
import { EmailTemplateModal } from './EmailTemplateModal';
import { TrashModal } from './ui/TrashModal';
import { Shipment } from '../types';

interface ShipmentListProps {
  onSelect: (id: string | null) => void;
}

type SortField = 'shipmentDate' | 'title' | 'bookingNo' | 'responsiblePerson' | 'createdAt' | 'missing';
type SortOrder = 'asc' | 'desc';

const SESSION_FILTER_KEY = 'ihracat_list_filters';
const SESSION_COL_WIDTHS_KEY = 'ihracat_list_col_widths';

interface ListFilterState {
  searchTerm: string;
  filterDate: string;
  filterWeek: string;
  filterResponsible?: string;
  sortField: SortField;
  sortOrder: SortOrder;
  showCancelled?: boolean;
}

const defaultListFilters: ListFilterState = {
  searchTerm: '',
  filterDate: '',
  filterWeek: '',
  filterResponsible: '',
  sortField: 'shipmentDate',
  sortOrder: 'desc',
  showCancelled: false, // varsayılan gizlenmiş olarak
};

const getInitialFilters = (): ListFilterState => {
  try {
    const saved = sessionStorage.getItem(SESSION_FILTER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        searchTerm: parsed.searchTerm || '',
        filterDate: parsed.filterDate || '',
        filterWeek: parsed.filterWeek || '',
        filterResponsible: parsed.filterResponsible || '',
        // Varsayılan olarak sayfa yüklendiğinde yeniden eskiye tarih sırası ile listelenir
        sortField: parsed.sortField || 'shipmentDate',
        sortOrder: parsed.sortOrder || 'desc',
        showCancelled: parsed.showCancelled === true, // varsayılan gizlenmiş
      };
    }
  } catch (err) {
    console.warn("Oturum filtreleri okunamadı:", err);
  }
  return defaultListFilters;
};

const defaultColWidths = {
  title: 250,
  date: 200,
  booking: 150,
  responsible: 150
};

const getInitialColWidths = () => {
  try {
    const saved = sessionStorage.getItem(SESSION_COL_WIDTHS_KEY);
    if (saved) {
      return { ...defaultColWidths, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.warn("Sütun genişlikleri okunamadı:", err);
  }
  return defaultColWidths;
};

export function ShipmentList({ onSelect }: ShipmentListProps) {
  const { shipments, deletedShipments = [], addShipment, updateShipment, settings } = useAppStore();
  
  // Arama ve Filtreleme state'leri (oturum boyunca saklanır)
  const initialFiltersRef = useRef(getInitialFilters());
  const [searchTerm, setSearchTerm] = useState(initialFiltersRef.current.searchTerm);
  const [filterDate, setFilterDate] = useState(initialFiltersRef.current.filterDate);
  const [filterWeek, setFilterWeek] = useState(initialFiltersRef.current.filterWeek);
  const [filterResponsible, setFilterResponsible] = useState(initialFiltersRef.current.filterResponsible || '');
  const [showCancelled, setShowCancelled] = useState(initialFiltersRef.current.showCancelled || false);

  // Trash & Email template modal states
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [emailModalShipment, setEmailModalShipment] = useState<Shipment | null>(null);

  // Sıralama state'leri
  const [sortField, setSortField] = useState<SortField>(initialFiltersRef.current.sortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialFiltersRef.current.sortOrder);

  // Sütun genişlikleri için state
  const [colWidths, setColWidths] = useState(getInitialColWidths);

  // Sorumlu listesi (Ayarlardaki kullanıcılar + mevcut sevkiyatlardaki sorumlular)
  const responsiblePersonList = useMemo(() => {
    const set = new Set<string>();
    (settings?.users || []).forEach(u => {
      if (u && u.trim() && u !== 'Boş Bırak') set.add(u.trim());
    });
    shipments.forEach(s => {
      if (s.responsiblePerson && s.responsiblePerson.trim() && s.responsiblePerson !== 'Boş Bırak') {
        set.add(s.responsiblePerson.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  }, [settings?.users, shipments]);

  // Filtre veya sıralama değiştiğinde oturum hafızasını güncelle
  useEffect(() => {
    try {
      const stateToSave: ListFilterState = {
        searchTerm,
        filterDate,
        filterWeek,
        filterResponsible,
        sortField,
        sortOrder,
        showCancelled
      };
      sessionStorage.setItem(SESSION_FILTER_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Filtreler kaydedilemedi:", e);
    }
  }, [searchTerm, filterDate, filterWeek, filterResponsible, sortField, sortOrder, showCancelled]);

  // Sütun genişlikleri değiştiğinde oturum hafızasını güncelle
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_COL_WIDTHS_KEY, JSON.stringify(colWidths));
    } catch (err) {
      console.warn("Sütun genişlikleri kaydedilemedi:", err);
    }
  }, [colWidths]);

  const resizingRef = useRef<{ col: keyof typeof colWidths, startX: number, startWidth: number } | null>(null);

  const currentWeek = useMemo(() => getISOWeekNumber(new Date()), []);
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const handleMouseDown = (e: ReactMouseEvent, col: keyof typeof colWidths) => {
    e.preventDefault();
    resizingRef.current = {
      col,
      startX: e.clientX,
      startWidth: colWidths[col]
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      
      const { col, startX, startWidth } = resizingRef.current;
      const diff = e.clientX - startX;
      // Minimum width 100px
      const newWidth = Math.max(100, startWidth + diff);
      
      setColWidths(prev => ({
        ...prev,
        [col]: newWidth
      }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'shipmentDate' || field === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 ml-1 shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 ml-1 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 ml-1 shrink-0 font-bold" />
    );
  };

  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      // 0. İptal Filtresi (Varsayılan olarak gizlenmiş)
      if (!showCancelled && s.isCancelled) {
        return false;
      }

      // 1. Arama (Text Search)
      const term = searchTerm.toLowerCase().trim();
      const missing = getShipmentListMissingFields(s);
      const matchesSearch = term === '' || (
        (s.title || '').toLowerCase().includes(term) ||
        (s.bookingNo || '').toLowerCase().includes(term) ||
        (s.awbNo || '').toLowerCase().includes(term) ||
        (s.responsiblePerson || '').toLowerCase().includes(term) ||
        (s.poNo || []).join(' ').toLowerCase().includes(term) ||
        (s.customInvoiceNo || []).join(' ').toLowerCase().includes(term) ||
        (s.i7xNo || '').toLowerCase().includes(term) ||
        (s.d7xNo || '').toLowerCase().includes(term) ||
        (s.diNo || '').toLowerCase().includes(term) ||
        (s.eArsivNo || '').toLowerCase().includes(term) ||
        (s.eIrsaliyeNo || '').toLowerCase().includes(term) ||
        (s.sbifNo || '').toLowerCase().includes(term) ||
        (s.sbifId || '').toLowerCase().includes(term) ||
        ((term === 'eksik' || term === 'eksik bilgi') && missing.length > 0) ||
        ((term === 'iptal' || term === 'iptal edildi') && !!s.isCancelled)
      );

      // 2. Tarih (Date)
      const d = parseDateFlexible(s.shipmentDate);
      const isoDate = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : (s.shipmentDate || '');
      const matchesDate = filterDate === '' || isoDate.startsWith(filterDate);

      // 3. Hafta (Week)
      let matchesWeek = true;
      if (filterWeek !== '') {
        if (!d) {
          matchesWeek = false;
        } else {
          matchesWeek = getISOWeekNumber(d).toString() === filterWeek;
        }
      }

      // 4. Sorumlu (Responsible Person)
      let matchesResponsible = true;
      if (filterResponsible !== '') {
        if (filterResponsible === '__unassigned__') {
          matchesResponsible = !s.responsiblePerson || s.responsiblePerson === 'Boş Bırak' || s.responsiblePerson.trim() === '';
        } else {
          matchesResponsible = s.responsiblePerson === filterResponsible;
        }
      }

      return matchesSearch && matchesDate && matchesWeek && matchesResponsible;
    });
  }, [shipments, searchTerm, filterDate, filterWeek, filterResponsible, showCancelled]);

  const sortedShipments = useMemo(() => {
    return [...filteredShipments].sort((a, b) => {
      if (sortField === 'missing') {
        const missingCountA = getShipmentListMissingFields(a).length;
        const missingCountB = getShipmentListMissingFields(b).length;
        if (missingCountA !== missingCountB) {
          return sortOrder === 'desc' ? missingCountB - missingCountA : missingCountA - missingCountB;
        }
        const dateA = parseDateFlexible(a.shipmentDate)?.getTime() || 0;
        const dateB = parseDateFlexible(b.shipmentDate)?.getTime() || 0;
        return dateB - dateA;
      }

      if (sortField === 'shipmentDate') {
        const dateA = parseDateFlexible(a.shipmentDate)?.getTime() || 0;
        const dateB = parseDateFlexible(b.shipmentDate)?.getTime() || 0;
        // Tarih bilgisi olmayanları listenin sonuna yerleştir
        if (dateA === 0 && dateB !== 0) return 1;
        if (dateB === 0 && dateA !== 0) return -1;
        if (dateA !== dateB) {
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        }
        // Tarihler aynı olan kayıtları isimlerine (başlıklarına) göre alfabetik sırala (A - Z)
        const nameA = (a.title || '').trim().toLocaleLowerCase('tr-TR');
        const nameB = (b.title || '').trim().toLocaleLowerCase('tr-TR');
        const nameComp = nameA.localeCompare(nameB, 'tr-TR');
        if (nameComp !== 0) {
          return nameComp;
        }
        // İsimler de aynıysa en son eklenen önce gelsin
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      }

      if (sortField === 'createdAt') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      const strA = (a[sortField] || '').toString().toLocaleLowerCase('tr-TR');
      const strB = (b[sortField] || '').toString().toLocaleLowerCase('tr-TR');
      const comp = strA.localeCompare(strB, 'tr-TR');
      if (comp !== 0) {
        return sortOrder === 'asc' ? comp : -comp;
      }
      // Eşitlik durumunda yeniden eskiye tarih sırası
      const dateA = parseDateFlexible(a.shipmentDate)?.getTime() || 0;
      const dateB = parseDateFlexible(b.shipmentDate)?.getTime() || 0;
      return dateB - dateA;
    });
  }, [filteredShipments, sortField, sortOrder]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  const clearFilters = () => {
    setFilterDate('');
    setFilterWeek('');
    setFilterResponsible('');
    setSortField('shipmentDate');
    setSortOrder('desc');
    setShowCancelled(false);
  };

  const hasActiveFilters = filterDate !== '' || filterWeek !== '' || filterResponsible !== '' || sortField !== 'shipmentDate' || sortOrder !== 'desc' || showCancelled;
  const hasActiveSearch = searchTerm.trim().length > 0;
  const totalCancelledCount = useMemo(() => {
    return shipments.filter(s => s.isCancelled).length;
  }, [shipments]);

  const listKPI = React.useMemo(() => {
    let totalPallets = 0;
    let totalGross = 0;
    let totalNet = 0;
    let completeCount = 0;
    let cancelledCount = 0;

    sortedShipments.forEach(s => {
      if (s.isCancelled) {
        cancelledCount++;
      } else {
        const isComplete = getShipmentListMissingFields(s).length === 0;
        if (isComplete) completeCount++;
        
        const weights = calculateShipmentWeights(s);
        totalPallets += weights.totalPallets;
        totalGross += weights.grossWeight;
        totalNet += weights.netWeight;
      }
    });

    return {
      totalShipments: sortedShipments.length,
      completeCount,
      cancelledCount,
      missingCount: sortedShipments.length - completeCount - cancelledCount,
      totalPallets,
      totalGross: Math.round(totalGross * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
    };
  }, [sortedShipments]);

  return (
    <div className="bg-slate-100 dark:bg-stone-900 border border-slate-400 dark:border-stone-800 shadow-sm flex flex-col h-full min-h-0 transition-colors">
      <div className="bg-slate-200 dark:bg-stone-800/90 border-b border-slate-400 dark:border-stone-700 px-4 py-2 flex flex-wrap md:flex-nowrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-stone-100">Sevkiyatlar ({sortedShipments.length})</h2>
        </div>

        {/* Arama Çubuğu (Üst Bölüm) */}
        <div className="flex items-center gap-1.5 flex-1 max-w-md min-w-[200px] order-3 md:order-2 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-stone-400" />
            <input 
              type="text" 
              placeholder="Arama (Başlık, Booking, AWB, Sorumlu, PO, Fatura...)" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-sm bg-white dark:bg-stone-950 border border-slate-400 dark:border-stone-700 text-slate-900 dark:text-stone-100 placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-blue-600 dark:focus:border-amber-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-amber-400 rounded-sm shadow-xs"
            />
            {hasActiveSearch && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-0.5 cursor-pointer transition-colors"
                title="Aramayı Temizle"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {hasActiveSearch && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-700 rounded-sm flex items-center justify-center transition-colors shrink-0 shadow-xs cursor-pointer"
              title="Aramayı Sıfırla"
              aria-label="Aramayı Sıfırla"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 order-2 md:order-3">
          <Button onClick={() => onSelect('new')}><Plus className="w-4 h-4 mr-1" /> Yeni Sevkiyat</Button>
        </div>
      </div>
      
      <div className="px-3 py-1.5 border-b border-slate-300 dark:border-stone-800 bg-slate-200/50 dark:bg-stone-900/60 flex flex-nowrap items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap">
          {/* Sıralama Seçeneği */}
          <div className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-sm px-2 py-1 shadow-xs shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-stone-400 shrink-0" />
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split('-') as [SortField, SortOrder];
                setSortField(f);
                setSortOrder(o);
              }}
              className="bg-transparent text-xs text-slate-800 dark:text-stone-200 font-medium focus:outline-none cursor-pointer pr-0.5"
              title="Sıralama Seçeneği"
            >
              <option value="shipmentDate-desc" className="dark:bg-stone-900 dark:text-stone-100">Tarih: En Yeni Önce</option>
              <option value="shipmentDate-asc" className="dark:bg-stone-900 dark:text-stone-100">Tarih: En Eski Önce</option>
              <option value="missing-desc" className="dark:bg-stone-900 dark:text-stone-100">Eksik Bilgi: Önce Eksikler</option>
              <option value="title-asc" className="dark:bg-stone-900 dark:text-stone-100">Başlık: A - Z</option>
              <option value="title-desc" className="dark:bg-stone-900 dark:text-stone-100">Başlık: Z - A</option>
              <option value="bookingNo-asc" className="dark:bg-stone-900 dark:text-stone-100">Booking No: A - Z</option>
              <option value="bookingNo-desc" className="dark:bg-stone-900 dark:text-stone-100">Booking No: Z - A</option>
              <option value="responsiblePerson-asc" className="dark:bg-stone-900 dark:text-stone-100">Sorumlu: A - Z</option>
              <option value="responsiblePerson-desc" className="dark:bg-stone-900 dark:text-stone-100">Sorumlu: Z - A</option>
              <option value="createdAt-desc" className="dark:bg-stone-900 dark:text-stone-100">Kayıt: En Son Eklenen</option>
              <option value="createdAt-asc" className="dark:bg-stone-900 dark:text-stone-100">Kayıt: İlk Eklenen</option>
            </select>
          </div>

          {/* Sorumlu Seçimi */}
          <div className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-sm px-2 py-1 shadow-xs shrink-0">
            <User className="w-3.5 h-3.5 text-slate-500 dark:text-stone-400 shrink-0" />
            <select
              value={filterResponsible}
              onChange={(e) => setFilterResponsible(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-stone-200 font-medium focus:outline-none cursor-pointer pr-0.5"
              title="Sorumlu Kişiye Göre Filtrele"
            >
              <option value="" className="dark:bg-stone-900 dark:text-stone-100">Tüm Sorumlular</option>
              {responsiblePersonList.map((person) => (
                <option key={person} value={person} className="dark:bg-stone-900 dark:text-stone-100">{person}</option>
              ))}
              <option value="__unassigned__" className="dark:bg-stone-900 dark:text-stone-100">Sorumlu Belirtilmemiş</option>
            </select>
          </div>

          <div className="relative w-31 shrink-0">
            <Calendar className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-stone-400" />
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-7 pr-1 py-1 text-xs bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-200 border border-slate-400 dark:border-stone-700 focus:outline-none focus:border-blue-500 dark:focus:border-amber-400 rounded-sm shadow-xs"
              title="Tarihe Göre Filtrele"
            />
          </div>
          <div className="relative w-24 shrink-0">
            <Hash className="w-3.5 h-3.5 absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-stone-400" />
            <input 
              type="number" 
              min="1"
              max="53"
              placeholder={`Hafta (${currentWeek})`}
              value={filterWeek}
              onChange={(e) => setFilterWeek(e.target.value)}
              className="w-full pl-6 pr-1 py-1 text-xs bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-200 placeholder:text-slate-400 dark:placeholder:text-stone-500 border border-slate-400 dark:border-stone-700 focus:outline-none focus:border-blue-500 dark:focus:border-amber-400 rounded-sm shadow-xs"
              title={`Haftaya Göre Filtrele (Bulunduğumuz hafta: ${currentWeek}. Hafta)`}
            />
          </div>

          <button 
            type="button"
            onClick={() => {
              if (filterDate === todayStr) {
                setFilterDate('');
              } else {
                setFilterDate(todayStr);
                setFilterWeek('');
              }
            }}
            className={`px-2 py-1 text-xs font-bold rounded-sm border transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer shrink-0 ${
              filterDate === todayStr
                ? 'bg-blue-600 dark:bg-amber-600 text-white border-blue-700 dark:border-amber-700 shadow-xs'
                : 'bg-white dark:bg-stone-900 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 border-slate-400 dark:border-stone-700 shadow-xs'
            }`}
            title={filterDate === todayStr ? 'Bugün filtresini kaldır' : 'Bugünkü sevkiyatları listele'}
          >
            <Clock className="w-3 h-3 text-blue-500 dark:text-amber-400" />
            <span>Bugün</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              if (filterWeek === String(currentWeek)) {
                setFilterWeek('');
              } else {
                setFilterWeek(String(currentWeek));
                setFilterDate('');
              }
            }}
            className={`px-2 py-1 text-xs font-bold rounded-sm border transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer shrink-0 ${
              filterWeek === String(currentWeek)
                ? 'bg-blue-600 dark:bg-amber-600 text-white border-blue-700 dark:border-amber-700 shadow-xs'
                : 'bg-white dark:bg-stone-900 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 border-slate-400 dark:border-stone-700 shadow-xs'
            }`}
            title={filterWeek === String(currentWeek) ? 'Hafta filtresini kaldır' : `Bulunduğumuz haftayı filtrele (${currentWeek}. Hafta)`}
          >
            <Calendar className="w-3 h-3 text-blue-500 dark:text-amber-400" />
            <span>Bu Hafta ({currentWeek})</span>
          </button>

          {/* İptalleri Göster (Kısa Text + Tick Box) */}
          <label 
            className={`flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-sm border cursor-pointer select-none shadow-xs transition-colors shrink-0 ${
              showCancelled 
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-800 text-rose-800 dark:text-rose-300' 
                : 'bg-white dark:bg-stone-900 border-slate-400 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-50 dark:hover:bg-stone-800'
            }`}
            title="İptal edilmiş sevkiyatları listede göster"
          >
            <input 
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              className="w-3 h-3 text-rose-600 border-slate-400 rounded-xs focus:ring-rose-500 cursor-pointer"
            />
            <span className="whitespace-nowrap">İptaller</span>
            {totalCancelledCount > 0 && (
              <span className={`text-[10px] font-mono px-1 rounded-sm ${
                showCancelled ? 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 font-bold' : 'bg-slate-200 dark:bg-stone-800 text-slate-600 dark:text-stone-400'
              }`}>
                {totalCancelledCount}
              </span>
            )}
          </label>
          
          {/* Çöp Kutusu Butonu */}
          <button
            type="button"
            onClick={() => setIsTrashOpen(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-sm border bg-white dark:bg-stone-900 text-slate-700 dark:text-stone-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-400 dark:hover:border-rose-800 border-slate-400 dark:border-stone-700 shadow-xs transition-colors cursor-pointer shrink-0"
            title="Silinen sevkiyatları görüntüle ve geri yükle"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="whitespace-nowrap">Çöp Kutusu</span>
            {deletedShipments.length > 0 && (
              <span className="text-[10px] font-mono px-1 py-0 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-800 leading-none">
                {deletedShipments.length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button 
              type="button"
              onClick={clearFilters}
              className="p-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border border-red-700 rounded-sm flex items-center justify-center transition-colors shrink-0 shadow-xs cursor-pointer"
              title="Filtreleri Sıfırla"
              aria-label="Filtreleri Sıfırla"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>

      {/* KPI & Hacim Özeti Şeridi */}
      <div className="bg-slate-50 dark:bg-stone-900/95 border-b border-slate-300 dark:border-stone-800 px-4 py-1.5 flex items-center justify-between text-xs text-slate-700 dark:text-stone-300 flex-wrap gap-2 select-none shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-stone-400 font-medium">Listelenen:</span>
            <span className="font-bold text-slate-900 dark:text-stone-100 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 px-1.5 py-0.5 rounded shadow-xs">{listKPI.totalShipments} Sevkiyat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> {listKPI.completeCount} Eksiksiz
            </span>
            {listKPI.missingCount > 0 && (
              <span className="text-amber-800 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> {listKPI.missingCount} Eksikli
              </span>
            )}
            {totalCancelledCount > 0 && (
              <button
                type="button"
                onClick={() => setShowCancelled(prev => !prev)}
                className={`font-bold px-1.5 py-0.5 rounded flex items-center gap-1 text-xs transition-colors cursor-pointer ${
                  showCancelled
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900/60'
                    : 'bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400 border border-slate-300 dark:border-stone-700 hover:bg-slate-200 dark:hover:bg-stone-700 opacity-90'
                }`}
                title={showCancelled ? 'İptal edilen kayıtları listede gizle' : 'İptal edilen kayıtları listede göster'}
              >
                <Ban className={`w-3 h-3 ${showCancelled ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-stone-400'}`} />
                <span>{showCancelled ? `${listKPI.cancelledCount} İptal (Gizle)` : `${totalCancelledCount} İptal (Göster)`}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-600 dark:text-stone-400 font-medium ml-auto">
          <span>Toplam: <strong className="text-slate-900 dark:text-stone-100 font-mono font-bold">{listKPI.totalPallets}</strong> Palet</span>
          <span className="text-slate-300 dark:text-stone-700">|</span>
          <span>Brüt Ağırlık: <strong className="text-slate-900 dark:text-stone-100 font-mono font-bold">{formatNumber(listKPI.totalGross)}</strong> kg</span>
          <span className="text-slate-300 dark:text-stone-700">|</span>
          <span>Net Ağırlık: <strong className="text-slate-900 dark:text-stone-100 font-mono font-bold">{formatNumber(listKPI.totalNet)}</strong> kg</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-left border-collapse text-sm table-fixed min-w-max">
          <thead className="bg-slate-200 dark:bg-stone-800 sticky top-0 z-10 shadow-sm text-slate-600 dark:text-stone-300 text-xs uppercase tracking-wider select-none border-b border-slate-400 dark:border-stone-700">
            <tr>
              <th 
                className="p-0 border-b border-slate-400 dark:border-stone-700 font-semibold relative align-middle cursor-pointer hover:bg-slate-300 dark:hover:bg-stone-700/60 transition-colors" 
                style={{ width: colWidths.title }}
                onClick={() => handleSort('title')}
                title="Başlığa göre sırala"
              >
                <div className="p-2 w-full flex items-center justify-between">
                  <span className="truncate">Başlık / İsim</span>
                  {renderSortIcon('title')}
                </div>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-300 dark:hover:bg-amber-500 z-10 transition-colors" 
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, 'title');
                  }}
                />
              </th>
              <th 
                className="p-0 border-b border-slate-400 dark:border-stone-700 font-semibold relative align-middle cursor-pointer hover:bg-slate-300 dark:hover:bg-stone-700/60 transition-colors" 
                style={{ width: colWidths.date }}
                onClick={() => handleSort('shipmentDate')}
                title="Sevkiyat Tarihine göre sırala"
              >
                <div className="p-2 w-full flex items-center justify-between">
                  <span className="truncate">Sevkiyat Tarihi</span>
                  {renderSortIcon('shipmentDate')}
                </div>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-300 dark:hover:bg-amber-500 z-10 transition-colors" 
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, 'date');
                  }}
                />
              </th>
              <th 
                className="p-0 border-b border-slate-400 dark:border-stone-700 font-semibold relative align-middle cursor-pointer hover:bg-slate-300 dark:hover:bg-stone-700/60 transition-colors" 
                style={{ width: colWidths.booking }}
                onClick={() => handleSort('bookingNo')}
                title="Booking No'ya göre sırala"
              >
                <div className="p-2 w-full flex items-center justify-between">
                  <span className="truncate">Booking No</span>
                  {renderSortIcon('bookingNo')}
                </div>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-300 dark:hover:bg-amber-500 z-10 transition-colors" 
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, 'booking');
                  }}
                />
              </th>
              <th 
                className="p-0 border-b border-slate-400 dark:border-stone-700 font-semibold relative align-middle cursor-pointer hover:bg-slate-300 dark:hover:bg-stone-700/60 transition-colors" 
                style={{ width: colWidths.responsible }}
                onClick={() => handleSort('responsiblePerson')}
                title="Sorumluya göre sırala"
              >
                <div className="p-2 w-full flex items-center justify-between">
                  <span className="truncate">Sorumlu</span>
                  {renderSortIcon('responsiblePerson')}
                </div>
                <div 
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-300 dark:hover:bg-amber-500 z-10 transition-colors" 
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, 'responsible');
                  }}
                />
              </th>
              <th className="p-2 border-b border-slate-400 dark:border-stone-700 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sortedShipments.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-600 dark:text-stone-400">
                  {shipments.length === 0 ? (
                    <div className="max-w-md mx-auto py-6 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                        <Plane className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-stone-200">
                        Bu Cihazda Henüz Kayıtlı Sevkiyat Bulunmuyor
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-stone-400 leading-relaxed">
                        Masaüstünüzde daha önce oluşturduğunuz bir <code className="font-mono bg-slate-200 dark:bg-stone-800 px-1 py-0.5 rounded text-slate-700 dark:text-stone-300">.json</code> yedek dosyası varsa <strong>Ayarlar &gt; Masaüstü Dosyası</strong> adımından bağlayabilir veya yukarıdaki <strong>"Yeni Sevkiyat"</strong> butonuyla ilk operasyonunuzu kaydedebilirsiniz.
                      </p>
                    </div>
                  ) : (
                    <div className="py-6 space-y-2">
                      <p className="text-sm font-medium">Arama veya filtre kriterlerinize uygun sevkiyat bulunamadı.</p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setFilterDate('');
                          setFilterWeek('');
                          setFilterResponsible('');
                        }}
                        className="text-xs text-blue-600 dark:text-amber-400 hover:underline font-semibold"
                      >
                        Filtreleri Temizle
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              sortedShipments.map(s => {
                const missingFields = getShipmentListMissingFields(s);
                return (
                  <tr 
                    key={s.id} 
                    className={`border-b transition-colors cursor-pointer ${
                      s.isCancelled 
                        ? 'border-rose-200 dark:border-rose-950/60 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-900/30' 
                        : 'border-slate-300 dark:border-stone-800 hover:bg-blue-50 dark:hover:bg-stone-800/70'
                    }`} 
                    onClick={() => onSelect(s.id)}
                  >
                    <td className="p-2 font-bold text-slate-900 dark:text-stone-100 truncate" title={s.title || ''}>
                      <div className="flex items-center gap-1.5 truncate">
                        {s.isCancelled && (
                          <span 
                            title="Bu sevkiyat iptal edilmiştir" 
                            className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-black bg-rose-600 text-white rounded select-none tracking-wider shadow-2xs"
                          >
                            <Ban className="w-2.5 h-2.5" /> İPTAL
                          </span>
                        )}
                        <span className={`truncate ${s.isCancelled ? 'line-through text-slate-500 dark:text-stone-500 font-medium' : ''}`}>
                          {s.title || '-'}
                        </span>
                        {!s.isCancelled && missingFields.length > 0 && (
                          <span 
                            title={`Eksik Bilgiler (${missingFields.length}):\n• ${missingFields.join('\n• ')}`} 
                            className="shrink-0 flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-semibold bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 rounded select-none"
                          >
                            <AlertCircle className="w-2.5 h-2.5 text-red-600 dark:text-red-400" /> Eksik Bilgi
                          </span>
                        )}
                        {s.notes && (
                          <span 
                            title={`Not: ${s.notes}`} 
                            className="shrink-0 flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded select-none"
                          >
                            <FileText className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" /> Not
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`p-2 font-bold truncate ${s.isCancelled ? 'line-through text-slate-400 dark:text-stone-500 font-normal' : 'text-slate-900 dark:text-stone-100'}`}>
                      {s.shipmentDate ? formatShipmentDateDetailed(s.shipmentDate) : '-'}
                    </td>
                    <td className={`p-2 font-medium truncate ${s.isCancelled ? 'line-through text-slate-400 dark:text-stone-500' : 'text-slate-800 dark:text-stone-200'}`} title={s.bookingNo || ''}>
                      {s.bookingNo || '-'}
                    </td>
                    <td className={`p-2 truncate font-medium ${s.isCancelled ? 'text-slate-400 dark:text-stone-500 line-through' : 'text-slate-700 dark:text-stone-300'}`} title={s.responsiblePerson || ''}>
                      {s.responsiblePerson === 'Boş Bırak' ? (
                        <span className="text-slate-400 dark:text-stone-500 italic">Boş Bırak</span>
                      ) : (
                        s.responsiblePerson || '-'
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmailModalShipment(s);
                          }}
                          className="text-slate-400 hover:text-blue-600 dark:hover:text-amber-400 hover:bg-blue-50 dark:hover:bg-stone-800 p-1 rounded transition-colors"
                          title="Bu sevkiyata ait hazır e-posta şablonunu aç"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button className="text-blue-600 dark:text-amber-400 hover:text-blue-800 dark:hover:text-amber-300 p-1">
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {emailModalShipment && (
        <EmailTemplateModal
          isOpen={true}
          onClose={() => setEmailModalShipment(null)}
          shipment={emailModalShipment}
        />
      )}

      {/* Çöp Kutusu Modalı */}
      <TrashModal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
      />
    </div>
  );
}
