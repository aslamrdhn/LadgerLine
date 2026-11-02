# Peningkatan Arsitektur Enterprise SaaS — LedgerLine Coffee & Roastery POS & ERP

Transformasi menyeluruh lapisan infrastruktur, penyimpanan klien, manajemen media, pembayaran QRIS dinamis, dan pencetakan perangkat keras agar aplikasi siap digunakan secara masal oleh banyak gerai tanpa mengubah identitas visual dan skema warna yang sudah ada.

---

## Keputusan Arsitektur yang Dikonfirmasi

> [!IMPORTANT]
> Seluruh keputusan di bawah ini telah diselaraskan dengan preferensi Anda pada tahap klarifikasi dan menjaga desain serta warna antarmuka tetap seperti semula.

- **Cakupan Peningkatan Arsitektur**: Menjalankan keempat pilar peningkatan sekaligus:
  1. Modularisasi *route* backend sesuai domain bisnis & optimasi kuota API.
  2. Migrasi penyimpanan lokal *browser* ke **IndexedDB** (bebas batas 5 MB `localStorage`) serta dukungan paginasi & filter tanggal untuk riwayat transaksi/jurnal.
  3. Endpoint unggah & kompresi gambar produk otomatis ke format **WebP** yang disajikan sebagai aset statis berkecepatan tinggi (bukan *string Base64* raksasa di dalam respons JSON).
  4. Integrasi alur **Dynamic QRIS Webhook** untuk pemesanan meja mandiri & kasir, ditambah dukungan cetak struk langsung ke **Thermal Printer Bluetooth/USB (ESC/POS)**.
- **Mesin Database & Konkurensi**: Tetap mandiri tanpa ketergantungan server luar dengan mengaktifkan **SQLite Write-Ahead Logging (`PRAGMA journal_mode = WAL`)**, `synchronous = NORMAL`, dan `busy_timeout = 10000` agar transaksi kasir paralel tidak mengalami *lock timeout*.
- **Kebijakan Keamanan & Autentikasi Multi-Tenant**: **Mode Hibrida Terproteksi** — memvalidasi tanda tangan kriptografis JWT dan kecocokan *tenant* secara ketat untuk akun produksi, sembari tetap mengizinkan *Demo Mode* terisolasi untuk eksplorasi instan.

---

## 1. Gambaran Umum & Nilai Utama

- **Apa yang Dilakukan**: Menghilangkan seluruh titik kemacetan (*bottleneck*) performa dan skala pada aplikasi POS & ERP sehingga ribuan transaksi, ratusan foto menu, dan pesanan QR meja pelanggan dapat diproses secara simultan dengan latensi rendah.
- **Target Pengguna**: Pemilik kedai kopi, *roastery*, kasir operasional harian, staf gudang, mitra pemasok B2B, serta pelanggan yang memesan mandiri dari meja.
- **Nilai Bisnis Utama**:
  - **Anti-Penuh di Browser Kasir**: Transisi dari `localStorage` ke `IndexedDB` memastikan tablet kasir tidak pernah gagal menyimpan pesanan meskipun sudah beroperasi berbulan-bulan.
  - **Katalog Cepat & Ringan**: Foto menu disimpan sebagai file gambar terkompresi di server, memangkas ukuran payload sinkronisasi hingga 90%.
  - **Pesanan QR Meja Anti-Order-Palsu**: Pelanggan di meja mendapatkan kode *Dynamic QRIS* dengan status pembayaran terverifikasi otomatis melalui *webhook* sebelum pesanan diproses dapur.
  - **Cetak Struk Instan**: Kasir dapat mencetak ke printer thermal 58mm/80mm via WebBluetooth/WebUSB (ESC/POS) maupun *fallback* cetak standar.

---

## 2. Pengalaman Pengguna & Desain Visual

- **Identitas Visual & Warna Tetap Dipertahankan**:
  - Seluruh tata letak, warna tema kopi hangat (`amber`/`stone`/`slate`), tipografi, dan navigasi yang sudah Anda sukai **tidak diubah**.
  - Angka keuangan, kuantitas stok, dan harga pada tabel tetap menggunakan perataan numerik presisi (`tabular-nums`).
- **Alur Interaksi Baru yang Halus**:
  - **Unggah Foto Menu (`AddProductModal`)**: Saat pengguna memilih foto dari perangkat, gambar otomatis dikompresi menjadi format WebP beresolusi optimal dan diunggah ke server sehingga tampil instan di Kasir, Inventori, dan QR Menu Pelanggan.
  - **Pembayaran Dynamic QRIS (Kasir & QR Meja)**: Menampilkan QRIS dinamis beserta nominal presisi, nomor referensi pembayaran, indikator status *waiting/paid*, dan tombol simulasi/verifikasi *webhook* instan untuk pengujian maupun produksi.
  - **Cetak Struk Thermal ESC/POS (`ReceiptModal`)**: Menyediakan tombol cetak langsung ke printer thermal Bluetooth/USB selain tombol cetak browser dan berbagi WhatsApp.
  - **Filter & Paginasi Riwayat**: Halaman Keuangan dan Riwayat Pesanan mendukung pemuatan bertahap (*paginated*) serta filter rentang tanggal tanpa membebani memori awal aplikasi.

---

## 3. Keputusan Produk & Pertimbangan Teknis (*Trade-Offs*)

- **Keputusan 1: SQLite dengan Optimasi PRAGMA WAL + Busy Timeout**
  - *Pendekatan*: Mengonfigurasi koneksi Prisma SQLite saat *startup* dengan `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 10000; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;`.
  - *Alasan*: Mode WAL memungkinkan pembacaan (*read*) dan penulisan (*write*) berjalan secara paralel tanpa saling memblokir, dan langsung berjalan di lingkungan saat ini tanpa konfigurasi database eksternal.
- **Keputusan 2: Penyimpanan Hibrida IndexedDB untuk State Offline-First**
  - *Pendekatan*: Membuat *custom storage engine* berbasis IndexedDB untuk Zustand (`aslam-pos-idb-storage`) dengan migrasi otomatis dari data `localStorage` lama.
  - *Alasan*: Menghindari error `QuotaExceededError` saat jumlah transaksi dan jurnal akuntansi tumbuh menjadi ribuan baris.
- **Keputusan 3: Pemisahan Domain Route Backend dari Monolitik**
  - *Pendekatan*: Memecah logika domain menjadi modul terpisah (Katalog & Inventori, QR Table & Public Order, Procurement & Supplier B2B, BI & True Cost Analytics, serta Superadmin SaaS) dengan tetap mempertahankan kompatibilitas 100% terhadap seluruh URL endpoint yang dipanggil frontend.
  - *Alasan*: Memudahkan pemeliharaan, audit keamanan per modul, dan pengembangan fitur baru tanpa risiko *regression bug*.

---

## 4. Arsitektur Teknis & Alur Data

### Diagram Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER (REACT + ZUSTAND)                     │
│                                                                              │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐  │
│  │  POS & QR Table UI  │  │  Inventory & Recipe  │  │  Finance, BI & B2B  │  │
│  │  + Dynamic QRIS     │  │  + WebP Image Upload │  │  + Paginated Ledger │  │
│  │  + ESC/POS Thermal  │  │  + Waste & Receiving │  │  + True Cost Engine │  │
│  └──────────┬──────────┘  └──────────┬───────────┘  └──────────┬──────────┘  │
│             └────────────────────────┼─────────────────────────┘             │
│                                      ▼                                       │
│             ┌────────────────────────────────────────────────┐               │
│             │   Zustand Store + IndexedDB Async Persistence  │               │
│             │   (Auto-Migrate from LocalStorage + Sync Queue)│               │
│             └────────────────────────┬───────────────────────┘               │
└──────────────────────────────────────┼───────────────────────────────────────┘
                                       │ HTTPS / REST API + X-Tenant-Id / JWT
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     FASTIFY ENTERPRISE GATEWAY (PORT 3000)                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Global Sanitizer Hook (XSS/Control Strip) + Hybrid Auth & Tenant Guard │  │
│  └───────────────────────────────────┬────────────────────────────────────┘  │
│                                      ▼                                       │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌───────────────┐  │
│  │ Catalog &      │ │ POS, Shift &   │ │ QR Table &     │ │ Finance, BI,  │  │
│  │ Media Upload   │ │ Kitchen Queue  │ │ Dynamic QRIS   │ │ Procurement & │  │
│  │ Domain Service │ │ Domain Service │ │ Webhook Engine │ │ Admin Service │  │
│  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘ └───────┬───────┘  │
│          └──────────────────┴────────┬─────────┴──────────────────┘          │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │        PRISMA ORM + SQLITE WAL ENGINE (journal_mode=WAL, 10s Lock)     │  │
│  │   [Menus & BOM]  [FIFO Layers & Stock]  [Double-Entry GL]  [Tenants]   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Pemetaan Komponen Interaktif & Alur Data

1. **Mesin Database SQLite WAL**:
   - Saat server menyala, koneksi Prisma mengeksekusi inisialisasi `WAL` mode, `busy_timeout`, dan indeks kueri sehingga transaksi kasir (`checkoutOrder`) yang memotong lapisan FIFO dan menulis jurnal akuntansi berlangsung cepat dan bebas konflik kunci.
2. **Layanan Unggah & Optimasi Gambar (`/api/media/upload`)**:
   - Menerima unggahan gambar dari modal tambah/edit menu, mengompresinya di sisi klien/server menjadi file WebP ringan yang disimpan di direktori aset publik server (`/uploads/menus/...`), dan mengembalikan URL bersih.
3. **Penyimpanan IndexedDB Frontend**:
   - Menggantikan *storage adapter* `localStorage` pada Zustand dengan `IndexedDB` yang secara otomatis memigrasikan data lama pengguna saat pertama kali dimuat, dilengkapi pembatasan ukuran *cache* aktif dan paginasi riwayat transaksi (`/api/orders/history?page=1&limit=50`).
4. **Dynamic QRIS & Webhook Pembayaran (`/api/payments/qris/*`)**:
   - Menghasilkan payload QRIS dinamis unik untuk setiap transaksi kasir atau pesanan meja pelanggan, menyediakan endpoint pengecekan status dan *webhook callback* (`/api/payments/qris/webhook`) yang otomatis mengonfirmasi pesanan dan mencatat jurnal kas/bank ketika pembayaran lunas.
5. **Pencetakan Struk Thermal ESC/POS**:
   - Utilitas pencetakan perangkat keras di sisi klien menggunakan WebBluetooth / WebUSB untuk mengirim byte perintah standar *ESC/POS* (header toko, rincian item, pajak, total, dan pemotongan kertas) langsung ke printer kasir, dengan *fallback* otomatis ke cetak struk layar standar bila perangkat tidak terhubung.
