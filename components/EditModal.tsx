
import React, { useState, useEffect } from 'react';
import { TaxRecord } from '../types';

interface EditModalProps {
  isOpen: boolean;
  record: TaxRecord | null;
  years: number[];
  onClose: () => void;
  onSave: (updatedRecord: TaxRecord) => void;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, record, years, onClose, onSave }) => {
  const [formData, setFormData] = useState<TaxRecord | null>(null);

  useEffect(() => {
    if (record) {
      setFormData(JSON.parse(JSON.stringify(record))); // Deep copy
    }
  }, [record]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: keyof TaxRecord, value: string) => {
    setFormData(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleArrearChange = (year: number, value: string) => {
    setFormData(prev => {
      if (!prev) return null;
      const numValue = value === '' ? null : parseFloat(value.replace(/\./g, '').replace(/,/g, '.'));
      
      const newArrears = { ...prev.arrears, [year]: numValue };
      
      // Recalculate total immediately for preview
      const newTotal = Object.values(newArrears).reduce((sum: number, val: number | null) => {
        return sum + (val !== null && val > 0 ? val : 0);
      }, 0);

      return {
        ...prev,
        arrears: newArrears,
        total: newTotal
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                    Edit Data Pajak
                  </h3>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Nama Wajib Pajak</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                        value={formData.nama}
                        onChange={(e) => handleChange('nama', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">NOP</label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                        value={formData.nop}
                        onChange={(e) => handleChange('nop', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-slate-900 mb-2">Rincian Piutang (Kosongkan jika tidak ada data, isi 0 jika lunas)</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-60 overflow-y-auto p-1">
                      {years.map(year => (
                        <div key={year}>
                          <label className="block text-xs font-medium text-slate-500 mb-1">{year}</label>
                          <input
                            type="number"
                            className="block w-full border border-slate-300 rounded-md shadow-sm py-1 px-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                            value={formData.arrears[year] === null ? '' : formData.arrears[year]?.toString()}
                            placeholder="-"
                            onChange={(e) => handleArrearChange(year, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <span className="text-sm font-medium text-slate-500 mr-2">Total Terhitung:</span>
                    <span className="text-lg font-bold text-emerald-700">
                      {formData.total.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Simpan Perubahan
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
