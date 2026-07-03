# Multi-Stage-Build für die Marketing-Website (Next.js 15, App Router).
# Eigenes Dockerfile statt Nixpacks — reproduzierbar, mit Standalone-Output +
# HEALTHCHECK (konsistent zu apps/web). Paketmanager: npm (package-lock.json).
# Build-Context ist marketing/ (Coolify base_directory).

# ---------------------------------------------------------------------------
# 1) Dependencies — reproduzierbar aus dem Lockfile (npm ci = frozen).
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# 2) Build — Next.js produziert den standalone-Output.
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# devDependencies werden für den Build gebraucht (typescript, tailwind …).
ENV NODE_ENV=production
RUN npm run build

# ---------------------------------------------------------------------------
# 3) Runtime — schlank: nur der standalone-Server + statische Assets.
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# WICHTIG: Next.js-Standalone (server.js) bindet ohne HOSTNAME an den
# Container-Hostnamen → Traefik/Healthcheck erreichen es nicht (502, Deploy-Fail).
# 0.0.0.0 erzwingt Bind auf alle Interfaces, damit /healthz auf localhost antwortet.
ENV HOSTNAME=0.0.0.0
# Nicht als root laufen.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# Readiness-Signal für Coolify/Traefik: erst nach „healthy" wird der Traffic
# umgeschaltet → kein 502-Fenster beim Deploy. Node 22 hat globales fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
