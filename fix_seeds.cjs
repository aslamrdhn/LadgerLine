const fs = require('fs');
let content = fs.readFileSync('server/routes/auth.ts', 'utf8');

const blocks = [
  { start: 153, end: 206, tenantVar: 'matchedTenant.id' },
  { start: 275, end: 329, tenantVar: 'matchedTenant.id' },
  { start: 362, end: 396, tenantVar: 'defaultTenantId' },
  { start: 421, end: 454, tenantVar: 'tenant.id' },
];

const fixes = [
  { match: /id:\s*'p-(\d+)'/g, replace: "id: `\\${$TENANT}-p-$1`" },
  { match: /id:\s*'m-(\d+)'/g, replace: "id: `\\${$TENANT}-m-$1`" },
  { match: /'p-(\d+)',\s*'m-(\d+)'/g, replace: "`\\${$TENANT}-p-$1`, `\\${$TENANT}-m-$2`" }
];

let lines = content.split('\n');

blocks.forEach(block => {
  for (let i = block.start - 1; i < block.end; i++) {
    fixes.forEach(fix => {
      let replacement = fix.replace.replace(/\$TENANT/g, block.tenantVar);
      lines[i] = lines[i].replace(fix.match, replacement);
    });
  }
});

fs.writeFileSync('server/routes/auth.ts', lines.join('\n'), 'utf8');
