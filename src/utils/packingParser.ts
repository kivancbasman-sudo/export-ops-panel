import { PackingListRow, ShipmentBlock, ValidationSummary, PalletValidation } from '../types/packingConverter';

// Format numbers for Turkish display (e.g. 11.45 -> "11,45", 7.5 -> "7,5")
export function formatDecimal(val: number | string | undefined | null, decimals = 2, trimZeros = false): string {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return String(val);
  let formatted = num.toFixed(decimals).replace('.', ',');
  if (trimZeros) {
    formatted = formatted.replace(/,?0+$/, '');
  }
  return formatted;
}

export function parseNumber(val: string | number | undefined | null): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val)
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

// Calculate derived numeric quantities for a packing row
export function calculateRowDerived(
  boxPieceCount: number,
  boxCount: number,
  boxWeight: number,
  palletTare = 7.5
) {
  const safePiece = Math.max(0, Number(boxPieceCount) || 0);
  const safeCount = Math.max(0, Number(boxCount) || 0);
  const safeWeight = Math.max(0, Number(boxWeight) || 0);
  const safeTare = Math.max(0, Number(palletTare) || 7.5);

  const totalPieces = safePiece * safeCount;
  const netWeight = Number((safeCount * safeWeight).toFixed(2));
  const grossWeight = Number((netWeight + safeTare).toFixed(2));

  return { totalPieces, netWeight, grossWeight };
}

// Clean dimension strings (e.g. "80x120x150 cm" -> "80x120x150")
export function cleanDimensions(dim: string): string {
  if (!dim) return '';
  return dim
    .replace(/cm/gi, '')
    .replace(/mm/gi, '')
    .trim();
}

/**
 * Separates package/box count (kap/koli sayısı) from the material description
 * when written together in raw input (e.g. "8 Kap Lat D Bay G" -> boxCount: 8, itemDescription: "Lat D Bay G").
 * Prevents the package count or unit words from appearing at the beginning of the product name.
 */
export function cleanItemDescriptionAndBoxCount(
  rawDescription: string,
  currentBoxCount?: number
): { itemDescription: string; boxCount: number } {
  let boxCount =
    typeof currentBoxCount === 'number' && !isNaN(currentBoxCount) && currentBoxCount > 0
      ? currentBoxCount
      : 1;

  if (!rawDescription) {
    return { itemDescription: '', boxCount };
  }

  let desc = String(rawDescription).trim();

  // Pattern 1: Leading quantity with package unit keyword (Kap, Koli, Kutu, Paket, Pk, Kolı, Adet Kap, etc.)
  // e.g. "8 Kap Lat D Bay G", "8 Kap. Lat D Bay G", "8 Koli Tişört", "8 Adet Kap X", "8x Kap Y"
  const packageKeywordLeading = /^\s*(\d+)\s*(?:x\s*)?(?:[-–—/:]\s*)?(?:adet\s+)?(?:kap|koli|kolı|kutu|paket|pk)\b[.\s\-_/:]*(.+)$/i;
  const matchKeyword = desc.match(packageKeywordLeading);
  if (matchKeyword) {
    const parsed = parseInt(matchKeyword[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      boxCount = parsed;
      desc = matchKeyword[2].trim();
    }
  }

  // Pattern 2: Trailing quantity with package unit keyword
  // e.g. "Lat D Bay G 8 Kap" -> count 8, "Lat D Bay G"
  const packageKeywordTrailing = /^(.*?)\s*[-–—/:]?\s*(\d+)\s*(?:adet\s+)?(?:kap|koli|kolı|kutu|paket|pk)\s*$/i;
  const matchTrailing = desc.match(packageKeywordTrailing);
  if (matchTrailing && matchTrailing[1].trim()) {
    const parsed = parseInt(matchTrailing[2], 10);
    if (!isNaN(parsed) && parsed > 0) {
      boxCount = parsed;
      desc = matchTrailing[1].trim();
    }
  }

  // Pattern 3: If boxCount is known and description starts with that number
  // e.g. boxCount is 8, and description is "8 Lat D Bay G", "8 - Lat D Bay G", "8. Lat D Bay G"
  if (boxCount > 0) {
    const boxCountPrefixRegex = new RegExp(`^\\s*${boxCount}\\s*(?:x\\s*|adet\\s+)?(?:kap|koli|kolı|kutu|paket|pk)?\\b[.\\s\\-_/:]*(.+)`, 'i');
    const matchPrefix = desc.match(boxCountPrefixRegex);
    if (matchPrefix && matchPrefix[1].trim()) {
      desc = matchPrefix[1].trim();
    }
  }

  // Pattern 4: If boxCount was default (1) and description starts with a number followed by space or separator and letters
  // e.g. "8 Lat D Bay G", "8 - Lat D Bay G"
  if (boxCount <= 1) {
    const generalCountPrefix = /^\s*(\d{1,4})\s*(?:[-–—/:]|\s+)\s*([A-Za-zÇĞİÖŞÜçğıöşü].+)$/;
    const matchGeneral = desc.match(generalCountPrefix);
    if (matchGeneral) {
      const parsed = parseInt(matchGeneral[1], 10);
      const remainder = matchGeneral[2].trim();
      if (!isNaN(parsed) && parsed > 0 && parsed <= 500 && remainder.length >= 2) {
        if (!/^(?:cm|mm|kg|gr|m|gr\/m2)\b/i.test(remainder)) {
          boxCount = parsed;
          desc = remainder;
        }
      }
    }
  }

  // Remove leftover leading/trailing punctuation
  desc = desc.replace(/^[\s\-_/:]+/, '').replace(/[\s\-_/:]+$/, '').trim();

  return { itemDescription: desc, boxCount };
}

// Perform mathematical verification (Checking totals and pallet weights)
export function validateBlockData(block: ShipmentBlock): ValidationSummary {
  const palletGroups: { [palletNo: string]: PackingListRow[] } = {};
  for (const row of block.rows) {
    if (!palletGroups[row.palletNo]) {
      palletGroups[row.palletNo] = [];
    }
    palletGroups[row.palletNo].push(row);
  }

  const palletValidations: PalletValidation[] = [];
  let totalCalculatedPieces = 0;
  let totalCalculatedGross = 0;
  const warnings: string[] = [];

  for (const [palletNo, rows] of Object.entries(palletGroups)) {
    const boxCountSum = rows.reduce((acc, r) => acc + r.boxCount, 0);
    const netWeightSum = rows.reduce((acc, r) => acc + r.boxCount * r.boxWeight, 0);
    const palletTare = rows[0]?.palletTare || 7.5;
    const calculatedGrossWeight = Number((netWeightSum + palletTare).toFixed(2));
    totalCalculatedGross += calculatedGrossWeight;

    const piecesSum = rows.reduce((acc, r) => acc + r.boxPieceCount * r.boxCount, 0);
    totalCalculatedPieces += piecesSum;

    palletValidations.push({
      palletNo,
      boxCountSum,
      netWeightSum: Number(netWeightSum.toFixed(2)),
      palletTare,
      calculatedGrossWeight,
      reportedGrossWeight: undefined,
      isGrossWeightMatch: true,
    });
  }

  const reportedGross = block.reportedTotalGrossWeight;
  const reportedPieces = block.reportedTotalPieces;

  let isGrossMatch = true;
  if (reportedGross && Math.abs(reportedGross - totalCalculatedGross) > 0.5) {
    isGrossMatch = false;
    warnings.push(
      `Toplam Brüt Ağırlık Uyuşmazlığı: Raporlanan ${formatDecimal(reportedGross)} kg, Hesaplanan ${formatDecimal(totalCalculatedGross)} kg`
    );
  }

  let isPiecesMatch = true;
  if (reportedPieces && reportedPieces !== totalCalculatedPieces) {
    isPiecesMatch = false;
    warnings.push(
      `Toplam Adet Uyuşmazlığı: Raporlanan ${reportedPieces} Adet, Hesaplanan ${totalCalculatedPieces} Adet`
    );
  }

  return {
    palletValidations,
    totalReportedPieces: reportedPieces,
    totalCalculatedPieces,
    isPiecesMatch,
    totalReportedGross: reportedGross,
    totalCalculatedGross: Number(totalCalculatedGross.toFixed(2)),
    isGrossMatch,
    warnings,
  };
}
