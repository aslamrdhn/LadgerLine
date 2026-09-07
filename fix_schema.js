const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');
content = content.replace(/@default\(now\(\) \+ interval '7 days'\)/g, '@default(dbgenerated("now() + interval \\\'7 days\\\'"))');
content = content.replace(/```/g, '');
fs.writeFileSync('prisma/schema.prisma', content);
