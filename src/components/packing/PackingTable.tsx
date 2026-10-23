import React, { useMemo, useCallback } from 'react';
import { PackingListRow, CatalogItem } from '../../types/packingConverter';
import {
  exportToExcel,
  generateGoogleSheetsClipboardText,
  generateCsvText,
} from '../../utils/packingExporter';
import { formatDecimal } from '../../utils/packingParser';
import {
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';

interface NumericCellInputProps {
  value: number;
  onChange: (val: number) => void;
  decimals?: number;
  trimZeros?: boolean;
  className?: string;
  fallback?: number;
}

const NumericCellInput: React.FC<NumericCellInputProps> = ({
  value,
  onChange,
  decimals = 2,
  trimZeros = true,
  className,
  fallback = 0,
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const [text, setText] = React.useState<string>(() => formatDecimal(value, decimals, trimZeros));

  React.useEffect(() => {
    if (!isFocused) {
      setText(formatDecimal(value, decimals, trimZeros));
    }
  }, [value, decimals, trimZeros, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!/^[0-9]*[.,]?[0-9]*$/.test(raw)) return;
    setText(raw);

    const parsed = parseFloat(raw.replace(',', '.'));
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setText(formatDecimal(value, decimals, trimZeros));
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(text.replace(',', '.'));
    if (isNaN(parsed) || text.trim() === '') {
      onChange(fallback);
      setText(formatDecimal(fallback, decimals, trimZeros));
    } else {
      onChange(parsed);
      setText(formatDecimal(parsed, decimals, trimZeros));
    }
  };

  return (
    <input
      type="text"
      value={isFocused ? text : formatDecimal(value, decimals, trimZeros)}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};

interface PackingTableProps {
  rows: PackingListRow[];
  setRows: React.Dispatch<React.SetStateAction<PackingListRow[]>>;
  catalog?: CatalogItem[];
  blockTitle: string;
  onOpenDiagnostic?: () => void;
  criticalIssuesCount?: number;
}

export const PackingTable: React.FC<PackingTableProps> = ({
  rows,
  setRows,
  _catalog,
  blockTitle,
  onOpenDiagnostic,
  criticalIssuesCount = 0,
}: any) => {
  const [copied, setCopied] = React.useState(false);

  // Totals computed in a single pass and memoized
  const { totalBoxes, totalPieces, totalNetWeight, totalPallets, totalGrossWeight } = useMemo(() => {
    let boxes = 0;
    let pieces = 0;
    let net = 0;
    const palletSet = new Set<string>();

    for (const r of rows) {
      boxes += r.boxCount || 0;
      pieces += (r.boxPieceCount || 0) * (r.boxCount || 0);
      net += (r.boxCount || 0) * (r.boxWeight || 0);
      if (r.palletNo) palletSet.add(r.palletNo);
    }

    const pallets = palletSet.size;
    const tare = rows[0]?.palletTare || 7.5;
    const gross = net + pallets * tare;

    return {
      totalBoxes: boxes,
      totalPieces: pieces,
      totalNetWeight: Number(net.toFixed(2)),
      totalPallets: pallets,
      totalGrossWeight: Number(gross.toFixed(2)),
    };
  }, [rows]);

  // Handle cell edit
  const handleCellChange = useCallback((id: string, field: keyof PackingListRow, value: any) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        const bCount = typeof updated.boxCount === 'number' ? updated.boxCount : 0;
        const bPiece = typeof updated.boxPieceCount === 'number' ? updated.boxPieceCount : 0;
        const bWeight = typeof updated.boxWeight === 'number' ? updated.boxWeight : 0;
        const pTare = typeof updated.palletTare === 'number' ? updated.palletTare : 7.5;

        updated.totalPieces = bCount * bPiece;
        updated.netWeight = Number((bCount * bWeight).toFixed(2));
        updated.grossWeight = Number((updated.netWeight + pTare).toFixed(2));
        return updated;
      })
    );
  }, [setRows]);

  // Add a new row
  const handleAddRow = useCallback(() => {
    setRows((prev) => {
      const lastRow = prev[prev.length - 1];
      const newRow: PackingListRow = {
        id: `row-new-${Date.now()}`,
        palletNo: lastRow ? lastRow.palletNo : '1',
        palletDimensions: lastRow ? lastRow.palletDimensions : '80x120x114',
        palletTare: lastRow ? lastRow.palletTare : 7.5,
        boxDimensions: '280x380x330',
        itemCode: '',
        itemDescription: 'Yeni Malzeme',
        boxPieceCount: 500,
        boxCount: 1,
        boxWeight: 10.0,
        totalPieces: 500,
        netWeight: 10.0,
        grossWeight: 17.5,
      };
      return [...prev, newRow];
    });
  }, [setRows]);

  // Delete row
  const handleDeleteRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, [setRows]);

  // Copy to Google Sheets
  const handleCopyGoogleSheets = useCallback(async () => {
    const text = generateGoogleSheetsClipboardText(rows, 'standard9');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Clipboard hatası:', err);
    }
  }, [rows]);

  // Export Excel
  const handleExportExcel = useCallback(async () => {
    const cleanTitle = blockTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    await exportToExcel(rows, `Ceki_Listesi_${cleanTitle || 'Sevkiyat'}.xlsx`, 'standard9');
  }, [rows, blockTitle]);

  // Export CSV
  const handleExportCsv = useCallback(() => {
    const text = generateCsvText(rows, 'standard9', ';');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ceki_Listesi_${blockTitle || 'Sevkiyat'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [rows, blockTitle]);

  if (rows.length === 0) {
    return (
      <div className="section bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 p-8 text-center rounded-md shadow-xs">
        <FileSpreadsheet className="w-10 h-10 text-slate-400 dark:text-stone-600 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-stone-200">Çıktı (Tablo)</h3>
        <p className="text-xs text-slate-500 dark:text-stone-400 max-w-md mx-auto mt-1">
          Dönüştürülecek veri bulunmuyor.
        </p>
      </div>
    );
  }

  return (
    <div className="section bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-md shadow-xs overflow-hidden transition-colors">
      {/* Top Toolbar */}
      <div className="p-3 sm:p-4 bg-slate-50 dark:bg-stone-800/70 border-b border-slate-300 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Title */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <strong className="text-sm text-slate-900 dark:text-stone-100 uppercase tracking-wide">
            Çıktı (Tablo)
          </strong>
          <span className="text-xs text-slate-500 dark:text-stone-400 font-mono">
            [{rows.length} Satır / {totalPallets} Palet]
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onOpenDiagnostic && (
            <button
              onClick={onOpenDiagnostic}
              className={`px-2.5 py-1 rounded border text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                criticalIssuesCount > 0
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100'
                  : 'bg-white dark:bg-stone-800 text-slate-700 dark:text-stone-200 border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-750'
              }`}
              title="Hata ve Açık Denetimini Aç"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-600 dark:text-stone-400" />
              <span>{criticalIssuesCount > 0 ? `${criticalIssuesCount} Hata` : 'Doğrulandı'}</span>
            </button>
          )}

          <button
            onClick={handleAddRow}
            className="px-2.5 py-1 rounded bg-white dark:bg-stone-800 hover:bg-slate-50 dark:hover:bg-stone-750 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
            title="Yeni Satır Ekle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Satır Ekle</span>
          </button>

          {/* Copy to Google Sheets */}
          <button
            onClick={handleCopyGoogleSheets}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              copied
                ? 'bg-emerald-700 text-white border border-emerald-700'
                : 'bg-white dark:bg-stone-800 hover:bg-slate-50 dark:hover:bg-stone-750 text-slate-800 dark:text-stone-200 border border-slate-300 dark:border-stone-700'
            }`}
            title="Google Sheets'e doğrudan Ctrl+V ile yapıştırmak üzere kopyalar"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-stone-400" />
                <span>Sheets'e Kopyala</span>
              </>
            )}
          </button>

          {/* Export Excel (.xlsx) */}
          <button
            onClick={handleExportExcel}
            className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1 rounded bg-white dark:bg-stone-800 hover:bg-slate-50 dark:hover:bg-stone-750 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 text-xs font-medium transition cursor-pointer"
          >
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-slate-300 dark:border-stone-800 bg-white dark:bg-stone-900 text-slate-900 dark:text-stone-100 text-xs font-mono">
        <div className="p-2 sm:p-2.5 border-r border-slate-200 dark:border-stone-800">
          <span className="text-[10px] text-slate-500 dark:text-stone-400 uppercase block font-sans font-semibold">Palet Sayısı</span>
          <span className="font-bold text-sm text-slate-900 dark:text-stone-100">{totalPallets}</span>
        </div>
        <div className="p-2 sm:p-2.5 border-r border-slate-200 dark:border-stone-800">
          <span className="text-[10px] text-slate-500 dark:text-stone-400 uppercase block font-sans font-semibold">Toplam Kap / Koli</span>
          <span className="font-bold text-sm text-slate-900 dark:text-stone-100">{totalBoxes} Kap</span>
        </div>
        <div className="p-2 sm:p-2.5 border-r border-slate-200 dark:border-stone-800">
          <span className="text-[10px] text-slate-500 dark:text-stone-400 uppercase block font-sans font-semibold">Toplam Malzeme</span>
          <span className="font-bold text-sm text-slate-900 dark:text-stone-100">{totalPieces.toLocaleString('tr-TR')} Adet</span>
        </div>
        <div className="p-2 sm:p-2.5 border-r border-slate-200 dark:border-stone-800">
          <span className="text-[10px] text-slate-500 dark:text-stone-400 uppercase block font-sans font-semibold">Toplam Net Kg</span>
          <span className="font-bold text-sm text-slate-900 dark:text-stone-100">{formatDecimal(totalNetWeight, 2)} kg</span>
        </div>
        <div className="p-2 sm:p-2.5 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-500 dark:text-stone-400 uppercase block font-sans font-semibold">Toplam Brüt Kg</span>
          <span className="font-bold text-sm text-slate-900 dark:text-stone-100">{formatDecimal(totalGrossWeight, 2)} kg</span>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full border-collapse border border-slate-300 dark:border-stone-800 text-xs">
          <thead className="bg-[#f4f4f4] dark:bg-stone-800 text-slate-900 dark:text-stone-100 sticky top-0 z-10 font-bold border-b border-slate-300 dark:border-stone-700">
            <tr>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-center w-10 bg-[#f4f4f4] dark:bg-stone-800">#</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-center">Palet No</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-center">Palet Ölçüleri</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-center">Palet Ağırlığı</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-center">Koli Ölçüleri</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-center">Malzeme Kodu</th>
              <th className="border border-slate-300 dark:border-stone-700 px-3 py-2 text-left">Malzeme Açıklaması</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-right">Koli İçi Adet</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-right">Koli / Kap Sayısı</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-right">Koli Ağırlığı</th>
              <th className="border border-slate-300 dark:border-stone-700 px-2 py-2 text-center w-10">Sil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-stone-800 font-mono text-slate-800 dark:text-stone-200 bg-white dark:bg-stone-900">
            {rows.map((row, index) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/60 transition">
                {/* Index */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1.5 text-center text-slate-500 dark:text-stone-400 text-[11px]">
                  {index + 1}
                </td>
                {/* Pallet No */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1 text-center font-bold text-slate-900 dark:text-stone-100">
                  <input
                    type="text"
                    value={row.palletNo}
                    onChange={(e) => handleCellChange(row.id, 'palletNo', e.target.value)}
                    className="w-12 text-center bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600"
                  />
                </td>
                {/* Pallet Dimensions */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1 text-center">
                  <input
                    type="text"
                    value={row.palletDimensions}
                    onChange={(e) => handleCellChange(row.id, 'palletDimensions', e.target.value)}
                    className="w-24 text-center bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600"
                  />
                </td>
                {/* Pallet Tare */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1 text-center">
                  <NumericCellInput
                    value={row.palletTare}
                    decimals={2}
                    trimZeros={true}
                    fallback={7.5}
                    onChange={(val) => handleCellChange(row.id, 'palletTare', val)}
                    className="w-14 text-center bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600"
                  />
                </td>
                {/* Box Dimensions */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1 text-center">
                  <input
                    type="text"
                    value={row.boxDimensions}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleCellChange(row.id, 'boxDimensions', e.target.value)}
                    className="w-24 text-center bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600"
                  />
                </td>
                {/* Material Code */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1 text-center font-bold text-slate-900 dark:text-stone-100">
                  <input
                    type="text"
                    value={row.itemCode}
                    placeholder="Kod"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleCellChange(row.id, 'itemCode', e.target.value)}
                    className="w-28 text-center bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600"
                  />
                </td>
                {/* Material Description (Left-aligned font-sans) */}
                <td className="border border-slate-300 dark:border-stone-700 px-2.5 py-1 text-left font-sans">
                  <input
                    type="text"
                    value={row.itemDescription}
                    onChange={(e) => handleCellChange(row.id, 'itemDescription', e.target.value)}
                    className="w-full bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600 text-xs"
                  />
                </td>
                {/* Box Piece Count */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1 text-right">
                  <input
                    type="number"
                    value={row.boxPieceCount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleCellChange(row.id, 'boxPieceCount', parseInt(e.target.value, 10) || 0)}
                    className="w-16 text-right bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600"
                  />
                </td>
                {/* Box Count */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1 text-right font-bold text-slate-900 dark:text-stone-100">
                  <input
                    type="number"
                    value={row.boxCount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleCellChange(row.id, 'boxCount', parseInt(e.target.value, 10) || 0)}
                    className="w-14 text-right bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600"
                  />
                </td>
                {/* Box Weight */}
                <td className="border border-slate-300 dark:border-stone-700 px-2 py-1 text-right font-bold text-slate-900 dark:text-stone-100">
                  <NumericCellInput
                    value={row.boxWeight}
                    decimals={2}
                    trimZeros={true}
                    fallback={0}
                    onChange={(val) => handleCellChange(row.id, 'boxWeight', val)}
                    className="w-16 text-right bg-transparent focus:bg-slate-100 dark:focus:bg-stone-800 rounded px-1 py-0.5 border border-transparent focus:border-slate-400 dark:focus:border-stone-600"
                  />
                </td>
                {/* Delete */}
                <td className="border border-slate-300 dark:border-stone-700 px-1 py-1 text-center">
                  <button
                    onClick={() => handleDeleteRow(row.id)}
                    className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition cursor-pointer"
                    title="Satırı Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Footer Totals Row */}
          <tfoot className="bg-[#f4f4f4] dark:bg-stone-800 font-bold text-slate-900 dark:text-stone-100 border-t-2 border-slate-400 dark:border-stone-700">
            <tr>
              <td colSpan={3} className="border border-slate-300 dark:border-stone-700 px-2.5 py-2 text-center text-slate-700 dark:text-stone-300">
                TOPLAM ({totalPallets} Palet)
              </td>
              <td className="border border-slate-300 dark:border-stone-700 px-2 py-2 text-center">-</td>
              <td className="border border-slate-300 dark:border-stone-700 px-2 py-2 text-center">-</td>
              <td className="border border-slate-300 dark:border-stone-700 px-2 py-2 text-center">-</td>
              <td className="border border-slate-300 dark:border-stone-700 px-3 py-2 text-left font-sans text-slate-600 dark:text-stone-400">
                {rows.length} Çeşit Malzeme
              </td>
              <td className="border border-slate-300 dark:border-stone-700 px-2 py-2 text-right font-mono">
                {totalPieces.toLocaleString('tr-TR')}
              </td>
              <td className="border border-slate-300 dark:border-stone-700 px-2 py-2 text-right font-mono">
                {totalBoxes}
              </td>
              <td className="border border-slate-300 dark:border-stone-700 px-2 py-2 text-right font-mono">
                {formatDecimal(totalNetWeight, 2)} kg
              </td>
              <td className="border border-slate-300 dark:border-stone-700"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
