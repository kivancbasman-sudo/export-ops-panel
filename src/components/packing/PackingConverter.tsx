import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { ShipmentBlock, PackingListRow } from '../../types/packingConverter';
import { calculateRowDerived, cleanItemDescriptionAndBoxCount } from '../../utils/packingParser';
import { InputPanel } from './InputPanel';
import { PackingTable } from './PackingTable';
import { ValidationPanel } from './ValidationPanel';
import { AddToShipmentModal, isShipmentPalletsEmpty } from './AddToShipmentModal';
import { runFullDiagnostics } from '../../utils/packingValidator';
import { Sparkles, ShieldCheck, HelpCircle, FileSpreadsheet, PlusCircle, FolderPlus, Check, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { PalletData, ProductRow, Shipment } from '../../types';

// Lazy load modals for code-splitting
const HelpModal = lazy(() =>
  import('./HelpModal').then((m) => ({ default: m.HelpModal }))
);
const DiagnosticModal = lazy(() =>
  import('./DiagnosticModal').then((m) => ({ default: m.DiagnosticModal }))
);

const SESSION_STORAGE_KEY = 'ihracat_packing_converter_session';

interface PackingConverterSessionData {
  rawText: string;
  blocks: ShipmentBlock[];
  activeBlockIndex: number;
  aiNotice: string | null;
}

interface PackingConverterProps {
  onNavigateToShipment?: (shipmentId: string) => void;
}

export function PackingConverter({ onNavigateToShipment }: PackingConverterProps) {
  const { shipments, addShipment, updateShipment } = useAppStore();

  // Load initial state from sessionStorage so tab switching or reloads do not wipe data
  const [rawText, setRawText] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed: PackingConverterSessionData = JSON.parse(stored);
          return typeof parsed.rawText === 'string' ? parsed.rawText : '';
        }
      } catch (e) {
        console.warn('Session storage read error:', e);
      }
    }
    return '';
  });

  const [blocks, setBlocks] = useState<ShipmentBlock[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed: PackingConverterSessionData = JSON.parse(stored);
          return Array.isArray(parsed.blocks) ? parsed.blocks : [];
        }
      } catch (e) {
        console.warn('Session storage read error:', e);
      }
    }
    return [];
  });

  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed: PackingConverterSessionData = JSON.parse(stored);
          return typeof parsed.activeBlockIndex === 'number' ? parsed.activeBlockIndex : 0;
        }
      } catch (e) {
        console.warn('Session storage read error:', e);
      }
    }
    return 0;
  });

  const [aiNotice, setAiNotice] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed: PackingConverterSessionData = JSON.parse(stored);
          return typeof parsed.aiNotice === 'string' ? parsed.aiNotice : null;
        }
      } catch (e) {
        console.warn('Session storage read error:', e);
      }
    }
    return null;
  });

  // Modals and loading state
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isAddToShipmentOpen, setIsAddToShipmentOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);

  // Synchronize state with sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!rawText.trim() && blocks.length === 0) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        const payload: PackingConverterSessionData = {
          rawText,
          blocks,
          activeBlockIndex,
          aiNotice,
        };
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
      }
    } catch (e) {
      console.warn('Session storage write error:', e);
    }
  }, [rawText, blocks, activeBlockIndex, aiNotice]);

  // Clear all data (explicit user reset)
  const handleClearAll = useCallback(() => {
    setRawText('');
    setBlocks([]);
    setActiveBlockIndex(0);
    setAiNotice(null);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Handle AI Parse (sole conversion engine)
  const handleParseAI = async () => {
    if (!rawText.trim()) {
      setAiNotice('Lütfen analiz edilecek sevkiyat metnini yapıştırın.');
      return;
    }
    setIsAiLoading(true);
    setAiNotice(null);
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'AI ayrıştırma başarısız oldu.');
      }

      const resData = await response.json();
      const aiBlocks = resData.data?.blocks;

      if (aiBlocks && Array.isArray(aiBlocks) && aiBlocks.length > 0) {
        const mappedBlocks: ShipmentBlock[] = aiBlocks.map((b: any, bIdx: number) => ({
          id: `ai-block-${bIdx + 1}`,
          title: b.title || `Blok ${bIdx + 1}`,
          targetTable: b.targetTable || `TABLO ${bIdx + 1}`,
          rawText,
          notes: [],
          rows: (b.rows || []).map((r: any, rIdx: number) => {
            const rawDesc = r.itemDescription || '';
            const rawCount = Number(r.boxCount) || 1;
            const { itemDescription: cleanDesc, boxCount: cleanCount } = cleanItemDescriptionAndBoxCount(
              rawDesc,
              rawCount
            );
            const bPiece = Number(r.boxPieceCount) || 500;
            const bCount = cleanCount;
            const bWeight = Number(r.boxWeight) || 10;
            const pTare = typeof r.palletTare === 'number' ? r.palletTare : 7.5;
            const { totalPieces, netWeight, grossWeight } = calculateRowDerived(
              bPiece,
              bCount,
              bWeight,
              pTare
            );
            return {
              id: `ai-row-${bIdx}-${rIdx}`,
              palletNo: String(r.palletNo || '1'),
              palletDimensions: r.palletDimensions || '80x120x114',
              palletTare: pTare,
              boxDimensions: r.boxDimensions || '280x380x330',
              itemCode: r.itemCode || '',
              itemDescription: cleanDesc,
              boxPieceCount: bPiece,
              boxCount: bCount,
              boxWeight: bWeight,
              totalPieces,
              netWeight,
              grossWeight,
            };
          }),
        }));

        setBlocks(mappedBlocks);
        setActiveBlockIndex(0);
        setAiNotice(`✓ Gemini AI (${resData.modelUsed || 'Flash'}) ile analiz tamamlandı. Girdi metnindeki veriler 9 sütunlu çeki listesine dönüştürüldü.`);
      } else {
        setAiNotice('Yapay zeka metin içerisinde geçerli palet veya koli verisi tespit edemedi. Lütfen girdi verilerini kontrol ediniz.');
      }
    } catch (err: any) {
      console.error('AI Parse failed:', err);
      setAiNotice(`Dönüştürme başarısız oldu: ${err.message || 'Yapay zeka yanıt veremedi'}. Lütfen tekrar deneyiniz.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const currentBlock = blocks[activeBlockIndex] || null;

  // Run full diagnostics on current active block (catalog disabled)
  const diagnosticReport = useMemo(
    () => (currentBlock ? runFullDiagnostics(currentBlock) : null),
    [currentBlock]
  );

  // Update rows of current block
  const setCurrentRows: React.Dispatch<React.SetStateAction<PackingListRow[]>> = useCallback(
    (newRows) => {
      setBlocks((prev) =>
        prev.map((b, idx) => {
          if (idx !== activeBlockIndex) return b;
          return {
            ...b,
            rows: typeof newRows === 'function' ? newRows(b.rows) : newRows,
          };
        })
      );
    },
    [activeBlockIndex]
  );

  // Helper to auto-fix tare across all rows in current block
  const handleAutoFixTare = useCallback(() => {
    if (!currentBlock) return;
    setCurrentRows((prev) =>
      prev.map((row) => ({
        ...row,
        palletTare: 7.5,
        grossWeight: Number((row.netWeight + 7.5).toFixed(2)),
      }))
    );
  }, [currentBlock, setCurrentRows]);

  // Prepare structured pallet data from current block rows
  const preparedPalletInfo = useMemo(() => {
    if (!currentBlock || currentBlock.rows.length === 0) {
      return { pallets: [], totalGross: 0, totalNet: 0, totalPieces: 0, totalBoxes: 0, uniquePallets: 0 };
    }
    const palletMap: { [palletNo: string]: { dimensions: string; tare: number; products: ProductRow[] } } = {};

    let totalNet = 0;
    let totalBoxes = 0;
    let totalPieces = 0;

    currentBlock.rows.forEach((r, idx) => {
      const pKey = r.palletNo || '1';
      if (!palletMap[pKey]) {
        palletMap[pKey] = {
          dimensions: r.palletDimensions || '80x120x114',
          tare: r.palletTare || 7.5,
          products: [],
        };
      }
      const bCount = r.boxCount || 0;
      const bWeight = r.boxWeight || 0;
      const bPiece = r.boxPieceCount || 0;

      totalBoxes += bCount;
      totalNet += bCount * bWeight;
      totalPieces += bCount * bPiece;

      palletMap[pKey].products.push({
        id: `prod_${Date.now()}_${idx}`,
        boxDimensions: r.boxDimensions || '280x380x330',
        materialCode: r.itemCode || '',
        materialDescription: r.itemDescription || '',
        itemsPerBox: bPiece || 500,
        boxCount: bCount || 1,
        boxWeight: bWeight || 10,
      });
    });

    const pallets: PalletData[] = Object.entries(palletMap).map(([pNo, pData], idx) => ({
      id: `pallet_${Date.now()}_${idx}`,
      palletDimensions: pData.dimensions,
      palletWeight: pData.tare,
      products: pData.products,
    }));

    const uniquePallets = Object.keys(palletMap).length;
    const totalTare = Object.values(palletMap).reduce((acc, p) => acc + (p.tare || 0), 0);
    const totalGross = totalNet + totalTare;

    return {
      pallets,
      totalGross: Math.round(totalGross * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      totalPieces,
      totalBoxes,
      uniquePallets,
    };
  }, [currentBlock]);

  // Export parsed packing list rows into a new Sevkiyat
  const handleCreateShipmentFromPacking = () => {
    if (!currentBlock || preparedPalletInfo.pallets.length === 0) return;

    const newShipment = addShipment({
      title: `${currentBlock.title} - ${currentBlock.targetTable}`,
      shipmentDate: new Date().toISOString().split('T')[0],
      bookingNo: '',
      awbNo: '',
      poNo: [],
      customInvoiceNo: [],
      i7xNo: '',
      d7xNo: '',
      diNo: '',
      eArsivNo: '',
      eIrsaliyeNo: '',
      invoiceTotalAmount: 0,
      chargeableWeight: preparedPalletInfo.totalGross,
      checklistProgress: {},
      notes: `Çeki Listesi Dönüştürücü aracılığıyla oluşturuldu (${currentBlock.rows.length} satır, ${preparedPalletInfo.uniquePallets} palet).`,
      pallets: preparedPalletInfo.pallets,
    });

    setTransferNotice(`✓ Yeni sevkiyat oluşturuldu: "${newShipment.title}"`);
    setTimeout(() => {
      setTransferNotice(null);
      if (onNavigateToShipment && newShipment.id) {
        onNavigateToShipment(newShipment.id);
      }
    }, 1500);
  };

  // Add parsed packing list rows into an existing empty Sevkiyat
  const handleConfirmAddToExisting = (targetShipment: Shipment) => {
    if (!currentBlock || preparedPalletInfo.pallets.length === 0) return;

    // Strict safety protection: ensure target shipment has no existing pallet/box data
    if (!isShipmentPalletsEmpty(targetShipment)) {
      setAiNotice('HATA: Bu sevkiyatta önceden kayıtlı palet/koli bilgisi bulunduğu için üzerine yazma engellendi.');
      setIsAddToShipmentOpen(false);
      return;
    }

    const newWeight = targetShipment.chargeableWeight && targetShipment.chargeableWeight > 0
      ? targetShipment.chargeableWeight
      : preparedPalletInfo.totalGross;

    const additionNote = `[Çeki Listesi]: ${preparedPalletInfo.uniquePallets} palet, ${preparedPalletInfo.totalBoxes} kap eklendi.`;
    const updatedNotes = targetShipment.notes
      ? `${targetShipment.notes}\n${additionNote}`
      : additionNote;

    updateShipment(targetShipment.id, {
      pallets: preparedPalletInfo.pallets,
      chargeableWeight: newWeight,
      notes: updatedNotes,
    });

    setIsAddToShipmentOpen(false);
    setTransferNotice(`✓ "${targetShipment.title}" sevkiyatına ${preparedPalletInfo.uniquePallets} palet başarıyla eklendi.`);
    setTimeout(() => {
      setTransferNotice(null);
      if (onNavigateToShipment && targetShipment.id) {
        onNavigateToShipment(targetShipment.id);
      }
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-100 dark:bg-stone-900 border border-slate-400 dark:border-stone-800 shadow-sm rounded-none transition-colors overflow-hidden">
      {/* Top Banner & Action Controls */}
      <div className="bg-slate-200 dark:bg-stone-800/90 border-b border-slate-400 dark:border-stone-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-blue-100 dark:bg-amber-950/70 text-blue-700 dark:text-amber-400 border border-blue-300 dark:border-amber-800">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-stone-100">
              Kargo &amp; Çeki Listesi Dönüştürücü
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {(blocks.length > 0 || rawText.trim()) && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white dark:bg-stone-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-700 dark:text-stone-300 dark:hover:text-rose-300 border border-slate-300 dark:border-stone-700 hover:border-rose-300 dark:border-rose-800 text-xs font-semibold transition cursor-pointer shadow-xs"
              title="Girdi metnini ve dönüştürülmüş çeki listesini tamamen sıfırla"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">Sıfırla</span>
            </button>
          )}

          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition border cursor-pointer ${
              diagnosticReport && diagnosticReport.criticalCount > 0
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                : diagnosticReport && diagnosticReport.totalIssues > 0
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                : 'bg-white dark:bg-stone-900 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-800 shadow-xs'
            }`}
            title="Denetim & Hata Raporunu Aç"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Denetim</span>
            <span className="font-mono text-[11px]">
              {diagnosticReport
                ? diagnosticReport.criticalCount > 0
                  ? `${diagnosticReport.criticalCount} Hata`
                  : diagnosticReport.totalIssues > 0
                  ? `${diagnosticReport.totalIssues} Uyarı`
                  : '0 Hata'
                : '0 Hata'}
            </span>
          </button>

          <button
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-white dark:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-600 dark:text-stone-300 border border-slate-300 dark:border-stone-700 text-xs font-semibold transition cursor-pointer shadow-xs"
            title="Sistem Talimatı & Format Kılavuzu"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Kılavuz</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-5 space-y-4">
        {/* Transfer Notice Banner */}
        {transferNotice && (
          <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-xs">
            <span>{transferNotice}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">Sevkiyatlar listesine yönlendiriliyor...</span>
          </div>
        )}

        {/* AI Notice Banner */}
        {aiNotice && (
          <div className="p-3 rounded-md bg-blue-50 dark:bg-amber-950/40 border border-blue-200 dark:border-amber-800/60 text-xs text-blue-900 dark:text-amber-200 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-amber-400 shrink-0" />
              <span>{aiNotice}</span>
            </div>
            <button
              onClick={() => setAiNotice(null)}
              className="text-blue-700 hover:text-blue-900 dark:text-amber-400 dark:hover:text-amber-200 font-bold text-xs ml-4 cursor-pointer"
            >
              Kapat
            </button>
          </div>
        )}

        {/* 1. Input Panel */}
        <InputPanel
          rawText={rawText}
          setRawText={setRawText}
          onParse={handleParseAI}
          isAiLoading={isAiLoading}
          onClearAll={handleClearAll}
          hasBlocks={blocks.length > 0}
        />

        {/* 2. Block Selector Tabs if multiple blocks detected */}
        {blocks.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 p-2 rounded shadow-xs">
            <span className="text-xs font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wide shrink-0">
              Bloklar:
            </span>
            {blocks.map((b, idx) => (
              <button
                key={b.id}
                onClick={() => setActiveBlockIndex(idx)}
                className={`px-3 py-1 rounded text-xs font-semibold transition border whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  activeBlockIndex === idx
                    ? 'bg-blue-600 dark:bg-amber-600 text-white border-blue-600 dark:border-amber-600 shadow-xs'
                    : 'bg-white dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-750'
                }`}
              >
                <span>{b.title}</span>
                <span className="opacity-75">→ {b.targetTable}</span>
                <span className="font-mono text-[11px] opacity-75">
                  ({b.rows.length})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 3. Output Table */}
        <PackingTable
          rows={currentBlock ? currentBlock.rows : []}
          setRows={setCurrentRows}
          blockTitle={currentBlock ? `${currentBlock.title}_${currentBlock.targetTable}` : 'Tablo'}
          onOpenDiagnostic={() => setIsDiagnosticOpen(true)}
          criticalIssuesCount={diagnosticReport ? diagnosticReport.criticalCount : 0}
        />

        {/* Save as New Shipment or Add to Existing Shipment */}
        {currentBlock && currentBlock.rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-stone-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Dönüştürülen çeki listesi doğrudan sevkiyat yönetimine aktarılabilir:</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddToShipmentOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-slate-800 dark:text-stone-200 border border-slate-300 dark:border-stone-700 text-xs font-semibold transition cursor-pointer shadow-xs"
                title="Palet ve koli bilgisi boş olan mevcut bir sevkiyata ekle"
              >
                <FolderPlus className="w-4 h-4 text-blue-600 dark:text-amber-400" />
                <span>Mevcut Sevkiyata Ekle</span>
              </button>

              <button
                type="button"
                onClick={handleCreateShipmentFromPacking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                title="Tüm çeki verileriyle yeni bir sevkiyat kartı oluşturur"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Yeni Sevkiyat Olarak Kaydet</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Mathematical Validation Panel */}
        <ValidationPanel currentBlock={currentBlock} />
      </div>

      {/* Lazy-loaded Modals */}
      <Suspense fallback={null}>
        {isHelpOpen && (
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        )}
        {isDiagnosticOpen && (
          <DiagnosticModal
            isOpen={isDiagnosticOpen}
            onClose={() => setIsDiagnosticOpen(false)}
            report={diagnosticReport}
            blockTitle={currentBlock ? currentBlock.title : 'Aktif Sevkiyat'}
            onAutoFixTare={handleAutoFixTare}
          />
        )}
        {isAddToShipmentOpen && (
          <AddToShipmentModal
            isOpen={isAddToShipmentOpen}
            onClose={() => setIsAddToShipmentOpen(false)}
            shipments={shipments}
            palletsToTransfer={preparedPalletInfo.pallets}
            totalGrossWeight={preparedPalletInfo.totalGross}
            totalPieces={preparedPalletInfo.totalPieces}
            totalBoxes={preparedPalletInfo.totalBoxes}
            onConfirmAdd={handleConfirmAddToExisting}
          />
        )}
      </Suspense>
    </div>
  );
}
