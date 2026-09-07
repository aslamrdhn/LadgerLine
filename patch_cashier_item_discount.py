import re

with open("src/components/Cashier.tsx", "r") as f:
    text = f.read()

# We need to inject discount input inside cart.map
# Around line 400 where it maps cart items
item_discount_ui = """
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Diskon:</span>
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1.5 text-[10px] font-bold text-slate-400">Rp</span>
                            <input
                              type="number"
                              className="w-full h-7 pl-6 pr-2 text-[11px] font-mono border border-slate-200 rounded-md focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none"
                              placeholder="0"
                              value={item.discountAmount || ''}
                              onChange={(e) => {
                                updateCartItem(item.id, { discountAmount: parseFloat(e.target.value) || 0 });
                              }}
                            />
                          </div>
                        </div>
"""

target = """                          onChange={(e) => updateNotes(item.id, e.target.value)}
                        />"""
text = text.replace(target, target + "\n" + item_discount_ui)

with open("src/components/Cashier.tsx", "w") as f:
    f.write(text)
