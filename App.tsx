
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TaxRecord, ValidationSummary, ProcessLog, ProcessStatus } from './types';
import { processTaxPDF } from './geminiService';
import { DEFAULT_START_YEAR, DEFAULT_END_YEAR } from './constants';
import TaxTable from './components/TaxTable';
import ValidationReport from './components/ValidationReport';
import EditModal from './components/EditModal';
import CameraModal from './components/CameraModal';
import ConfirmationModal from './components/ConfirmationModal';

const App: React.FC = () => {
  const [records, setRecords] = useState<TaxRecord[]>(() => {
    const saved = localStorage.getItem('bapenda_records');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [processLogs, setProcessLogs] = useState<ProcessLog[]>(() => {
    const saved = localStorage.getItem('bapenda_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [yearConfig, setYearConfig] = useState(() => {
    const saved = localStorage.getItem('bapenda_config');
    return saved ? JSON.parse(saved) : { start: DEFAULT_START_YEAR, end: DEFAULT_END_YEAR };
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'logs' | 'reports'>('data');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TaxRecord | null>(null);
  const [showMergeDetail, setShowMergeDetail] = useState(false);
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    type: 'reset' | 'delete' | 'delete-logs';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'reset',
    title: '',
    message: ''
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (isStandalone) return;
    if (!deferredPrompt) { alert("Gunakan menu browser untuk menginstal."); return; }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  useEffect(() => {
    localStorage.setItem('bapenda_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('bapenda_logs', JSON.stringify(processLogs));
  }, [processLogs]);

  useEffect(() => {
    localStorage.setItem('bapenda_config', JSON.stringify(yearConfig));
  }, [yearConfig]);

  const years = useMemo(() => {
    return Array.from({ length: yearConfig.end - yearConfig.start + 1 }, (_, i) => yearConfig.start + i);
  }, [yearConfig]);

  const addLog = useCallback((fileName: string, status: ProcessStatus, message: string) => {
    setProcessLogs(prev => {
      const existingIdx = prev.findIndex(l => l.fileName === fileName);
      if (existingIdx !== -1) {
        const newLogs = [...prev];
        newLogs[existingIdx] = { ...newLogs[existingIdx], status, message, timestamp: new Date().toLocaleTimeString() };
        return newLogs;
      }
      const newLog: ProcessLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileName, status, message, timestamp: new Date().toLocaleTimeString()
      };
      return [newLog, ...prev].slice(0, 500);
    });
  }, []);

  const processFile = async (base64: string, name: string, type: string) => {
    try {
      addLog(name, 'processing', 'Sedang mengekstrak data via AI...');
      const result = await processTaxPDF(base64, type, yearConfig);
      
      if (result.length === 0) {
        addLog(name, 'empty', 'Tidak ada data valid.');
      } else {
        addLog(name, 'success', `Berhasil. Mendapatkan ${result.length} baris.`);
        setRecords(prev => [
          ...prev, 
          ...result.map(r => ({ 
            ...r, 
            id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            updatedAt: new Date().toISOString()
          }))
        ]);
      }
    } catch (err: any) {
      const msg = err.message?.includes('429') ? 'Limit API terlampaui.' : 'Gagal memproses berkas.';
      addLog(name, 'error', msg);
    }
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsLoading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await new Promise<string>(res => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        await processFile(base64, file.name, file.type);
      } catch (error) { addLog(file.name, 'error', 'Gagal baca berkas.'); }
    }
    setIsLoading(false);
  };

  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return records.filter(r => r.nama.toLowerCase().includes(term) || r.nop.includes(term));
  }, [records, searchTerm]);

  // Ekspor Excel Logic - Dioptimalkan untuk Excel agar warna muncul tepat
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;

    const exportDate = new Date().toLocaleString('id-ID');
    
    // Definisi warna hex untuk Excel (Identik dengan UI)
    const COLORS_HEX = {
      HEADER_BG: '#065f46',
      HEADER_TEXT: '#ffffff',
      GREEN_BG: '#dcfce7', // bg-green-100
      GREEN_TEXT: '#166534', // text-green-800
      RED_BG: '#fee2e2', // bg-red-100
      RED_TEXT: '#991b1b', // text-red-800
      TOTAL_BG: '#f8fafc', // bg-slate-50
      TOTAL_TEXT: '#047857', // text-emerald-700
      BORDER: '#cbd5e1'
    };

    let html = `
      <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body>
          <h2 style="font-family: sans-serif; color: #1e293b; margin-bottom: 4px;">Laporan Piutang PBB-P2 Bapenda Kampar</h2>
          <p style="font-family: sans-serif; color: #64748b; font-size: 12px; margin-bottom: 16px;">Tanggal Ekspor: ${exportDate}</p>
          <table border="1" style="border-collapse: collapse; font-family: sans-serif; width: 100%;">
            <thead>
              <tr style="background-color: ${COLORS_HEX.HEADER_BG}; color: ${COLORS_HEX.HEADER_TEXT};">
                <th style="padding: 10px; border: 1px solid ${COLORS_HEX.BORDER};">No</th>
                <th style="padding: 10px; border: 1px solid ${COLORS_HEX.BORDER};">Nama Wajib Pajak</th>
                <th style="padding: 10px; border: 1px solid ${COLORS_HEX.BORDER}; text-align: left;">NOP</th>
                ${years.map(y => `<th style="padding: 10px; border: 1px solid ${COLORS_HEX.BORDER}; text-align: center; width: 80px;">${y}</th>`).join('')}
                <th style="padding: 10px; border: 1px solid ${COLORS_HEX.BORDER}; text-align: right; background-color: #064e3b;">Total Piutang</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRecords.map((r, i) => {
                const yearsWithData = Object.keys(r.arrears)
                  .map(Number)
                  .filter(y => r.arrears[y] !== null)
                  .sort((a, b) => a - b);
                const firstYear = yearsWithData.length > 0 ? yearsWithData[0] : 9999;

                return `
                  <tr>
                    <td style="padding: 8px; border: 1px solid ${COLORS_HEX.BORDER}; text-align: center;">${i + 1}</td>
                    <td style="padding: 8px; border: 1px solid ${COLORS_HEX.BORDER}; font-weight: bold;">${r.nama}</td>
                    <td style="padding: 8px; border: 1px solid ${COLORS_HEX.BORDER}; font-family: monospace;">${r.nop}</td>
                    ${years.map(y => {
                      const val = r.arrears[y];
                      let style = `padding: 8px; border: 1px solid ${COLORS_HEX.BORDER}; text-align: right;`;
                      
                      if (y < firstYear) {
                        style += ` background-color: ${COLORS_HEX.GREEN_BG}; color: ${COLORS_HEX.GREEN_TEXT};`;
                      } else if (val === 0) {
                        style += ` background-color: ${COLORS_HEX.RED_BG}; color: ${COLORS_HEX.RED_TEXT};`;
                      }
                      
                      return `<td style="${style}">${val === null ? '-' : val.toLocaleString('id-ID')}</td>`;
                    }).join('')}
                    <td style="padding: 8px; border: 1px solid ${COLORS_HEX.BORDER}; text-align: right; font-weight: bold; background-color: ${COLORS_HEX.TOTAL_BG}; color: ${COLORS_HEX.TOTAL_TEXT};">
                      ${r.total.toLocaleString('id-ID')}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Data_Piutang_Bapenda_Export_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerResetConfirm = () => {
    setConfirmState({
      isOpen: true,
      type: 'reset',
      title: 'Reset Seluruh Sistem?',
      message: 'Ini akan menghapus SEMUA database piutang, log, dan konfigurasi. Data yang sudah dihapus tidak dapat dikembalikan.'
    });
  };

  const triggerDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setConfirmState({
      isOpen: true,
      type: 'delete',
      title: 'Hapus Data Terpilih?',
      message: `Hapus ${selectedIds.size} baris data wajib pajak secara permanen?`
    });
  };

  const triggerDeleteLogs = () => {
    if (selectedLogIds.size === 0) return;
    setConfirmState({
      isOpen: true,
      type: 'delete-logs',
      title: 'Bersihkan Log?',
      message: `Hapus ${selectedLogIds.size} riwayat antrean pemrosesan?`
    });
  };

  const handleConfirmedAction = () => {
    if (confirmState.type === 'reset') {
      setRecords([]);
      setProcessLogs([]);
      setSelectedIds(new Set());
      setSelectedLogIds(new Set());
      setYearConfig({ start: DEFAULT_START_YEAR, end: DEFAULT_END_YEAR });
      localStorage.clear();
    } else if (confirmState.type === 'delete') {
      setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } else if (confirmState.type === 'delete-logs') {
      setProcessLogs(prev => prev.filter(l => !selectedLogIds.has(l.id)));
      setSelectedLogIds(new Set());
    }
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const summary: ValidationSummary = useMemo(() => {
    const nops: Record<string, TaxRecord[]> = {};
    records.forEach(r => {
      if (!nops[r.nop]) nops[r.nop] = [];
      nops[r.nop].push(r);
    });
    const duplicates: Record<string, TaxRecord[]> = {};
    Object.entries(nops).forEach(([nop, recs]) => {
      if (recs.length > 1) duplicates[nop] = recs;
    });
    return {
      totalFiles: processLogs.length,
      totalRecords: records.length,
      duplicateNops: duplicates,
      emptyFilesCount: processLogs.filter(l => l.status === 'empty').length,
      anomalies: records.filter(r => {
        const calc: number = (Object.values(r.arrears) as (number | null)[]).reduce<number>((s, v) => s + (v || 0), 0);
        return Math.abs(calc - r.total) > 1;
      }).map(r => r.nop)
    };
  }, [records, processLogs]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRecords.map(r => r.id)));
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAllLogs = () => {
    if (selectedLogIds.size === processLogs.length) setSelectedLogIds(new Set());
    else setSelectedLogIds(new Set(processLogs.map(l => l.id)));
  };

  const toggleSelectLog = (id: string) => {
    const newSelected = new Set(selectedLogIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedLogIds(newSelected);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-inter text-slate-900 relative" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}>
      {isDragging && (
        <div className="absolute inset-0 z-[200] bg-emerald-600/20 backdrop-blur-md border-4 border-emerald-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none">
           <div className="bg-white p-8 rounded-full shadow-2xl mb-4 animate-bounce">
             <svg className="w-16 h-16 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
           </div>
           <h2 className="text-3xl font-black text-emerald-900 uppercase">Lepaskan Berkas</h2>
        </div>
      )}

      <aside className="w-64 bg-emerald-900 text-emerald-50 flex flex-col shrink-0 shadow-2xl z-20">
        <div className="p-6 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-lg"><svg className="w-8 h-8 text-emerald-800" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" /></svg></div>
            <div><h1 className="font-bold text-sm tracking-tight text-white uppercase leading-none">Bapenda</h1><p className="text-[10px] text-emerald-400 font-medium tracking-widest mt-1">KAB. KAMPAR</p></div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('data')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'data' ? 'bg-emerald-800 text-white shadow-inner' : 'hover:bg-emerald-800/50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            <span className="font-medium text-sm">Database Piutang</span>
          </button>
          <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-emerald-800 text-white shadow-inner' : 'hover:bg-emerald-800/50'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="font-medium text-sm">Analisis & Validasi</span>
          </button>
          <button onClick={() => setActiveTab('logs')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'logs' ? 'bg-emerald-800 text-white shadow-inner' : 'hover:bg-emerald-800/50'}`}>
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {isLoading && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-ping"></span>}
            </div>
            <span className="font-medium text-sm">Log Proses AI</span>
          </button>
        </nav>
        <div className="p-4 space-y-2 border-t border-emerald-800">
           <button onClick={handleInstallApp} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500 text-amber-950 hover:bg-amber-400 transition-all font-bold shadow-lg">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg><span className="text-sm">Install PWA</span>
           </button>
           <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-800/50 transition-all text-emerald-300">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
             <span className="font-medium text-sm">Opsi & Tahun</span>
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-50">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Cari Nama/NOP..." className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={triggerResetConfirm} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase border border-red-100 hover:bg-red-100 transition-all">Reset Data</button>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'data' && (
              <>
                {selectedIds.size > 0 && (
                  <button onClick={triggerDeleteSelected} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-200 transition-all flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Hapus ({selectedIds.size})
                  </button>
                )}
                <button onClick={handleExportExcel} className="px-4 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-50 transition-all flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Ekspor Excel
                </button>
              </>
            )}
            <button onClick={() => setIsCameraOpen(true)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-black transition-all">Scan Kamera</button>
            <label className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold cursor-pointer shadow-md hover:bg-emerald-700 transition-all">
              Unggah PDF
              <input type="file" multiple accept=".pdf,image/*" className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files || []))} />
            </label>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Database Wajib Pajak</h2>
                  <p className="text-sm text-slate-500 italic">Menampilkan {filteredRecords.length} dari {records.length} data.</p>
                </div>
                <div className="text-right">
                   <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Piutang Terhitung</p>
                   <p className="text-3xl font-black text-emerald-700">Rp {filteredRecords.reduce((s, r) => s + r.total, 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
              {records.length > 0 ? (
                <TaxTable 
                  records={filteredRecords} 
                  years={years} 
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleSelectAll={toggleSelectAll}
                  onEdit={(r) => { setEditingRecord(r); setIsModalOpen(true); }} 
                />
              ) : (
                <div className="h-96 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center bg-white/50 text-slate-400">
                  <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                  <p className="font-medium text-lg">Belum ada data piutang. Silakan unggah berkas.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <ValidationReport summary={summary} onMergeClick={() => setShowMergeDetail(true)} />
          )}

          {activeTab === 'logs' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-800">Log Pemrosesan AI</h2>
                  {selectedLogIds.size > 0 && (
                    <button onClick={triggerDeleteLogs} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-all">Hapus Log ({selectedLogIds.size})</button>
                  )}
               </div>
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[500px] overflow-auto">
                 <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left w-12"><input type="checkbox" className="rounded" checked={selectedLogIds.size === processLogs.length && processLogs.length > 0} onChange={toggleSelectAllLogs} /></th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase">Nama File</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {processLogs.map(log => (
                        <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${selectedLogIds.has(log.id) ? 'bg-slate-50' : ''}`} onClick={() => toggleSelectLog(log.id)}>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedLogIds.has(log.id)} onChange={() => toggleSelectLog(log.id)} className="rounded text-emerald-600" /></td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : log.status === 'processing' ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>{log.status}</span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-700">
                             {log.fileName}
                             {log.message && <p className="text-[10px] text-slate-400 font-normal mt-1">{log.message}</p>}
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-slate-400">{log.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          )}
        </div>
      </main>

      {showMergeDetail && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-8">
           <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                 <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Rincian NOP Ganda</h3><p className="text-sm text-slate-500">Gunakan fitur hapus pada Database untuk membersihkan ganda.</p></div>
                 <button onClick={() => setShowMergeDetail(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-4">
                 {Object.entries(summary.duplicateNops).map(([nop, recs]) => (
                   <div key={nop} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                         <span className="font-mono font-bold text-slate-700 text-xs">{nop}</span>
                         <span className="text-[10px] font-black text-white bg-blue-600 px-3 py-1 rounded-full uppercase">{recs.length} Entri</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                         {recs.map((r) => (
                           <div key={r.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                              <div><p className="text-sm font-bold text-slate-800">{r.nama}</p><p className="text-[10px] text-slate-400">Update Terakhir: {new Date(r.updatedAt).toLocaleDateString('id-ID')}</p></div>
                              <div className="text-right"><p className="font-bold text-slate-700">Rp {r.total.toLocaleString('id-ID')}</p></div>
                           </div>
                         ))}
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase">Opsi Tahun</h3>
            <div className="space-y-4 mb-8 text-left">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Tahun Mulai</label><input type="number" className="w-full px-4 py-3 bg-slate-100 rounded-xl text-lg font-black" value={yearConfig.start} onChange={e => setYearConfig(v => ({ ...v, start: parseInt(e.target.value) }))} /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Tahun Selesai</label><input type="number" className="w-full px-4 py-3 bg-slate-100 rounded-xl text-lg font-black" value={yearConfig.end} onChange={e => setYearConfig(v => ({ ...v, end: parseInt(e.target.value) }))} /></div>
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">TERAPKAN KONFIGURASI</button>
          </div>
        </div>
      )}

      <ConfirmationModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.type === 'reset' ? 'HAPUS TOTAL' : 'HAPUS'} onConfirm={handleConfirmedAction} onCancel={() => setConfirmState(p => ({ ...p, isOpen: false }))} />
      <EditModal isOpen={isModalOpen} record={editingRecord} years={years} onClose={() => setIsModalOpen(false)} onSave={(updated) => { setRecords(prev => prev.map(r => r.id === updated.id ? updated : r)); setIsModalOpen(false); }} />
      <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={(b64) => processFile(b64, 'Scan_'+Date.now(), 'image/jpeg')} />
    </div>
  );
};

export default App;
