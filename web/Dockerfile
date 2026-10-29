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
FROM oven/bun:1@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
WORKDIR /repo
RUN echo '{"name":"build","private":true,"workspaces":["web","packages/*"]}' > package.json
COPY web/package.json ./web/
COPY packages ./packages
RUN bun install
COPY web ./web
ENV NODE_ENV=production

# NEXT_PUBLIC_*-Variablen werden beim BUILD in den Client-Bundle eingebacken —
# ein Laufzeit-Eintrag in der Coolify-Env erreicht sie NICHT. Dasselbe gilt für
# die `headers()`-Funktion in next.config.ts: `next build` schreibt sie in
# `.next/routes-manifest.json`, also ist auch die CSP zur Build-Zeit festgelegt.
#
# Dieser Block fehlte hier vollständig, während gastgeber/, admin/ und
# plattform/ ihn längst haben (ADR-0016 P6 nennt web ausdrücklich als offen).
# Die Folge war live nachweisbar und betraf nicht eine Variable, sondern die
# ganze Klasse: die CSP von app.mynextdays.com hatte kein `frame-src`
# (deshalb blieb die Baukasten-Vorschau „nicht eingerichtet"), und in keinem
# der 31 Client-Chunks stand ein Supabase-Host. Wer die Werte in Coolify
# einträgt, ohne dass sie hier als ARG stehen, ändert nichts — genau das ist
# die Falle, die dieser Kommentar verhindern soll.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
# Adresse des Seiten-Renderers (builder/). Ohne sie zeigt der Website-Baukasten
# „Vorschau nicht eingerichtet" UND die CSP lässt `frame-src` weg — der iframe
# wäre dann auch mit richtiger Adresse von `default-src 'self'` blockiert.
ARG NEXT_PUBLIC_BUILDER_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_BUILDER_URL=$NEXT_PUBLIC_BUILDER_URL
WORKDIR /repo/web
RUN bun run build

# ---------------------------------------------------------------------------
# 2) Runtime — schlank: standalone-Server unter Node + Chromium-System-Libs.
#    KEIN Chromium-Download im Build (riss den Build mit exit 255 ab); der
#    Browser liegt im persistenten Volume PLAYWRIGHT_BROWSERS_PATH (Coolify).
# ---------------------------------------------------------------------------
FROM node:22.16-slim@sha256:048ed02c5fd52e86fda6fbd2f6a76cf0d4492fd6c6fee9e2c463ed5108da0e34 AS run
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
