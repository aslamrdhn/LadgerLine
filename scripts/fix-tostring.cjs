const fs = require('fs');

let mi = fs.readFileSync('src/components/MarketIntelligence.tsx', 'utf8');

// Replace 905
mi = mi.replace(/s\.pricePerUnit\.toLocaleString\('id-ID'\)/g, "(s.listings?.[0]?.price || s.pricePerUnit || 0).toLocaleString('id-ID')");

// Replace 941
mi = mi.replace(/s\.pricePerUnit\.toLocaleString\(\)/g, "(s.listings?.[0]?.price || s.pricePerUnit || 0).toLocaleString('id-ID')");

// Units
mi = mi.replace(/s\.unit/g, "(s.listings?.[0]?.stockUnit || s.unit || 'unit')");

// For total estimated
mi = mi.replace(/pr\.totalEstimated\.toLocaleString\('id-ID'\)/g, "(pr.totalEstimated || 0).toLocaleString('id-ID')");

fs.writeFileSync('src/components/MarketIntelligence.tsx', mi);

// Do identical substitutions in SupplierPortal.tsx
let sp = fs.readFileSync('src/components/SupplierPortal.tsx', 'utf8');
sp = sp.replace(/pr\.totalEstimated\.toLocaleString\('id-ID'\)/g, "(pr.totalEstimated || 0).toLocaleString('id-ID')");
sp = sp.replace(/p\.price\.toLocaleString\('id-ID'\)/g, "(p.price || 0).toLocaleString('id-ID')");
fs.writeFileSync('src/components/SupplierPortal.tsx', sp);

console.log("Done fixing toLocaleString");
