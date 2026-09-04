const fs = require('fs');
let code = fs.readFileSync('src/components/MarketIntelligence.tsx', 'utf8');

const marginShieldIndex = code.indexOf('{/* ----------------------------------------------------\n          SEGMENT 3: MARGIN SHIELD');
const lastDivIndex = code.lastIndexOf('</div>');

if (marginShieldIndex !== -1 && lastDivIndex !== -1) {
    code = code.substring(0, marginShieldIndex) + '\n    </div>\n  );\n}';
    fs.writeFileSync('src/components/MarketIntelligence.tsx', code);
    console.log('Stripped unused segments');
} else {
    console.log('Could not find margin_shield segment');
}
