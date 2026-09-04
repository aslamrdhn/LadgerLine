CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.tenant_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.tenant_id', TRUE)::text;
$$;

ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_items ON "Item";
CREATE POLICY tenant_isolation_items ON "Item"
  FOR ALL USING ("tenantId" = app.tenant_id());

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tenants ON "Tenant";
CREATE POLICY tenant_isolation_tenants ON "Tenant"
  FOR ALL USING (id = app.tenant_id());

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_accounts ON "Account";
CREATE POLICY tenant_isolation_accounts ON "Account"
  FOR ALL USING ("tenantId" IS NULL OR "tenantId" = app.tenant_id());

ALTER TABLE "AccountingPeriod" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_accounting_periods ON "AccountingPeriod";
CREATE POLICY tenant_isolation_accounting_periods ON "AccountingPeriod"
  FOR ALL USING ("tenantId" = app.tenant_id());

ALTER TABLE "NumberSequence" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_number_sequences ON "NumberSequence";
CREATE POLICY tenant_isolation_number_sequences ON "NumberSequence"
  FOR ALL USING ("tenantId" = app.tenant_id());

ALTER TABLE "NumberStatus" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_number_status ON "NumberStatus";
CREATE POLICY tenant_isolation_number_status ON "NumberStatus"
  FOR ALL USING ("tenantId" = app.tenant_id());
