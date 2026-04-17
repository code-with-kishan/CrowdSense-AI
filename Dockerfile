# Use official Node.js LTS (Alpine for minimal image size)
FROM node:20-alpine AS build

LABEL maintainer="Kishan Nishad"
LABEL description="CrowdSense AI — AI-powered crowd management"
LABEL version="1.0.0"

WORKDIR /app

# Install root and client dependencies, then build the React client
COPY package*.json ./
RUN npm ci

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY . .
RUN npm run build

# ── Production image ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup -S stadium && adduser -S stadium -G stadium

WORKDIR /app

ENV PORT=8080
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/api ./api
COPY --from=build /app/config ./config
COPY --from=build /app/services ./services
COPY --from=build /app/utils ./utils
COPY --from=build /app/public ./public
COPY --from=build /app/client/dist ./client/dist

RUN chown -R stadium:stadium /app

USER stadium

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/v1/health || exit 1

CMD ["node", "server.js"]
