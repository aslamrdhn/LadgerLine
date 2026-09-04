import React, { useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { Layers, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function AddMaterialModal({ isOpen, onClose, onRefresh }: Props) {
  const { triggerToast } = useUiStore();
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [stock, setStock] = useState(1000);
  const [unit, setUnit] = useState('g');
  const [warningLimit, setWarningLimit] = useState(200);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const savedStore = localStorage.getItem("aslam_ledger_current_store");
      const tenantId = savedStore ? JSON.parse(savedStore).id : "aslam-brew";
      
      const res = await fetch("/api/raw-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
        body: JSON.stringify({ name, stockQuantity: stock, stockUnit: unit, warningLimit })
      });
      if (res.ok) {
        triggerToast(`Selesai: Bahan ${name} berhasil ditambahkan!`);
        onRefresh();
        onClose();
      } else {
        triggerToast("Gagal menambahkan bahan baku.");
      }
    } catch (err) {
      triggerToast("Gagal menghubungi server.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Layers size={18}/> Tambah Bahan Baku</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nama Bahan Baku</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-xl bg-slate-50 text-sm" placeholder="Contoh: Susu Segar" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Stok Awal</label>
              <input type="number" required value={stock} onChange={e => setStock(Number(e.target.value))} className="w-full p-2 border rounded-xl bg-slate-50 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Satuan</label>
              <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-2 border rounded-xl bg-slate-50 text-sm">
                <option value="g">Gram (g)</option>
                <option value="ml">Mililiter (ml)</option>
                <option value="pcs">Pieces (pcs)</option>
                <option value="Kg">Kilogram (Kg)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Batas Peringatan Stok</label>
            <input type="number" required value={warningLimit} onChange={e => setWarningLimit(Number(e.target.value))} className="w-full p-2 border rounded-xl bg-slate-50 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-700">Batal</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-emerald-600 rounded-xl text-sm font-bold text-white">{isSaving ? 'Menyimpan...' : 'Simpan Bahan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
