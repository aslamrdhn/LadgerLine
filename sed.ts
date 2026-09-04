import fs from 'fs';
import path from 'path';

const p = path.join(process.cwd(), 'src/components/ShiftHandover.tsx');
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/shiftMetrics\.cashDifference/g, 'localCashDifference');
fs.writeFileSync(p, c, 'utf8');
