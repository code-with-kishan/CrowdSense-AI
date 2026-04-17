# Use official Node.js LTS (Alpine for minimal image size)
FROM node:20-alpine AS base

LABEL maintainer="Kishan Nishad"
LABEL description="CrowdSense AI — AI-powered crowd management"
LABEL version="1.0.0"

# Security: run as non-root user
RUN addgroup -S stadium && adduser -S stadium -G stadium

WORKDIR /app

# ── Install dependencies ───────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Production image ───────────────────────────────────────────────────────────
FROM base AS runner

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove dev/test files from production image
RUN rm -rf tests/ .env.example .gitignore *.md

# Set ownership
RUN chown -R stadium:stadium /app

USER stadium

# Cloud Run expects PORT env var
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check (Cloud Run will use this)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/v1/health || exit 1

CMD ["node", "server.js"]
