import React, { useState, useMemo } from 'react';
import { Shipment, PalletData } from '../../types';
import { formatDecimal } from '../../utils/packingParser';
import {
  X,
  Search,
  CheckCircle2,
  ShieldAlert,
  FolderPlus,
  ArrowRight,
  ShieldCheck,
  Box,
  Lock,
  Info,
} from 'lucide-react';

/**
 * Checks if a shipment has zero pallet and box information.
 * Returns TRUE only if there are NO pallets or none of the pallets contain
 * any boxes, products, or weights.
 * If ANY pallet has products, box counts, items, material codes, or pallet weights,
 * it returns FALSE (meaning it is populated and must NOT be overwritten).
 */
export function isShipmentPalletsEmpty(shipment: Shipment): boolean {
  if (!shipment.pallets || shipment.pallets.length === 0) return true;

  const hasAnyPopulatedData = shipment.pallets.some((p) => {
    // Check if pallet tare or dimensions are configured
    const hasPalletWeight = Boolean(p.palletWeight && p.palletWeight > 0);
    const hasPalletDim = Boolean(p.palletDimensions && p.palletDimensions.trim() !== '');

    // Check if any product / box row exists with meaningful data
    const hasBoxes = Boolean(
      p.products &&
        p.products.length > 0 &&
        p.products.some(
          (pr) =>
            (pr.boxCount || 0) > 0 ||
            (pr.itemsPerBox || 0) > 0 ||
            Boolean(pr.materialCode?.trim()) ||
            Boolean(pr.materialDescription?.trim()) ||
            (pr.boxWeight || 0) > 0
        )
    );

    return hasPalletWeight || hasPalletDim || hasBoxes;
  });

  return !hasAnyPopulatedData;
}

interface AddToShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: Shipment[];
  palletsToTransfer: PalletData[];
  totalGrossWeight: number;
  totalPieces: number;
  totalBoxes: number;
  onConfirmAdd: (targetShipment: Shipment) => void;
}

export const AddToShipmentModal: React.FC<AddToShipmentModalProps> = ({
  isOpen,
  onClose,
  shipments,
  palletsToTransfer,
  totalGrossWeight,
  totalPieces,
  totalBoxes,
  onConfirmAdd,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [showProtected, setShowProtected] = useState(false);

  // Eligible shipments: strictly empty pallet/box info
  const eligibleShipments = useMemo(() => {
    return shipments.filter((s) => !s.isCancelled && isShipmentPalletsEmpty(s));
  }, [shipments]);

  // Protected shipments: already have pallet or box data
  const protectedShipments = useMemo(() => {
    return shipments.filter((s) => !s.isCancelled && !isShipmentPalletsEmpty(s));
  }, [shipments]);

  // Search filtered eligible shipments
  const filteredEligible = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return eligibleShipments;
    return eligibleShipments.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(term) ||
        (s.bookingNo || '').toLowerCase().includes(term) ||
        (s.awbNo || '').toLowerCase().includes(term) ||
        (s.responsiblePerson || '').toLowerCase().includes(term) ||
        (s.shipmentDate || '').toLowerCase().includes(term)
    );
  }, [eligibleShipments, searchTerm]);

  // Search filtered protected shipments (for view-only reference)
  const filteredProtected = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return protectedShipments;
    return protectedShipments.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(term) ||
        (s.bookingNo || '').toLowerCase().includes(term) ||
        (s.awbNo || '').toLowerCase().includes(term) ||
        (s.responsiblePerson || '').toLowerCase().includes(term) ||
        (s.shipmentDate || '').toLowerCase().includes(term)
    );
  }, [protectedShipments, searchTerm]);

  const selectedShipment = useMemo(() => {
    return eligibleShipments.find((s) => s.id === selectedShipmentId) || null;
  }, [eligibleShipments, selectedShipmentId]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedShipment) return;
    onConfirmAdd(selectedShipment);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-900 dark:text-stone-100">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-300 dark:border-stone-700 flex items-center justify-between bg-slate-100 dark:bg-stone-800/90">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-blue-100 dark:bg-amber-950/70 text-blue-700 dark:text-amber-400 border border-blue-300 dark:border-amber-800">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-stone-100">
                Mevcut Sevkiyata Ekle
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-stone-400">
                Yalnızca palet ve koli bilgisi boş olan sevkiyatlar seçilebilir
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 hover:bg-slate-200 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfer Info Banner */}
        <div className="px-4 py-2 bg-blue-50/70 dark:bg-stone-850 border-b border-slate-200 dark:border-stone-700 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-stone-200">
            <Box className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
            <span>Aktarılacak Veri:</span>
            <span className="font-mono text-blue-700 dark:text-amber-400">
              {palletsToTransfer.length} Palet ({totalBoxes} Kap, {totalPieces.toLocaleString('tr-TR')} Adet)
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-600 dark:text-stone-400">
            Brüt: <strong>{formatDecimal(totalGrossWeight, 2)} kg</strong>
          </div>
        </div>

        {/* Overwrite Protection Notice */}
        <div className="px-4 py-2 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>Üzerine Yazma Koruması Aktif:</strong> Palet veya koli bilgisi dolu olan {protectedShipments.length} sevkiyat güvenle kilitlendi.
            </span>
          </div>
          {protectedShipments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowProtected(!showProtected)}
              className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0 cursor-pointer"
            >
              {showProtected ? 'Korumalıları Gizle' : `Korumalıları Gör (${protectedShipments.length})`}
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-stone-700 bg-white dark:bg-stone-900">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Başlık, Booking, AWB, Sorumlu veya Tarih ile boş sevkiyat ara..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded text-xs text-slate-900 dark:text-stone-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 dark:focus:border-amber-400"
            />
          </div>
        </div>

        {/* Shipment List Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50 dark:bg-stone-950/40">
          {eligibleShipments.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded">
              <ShieldAlert className="w-9 h-9 text-amber-500 mx-auto mb-2 opacity-90" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-stone-200">
                Uygun Boş Sevkiyat Bulunamadı
              </h4>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-1 max-w-md mx-auto">
                Tüm mevcut sevkiyatların palet/koli bilgileri dolu veya kayıtlı sevkiyat bulunmuyor. Üzerine yazma riskine karşı dolu sevkiyatlara ekleme yapılamaz. Bunun yerine <strong>"Yeni Sevkiyat Olarak Kaydet"</strong> seçeneğini kullanabilirsiniz.
              </p>
            </div>
          ) : filteredEligible.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-stone-400">
              Aramaya uygun boş sevkiyat bulunamadı.
            </div>
          ) : (
            filteredEligible.map((s) => {
              const isSelected = selectedShipmentId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedShipmentId(s.id)}
                  className={`p-3 rounded border transition cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-amber-950/30 border-blue-500 dark:border-amber-500 ring-1 ring-blue-500 dark:ring-amber-500'
                      : 'bg-white dark:bg-stone-900 border-slate-300 dark:border-stone-800 hover:border-slate-400 dark:hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-blue-600 dark:border-amber-400 bg-blue-600 dark:bg-amber-400'
                            : 'border-slate-400 dark:border-stone-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-stone-900" />}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-stone-100 truncate">
                          {s.title || 'İsimsiz Sevkiyat'}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                          Palet Bilgisi Boş (Eklenebilir)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-stone-400 mt-1 flex-wrap">
                        {s.shipmentDate && (
                          <span>Tarih: <strong className="text-slate-700 dark:text-stone-300 font-mono">{s.shipmentDate}</strong></span>
                        )}
                        {s.bookingNo && (
                          <span>Booking: <strong className="text-slate-700 dark:text-stone-300 font-mono">{s.bookingNo}</strong></span>
                        )}
                        {s.awbNo && (
                          <span>AWB: <strong className="text-slate-700 dark:text-stone-300 font-mono">{s.awbNo}</strong></span>
                        )}
                        {s.responsiblePerson && (
                          <span>Sorumlu: <strong className="text-slate-700 dark:text-stone-300">{s.responsiblePerson}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isSelected ? (
                      <span className="text-xs font-semibold text-blue-600 dark:text-amber-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Seçildi</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-stone-500 hover:text-slate-700">Seç</span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Protected / Locked Shipments Display (View-Only to demonstrate safety) */}
          {showProtected && protectedShipments.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-stone-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Korumalı Dolu Sevkiyatlar (Seçilemez - Üzerine Yazma Korumalı):</span>
              </div>
              {filteredProtected.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded border border-slate-200 dark:border-stone-800 bg-slate-100/60 dark:bg-stone-900/40 opacity-60 flex items-center justify-between gap-3 cursor-not-allowed select-none"
                  title="Bu sevkiyatta palet ve koli verileri kayıtlı olduğundan üzerine yazma engellenmiştir."
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700 dark:text-stone-300 truncate">
                          {s.title || 'İsimsiz Sevkiyat'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 font-mono">
                          Palet Dolu ({s.pallets?.length || 0} Palet)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {s.shipmentDate || 'Tarihsiz'} • Booking: {s.bookingNo || '-'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold shrink-0">
                    Kilitli
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-stone-400">
            <Info className="w-4 h-4 text-blue-600 dark:text-amber-400 shrink-0" />
            <span className="text-[11px]">
              {selectedShipment
                ? `"${selectedShipment.title}" seçildi.`
                : 'Eklemek istediğiniz boş sevkiyatı listeden seçin.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-700 dark:text-stone-300 hover:text-slate-900 dark:hover:text-stone-100 cursor-pointer"
            >
              İptal
            </button>
            <button
              type="button"
              disabled={!selectedShipment}
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-amber-600 dark:hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded cursor-pointer transition shadow-xs"
            >
              <span>Sevkiyata Ekle ve Aç</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
