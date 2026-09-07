import re
import os

with open("server/routes/public.routes.ts", "r") as f:
    text = f.read()

text = text.replace("forceStock: false", "forceStock: false,\n          skipPeriodValidation: true,\n          useHistoricalPrices: false")
with open("server/routes/public.routes.ts", "w") as f:
    f.write(text)

with open("server/routes/supplier.routes.ts", "r") as f:
    text = f.read()

text = text.replace("isActive: 'active'", "status: 'active'")
text = text.replace("isActive: body.status", "status: body.status")
text = text.replace("isActive: status", "status: status")
text = text.replace("item.status", "item.isActive")
text = text.replace("isActive: 'available'", "isActive: True") # wait, boolean!

# Let's fix supplier.routes.ts manually because string replacements might break
