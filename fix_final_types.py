import re

with open("server/services/checkout.service.ts", "r") as f:
    text = f.read()
text = re.sub(r'data:\s*\{\s*responseBody:\s*\{\s*error:(.*?)\}\s*\}', r'data: { responseBody: JSON.stringify({ error:\1}) }', text, flags=re.DOTALL)
with open("server/services/checkout.service.ts", "w") as f:
    f.write(text)

with open("server/services/kitchen.service.ts", "r") as f:
    text = f.read()
text = re.sub(r'items,\s*status: \'NEW\'', "items: JSON.stringify(items),\n      status: 'NEW'", text)
text = re.sub(r'items,\s*version: \{ increment: 1 \}', "items: JSON.stringify(items),\n      version: { increment: 1 }", text)
with open("server/services/kitchen.service.ts", "w") as f:
    f.write(text)

