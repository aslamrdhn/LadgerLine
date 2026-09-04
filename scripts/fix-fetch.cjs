const fs = require('fs');
let mi = fs.readFileSync('src/components/MarketIntelligence.tsx', 'utf8');

mi = mi.replace(/(const resPub = await fetch.*)/, "$1\n      if(resPub.ok) {");
mi = mi.replace(/(const pubData = await resPub\.json\(\);)/, "$1");
mi = mi.replace(/(if\(Array\.isArray\(pubData\)\) setGlobalSuppliers\(pubData\);)/, "$1 }");

mi = mi.replace(/(const resPriv = await fetch.*)/, "$1\n      if(resPriv.ok) {");
mi = mi.replace(/(const privData = await resPriv\.json\(\);)/, "$1");
mi = mi.replace(/(if\(Array\.isArray\(privData\)\) setMySuppliers\(privData\);)/, "$1 }");

mi = mi.replace(/(const resProc = await fetch.*)/, "$1\n      if(resProc.ok) {");
mi = mi.replace(/(const procData = await resProc\.json\(\);)/, "$1");
mi = mi.replace(/(if\(Array\.isArray\(procData\)\) setProcurementSuggestions\(procData\);)/, "$1 }");

mi = mi.replace(/(const resPR = await fetch.*)/, "$1\n      if(resPR.ok) {");
mi = mi.replace(/(const prData = await resPR\.json\(\);)/, "$1");
mi = mi.replace(/(if\(Array\.isArray\(prData\)\) setMyPurchaseRequests\(prData\);)/, "$1 }");

fs.writeFileSync('src/components/MarketIntelligence.tsx', mi);
console.log('Fixed fetch ok');
