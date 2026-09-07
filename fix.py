with open("src/app/AppRouter.tsx", "r") as f:
    text = f.read()

text = text.replace("{activeTab === 'suplierhub' {activeTab === 'pengaturan' && ({activeTab === 'pengaturan' && ( <SupplierPortal onLogout={() => {}} />}", "{activeTab === 'suplierhub' && <SupplierPortal onLogout={() => {}} />}")
text = text.replace("{activeTab === 'intelligence' {activeTab === 'pengaturan' && ({activeTab === 'pengaturan' && ( <DemandIntelligenceCenter />}", "{activeTab === 'intelligence' && <DemandIntelligenceCenter />}")
text = text.replace("{activeTab === 'pengaturan' {activeTab === 'pengaturan' && ({activeTab === 'pengaturan' && ( (", "{activeTab === 'pengaturan' && (")

with open("src/app/AppRouter.tsx", "w") as f:
    f.write(text)
