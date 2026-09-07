with open("server/routes/public.routes.ts", "r") as f:
    text = f.read()

text = text.replace("amount: 0\\n", "amount: '0'\\n")
text = text.replace("method: 'CASH' as any", "method: 'CASH'")

with open("server/routes/public.routes.ts", "w") as f:
    f.write(text)
