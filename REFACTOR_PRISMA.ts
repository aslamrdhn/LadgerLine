import fs from 'fs';
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const snapshotModel = `
model InventoryCostSnapshot {
  id            String   @id @default(uuid()) @db.VarChar(50)
  tenantId      String   @map("tenant_id") @db.VarChar(50)
  date          DateTime @db.Date
  productId     String?  @map("product_id") @db.VarChar(50)
  materialId    String?  @map("material_id") @db.VarChar(50)
  averageCost   Int      @map("average_cost")
  createdAt     DateTime @default(now()) @map("created_at")

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([date])
  @@map("inventory_cost_snapshots")
}
`;

content = content.replace('model AuditLog {', snapshotModel + '\nmodel AuditLog {');

content = content.replace(
  '  costAtSale  Int      @map("cost_at_sale")',
  `  costAtSale  Int      @map("cost_at_sale")
  
  costSnapshotId     String?  @map("cost_snapshot_id") @db.VarChar(50)
  historicalUnitCost Int      @default(0) @map("historical_unit_cost")
  historicalHpp      Int      @default(0) @map("historical_hpp")
  historicalMargin   Int      @default(0) @map("historical_margin")`
);

content = content.replace(
  '  orderItems      OrderItem[]',
  `  orderItems      OrderItem[]`
);

content = content.replace(
  '  orders                           Order[]',
  `  orders                           Order[]
  costSnapshots                    InventoryCostSnapshot[]`
);

fs.writeFileSync('prisma/schema.prisma', content);
