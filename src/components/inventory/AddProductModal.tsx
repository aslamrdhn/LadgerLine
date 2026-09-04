import React, { useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { Package, X, Upload } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function AddProductModal({ isOpen, onClose, onRefresh }: Props) {
  const { triggerToast } = useUiStore();
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Coffee');
  const [price, setPrice] = useState(20000);
  const [costPrice, setCostPrice] = useState(10000);
  const [stock, setStock] = useState(50);
  const [imageUrl, setImageUrl] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        triggerToast("Gambar terlalu besar! Maksimum ukuran file adalah 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImageUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const savedStore = localStorage.getItem("aslam_ledger_current_store");
      const tenantId = savedStore ? JSON.parse(savedStore).id : "aslam-brew";
      
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Id": tenantId },
        body: JSON.stringify({ name, category, price, costPrice, stock, imageUrl })
      });
      if (res.ok) {
        triggerToast(`Selesai: Produk ${name} berhasil ditambahkan!`);
        onRefresh();
        onClose();
      } else {
        triggerToast("Gagal menambahkan produk.");
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
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Package size={18}/> Tambah Menu</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nama Menu</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-xl bg-slate-50 text-sm" placeholder="Contoh: Kopi Susu Aren" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Harga Jual (Rp)</label>
              <input type="number" required value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full p-2 border rounded-xl bg-slate-50 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Stok Awal</label>
              <input type="number" required value={stock} onChange={e => setStock(Number(e.target.value))} className="w-full p-2 border rounded-xl bg-slate-50 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Gambar (Opsional)</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-700">Batal</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold text-white">{isSaving ? 'Menyimpan...' : 'Simpan Menu'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
