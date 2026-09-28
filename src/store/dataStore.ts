import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import {
  Product,
  RawMaterial,
  Order,
  FinanceLog,
  AppConfig,
  Recipe,
  CoffeeTable,
} from "../types";

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

const defaultProducts: Product[] = [
  {
    id: "prod-1",
    name: "Espresso Single Origin Gayo",
    category: "Coffee",
    price: 22000,
    costPrice: 8500,
    stock: 50,
    warningLimit: 10,
    barcode: "8991001",
    supplierName: "Koperasi Tani Gayo",
    supplierContact: "0812-1111-2222",
  },
  {
    id: "prod-2",
    name: "Cappuccino Classic",
    category: "Coffee",
    price: 28000,
    costPrice: 11000,
    stock: 45,
    warningLimit: 10,
    barcode: "8991002",
    supplierName: "PT Susu Murni",
    supplierContact: "0812-3333-4444",
  },
  {
    id: "prod-3",
    name: "Caramel Macchiato",
    category: "Coffee",
    price: 34000,
    costPrice: 13500,
    stock: 35,
    warningLimit: 10,
    barcode: "8991003",
    supplierName: "Syrup Hub",
    supplierContact: "0812-5555-6666",
  },
  {
    id: "prod-4",
    name: "Cold Brew Signature",
    category: "Coffee",
    price: 30000,
    costPrice: 10500,
    stock: 40,
    warningLimit: 10,
    barcode: "8991004",
    supplierName: "Koperasi Tani Gayo",
    supplierContact: "0812-1111-2222",
  },
  {
    id: "prod-5",
    name: "Matcha Latte Supreme",
    category: "Non-Coffee",
    price: 32000,
    costPrice: 12000,
    stock: 30,
    warningLimit: 8,
    barcode: "8991005",
    supplierName: "Matcha Hub",
    supplierContact: "0812-7777-8888",
  },
  {
    id: "prod-6",
    name: "Artisan Butter Croissant",
    category: "Snacks",
    price: 25000,
    costPrice: 11500,
    stock: 20,
    warningLimit: 5,
    barcode: "8991006",
    supplierName: "Bakery Artisan",
    supplierContact: "0812-9999-0000",
  },
];

const defaultTables: CoffeeTable[] = [
  { id: "tbl-1", name: "Meja 01", status: "Empty", qrCodeUrl: "/table/tbl-1" },
  { id: "tbl-2", name: "Meja 02", status: "Empty", qrCodeUrl: "/table/tbl-2" },
  { id: "tbl-3", name: "Meja 03", status: "Occupied", qrCodeUrl: "/table/tbl-3" },
  { id: "tbl-4", name: "Meja 04", status: "Empty", qrCodeUrl: "/table/tbl-4" },
  { id: "tbl-5", name: "Meja 05 (Outdoor)", status: "Empty", qrCodeUrl: "/table/tbl-5" },
];

export const useDataStore = create<DataStoreState>()(
  persist(
    (set, get) => ({
      products: defaultProducts,
      rawMaterials: [],
      orders: [],
      financeLogs: [],
      appConfig: {
        storeName: "LedgerLine Coffee & Roastery",
        storeAddress: "Jl. Veteran No. 45, Jakarta Pusat",
        storePhone: "0812-3456-7890",
        storeWifiName: "LedgerLine_Guest",
        storeWifiPass: "kopiindonesia",
        subscriptionPricePerMonth: 0,
        licenseKey: "LEDGER-COMMUNITY-2026",
      },
      recipes: [],
      tables: defaultTables,
      isSandbox: false,

      setProducts: (products) => set({ products }),
      setRawMaterials: (rawMaterials) => set({ rawMaterials }),
      setOrders: (orders) => set({ orders }),
      setFinanceLogs: (financeLogs) => set({ financeLogs }),
      setAppConfig: (appConfig) => set({ appConfig }),
      setRecipes: (recipes) => set({ recipes }),
      setTables: (tables) => set({ tables }),
      setIsSandbox: (isSandbox) => set({ isSandbox }),

      addOrder: (order) =>
        set((state) => ({ orders: [order, ...state.orders] })),
      addFinanceLog: (log) =>
        set((state) => ({ financeLogs: [log, ...state.financeLogs] })),
      updateProductStock: (productId, quantityToDeduct) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId
              ? { ...p, stock: Math.max(0, p.stock - quantityToDeduct) }
              : p,
          ),
        })),

      syncOfflineOrders: async () => {
        const state = get();
        const offlineOrders = state.orders.filter(
          (o) => o.id.startsWith("TX-OFFLINE") && o.paymentStatus === "Success",
        );
        if (offlineOrders.length === 0) return;

        const savedStore = localStorage.getItem("aslam_ledger_current_store");
        const tenantId = savedStore ? JSON.parse(savedStore).id : "aslam-brew";

        for (const order of offlineOrders) {
          try {
            const response = await fetch("/api/pos/checkout", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Tenant-Id": tenantId,
                Authorization: `Bearer ${localStorage.getItem("ledgerline_jwt_token")}`,
              },
              body: JSON.stringify({
                ...order,
                id: undefined, // Let server generate real ID
                isOfflineSync: true,
              }),
            });
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.order) {
                // Replace offline order with real order from server
                set((s) => ({
                  orders: s.orders.map((o) =>
                    o.id === order.id ? data.order : o,
                  ),
                }));
              }
            }
          } catch (err) {
            console.error("Failed to sync offline order:", order.id, err);
          }
        }
      },
    }),
    {
      name: "aslam-ledger-storage", // unique name
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
