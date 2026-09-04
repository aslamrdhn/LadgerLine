const fs = require('fs');

let content = fs.readFileSync('src/components/Inventory.tsx', 'utf8');

// 1. Add "Pesanan Saya" tab
const tabsTarget = `<button
            onClick={() => { setActiveSubTab('simulator'); setSearchQuery(''); }}`;

const tabsReplacement = `<button
            onClick={() => { setActiveSubTab('purchase_orders'); setSearchQuery(''); }}
            className={\`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 \${activeSubTab === 'purchase_orders' ? 'bg-indigo-600 shadow-md shadow-indigo-600/20 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-transparent'}\`}
          >
            <Package size={16} />
            <span className="hidden sm:inline">Pesanan PO</span>
          </button>
          ` + tabsTarget;

content = content.replace(tabsTarget, tabsReplacement);

// 2. Change activeSubTab type adding 'purchase_orders'
content = content.replace(
  `const [activeSubTab, setActiveSubTab] = useState<'products' | 'materials' | 'recipes' | 'promo' | 'simulator'>('products');`,
  `const [activeSubTab, setActiveSubTab] = useState<'products' | 'materials' | 'recipes' | 'promo' | 'simulator' | 'purchase_orders'>('products');`
);

// 3. Replace the WA button with "Pesan dari Supplier"
const targetWaButton = `<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-[280px]">
                            <div className="text-xs">
                              <p className="font-bold text-slate-800">{m.supplierName}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {m.supplierName} - {m.supplierContact}
                              </p>
                            </div>
                            <a 
                              href={\`https://wa.me/\${m.supplierContact.replace(/[^0-9]/g, '')}?text=Halo%20\${encodeURIComponent(m.supplierName)},%20kami%20dari%20\${encodeURIComponent(appConfig.storeName)}%20ingin%20memesan%20kembali%20stok%20\${encodeURIComponent(m.name)}%20sebanyak%205%20satuan.\`}
                              target="_blank"
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-md transition-all shrink-0 cursor-pointer"
                            >
                              <Phone size={10} />
                              Pesan WA
                            </a>
                          </div>`;

const newActionButton = `<button onClick={() => { setOrderPoMaterial(m); fetchSuppliers(); }} className="px-3 py-2 bg-indigo-600 text-white font-bold rounded flex items-center text-xs gap-2"><Phone size={12}/> Pesan dari Supplier</button>`;
content = content.replace(targetWaButton, newActionButton);

// 4. Add states and blocks for PO
const stateInjection = `
  const [orderPoMaterial, setOrderPoMaterial] = useState<any>(null);
  const [poAmount, setPoAmount] = useState(10);
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const fetchSuppliers = async () => {
    try {
      const savedStore = localStorage.getItem('aslam_ledger_current_store');
      const tenantId = savedStore ? JSON.parse(savedStore).id : 'aslam-brew';
      const headers = { 'X-Tenant-Id': tenantId };
      const [r1, r2] = await Promise.all([
         fetch('/api/suppliers/public', {headers}),
         fetch('/api/suppliers/tenant', {headers})
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      setSupplierList([...(Array.isArray(d1)?d1:[]), ...(Array.isArray(d2)?d2:[])]);
    }catch(err){}
  };

  const fetchPurchaseOrders = async () => {
    try {
      const savedStore = localStorage.getItem('aslam_ledger_current_store');
      const tenantId = savedStore ? JSON.parse(savedStore).id : 'aslam-brew';
      const r = await fetch('/api/purchase_orders', {headers: {'X-Tenant-Id': tenantId} });
      const d = await r.json();
      if(Array.isArray(d)) setPurchaseOrders(d);
    }catch(err){}
  };

  useEffect(() => {
    if(activeSubTab === 'purchase_orders') fetchPurchaseOrders();
  }, [activeSubTab]);

  const handleCreatePo = async () => {
    if(!selectedSupplier) return;
    try {
      const savedStore = localStorage.getItem('aslam_ledger_current_store');
      const tenantId = savedStore ? JSON.parse(savedStore).id : 'aslam-brew';
      const r = await fetch('/api/purchase_orders', {
         method: 'POST',
         headers: {'Content-Type': 'application/json', 'X-Tenant-Id': tenantId},
         body: JSON.stringify({
            materialId: orderPoMaterial.id,
            materialName: orderPoMaterial.name,
            supplierId: selectedSupplier.id,
            supplierName: selectedSupplier.name,
            qty: poAmount
         })
      });
      if(r.ok) {
         setOrderPoMaterial(null);
         triggerToast('Berhasil membuat PO');
      }
    }catch(err){}
  };
`;

content = content.replace("const [inflationPercent, setInflationPercent] = useState<number>(20);", stateInjection + '\n  const [inflationPercent, setInflationPercent] = useState<number>(20);');

const poTabHtml = `
      {activeSubTab === 'purchase_orders' && (
         <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h3 className="font-bold text-lg mb-4">Riwayat Purchase Orders (PO)</h3>
            <div className="space-y-4">
              {purchaseOrders.map((po:any, idx:number) => (
                 <div key={idx} className="p-4 border rounded-lg flex justify-between items-center">
                    <div>
                       <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono font-bold">{po.id}</span>
                       <h4 className="font-bold mt-2">{po.materialName} ({po.qty} unit)</h4>
                       <p className="text-xs text-slate-500">Supplier: {po.supplierName}</p>
                    </div>
                    <div>
                       <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded">{po.status}</span>
                    </div>
                 </div>
              ))}
              {purchaseOrders.length === 0 && <p className="text-sm text-slate-500 italic">Belum ada PO.</p>}
            </div>
         </div>
      )}

      {orderPoMaterial && (
         <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4">
           <div className="bg-white rounded-xl w-full max-w-md p-6">
             <h3 className="font-bold text-lg mb-4">Pesan: {orderPoMaterial.name}</h3>
             
             <label className="text-xs font-bold text-slate-600 block mb-1">Pilih Supplier:</label>
             <select className="w-full border p-2 rounded mb-4" onChange={(e) => setSelectedSupplier(supplierList.find(s=>s.id === e.target.value))}>
                <option value="">-- Pilih --</option>
                {supplierList.map(s => <option key={s.id} value={s.id}>{s.name} - Rp {s.pricePerUnit}</option>)}
             </select>

             <label className="text-xs font-bold text-slate-600 block mb-1">Kuantitas Pesan:</label>
             <input type="number" className="w-full border p-2 rounded mb-4" value={poAmount} onChange={e=>setPoAmount(Number(e.target.value))} />
             
             {selectedSupplier && (
                <div className="p-3 bg-slate-50 border rounded-lg mb-4 text-sm font-mono">
                   Total Estimasi: Rp {(selectedSupplier.pricePerUnit * poAmount).toLocaleString()}
                </div>
             )}

             <div className="flex gap-2">
                <button className="flex-1 bg-slate-200 font-bold text-sm py-2 rounded text-slate-700" onClick={()=>setOrderPoMaterial(null)}>Batal</button>
                <button className="flex-1 bg-indigo-600 text-white font-bold text-sm py-2 rounded" onClick={handleCreatePo}>Kirim PO</button>
             </div>
           </div>
         </div>
      )}
`;

content = content.replace("</div>\n    </div>\n  );\n}", poTabHtml + "\n  </div>\n    </div>\n  );\n}");

fs.writeFileSync('src/components/Inventory.tsx', content);
console.log("Rewrote Inventory.tsx");
