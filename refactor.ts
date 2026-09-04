import fs from 'fs';
import path from 'path';

const appPath = path.join(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

const shiftHandoverStart = content.indexOf('{/* CUSTOM LOGOUT CONFIRMATION & SHIFT END HANDOVER MODAL */}');
const nextSection = content.indexOf('{/* CUSTOM RESET DATABASE CONFIRMATION MODAL */}');

if (shiftHandoverStart !== -1 && nextSection !== -1) {
    content = content.substring(0, shiftHandoverStart) + content.substring(nextSection);
    console.log('Removed dead Shift Handover block.');
} else {
    console.log('Could not find boundaries.', shiftHandoverStart, nextSection);
}

// 2. Remove unused shift states
const statesToRemove = [
  '  const [actualCashInDrawer, setActualCashInDrawer] = useState<string>(\'\');\n',
  '  const [confirmedHandover, setConfirmedHandover] = useState<boolean>(false);\n',
  '  const [isPrintingShiftReceipt, setIsPrintingShiftReceipt] = useState<boolean>(false);\n',
  '  const [showShiftReceiptSlip, setShowShiftReceiptSlip] = useState<boolean>(false);\n',
];
statesToRemove.forEach(s => { content = content.replace(s, ''); });

// Remove denominations state block
const denomRegex = /  const \[denominations, setDenominations\] = useState<Record<string, number>>\({[\s\S]*?}\);\n/m;
content = content.replace(denomRegex, '');

const handleUpdateDenomRegex = /  const handleUpdateDenomination = \([\s\S]*?};\n/m;
content = content.replace(handleUpdateDenomRegex, '');

const handleIncDenomRegex = /  const handleIncrementDenomination = \([\s\S]*?};\n/m;
content = content.replace(handleIncDenomRegex, '');

fs.writeFileSync(appPath, content, 'utf8');
console.log('App.tsx refactored successfully.');
