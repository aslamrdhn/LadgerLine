with open("server/workers/outboxWorker.ts", "r") as f:
    text = f.read()

text = text.replace("const allocations = (job.allocations as any[]) || [];", "const allocations = JSON.parse(job.allocations || '[]') as any[];")
text = text.replace("payload: {", "payload: JSON.stringify({")
text = text.replace("payload: JSON.stringify(JSON.stringify({", "payload: JSON.stringify({") # prevent double wrap

with open("server/workers/outboxWorker.ts", "w") as f:
    f.write(text)
