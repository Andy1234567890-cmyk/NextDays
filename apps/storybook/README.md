# myNextDays — Design-System & Komponenten-Werkstatt (Storybook)

Eigenständige Design-Werkstatt (Storybook 8, react-vite, bun). Komponenten entstehen
**hier** als props-getriebene Bausteine ohne Server-/i18n-Abhängigkeiten; fertige
Komponenten werden anschließend nach `apps/web` übernommen (Fluss: Werkstatt → Web,
nie umgekehrt). Das Package importiert **nichts** aus `apps/web` — der Alias `@/`
zeigt auf dieses Verzeichnis.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `bun install` | Abhängigkeiten installieren (einmalig) |
| `bun run storybook` | **Werkstatt lokal** mit Hot-Reload → http://localhost:6006 (kein Login) |
| `bun run build-storybook` | statisches Storybook nach `protected/sb` bauen |
| `bun run dev` | nur der Next.js-Auth-Proxy → http://localhost:6007 (zeigt `/sb` erst nach `build-storybook`) |
| `bun run build` | Deploy-Build: Storybook + Next-Proxy (läuft im Dockerfile/Coolify) |
| `bun run typecheck` | `tsc --noEmit` |

**Hinweis Login (Port 6007):** Der Auth-Proxy schützt die deployte Version und prüft
gegen ein separates Supabase-Cloud-Projekt (`NEXT_PUBLIC_SUPABASE_URL` in `.env`) —
NICHT gegen die App-Datenbank. Zum lokalen Arbeiten immer Port 6006 nutzen.

## Struktur

- `.storybook/BUILD_REFERENCE.md` — **verbindliche Bau-Referenz** (Stil, Icons nur
  Iconify, Token-Klassen statt Hex, Titel-Hierarchie, echte Enum-Werte). Zuerst lesen.
- `components/ui/` — Primitive (shadcn-Stil) → Stories in `stories/ui/` (`UI-Bausteine/…`)
- `components/pms/` — fachliche PMS-Bausteine → `stories/pms/` (`PMS-Komponenten/…`)
- `components/builder/` — **Page-Builder-Nachbauten** (Editor-Toolbar, Seiten-Panel,
  Ebenen-Baum, Insert-Panel, Einfügen-Menü, Font-Picker, Zoom-Leiste) →
  `stories/builder/` (`Page-Builder/…`). Vorbild: `apps/web/components/website/editor/`,
  bewusst ohne craft.js/TipTap.
- `stories/*.mdx` — Doku-Seiten (`Einführung/…`, `Architektur/…`), Diagramme über
  `components/docs/mermaid.tsx`, zweisprachig über `<De>/<En>`.
- `app/`, `middleware.ts`, `lib/supabase-*` — nur der Auth-Proxy-Wrapper für den
  Online-Zugriff; kein Teil des Story-Baus.

## Deploy

Coolify-App `nextdays-storybook` (Watch-Path `apps/storybook/`), Multi-Stage-Dockerfile
mit bun: `bun run build` legt das statische Storybook in `protected/sb`, der Next-Proxy
liefert es hinter Login aus. Ein Fehler im Story-Bau lässt den Deploy fehlschlagen —
vor dem Push lokal `bun run typecheck && bun run build-storybook` laufen lassen.
