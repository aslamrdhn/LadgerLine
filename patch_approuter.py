with open("src/app/AppRouter.tsx", "r") as f:
    text = f.read()

import_string = """
const SupplierPortal = React.lazy(() => import('../components/SupplierPortal'));
const DemandIntelligenceCenter = React.lazy(() => import('../components/DemandIntelligenceCenter'));
const MarketIntelligence = React.lazy(() => import('../components/MarketIntelligence'));
const BusinessAuditorUI = React.lazy(() => import('../components/BusinessAuditorUI'));
const SubscriptionPackages = React.lazy(() => import('../components/SubscriptionPackages'));
const SupplyHubAdmin = React.lazy(() => import('../components/SupplyHubAdmin'));
const TrueCostDashboard = React.lazy(() => import('../components/TrueCostDashboard'));
const MigrationCenter = React.lazy(() => import('../components/MigrationCenter'));
const AdminDashboard = React.lazy(() => import('../components/admin/AdminDashboard'));
"""

text = text.replace("""const SupplierPortal = React.lazy(() => import('../components/SupplierPortal'));
const DemandIntelligenceCenter = React.lazy(() => import('../components/DemandIntelligenceCenter'));
const MarketIntelligence = React.lazy(() => import('../components/MarketIntelligence'));
const AdminDashboard = React.lazy(() => import('../components/admin/AdminDashboard'));""", import_string.strip())

router_add = """      {activeTab === 'intelligence' && <DemandIntelligenceCenter />}
      {activeTab === 'auditor' && <BusinessAuditorUI />}
      {activeTab === 'paket' && <SubscriptionPackages />}
      {activeTab === 'migrasi' && <MigrationCenter />}
"""
text = text.replace("{activeTab === 'intelligence' && <DemandIntelligenceCenter />}", router_add.strip('\n'))

with open("src/app/AppRouter.tsx", "w") as f:
    f.write(text)
