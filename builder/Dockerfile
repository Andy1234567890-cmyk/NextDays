# Multi-Stage-Build für den Seiten-Renderer (Kunden-Websites, Next.js 15).
#
# ROOT-BUILD-KONTEXT (ADR-0016): Coolify `base_directory = /` (Repo-Wurzel),
# `dockerfile_location = /builder/Dockerfile` — genau wie web/, plattform/ und
# gastgeber/. Das ist keine Vorliebe, sondern Pflicht: `builder/package.json`
# führt `@nextdays/currency` und `@nextdays/security-headers` als
# `workspace:*`. Mit `builder/` als Kontext gibt es kein `packages/`, und
# `bun install` kann die beiden nicht auflösen.
#
# Vorher stand hier ein Kontext auf `builder/` mit
# `bun install --frozen-lockfile` gegen `builder/bun.lock`. Dieses Lockfile
# stammt aus der Zeit VOR dem Workspace-Umbau und enthält keinen einzigen
# `workspace:`-Eintrag — der Build wäre also nicht bloß fragil gewesen, sondern
# unmöglich. Dass es niemandem auffiel, hat einen Grund: es gab für diese App
# nie eine Coolify-Resource, und die CI prüft sie nur mit `bun run build` aus
# dem Repo-Kontext, wo die Pakete da sind.
#
# Paketmanager: bun (Workspace). Runtime: node:22.16-slim (Standalone-Server).

# ---------------------------------------------------------------------------
# 1) Build — Workspace installieren + Next.js standalone-Output.
#    install+build in EINEM Stage: bun legt die App-.bin unter
#    builder/node_modules/.bin ab, nicht hoisted (ADR-0016).
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /repo
# Eigene, minimale Workspace-Wurzel statt der echten package.json: so zieht
# `bun install` nur die zwei Pakete, die dieser Renderer braucht, und nicht die
# Abhängigkeiten aller sieben Frontends.
RUN echo '{"name":"build","private":true,"workspaces":["builder","packages/*"]}' > package.json
COPY builder/package.json ./builder/
COPY packages ./packages
RUN bun install
COPY builder ./builder
ENV NODE_ENV=production

# `DASHBOARD_ORIGIN` MUSS zur Build-Zeit da sein, obwohl es kein
# `NEXT_PUBLIC_`-Präfix trägt: `next.config.ts` liest es in `headers()`, und
# `next build` schreibt die Kopfzeilen fest in `.next/routes-manifest.json`.
# Ein Laufzeit-Eintrag in der Coolify-Env kommt dort nie an.
#
# Fehlt der Wert, steht `frame-ancestors 'none'` im Image — und dann bleibt die
# Entwurfs-Vorschau im Baukasten LEER, ohne jede Meldung. Sichtbar ist das nur
# als CSP-Zeile in der Browser-Konsole; von außen sieht die Seite aus, als lüde
# sie noch.
ARG DASHBOARD_ORIGIN
ENV DASHBOARD_ORIGIN=$DASHBOARD_ORIGIN

# Die Backend-Adresse lesen nur Server-Components und der `/api/v1`-Proxy, sie
# würde also zur Laufzeit genügen. Sie steht trotzdem hier, weil ihr Rückfall
# (`http://localhost:8000`) im Container ins Nichts zeigt: jede Kunden-Domain
# endet dann bei „nicht eingerichtet", ohne erkennbaren Grund.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

WORKDIR /repo/builder
RUN bun run build

# ---------------------------------------------------------------------------
# 2) Runtime — schlank: nur der standalone-Server unter Node + statische Assets.
# ---------------------------------------------------------------------------
FROM node:22.16-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Next-standalone bindet sonst nur an localhost → hinter Coolify/Traefik 502.
# HOSTNAME=0.0.0.0 ist Pflicht, damit der Container von außen erreichbar ist.
ENV HOSTNAME=0.0.0.0
# Nicht als root laufen.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
# Workspace-standalone: standalone/builder/server.js + standalone/node_modules
# + standalone/package.json → den KOMPLETTEN standalone-Ordner kopieren. Die
# Pfade sind deshalb um `builder/` tiefer als bei einem Einzel-Projekt — genau
# wie in web/Dockerfile.
COPY --from=build --chown=nextjs:nodejs /repo/builder/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/builder/.next/static ./builder/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/builder/public ./builder/public
USER nextjs
EXPOSE 3000
# Readiness-Signal für Coolify/Traefik: erst nach „healthy" wird der Traffic
# umgeschaltet → kein 502-Fenster beim Deploy. Node 22 hat globales fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "builder/server.js"]
