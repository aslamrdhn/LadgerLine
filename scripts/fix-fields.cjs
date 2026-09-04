const fs = require('fs');
let mi = fs.readFileSync('src/components/MarketIntelligence.tsx', 'utf8');

mi = mi.replace(/{s\.category}/g, "{s.category || 'General Supply'}");
mi = mi.replace(/{s\.commodity}/g, "{s.listings?.[0]?.title || s.commodity || 'Aneka Kebutuhan Kedai'}");
mi = mi.replace(/s\.phone\.replace/g, "(s.phone || '').replace");

fs.writeFileSync('src/components/MarketIntelligence.tsx', mi);
console.log("Replaced fields!");
