# Multi-Stage-Build für die myNextDays-Web-App (Next.js 15, App Router).
# Eigenes Dockerfile statt Nixpacks, weil Nixpacks die Node-Version nur per Major
# pinnen kann und für "22" nur 22.11 liefert — zu alt für pnpm 11.1.1 (>=22.13).
# Wir nutzen das offizielle, sicherheitsgepatchte node:22.16-slim und pnpm via
# corepack. Build-Context ist apps/web (Coolify base_directory).

# ---------------------------------------------------------------------------
# 1) Dependencies — reproduzierbar aus dem Lockfile (frozen).
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2) Build — Next.js produziert den standalone-Output.
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# devDependencies werden für den Build gebraucht (typescript, tailwind …).
ENV NODE_ENV=production
RUN pnpm build

# ---------------------------------------------------------------------------
# 3) Runtime — schlank: nur der standalone-Server + statische Assets.
#    KEIN Chromium-Download im Build: das 177-MB-Browser-Paket vom Playwright-CDN
#    riss den Build mit exit 255 ab (lief parallel zu `next build`). Stattdessen
#    nur die stabilen Chromium-System-Libs aus dem Debian-Mirror; der Browser
#    selbst liegt im persistenten Volume PLAYWRIGHT_BROWSERS_PATH (von Coolify
#    gemountet, einmal befüllt, übersteht Deploys).
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Next.js-standalone-server.js bindet ohne HOSTNAME an den Container-Hostnamen
# → Traefik/Healthcheck erreichen den Socket nicht → 502 nach jedem Deploy.
# 0.0.0.0 = alle Interfaces (identisch zu apps/storybook/Dockerfile).
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*
# Nicht als root laufen.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# Readiness-Signal für Coolify/Traefik: erst nach „healthy" wird der Traffic
# umgeschaltet → kein 502-Fenster beim Deploy. Node 22 hat globales fetch
# (kein curl nötig). /healthz ist auth-/DB-frei und liefert 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
