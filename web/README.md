# myNextDays — Web-Dashboard (apps/web)

Das PMS-Dashboard für Agenturen/Vermieter: Next.js 15 (App Router, TypeScript,
Tailwind v4), mehrsprachig über next-intl (24 Sprachkataloge in `messages/`).
Enthält u.a. Kalender, Reservierungen, Buchhaltung, Eigentümer, Channel-Manager,
Reisebüros und den **visuellen Website-Editor** (`/website`, craft.js — siehe
`docs/ARCHITECTURE.md` §12 und `docs/FRAMER-FEATURES.md`).

## Start

```bash
bun install
cp .env.example .env.local   # Werte eintragen (u.a. GOOGLE_FONTS_API_KEY für den Font-Picker)
bun run dev                  # http://localhost:3000
bun run typecheck            # tsc --noEmit (Gate vor jedem Push)
```

Das Backend (FastAPI, Port 8000) muss laufen; alle Fach-Aufrufe gehen über
Server-Actions in `lib/<domäne>.ts` an `/api/v1/…`.

## Konventionen (Kurzfassung)

- **Realtime-Pflicht:** jede Liste/Detail-Ansicht spiegelt Änderungen per WebSocket
  über `lib/use-realtime.ts` (dedizierter Client; `setAuth` VOR `subscribe`).
- Business-Logik liegt im FastAPI-Backend — hier nur schmale BFF-Routen
  (z.B. `app/api/google-fonts` als server-seitiger Google-Fonts-Proxy).
- `rem` statt `px`; keine arbitrary Hex-Farben; Buttons `rounded-full`;
  Währung immer aus den Daten (`formatCurrency`), nie hartkodiert.
- Neue UI-Bausteine entstehen zuerst in der Werkstatt `apps/storybook`
  (siehe deren README) und werden dann hierher übernommen.

## Wichtige Pfade

- `app/(dashboard)/` — alle Dashboard-Routen (Server Components laden Initialdaten)
- `app/(public)/agb` — öffentliche Agentur-AGB (24 Sprachen, Stripe-Klausel § 5)
- `components/website/editor/` — der Framer-artige Page-Builder-Editor
- `content/legal/agb/` — AGB-Texte pro Sprache (`de.ts` ist die Quellfassung;
  Änderungen zuerst dort, dann in allen 24 Sprachen nachziehen)
- `lib/` — Server-Actions, API-Client (`api.ts`), Realtime, Formatierung
- `messages/` — i18n-Kataloge (bei neuen UI-Texten alle 24 Sprachen pflegen)
