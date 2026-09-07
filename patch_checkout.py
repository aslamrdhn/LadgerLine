with open("server/services/checkout.service.ts", "r") as f:
    text = f.read()

text = text.replace("responseBody: { id: sale.id, invoiceNumber },", "responseBody: JSON.stringify({ id: sale.id, invoiceNumber }),")
text = text.replace("responseBody: { error: 'SYS_001', message: error.message },", "responseBody: JSON.stringify({ error: 'SYS_001', message: error.message }),")

with open("server/services/checkout.service.ts", "w") as f:
    f.write(text)
