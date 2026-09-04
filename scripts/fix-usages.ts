import fs from 'fs';
import path from 'path';

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

const replaceMap: Record<string, string> = {};
for (const [method, repo] of Object.entries(methodClassMap)) {
  const propName = repo.charAt(0).toLowerCase() + repo.slice(1);
  replaceMap[method] = `container.${propName}`;
}

const doReplace = (filepath: string) => {
  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) return;
  let content = fs.readFileSync(filepath, 'utf8');
  let changed = false;
  
  if (content.includes('DbService')) {
      content = content.replace(/import \{ DbService \} from '\.\.\/services\/dbService(?:\.ts|\.js)?';/g, "import { container } from '../container.ts';");
      content = content.replace(/import \{ DbService \} from '\.\.\/services\/dbService';/g, "import { container } from '../container.ts';");
      
      for (const [method, containerProp] of Object.entries(replaceMap)) {
        const re = new RegExp(`DbService\\.${method}`, 'g');
        if (content.match(re)) {
            content = content.replace(re, `${containerProp}.${method}`);
            changed = true;
        }
      }
      if (changed) {
          fs.writeFileSync(filepath, content);
      }
  }
};

['server/routes', 'server/controllers', 'server/middlewares', 'server/services'].forEach(dir => {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(f => doReplace(path.join(dir, f)));
    }
});
