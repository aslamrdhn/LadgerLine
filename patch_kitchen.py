with open("server/services/kitchen.service.ts", "r") as f:
    text = f.read()

text = text.replace("const items = ((order.items as any[]) || []).map((i) => ({ ...i }));", "const items = (JSON.parse(order.items || '[]') as any[]).map((i) => ({ ...i }));")
text = text.replace("      items,\\n      version: { increment: 1 },", "      items: JSON.stringify(items),\\n      version: { increment: 1 },")

with open("server/services/kitchen.service.ts", "w") as f:
    f.write(text)
