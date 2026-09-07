with open("src/layouts/MainLayout.tsx", "r") as f:
    text = f.read()

bad_string = "{ id: 'tab-pengaturan', tab: 'pengaturan', name: 'Profil { id: 'tab-pengaturan', tab: 'pengaturan', name: 'Profil & Pengaturan', icon: Building2 }, Pengaturan', icon: Building2 },"
good_string = "{ id: 'tab-pengaturan', tab: 'pengaturan', name: 'Profil & Pengaturan', icon: Building2 },"

text = text.replace(bad_string, good_string)

with open("src/layouts/MainLayout.tsx", "w") as f:
    f.write(text)
