import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Shipment } from '../types';
import { 
  parseDateFlexible, 
  getISOWeekNumber, 
  getISOWeekDateRange, 
  formatNumber, 
  calculateShipmentWeights, 
  getShipmentMissingFields 
} from '../utils/calculations';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Ban, 
  ArrowRight, 
  Search, 
  CalendarDays,
  User
} from 'lucide-react';

interface WeeklyShipmentSwitcherProps {
  currentShipmentId: string;
  currentShipmentDate?: string;
  onSwitchShipment: (id: string) => void;
  className?: string;
}

export function WeeklyShipmentSwitcher({
  currentShipmentId,
  currentShipmentDate,
  onSwitchShipment,
  className = ''
}: WeeklyShipmentSwitcherProps) {
  const { shipments } = useAppStore();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Parse current shipment date and week
  const weekInfo = useMemo(() => {
    let d = parseDateFlexible(currentShipmentDate);
    const hasCustomDate = !!d;
    if (!d) {
      d = new Date(); // fallback to today
    }
    const week = getISOWeekNumber(d);
    const year = d.getFullYear();
    const dateRange = getISOWeekDateRange(year, week);
    return {
      week,
      year,
      hasCustomDate,
      referenceDate: d,
      dateRange
    };
  }, [currentShipmentDate]);

  // Format week range text (e.g., "21 - 27 Eylül 2026")
  const dateRangeText = useMemo(() => {
    const { start, end } = weekInfo.dateRange;
    const sameMonth = start.getMonth() === end.getMonth();
    const monthNames = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    if (sameMonth) {
      return `${start.getDate()} - ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${start.getFullYear()}`;
  }, [weekInfo]);

  // Find all shipments in the same week (İptalleri sadece ana listede göster)
  const weekShipments = useMemo(() => {
    return shipments
      .filter(s => {
        // İptaller sadece ana listede gösterilir; haftalık geçiş ekranında yer almaz
        if (s.isCancelled && s.id !== currentShipmentId) return false;
        if (!s.shipmentDate) return false;
        const d = parseDateFlexible(s.shipmentDate);
        if (!d) return false;
        return getISOWeekNumber(d) === weekInfo.week && d.getFullYear() === weekInfo.year;
      })
      .sort((a, b) => {
        const dateA = parseDateFlexible(a.shipmentDate)?.getTime() || 0;
        const dateB = parseDateFlexible(b.shipmentDate)?.getTime() || 0;
        if (dateA !== dateB) return dateA - dateB;
        return (a.title || '').localeCompare(b.title || '', 'tr-TR');
      });
  }, [shipments, weekInfo.week, weekInfo.year, currentShipmentId]);

  // Find current index
  const currentIndex = weekShipments.findIndex(s => s.id === currentShipmentId);
  const prevShipment = currentIndex > 0 ? weekShipments[currentIndex - 1] : null;
  const nextShipment = currentIndex >= 0 && currentIndex < weekShipments.length - 1 ? weekShipments[currentIndex + 1] : null;

  // Filtered shipments for inside the mini panel
  const panelFilteredShipments = useMemo(() => {
    if (!searchTerm.trim()) return weekShipments;
    const term = searchTerm.toLowerCase().trim();
    return weekShipments.filter(s => {
      const missing = getShipmentMissingFields(s);
      return (
        (s.title || '').toLowerCase().includes(term) ||
        (s.bookingNo || '').toLowerCase().includes(term) ||
        (s.responsiblePerson || '').toLowerCase().includes(term) ||
        (s.awbNo || '').toLowerCase().includes(term) ||
        (s.shipmentDate || '').toLowerCase().includes(term) ||
        (term === 'iptal' && !!s.isCancelled) ||
        (term === 'eksik' && missing.length > 0)
      );
    });
  }, [weekShipments, searchTerm]);

  // KPI calculations for this week
  const weekKPI = useMemo(() => {
    let totalPallets = 0;
    let totalGross = 0;
    let totalNet = 0;
    let completeCount = 0;
    let missingCount = 0;

    const activeShipments = weekShipments.filter(s => !s.isCancelled);

    activeShipments.forEach(s => {
      const missing = getShipmentMissingFields(s);
      if (missing.length === 0) completeCount++;
      else missingCount++;

      const w = calculateShipmentWeights(s);
      totalPallets += w.totalPallets;
      totalGross += w.grossWeight;
      totalNet += w.netWeight;
    });

    return {
      count: activeShipments.length,
      totalPallets,
      totalGross: Math.round(totalGross * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      completeCount,
      missingCount
    };
  }, [weekShipments]);

  // Quick formatted day helper (e.g., "24 Eyl Per")
  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'Tarihsiz';
    const d = parseDateFlexible(dateStr);
    if (!d) return dateStr;
    const day = d.getDate();
    const month = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()];
    const weekday = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][d.getDay()];
    return `${day} ${month} ${weekday}`;
  };

  const formatFullDate = (dateStr?: string) => {
    if (!dateStr) return 'Tarih belirtilmedi';
    const d = parseDateFlexible(dateStr);
    if (!d) return dateStr;
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    }).format(d);
  };

  const handleSelect = (targetId: string) => {
    if (targetId === currentShipmentId) return;
    onSwitchShipment(targetId);
    setIsPanelOpen(false);
  };

  // Update left/right scroll arrows availability and overflow state
  const updateScrollStatus = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setHasOverflow(scrollWidth > clientWidth + 4);
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollStatus();
    el.addEventListener('scroll', updateScrollStatus, { passive: true });
    window.addEventListener('resize', updateScrollStatus);
    return () => {
      el.removeEventListener('scroll', updateScrollStatus);
      window.removeEventListener('resize', updateScrollStatus);
    };
  }, [updateScrollStatus, weekShipments]);

  // Mouse drag handlers for drag-to-scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !scrollContainerRef.current) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX;
    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !scrollContainerRef.current) return;
      const dx = e.pageX - startXRef.current;
      if (Math.abs(dx) > 3) {
        if (!hasDraggedRef.current) {
          hasDraggedRef.current = true;
          setIsDragging(true);
        }
        scrollContainerRef.current.scrollLeft = scrollLeftRef.current - dx;
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setTimeout(() => {
          hasDraggedRef.current = false;
          setIsDragging(false);
        }, 50);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Horizontal wheel scroll handler
  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollContainerRef.current) return;
    if (e.deltaY !== 0) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleScrollBy = (offset: number) => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Auto-scroll active chip into view in the top bar (only if not currently dragging)
  useEffect(() => {
    if (isDraggingRef.current) return;
    const el = scrollContainerRef.current?.querySelector('[data-active="true"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentShipmentId, weekShipments]);

  return (
    <>
      {/* 1. COMPACT QUICK-SWITCHER BAR (Sleek sub-header) */}
      <div className={`bg-slate-200 dark:bg-stone-800/90 border-b border-slate-300 dark:border-stone-700 px-2 sm:px-3 py-1.5 flex items-center gap-1.5 shadow-2xs select-none text-xs ${className}`}>
        
        {/* Left scroll chevron when overflowing */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => handleScrollBy(-220)}
            disabled={!canScrollLeft}
            className={`shrink-0 p-1 rounded-sm border transition-colors ${
              canScrollLeft
                ? 'bg-white dark:bg-stone-900 border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-200 cursor-pointer shadow-2xs'
                : 'bg-transparent border-transparent text-slate-400 dark:text-stone-600 opacity-30 cursor-default'
            }`}
            title="Sola kaydır"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Center: Scrollable Horizontal Chips of this Week's Shipments with Drag-to-Scroll */}
        <div 
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          onDragStart={(e) => e.preventDefault()}
          className={`flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          } ${isDragging ? '' : 'scroll-smooth'}`}
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        >
          {weekShipments.length === 0 ? (
            <span className="text-slate-500 dark:text-stone-400 italic text-xs">
              Bu haftaya ({weekInfo.week}. Hafta) ait henüz başka sevkiyat kaydı bulunmuyor.
            </span>
          ) : (
            weekShipments.map((s, idx) => {
              const isActive = s.id === currentShipmentId;
              const missing = getShipmentMissingFields(s);
              const isCancelled = !!s.isCancelled;

              return (
                <button
                  key={s.id}
                  type="button"
                  data-active={isActive ? "true" : "false"}
                  onClick={(e) => {
                    if (hasDraggedRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    handleSelect(s.id);
                  }}
                  onDragStart={(e) => e.preventDefault()}
                  className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-xs transition-all ${
                    isDragging ? 'cursor-grabbing pointer-events-none' : 'cursor-pointer'
                  } ${
                    isActive
                      ? 'bg-blue-600 dark:bg-amber-600 border-blue-700 dark:border-amber-700 text-white font-bold shadow-xs ring-1 ring-blue-300 dark:ring-amber-400/50'
                      : isCancelled
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 opacity-80'
                        : 'bg-white dark:bg-stone-900 border-slate-300 dark:border-stone-700 text-slate-800 dark:text-stone-200 hover:bg-amber-50/40 dark:hover:bg-stone-800 hover:border-amber-400 dark:hover:border-amber-500/60 hover:text-amber-900 dark:hover:text-amber-200 shadow-2xs'
                  }`}
                  title={`${s.title || 'Başlıksız'}\nTarih: ${formatFullDate(s.shipmentDate)}\nBooking: ${s.bookingNo || '-'}\n${isCancelled ? 'Durum: İPTAL' : missing.length > 0 ? `Eksik: ${missing.join(', ')}` : 'Durum: Eksiksiz'}`}
                >
                  {/* Status Indicator Icon */}
                  {isCancelled ? (
                    <Ban className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`} />
                  ) : missing.length > 0 ? (
                    <AlertCircle className={`w-3 h-3 shrink-0 ${isActive ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}`} />
                  ) : (
                    <CheckCircle2 className={`w-3 h-3 shrink-0 ${isActive ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  )}

                  {/* Short Date */}
                  <span className={`font-mono text-[11px] ${isActive ? 'text-blue-100 dark:text-amber-100' : 'text-slate-500 dark:text-stone-400 font-medium'}`}>
                    {formatShortDate(s.shipmentDate)}
                  </span>

                  <span className="text-slate-300 dark:text-stone-600">·</span>

                  {/* Title / Booking */}
                  <span className={`truncate max-w-[130px] sm:max-w-[160px] md:max-w-[200px] ${isCancelled && !isActive ? 'line-through text-slate-500 dark:text-stone-400' : ''}`}>
                    {s.title || (s.bookingNo ? `Booking: ${s.bookingNo}` : `Sevkiyat #${idx + 1}`)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Right scroll chevron when overflowing */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => handleScrollBy(220)}
            disabled={!canScrollRight}
            className={`shrink-0 p-1 rounded-sm border transition-colors ${
              canScrollRight
                ? 'bg-white dark:bg-stone-900 border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-200 cursor-pointer shadow-2xs'
                : 'bg-transparent border-transparent text-slate-400 dark:text-stone-600 opacity-30 cursor-default'
            }`}
            title="Sağa kaydır"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. FLOATING BADGE BUTTON (Bottom-right, so it's always accessible even when scrolled down) */}
      <button
        type="button"
        onClick={() => setIsPanelOpen(prev => !prev)}
        className="fixed bottom-4 right-4 z-30 bg-blue-700 dark:bg-amber-600 hover:bg-blue-800 dark:hover:bg-amber-500 text-white font-bold text-xs py-2 px-3 rounded-full shadow-lg border border-blue-500 dark:border-amber-500 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        title="Bu haftaya ait sevkiyatlar listesini aç"
      >
        <CalendarDays className="w-4 h-4 text-blue-200 dark:text-amber-100" />
        <span>{weekInfo.week}. Hafta ({weekShipments.length})</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </button>

      {/* 3. DEDICATED MINI PANEL / SLIDE-OVER DRAWER ("KÜÇÜK EKRAN") */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop with subtle blur */}
          <div 
            className="fixed inset-0 bg-stone-950/60 dark:bg-black/75 backdrop-blur-[2px] transition-opacity"
            onClick={() => setIsPanelOpen(false)}
          />

          {/* Slide-Over Drawer Content */}
          <aside 
            className="relative w-full max-w-md sm:max-w-lg bg-slate-50 dark:bg-stone-900 border-l border-slate-400 dark:border-stone-800 text-slate-900 dark:text-stone-100 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={`${weekInfo.week}. Hafta Sevkiyatları`}
          >
            {/* Header */}
            <div className="bg-slate-200 dark:bg-stone-800/95 border-b border-slate-300 dark:border-stone-700 px-4 py-3 flex items-start justify-between gap-3 shrink-0">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600 dark:bg-amber-600 text-white rounded-md shadow-xs">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-stone-100 uppercase tracking-wide flex items-center gap-2">
                      <span>{weekInfo.week}. HAFTA SEVKİYATLARI</span>
                      <span className="text-xs font-mono font-bold bg-blue-100 dark:bg-amber-950/60 text-blue-800 dark:text-amber-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-amber-800/60">
                        {weekInfo.year}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-stone-400 font-medium">
                      {dateRangeText}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(false)}
                  className="p-1 text-slate-500 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-100 hover:bg-slate-300 dark:hover:bg-stone-700 rounded transition-colors"
                  title="Paneli Kapat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* KPI Summary for this Week */}
            <div className="bg-white dark:bg-stone-900 border-b border-slate-300 dark:border-stone-800 px-4 py-2.5 grid grid-cols-3 gap-2 text-center text-xs shrink-0 select-none">
              <div className="bg-slate-50 dark:bg-stone-800/70 border border-slate-200 dark:border-stone-700/80 p-2 rounded">
                <span className="text-[10px] text-slate-500 dark:text-stone-400 font-bold uppercase tracking-wider block">Sevkiyat</span>
                <span className="text-base font-extrabold text-blue-900 dark:text-amber-400 font-mono">{weekKPI.count}</span>
                <div className="text-[10px] text-slate-500 dark:text-stone-400 flex items-center justify-center gap-1.5 mt-0.5">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{weekKPI.completeCount} tam</span>
                  {weekKPI.missingCount > 0 && <span className="text-amber-700 dark:text-amber-400 font-semibold">· {weekKPI.missingCount} eksik</span>}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-stone-800/70 border border-slate-200 dark:border-stone-700/80 p-2 rounded">
                <span className="text-[10px] text-slate-500 dark:text-stone-400 font-bold uppercase tracking-wider block">Toplam Palet</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-stone-100 font-mono">{weekKPI.totalPallets}</span>
                <span className="text-[10px] text-slate-500 dark:text-stone-400 block mt-0.5">Palet Yükü</span>
              </div>

              <div className="bg-slate-50 dark:bg-stone-800/70 border border-slate-200 dark:border-stone-700/80 p-2 rounded">
                <span className="text-[10px] text-slate-500 dark:text-stone-400 font-bold uppercase tracking-wider block">Brüt Ağırlık</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-stone-100 font-mono">{formatNumber(weekKPI.totalGross)}</span>
                <span className="text-[10px] text-slate-500 dark:text-stone-400 block mt-0.5">kg</span>
              </div>
            </div>

            {/* Search Filter Inside the Week */}
            <div className="p-3 border-b border-slate-300 dark:border-stone-800 bg-slate-100 dark:bg-stone-900/60 shrink-0">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-stone-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Bu haftadaki sevkiyatları ara (başlık, booking, sorumlu)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded-sm pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-stone-100 placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-blue-500 dark:focus:border-amber-500 focus:ring-1 focus:ring-blue-500 dark:focus:ring-amber-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Shipment Cards List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-100/70 dark:bg-[#141210]">
              {panelFilteredShipments.length === 0 ? (
                <div className="text-center py-8 px-4 bg-white dark:bg-stone-900 border border-dashed border-slate-300 dark:border-stone-800 rounded-md">
                  <CalendarDays className="w-8 h-8 text-slate-400 dark:text-stone-600 mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-stone-300">
                    {searchTerm ? 'Arama kriterine uygun sevkiyat bulunamadı.' : 'Bu haftaya ait sevkiyat kaydı bulunmuyor.'}
                  </p>
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="mt-2 text-xs text-blue-600 dark:text-amber-400 hover:underline font-semibold"
                    >
                      Aramayı temizle
                    </button>
                  )}
                </div>
              ) : (
                panelFilteredShipments.map((s, index) => {
                  const isActive = s.id === currentShipmentId;
                  const missing = getShipmentMissingFields(s);
                  const isCancelled = !!s.isCancelled;
                  const palletWeights = calculateShipmentWeights(s);

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelect(s.id)}
                      className={`relative rounded-md border transition-all cursor-pointer p-3 ${
                        isActive
                          ? 'bg-blue-50/90 dark:bg-amber-950/30 border-blue-500 dark:border-amber-500 shadow-sm ring-2 ring-blue-400/50 dark:ring-amber-500/40'
                          : isCancelled
                            ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 hover:border-rose-400 dark:hover:border-rose-700 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 shadow-2xs'
                            : 'bg-white dark:bg-stone-900 border-slate-300 dark:border-stone-800 hover:border-blue-400 dark:hover:border-amber-500/60 hover:bg-blue-50/40 dark:hover:bg-stone-800/80 shadow-2xs'
                      }`}
                    >
                      {/* Active Ribbon / Label */}
                      {isActive && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-600 dark:bg-amber-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-sm shadow-2xs uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          Şu An Açık
                        </div>
                      )}

                      {/* Header Row: Date & Status Badge */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-stone-200 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400 shrink-0" />
                          {formatFullDate(s.shipmentDate)}
                        </span>

                        {isCancelled ? (
                          <span className="text-[10px] font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5" /> İPTAL
                          </span>
                        ) : missing.length > 0 ? (
                          <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" /> {missing.length} Eksik
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" /> Tamamlandı
                          </span>
                        )}
                      </div>

                      {/* Title & Booking */}
                      <div className="mb-2">
                        <h4 className={`text-sm font-extrabold leading-tight ${
                          isActive 
                            ? 'text-blue-900 dark:text-amber-300' 
                            : isCancelled 
                              ? 'text-slate-500 dark:text-stone-400 line-through' 
                              : 'text-slate-900 dark:text-stone-100'
                        }`}>
                          {s.title || 'Başlıksız Sevkiyat'}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-600 dark:text-stone-400 font-mono">
                          {s.bookingNo && (
                            <span className="bg-slate-100 dark:bg-stone-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-stone-700">
                              Booking: <strong className="text-slate-800 dark:text-stone-200">{s.bookingNo}</strong>
                            </span>
                          )}
                          {s.awbNo && (
                            <span className="bg-slate-100 dark:bg-stone-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-stone-700">
                              AWB: <strong className="text-slate-800 dark:text-stone-200">{s.awbNo}</strong>
                            </span>
                          )}
                          {s.responsiblePerson && (
                            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-stone-400 not-italic font-sans">
                              <User className="w-3 h-3 text-slate-400 dark:text-stone-500" />
                              {s.responsiblePerson}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer Row: Pallets & Weights + Switch Button */}
                      <div className="flex items-center justify-between border-t border-slate-200/80 dark:border-stone-700/80 pt-2 mt-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-stone-400 font-medium">
                          <span>
                            <strong className="text-slate-800 dark:text-stone-200 font-mono font-bold">{palletWeights.totalPallets}</strong> Palet
                          </span>
                          <span className="text-slate-300 dark:text-stone-600">·</span>
                          <span>
                            <strong className="text-slate-800 dark:text-stone-200 font-mono font-bold">{formatNumber(palletWeights.grossWeight)}</strong> kg Brüt
                          </span>
                        </div>

                        {isActive ? (
                          <span className="text-xs font-bold text-blue-700 dark:text-amber-400 flex items-center gap-1">
                            Görüntüleniyor
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelect(s.id);
                            }}
                            className="text-xs font-bold text-blue-600 dark:text-amber-400 hover:text-blue-800 dark:hover:text-amber-300 flex items-center gap-1 bg-white dark:bg-stone-800 hover:bg-blue-50 dark:hover:bg-stone-700 border border-blue-300 dark:border-stone-600 px-2 py-1 rounded shadow-2xs transition-colors cursor-pointer"
                          >
                            <span>Geçiş Yap</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Panel Footer */}
            <div className="bg-slate-200 dark:bg-stone-800 border-t border-slate-300 dark:border-stone-700 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 dark:text-stone-400 shrink-0">
              <span className="font-medium">
                {currentIndex >= 0 ? `${weekShipments.length} kayıttan ${currentIndex + 1}. sevkiyat açık` : `${weekShipments.length} sevkiyat listelendi`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!prevShipment}
                  onClick={() => prevShipment && handleSelect(prevShipment.id)}
                  className={`px-2 py-1 rounded border text-xs font-semibold flex items-center gap-1 ${
                    prevShipment 
                      ? 'bg-white dark:bg-stone-700 hover:bg-slate-100 dark:hover:bg-stone-600 text-slate-800 dark:text-stone-200 border-slate-300 dark:border-stone-600 cursor-pointer shadow-2xs' 
                      : 'bg-slate-100 dark:bg-stone-800 text-slate-400 dark:text-stone-600 border-slate-200 dark:border-stone-700 cursor-not-allowed opacity-60'
                  }`}
                >
                  <ChevronLeft className="w-3 h-3" /> Önceki
                </button>

                <button
                  type="button"
                  disabled={!nextShipment}
                  onClick={() => nextShipment && handleSelect(nextShipment.id)}
                  className={`px-2 py-1 rounded border text-xs font-semibold flex items-center gap-1 ${
                    nextShipment 
                      ? 'bg-white dark:bg-stone-700 hover:bg-slate-100 dark:hover:bg-stone-600 text-slate-800 dark:text-stone-200 border-slate-300 dark:border-stone-600 cursor-pointer shadow-2xs' 
                      : 'bg-slate-100 dark:bg-stone-800 text-slate-400 dark:text-stone-600 border-slate-200 dark:border-stone-700 cursor-not-allowed opacity-60'
                  }`}
                >
                  Sonraki <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
