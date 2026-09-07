import re

with open("src/components/Cashier.tsx", "r") as f:
    text = f.read()

split_ui = """
            {paymentMethod === 'Split' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-2 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Multi-Payment (Split Bill)</h4>
                  <span className="text-[10px] font-mono font-medium text-slate-500">Sisa: Rp {(totalBill - splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)).toLocaleString('id-ID')}</span>
                </div>
                {splitPayments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select 
                      className="h-9 px-2 text-xs border border-slate-300 rounded-lg bg-white"
                      value={p.method}
                      onChange={(e) => {
                        const newP = [...splitPayments];
                        newP[idx].method = e.target.value;
                        setSplitPayments(newP);
                      }}
                    >
                      <option value="CASH">Tunai (CASH)</option>
                      <option value="QRIS">QRIS</option>
                      <option value="DEBIT">Debit</option>
                      <option value="CREDIT">Kredit</option>
                      <option value="BANK_TRANSFER">Transfer Bank</option>
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs font-bold">Rp</span>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-full h-9 pl-8 pr-3 text-sm font-mono border border-slate-300 rounded-lg bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={p.amount}
                        onChange={(e) => {
                          const newP = [...splitPayments];
                          newP[idx].amount = e.target.value;
                          setSplitPayments(newP);
                        }}
                      />
                    </div>
                    {splitPayments.length > 1 && (
                      <button 
                        onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                        className="w-8 h-8 flex items-center justify-center text-red-500 bg-red-50 rounded-lg shrink-0"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => setSplitPayments([...splitPayments, { method: 'CASH', amount: '' }])}
                  className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                >
                  <PlusCircle size={14} /> Tambah Pembayaran
                </button>
              </div>
            )}
"""

target = "{/* Tombol Aksi */}"
text = text.replace(target, split_ui + "\n            " + target)

# Update onClick of the Bayar Sekarang button to pass splitPayments
btn_code_bad = """                  await handleCheckout();"""
btn_code_good = """                  if (paymentMethod === 'Split') {
                    const totalPaid = splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                    if (totalPaid < totalBill) {
                      alert(`Total pembayaran (Rp ${totalPaid.toLocaleString('id-ID')}) belum mencukupi total tagihan (Rp ${totalBill.toLocaleString('id-ID')}).`);
                      return;
                    }
                    await handleCheckout(splitPayments);
                  } else {
                    await handleCheckout();
                  }"""
text = text.replace(btn_code_bad, btn_code_good)

with open("src/components/Cashier.tsx", "w") as f:
    f.write(text)
