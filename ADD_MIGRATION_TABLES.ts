import fs from 'fs';
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');

const migrationModels = `
model MigrationJob {
  id             String   @id @default(uuid()) @db.VarChar(50)
  tenantId       String   @map("tenant_id") @db.VarChar(50)
  status         String   @default("PREVIEW") @db.VarChar(20) // PREVIEW, IMPORTED, ROLLED_BACK, FAILED
  previewData    Json?    @map("preview_data")
  errorData      Json?    @map("error_data")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  logs           MigrationLog[]
  errors         MigrationError[]

  @@index([tenantId])
  @@map("migration_jobs")
}

model MigrationLog {
  id             String   @id @default(uuid()) @db.VarChar(50)
  jobId          String   @map("job_id") @db.VarChar(50)
  action         String   @db.VarChar(50)
  details        String?  @db.Text
  createdAt      DateTime @default(now()) @map("created_at")

  job            MigrationJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@map("migration_logs")
}

model MigrationError {
  id             String   @id @default(uuid()) @db.VarChar(50)
  jobId          String   @map("job_id") @db.VarChar(50)
  rowNumber      Int?     @map("row_number")
  errorMessage   String   @map("error_message") @db.Text
  createdAt      DateTime @default(now()) @map("created_at")

  job            MigrationJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@map("migration_errors")
}
`;

content = content.replace('model AuditLog {', migrationModels + '\nmodel AuditLog {');
content = content.replace(/migrationTickets\\s+MigrationTicket\\[\\]/, 'migrationTickets                 MigrationTicket[]\n  migrationJobs                    MigrationJob[]');

fs.writeFileSync('prisma/schema.prisma', content);
