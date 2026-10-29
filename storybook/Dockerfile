# Multi-Stage-Build für die Storybook-Auth-Proxy-App (Next.js 15, App Router).
# Eigenes Dockerfile statt Nixpacks — reproduzierbar, mit Standalone-Output +
# HEALTHCHECK (konsistent zu apps/web). Paketmanager: bun (bun.lock).
# Sonder-Build: `storybook build -o protected/sb && next build` erzeugt das
# statische Storybook unter protected/sb; die geschützte Route /sb liefert es aus.
# Build-Context ist apps/storybook/ (Coolify base_directory).

# ---------------------------------------------------------------------------
# 1) Dependencies — reproduzierbar aus dem Lockfile (frozen).
# ---------------------------------------------------------------------------
FROM oven/bun:1@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2) Build — Storybook-Static (protected/sb) + Next.js standalone-Output.
# ---------------------------------------------------------------------------
FROM oven/bun:1@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# devDependencies werden für den Build gebraucht (storybook, typescript …).
ENV NODE_ENV=production
RUN bun run build

# ---------------------------------------------------------------------------
# 3) Runtime — schlank: standalone-Server unter Node + statische Assets +
#    das gebaute Storybook (protected/). Standalone-Tracing nimmt fremde Ordner
#    nicht zuverlässig mit → protected/ explizit kopieren.
# ---------------------------------------------------------------------------
FROM node:26.11-slim@sha256:193fe51b64e77981119c98c2002c9e32a70e2f006fb4d25068ce0558998917f0 AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Next.js-standalone bindet sonst an den Container-Hostnamen → localhost-
# Healthcheck schlägt fehl + Traefik-502 (gleicher Fix wie apps/web, 2faee7d).
ENV HOSTNAME=0.0.0.0
# Nicht als root laufen.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# Geschütztes, gebautes Storybook (wird von der /sb-Route ausgeliefert).
COPY --from=build --chown=nextjs:nodejs /app/protected ./protected
USER nextjs
EXPOSE 3000
# Readiness-Signal für Coolify/Traefik: erst nach „healthy" wird der Traffic
# umgeschaltet → kein 502-Fenster beim Deploy. Node 22 hat globales fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
