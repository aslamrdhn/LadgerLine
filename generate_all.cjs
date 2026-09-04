const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', 'dist', '.git', '.bolt'];
const excludeFiles = ['package-lock.json', '.DS_Store', 'all_code_pos.txt', 'all_code.txt'];
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.sql'];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (excludeDirs.includes(file)) return;
        const dirObj = path.resolve(dir, file);
        const stat = fs.statSync(dirObj);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(dirObj));
        } else {
            if (!excludeFiles.includes(file) && extensions.includes(path.extname(file))) {
                results.push(dirObj);
            }
        }
    });
    return results;
}

const root = process.cwd();
const filesToRead = [];
if (fs.existsSync(path.join(root, 'server.ts'))) filesToRead.push(path.join(root, 'server.ts'));
filesToRead.push(...walk(path.join(root, 'server')));
filesToRead.push(...walk(path.join(root, 'src')));

let output = '';
filesToRead.forEach(f => {
    output += `\n\n// ==========================================\n`;
    output += `// File: ${path.relative(root, f)}\n`;
    output += `// ==========================================\n\n`;
    output += fs.readFileSync(f, 'utf8');
});

fs.writeFileSync(path.join(root, 'all_code_pos.txt'), output);
console.log('Finished updating all_code_pos.txt');
