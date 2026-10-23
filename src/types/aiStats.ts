export interface AiConversionRecord {
  id: string;
  timestamp: string; // ISO date string
  durationMs: number;
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  modelUsed: string;
  blocksCount: number;
  rowsCount: number;
  costUsd: number;
  costTry: number;
  exchangeRate: number;
  summaryTitle?: string;
}

export interface AiStatsSummary {
  totalConversions: number;
  totalDurationMs: number;
  averageDurationMs: number;
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostTry: number;
  exchangeRate: number;
}
