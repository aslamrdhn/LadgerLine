const fs = require('fs');

let content = fs.readFileSync('server/services/dbService.ts', 'utf8');

// Replace .map(p => { const recipes = await ... }) with Promise.all
content = content.replace(/prods\.map\(p => \{/g, 'await Promise.all(prods.map(async p => {');
content = content.replace(/            name: p\.name,\n            category: p\.category,\n            price: p\.price,\n            costPrice: p\.cost_price,\n            stock: p\.stock,\n            warningLimit: p\.warning_limit,\n            barcode: p\.barcode,\n            supplier: p\.supplier_name,\n            komposisi: p\.komposisi,\n            recipes: recipes\.map\(\(r: any\) => \(\{ materialId: r\.materialId, amount: r\.amount \}\)\)\n          \};\n        \}\);\n      \} catch \(err: any\) \{/g, 
            '            name: p.name,\n            category: p.category,\n            price: p.price,\n            costPrice: p.cost_price,\n            stock: p.stock,\n            warningLimit: p.warning_limit,\n            barcode: p.barcode,\n            supplier: p.supplier_name,\n            komposisi: p.komposisi,\n            recipes: recipes.map((r: any) => ({ materialId: r.materialId, amount: r.amount }))\n          };\n        }));\n      } catch (err: any) {');

fs.writeFileSync('server/services/dbService.ts', content, 'utf8');

console.log('Fixed dbService');
