import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { Product, RawMaterial, Order, FinanceLog, AppConfig, Recipe, CoffeeTable } from '../types';

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface DataStoreState {
  // Core Data
  products: Product[];
  rawMaterials: RawMaterial[];
  orders: Order[];
  financeLogs: FinanceLog[];
  appConfig: AppConfig | null;
  recipes: Recipe[];
  tables: CoffeeTable[];
  isSandbox: boolean;

  // Setters
  setProducts: (products: Product[]) => void;
  setRawMaterials: (materials: RawMaterial[]) => void;
  setOrders: (orders: Order[]) => void;
  setFinanceLogs: (logs: FinanceLog[]) => void;
  setAppConfig: (config: AppConfig) => void;
  setRecipes: (recipes: Recipe[]) => void;
  setTables: (tables: CoffeeTable[]) => void;
  setIsSandbox: (status: boolean) => void;

  // Actions
  addOrder: (order: Order) => void;
  updateProductStock: (productId: string, quantityToDeduct: number) => void;
  addFinanceLog: (log: FinanceLog) => void;
  syncOfflineOrders: () => Promise<void>;
}

export const useDataStore = create<DataStoreState>()(
  persist(
    (set, get) => ({
      products: [],
      rawMaterials: [],
      orders: [],
      financeLogs: [],
      appConfig: null,
      recipes: [],
      tables: [],
      isSandbox: false,

      setProducts: (products) => set({ products }),
      setRawMaterials: (rawMaterials) => set({ rawMaterials }),
      setOrders: (orders) => set({ orders }),
      setFinanceLogs: (financeLogs) => set({ financeLogs }),
      setAppConfig: (appConfig) => set({ appConfig }),
      setRecipes: (recipes) => set({ recipes }),
      setTables: (tables) => set({ tables }),
      setIsSandbox: (isSandbox) => set({ isSandbox }),

      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      addFinanceLog: (log) => set((state) => ({ financeLogs: [log, ...state.financeLogs] })),
      updateProductStock: (productId, quantityToDeduct) => set((state) => ({
        products: state.products.map(p => 
          p.id === productId ? { ...p, stock: Math.max(0, p.stock - quantityToDeduct) } : p
        )
      })),
      
      syncOfflineOrders: async () => {
        const state = get();
        const offlineOrders = state.orders.filter(o => o.id.startsWith('TX-OFFLINE') && o.paymentStatus === 'Success');
        if (offlineOrders.length === 0) return;
        
        const savedStore = localStorage.getItem('aslam_ledger_current_store');
        const tenantId = savedStore ? JSON.parse(savedStore).id : 'aslam-brew';

        for (const order of offlineOrders) {
          try {
            const response = await fetch('/api/checkout', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Tenant-Id': tenantId,
                'Authorization': `Bearer ${localStorage.getItem('ledgerline_jwt_token')}`
              },
              body: JSON.stringify({
                ...order,
                id: undefined, // Let server generate real ID
                isOfflineSync: true
              })
            });
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.order) {
                // Replace offline order with real order from server
                set(s => ({
                  orders: s.orders.map(o => o.id === order.id ? data.order : o)
                }));
              }
            }
          } catch (err) {
            console.error('Failed to sync offline order:', order.id, err);
          }
        }
      }
    }),
    {
      name: 'aslam-ledger-storage', // unique name
      storage: createJSONStorage(() => idbStorage),
    }
  )
);


