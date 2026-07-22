# Multi-Stage-Build für die myNextDays-Web-App (PMS-Dashboard, Next.js 15).
# ROOT-BUILD-KONTEXT (ADR-0016): Coolify base_directory = / (Repo-Root), damit
# die geteilten Workspace-Packages (packages/*) im Build sichtbar sind.
# Paketmanager: bun (Workspace). Runtime: node:22.16-slim + Chromium-Libs für
# PDF-Rendering. Muster server-verifiziert an gastgeber (ADR-0016 P6).

# ---------------------------------------------------------------------------
# 1) Build — Workspace installieren + Next.js standalone-Output (install+build
#    in EINEM Stage, s. ADR-0016: bun legt App-.bin unter web/node_modules/.bin
#    ab, nicht hoisted).
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /repo
RUN echo '{"name":"build","private":true,"workspaces":["web","packages/*"]}' > package.json
COPY web/package.json ./web/
COPY packages ./packages
RUN bun install
COPY web ./web
ENV NODE_ENV=production
WORKDIR /repo/web
RUN bun run build

# ---------------------------------------------------------------------------
# 2) Runtime — schlank: standalone-Server unter Node + Chromium-System-Libs.
#    KEIN Chromium-Download im Build (riss den Build mit exit 255 ab); der
#    Browser liegt im persistenten Volume PLAYWRIGHT_BROWSERS_PATH (Coolify).
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
# Workspace-standalone: standalone/web/server.js + standalone/node_modules +
# standalone/package.json → den KOMPLETTEN standalone-Ordner kopieren.
COPY --from=build --chown=nextjs:nodejs /repo/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/web/.next/static ./web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/web/public ./web/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "web/server.js"]
