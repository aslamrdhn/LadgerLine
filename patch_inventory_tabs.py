import re

with open("src/components/Inventory.tsx", "r") as f:
    text = f.read()

tabs_bad = """  const tabs = [
    { id: 'products', label: 'Menu Jual', icon: <Package size={16} /> },
    { id: 'materials', label: 'Bahan Baku', icon: <Layers size={16} /> },
    { id: 'recipes', label: 'Resep', icon: <BookOpen size={16} /> },
    { id: 'simulator', label: 'Simulator', icon: <Activity size={16} /> },
    { id: 'purchase_orders', label: 'P.O', icon: <ShoppingCart size={16} /> },
  ] as const;"""

tabs_good = """  const tabs = [
    { id: 'products', label: 'Menu Jual', icon: <Package size={16} /> },
    { id: 'materials', label: 'Bahan Baku', icon: <Layers size={16} /> },
    { id: 'recipes', label: 'Resep', icon: <BookOpen size={16} /> },
    { id: 'stock_opname', label: 'Stock Opname', icon: <Activity size={16} /> },
    { id: 'returns', label: 'Retur Supplier', icon: <Tag size={16} /> },
    { id: 'purchase_orders', label: 'P.O', icon: <ShoppingCart size={16} /> },
  ] as const;"""

text = text.replace(tabs_bad, tabs_good)

with open("src/components/Inventory.tsx", "w") as f:
    f.write(text)
