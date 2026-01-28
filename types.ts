
export interface YearlyArrear {
  year: number;
  value: number | null; // null means empty, 0 means PAID
}

export interface TaxRecord {
  id: string; // ID Unik untuk setiap entri
  nama: string;
  nop: string;
  arrears: Record<number, number | null>;
  total: number;
  notes: string[];
  updatedAt: string;
}

export interface ValidationSummary {
  totalFiles: number;
  totalRecords: number; 
  duplicateNops: Record<string, TaxRecord[]>; // NOP yang muncul lebih dari sekali
  emptyFilesCount: number;
  anomalies: string[];
}

export type ProcessStatus = 'pending' | 'processing' | 'success' | 'empty' | 'error';

export interface ProcessLog {
  id: string; 
  fileName: string;
  status: ProcessStatus;
  message?: string;
  timestamp: string;
}

export interface AppState {
  records: TaxRecord[];
  logs: ProcessLog[];
  yearConfig: { start: number; end: number };
}
