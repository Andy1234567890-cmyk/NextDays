# ADR-0008: Storybook als Komponenten-Doku & Design-System-Brücke

- Status: **akzeptiert**
- Datum: 2026-06-16

## Kontext

Ein UX/UI-Designer kommt ins Projekt und muss verstehen, welche UI-Bausteine
existieren, wie sie aussehen (inkl. Zustände, Light/Dark) und wo er ansetzt. Die
UI ist komponentenschwer (Drag&Drop-Dashboard, Multi-Kalender, Rich-Text-Editor,
White-Label, einbettbares Buchungs-Widget). Reine Figma-Mockups reichen nicht —
es braucht eine lebende, code-nahe Komponenten-Doku.

## Entscheidung

**Storybook** ist ein **eigenständiges Package `apps/storybook`** — die Werkstatt
des UX/UI-Designers, getrennt vom Web-Projekt.

- **Trennung App ↔ Design-System:** UI-Komponenten entstehen in `apps/storybook`
  (eigene `package.json`, eigenes Vercel-Projekt). Eine fertige Komponente wird
  **erst dann** ins Web-Projekt `apps/web` übernommen. Das verhindert die
  Vermischung von App-Code mit noch in Entwicklung befindlichen Komponenten.
- Builder: **`@storybook/react-vite`** (stabil mit React 19; der
  Webpack/`@storybook/nextjs`-Builder scheiterte mit Next 15).
- **Light/Dark-Umschalter** in der Toolbar via `@storybook/addon-themes`
  (`.dark`-Klasse, identisch zur App).
- Stories laden die **echte `globals.css`** → Komponenten zeigen die echten
  Design-Tokens, nicht Kopien.
- **Design-Token-Übersicht** als eigene Story (`Design/Tokens`) — der Designer
  sieht die gesamte Marken-Palette auf einen Blick.
- Statisch baubar (`build-storybook`) → als URL deploybar, der Designer braucht
  kein lokales Dev-Setup.

## Tokens & Marke

- Einzige Quelle der Wahrheit: `apps/web/styles/globals.css` (`:root` + `.dark`).
- Startwerte aus dem offiziellen **NextDays-Logo** abgeleitet (Schwarz `#0a0a0a`
  als Primär, Logo-Rot `#b82028` als Akzent). **Vorläufig** — vom Designer
  jederzeit überschreibbar; Komponenten nutzen nur semantische Token-Namen
  (`bg-primary`, `text-accent`), keine festen Hex-Werte. Token-Änderung wirkt
  sofort systemweit ohne Komponenten-Umbau.

## Konsequenz

- `apps/web` enthält shadcn-Stil-Komponenten (CVA + Radix-Slot + `cn`), Icons via
  **Iconify** (kein lucide-react, PROJECT.md §2).
- Jede neue UI-Komponente bekommt eine `.stories.tsx`.
- **Addons** (kuratiert): `addon-docs` (MDX-Erklärseiten für Eigentümer +
  Autodocs), `addon-a11y` (WCAG-Barrierefreiheit), `addon-themes` (Light/Dark),
  `addon-designs@8.0.4` (Figma-Einbettung; v8-kompatibel, da v10+ Storybook 9
  voraussetzt). Chromatic/Visual-Tests bewusst später (kostenpflichtig).
- **Bibliothek:** 22 UI-Bausteine, 15 PMS-Komponenten (je mit Modul-/Tabellen-
  Bezug, inkl. Multi-Kalender §2.2), 7 nicht-technische Eigentümer-Doku-Seiten
  (`Einführung/…`), Design/Tokens. Bau-Standard fixiert in
  `.storybook/BUILD_REFERENCE.md` (Tokens, echte Enum-Werte, Stil).
- Tailwind-v4-Kurzsyntax kanonisch (`rounded-(--radius)`, `ring-ring`).
- Build/Dev verifiziert: `storybook build` erfolgreich, Dev-Server liefert HTTP 200.
- **Deployed auf Vercel** als eigenes Projekt `nextdays-storybook` (Monorepo,
  Root `apps/storybook`). URL: **https://nextdays-storybook.vercel.app** — der
  Designer braucht kein lokales Setup. (Zugangsschutz + Build-Befehl siehe
  Nachtrag unten.)

## Nachtrag (Zugangsschutz, Admin, Chat)

Nach der ersten Veröffentlichung kamen drei Anforderungen dazu — umgesetzt im
selben Package `apps/storybook`:

- **Login vor dem Storybook (zwingend).** Das Storybook enthält die gesamte
  Produktidee und sensible Daten und darf nicht öffentlich sein. Statt des
  statischen Deployments liegt jetzt eine **Next.js-Auth-Hülle** davor:
  `middleware.ts` verlangt serverseitig eine Supabase-Session; das Storybook
  wird nach `protected/sb/` gebaut (nicht in `public/`) und nur über den
  Catch-all `/sb/[[...path]]` mit gültiger Session ausgeliefert. Build-Befehl
  daher nicht mehr `build-storybook`, sondern `bun run build`
  (`storybook build -o protected/sb && next build`); Framework auf Vercel =
  Next.js.
- **Admin-Bereich** (`/admin` → `/api/users`): Nutzer per E-Mail anlegen mit
  Sofort-Passwort. Service-Role-Key bleibt **serverseitig**, nur Admins
  (`STORYBOOK_ADMIN_EMAILS`). Kein Self-Signup.
- **Echtzeit-Team-Chat** (`Austausch/`): Supabase Realtime (Tabelle
  `storybook_chat`, Migration `0020`). Nutzt die Login-Session; Name kommt
  automatisch aus dem Account.

Details: [ARCHITECTURE.md §11](../ARCHITECTURE.md) („Zugangsschutz: Auth-Proxy"
+ „Echtzeit-Austausch").
