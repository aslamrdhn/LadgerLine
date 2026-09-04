# LedgerLine Vision Audit & Strategy Report

## 1. Audit Codebase Saat Ini
Saat ini, proyek LedgerLine telah memiliki beberapa komponen yang sejajar dengan visi OS Coffee Shop:
- **POS & Kasir (`Cashier.tsx`)**: Mengelola transaksi penjualan dan terhubung dengan resep.
- **Inventory & Stok (`Inventory.tsx`)**: Tersinkronisasi saat barang terjual atau ada *waste*.
- **Database (PostgreSQL + Prisma)**: Struktur data sudah mulai dimigrasi untuk performa dan skalabilitas tinggi. Role bisnis dan *tenant isolation* sudah dirancang.
- **Market Intelligence / Smart Procurement (`MarketIntelligence.tsx`)**: Fitur baru untuk memberikan rekomendasi data *stock depletion*.

Namun, ada hal-hal yang berpotensi *overlapping* atau "terlalu mencoba menjadi segalanya":
- Fitur AI di masa lalu mungkin bertindak terlalu jauh ("AI Auto Reorder" atau sejenisnya tanpa persetujuan manusia).
- Pemisahan *supply marketplace* sebelumnya berbentuk terbuka (siapa saja bisa menjual). Ini akan disesuaikan menjadi *Curated Hub*.

## 2. Identifikasi Fitur Berlawanan dengan Visi Baru
- **Marketplace Terbuka Bebas**: Supplier bisa berjualan tanpa dikurasi. (Akan dihapus/dibatasi ketat).
- **Checkout Payment Gateway Supply**: Fitur transaksi di dalam aplikasi (Akan ditiadakan. Transaksi ke supplier dilakukan secara P2P/langsung, LedgerLine hanya sebagai *Procurement Assistant*).
- **AI Mengambil Keputusan Otomatis**: Fitur dimana AI langsung merubah resep atau merubah HPP secara gaib. (Dilarang secara ketat. Semua murni perbandingan rumus pasti).
- **Ornamen Interface Tidak Penting**: Ornamen "cyberpunk" atau *progress bar* metrik AI yang berlebihan dan tidak menambah profit. (Akan disederhanakan).

## 3. Fitur Utama yang Harus Dipertahankan (Priority P0 & P1)
- **Deterministic HPP & Recipe Management**: Perhitungan matematis pasti HPP per produk.
- **Waste Log**: Integrasi *waste* langsung ke HPP.
- **POS Kasir Offline-First/Online-Sync**: Stabilitas transaksi bagi operasional.
- **SAK EMKM Reporting (Financial Reports)**: Laporan Laba Rugi, Arus Kas dan Neraca berbasis 100% data riil tanpa AI-generated numbers.

## 4. Fitur yang Harus Direvisi (Priority P2)
- **Role Supplier Partner & Super Admin**: Merubah layar *Ecosystem* menjadi layar kurasi. 
- **Smart Restock Recommendation**: Hanya membaca laju penurunan stok 30 hari (*depletion rate*) vs *buffer stok*. AI hanya menyusun kata pengantarnya.
- **Purchase Request**: Pengganti *cart/checkout*. Hanya berupa "Kirim Pengajuan" via platform yang selanjutnya dikomunikasikan via WhatsApp/Email.

## 5. Rancang Database Baru (Sudah Dieksekusi / Refinement)
Struktur di `prisma/schema.prisma` telah mendefinisikan *strict isolation*:
- `Tenant` (Coffee Shop)
- `Supplier`
- `SupplierListing` (Dikontrol approval-nya)
- `PurchaseRequest` & `PurchaseRequestItem` (Non-transactional, hanya log negosiasi)
- `InventoryTransaction` (Log masuk keluar deterministik)

## 6. Rancang Arsitektur Backend
*Express.js Modular* dengan *middleware* ketat.
- `/api/inventory`
- `/api/pos`
- `/api/suppliers` (Hanya *approved listing*)
- `/api/procurement` (Kalkulasi sistem matematika)
- Autentikasi ketat via Token (JWT), memisahkan pintu masuk Coffee Shop, Supplier, dan Super Admin.

## 7. Rancang RBAC (Role-Based Access Control)
- **SUPER_ADMIN**: Pegawai LedgerLine. (Bisa vet supplier).
- **OWNER**: Pemilik kedai. (Akses full data kedai).
- **CASHIER**: Kasir. (Hanya POS).
- **SUPPLIER_PARTNER**: Akun pabrik/distributor. (Dashobard *supply* dan berlangganan).

## 8. Roadmap Implementasi Bertahap
- **Fase A (Selesai)**: Pembuatan *file* PRD dan penegasan arsitektur.
- **Fase B (Selesai)**: Revisi skema *database* untuk *Procurement* tanpa *payment gateway*.
- **Fase C (Sedang Berjalan)**: Menyesuaikan UI *Restock Recommendation* agar tidak tampak seperti toko *online*, namun seperti papan panel peringatan restok.
- **Fase D (Next)**: Membangun halaman *Login & Profil Supplier* dan memisahkan portalnya.
- **Fase E (Next)**: Penyusunan ToS (Terms of Service) dan *disclaimer* *Procurement*.

## 9. Penegasan AI
AI di sistem ini dipusatkan ke satu titik: Penasihat Keuangan & Efisiensi, bukan *System Administrator*.
