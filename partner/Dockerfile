# Multi-Stage-Build für das Partner-Dashboard des Affiliate-Programms (Next.js 15, App Router).
# ROOT-BUILD-KONTEXT (ADR-0016): Coolify base_directory = / (Repo-Root), damit
# die geteilten Workspace-Packages (packages/*) im Build sichtbar sind.
# Paketmanager: bun (Workspace). Runtime läuft unter Node (Standalone-Server).
# Server-verifiziert (docker build).

# ---------------------------------------------------------------------------
# 1) Build — Workspace installieren + Next.js standalone-Output erzeugen.
#    install + build in EINEM Stage: bun legt die App-Binaries unter
#    partner/node_modules/.bin ab (nicht hoisted) — ein getrennter deps-Stage,
#    der nur /repo/node_modules kopiert, verliert sie (→ "next: not found").
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /repo
# Minimale Root-package.json mit NUR den für diese App nötigen Workspace-Membern
# (die volle Root-package.json listet alle Frontends — die sind im App-Build-
# Kontext nicht mitkopiert, sonst bräche bun mit „Workspace not found").
RUN echo '{"name":"build","private":true,"workspaces":["partner","packages/*"]}' > package.json
COPY partner/package.json ./partner/
COPY packages ./packages
RUN bun install
COPY partner ./partner
ENV NODE_ENV=production
# NEXT_PUBLIC_*-Variablen werden beim BUILD in den Client-Bundle eingebacken.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /repo/partner
RUN bun run build

# ---------------------------------------------------------------------------
# 2) Runtime — schlank: nur der standalone-Server unter Node + statische Assets.
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Next.js-Standalone bindet ohne HOSTNAME an den Container-Hostnamen → Traefik/
# Healthcheck erreichen es nicht (502). 0.0.0.0 erzwingt Bind auf alle Interfaces.
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
# Workspace-standalone-Struktur: standalone/partner/server.js + standalone/
# node_modules + standalone/package.json → den KOMPLETTEN standalone-Ordner
# kopieren. static/public liegen relativ zum server.js unter partner/.
COPY --from=build --chown=nextjs:nodejs /repo/partner/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/partner/.next/static ./partner/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/partner/public ./partner/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/anmelden').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "partner/server.js"]
