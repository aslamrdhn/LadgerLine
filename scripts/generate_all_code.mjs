import fs from 'fs';
import path from 'path';

const outputFile = 'all_code_pos.txt';
const directories = ['src', 'server'];
const allowedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

let combinedCode = '';

function collectFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      collectFiles(fullPath);
    } else {
      const ext = path.extname(file);
      if (allowedExtensions.includes(ext) && file !== 'all_code_pos.txt' && file !== 'vite-env.d.ts') {
        const content = fs.readFileSync(fullPath, 'utf8');
        combinedCode += `\n\n// ==========================================\n`;
        combinedCode += `// File: ${fullPath}\n`;
        combinedCode += `// ==========================================\n\n`;
        combinedCode += content;
      }
    }
  }
}

// include server.ts
const serverTsContent = fs.readFileSync('server.ts', 'utf8');
combinedCode += `\n\n// ==========================================\n`;
combinedCode += `// File: server.ts\n`;
combinedCode += `// ==========================================\n\n`;
combinedCode += serverTsContent;

for (const dir of directories) {
  collectFiles(dir);
}

fs.writeFileSync(outputFile, combinedCode);
console.log('Successfully generated all_code_pos.txt');
