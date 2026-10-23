import { AiConversionRecord, AiStatsSummary } from '../types/aiStats';

const STORAGE_KEY = 'ihracat_ai_conversion_history_v1';
const RATE_KEY = 'ihracat_ai_usd_try_rate_v1';
export const DEFAULT_USD_TRY_RATE = 38.20;

/**
 * Calculates USD cost for given token counts and model
 */
export function calculateCostUsd(
  promptTokens: number,
  candidatesTokens: number,
  modelUsed: string
): number {
  const model = (modelUsed || '').toLowerCase();
  
  let inputRatePerMillion = 0.15; // default Flash ($0.15 per 1M)
  let outputRatePerMillion = 0.60; // default Flash ($0.60 per 1M)

  if (model.includes('lite')) {
    // gemini-3.1-flash-lite: $0.075 / 1M prompt, $0.30 / 1M output
    inputRatePerMillion = 0.075;
    outputRatePerMillion = 0.30;
  } else if (model.includes('pro')) {
    // gemini-3.1-pro: $1.25 / 1M prompt, $5.00 / 1M output
    inputRatePerMillion = 1.25;
    outputRatePerMillion = 5.00;
  } else {
    // gemini-3.8-flash or gemini-flash-latest
    inputRatePerMillion = 0.15;
    outputRatePerMillion = 0.60;
  }

  const promptCost = (promptTokens / 1_000_000) * inputRatePerMillion;
  const candidatesCost = (candidatesTokens / 1_000_000) * outputRatePerMillion;

  return promptCost + candidatesCost;
}

/**
 * Gets currently saved USD/TRY exchange rate or default
 */
export function getSavedUsdTryRate(): number {
  try {
    const saved = localStorage.getItem(RATE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_USD_TRY_RATE;
}

/**
 * Saves preferred USD/TRY exchange rate
 */
export function setSavedUsdTryRate(rate: number): void {
  try {
    if (rate > 0) {
      localStorage.setItem(RATE_KEY, rate.toString());
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Reads all conversion records from localStorage
 */
export function getAiConversionRecords(): AiConversionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse AI conversion records from localStorage:', err);
  }
  return [];
}

/**
 * Saves a new conversion record to localStorage
 */
export function recordAiConversion(params: {
  durationMs: number;
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  modelUsed: string;
  blocksCount: number;
  rowsCount: number;
  summaryTitle?: string;
}): AiConversionRecord {
  const exchangeRate = getSavedUsdTryRate();
  const costUsd = calculateCostUsd(params.promptTokens, params.candidatesTokens, params.modelUsed);
  const costTry = costUsd * exchangeRate;

  const newRecord: AiConversionRecord = {
    id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    durationMs: params.durationMs,
    promptTokens: params.promptTokens,
    candidatesTokens: params.candidatesTokens,
    totalTokens: params.totalTokens,
    modelUsed: params.modelUsed,
    blocksCount: params.blocksCount,
    rowsCount: params.rowsCount,
    costUsd,
    costTry,
    exchangeRate,
    summaryTitle: params.summaryTitle,
  };

  try {
    const existing = getAiConversionRecords();
    // Keep up to 200 recent records
    const updated = [newRecord, ...existing].slice(0, 200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save AI conversion record:', err);
  }

  return newRecord;
}

/**
 * Calculates aggregated summary metrics from records
 */
export function computeAiStatsSummary(records: AiConversionRecord[]): AiStatsSummary {
  const currentRate = getSavedUsdTryRate();
  const totalConversions = records.length;

  if (totalConversions === 0) {
    return {
      totalConversions: 0,
      totalDurationMs: 0,
      averageDurationMs: 0,
      totalPromptTokens: 0,
      totalCandidatesTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalCostTry: 0,
      exchangeRate: currentRate,
    };
  }

  let totalDurationMs = 0;
  let totalPromptTokens = 0;
  let totalCandidatesTokens = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let totalCostTry = 0;

  for (const r of records) {
    totalDurationMs += r.durationMs || 0;
    totalPromptTokens += r.promptTokens || 0;
    totalCandidatesTokens += r.candidatesTokens || 0;
    totalTokens += r.totalTokens || 0;
    totalCostUsd += r.costUsd || 0;
    totalCostTry += r.costTry || 0;
  }

  return {
    totalConversions,
    totalDurationMs,
    averageDurationMs: Math.round(totalDurationMs / totalConversions),
    totalPromptTokens,
    totalCandidatesTokens,
    totalTokens,
    totalCostUsd,
    totalCostTry,
    exchangeRate: currentRate,
  };
}

/**
 * Clears all stored conversion records
 */
export function clearAiConversionRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear AI conversion records:', err);
  }
}

/**
 * Exports history records to CSV format
 */
export function exportAiStatsCsv(records: AiConversionRecord[]): void {
  if (records.length === 0) return;

  const headers = [
    'Tarih & Saat',
    'Model',
    'Süre (sn)',
    'Girdi Token',
    'Çıktı Token',
    'Toplam Token',
    'Maliyet (USD $)',
    'Maliyet (TL ₺)',
    'USD/TL Kuru',
    'Blok Sayısı',
    'Satır Sayısı',
  ];

  const rows = records.map((r) => [
    new Date(r.timestamp).toLocaleString('tr-TR'),
    `"${r.modelUsed || ''}"`,
    (r.durationMs / 1000).toFixed(2),
    r.promptTokens,
    r.candidatesTokens,
    r.totalTokens,
    r.costUsd.toFixed(6),
    r.costTry.toFixed(4),
    r.exchangeRate.toFixed(2),
    r.blocksCount,
    r.rowsCount,
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AI_Donusum_Istatistikleri_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
