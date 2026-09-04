import fs from 'fs';
import path from 'path';

const dbServiceFile = path.join(process.cwd(), 'server', 'services', 'dbService.ts');
let code = fs.readFileSync(dbServiceFile, 'utf8');

// We will export a facade object from DbService temporarily or just parse the whole file directly. 
// A safer way is to just create a single LegacyDbRepository, register it in container, and map everything there, BUT the prompt explicitly asks for:
// "ProductRepository, OrderRepository, TenantRepository, dll"

// We can map methods by their names:
const methodClassMap: Record<string, string> = {
  createAuditLog: 'SystemRepository',
  getTenant: 'TenantRepository',
  saveTenant: 'TenantRepository',
  deleteTenant: 'TenantRepository',
  listTenants: 'TenantRepository',
  getProducts: 'ProductRepository',
  saveProduct: 'ProductRepository',
  deleteProduct: 'ProductRepository',
  getProductsByTenantData: 'ProductRepository',
  batchUpdateProducts: 'ProductRepository',
  getRawMaterials: 'ProductRepository',
  saveRawMaterial: 'ProductRepository',
  deleteRawMaterial: 'ProductRepository',
  getRecipes: 'ProductRepository',
  saveRecipe: 'ProductRepository',
  deleteRecipe: 'ProductRepository',
  getOrders: 'OrderRepository',
  createOrderTransaction: 'OrderRepository',
  confirmPaymentTransaction: 'OrderRepository',
  getFinanceLogs: 'FinanceRepository',
  createFinanceLog: 'FinanceRepository',
  getSecurityAuditLogs: 'SystemRepository',
  createSecurityAuditLog: 'SystemRepository',
  getSystemSetting: 'SystemRepository',
  saveSystemSetting: 'SystemRepository',
  getTables: 'TenantRepository',
  getTableByPublicToken: 'TenantRepository',
  saveTable: 'TenantRepository',
  generateTables: 'TenantRepository',
  getCustomerByPhone: 'TenantRepository',
  saveCustomer: 'TenantRepository',
};

// Instead of parsing AST manually, I will just rewrite DbService.ts into multiple repository files, but that takes time. I will write a simple sed replacement!

function refactorDbService() {
  // Read DbService
  const source = fs.readFileSync(dbServiceFile, 'utf8');
  
  // We'll create LegacyDbRepository and put it in container, routing methods to make compilation pass, 
  // then we actually create the repositories later. But wait, we can just replace 'class DbService' with 'class DbRepository' and put it in legacy, but the prompt says 
  // "Ubah semua method di DbService menjadi method instance di repository masing-masing (ProductRepository, OrderRepository, TenantRepository, dll.). Hapus DbService"

  const lines = source.split('\n');
  const methods: Record<string, string[]> = {
    ProductRepository: [],
    OrderRepository: [],
    TenantRepository: [],
    FinanceRepository: [],
    SystemRepository: []
  };

  let currentRepo = 'SystemRepository'; // default
  let block = [];
  let inMethod = false;
  let braces = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^  static async [a-zA-Z0-9_]+\(/)) {
      const match = line.match(/^  static async ([a-zA-Z0-9_]+)\(/);
      if (match) {
        const methodName = match[1];
        currentRepo = methodClassMap[methodName] || 'SystemRepository';
        
        // Remove static
        block.push(line.replace('static async', 'async'));
        inMethod = true;
        braces = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        continue;
      }
    }

    if (inMethod) {
      block.push(line);
      braces += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braces === 0) {
        methods[currentRepo].push(block.join('\n'));
        block = [];
        inMethod = false;
      }
    }
  }

  // Add serializeDbBigInts globally or import it locally
  const serializeCode = `
function serializeDbBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (obj instanceof Date) return obj;
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber();
  if (Array.isArray(obj)) return obj.map(serializeDbBigInts);
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = serializeDbBigInts(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}`;

  // Write Repositories
  const writeRepo = (name: string, contentArray: string[]) => {
    let output = `import { getPrismaClient } from '../../db.ts';
import { logger } from '../../logger.js';
import bcrypt from 'bcryptjs';
${name === 'OrderRepository' ? `import { container } from '../../container.ts';` : ''}
${serializeCode}

export class ${name} {
${contentArray.join('\n\n')}
}
`;
    // Clean up
    output = output.replace(/DbService\./g, 'this.'); 
    output = output.replace(/const db = getPrismaClient\(\);/g, 'const prisma = getPrismaClient();');

    fs.writeFileSync(path.join(process.cwd(), 'server', 'modules', 'repositories', `${name}.ts`), output);
  };

  if (!fs.existsSync(path.join(process.cwd(), 'server', 'modules', 'repositories'))) {
    fs.mkdirSync(path.join(process.cwd(), 'server', 'modules', 'repositories'), { recursive: true });
  }

  Object.entries(methods).forEach(([repo, blocks]) => {
    writeRepo(repo, blocks);
  });

  // Now replace globally in routes
  const routesDir = path.join(process.cwd(), 'server', 'routes');
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

  const replaceMap: Record<string, string> = {};
  for (const [method, repo] of Object.entries(methodClassMap)) {
    const propName = repo.charAt(0).toLowerCase() + repo.slice(1);
    replaceMap[method] = `container.${propName}`;
  }

  const doReplace = (filepath: string) => {
    let content = fs.readFileSync(filepath, 'utf8');
    content = content.replace(/import \{ DbService \} from '\.\.\/services\/dbService\.ts';/, "import { container } from '../container.ts';");
    content = content.replace(/import \{ DbService \} from '\.\.\/services\/dbService\.js';/, "import { container } from '../container.ts';");
    
    // Quick regex replace for DbService.X
    for (const [method, containerProp] of Object.entries(replaceMap)) {
      const re = new RegExp(`DbService\\\\.${method}`, 'g');
      content = content.replace(re, `${containerProp}.${method}`);
    }
    fs.writeFileSync(filepath, content);
  };

  routeFiles.forEach(f => doReplace(path.join(routesDir, f)));
  
  // controllers
  const ctrls = fs.readdirSync(path.join(process.cwd(), 'server', 'controllers')).filter(f=>f.endsWith('.ts'));
  ctrls.forEach(f => doReplace(path.join(process.cwd(), 'server', 'controllers', f)));

  fs.unlinkSync(dbServiceFile);
}

refactorDbService();
console.log("Refactored gracefully");
