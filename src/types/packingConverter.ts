export interface PackingListRow {
  id: string;
  palletNo: string;
  palletDimensions: string;
  palletTare: number;
  boxDimensions: string;
  itemCode: string;
  itemDescription: string;
  boxPieceCount: number;
  boxCount: number;
  boxWeight: number;
  // Computed fields
  totalPieces: number;
  netWeight: number;
  grossWeight: number;
}

export interface ShipmentBlock {
  id: string;
  title: string;
  targetTable: string;
  rawText: string;
  rows: PackingListRow[];
  reportedTotalGrossWeight?: number;
  reportedTotalPieces?: number;
  notes?: string[];
}

export interface CatalogItem {
  id: string;
  code: string;
  description: string;
  keywords?: string[];
  defaultBoxPieces?: number;
  defaultBoxWeight?: number;
  defaultBoxDimensions?: string;
}

export interface PalletValidation {
  palletNo: string;
  boxCountSum: number;
  netWeightSum: number;
  palletTare: number;
  calculatedGrossWeight: number;
  reportedGrossWeight?: number;
  diffGrossWeight?: number;
  isGrossWeightMatch: boolean;
}

export interface ValidationSummary {
  palletValidations: PalletValidation[];
  totalReportedPieces?: number;
  totalCalculatedPieces: number;
  isPiecesMatch: boolean;
  totalReportedGross?: number;
  totalCalculatedGross: number;
  isGrossMatch: boolean;
  warnings: string[];
}
