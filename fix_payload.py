import re
import os

files = [
    "server/services/checkout.service.ts",
    "server/services/kitchen.service.ts",
    "server/services/void.service.ts",
    "server/workers/dailyClosingWorker.ts",
    "server/workers/outboxWorker.ts"
]

for path in files:
    if not os.path.exists(path): continue
    with open(path, "r") as f:
        text = f.read()
    
    # payload: { ... }
    text = re.sub(r'payload:\s*(\{.*?\})', lambda m: "payload: JSON.stringify(" + m.group(1) + ")", text, flags=re.DOTALL)
    
    # items: [ ... ] -> JSON.stringify? Wait! For KitchenOrder in kitchen.service.ts
    # Let's see what KitchenOrder items is.
    with open(path, "w") as f:
        f.write(text)

with open("server/services/kitchen.service.ts", "r") as f:
    text = f.read()

text = text.replace("items,\\n      status: 'NEW'", "items: JSON.stringify(items),\\n      status: 'NEW'")
text = text.replace("payload: items,", "payload: JSON.stringify(items),")

with open("server/services/kitchen.service.ts", "w") as f:
    f.write(text)
