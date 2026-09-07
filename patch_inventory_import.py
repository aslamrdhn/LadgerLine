import re

with open("src/components/Inventory.tsx", "r") as f:
    text = f.read()

import_bad = """import { AddMaterialModal } from './inventory/AddMaterialModal';
import { WasteModal } from './inventory/WasteModal';"""

import_good = """import { AddMaterialModal } from './inventory/AddMaterialModal';
import { WasteModal } from './inventory/WasteModal';
import { StockOpnameTab } from './inventory/StockOpnameTab';
import { ReturnSupplierTab } from './inventory/ReturnSupplierTab';"""

text = text.replace(import_bad, import_good)

render_bad = """        {activeSubTab === 'recipes' && (
          <InventoryRecipes 
            products={products}
            rawMaterials={rawMaterials}
            recipes={recipes}
          />
        )}"""

render_good = """        {activeSubTab === 'recipes' && (
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
        )}"""

text = text.replace(render_bad, render_good)

with open("src/components/Inventory.tsx", "w") as f:
    f.write(text)
