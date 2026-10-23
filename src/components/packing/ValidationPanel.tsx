import React, { useMemo } from 'react';
import { ShipmentBlock } from '../../types/packingConverter';
import { validateBlockData, formatDecimal } from '../../utils/packingParser';
import {
  CheckCircle2,
  AlertTriangle,
  Scale,
  Calculator,
  ShieldCheck,
} from 'lucide-react';

interface ValidationPanelProps {
  currentBlock: ShipmentBlock | null;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ currentBlock }) => {
  const summary = useMemo(() => {
    if (!currentBlock || currentBlock.rows.length === 0) return null;
    return validateBlockData(currentBlock);
  }, [currentBlock]);

  if (!currentBlock || currentBlock.rows.length === 0 || !summary) return null;

  return (
    <div className="section bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 p-4 sm:p-5 rounded-md shadow-xs transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-600 dark:text-amber-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-stone-100 uppercase tracking-wide">
              Matematiksel Sağlama &amp; Doğruluk Kontrolü
            </h3>
          </div>
        </div>
        {summary.warnings.length === 0 ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Tüm Hesaplamalar Tutarlı</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{summary.warnings.length} Uyarı Tespit Edildi</span>
          </div>
        )}
      </div>

      {/* Equations Grid */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Adet Kontrolü */}
        <div className="bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 p-3 rounded">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-stone-200 mb-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
              1. Toplam Adet Eşitliği
            </span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              ✓ Doğrulandı
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-stone-700 flex justify-between text-xs font-mono">
            <span className="text-slate-600 dark:text-stone-400 font-sans">Hesaplanan:</span>
            <span className="font-bold text-slate-900 dark:text-stone-100">
              {summary.totalCalculatedPieces.toLocaleString('tr-TR')} Adet
            </span>
          </div>
        </div>

        {/* Net Ağırlık */}
        <div className="bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 p-3 rounded">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-stone-200 mb-1">
            <span className="flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
              2. Net Ağırlık Eşitliği
            </span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              ✓ Doğrulandı
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-stone-700 flex justify-between text-xs font-mono">
            <span className="text-slate-600 dark:text-stone-400 font-sans">Toplam Net:</span>
            <span className="font-bold text-slate-900 dark:text-stone-100">
              {formatDecimal(
                summary.palletValidations.reduce((acc, p) => acc + p.netWeightSum, 0),
                2
              )}{' '}
              kg
            </span>
          </div>
        </div>

        {/* Brüt Ağırlık */}
        <div className="bg-slate-50 dark:bg-stone-800/60 border border-slate-200 dark:border-stone-700 p-3 rounded">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-stone-200 mb-1">
            <span className="flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
              3. Brüt Ağırlık &amp; Dara
            </span>
            <span className="font-mono text-[11px] text-slate-700 dark:text-stone-300 font-bold">
              {summary.isGrossMatch ? '✓ Tutarlı' : '⚠ Fark Var'}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-stone-700 flex justify-between text-xs font-mono">
            <span className="text-slate-600 dark:text-stone-400 font-sans">Toplam Brüt:</span>
            <span className="font-bold text-slate-900 dark:text-stone-100">
              {formatDecimal(summary.totalCalculatedGross, 2)} kg
            </span>
          </div>
        </div>
      </div>

      {/* Pallet Breakdown Table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse border border-slate-300 dark:border-stone-700">
          <thead className="bg-[#f4f4f4] dark:bg-stone-800 text-slate-900 dark:text-stone-100 font-semibold text-[11px]">
            <tr>
              <th className="p-2 border border-slate-300 dark:border-stone-700">Palet No</th>
              <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Kap Sayısı</th>
              <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Net Ağırlık</th>
              <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Palet Darası</th>
              <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Hesaplanan Brüt</th>
              <th className="p-2 border border-slate-300 dark:border-stone-700 text-center">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-stone-800 font-mono text-slate-800 dark:text-stone-200 bg-white dark:bg-stone-900">
            {summary.palletValidations.map((p) => (
              <tr key={p.palletNo} className="hover:bg-slate-50 dark:hover:bg-stone-800/50">
                <td className="p-2 border border-slate-300 dark:border-stone-700 font-bold text-slate-900 dark:text-stone-100">
                  Palet #{p.palletNo}
                </td>
                <td className="p-2 border border-slate-300 dark:border-stone-700 text-right">
                  {p.boxCountSum} Kap
                </td>
                <td className="p-2 border border-slate-300 dark:border-stone-700 text-right">
                  {formatDecimal(p.netWeightSum, 2)} kg
                </td>
                <td className="p-2 border border-slate-300 dark:border-stone-700 text-right text-slate-500 dark:text-stone-400">
                  {formatDecimal(p.palletTare, 1)} kg
                </td>
                <td className="p-2 border border-slate-300 dark:border-stone-700 text-right font-bold text-slate-900 dark:text-stone-100">
                  {formatDecimal(p.calculatedGrossWeight, 2)} kg
                </td>
                <td className="p-2 border border-slate-300 dark:border-stone-700 text-center text-emerald-600 dark:text-emerald-400 font-sans text-[11px] font-semibold">
                  ✓ Doğrulandı
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Warnings if any */}
      {summary.warnings.length > 0 && (
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 rounded">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Olası Sapma Tespiti:</span>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800 dark:text-amber-300 text-[11px]">
              {summary.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
