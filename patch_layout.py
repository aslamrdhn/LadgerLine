with open("src/layouts/MainLayout.tsx", "r") as f:
    text = f.read()

bad = """{ id: 'tab-pengaturan', tab: 'pengaturan', name: 'Profil & Pengaturan', icon: Building2 },"""
good = """{ id: 'tab-auditor', tab: 'auditor', name: 'Business Auditor', icon: FileBarChart2 },
        { id: 'tab-paket', tab: 'paket', name: 'Langganan & Lisensi', icon: Coins },
        { id: 'tab-migrasi', tab: 'migrasi', name: 'Pusat Migrasi', icon: Network },
        { id: 'tab-pengaturan', tab: 'pengaturan', name: 'Profil & Pengaturan', icon: Building2 },"""
text = text.replace(bad, good)

bad_filter = """return ['dashboard', 'laporan', 'stok', 'suplierhub', 'intelligence', 'pengaturan'].includes(tab as string);"""
good_filter = """return ['dashboard', 'laporan', 'stok', 'suplierhub', 'intelligence', 'auditor', 'paket', 'migrasi', 'pengaturan'].includes(tab as string);"""
text = text.replace(bad_filter, good_filter)

with open("src/layouts/MainLayout.tsx", "w") as f:
    f.write(text)

