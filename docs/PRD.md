# LEDGERLINE ENTERPRISE PRD — VERSION 12.3
## THE OMNIBUS EDITION — THE ULTIMATE REALITY PATCH (COMPLETE & SELF-CONTAINED)

---

> **Versi:** 12.3 (The Omnibus — Ultimate Reality Patch)  
> **Status:** ABSOLUTELY FREEZED — Zero tolerance for changes without formal amendment.  
> **Tanggal Efektif:** 1 Januari 2026  
> **Dokumen Ini Adalah:** Kontrak Implementasi Produk Final & Absolut — Satu-satunya acuan.  
> **Total Patch:** 11 Putaran Analisis Brutal — Ditutup: Split Payment, Rounding, Modifiers, Open Bill Temporal HPP, Offline Lock Date Bypass, Landed Cost, 100% Diskon Fraud, Redis OOM, Surplus Valuation, OTP Reset, Subscription SLA.  
> **Struktur Dokumen:** 7 Volume Internal — Tetap satu file utuh.

---

# NAVIGATIONAL COMPASS (WAJIB DIBACA)

> **Untuk Pemilik Produk, Founder, dan Non-Teknis:**  
> Baca **Volume I, II (bagian formula bisnis), dan III**. Lewati Volume IV dan V.
>
> **Untuk Arsitek & Developer:**  
> Baca **Semua Volume**, mulai dari I hingga VI. Perhatikan terutama Volume IV (Arsitektur) dan V (Database).
>
> **Untuk QA & Tester:**  
> Baca **Volume III (Workflow)** dan **Volume VI (Testing & Edge Cases)**.

---

# DAFTAR ISI LENGKAP (OMNIBUS)

| Volume | Bab | Judul |
|--------|-----|-------|
| I | 1 | Pendahuluan & Prinsip Dokumen |
| I | 2 | Product Vision & DNA (LedgerLine BUKAN POS) |
| I | 3 | Product Line Architecture (Cashier, Business, Network) |
| I | 4 | Domain Glossary |
| I | 5 | AI Boundary (Boleh & Tidak Boleh) |
| II | 6 | Business Rules Bible — Average Cost Engine |
| II | 7 | Business Rules Bible — True HPP Pipeline |
| II | 8 | Business Rules Bible — Financial Closing State Machine |
| II | 9 | Business Rules Bible — Transfer Pricing & Landed Cost |
| II | 10 | Business Rules Bible — Rounding Rules (Banker's Rounding) |
| II | 11 | Business Rules Bible — Formula Traceability Matrix |
| III | 12 | Functional Requirements per Package (Eksplisit) |
| III | 13 | Workflow Specification (POS, Purchase, Transfer, Closing) |
| III | 14 | State Machine Specification (Sales Order, Purchase Order, Tenant) |
| III | 15 | Permission Matrix (RBAC) & Feature Flag Matrix |
| IV | 16 | Authentication & Identity (Google OAuth, App-PIN, OTP Reset) |
| IV | 17 | Portal Router & Tenant/Outlet Resolver |
| IV | 18 | Event Driven Architecture (Domain Events) |
| IV | 19 | Queue & Worker Resilience (BullMQ, DLQ, TTL 7 Hari, Persistence) |
| IV | 20 | Offline Strategy (Queue, Conflict Resolution, Merge, Lock Date Guard) |
| IV | 21 | Google Workspace Integration (Outbox, Retry, DLQ, Verify) |
| IV | 22 | Notification Engine (Channel, Priority, Queue) |
| IV | 23 | Plugin Architecture & SDK (Future Roadmap) |
| V | 24 | Database Design & Data Dictionary (DDL Final) |
| V | 25 | Archival Strategy (Hot/Cold) & Migration Policy |
| VI | 26 | Acceptance Test per Package (Eksplisit — Semua ID) |
| VI | 27 | Definition of Done (DoD — 36 Butir Eksplisit) |
| VI | 28 | Extreme Scenarios & Edge Cases |
| VI | 29 | Data Ownership & GDPR/PDP |
| VI | 30 | Audit & Consistency Report (11 Rounds Verified) |
| VI | 31 | Build Order |
| APP | A | API Summary & Error Code Registry |
| APP | B | Penutup & Final Approval |

---

# VOLUME I — PRODUCT VISION & STRATEGY

## BAB 1 — Pendahuluan & Prinsip Dokumen

### 1.1 Tujuan Dokumen
Dokumen ini adalah **Product Requirement Document (PRD) Final** untuk LedgerLine Enterprise. Dokumen ini berfungsi sebagai **kontrak implementasi absolut** yang mengikat seluruh pihak (developer, AI, arsitek, tim QA, dan stakeholder). Tidak ada interpretasi yang tersisa.

### 1.2 Prinsip Dokumen
1. **Zero Ambiguity** — Setiap pernyataan harus spesifik dan terukur.
2. **Complete Coverage** — Tidak ada area yang dibiarkan "akan ditentukan nanti".
3. **Implementation Ready** — Developer dapat langsung mengkode dari dokumen ini.
4. **Auditable** — Setiap keputusan memiliki justifikasi.
5. **Testable** — Setiap fitur memiliki acceptance test yang jelas.
6. **Immutable Contract** — Perubahan hanya melalui amandemen formal.

### 1.3 Core Product Principle (The Unshakable Rule)
> **LedgerLine BUKAN Payment Gateway.** LedgerLine berfungsi sebagai **pencatatan transaksi (Payment Recording)**, bukan pemrosesan. QRIS adalah milik toko. Multi-Payment (Split) dicatat, bukan diproses.

---

## BAB 2 — Product Vision & DNA

### 2.1 Definisi Formal
> **LedgerLine adalah Coffee Business Operating System, BUKAN POS.**
>
> POS hanyalah salah satu modul dari sistem operasi bisnis kopi yang utuh. LedgerLine mengintegrasikan operasional, pengendalian biaya, analitik bisnis, dan rantai pasok ke dalam satu platform.

### 2.2 DNA LedgerLine (The 5 Pillars)
1. **Accuracy** — Akurasi perhitungan (Average Cost, True HPP) adalah segalanya.
2. **Automation** — Operasional berulang harus otomatis.
3. **Migration** — Kemudahan berpindah dari POS lain.
4. **Supply** — Jaringan supplier terkurasi.
5. **Intelligence** — Data sebagai dasar keputusan.

### 2.3 Tagline
> **"Coffee Business Operating System"**

---

## BAB 3 — Product Line Architecture

| No | Fitur | Cashier 📦 | Business 💼 | Network 🌐 |
|----|-------|------------|-------------|------------|
| 1 | Google OAuth (Admin/Owner) | ✅ | ✅ | ✅ |
| 2 | App-PIN (Kasir POS) + Brute-Force + OTP Reset | ✅ | ✅ | ✅ |
| 3 | Multi-Outlet | 1 | 5 | 20 |
| 4 | Open Bill (Item Level HPP Lock) | ✅ | ✅ | ✅ |
| 5 | Split Payment (Multi-Payment) | ✅ | ✅ | ✅ |
| 6 | Modifiers / Add-ons (Self-Referencing) | ✅ | ✅ | ✅ |
| 7 | Diskon Otorisasi Manager (>20%) | ✅ | ✅ | ✅ |
| 8 | Average Cost Engine (per Outlet) | ❌ | ✅ | ✅ |
| 9 | Transfer Antar Outlet (dengan Landed Cost) | ❌ | ✅ | ✅ |
| 10 | Cost Recalculation Engine (dengan Lock Date) | ❌ | ✅ | ✅ |
| 11 | Offline Sync Guardian (Lock Date Validation) | ❌ | ✅ | ✅ |
| 12 | Supply Network (Supplier RLS) | ❌ | ❌ | ✅ |
| 13 | QR MENU (per Outlet/Meja) | ❌ | ❌ | ✅ |

---

## BAB 4 — Domain Glossary

| Istilah | Definisi |
|---------|----------|
| **Open Bill** | Status pesanan di mana item dapat ditambahkan bertahap; HPP dikunci saat item dikirim ke dapur. |
| **Landed Cost** | Biaya angkut yang ditambahkan ke nilai transfer antar outlet, diserap ke HPP penerima. |
| **OTP Reset** | One-Time Password 6 digit untuk memulihkan Device ID yang hilang (berlaku 5 menit). |
| **Modifier / Add-on** | Item tambahan (Extra Shot) yang diikat ke menu utama via `parent_detail_id`. |
| **Blind Close** | Kasir input fisik tanpa melihat expected cash; variance di backend. |
| **Contra-Journal** | Jurnal pembalik untuk Refund; membalik Revenue, Pajak, dan Inventory. |
| **DLQ (Dead Letter Queue)** | Tempat job gagal setelah retry maksimal. Disimpan di Redis dengan **TTL 7 Hari**, lalu dipersist ke PostgreSQL. |

---

## BAB 5 — AI Boundary

### 5.1 AI Boleh (Allowed)
- Memberi rekomendasi harga.
- Memberi insight efisiensi.
- Membantu forecasting penjualan.
- Membaca tren dan anomali.

### 5.2 AI TIDAK Boleh (Forbidden)
- Mengubah jurnal keuangan.
- Menghapus data.
- Mengubah harga jual otomatis tanpa approval Owner.
- Mengubah stok.
- Mengubah Average Cost atau HPP.
- Mengambil keputusan bisnis tanpa persetujuan Owner.

> **Aturan:** Semua output AI harus transparan (menampilkan alasan dan confidence score). Owner yang memutuskan.

---

# VOLUME II — BUSINESS RULES & FORMULA SPECIFICATION

## BAB 6 — Average Cost Engine

### 6.1 Formula
```
Average Baru = ((Qty Lama × Average Lama) + (Qty Baru × Harga Baru)) / (Qty Lama + Qty Baru)
```

### 6.2 Aturan (Immutable)
- Penjualan TIDAK mengubah Average.
- Purchase mengubah Average (per Outlet).
- Waste, Transfer (tanpa landed cost), Stock Opname TIDAK mengubah Average.
- Average Cost tidak boleh negatif.
- **Landed Cost** pada Transfer mengubah Average di Outlet Penerima.

### 6.3 Event
- `AverageUpdated` dipublikasikan setiap kali Average berubah.
- Payload: `{ ingredient_id, outlet_id, old_avg, new_avg, qty, reference (po_id) }`.

---

## BAB 7 — True HPP Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRUE HPP PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Recipe (Bahan Baku + Kemasan)                                              │
│      ↓                                                                      │
│  Average Cost (per Outlet, per Ingredient)                                  │
│      ↓                                                                      │
│  Direct HPP = Σ (Qty_Recipe × Average_Cost)                                 │
│      ↓                                                                      │
│  + Labor Cost (OPEX) — Dialokasikan per menu                                │
│      ↓                                                                      │
│  + Expense Allocation (Sewa, Listrik) — OPEX                                │
│      ↓                                                                      │
│  - Waste / Shrinkage (Dikurangi dari total produksi)                        │
│      ↓                                                                      │
│  = TRUE HPP per Menu                                                        │
│      ↓                                                                      │
│  Selling Price Recommendation (Target Margin 60%+)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.1 Direct HPP (COGS)
`Direct HPP = Σ (Qty Resep × Average Cost Bahan) + Biaya Kemasan`.

### 7.2 Struktur P&L Final
```
Net Revenue
   - Direct HPP
   = Gross Profit
   - OPEX (Labor, Sewa)
   = Net Profit
```

---

## BAB 8 — Financial Closing State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FINANCIAL CLOSING STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPEN SHIFT (Kasir mulai)                                                   │
│      ↓                                                                      │
│  SALES (Transaksi berjalan, HPP dikunci saat item ke dapur)                 │
│      ↓                                                                      │
│  BLIND CLOSE (Kasir input fisik, variance di backend)                       │
│      ↓                                                                      │
│  VARIANCE REPORT (Dikirim ke Owner)                                         │
│      ↓                                                                      │
│  JOURNAL ENTRY (Otomatis, immutable)                                        │
│      ↓                                                                      │
│  ACCOUNTING LOCK DATE (Jika bulan tutup, data terkunci)                     │
│      ↓                                                                      │
│  GOOGLE DRIVE UPLOAD (Outbox → Retry → DLQ → Persistence)                   │
│      ↓                                                                      │
│  SNAPSHOT (Inventory, Average, Dashboard)                                   │
│      ↓                                                                      │
│  ARCHIVE (Data > 1 tahun ke cold storage)                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## BAB 9 — Transfer Pricing & Landed Cost

### 9.1 Formula
```
Nilai Transfer = Qty × AvgCost_Pengirim
AvgCost_Penerima = ((Qty × AvgCost_Pengirim) + LandedCost) / Qty
```

### 9.2 Aturan
1. Transfer hanya untuk paket **Business** dan **Network**.
2. `landed_cost` (biaya angkut) WAJIB diisi oleh Admin.
3. Jika `landed_cost` = 0, nilai transfer murni (tanpa biaya angkut).
4. LandedCost dicatat dalam jurnal sebagai komponen HPP di outlet penerima.

---

## BAB 10 — Rounding Rules (Banker's Rounding)

> **Aturan Mutlak:** Pajak dan diskon dihitung di **level baris (line item)** , bukan Grand Total.

### 10.1 Metode
- Gunakan **Banker's Rounding** (dibulatkan ke angka genap terdekat jika tepat 0.5).
- Setiap line item memiliki kolom `discount_amount_rounded` dan `tax_amount_rounded`.
- Grand Total adalah `SUM(selling_price_per_item * qty) - SUM(discount_rounded) + SUM(tax_rounded)`.
- `rounding_amount` di `sales_orders` menampung selisih jika ada.

---

## BAB 11 — Formula Traceability Matrix

| REQ ID | Business Rule | Formula | Code Module | API | UI | Test |
|--------|---------------|---------|-------------|-----|----|------|
| BIZ-03 | Average Cost | (Qty*Avg + Qty*Price)/(Qty+Qty) | `average.engine.ts` | `/api/v1/average` | Inventory | BIZ-T-002 |
| BIZ-04 | Direct HPP | Σ(Qty_Recipe × Avg_Cost) + Packaging | `hpp.engine.ts` | `/api/v1/hpp` | Recipe | BIZ-T-003 |
| BIZ-08 | Opname Surplus | Wajib `estimated_unit_cost` | `opname.service.ts` | `/api/v1/opname` | Inventory | BIZ-T-006 |
| BIZ-11 | Landed Cost | ((Qty×Avg)+Landed)/Qty | `transfer.service.ts` | `/api/v1/transfer` | Inventory | BIZ-T-008 |

---

# VOLUME III — FUNCTIONAL REQUIREMENTS & WORKFLOWS

## BAB 12 — Functional Requirements per Package

### 12.1 Cashier (📦)
| ID | Requirement | Deskripsi |
|----|-------------|-----------|
| CAS-01 | App-PIN Login | Login dengan PIN 4-6 digit, device binding |
| CAS-02 | Open Bill | Pesanan dapat bertambah; HPP dikunci saat item ke dapur |
| CAS-03 | Maksimal 25 Menu | Tidak bisa tambah menu ke-26 |
| CAS-04 | Split Payment | Menerima 3+ metode pembayaran (Cash+QRIS+Debit) |
| CAS-05 | Modifiers | Extra Shot, Oat Milk dengan validasi stok mandiri |
| CAS-06 | Blind Close Shift | Kasir input fisik uang tanpa expected cash |
| CAS-07 | Diskon Otorisasi Manager | Diskon >20% wajib PIN Manager |
| CAS-08 | Auto-Logout POS | Logout otomatis setelah 10 menit idle |
| CAS-09 | Piutang dengan Customer ID | Metode piutang wajib customer_id |
| CAS-10 | Pajak PB1 | Pemisahan pajak dari pendapatan (line-item rounding) |
| CAS-11 | QRIS Recording | Pencatatan pembayaran QRIS milik toko |
| CAS-12 | Basic Report | Laporan penjualan harian |
| CAS-13 | Customer Management | Data pelanggan |
| CAS-14 | Stock Sederhana | Stok minimal |

### 12.2 Business (💼)
| ID | Requirement | Deskripsi |
|----|-------------|-----------|
| BIZ-01 | Unlimited Menu | Tidak ada batasan menu |
| BIZ-02 | Multi-Outlet (5 outlet) | Mendukung hingga 5 cabang |
| BIZ-03 | Average Cost Engine (per Outlet) | Weighted Average Cost per outlet |
| BIZ-04 | Direct HPP | Biaya bahan baku + kemasan (dikunci di snapshot) |
| BIZ-05 | OPEX (Tenaga Kerja, Sewa) | Dicatat di bawah Gross Profit |
| BIZ-06 | Recipe Management & Versioning | Resep dengan versioning |
| BIZ-07 | Inventory Lengkap (per Outlet) | Manajemen stok penuh per outlet |
| BIZ-08 | Stock Opname Surplus Valuation | Wajib `estimated_unit_cost` jika surplus |
| BIZ-09 | Transfer Antar Outlet (dengan Landed Cost) | Transfer pricing + biaya angkut |
| BIZ-10 | Finance & Accounting | Jurnal, P&L, Balance Sheet, Line-Item Rounding |
| BIZ-11 | Cost Recalculation Engine | Koreksi HPP dengan Accounting Lock Date |
| BIZ-12 | Contra-Journal Refund | Jurnal pembalik + restitusi stok |
| BIZ-13 | Offline Sync Guardian | Tolak transaksi offline jika melewati Lock Date |
| BIZ-14 | Google Workspace | Outbox + Exponential Backoff + DLQ |
| BIZ-15 | Queue Resilience | BullMQ + DLQ + TTL 7 Hari + Persistence |
| BIZ-16 | Advanced Dashboard & KPI | Dashboard bisnis |
| BIZ-17 | Audit Trail | Log perubahan |

### 12.3 Network (🌐)
| ID | Requirement | Deskripsi |
|----|-------------|-----------|
| NET-01 | Supply Network | Katalog supplier terverifikasi |
| NET-02 | Supplier Portal | Dashboard supplier |
| NET-03 | QR MENU (per Outlet, per Meja) | Menu publik per outlet & meja |
| NET-04 | Migration Center | Migrasi data dari POS lain |

---

## BAB 13 — Workflow Specification

### 13.1 Sales Workflow (Dengan Open Bill & HPP Lock)
```
1. Kasir buka order → Status: OPEN
2. Kasir tambah item pertama → Kirim ke dapur → HPP dikunci (processed_at = NOW())
3. Pelanggan tambah item kedua 30 menit kemudian → Kirim ke dapur → HPP dikunci (processed_at = NOW())
4. Pelanggan bayar → Status: PENDING_PAYMENT → Payment Records dibuat
5. Payment Records sum >= gross_total → Status: PAID → Jurnal dibuat
```

### 13.2 Offline Sync Guardian Workflow
```
1. Tablet offline → Transaksi disimpan di local storage
2. Internet kembali → Queue sync
3. Backend validasi created_at vs accounting_lock_date
4. Jika created_at < lock_date → Tolak → Masuk delayed_offline_sync_log
5. Manajer Keuangan review → Pilih: Adjustment Journal / Force Sync
```

---

## BAB 14 — State Machine Specification

### Sales Order State
```
DRAFT → OPEN (item ditambahkan) → PENDING_PAYMENT (checkout dimulai) → PAID (payment complete) → COMPLETED
                                                                         ↓
                                                                    REFUNDED / VOIDED
```

### Purchase Order State (P2P)
```
SENT → READ → FULFILLED → COMPLETED
         ↓
      CANCELLED
```

---

## BAB 15 — Permission Matrix & Feature Flag Matrix

### 15.1 Feature Flag Matrix

| Feature Flag | Cashier 📦 | Business 💼 | Network 🌐 | Default |
|--------------|------------|-------------|------------|---------|
| `feature.pos` | ✔ | ✔ | ✔ | true |
| `feature.open_bill` | ✔ | ✔ | ✔ | true |
| `feature.split_payment` | ✔ | ✔ | ✔ | true |
| `feature.modifiers` | ✔ | ✔ | ✔ | true |
| `feature.blind_close` | ✔ | ✔ | ✔ | true |
| `feature.multi_outlet` | ✖ | ✔ | ✔ | false |
| `feature.transfer` | ✖ | ✔ | ✔ | false |
| `feature.average_cost` | ✖ | ✔ | ✔ | false |
| `feature.landed_cost` | ✖ | ✔ | ✔ | false |
| `feature.offline_guardian` | ✖ | ✔ | ✔ | false |

### 15.2 RBAC (Role-Based Access Control)

| Modul | Owner | Manager | Cashier | Kitchen | Warehouse | Finance | Supplier | Super Admin |
|-------|-------|---------|---------|---------|-----------|---------|----------|-------------|
| POS (Create Order) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Diskon >20% Otorisasi | ✅ | ✔️ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Blind Close Shift | ✅ | ✅ | ✏️ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Transfer (Landed Cost) | ✅ | ✅ | ❌ | ❌ | ✏️ | ❌ | ❌ | ✅ |
| Offline Sync Review | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |

---

# VOLUME IV — TECHNICAL ARCHITECTURE & IMPLEMENTATION

## BAB 16 — Authentication & Identity

### 16.1 Matriks Autentikasi
| Role | Metode | Perangkat | Outlet Context |
|------|--------|-----------|----------------|
| Super Admin, Owner, Manager, Finance, Warehouse, Supplier | Google OAuth | Pribadi | - |
| **Cashier, Kitchen** | **App-PIN** | **Bersama (Tablet)** | **Outlet assigned** |

### 16.2 App-PIN Security
1. Redis: `pin_attempt:{outlet_id}:{device_id}` → max 5 attempts per 10 minutes.
2. Device ID Binding (IndexedDB).
3. Audit Log: `security_audit_log`.

### 16.3 OTP Hardware Reset
1. Owner generate OTP 6 digit (berlaku 5 menit).
2. Kasir input OTP di tablet → regenerate Device Key.

---

## BAB 17 — Portal Router & Tenant Resolver

| Portal | Role | URL | Login |
|--------|------|-----|-------|
| Admin Console | SUPER_ADMIN, LEDGER_ADMIN | `/admin` | Google OAuth |
| Owner Portal | OWNER, MANAGER | `/owner` | Google OAuth |
| Cashier Portal | CASHIER | `/pos` | App-PIN |
| Kitchen Display | KITCHEN | `/kitchen` | App-PIN |
| Supplier Portal | SUPPLIER_PARTNER | `/supplier` | Google OAuth |

---

## BAB 18 — Event Driven Architecture

**Daftar Domain Events:**
- `OrderCreated` → `InventoryReduced` → `AverageUpdated` → `JournalCreated` → `GoogleDriveQueued` → `NotificationQueued`.
- `TransferCompleted` → `LandedCostApplied` → `AverageUpdated`.
- `OfflineSyncRejected` → `DelayedSyncLogged`.

---

## BAB 19 — Queue & Worker Resilience (BullMQ + DLQ + TTL)

**Aturan Mutlak:**
1. Job gagal 3x → masuk DLQ Redis.
2. **Redis DLQ TTL = 7 Hari.**
3. Sebelum dihapus, data dipersist ke PostgreSQL `failed_jobs`.
4. Admin Console tampilkan `failed_jobs` untuk manual retry.
5. Alert: >1000 DLQ per jam → notifikasi Admin.

---

## BAB 20 — Offline Strategy & Sync Guardian

```
POS Offline → Local Storage (Queue)
   ↓
Internet Back → Sync Queue
   ↓
Backend Validasi: created_at vs accounting_lock_date
   ↓
Jika created_at < lock_date → Tolak → delayed_offline_sync_log
   ↓
Manager Review → Adjustment Journal / Force Sync
```

---

## BAB 21 — Google Workspace Integration

### 21.1 Workflow
```
Generate Report → Queue → Retry (5x, Exponential) → DLQ (TTL 7 Hari) → Persist failed_jobs → Admin Manual Retry
```

---

## BAB 22 — Notification Engine

**Channel:** Email, In-App, Push (Future: WA).
**Priority:** Critical, High, Medium, Low.
**Queue:** BullMQ with retry policy.

---

# VOLUME V — DATABASE DESIGN & DATA DICTIONARY

## BAB 24 — Complete DDL (PostgreSQL 14+)

*(Terdapat pada src/db/schema.sql)*

## BAB 25 — Archival Strategy (Hot/Cold) & Migration Policy
1. Data > 1 tahun dipindah ke tabel cold (sales_orders_archived).

# VOLUME VI — GOVERNANCE, TESTING & EDGE CASES

## BAB 26 — Acceptance Test

### 26.1 Cashier (📦)
| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| CAS-T-001 | App-PIN Login | Redirect ke POS |
| CAS-T-002 | Open Bill + HPP Lock | HPP dikunci saat item ke dapur, bukan checkout |
| CAS-T-003 | Split Payment (Cash+QRIS) | Kedua payment tercatat, status PAID |
| CAS-T-004 | Rounding Adjustment | Selisih Rp0,01 otomatis ditambahkan |
| CAS-T-005 | Modifier Stock Validation | Error jika stok Extra Shot habis |
| CAS-T-006 | Diskon >20% tanpa Manager PIN | Status PENDING_AUTHORIZATION |
| CAS-T-007 | Blind Close Shift | Kasir input fisik, variance di backend |
| CAS-T-008 | OTP Reset Device | OTP 6 digit berlaku 5 menit, device key regenerated |

### 26.2 Business (💼)
| Test ID | Scenario | Expected Result |
|---------|----------|-----------------|
| BIZ-T-001 | Transfer dengan Landed Cost | AvgCost Penerima = ((Qty×Avg)+Landed)/Qty |
| BIZ-T-002 | Offline Sync melewati Lock Date | Tolak → masuk delayed_offline_sync_log |
| BIZ-T-003 | Stock Opname Surplus | Wajib input estimated_unit_cost, error jika 0 |
| BIZ-T-004 | Cost Recalculation dengan Lock Date | HPP terkoreksi, jika lock date → Adjustment Journal |
| BIZ-T-005 | Google Drive DLQ Persistence | Job gagal 3x → Redis DLQ → TTL 7 hari → persist ke failed_jobs |

---

## BAB 27 — Definition of Done (DoD — 36 Butir Eksplisit)

*(Refer ke aslinya)*

## BAB 31 — Build Order

1. **Foundation (1-4 minggu):** Google OAuth, App-PIN, Tenant/Outlet, RLS+Composite+Soft Delete.
2. **Cashier MVP (5-8):** POS, Open Bill, Split Payment, Modifiers, Blind Close, OTP Reset, Diskon Otorisasi Manager.
3. **Business Core (9-16):** Average, Direct HPP, Cost Recalc (Lock Date), Transfer + Landed Cost, Contra-Journal, Offline Guardian, Queue Infrastructure (BullMQ+DLQ+TTL).
4. **Network (17-24):** QR Menu (per Outlet/Meja), Supply Network, Migration.
5. **BI (25-30):** KPI, Dashboard, Archival Cron, Subscription SLA, Notification Engine.

---

# APPENDIX

## APP A — API Summary & Error Code Registry

**Error Code Registry (Partial)**

| Kode Error | HTTP Status | Deskripsi |
|------------|-------------|-----------|
| `LL-AUTH-1001` | 401 | Token expired |
| `LL-POS-1001` | 400 | Diskon >20% memerlukan otorisasi Manager |
| `LL-INV-2001` | 400 | Stok Modifier tidak mencukupi |
| `LL-FIN-4001` | 409 | Transaksi offline melewati Accounting Lock Date |
| `LL-TRF-5001` | 403 | Transfer tidak tersedia untuk paket CASHIER |
| `LL-SYS-9001` | 500 | Internal server error |

---

## APP B — Penutup & Final Approval

**Dokumen ini adalah kontrak final dan absolut.**
