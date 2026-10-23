import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Trash2, RotateCcw, X, Search, Calendar, User, Plane, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DeletedShipment } from '../../types';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TrashModal({ isOpen, onClose }: TrashModalProps) {
  const {
    deletedShipments = [],
    restoreShipment,
    restoreAllShipments,
    permanentlyDeleteShipment,
    emptyTrash,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);

  const filteredDeleted = useMemo(() => {
    if (!searchTerm.trim()) return deletedShipments;
    const term = searchTerm.toLowerCase();
    return deletedShipments.filter((s: DeletedShipment) =>
      (s.title || '').toLowerCase().includes(term) ||
      (s.bookingNo || '').toLowerCase().includes(term) ||
      (s.awbNo || '').toLowerCase().includes(term) ||
      (s.responsiblePerson || '').toLowerCase().includes(term) ||
      (s.poNo || []).join(' ').toLowerCase().includes(term)
    );
  }, [deletedShipments, searchTerm]);

  if (!isOpen) return null;

  const handleRestore = (id: string, title?: string) => {
    restoreShipment(id);
    setRestoredNotice(`"${title || 'Sevkiyat'}" başarıyla geri yüklendi.`);
    setTimeout(() => setRestoredNotice(null), 3000);
  };

  const handleRestoreAll = () => {
    restoreAllShipments();
    setRestoredNotice('Tüm sevkiyatlar başarıyla geri yüklendi.');
    setTimeout(() => setRestoredNotice(null), 3000);
  };

  const handleEmptyTrash = () => {
    if (confirmEmpty) {
      emptyTrash();
      setConfirmEmpty(false);
    } else {
      setConfirmEmpty(true);
      setTimeout(() => setConfirmEmpty(false), 4000);
    }
  };

  const handlePermanentDelete = (id: string) => {
    if (confirmDeleteId === id) {
      permanentlyDeleteShipment(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 4000);
    }
  };

  const formatDeletedDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white dark:bg-[#1a1715] border border-slate-300 dark:border-stone-700 w-full max-w-3xl rounded-md shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-slate-100 dark:bg-stone-900 border-b border-slate-300 dark:border-stone-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-stone-100 flex items-center gap-2">
                <span>Çöp Kutusu</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-stone-800 text-slate-700 dark:text-stone-300 border border-slate-300 dark:border-stone-700">
                  {deletedShipments.length} Kayıt
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-stone-400">
                Silinen sevkiyatlar burada saklanır. İstediğiniz kaydı geri yükleyebilir veya kalıcı olarak silebilirsiniz.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-stone-400 dark:hover:text-stone-200 rounded hover:bg-slate-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Restore Notification Toast */}
        {restoredNotice && (
          <div className="bg-emerald-50 dark:bg-emerald-950/70 border-b border-emerald-300 dark:border-emerald-800 px-4 py-2 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{restoredNotice}</span>
          </div>
        )}

        {/* Toolbar (Search & Bulk Actions) */}
        {deletedShipments.length > 0 && (
          <div className="bg-slate-50 dark:bg-stone-900/50 border-b border-slate-200 dark:border-stone-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Çöp kutusunda ara..."
                className="w-full pl-8 pr-7 py-1 text-xs bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded-sm text-slate-900 dark:text-stone-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRestoreAll}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                title="Çöp kutusundaki tüm sevkiyatları listeye geri yükle"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tümünü Geri Yükle</span>
              </button>

              <button
                type="button"
                onClick={handleEmptyTrash}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                  confirmEmpty
                    ? 'bg-red-700 text-white animate-pulse'
                    : 'bg-slate-200 dark:bg-stone-800 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/60'
                }`}
                title="Çöp kutusundaki tüm kayıtları kalıcı olarak temizle"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmEmpty ? 'Emin misiniz? Tümünü Sil!' : 'Çöp Kutusunu Boşalt'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Content / List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
          {deletedShipments.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-stone-600">
              <Trash2 className="w-12 h-12 mx-auto mb-2.5 opacity-30 stroke-[1.5]" />
              <p className="text-sm font-semibold text-slate-600 dark:text-stone-400">Çöp Kutusu Boş</p>
              <p className="text-xs mt-1 text-slate-400 dark:text-stone-500">
                Silinen herhangi bir sevkiyat kaydı bulunmuyor.
              </p>
            </div>
          ) : filteredDeleted.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-stone-500">
              <p className="text-xs">Aramanıza uygun silinmiş kayıt bulunamadı.</p>
            </div>
          ) : (
            filteredDeleted.map((s: DeletedShipment) => {
              const isConfirmingDelete = confirmDeleteId === s.id;
              return (
                <div
                  key={s.id}
                  className="p-3 rounded border border-slate-300 dark:border-stone-800 bg-white dark:bg-stone-900/70 hover:border-slate-400 dark:hover:border-stone-700 shadow-xs flex flex-wrap md:flex-nowrap items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-stone-100">
                        {s.title || 'İsimsiz Sevkiyat'}
                      </span>
                      {s.isCancelled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-semibold border border-rose-300 dark:border-rose-900">
                          İptal Edilmişti
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-stone-400">
                      {s.bookingNo && (
                        <span className="font-mono">
                          <strong className="font-semibold text-slate-700 dark:text-stone-300">Booking:</strong> {s.bookingNo}
                        </span>
                      )}
                      {s.awbNo && (
                        <span className="font-mono">
                          <strong className="font-semibold text-slate-700 dark:text-stone-300">AWB:</strong> {s.awbNo}
                        </span>
                      )}
                      {s.shipmentDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{s.shipmentDate}</span>
                        </span>
                      )}
                      {s.responsiblePerson && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{s.responsiblePerson}</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-[10px] text-rose-600/80 dark:text-rose-400/80 font-mono flex items-center gap-1">
                      <span>Silinme: {formatDeletedDate(s.deletedAt)}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore(s.id, s.title)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer"
                      title="Bu sevkiyatı ana listeye geri yükle"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Geri Yükle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePermanentDelete(s.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                        isConfirmingDelete
                          ? 'bg-red-700 text-white animate-pulse'
                          : 'bg-slate-100 dark:bg-stone-800 hover:bg-red-100 dark:hover:bg-red-950/60 text-slate-600 dark:text-stone-400 hover:text-red-700 dark:hover:text-red-400 border border-slate-300 dark:border-stone-700'
                      }`}
                      title="Kalıcı olarak sil (Geri alınamaz)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isConfirmingDelete ? 'Emin misiniz? Kalıcı Sil' : 'Kalıcı Sil'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 dark:bg-stone-900 border-t border-slate-300 dark:border-stone-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-stone-400 shrink-0">
          <span>Toplam {deletedShipments.length} silinmiş sevkiyat</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 font-semibold rounded bg-slate-200 dark:bg-stone-800 hover:bg-slate-300 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
