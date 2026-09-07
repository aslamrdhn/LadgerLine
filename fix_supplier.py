with open("server/routes/supplier.routes.ts", "r") as f:
    text = f.read()

text = text.replace("isActive: 'pending_verification'", "status: 'pending_verification'")
text = text.replace("isActive: supplier.status", "status: supplier.status")
text = text.replace("isActive: po.status", "status: po.status")
text = text.replace("data: { isActive: newStatus }", "data: { status: newStatus }")
text = text.replace("isActive: c.status", "isActive: c.isActive")
text = text.replace("isActive: 'pending'", "isActive: false")

with open("server/routes/supplier.routes.ts", "w") as f:
    f.write(text)
