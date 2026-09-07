with open("server/routes/public.routes.ts", "r") as f:
    text = f.read()

text = text.replace("method: 'CASH',\\n              amount: 0", "method: 'CASH' as const,\\n              amount: '0'")

with open("server/routes/public.routes.ts", "w") as f:
    f.write(text)
