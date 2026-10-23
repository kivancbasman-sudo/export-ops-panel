import { PackingListRow } from '../types/packingConverter';
import { formatDecimal } from './packingParser';

export type ExportMode = 'standard9' | 'detailed12';

export const STANDARD_9_COLUMNS = [
  'Palet No',
  'Palet Ölçüleri',
  'Palet Ağırlığı',
  'Koli Ölçüleri',
  'Malzeme Kodu',
  'Malzeme Açıklaması',
  'Koli İçi Adet',
  'Koli Sayısı',
  'Koli Ağırlığı',
];

export const DETAILED_12_COLUMNS = [
  'Palet No',
  'Palet Ölçüleri',
  'Koli Ölçüleri',
  'Malzeme Kodu',
  'Malzeme Açıklaması',
  'Toplam Adet',
  'Koli İçi Adet',
  'Kap Adedi',
  'Koli Ağırlığı (kg)',
  'Palet Dara (kg)',
  'Net Ağırlık (kg)',
  'Brüt Ağırlık (kg)',
];

// Helper to safely get numeric values for weights & quantities
function toNumeric(val: any, fallback = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? fallback : num;
}

// Excel-specific row mapper with TRUE NUMERIC TYPES for weights & counts
export function rowToStandard9ExcelRow(r: PackingListRow): (string | number)[] {
  const pNo = !isNaN(Number(r.palletNo)) ? Number(r.palletNo) : (r.palletNo || '1');
  const pTare = toNumeric(r.palletTare, 7.5);
  const bPiece = toNumeric(r.boxPieceCount, 500);
  const bCount = toNumeric(r.boxCount, 1);
  const bWeight = toNumeric(r.boxWeight, 0);

  return [
    pNo,
    r.palletDimensions || '',
    Number(pTare.toFixed(2)),
    r.boxDimensions || '',
    r.itemCode || '',
    r.itemDescription || '',
    Math.round(bPiece),
    Math.round(bCount),
    Number(bWeight.toFixed(2)),
  ];
}

export function rowToDetailed12ExcelRow(r: PackingListRow): (string | number)[] {
  const pNo = !isNaN(Number(r.palletNo)) ? Number(r.palletNo) : (r.palletNo || '1');
  const pTare = toNumeric(r.palletTare, 7.5);
  const bPiece = toNumeric(r.boxPieceCount, 500);
  const bCount = toNumeric(r.boxCount, 1);
  const bWeight = toNumeric(r.boxWeight, 0);

  const totalPieces = bPiece * bCount;
  const netWeight = bCount * bWeight;
  const grossWeight = netWeight + pTare;

  return [
    pNo,
    r.palletDimensions || '',
    r.boxDimensions || '',
    r.itemCode || '',
    r.itemDescription || '',
    Math.round(totalPieces),
    Math.round(bPiece),
    Math.round(bCount),
    Number(bWeight.toFixed(2)),
    Number(pTare.toFixed(2)),
    Number(netWeight.toFixed(2)),
    Number(grossWeight.toFixed(2)),
  ];
}

// Clipboard & display mappers (with localized comma format)
export function rowToStandard9Array(r: PackingListRow): (string | number)[] {
  return [
    r.palletNo,
    r.palletDimensions,
    formatDecimal(r.palletTare, 1),
    r.boxDimensions,
    r.itemCode,
    r.itemDescription,
    r.boxPieceCount,
    r.boxCount,
    formatDecimal(r.boxWeight, 2),
  ];
}

export function rowToDetailed12Array(r: PackingListRow): (string | number)[] {
  return [
    r.palletNo,
    r.palletDimensions,
    r.boxDimensions,
    r.itemCode,
    r.itemDescription,
    r.boxPieceCount * r.boxCount,
    r.boxPieceCount,
    r.boxCount,
    formatDecimal(r.boxWeight, 2),
    formatDecimal(r.palletTare, 1),
    formatDecimal(r.boxCount * r.boxWeight, 2),
    formatDecimal(r.boxCount * r.boxWeight + r.palletTare, 2),
  ];
}

// Generate TSV (Tab-Separated Values) ready to paste into Google Sheets
export function generateGoogleSheetsClipboardText(rows: PackingListRow[], mode: ExportMode = 'standard9'): string {
  const headers = mode === 'standard9' ? STANDARD_9_COLUMNS : DETAILED_12_COLUMNS;
  const lines: string[] = [];

  lines.push(headers.join('\t'));

  for (const row of rows) {
    const values = mode === 'standard9' ? rowToStandard9Array(row) : rowToDetailed12Array(row);
    lines.push(values.join('\t'));
  }

  return lines.join('\n');
}

// Generate CSV string with UTF-8 BOM and delimiter
export function generateCsvText(rows: PackingListRow[], mode: ExportMode = 'standard9', delimiter = ';'): string {
  const headers = mode === 'standard9' ? STANDARD_9_COLUMNS : DETAILED_12_COLUMNS;
  const lines: string[] = [];

  const escapeField = (val: string | number) => {
    const s = String(val);
    if (s.includes(delimiter) || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  lines.push(headers.map(escapeField).join(delimiter));

  for (const row of rows) {
    const values = mode === 'standard9' ? rowToStandard9Array(row) : rowToDetailed12Array(row);
    lines.push(values.map(escapeField).join(delimiter));
  }

  return '\uFEFF' + lines.join('\r\n');
}

// Export genuine .xlsx file using SheetJS (xlsx)
export async function exportToExcel(rows: PackingListRow[], fileName = 'Ceki_Listesi.xlsx', mode: ExportMode = 'standard9'): Promise<void> {
  const XLSX = await import('xlsx');
  const headers = mode === 'standard9' ? STANDARD_9_COLUMNS : DETAILED_12_COLUMNS;
  const data: (string | number)[][] = [headers];

  for (const row of rows) {
    const values = mode === 'standard9' ? rowToStandard9ExcelRow(row) : rowToDetailed12ExcelRow(row);
    data.push(values);
  }

  // Summary row if detailed
  if (mode === 'detailed12' && rows.length > 0) {
    const totalPieces = rows.reduce((acc, r) => acc + toNumeric(r.boxPieceCount) * toNumeric(r.boxCount), 0);
    const totalBoxes = rows.reduce((acc, r) => acc + toNumeric(r.boxCount), 0);
    const totalNet = rows.reduce((acc, r) => acc + toNumeric(r.boxCount) * toNumeric(r.boxWeight), 0);

    const uniquePallets = new Set(rows.map(r => r.palletNo)).size;
    const tarePerPallet = toNumeric(rows[0]?.palletTare, 7.5);
    const totalGross = totalNet + uniquePallets * tarePerPallet;

    data.push([
      'TOPLAM',
      '',
      '',
      '',
      `${rows.length} Çeşit`,
      Math.round(totalPieces),
      '',
      Math.round(totalBoxes),
      '',
      '',
      Number(totalNet.toFixed(2)),
      Number(totalGross.toFixed(2)),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:I1');
  for (let R = 1; R <= range.e.r; ++R) {
    if (mode === 'standard9') {
      const cellC = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
      if (cellC && typeof cellC.v === 'number') {
        cellC.t = 'n';
        cellC.z = '0.00';
      }
      const cellG = ws[XLSX.utils.encode_cell({ r: R, c: 6 })];
      if (cellG && typeof cellG.v === 'number') {
        cellG.t = 'n';
        cellG.z = '#,##0';
      }
      const cellH = ws[XLSX.utils.encode_cell({ r: R, c: 7 })];
      if (cellH && typeof cellH.v === 'number') {
        cellH.t = 'n';
        cellH.z = '#,##0';
      }
      const cellI = ws[XLSX.utils.encode_cell({ r: R, c: 8 })];
      if (cellI && typeof cellI.v === 'number') {
        cellI.t = 'n';
        cellI.z = '0.00';
      }
    } else {
      const cellCounts = [5, 6, 7];
      cellCounts.forEach(c => {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c })];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '#,##0';
        }
      });
      const cellWeights = [8, 9, 10, 11];
      cellWeights.forEach(c => {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c })];
        if (cell && typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '0.00';
        }
      });
    }
  }

  const colWidths = headers.map((h) => ({ wch: Math.max(h.length + 3, 14) }));
  colWidths[mode === 'standard9' ? 5 : 4] = { wch: 42 };
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Çeki Listesi');
  XLSX.writeFile(wb, fileName);
}
