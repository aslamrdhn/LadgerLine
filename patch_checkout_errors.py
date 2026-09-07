import re

with open("server/services/checkout.service.ts", "r") as f:
    text = f.read()

# Fix metadata objects -> JSON.stringify()
def replace_metadata(match):
    return "metadata: JSON.stringify(" + match.group(1) + ")"

text = re.sub(r'metadata:\s*(\{.*?\})', replace_metadata, text, flags=re.DOTALL)

with open("server/services/checkout.service.ts", "w") as f:
    f.write(text)
