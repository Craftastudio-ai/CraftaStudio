# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# openssl is required by Prisma to run prisma generate
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy manifests + schema first so npm ci layer is cached when only src changes
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL deps (devDeps needed for TypeScript compilation)
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src/

# Build: runs "prisma generate && tsc -p tsconfig.json"
RUN npm run build


# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# openssl required by Prisma at runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy manifests + schema
COPY package*.json ./
COPY prisma ./prisma/

# Production deps only (no devDependencies)
RUN npm ci --omit=dev

# Generate Prisma client with correct Linux binary for this container OS
RUN npx prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]
