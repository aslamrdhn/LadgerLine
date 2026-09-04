FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY node-domexception-mock ./node-domexception-mock
# Install dependencies including devDependencies for build
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Vite frontend and TS Backend
RUN npm run build

# Production Image
FROM node:20-alpine
WORKDIR /app

# Copy package and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Setup environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start server
CMD ["npm", "run", "start"]
