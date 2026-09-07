import re

with open("server/services/checkout.service.ts", "r") as f:
    text = f.read()

text = text.replace("balance.currentStock < raw.quantity", "balance.currentStock < raw.quantity.toNumber()")
text = text.replace("currentStock: { decrement: raw.quantity },", "currentStock: { decrement: raw.quantity.toNumber() },")

with open("server/services/checkout.service.ts", "w") as f:
    f.write(text)
