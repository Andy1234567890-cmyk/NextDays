# Analyse + Plan: das Blog-Panel auf den Stand des Inferorum-CMS

Ziel: `/website/seiten/<id>?panel=blog` soll dasselbe sein wie das
Agentur-CMS aus `Andy54411/inferorum-gemae-website`. Jenes ist ein **Blog-CMS**
— eine Sammlung („blog"), ein Beitrag, eine Detailseite. Genau das ist unser
Blog-Panel auch. Der Vergleich ist deshalb 1:1 möglich.

---

## Teil 1 — Was Inferorum hat (gelesen, nicht geschätzt)

**Oberfläche** (`cms/apps/admin/src/pages/CollectionManager.tsx`, 1.472 Z.):

| | |
|---|---|
| Werkzeugleiste | `+` · Sortierung (Manuell · Neueste · Älteste · Titel A–Z) · Statusfilter (Alle/Entwurf/Veröffentlicht/Archiviert) · Suche (ausklappbar) · `⋮` Spalten (mit Suchfeld) · `Neu` |
| Tabelle | `table-layout: fixed`. Links **angeheftet**: Ziehgriff (40 px) und **Titelspalte** (288 px). Direkt dahinter **Status**, ebenfalls fest. Alle weiteren Spalten **ziehbar** (Reihenfolge) und in der **Breite veränderbar**; beides je Sammlung im `localStorage` gemerkt. Beim Ziehen schwebt die GANZE Spalte als Vorschau mit, eine blaue Linie zeigt die Einfügestelle. |
| Spaltenkopf | **Rechtsklick** → Name · Beschreibung · „Bezogen auf" (aus welchem Feld der Slug entsteht) samt Vorschau `/blog/post-title/` |
| Zeilen | **Ziehen** sortiert von Hand (`position`). **Hierarchisch**: Beiträge mit `parent_item` hängen eingerückt unter ihrem Buch, mit `└`-Zeichen; Umsortieren nur innerhalb derselben Ebene und desselben Buchs. |
| Zellen | Status als farbige Pille mit Dropdown (inline) · Bild als Miniatur · Galerie als „n Bilder" · Rich-Text als Textauszug (TipTap-JSON flachgelaufen, 90 Zeichen) · Schalter als Switch (inline schaltbar) · Auswahl als Beschriftung |
| Systemspalten | Status · **Aufrufe** · Erstellt · Aktualisiert |
| Dialog | Fährt von rechts über die Tabelle. Reiter **Bearbeiten · Vorschau**. Kopf: Schließen · Reiter · Speicherstand · „Auf Website ansehen" (nur wenn veröffentlicht) · Löschen · Speichern. Feldform: Slug mit Adressvorschau, Status-Pille, dann JEDES Feld über `FieldRenderer`. Fußzeile: Aufrufe · Aktualisiert · Veröffentlicht. |
| Vorschau | `preview_kind='blog'` → `BlogPreview` (Titelbild, Datum, Titel, Schlagwörter, Anriss, gerenderter Text). Sonst `FieldPreview` (jedes Feld beschriftet). |
| Editor | TipTap mit **18 Erweiterungen** und voller Leiste: H1–H3, fett/kursiv/unterstrichen/durchgestrichen/Code, hoch/tief, 6 Textfarben, 5 Marker, 4 Ausrichtungen, Aufzählung/Nummerierung/Aufgabenliste, Zitat, Code-Block, Trennlinie, Link, Bild (Upload), YouTube, Tabelle (+Spalte/+Zeile/Löschen), Rückgängig/Wiederholen |
| Feldtypen | 12: `text · multiline · richtext · image · gallery · toggle · number · date · select · link · author · reference` |
| Autor | Feldtyp `author` → Auswahl eines Kontos. Öffentlich wird daraus eine **Autorenkarte**: Name, Foto und bis zu **neun** Profile (Instagram, Facebook, TikTok, LinkedIn, Website, YouTube, Verlag, Saga-Facebook, Saga-Instagram) |
| Zähler | `view_count` je Beitrag, hochgezählt beim öffentlichen Abruf; zusätzlich **Link-Klick-Zählung** (`link_clicks`) mit Balkendiagramm im Dashboard |
| i18n | Oberfläche de/en/it; zusätzlich **lokalisierte Feld-Beschriftungen** je Feld-Schlüssel (`fieldLabels`) — der DB-Name ist nur der Rückfall |

**Was die Beitragsseite daraus macht** (`apps/web/src/pages/BlogPostPage.tsx`,
618 Z. — Kundenprojekt, nicht Teil des CMS): Titelbild mit weicher Maske,
dreispaltiges Layout, mitlaufendes Inhaltsverzeichnis aus H1–H3, Lesezeit,
Autorenkarte, **Kapitelliste** des Buchs, vier Galerie-Zonen, Peek-Carousel mit
Autoplay, Schluss-Sektion, Sidebar mit Geschwister-Kapiteln, ausfahrbares
Mobil-Inhaltsverzeichnis.

---

## Teil 2 — Was wir heute haben

**Panel** (`web/components/website/blog/blog-panel.tsx`, 116 Z.): vier Punkte
links — Beiträge · Einstellungen · Layouts · Import.

**Liste** (`beitraege-liste.tsx`, 920 Z.): Überschrift + Erklärsatz + großer
Knopf, Suchfeld, Sortier-/Filter-/Spaltenmenü, Sammelaktionen, dann eine
`<ul>` mit Flex-Spalten.

**Beitragsfelder** (`site_pages`, 0438/0457): `title` · `slug` · `excerpt` ·
`author` (**Freitext**) · `cover_image_url` · `og_image_alt` · `tags[]` ·
`published_at` · `created_at` · Seiten-SEO · Zugangsschutz · Übersetzungen.
**Der Inhalt sind Abschnitte** (`site_blocks`) — kein Textfeld.

### Der Abstand, Punkt für Punkt

| # | Inferorum | Wir | Schwere |
|---|---|---|---|
| 1 | Beitrag wird **im Dialog über der Tabelle** bearbeitet | Klick = **Seitenwechsel** in den Abschnitts-Editor, Panel weg | groß |
| 2 | Tabelle mit angehefteter Titelspalte | `<ul>`, kein `<table>`, nichts angeheftet | groß |
| 3 | Spalten ziehen + Breite ziehen, gemerkt | fest | groß |
| 4 | Rechtsklick auf Spaltenkopf | nichts | mittel |
| 5 | Zeilen ziehen (Handsortierung) | nur nach Datum | mittel |
| 6 | Hierarchie Buch → Kapitel | nichts | mittel |
| 7 | Titelbild als Miniatur in der Zeile | nur Text | klein |
| 8 | Status inline als Pille | Text | klein |
| 9 | Spalte **Aufrufe** | nichts | mittel |
| 10 | **Vorschau**-Reiter | nichts | mittel |
| 11 | TipTap-Editor | Abschnitte im anderen Bildschirm | Entscheidung, siehe unten |
| 12 | Autor = Konto mit Foto und 9 Profilen, Autorenkarte auf der Seite | Freitext-Name | groß |
| 13 | Archiviert als dritter Status | Entwurf/bereit/live (andere Bedeutung) | klein |
| 14 | Werkzeugleiste | Überschrift + Erklärsatz + großer Knopf | klein |

### Was WIR haben und Inferorum nicht
Abschnitte je Beitrag · 24 Sprachen mit Übersetzung je Beitrag (0476) ·
Seiten-SEO · Zugangsschutz (0442) · Einzelveröffentlichung (0443) ·
RSS-Import · Blog-Layouts · Vorplanung über `published_at`.
Nichts davon darf der Umbau kosten.

---

## Teil 3 — Die eine Entscheidung, die du treffen musst

**Was ist der INHALT eines Beitrags?**

- **A (Empfehlung): Abschnitte bleiben.** Der Dialog bearbeitet die FELDER
  (Titel, Anriss, Titelbild, Autor, Schlagwörter, Datum, SEO) und trägt einen
  Knopf „Inhalt bearbeiten" in den Abschnitts-Editor. Nichts geht verloren,
  der Beitrag bleibt gestaltbar.
- **B: Ein Rich-Text-Feld wie bei Inferorum.** Der ganze Beitrag wird im
  Dialog geschrieben, die Abschnitte am Beitrag entfallen. Näher am Vorbild,
  aber es kostet Hero, Galerie, Formular und Zitat im Beitrag.
- **C: Beides.** Zwei Orte für einen Inhalt — genau die zwei Wahrheiten, die
  hier verboten sind. Nicht empfohlen.

Alles Folgende gilt für A und B gleich; nur Etappe 5 unterscheidet sich.

---

## Teil 4 — Plan

**1 · Migration 0480** (Beitrag)
`site_pages`: `view_count` integer + RPC `bump_page_view` (Erhöhung in EINER
Anweisung), `sort` integer für die Handsortierung, `parent_post_id` für
Kapitel. `author_user_id` → Verweis auf ein Konto des Betriebs, `author`
bleibt als Freitext-Rückfall stehen (Altbestand).

**2 · Tabelle neu** (`beitraege-liste.tsx` → echtes `<table>`)
Angeheftete Griff- und Titelspalte, `table-layout: fixed`, Spalten ziehen und
in der Breite ändern (je Betrieb gemerkt), Schleppbild der ganzen Spalte,
Rechtsklick auf den Kopf, Zellen je Typ (Titelbild-Miniatur, Status-Pille,
Auszug), Spalten Aufrufe/Erstellt/Geändert.

**3 · Zeilen-Ziehen + Kapitel**
Handsortierung über `sort`, Einrückung über `parent_post_id`, gesperrt bei
Suche/Filter/Sortierregel (sonst vergibt der Server Ränge auf einem
Ausschnitt).

**4 · Der Dialog** — das Herzstück
Fährt über die Tabelle, Reiter **Bearbeiten · Vorschau**. Bearbeiten: Slug mit
Adressvorschau, Status, Datum, Titel, Anriss, Titelbild (Mediathek), Autor,
Schlagwörter, SEO. Vorschau: der Beitrag als Text. Kopf: „Auf Website
ansehen", Duplizieren, Löschen, Speichern, Aufrufe/Geändert in der Fußzeile.

**5 · Der Inhalt** — je nach Entscheidung
A: Knopf „Inhalt bearbeiten" → Abschnitts-Editor.
B: TipTap im Dialog. Die Werkzeugleiste bildet dann **genau** die
`nh3`-Allowlist ab (`_RICH_TEXT_TAGS`) — kein Knopf, dessen Ergebnis der
Server wegwirft. Kein `hr`, kein `img`, keine Tabelle, solange die Allowlist
sie nicht führt.

**6 · Autor**
Auswahl eines Kontos statt Freitext; Autorenkarte im Renderer (Name, Foto,
Profile). Die Profil-Felder gibt es bei uns noch nicht — sie kommen ans Konto,
nicht an den Beitrag.

**7 · Aufrufe**
`bump_page_view` beim öffentlichen Abruf, Spalte in der Tabelle, Summe im
Blog-Kopf.

**8 · Werkzeugleiste statt Kopfzeile**
Überschrift und Erklärsatz raus, `+` · Sortierung · Filter · Suche · `⋮` ·
`Neu` in eine Zeile — wie im Vorbild.

**9 · Gates**
`pytest` (Slice) · `ruff` · `pylint` 10.00 · `tsc` in web und builder ·
`bun run lint` · `blocktypen-pruefen` · `abos-pruefen` · i18n-Prüfskripte ·
danach Übersetzung der neuen Schlüssel in 24 Sprachen per Gemini.

---

## Teil 5 — Was ausdrücklich NICHT übernommen wird

Aus Inferorum, weil es bei uns ein Fehler wäre:
1. **`site_key` als öffentlicher Leseschlüssel** + `anon`-Lesepolicies. Bei uns
   liest der Renderer über die API; sensible Tabellen sind gesperrt (Wurzel 6).
2. **`dangerouslySetInnerHTML` mit ungeprüftem TipTap-HTML** (drei Stellen bei
   Inferorum). Bei uns wird beim SPEICHERN mit `nh3` gesäubert (Wurzel 8).
3. **Upload ohne Magic-Byte-Prüfung**, SVG ungesäubert (Wurzel 8).
4. **`view_count` als Lesen-Rechnen-Schreiben** — verliert Zählungen (Wurzel 2).
5. **Einsprachige Inhalte.** Inferorums Oberfläche ist dreisprachig, die
   Inhalte sind es nicht. Unsere Beiträge müssen in 24 Sprachen übersetzbar
   bleiben.
