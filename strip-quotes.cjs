const fs = require('fs');
let env = fs.readFileSync('.env', 'utf8');
env = env.replace(/"/g, '');
fs.writeFileSync('.env', env);
