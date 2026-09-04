# MIGRATION & IMPLEMENTATION ROADMAP

## PRIORITY P0 - FOUNDATION (Selesai secara konsep & parsial)
- [x] Migrasi ke PostgreSQL & Schema Prisma.
- [x] Backend Express Modular.
- [x] Strict Role-Based Access Control (Tenant Isolation).
- [ ] Implementasi Penuh JWT Middleware di seluruh Endpoint.
- [ ] Comprehensive Audit Log (Sistem Log Security Audit terintegrasi pada db dan disembunyikan untuk End-User, hanya bisa dilihat Super Admin).

## PRIORITY P1 - CORE BUSINESS ENGINE (Selesai / Sedang Diperketat)
- [x] Transaksi Kasir/POS langsung menarik / mutate dari inventory berdasarkan resep.
- [x] Pencatatan Waste (Spoilage/Cacat).
- [x] Kalkulasi HPP deterministik (Pembagian harga kulaan / stok total).
- [x] Laporan Keuangan SAK EMKM (Neraca, Cash Flow, Laba Rugi).
*Catatan Mutlak: Fitur-fitur ini dilarang disentuh oleh AI auto-correction.*

## PRIORITY P2 - SMART SUPPLY HUB V1 (Saat Ini Berjalan)
- [x] Supplier Registration (Tanpa Marketplace Checkout).
- [x] Pendaftaran Produk Supplier dengan sistem approval SuperAdmin.
- [x] Request Purchase Flow (PR) di mana Kedai Kopi hanya mengirim formulir Purchase Request. Transfer di WhatsApp P2P.
- [ ] Supplier Subscription Payment Portal (Dummy Mock/P2P Setup).

## PRIORITY P3 - BUSINESS INTELLIGENCE
- AI terisolasi murni sebagai **Read-Only Data Explainer**. Fungsi tunggal: Memberikan narasi penjelasan mengapa HPP bisa naik, mengapa profit turun, atau mengapa waste tinggi. 
- UI UX difokuskan pada widget dashboard ("Smart Insight") bukan "AI Manager".

