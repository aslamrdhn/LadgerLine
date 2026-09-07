const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// 1. Change provider
schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');

// 2. Remove @db.Decimal annotations
schema = schema.replace(/@db\.Decimal\([^)]+\)/g, '');

// 3. Change Decimal to Float
schema = schema.replace(/ Decimal/g, ' Float');
schema = schema.replace(/ Decimal\?/g, ' Float?');

// 4. Change Json to String
schema = schema.replace(/ Json/g, ' String');
schema = schema.replace(/ Json\?/g, ' String?');

// 5. Remove @default(dbgenerated(...))
schema = schema.replace(/@default\(dbgenerated\("[^"]+"\)\)/g, '');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema fixed for SQLite');
