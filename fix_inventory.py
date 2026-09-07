with open("src/components/Inventory.tsx", "r") as f:
    text = f.read()

bad = """useState<'products' | 'materials' | 'recipes' | 'promo' | 'simulator' | 'purchase_orders'>('products');"""
good = """useState<'products' | 'materials' | 'recipes' | 'promo' | 'simulator' | 'purchase_orders' | 'stock_opname' | 'returns'>('products');"""

text = text.replace(bad, good)
with open("src/components/Inventory.tsx", "w") as f:
    f.write(text)
