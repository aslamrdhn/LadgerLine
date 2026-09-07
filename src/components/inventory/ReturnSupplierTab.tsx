import React, { useState } from 'react';
import { RawMaterial } from '../../types';
import { Undo2, Save } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';

export function ReturnSupplierTab({ materials }: { materials: RawMaterial[] }) {
  const { triggerToast } = useUiStore();
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReturn = async () => {
    if (!selectedMaterial || !qty || parseFloat(qty) <= 0) return;
    setSubmitting(true);
    try {
      // Simulate API Call for returning to supplier
      await new Promise(r => setTimeout(r, 1000));
      triggerToast('Proses retur ke supplier berhasil dicatat (Simulasi)');
      setQty('');
      setReason('');
      setSelectedMaterial('');
    } catch (e) {
      triggerToast('Gagal memproses retur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-lg font-black text-slate-800">Retur ke Supplier</h2>
          <p className="text-xs text-slate-500">Catat pengembalian bahan baku yang rusak atau kadaluarsa ke supplier</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Bahan Baku</label>
            <select 
              className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
            >
              <option value="">-- Pilih Bahan Baku --</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} (Stok: {m.stockQuantity} {m.stockUnit})</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Retur</label>
            <input 
              type="number" 
              className="w-full h-10 px-3 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Alasan Retur</label>
            <textarea 
              className="w-full h-24 p-3 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Barang rusak saat pengiriman, kadaluarsa, dll"
            />
          </div>

          <button 
            onClick={handleReturn}
            disabled={submitting || !selectedMaterial || !qty}
            className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            <Undo2 size={18} /> {submitting ? 'Memproses...' : 'Proses Retur ke Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}
