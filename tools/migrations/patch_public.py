import re
with open('server/routes/public.routes.ts', 'r') as f:
    text = f.read()

text = text.replace('''        payments: [
          {
            method: "CASH",
            amount: 0,
          },
        ],''', '''        payments: [
          {
            method: "CASH" as const,
            amount: "0",
          },
        ],''')

with open('server/routes/public.routes.ts', 'w') as f:
    f.write(text)
