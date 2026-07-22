# Multi-Stage-Build für die Plattform-App (Gast-Marktplatz, Next.js 15).
# ROOT-BUILD-KONTEXT (ADR-0016): Coolify base_directory = / (Repo-Root), damit
# die geteilten Workspace-Packages (packages/*) im Build sichtbar sind.
# Paketmanager: bun (Workspace). Runtime läuft unter Node (Standalone-Server).
# Muster server-verifiziert an gastgeber (ADR-0016 P6).

# ---------------------------------------------------------------------------
# 1) Build — Workspace installieren + Next.js standalone-Output (install+build
#    in EINEM Stage, s. ADR-0016: bun legt App-.bin unter plattform/node_modules/
#    .bin ab, nicht hoisted).
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /repo
RUN echo '{"name":"build","private":true,"workspaces":["plattform","packages/*"]}' > package.json
COPY plattform/package.json ./plattform/
COPY packages ./packages
RUN bun install
COPY plattform ./plattform
ENV NODE_ENV=production
# NEXT_PUBLIC_*-Variablen werden beim BUILD in den Client-Bundle eingebacken.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GASTGEBER_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_GASTGEBER_URL=$NEXT_PUBLIC_GASTGEBER_URL
WORKDIR /repo/plattform
RUN bun run build

# ---------------------------------------------------------------------------
# 2) Runtime — schlank: nur der standalone-Server unter Node + statische Assets.
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
# Workspace-standalone: standalone/plattform/server.js + standalone/node_modules
# + standalone/package.json → den KOMPLETTEN standalone-Ordner kopieren.
COPY --from=build --chown=nextjs:nodejs /repo/plattform/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/plattform/.next/static ./plattform/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/plattform/public ./plattform/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "plattform/server.js"]
