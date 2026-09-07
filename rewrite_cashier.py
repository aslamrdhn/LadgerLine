import re

with open("src/components/Cashier.tsx", "r") as f:
    text = f.read()

# Add new states for Split Bill
split_state = """
  // State for Split Bill
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{method: string, amount: string}[]>([{ method: 'CASH', amount: '' }]);
"""

text = text.replace("const handleCheckout = async () => {", split_state + "\n  const handleCheckout = async (customPayments?: {method: string, amount: string}[]) => {")

# Rewrite payload sent to backend
payload_rewrite = """
      const savedStore = localStorage.getItem('aslam_ledger_current_store');
      const tenantId = savedStore ? JSON.parse(savedStore).id : 'aslam-brew';
      const outletId = savedStore ? JSON.parse(savedStore).outlets?.[0]?.id : 'outlet-1';

      // Transform to TCheckoutPayload
      const checkoutPayload = {
        outletId,
        items: cart.map(item => ({
          menuId: item.product.id,
          quantity: item.quantity,
          note: item.notes,
          discountAmount: item.discountAmount || 0,
          modifiers: item.variant ? [{ itemId: item.variant, quantity: 1, reason: 'extra' }] : []
        })),
        payments: customPayments ? customPayments.map(p => ({
          method: p.method,
          amount: parseFloat(p.amount || '0')
        })) : [{
          method: paymentMethod === 'Tunai' ? 'CASH' : paymentMethod === 'Midtrans' ? 'BANK_TRANSFER' : paymentMethod.toUpperCase(),
          amount: totalBill
        }],
        discountPercent: discountPercent
      };

      const response = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
          'Authorization': `Bearer ${localStorage.getItem('ledgerline_jwt_token')}`
        },
        body: JSON.stringify(checkoutPayload)
      });
"""
text = re.sub(r"const savedStore = localStorage\.getItem\('aslam_ledger_current_store'\);.*?body: JSON\.stringify\(orderPayload\)\n      \}\);", payload_rewrite, text, flags=re.DOTALL)

with open("src/components/Cashier.tsx", "w") as f:
    f.write(text)
