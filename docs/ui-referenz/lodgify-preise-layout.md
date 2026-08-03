# UI-Referenz — Preise-Seite (Layout-Maße)

Am 03.08.2026 live von `app.lodgify.com/pricing/<id>` abgelesen (Computed Styles,
nicht geschätzt) und in `web/components/objekte/pricing/preis-bausteine.tsx`
umgesetzt. Ziel: `/objekte/<id>/preise` trägt genau dieses Layout.

## Seitenaufbau

| Element | Referenz | Umsetzung |
| --- | --- | --- |
| Inhaltsspalte | `max-width: min(920px, 100% − 130px)` | `max-w-[57.5rem]`, `mx-auto` (`PreisSpalte`) |
| Seitenkopf | h1 32 px / 40 px, danach 32 px Luft | `text-[2rem] leading-10`, `pb-8` (`PreisSeitenkopf`) |
| Abschnitt | `padding-bottom: 64px` | `pb-16` (`PreisAbschnitt`) |
| Abschnittskopf | Flex, `space-between`, `gap 16px`, `align-start` | `flex items-start justify-between gap-4` |
| Titel + Hinweis | Spalte, `gap 4px`; h2 20/24; p 13/20 gedeckt | `gap-1`, `text-xl leading-6`, `text-[0.8125rem] leading-5 text-muted-foreground` |
| Kartenliste | `margin-top 24px`, `gap 16px` | `mt-6 flex flex-col gap-4` |

## Karte

| Element | Referenz | Umsetzung |
| --- | --- | --- |
| Rahmen | Radius 16 px, 1 px `#EBEBEB`, kein Schatten | `rounded-2xl border border-border`, `shadow` bewusst nicht |
| Innen | `padding 16px`, `gap 12px`, `flex-wrap` | `p-4 gap-3 flex-wrap` |
| Titel | 13/20, Gewicht 600, Fließschrift | `text-[0.8125rem] font-semibold! font-sans! leading-5` |
| Hinweis | 12/16, gedeckt, `margin-top 8px` | `mt-2 text-xs leading-4 text-muted-foreground` |
| Wertzeile | volle Breite, `gap 8px` | `w-full flex-wrap gap-2` |
| Wert-Chip | 13/20, Radius ≈ 3 px, `padding 1.6px 6.5px`, helle Fläche | `rounded-[0.25rem] px-[0.4rem] py-[0.125rem] text-[0.8125rem] leading-5 bg-muted` |
| Badge | 12/16, Radius 4 px, `padding 2px 4px`; blau = Einschränkung, grün = aktiv | `PreisBadge tone="info" \| "success"` |

## Aktionen (alle randlos, keine gefüllte Fläche auf dieser Seite)

| Aktion | Referenz | Umsetzung |
| --- | --- | --- |
| Abschnitt „+ Hinzufügen" | 36 px hoch, `padding 8/12`, Pille, 13 px | `PreisHinzufuegen` |
| Karte bearbeiten | 28 × 28, Pille, `padding 4px`, Symbol 20 px | `PreisSymbolAktion` |
| Karte „Hinzufügen" (noch nichts eingerichtet) | 24 px hoch, `padding 4/8`, 12 px | `PreisTextAktion` |

## Bewusste Abweichungen

- **Überschriften-Schrift:** Referenz nutzt ihre Hausschrift („RL Aqva", 700).
  Wir bleiben bei Fraunces 800 (`globals.css`, h1–h3) — Marke, nicht Layout.
- **Farben:** Referenzwerte (`#EBEBEB`, `#F7F7F7`, `#616161`) sind durch die
  semantischen Tokens `border` / `muted` / `muted-foreground` ersetzt. Sonst
  fiele der Dunkelmodus aus und es entstünden Hex-Hardcodes.
- **Leerzustände:** Die Referenz zeigt bei leerem Abschnitt gar nichts. Wir
  zeigen eine 13-px-Hinweiszeile, damit der Abschnitt nicht als Bug wirkt.
- **Kopfzeilen-Menü:** Die Referenz hat oben rechts ein „…"-Menü. Wir haben dort
  keine Aktionen, also kein leeres Menü.
