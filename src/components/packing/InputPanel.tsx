import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Trash2,
  ClipboardPaste,
  Loader2,
  RotateCcw,
} from 'lucide-react';

interface InputPanelProps {
  rawText: string;
  setRawText: (text: string) => void;
  onParse: () => void;
  isAiLoading: boolean;
  onClearAll?: () => void;
  hasBlocks?: boolean;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  rawText,
  setRawText,
  onParse,
  isAiLoading,
  onClearAll,
  hasBlocks = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasteHint, setPasteHint] = useState<string | null>(null);

  // Paste from clipboard helper (graceful handling for iframe security policies)
  const handlePasteClipboard = async () => {
    textareaRef.current?.focus();
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setRawText(text);
          return;
        }
      } catch {
        // Handled silently for iframes
      }
    }
    setPasteHint('Lütfen metni yapıştırmak için kutunun içine tıklayıp Ctrl+V (veya Cmd+V) tuşuna basınız.');
    setTimeout(() => setPasteHint(null), 4000);
  };

  // Handle Excel or CSV file upload
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setRawText(text);
      };
      reader.readAsText(file);
    } else {
      // Excel file (.xlsx, .xls)
      reader.onload = async (e) => {
        try {
          const XLSX = await import('xlsx');
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvText = XLSX.utils.sheet_to_csv(firstSheet);
          setRawText(csvText);
        } catch (err) {
          console.error('Dosya okuma hatası:', err);
          setPasteHint('Excel dosyası okunamadı. Lütfen geçerli bir .xlsx veya .csv dosyası yükleyin.');
          setTimeout(() => setPasteHint(null), 4000);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="section bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 p-4 sm:p-5 rounded-md shadow-xs transition-colors">
      {/* Top Header Label & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-2 border-b border-slate-200 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-slate-900 dark:text-stone-100 uppercase tracking-wide">
            Girdi
          </label>
          {rawText.trim() && (
            <span className="text-[11px] font-mono text-slate-500 dark:text-stone-400 bg-slate-100 dark:bg-stone-800 px-2 py-0.5 rounded">
              {rawText.split('\n').filter((l) => l.trim()).length} satır
            </span>
          )}
        </div>

        {/* Quick paste & Reset buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePasteClipboard}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-stone-300 bg-slate-100 dark:bg-stone-800 hover:bg-slate-200 dark:hover:bg-stone-700 border border-slate-300 dark:border-stone-700 rounded flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title="Panodaki metni girdi alanına yapıştır"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-slate-600 dark:text-stone-400" />
            <span>Panodan Yapıştır</span>
          </button>

          {/* Reset All Option when table or data exists */}
          {hasBlocks && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-800 dark:text-rose-200 bg-rose-100/80 dark:bg-rose-950/80 hover:bg-rose-200 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800 rounded flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Girdi metnini ve dönüştürülmüş çeki listesi tablosunu sıfırla"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span className="hidden sm:inline">Tümünü Sıfırla</span>
              <span className="sm:hidden">Sıfırla</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Textarea & Dropzone */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Textarea */}
        <div className="lg:col-span-9 flex flex-col">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Sevkiyat verisini buraya yapıştırın..."
              className="w-full h-48 sm:h-56 p-3 pr-24 bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 text-slate-900 dark:text-stone-100 text-xs sm:text-sm font-mono placeholder-slate-400 dark:placeholder-stone-600 focus:outline-none focus:border-blue-600 dark:focus:border-amber-400 rounded resize-none"
            />

            {/* Quick Floating Clear Badge directly on the Textarea */}
            {rawText && (
              <button
                type="button"
                onClick={() => {
                  setRawText('');
                  textareaRef.current?.focus();
                }}
                className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white/95 dark:bg-stone-900/95 hover:bg-rose-50 dark:hover:bg-rose-950/70 border border-rose-300 dark:border-rose-800 rounded shadow-xs flex items-center gap-1.5 transition cursor-pointer hover:shadow-sm"
                title="Girdi kutusunu hemen temizle"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Temizle</span>
              </button>
            )}

            {pasteHint && (
              <div className="absolute bottom-2 left-2 right-2 p-2 bg-slate-800 dark:bg-stone-800 text-white text-xs rounded-md flex items-center justify-between shadow-lg animate-fade-in border border-slate-600 dark:border-stone-700">
                <span>{pasteHint}</span>
                <button
                  type="button"
                  onClick={() => setPasteHint(null)}
                  className="text-slate-300 hover:text-white font-bold ml-2 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* File Dropzone & Actions */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-2.5">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed p-3 rounded flex flex-col items-center justify-center text-center cursor-pointer transition flex-1 ${
              dragOver
                ? 'border-blue-500 dark:border-amber-400 bg-blue-50/60 dark:bg-amber-950/30'
                : 'border-slate-300 dark:border-stone-700 hover:border-blue-400 dark:hover:border-amber-600 bg-slate-50/80 hover:bg-slate-100/90 dark:bg-stone-850 dark:hover:bg-stone-800'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-amber-400 mb-1" />
            <p className="text-xs font-semibold text-slate-700 dark:text-stone-200">
              Excel / CSV Yükle
            </p>
            <p className="text-[10px] text-slate-500 dark:text-stone-400 mt-0.5">
              veya sürükleyip bırakın
            </p>
          </div>

          {/* Action Buttons Column */}
          <div>
            {/* AI Conversion Button */}
            <button
              type="button"
              onClick={onParse}
              disabled={!rawText.trim() || isAiLoading}
              className={`w-full py-2.5 px-3 sm:px-4 rounded text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow-xs ${
                isAiLoading
                  ? 'bg-blue-600 dark:bg-amber-600 text-white cursor-wait opacity-90'
                  : !rawText.trim()
                  ? 'bg-slate-100 dark:bg-stone-800/80 text-slate-400 dark:text-stone-500 cursor-not-allowed border border-slate-200 dark:border-stone-700'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white cursor-pointer shadow-sm'
              }`}
              title="Gemini AI ile 9 Sütunlu Çeki Listesine Dönüştür"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin shrink-0" />
                  <span className="font-medium">AI Dönüştürüyor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 dark:text-amber-200 shrink-0" />
                  <span>Dönüştür (Gemini AI)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
