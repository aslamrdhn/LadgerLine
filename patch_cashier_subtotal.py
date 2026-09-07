with open("src/components/Cashier.tsx", "r") as f:
    text = f.read()

subtotal_bad = """  const subtotal = React.useMemo(() => {
    return cart.reduce((sum, item) => {
      const isPromo = !!item.product.promoActive;
      const itemPrice = isPromo 
        ? Math.round(item.product.price * (1 - (item.product.promoDiscountPercent || 15) / 100)) 
        : item.product.price;
      return sum + (itemPrice * item.quantity);
    }, 0);
  }, [cart]);"""

subtotal_good = """  const subtotal = React.useMemo(() => {
    return cart.reduce((sum, item) => {
      const isPromo = !!item.product.promoActive;
      const baseItemPrice = isPromo 
        ? Math.round(item.product.price * (1 - (item.product.promoDiscountPercent || 15) / 100)) 
        : item.product.price;
      const itemPrice = Math.max(0, baseItemPrice - (item.discountAmount || 0));
      return sum + (itemPrice * item.quantity);
    }, 0);
  }, [cart]);"""

text = text.replace(subtotal_bad, subtotal_good)

with open("src/components/Cashier.tsx", "w") as f:
    f.write(text)
