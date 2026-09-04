const fs = require('fs');
const code = fs.readFileSync('src/components/StorefrontProfile.tsx', 'utf-8');
const lines = code.split('\n');

let balance = 0;
for(let i=0; i<lines.length; i++) {
  balance += (lines[i].match(/\{/g) || []).length;
  balance -= (lines[i].match(/\}/g) || []).length;
}
console.log('StorefrontProfile Braces Balance:', balance);

let divBalance = 0;
for(let i=0; i<lines.length; i++) {
  divBalance += (lines[i].match(/<div/g) || []).length;
  divBalance -= (lines[i].match(/<\/div>/g) || []).length;
}
console.log('StorefrontProfile Divs Balance:', divBalance);
