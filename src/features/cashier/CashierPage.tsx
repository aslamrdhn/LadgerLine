import React, { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useTenantStore } from '../../store/tenantStore';
import { Product, Order } from '../../types';

function ProductGrid({ products, category, searchQuery, setCategory, setSearchQuery, onAddToCart }: any) {
  const filtered = products.filter((p: any) => 
    (category === 'All' || p.category === category) &&
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <input 
          placeholder="Cari Menu..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="border p-2 rounded" 
        />
        {['All', 'Coffee', 'Snacks'].map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} className={`p-2 rounded ${category === cat ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((p: any) => (
          <div key={p.id} className="border p-4 rounded cursor-pointer hover:bg-gray-50" onClick={() => onAddToCart(p)}>
            <div className="font-bold">{p.name}</div>
            <div className="text-gray-600">Rp {p.price.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartSidebar({ cart, setCart, subtotal, tax, total, onCheckout }: any) {
  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-xl font-bold mb-4">Keranjang</h2>
      <div className="flex-1 overflow-y-auto">
        {cart.map((c: any, i: number) => (
          <div key={i} className="flex justify-between mb-2">
            <div>
              <div className="font-semibold">{c.product.name} x{c.quantity}</div>
            </div>
            <div>Rp {(c.product.price * c.quantity).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="border-t pt-4 mt-4">
        <div className="flex justify-between"><span>Subtotal:</span> <span>Rp {subtotal.toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Pajak:</span> <span>Rp {tax.toLocaleString()}</span></div>
        <div className="flex justify-between font-bold text-lg"><span>Total:</span> <span>Rp {total.toLocaleString()}</span></div>
        <button onClick={onCheckout} disabled={cart.length === 0} className="w-full bg-slate-900 text-white py-3 rounded mt-4">
          Bayar Sekarang
        </button>
      </div>
    </div>
  );
}

function PaymentModal({ total, paymentMethod, setPaymentMethod, cashGiven, setCashGiven, onClose, onConfirm, isProcessing }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Pembayaran</h2>
        <div className="mb-4">Total: Rp {total.toLocaleString()}</div>
        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border p-2 mb-4 rounded">
          <option value="QRIS">QRIS</option>
          <option value="Tunai">Tunai</option>
        </select>
        {paymentMethod === 'Tunai' && (
          <input type="number" placeholder="Uang Diterima" value={cashGiven} onChange={e => setCashGiven(e.target.value)} className="w-full border p-2 mb-4 rounded" />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Batal</button>
          <button onClick={onConfirm} disabled={isProcessing} className="px-4 py-2 bg-blue-600 text-white rounded">
            {isProcessing ? 'Memproses...' : 'Selesai'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrinterSimulator({ result, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm text-center">
        <div className="text-green-600 text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Sukses!</h2>
        {result.change > 0 && <div className="mb-4 text-xl">Kembalian: Rp {result.change.toLocaleString()}</div>}
        <button onClick={onClose} className="w-full px-4 py-2 bg-slate-900 text-white rounded">
          Tutup & Lanjut
        </button>
      </div>
    </div>
  );
}

export default function CashierPage() {
  const { products, addOrder } = useDataStore();
  
  const [cart, setCart] = useState<{ product: Product; quantity: number; notes: string; variant?: 'HOT' | 'COOL'; sugar?: 'LESS' | 'NORMAL' }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'Tunai'>('QRIS');
  const [cashGiven, setCashGiven] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [checkoutResult, setCheckoutResult] = useState<{ success: boolean; order: Order; change: number; } | null>(null);
  
  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;

  const handleCheckout = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 1000));
    
    const newOrder: Order = {
      id: `ORDER-${Date.now()}`,
      orderTime: new Date().toISOString(),
      tableNumber: 'Takeaway',
      items: cart.map(c => ({
        productId: c.product.id,
        quantity: c.quantity,
        priceAtSale: c.product.price,
        costAtSale: 0
      })),
      subtotal,
      discount: 0,
      tax,
      totalPrice: total,
      paymentMethod: 'Tunai',
      paymentStatus: 'Success',
      receiptPrinted: false
    };
    
    addOrder(newOrder);
    setCheckoutResult({ success: true, order: newOrder, change: Number(cashGiven || 0) - total });
    setIsProcessing(false);
    setIsPaymentOpen(false);
    setCart([]);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Kasir LedgerLine</h1>
        <ProductGrid 
          products={products} 
          category={selectedCategory}
          searchQuery={searchQuery}
          setCategory={setSelectedCategory}
          setSearchQuery={setSearchQuery}
          onAddToCart={(product: any) => setCart([...cart, { product, quantity: 1, notes: '' }])}
        />
      </div>
      <div className="w-[400px] bg-white border-l shadow-sm">
        <CartSidebar 
          cart={cart}
          setCart={setCart}
          subtotal={subtotal}
          tax={tax}
          total={total}
          onCheckout={() => setIsPaymentOpen(true)}
        />
      </div>
      
      {isPaymentOpen && (
        <PaymentModal 
          total={total}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          cashGiven={cashGiven}
          setCashGiven={setCashGiven}
          onClose={() => setIsPaymentOpen(false)}
          onConfirm={handleCheckout}
          isProcessing={isProcessing}
        />
      )}
      
      {checkoutResult && (
        <PrinterSimulator 
          result={checkoutResult}
          onClose={() => setCheckoutResult(null)}
        />
      )}
    </div>
  );
}
