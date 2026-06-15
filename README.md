# NextDays

Weltweite Vacation-Rental-Plattform: PMS-Kern + Channel Manager + Direktbuchung
+ eigenes Buchungsportal. Faires Pricing (ein Preis, voller Funktionsumfang).

## Erste Schritte für Claude Code
1. **CLAUDE.md** lesen (stabile Grundlage: Stack, Architektur, Konventionen).
2. **NOTES.md** lesen (aktueller Stand + nächste Schritte).
3. Phase-0-Setup, dann `auth`-Slice als Referenz implementieren.

## Struktur
- `apps/web` — Next.js (Vermieter-Dashboard + öffentliches Portal), shadcn/ui, Tailwind v4, Iconify
- `apps/api` — FastAPI, Vertical Slices (12 Phase-1-Module)
- `packages/shared` — geteilte TS-Typen
- `docs/decisions` — ADRs
