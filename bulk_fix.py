import os
import re

def fix_file(path):
    if not os.path.exists(path): return
    with open(path, "r") as f:
        text = f.read()
    
    # Replace metadata: { ... } with metadata: JSON.stringify({ ... })
    text = re.sub(r'metadata:\s*(\{.*?\})', lambda m: "metadata: JSON.stringify(" + m.group(1) + ")", text, flags=re.DOTALL)
    
    with open(path, "w") as f:
        f.write(text)

files = [
    "server/services/kitchen.service.ts",
    "server/services/period.service.ts",
    "server/services/refund.service.ts",
    "server/services/shift.service.ts",
    "server/services/void.service.ts",
    "server/workers/dailyClosingWorker.ts",
    "server/workers/outboxWorker.ts",
    "server/services/checkout.service.ts"
]

for f in files:
    fix_file(f)

# Fix supplier routes email -> contactEmail
with open("server/routes/supplier.routes.ts", "r") as f:
    text = f.read()
text = text.replace("email: ", "contactEmail: ")
with open("server/routes/supplier.routes.ts", "w") as f:
    f.write(text)

# Fix public.routes.ts checkout payload
with open("server/routes/public.routes.ts", "r") as f:
    text = f.read()

bad_payload = """        tenantId: body.tenantId,
        outletId: body.outletId,
        cashierId: 'QR_MENU',
        rawItems: body.rawItems,
        paymentMethod: body.paymentMethod,
        paymentAmount: body.paymentAmount,
        customerName: body.customerName,
        tableName: body.tableName,
        orderType: body.orderType,
        note: body.note,"""

good_payload = """        tenantId: body.tenantId,
        outletId: body.outletId,
        cashierId: 'QR_MENU',
        items: body.rawItems.map((i: any) => ({
          menuId: i.menuId,
          quantity: i.quantity,
          discountAmount: 0
        })),
        payments: [{
          method: body.paymentMethod || 'CASH',
          amount: body.paymentAmount || 0
        }],
        note: body.note,"""

text = text.replace(bad_payload, good_payload)
with open("server/routes/public.routes.ts", "w") as f:
    f.write(text)

