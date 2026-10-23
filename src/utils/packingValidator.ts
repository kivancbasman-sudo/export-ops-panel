import { PackingListRow, ShipmentBlock, CatalogItem } from '../types/packingConverter';
import { formatDecimal } from './packingParser';

export type ErrorSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface ValidationErrorItem {
  id: string;
  code: string;
  severity: ErrorSeverity;
  rowId?: string;
  palletNo?: string;
  column?: string;
  title: string;
  message: string;
  suggestedFix?: string;
  canAutoFix?: boolean;
  autoFixAction?: () => void;
}

export interface DetailedDiagnosticReport {
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  items: ValidationErrorItem[];
  palletAudits: {
    palletNo: string;
    reportedGross?: number;
    calculatedNet: number;
    tare: number;
    calculatedGross: number;
    diff: number;
    status: 'MATCH' | 'DISCREPANCY' | 'NO_REPORTED';
  }[];
  isReadyForExport: boolean;
}

const DIMENSION_REGEX = /^[0-9]+(?:[.,][0-9]+)?\s*[xX*]\s*[0-9]+(?:[.,][0-9]+)?\s*[xX*]\s*[0-9]+(?:[.,][0-9]+)?$/;

export function runFullDiagnostics(
  block: ShipmentBlock,
  _catalog?: CatalogItem[]
): DetailedDiagnosticReport {
  const issues: ValidationErrorItem[] = [];

  // Row-by-Row Checks
  block.rows.forEach((row, index) => {
    const rowNum = index + 1;

    // Note: Check A (Missing Material Code) is disabled per specification:
    // Kod havuzu devre dışıdır, kodlar kolileri değil tekil ürünleri temsil eder.
    // Girdi metninde kod verilmemişse boş bırakılması standart ve geçerlidir.

    // Check B: Invalid Pallet Dimensions (ERR_PALLET_DIM)
    if (!row.palletDimensions || !DIMENSION_REGEX.test(row.palletDimensions.trim())) {
      issues.push({
        id: `err-pdim-${row.id}`,
        code: 'ERR_PALLET_DIM',
        severity: 'WARNING',
        rowId: row.id,
        palletNo: row.palletNo,
        column: 'B (Palet Ölçüleri)',
        title: `Satır ${rowNum}: Palet Ölçü Formatı Uyarısı`,
        message: `"${row.palletDimensions}" değeri standart En x Boy x Yükseklik (örn: 80x120x114) formatında değil.`,
        suggestedFix: 'Ölçüyü "80x120x114" formatında standartlaştırın.',
      });
    }

    // Check C: Invalid Box Dimensions (ERR_BOX_DIM)
    if (!row.boxDimensions || !DIMENSION_REGEX.test(row.boxDimensions.trim())) {
      issues.push({
        id: `err-bdim-${row.id}`,
        code: 'ERR_BOX_DIM',
        severity: 'CRITICAL',
        rowId: row.id,
        palletNo: row.palletNo,
        column: 'D (Koli Ölçüleri)',
        title: `Satır ${rowNum}: Koli Ölçüsü Eksik veya Hatalı`,
        message: `Koli ölçüsü ("${row.boxDimensions}") geçerli 3 boyutlu formatta (örn: 280x380x330) değil.`,
        suggestedFix: 'Alt notlardaki koli ebadını teyit edin veya standart koli ölçüsünü yazın.',
      });
    }

    // Check D: Missing or Invalid Pallet Tare (ERR_TARE_MISSING)
    if (!row.palletTare || row.palletTare <= 0) {
      issues.push({
        id: `err-tare-${row.id}`,
        code: 'ERR_TARE_MISSING',
        severity: 'CRITICAL',
        rowId: row.id,
        palletNo: row.palletNo,
        column: 'C (Palet Ağırlığı / Dara)',
        title: `Satır ${rowNum}: Palet Darası Eksik`,
        message: 'Kural gereğince her satırda palet darası (varsayılan: 7,5 kg) yazılmalıdır.',
        suggestedFix: '7,5 kg değerini atayın.',
      });
    }

    // Check E: Zero or Negative Box Counts / Pieces (ERR_ZERO_COUNT)
    if (row.boxCount <= 0) {
      issues.push({
        id: `err-bcount-${row.id}`,
        code: 'ERR_ZERO_COUNT',
        severity: 'CRITICAL',
        rowId: row.id,
        palletNo: row.palletNo,
        column: 'H (Koli Sayısı)',
        title: `Satır ${rowNum}: Geçersiz Koli Sayısı`,
        message: `Koli sayısı 0 veya daha küçük (${row.boxCount}). En az 1 kap olmalıdır.`,
        suggestedFix: 'Paletteki fiili koli adedini girin.',
      });
    }

    if (row.boxPieceCount <= 0) {
      issues.push({
        id: `err-bpiece-${row.id}`,
        code: 'ERR_ZERO_PIECE',
        severity: 'CRITICAL',
        rowId: row.id,
        palletNo: row.palletNo,
        column: 'G (Koli İçi Adet)',
        title: `Satır ${rowNum}: Geçersiz Koli İçi Adet`,
        message: `Koli içi adet 0 veya negatif (${row.boxPieceCount}).`,
        suggestedFix: '1 koli içindeki ürün adedini (örn: 500, 200) belirtin.',
      });
    }

    // Check F: Box Weight Zero or Suspicious (ERR_BOX_WEIGHT)
    if (!row.boxWeight || row.boxWeight <= 0) {
      issues.push({
        id: `err-bweight-${row.id}`,
        code: 'ERR_BOX_WEIGHT',
        severity: 'CRITICAL',
        rowId: row.id,
        palletNo: row.palletNo,
        column: 'I (Koli Ağırlığı)',
        title: `Satır ${rowNum}: Koli Birim Ağırlığı Tanımsız`,
        message: 'Bir koliye ait birim ağırlık 0 veya tanımsız. Net ağırlık hesaplanamaz.',
        suggestedFix: 'Alt notlardaki koli ağırlığını (kg) girin.',
      });
    } else if (row.boxWeight > 50) {
      issues.push({
        id: `warn-bweight-${row.id}`,
        code: 'WARN_HEAVY_BOX',
        severity: 'WARNING',
        rowId: row.id,
        palletNo: row.palletNo,
        column: 'I (Koli Ağırlığı)',
        title: `Satır ${rowNum}: Şüpheli Yüksek Koli Ağırlığı`,
        message: `Koli birim ağırlığı ${formatDecimal(row.boxWeight)} kg olarak girilmiş (50 kg üzeri).`,
        suggestedFix: 'Değerin toplam palet ağırlığı değil, TEK BİR KOLİ olduğunu doğrulayın.',
      });
    }
  });

  // Pallet-Level Weight Cross-Checks
  const palletAudits: DetailedDiagnosticReport['palletAudits'] = [];
  const palletGroups: { [palletNo: string]: PackingListRow[] } = {};

  block.rows.forEach((r) => {
    if (!palletGroups[r.palletNo]) palletGroups[r.palletNo] = [];
    palletGroups[r.palletNo].push(r);
  });

  Object.entries(palletGroups).forEach(([palletNo, rows]) => {
    const netSum = rows.reduce((acc, r) => acc + (r.boxCount * r.boxWeight || 0), 0);
    const tare = rows[0]?.palletTare || 7.5;
    const calcGross = Number((netSum + tare).toFixed(2));

    let reportedGross: number | undefined;
    const escapedPalletNo = palletNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const palletRegex = new RegExp(`(?:(?:^|\\n)\\s*${escapedPalletNo}\\s+(?:[^\\n]*?\\s+)?|Palet\\s*${escapedPalletNo}[^\\n]*?|\\b${escapedPalletNo}[,:]?\\s+[^\\n]*?)(\\d+(?:[.,]\\d+)?)\\s*(?:KG|kg)`, 'i');
    const match = block.rawText.match(palletRegex);
    if (match) {
      reportedGross = parseFloat(match[1].replace(',', '.'));
    }

    const diff = reportedGross !== undefined ? Number((reportedGross - calcGross).toFixed(2)) : 0;
    const isDiscrepancy = reportedGross !== undefined && Math.abs(diff) > 0.3;

    if (isDiscrepancy) {
      issues.push({
        id: `err-pallet-weight-${palletNo}`,
        code: 'ERR_WEIGHT_MISMATCH',
        severity: 'WARNING',
        palletNo,
        column: 'Ağırlık Dengesi',
        title: `Palet #${palletNo}: Ağırlık Tutarsızlığı (${diff > 0 ? '+' : ''}${formatDecimal(diff)} kg)`,
        message: `Bildirilen Brüt: ${formatDecimal(reportedGross)} kg | Hesaplanan: ${formatDecimal(calcGross)} kg (Net ${formatDecimal(netSum)} + Dara ${formatDecimal(tare)} kg).`,
        suggestedFix: 'Koli kap sayısını veya alt nottaki birim koli ağırlıklarını kontrol edin.',
      });
    }

    palletAudits.push({
      palletNo,
      reportedGross,
      calculatedNet: Number(netSum.toFixed(2)),
      tare,
      calculatedGross: calcGross,
      diff,
      status: reportedGross === undefined ? 'NO_REPORTED' : isDiscrepancy ? 'DISCREPANCY' : 'MATCH',
    });
  });

  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
  const infoCount = issues.filter((i) => i.severity === 'INFO').length;

  return {
    totalIssues: issues.length,
    criticalCount,
    warningCount,
    infoCount,
    items: issues,
    palletAudits,
    isReadyForExport: criticalCount === 0,
  };
}

export function generateDiagnosticMarkdownReport(report: DetailedDiagnosticReport, blockTitle: string): string {
  let md = `# ÇEKİ LİSTESİ HATA VE DOĞRULAMA DENETİM RAPORU\n\n`;
  md += `**Sevkiyat:** ${blockTitle}\n`;
  md += `**Tarih:** ${new Date().toLocaleString('tr-TR')}\n`;
  md += `**Genel Durum:** ${report.isReadyForExport ? '✓ SEVKİYATA / DIŞA AKTARIMA UYGUN' : '⚠ KRİTİK HATALAR MEVCUT - DÜZELTME GEREKİYOR'}\n\n`;
  md += `### Özet İstatistikler\n`;
  md += `- **Kritik Hatalar:** ${report.criticalCount}\n`;
  md += `- **Uyarılar:** ${report.warningCount}\n`;
  md += `- **Toplam Bulgu:** ${report.totalIssues}\n\n`;
  md += `### Palet Ağırlık ve Dara Sağlama Tablosu\n`;
  md += `| Palet No | Bildirilen Brüt | Net Ağırlık | Palet Darası | Hesaplanan Brüt | Fark (kg) | Durum |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  report.palletAudits.forEach((p) => {
    const rep = p.reportedGross !== undefined ? `${formatDecimal(p.reportedGross)} kg` : 'Belirtilmedi';
    const statusStr = p.status === 'MATCH' ? '✓ Tutarlı' : p.status === 'DISCREPANCY' ? '⚠ Sapma Var' : '– Teyitsiz';
    md += `| Palet #${p.palletNo} | ${rep} | ${formatDecimal(p.calculatedNet)} kg | ${formatDecimal(p.tare)} kg | ${formatDecimal(p.calculatedGross)} kg | ${formatDecimal(p.diff)} | ${statusStr} |\n`;
  });

  md += `\n### Tespit Edilen Hatalar ve Önerileri\n`;
  if (report.items.length === 0) {
    md += `Tebrikler! Herhangi bir eksik kod, format hatası veya ağırlık tutarsızlığı bulunamadı.\n`;
  } else {
    report.items.forEach((item, idx) => {
      const badge = item.severity === 'CRITICAL' ? 'KRİTİK' : item.severity === 'WARNING' ? 'UYARI' : 'BİLGİ';
      md += `#### ${idx + 1}. [${badge}] ${item.title} (${item.code})\n`;
      md += `- **Etkilenen Alan:** ${item.column || 'Genel'}\n`;
      md += `- **Açıklama:** ${item.message}\n`;
      if (item.suggestedFix) {
        md += `- **Çözüm / Aksiyon:** ${item.suggestedFix}\n`;
      }
      md += `\n`;
    });
  }

  return md;
}
