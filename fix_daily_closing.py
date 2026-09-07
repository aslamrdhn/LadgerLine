with open("server/workers/dailyClosingWorker.ts", "r") as f:
    text = f.read()

bad = """        metadata: JSON.stringify({
          message: `Daily closing timeout waiting for FIFO jobs after ${MAX_WAIT_ATTEMPTS}) attempts`,
        },"""

good = """        metadata: JSON.stringify({
          message: `Daily closing timeout waiting for FIFO jobs after ${MAX_WAIT_ATTEMPTS}) attempts`,
        }),"""

text = text.replace(bad, good)

with open("server/workers/dailyClosingWorker.ts", "w") as f:
    f.write(text)
