const fs = require('fs');
const glob = require('fs').readdirSync;
const path = require('path');

function walkDir(dir, callback) {
  if (dir.includes('node_modules') || dir.includes('dist')) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('server', function(filePath) {
  if (!filePath.endsWith('.ts')) return;
  let lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let importLines = [];
  let contentLines = [];
  
  lines.forEach(line => {
    if (line.includes('import { dbAsync } from') || line.includes("import { dbAsync } from") ) {
      if (!importLines.includes(line)) {
        importLines.push(line);
      }
    } else {
      contentLines.push(line);
    }
  });

  if (importLines.length > 0) {
     const newLines = [...importLines, ...contentLines];
     fs.writeFileSync(filePath, newLines.join('\n'));
  }
});

console.log('Fixed imports');
