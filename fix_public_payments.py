with open("server/routes/public.routes.ts", "r") as f:
    text = f.read()

text = text.replace("method: 'CASH',", "method: 'CASH' as any,")

with open("server/routes/public.routes.ts", "w") as f:
    f.write(text)
