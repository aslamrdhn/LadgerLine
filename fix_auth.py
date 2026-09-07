with open("server/middlewares/auth.ts", "r") as f:
    text = f.read()

text = text.replace("request.user.assignedOutlets = (userProfile.assignedOutlets as string[]) || [];", "request.user.assignedOutlets = userProfile.assignedOutlets ? JSON.parse(userProfile.assignedOutlets) : [];")

with open("server/middlewares/auth.ts", "w") as f:
    f.write(text)
