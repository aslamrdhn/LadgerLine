/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  category: 'Coffee' | 'Non-Coffee' | 'Heavy Meals' | 'Snacks' | 'Desserts' | 'Beans';
  price: number;
  costPrice: number; // Untuk menghitung laba bersih/keuangan komprehensif
  stock: number; // Stok barang jadi
  warningLimit: number; // Limit warning stok barang jadi
  barcode: string; // Hubungan barcode meja / produk
  supplierId?: string; // ID supplier berelasi
  supplierName: string;
  supplierContact: string;
  imageUrl?: string;
  komposisi?: string;
  promoActive?: boolean; // Label neon promo aktif
  promoDiscountPercent?: number; // Nilai persentase potongan harga
}

export interface RawMaterial {
  id: string;
  name: string;
  stockQuantity: number;
  stockUnit: 'g' | 'ml' | 'pcs' | 'Kg';
  warningLimit: number;
  supplierId?: string; // ID supplier berelasi
  supplierName: string;
  supplierContact: string;
  unitCost: number; // Cost per unit (e.g. Rupiah per gram or per mL)
  isTaxable?: boolean; // Pilihan apakah terkena pajak (PPN/Pajak Pembelian)
  taxRate?: number; // Persentase pajak (misalkan 11 untuk PPN 11%)
}

export interface RecipeItem {
  materialId: string;
  amount: number; // jumlah bahan yang diderivasi secara otomatis per porsi
}

export interface Recipe {
  productId: string;
  ingredients: RecipeItem[];
  notes?: string; // Catatan pribadi takaran, brewing method, atau instruksi racikan
}

export interface OrderItem {
  productId: string;
  quantity: number;
  notes?: string;
  priceAtSale: number; // harga saat transaksi berlangsung
  costAtSale: number; // modal saat transaksi
  variant?: 'HOT' | 'COOL';
}

export interface Order {
  id: string;
  orderTime: string; // ISO string
  tableNumber: string; // Meja pengunjung
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  totalPrice: number;
  paymentMethod: 'QRIS' | 'Tunai' | 'Debit' | 'Midtrans' | 'Split';
  paymentStatus: 'Pending' | 'Success';
  receiptPrinted: boolean;
  notes?: string;
  secureHash?: string;
  totalCost?: number; // Total Cost of Goods Sold (modal racikan resep)
}

export interface CoffeeTable {
  id: string;
  name: string; // Misal: "Meja 01", "Meja 02"
  status: 'Empty' | 'Ordering' | 'Occupied';
  qrCodeUrl: string; // URL spesifik pemesanan barcode meja
  publicToken?: string;
  qrImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

export interface FinanceLog {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  type: 'income' | 'expense';
  category: string; // Misal: "Penjualan Kopi", "Beli Susu", "Gaji Karyawan", "Sewa Ruko"
  amount: number;
  description: string;
  isEncrypted: boolean; // Menunjukkan kepatuhan enkripsi tingkat tinggi
  secureHash: string; // Hash audit keamanan
}

export interface BackupHistory {
  id: string;
  timestamp: string;
  fileSize: number;
  recordCount: number;
  status: 'Success' | 'Failed';
  checksum: string;
}

export interface PrinterDevice {
  name: string;
  type: 'Bluetooth' | 'WiFi';
  address: string;
  status: 'Disconnected' | 'Connecting' | 'Connected';
}

export interface AppConfig {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeWifiName: string;
  storeWifiPass: string;
  subscriptionPricePerMonth: number;
  subscriptionTier?: string; // TIER_1, TIER_2, TIER_3
  ledgerTokenBalance?: number;
  licenseKey: string;
  theme?: 'slate' | 'espresso' | 'midnight' | 'matcha' | 'royal' | 'crimson' | 'ocean' | 'forest' | 'custom';
  customThemeType?: string;
  customThemeAppBg?: string;
  customThemeAsideBg?: string;
  customThemeBorder?: string;
  customThemeActiveTab?: string;
  customThemeInactiveTab?: string;
  customThemeHeaderBg?: string;
  customThemeHeaderText?: string;
  customThemeAccentText?: string;
  customThemeAccentBtn?: string;
  layoutMode?: 'grid' | 'list';
  cashierName?: string;
  cashierRole?: string;
  cashierShift?: string;
  cashierPhone?: string;
  cashierPin?: string;
  cashierAvatar?: string;
  receiptHeaderGreeting?: string;
  receiptFooterMessage?: string;
  receiptShowWifiOnStruk?: boolean;
  cashierEmail?: string;
  driveConnected?: boolean;
  driveStoreFolder?: string;
  driveClientId?: string;
  driveClientSecret?: string;
  driveAutoSync?: boolean;
  // Security Upgrade Parameters
  ownerPasswordHash?: string;
  ownerEmail?: string;
  activeOperatorRole?: 'Owner' | 'Supervisor' | 'Kasir';
  clientEncryptionPasskey?: string;
  clientEncryptionEnabled?: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: string; // ISO string for brute-force lock-outs
  // Customizable Tax & Receipt Settings
  taxType?: 'PPN' | 'PB1' | 'Kustom' | 'NON';
  taxRateCustom?: number;
  receiptHeader?: string;
  receiptFooter?: string;
  initialCapital?: number;
  cashRegisterFund?: number;
  qrisMerchantName?: string;
  qrisProvider?: string;
  qrisBankName?: string;
  qrisImage?: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  action: string;
  operator: string;
  details: string;
  severity: 'info' | 'warning' | 'security';
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

