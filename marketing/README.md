# marketing/ — Öffentliche Marketing-Website

Die öffentliche Vermarktungs-Website von myNextDays (Landingpage + Rechtsdokumente).

> **Bewusst entkoppelt:** Dieser Ordner liegt **außerhalb von `apps/`** und ist ein
> eigenständiges Projekt mit eigenem Deployment. Begründung:
> [ADR-0002](../docs/decisions/0002-marketing-website-entkopplung.md). Der Build
> ist isoliert (eigene `bun.lock`, eigener Dockerfile, ADR-0016) und nutzt daher
> **keine** `@nextdays/*`-Packages.

## Abgrenzung

| | Marketing-Website (`marketing/`) | Produkt (`apps/web`) |
|---|---|---|
| Zweck | Vermarktung, SEO, Lead-Gewinnung | eingeloggtes PMS-Dashboard + Portal |
| Domain | `mynextdays.com` | `app.mynextdays.com` |
| Backend-Kopplung | **keine** | FastAPI + Supabase |
| Auth | keine (Login verlinkt in `apps/web`) | Supabase Auth |

## Stack

- **Next.js 15** (App Router, TypeScript), `output: "standalone"`.
- **Tailwind v4** ohne `tailwind.config.ts` — alle Tokens in `app/globals.css`.
- **next-intl** ohne URL-Präfix: die Sprache kommt aus dem `nd_locale`-Cookie
  (`i18n/request.ts`), Texte aus `messages/de.json` und `messages/en.json`.
- **Schriften lokal** (`fonts/`, per `next/font/local`): Inter für Text,
  Fraunces für Display. Kein Google-CDN.
- **Icons lokal** (siehe unten). Kein Laufzeit-Request an Dritte.
- CSP/Security-Header inline in `next.config.ts`.
- **Support-Chat** (`components/support-chat.tsx`): einzige Backend-Anbindung
  der App — siehe unten.

## Struktur

```
marketing/
├── app/
│   ├── page.tsx                  # Landingpage (Sektionsreihenfolge)
│   ├── layout.tsx                # Schriften, next-intl-Provider, Metadata
│   ├── globals.css               # EINZIGE Quelle für Farben/Tokens
│   ├── impressum|datenschutz|cookie-richtlinie|auftragsverarbeitung/
│   └── healthz/
├── components/
│   ├── marketing/                # die Sektionen der Landingpage
│   ├── legal/                    # Renderer der Rechtsdokumente
│   └── ui/                       # Button, Card, Input, Label, Icon
├── content/legal/                # Registry + Inhalte der Rechtsdokumente
├── messages/                     # de.json, en.json
└── scripts/generate-icon-set.mjs # Icon-Codegen
```

## Landingpage — Sektionen

Reihenfolge und UI-Rhythmus wurden am 30.07.2026 nach Auswertung von
`hostaway.com` festgelegt (direkter Wettbewerber, dort UX-Referenz für Aufbau,
Eyebrow-Struktur, Farbwechsel und Wellenübergänge). Übernommen ist die
**Anordnung**, nicht das Aussehen: Farben (Schwarz/Rot), Pill-Buttons und
Fraunces bleiben myNextDays.

| Reihenfolge | Komponente | Fläche |
|---|---|---|
| 1 | `marketing-nav` (eine Zeile: Logo, Menü, Sprache/Login/CTA) | hell |
| 2 | `marketing-hero` (Text links, `product-mockup` rechts) | warm → hell |
| 3 | `marketing-channels` (Logo-Raster, Anker `#kanaele`) | hell |
| 4 | `marketing-benefits` (3 Illustrationen + Preis-Teaser `#preise`) | warm |
| 5 | `marketing-intro` (Text + Belege, Zielgruppen) | hell |
| 6 | `marketing-features` (14 Tabs als 7×2-Raster, Anker `#funktionen`) | hell |
| 7 | `marketing-integrations` (Text + `channel-orbit`) | hell |
| 8 | `marketing-stats` (5 Zahlen-Kacheln) | hell |
| 9 | `marketing-usecases` (3 Foto-Karten Betriebsarten) | warm |
| 10 | `marketing-testimonials` (Gründerin-Zitat, `#kunden`) | warm |
| 11 | `marketing-trial` (Formular, `#testen`) | hell |
| 12 | `marketing-cta` (Abschluss-CTA) | warm |
| 13 | `marketing-footer` (`#ressourcen`) | schwarz |

Die beiden Kanal-Sektionen haben getrennte Aufgaben: das flache Raster (3)
zeigt direkt unter dem Hero, **welche** großen Portale dabei sind; der Orbit (7)
erklärt die **Reichweite** (56 Plattformen, Zwei-Wege-Sync, eigener Vertrieb).
`channel-orbit.tsx` positioniert die Logo-Kreise über feste Winkel auf zwei
Bahnen — Ringe, Punkte und der radiale Schein liegen in einem SVG, dessen
Deckkraft über Attribute gesetzt wird (Tailwind-Arbitrary-Opacity kompiliert in
v4 unzuverlässig). Es werden **nur echte Markenlogos** aus
`public/marketing/channels/` verwendet, kein Platzhalter-Icon.

Gemeinsame Bausteine in `components/marketing/section-kit.tsx`:
`SectionHeading` (Eyebrow → Überschrift → Unterzeile) und `SectionWave`.
Die Nutzen-Illustrationen liegen in `components/marketing/illustrations.tsx`
(eigene Zeichnungen, keine Stock-Assets).

Sektion 9 steht dort, wo die Referenz ein Kundenstimmen-Karussell hat. Die Form
ist übernommen, der Inhalt nicht: ohne Kunden gäbe es nur erfundene Stimmen —
stattdessen die drei Betriebsarten (Ferienunterkunft, Hotel, Agentur) mit dem,
was die Plattform dort konkret übernimmt.

### Inhaltliche Leitlinie

Das Produkt startet am **01.09.2026**. Auf der Seite stehen deshalb **nur
belegbare Aussagen** — keine Bewertungssterne, keine Kundenzahlen, keine
Kundenstimmen, keine Award-Badges, keine ROI-/Zeitersparnis-Kennzahlen.
Belegbar sind: 27 europäische Länder, 24 Sprachen, 56 Buchungsplattformen über
Channex, EU-Hosting/DSGVO, „von Vermietern entwickelt",
Preis 19,90 €/Monat. Funktionen, die zum Launch fehlen (Metasuche), tragen ein
„Kommt 2027"-Badge; Zusatzmodule sind als solche gekennzeichnet.

## Icons

`@iconify/react` würde die Icon-Daten zur **Laufzeit** von `api.iconify.design`
holen — ein Drittanbieter-Request (denselben vermeidet diese App bei den
Schriften) und Icons, die erst nach der Hydration erscheinen. Stattdessen:

1. `components/ui/icon-set.ts` wird von `scripts/generate-icon-set.mjs` aus dem
   versionierten Paket `@iconify-json/ph` erzeugt und enthält **nur** die in
   `components/` und `app/` verwendeten Pfade.
2. `components/ui/icon.tsx` rendert daraus serverseitiges Inline-SVG.

Neues Icon verwenden → `icon="ph:<name>"` schreiben, dann `bun run icons`.
Fehlt der Name im Paket, bricht das Skript ab (kein stilles Leer-Icon).

## Support-Chat

Die Blase unten rechts spricht mit `/api/v1/support/public/*` (Migration `0238`).
Ein Besucher hat kein Konto: Er hinterlässt Name, E-Mail und optional Telefon,
die Anfrage IST das Ticket (`source='web'`), und das Backoffice antwortet in
derselben Konversation (`/admin` → Support, Kanal „Website").

- Der Aufruf geht **direkt** an die API (`lib/config.ts`), nicht über eine
  Next-Proxy-Route — sonst sähe das IP-Rate-Limit der API die Server-IP dieser
  App statt der Besucher-IP. Dafür muss die Marketing-Domain in `CORS_ORIGINS`
  der API stehen und ihre Origin in `connect-src` (setzt `next.config.ts` aus
  `NEXT_PUBLIC_API_URL`).
- Schlüssel zum eigenen Verlauf ist ein Zufallstoken im `localStorage`; in der
  DB liegt nur dessen SHA-256.
- Neue Antworten werden abgefragt (8 s), **nicht** per Realtime: `support_tickets`
  ist für `anon` bewusst gesperrt (Wurzel 6).

## Qualitätsgate

```bash
bun run typecheck   # tsc --noEmit
bun run build       # next build
```

Die CSP in `next.config.ts` erlaubt `unsafe-eval` **nur außerhalb von
Produktion** — ohne diese Ausnahme scheitert Next' react-refresh im Dev-Server
und die Seite ist komplett unklickbar (Feature-Tabs, Formular), obwohl sie
fertig aussieht. Die Produktions-CSP bleibt unverändert streng.

Bilder (`public/marketing/usecases/`) stammen von Unsplash und liegen **lokal**
im Repo — kein Laufzeit-Request an ein fremdes CDN, wie bei Schriften und Icons.
