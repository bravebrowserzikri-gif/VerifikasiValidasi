
import React from 'react';
import { TaxRecord } from '../types';
import { COLORS } from '../constants';

interface TaxTableProps {
  records: TaxRecord[];
  years: number[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (record: TaxRecord) => void;
}

const TaxTable: React.FC<TaxTableProps> = ({ records, years, selectedIds, onToggleSelect, onToggleSelectAll, onEdit }) => {
  const getCellColor = (record: TaxRecord, year: number) => {
    const value = record.arrears[year];
    const yearsWithData = Object.keys(record.arrears)
      .map(Number)
      .filter(y => record.arrears[y] !== null)
      .sort((a, b) => a - b);
    const firstYear = yearsWithData.length > 0 ? yearsWithData[0] : 9999;
    if (year < firstYear) return COLORS.EMPTY_BEFORE;
    if (value === 0) return COLORS.PAID;
    return COLORS.DEFAULT;
  };

  const formatCurrency = (val: number | null) => {
    if (val === null) return '-';
    return val.toLocaleString('id-ID');
  };

  const isAllSelected = records.length > 0 && selectedIds.size === records.length;

  return (
    <div className="overflow-x-auto border rounded-xl shadow-sm bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-center sticky left-0 bg-slate-50 z-20 w-[50px]">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                checked={isAllSelected}
                onChange={onToggleSelectAll}
              />
            </th>
            <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase text-[10px] sticky left-[50px] bg-slate-50 z-20 w-[50px]">No.</th>
            <th className="px-4 py-3 text-center font-bold text-slate-400 uppercase text-[10px] sticky left-[100px] bg-slate-50 z-20 w-[60px]">Aksi</th>
            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase text-[10px] sticky left-[160px] bg-slate-50 z-20 min-w-[200px]">Nama</th>
            <th className="px-4 py-3 text-left font-bold text-slate-400 uppercase text-[10px] sticky left-[360px] bg-slate-50 z-20 min-w-[150px]">NOP</th>
            {years.map(year => (
              <th key={year} className="px-4 py-3 text-center font-bold text-slate-400 uppercase text-[10px] border-l min-w-[100px]">{year}</th>
            ))}
            <th className="px-4 py-3 text-right font-bold text-slate-400 uppercase text-[10px] border-l bg-slate-100 min-w-[150px]">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {records.map((record, idx) => (
            <tr key={record.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(record.id) ? 'bg-emerald-50/50' : ''}`}>
              <td className="px-4 py-3 text-center sticky left-0 bg-inherit z-10">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  checked={selectedIds.has(record.id)}
                  onChange={() => onToggleSelect(record.id)}
                />
              </td>
              <td className="px-4 py-3 text-center sticky left-[50px] bg-inherit z-10 font-mono text-[10px] text-slate-300">
                {idx + 1}
              </td>
              <td className="px-4 py-3 text-center sticky left-[100px] bg-inherit z-10">
                <button onClick={() => onEdit(record)} className="text-slate-300 hover:text-emerald-600 p-1 rounded hover:bg-emerald-50 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </td>
              <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-800 sticky left-[160px] bg-inherit z-10">
                {record.nama}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs sticky left-[360px] bg-inherit z-10">
                {record.nop}
              </td>
              {years.map(year => (
                <td key={year} className={`px-4 py-3 text-center border-l transition-colors ${getCellColor(record, year)}`}>
                  {formatCurrency(record.arrears[year])}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-black text-emerald-700 bg-slate-50 border-l group-hover:bg-slate-100 transition-all">
                {formatCurrency(record.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TaxTable;
