import re

with open("src/components/Cashier.tsx", "r") as f:
    text = f.read()

bad = """                const totalRowPrice = salePrice * item.quantity;"""
good = """                const discountedPrice = Math.max(0, salePrice - (item.discountAmount || 0));
                const totalRowPrice = discountedPrice * item.quantity;"""

text = text.replace(bad, good)

with open("src/components/Cashier.tsx", "w") as f:
    f.write(text)
