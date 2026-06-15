# ADR-0002: Marketing-Website von den Produkt-Apps entkoppeln

- Status: **akzeptiert**
- Datum: 2026-06-15

## Kontext

NextDays braucht eine öffentliche Marketing-/Landing-Website (Landing, Pricing,
About, Blog) zusätzlich zum eigentlichen Produkt (Vermieter-Dashboard + Buchungs-
portal unter `apps/web`, FastAPI-Backend unter `apps/api`).

Frage: Gehört die Marketing-Seite in den App-Verbund (`apps/`) oder wird sie
getrennt geführt?

## Entscheidung

Die Marketing-Website liegt in einem **eigenen Top-Level-Ordner `marketing/`**
außerhalb von `apps/` und ist vollständig entkoppelt:

- eigenes Next.js-Projekt mit eigener `package.json`,
- eigene CI/CD-Strecke und eigenes Vercel-Projekt/Domain,
- **keine** Laufzeit-Kopplung an FastAPI oder Supabase (rein statisch/SSG).

Geteilt werden darf höchstens Branding/Design-Tokens aus `packages/shared` —
nur zur Build-Zeit, ohne Laufzeit-Abhängigkeit.

## Optionen

### A) Innerhalb von `apps/` (z. B. `apps/marketing`)
- Pro: alles unter einem Build-Verbund.
- Contra: vermischt Vermarktung mit Produkt; Marketing-Deploys könnten das Produkt
  beeinflussen; gemeinsame Abhängigkeiten/Tooling-Kopplung.

### B) Eigener Top-Level-Ordner `marketing/` (gewählt)
- Pro: klare Trennung Vermarktung ↔ Produkt; unabhängige Release-Kadenz; kein
  Sicherheits-Surface zum PMS; maximale Performance/SEO ohne Produkt-Ballast.
- Contra: ein weiteres Deployment-Ziel; minimale Doppelung beim Tooling.

### C) Komplett eigenes Repository
- Pro: maximale Entkopplung.
- Contra: kein geteilter Code/Tokens, mehr Verwaltungsaufwand — für die aktuelle
  Solo-Phase überdimensioniert.

## Konsequenz

- `marketing/` als entkoppeltes Next.js-Projekt; getrennt deployt
  (`nextdays.com`), während das Produkt unter `app.nextdays.com` läuft.
- Marketing-Änderungen brechen nie das Produkt und umgekehrt.
- Bei Bedarf später nach Option C (eigenes Repo) verschiebbar, ohne das Produkt
  anzufassen.
