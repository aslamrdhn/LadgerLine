const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Replace enum field types with String
schema = schema.replace(/ Role\s*$/gm, ' String');
schema = schema.replace(/ Role\?/gm, ' String?');
schema = schema.replace(/ Role\s+@default/gm, ' String @default');

schema = schema.replace(/ Plan\s*$/gm, ' String');
schema = schema.replace(/ Plan\?/gm, ' String?');
schema = schema.replace(/ Plan\s+@default/gm, ' String @default');

schema = schema.replace(/ SalesStatus\s*$/gm, ' String');
schema = schema.replace(/ SalesStatus\?/gm, ' String?');
schema = schema.replace(/ SalesStatus\s+@default/gm, ' String @default');

schema = schema.replace(/ HppStatus\s*$/gm, ' String');
schema = schema.replace(/ HppStatus\?/gm, ' String?');
schema = schema.replace(/ HppStatus\s+@default/gm, ' String @default');

schema = schema.replace(/ ReturnStatus\s*$/gm, ' String');
schema = schema.replace(/ ReturnStatus\?/gm, ' String?');
schema = schema.replace(/ ReturnStatus\s+@default/gm, ' String @default');

schema = schema.replace(/ KitchenStatus\s*$/gm, ' String');
schema = schema.replace(/ KitchenStatus\?/gm, ' String?');
schema = schema.replace(/ KitchenStatus\s+@default/gm, ' String @default');

// Remove enum definitions entirely
schema = schema.replace(/enum \w+ \{[\s\S]*?\}/g, '');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Enums fixed');
