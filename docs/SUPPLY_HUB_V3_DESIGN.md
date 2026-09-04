# LedgerLine Supply Hub V3 - Product Requirement & Engineering Design

## STEP 1: Audit Existing Code & Architecture

### Existing Architecture Observation:
- The current implementation of `Supplier` and `SupplierListing` behaves more like a generic marketplace (listings with prices, direct visibility).
- `PurchaseRequest` exists but lacks the strict status gating (PENDING → ACTIVE → SUSPENDED) designed for a "Curated" ecosystem.
- `SupplierShare` and `Wallet` concepts exist in schema but do not align with the V3 objective of a direct Request-Negotiate-Pay (off-platform P2P payment) flow.
- The UI exposes features unessential for procurement (e.g. generalized lists without smart recommendations, uncontrolled product listings).

### Issues to Resolve:
1. **Uncontrolled Supplier Listing**: Currently, suppliers can be added and list items without rigorous Super Admin gating (verification acts as a boolean, but product listing is free-for-all).
2. **Missing Subscription Gate**: There's no enforcement of Trial -> Active -> Expired subscription flow for suppliers, which is crucial for the "Curated" model.
3. **P2P Purity**: Supply Hub shouldn't handle payments or complex carts. It only acts as a discovery and PO generator.
4. **Roles**: We lack a dedicated `SUPPLIER_PARTNER` role interacting with a simplified Dashboard, completely isolated from Coffee Shop tenant data.

---

## STEP 2: Changes Required to Support Supply Hub V3

1. **Schema Refactoring**:
   - Refine `Supplier` entity to handle rigourous Verification Status (`STANDARD`, `VERIFIED`).
   - Create `SupplierSubscription` to accurately track trial and paid cycles (`TRIAL`, `ACTIVE`, `EXPIRED`, `SUSPENDED`).
   - Refine `SupplierProduct` (replacing/refining `SupplierListing`) to include a strict `approval_status` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`).
   - Adjust `PurchaseRequest` to enforce simple P2P negotiation without cart logic. LedgerLine just forwards the request.
2. **Access Control (RBAC) Expansion**:
   - Create Super Admin portal/routes for Supply Hub governance.
   - Create Supplier Partner portal/routes.
3. **Coffee Shop UI Restructuring**:
   - Remove "marketplace" elements (Cart, Checkout).
   - Introduce "Smart Procurement View": "Stock Milk will run out in 3 days -> Recommended Verified Supplier -> [Request Purchase]".

---

## STEP 3: Product Requirement Document (PRD)

### 1. Product Vision
LedgerLine Supply Hub V3 is a **Hybrid Curated Supply Hub**. It acts as a Procurement Assistant for Coffee Shops, preventing price wars and guaranteeing quality through heavy curation by LedgerLine Super Admins. It is not a free-for-all marketplace. LedgerLine acts purely as a discovery and request layer—transactions, deliveries, and negotiations occur directly between the Coffee Shop and the Supplier.

### 2. Core Flows
- **Smart Restock**: LedgerLine POS predicts raw material shortages and proactively suggests restocks from `VERIFIED` suppliers.
- **Supplier Registration**: Supplier registers -> Enters 30-day Free Trial -> Uploads Products -> Requires Super Admin Approval -> Products appear in Hub.
- **Purchase Request (PO)**: Coffee Shop sees product -> Clicks "Request Purchase" -> Supplier receives notification -> They negotiate via WhatsApp/Phone -> Supplier fulfills order -> Shop records inventory IN.

### 3. Business Model
- **Supplier Subscription**: Not for pure revenue, but as a friction mechanism to filter out low-quality suppliers.
- Free trial (30 Days), followed by Rp25.000/month listing fee.
- If expired, data is retained but hidden from the Coffee Shop facing Supply Hub.

---

## STEP 4: Database Design & RBAC Matrix

### Database Schema Target (Prisma-like Representation)

```prisma
model Supplier {
  id                  String   @id
  companyName         String   @map("company_name")
  ownerName           String   @map("owner_name")
  phone               String
  email               String   @unique
  address             String   @db.Text
  passwordHash        String
  status              String   @default("PENDING") // PENDING, ACTIVE, SUSPENDED
  verificationStatus  String   @default("STANDARD") // STANDARD, VERIFIED
  createdAt           DateTime @default(now())
  
  subscriptions       SupplierSubscription[]
  products            SupplierProduct[]
  purchaseRequests    PurchaseRequest[]
}

model SupplierSubscription {
  id              String   @id
  supplierId      String
  package         String   @default("TRIAL") // TRIAL, MONTHLY
  status          String   @default("TRIAL") // TRIAL, ACTIVE, EXPIRED, SUSPENDED
  startDate       DateTime
  endDate         DateTime
  paymentStatus   String   @default("UNPAID") // UNPAID, PAID
  
  supplier        Supplier @relation(fields: [supplierId], references: [id])
}

model SupplierProduct {
  id              String   @id
  supplierId      String
  productName     String   @map("product_name")
  category        String
  priceOffer      Int      @map("price_offer")
  unit            String
  photoUrl        String?  @map("photo_url")
  approvalStatus  String   @default("DRAFT") // DRAFT, SUBMITTED, APPROVED, REJECTED
  rejectionReason String?  @map("rejection_reason")
  createdAt       DateTime @default(now())

  supplier        Supplier @relation(fields: [supplierId], references: [id])
}

model PurchaseRequest {
  id              String   @id
  coffeeShopId    String   // Maps to Tenant.id
  supplierId      String
  productId       String   // Maps to SupplierProduct.id
  quantity        Int
  notes           String?
  status          String   @default("SENT") // SENT, READ, FULFILLED, CANCELLED
  createdAt       DateTime @default(now())
  
  // Relations to Tenant, Supplier, SupplierProduct omitted for brevity here
}
```

### RBAC Matrix

| Feature / Resource | SUPER ADMIN | SUPPLIER PARTNER | COFFEE SHOP USER |
| :--- | :---: | :---: | :---: |
| Supplier Verification | Can Edit (Approve/Reject/Verify) | Read-only Status | Cannot Access |
| Supplier Product Approval | Can Approve/Reject | Can Draft/Submit | Read-only (Approved only) |
| Supplier Subscriptions | Can Manage/Suspend | Can View/Pay | Cannot Access |
| Send Purchase Request | Cannot Access | Read Incoming Requests | Can Create / Send |
| Global Supply Hub Analytics | Can View | Cannot Access | Cannot Access |
| Inventory & POS Data | Cannot Access | Cannot Access | Full Access |

---

## STEP 5: User Flow

### 1. Super Admin Flow
1. Log in to Super Admin Portal.
2. View Dashboard: Pending Supplier Registrations, Pending Product Approvals.
3. Review Supplier X: Check validity -> Approve Registration (Becomes ACTIVE/TRIAL).
4. Review Product Y from Supplier X: Check price & quality -> Approve Product (Becomes APPROVED).
5. Mark Supplier X as `VERIFIED` to boost their ranking in the Coffee Shop Hub.

### 2. Supplier Partner Flow
1. Register -> Land on Supplier Dashboard.
2. See Subscription Status (e.g., "TRIAL: 29 Days Left").
3. Go to "My Products" -> Add New Product -> Submit for Approval (Status: SUBMITTED).
4. Wait for Super Admin approval.
5. Once Approved, check "Incoming Requests". Receive PO from Coffee Shop.
6. Click "Contact Coffee Shop" -> Opens WhatsApp. Fulfill offline.

### 3. Coffee Shop User Flow
1. Log in to LedgerLine Dashboard.
2. See System Alert: "⚠️ Stok Susu UHT akan habis dalam 3 hari."
3. Click alert -> Opens Supply Hub restricted view.
4. Sees Recommendation: "⭐ LedgerLine Verified Partner: PT Dairy Nusantara (Rp15.500/L)".
5. Inputs quantity required -> Clicks "Request Pembelian".
6. Request sent. LedgerLine flow ends here (Supplier will contact them).
7. When goods arrive, Coffee Shop manually enters "IN" transaction in Inventory module.

---

## REQUEST FOR APPROVAL

Please review the architectural changes, database modeling, and workflows above. 

**DO NOT PROCEED with code implementation until explicit approval is received for this design.**
