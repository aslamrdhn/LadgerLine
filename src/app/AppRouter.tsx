import React from 'react';
import { useUiMode } from '../context/UiModeContext';
import { useDataStore } from '../store/dataStore';

// Lazy loaded modules
const Dashboard = React.lazy(() => import('../components/Dashboard'));
const Cashier = React.lazy(() => import('../components/Cashier'));
const Inventory = React.lazy(() => import('../components/Inventory'));
const TableOrders = React.lazy(() => import('../components/TableOrders'));
const FinancialReports = React.lazy(() => import('../components/FinancialReports'));
const StorefrontProfile = React.lazy(() => import('../components/StorefrontProfile'));
const ShiftHandover = React.lazy(() => import('../components/ShiftHandover'));
const AdminDashboard = React.lazy(() => import('../components/admin/AdminDashboard'));

interface AppRouterProps {
  activeTab: string;
  currentStore: any;
  onRefresh: () => void;
  executeLogout: () => void;
  handleUpdateConfig: (config: any) => void;
  // Superadmin Props
  activeSuperAdminMode: string;
  selectedAuditTenant: any;
  setSelectedAuditTenant: (t: any) => void;
  superadminEmail: string;
  superadminPassword: string;
  handleSuperadminDeleteTenant: (id: string) => void;
}

export function AppRouter({
  activeTab,
  currentStore,
  onRefresh,
  executeLogout,
  handleUpdateConfig,
  activeSuperAdminMode,
  selectedAuditTenant,
  setSelectedAuditTenant,
  superadminEmail,
  superadminPassword,
  handleSuperadminDeleteTenant,
}: AppRouterProps) {
  const { uiMode } = useUiMode();
  const {
    products,
    rawMaterials,
    recipes,
    tables,
    orders,
    financeLogs,
    appConfig,
  } = useDataStore();


  if (activeTab === 'superadmin') {
      if (currentStore?.cashierRole !== 'SUPER_ADMIN') {
          return <div className="p-10 text-center text-red-500 font-bold">403 Forbidden: You do not have SuperAdmin privileges.</div>;
      }
      return (
        <React.Suspense fallback={<div className="flex h-full items-center justify-center font-bold text-slate-500">Memuat Modul...</div>}>
            <AdminDashboard />
        </React.Suspense>
      );
  }

  return (
    <React.Suspense fallback={<div className="flex h-full items-center justify-center font-bold text-slate-500">Memuat Modul...</div>}>
      {activeTab === 'dashboard' && (
        <Dashboard 
          products={products}
          rawMaterials={rawMaterials}
          financeLogs={financeLogs}
          appConfig={appConfig || ({} as any)}
          onRefresh={onRefresh}
        />
      )}
      
      {activeTab === 'kasir' && (
        <Cashier 
          products={products}
          rawMaterials={rawMaterials}
          recipes={recipes}
          tables={tables}
          appConfig={appConfig || ({} as any)}
          onRefresh={onRefresh}
        />
      )}

      {activeTab === 'stok' && (
        <Inventory 
          products={products}
          rawMaterials={rawMaterials}
          recipes={recipes}
          appConfig={appConfig || ({} as any)}
          onRefresh={onRefresh}
        />
      )}

      {activeTab === 'meja' && (
        <TableOrders 
          tables={tables}
          products={products}
          orders={orders}
          appConfig={appConfig || ({} as any)}
          onRefresh={onRefresh}
        />
      )}

      {activeTab === 'laporan' && (
        <FinancialReports 
          financeLogs={financeLogs}
          orders={orders}
          products={products}
          rawMaterials={rawMaterials}
          backupHistory={[]}
          appConfig={appConfig || ({} as any)}
          onRefresh={onRefresh}
        />
      )}

      {activeTab === 'pengaturan' && (
        <StorefrontProfile 
          appConfig={appConfig || ({} as any)}
          onUpdateConfig={handleUpdateConfig}
          products={products}
          rawMaterials={rawMaterials}
          recipes={recipes}
          onRefresh={onRefresh}
        />
      )}
    </React.Suspense>
  );
}
