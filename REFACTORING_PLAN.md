# REFACTORING_PLAN.md

## Project Phoenix - LedgerLine Enterprise Refactoring

### 1. Struktur Folder Baru

**Frontend (React 18 + Vite + Tailwind):**
```text
src/
├── features/         # Feature-based modules (DDD-lite untuk frontend)
│   ├── dashboard/    # Dashboard feature (DashboardPage, components)
│   ├── pos/          # Kasir feature
│   └── orders/       # Order management
├── layouts/          # Layout wrappers (MainLayout, AuthLayout)
├── routes/           # Konfigurasi React Router + Lazy Loading
├── hooks/            # Custom React Hooks reusable
├── utils/            # Helper functions
├── services/         # API client layer
└── App.tsx           # Hanya mounting RouterProvider & Context Provider
```

**Backend (Node.js + Express + Prisma):**
```text
server/
├── modules/          # Domain-Driven Design (DDD) lite
│   └── orders/       # Order domain
│       ├── order.controller.ts
│       ├── order.service.ts
│       ├── order.repository.ts
│       └── order.routes.ts
├── shared/           # Cross-cutting concerns
│   ├── database/     # Prisma & SQLite wrapper
│   ├── middleware/   # Auth, rate limits
│   └── utils/        # Logger, dll.
└── server.ts         # Inisialisasi Express & routing utama
```

### 2. Dependency Graph
- `Router` bergantung pada `Page Components` (di-load secara lazy).
- `Page Components` bergantung pada `Feature Components` & `Custom Hooks`.
- `Controllers` bergantung pada `Services`.
- `Services` (Business Logic) bergantung pada `Repositories` (Data Access Layer).
- `Repositories` menggunakan instance dari `Database Module`.

### 3. Urutan Pengerjaan
- **Fase 1 (Selesai di Iterasi 1):** Frontend Routing & Lazy Loading, Backend Modularization (Order Domain) & Database Injection, Docker & Compose setup.
- **Fase 2:** Security Hardening (JWT, Rate Limiting terpusat), Pagination, Error Handling terpadu, Refactoring modul Products dan Auth.
- **Fase 3:** Testing Suite (Unit, Integration) 90% coverage untuk semua layanan kritis, Frontend E2E (opsional).
- **Fase 4:** Optimasi Performa (Indeks DB, Redis cache di backend log) & API Documentation (Swagger).
