
import React from 'react';
import { ValidationSummary } from '../types';

interface ValidationReportProps {
  summary: ValidationSummary;
  onMergeClick: () => void;
}

const ValidationReport: React.FC<ValidationReportProps> = ({ summary, onMergeClick }) => {
  const duplicateCount = Object.keys(summary.duplicateNops).length;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Record</h3>
        <p className="text-4xl font-black text-slate-800">{summary.totalRecords}</p>
        <p className="text-xs text-slate-400 mt-1">Baris Data Terdeteksi</p>
      </div>

      <button 
        onClick={onMergeClick}
        className={`p-6 rounded-2xl shadow-sm border text-left transition-all hover:scale-[1.02] active:scale-95 group relative ${duplicateCount > 0 ? 'bg-blue-600 border-blue-700' : 'bg-white border-slate-200'}`}
      >
        <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${duplicateCount > 0 ? 'text-blue-100' : 'text-slate-400'}`}>Status Penggabungan</h3>
        <p className={`text-4xl font-black ${duplicateCount > 0 ? 'text-white' : 'text-slate-800'}`}>{duplicateCount}</p>
        <p className={`text-xs mt-1 font-medium ${duplicateCount > 0 ? 'text-blue-100' : 'text-slate-400'}`}>
          {duplicateCount > 0 ? 'Klik untuk Lihat Detail' : 'Tidak ada NOP ganda'}
        </p>
        {duplicateCount > 0 && (
          <div className="absolute top-4 right-4 text-blue-300 opacity-20 group-hover:opacity-100 transition-opacity">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
          </div>
        )}
      </button>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Anomali Hitung</h3>
        <p className={`text-4xl font-black ${summary.anomalies.length > 0 ? 'text-amber-600' : 'text-slate-200'}`}>{summary.anomalies.length}</p>
        <p className="text-xs text-slate-400 mt-1">Selisih Hitung Mandiri</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Audit File</h3>
        <p className="text-4xl font-black text-slate-800">{summary.totalFiles}</p>
        <p className="text-xs text-slate-400 mt-1">Berkas Terproses</p>
      </div>
    </div>
  );
};

export default ValidationReport;
