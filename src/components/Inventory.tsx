import React, { useState } from 'react';
import { Product, RawMaterial, Recipe } from '../types';
import { Package, Layers, BookOpen, Trash2, Tag, ShoppingCart, Activity } from 'lucide-react';
import { useUiStore } from '../store/uiStore';
import { InventoryProducts } from './inventory/InventoryProducts';
import { InventoryMaterials } from './inventory/InventoryMaterials';
import { InventoryRecipes } from './inventory/InventoryRecipes';
import { AddProductModal } from './inventory/AddProductModal';
import { AddMaterialModal } from './inventory/AddMaterialModal';
import { WasteModal } from './inventory/WasteModal';
import { StockOpnameTab } from './inventory/StockOpnameTab';
import { ReturnSupplierTab } from './inventory/ReturnSupplierTab';


interface InventoryProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  recipes: Recipe[];
  appConfig: any;
  onRefresh: () => void;
}

export default function Inventory({ products, rawMaterials, recipes = [], appConfig, onRefresh }: InventoryProps) {
  const { triggerToast } = useUiStore();
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'materials' | 'recipes' | 'promo' | 'simulator' | 'purchase_orders' | 'stock_opname' | 'returns'>('products');
  
  // Modals state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteMaterial, setWasteMaterial] = useState<RawMaterial | null>(null);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; type: 'product' | 'material' } | null>(null);

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const savedStore = localStorage.getItem("aslam_ledger_current_store");
      const tenantId = savedStore ? JSON.parse(savedStore).id : "aslam-brew";
      
      const endpoint = deleteConfirm.type === 'product' ? `/api/products/${deleteConfirm.id}` : `/api/raw-materials/${deleteConfirm.id}`;
      
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "X-Tenant-Id": tenantId },
      });
      
      if (response.ok) {
        triggerToast(`Selesai: ${deleteConfirm.name} berhasil dihapus.`);
        onRefresh();
      } else {
        triggerToast(`Gagal menghapus data.`);
      }
    } catch (err) {
      triggerToast("Gagal menghubungi server untuk menghapus data.");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const tabs = [
    { id: 'products', label: 'Menu Jual', icon: <Package size={16} /> },
    { id: 'materials', label: 'Bahan Baku', icon: <Layers size={16} /> },
    { id: 'recipes', label: 'Resep', icon: <BookOpen size={16} /> },
    { id: 'stock_opname', label: 'Stock Opname', icon: <Activity size={16} /> },
    { id: 'returns', label: 'Retur Supplier', icon: <Tag size={16} /> },
    { id: 'purchase_orders', label: 'P.O', icon: <ShoppingCart size={16} /> },
  ] as const;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 pb-20">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shrink-0 ${
              activeSubTab === tab.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeSubTab === 'products' && (
          <InventoryProducts 
            products={products} 
            onAdd={() => setShowAddProductModal(true)}
            onEdit={(p) => triggerToast(`Edit produk belum diimplementasikan di versi ini.`)}
            onDelete={(id) => {
              const p = products.find(x => x.id === id);
              if (p) setDeleteConfirm({ id, name: p.name, type: 'product' });
            }}
          />
        )}
        {activeSubTab === 'materials' && (
          <InventoryMaterials 
            materials={rawMaterials}
            onAdd={() => setShowAddMaterialModal(true)}
            onWaste={(m) => {
              setWasteMaterial(m);
              setShowWasteModal(true);
            }}
            onEdit={(m) => triggerToast(`Edit bahan belum diimplementasikan di versi ini.`)}
            onDelete={(id) => {
              const m = rawMaterials.find(x => x.id === id);
              if (m) setDeleteConfirm({ id, name: m.name, type: 'material' });
            }}
          />
        )}
        {activeSubTab === 'recipes' && (
          <InventoryRecipes 
            products={products}
            rawMaterials={rawMaterials}
            recipes={recipes}
          />
        )}
        {activeSubTab === 'stock_opname' && (
          <StockOpnameTab materials={rawMaterials} />
        )}
        {activeSubTab === 'returns' && (
          <ReturnSupplierTab materials={rawMaterials} />
        )}
      </div>

      <AddProductModal isOpen={showAddProductModal} onClose={() => setShowAddProductModal(false)} onRefresh={onRefresh} />
      <AddMaterialModal isOpen={showAddMaterialModal} onClose={() => setShowAddMaterialModal(false)} onRefresh={onRefresh} />
      <WasteModal isOpen={showWasteModal} wasteMaterial={wasteMaterial} onClose={() => setShowWasteModal(false)} onRefresh={onRefresh} />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Hapus Permanen?</h3>
                <p className="text-[10px] text-slate-400 font-mono capitalize">Tipe: {deleteConfirm.type}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus <strong className="text-slate-900 font-semibold">"{deleteConfirm.name}"</strong> secara permanen?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold rounded-xl text-slate-700 transition-all cursor-pointer">Batal</button>
              <button onClick={executeDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-md shadow-rose-150">Ya, Hapus Permanen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
