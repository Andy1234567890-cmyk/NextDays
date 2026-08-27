# Multi-Stage-Build für die Marketing-Website (Next.js 15, App Router).
# Isolierter Build (Coolify base_directory = /marketing): marketing nutzt KEINE
# geteilten Workspace-Packages (@nextdays/*) → kein Root-Kontext nötig.
# Paketmanager: bun (bun.lock) — vereinheitlicht auf bun (ADR-0016). Runtime: Node.

# ---------------------------------------------------------------------------
# 1) Dependencies — reproduzierbar aus dem Lockfile (frozen).
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2) Build — Next.js produziert den standalone-Output.
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# `NEXT_PUBLIC_*` wird beim BAUEN in das Bundle eingesetzt, nicht zur Laufzeit
# gelesen. Ohne diese ARGs bliebe ein in Coolify gesetzter Wert im Image leer —
# der Dienst wäre still aus, und niemand würde es merken (Wurzel 5). Coolify
# übergibt Variablen mit dem Präfix automatisch als Build-Argument.
#
# Beide sind OPTIONAL und ohne Vorgabewert: fehlt sie, ist die Zeichenkette
# leer, und der jeweilige Dienst lädt nicht (lib/config.ts, lib/analytics.ts).
# Kein erfundener Platzhalter (Wurzel 4).
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ENV NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
RUN bun run build

# ---------------------------------------------------------------------------
# 3) Runtime — schlank: nur der standalone-Server + statische Assets.
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
