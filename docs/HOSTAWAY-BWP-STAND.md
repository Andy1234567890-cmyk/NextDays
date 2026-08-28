# Was uns gegenüber Hostaway fehlt — Stand 25.08.2026

Grundlage: alle 71 Artikel der Reihe „Booking Website Pro" aus
`support.hostaway.com`, gelesen am 24.08.2026, ergänzt um Dudas Dokumentation
dort, wo Hostaway die White-Label-Oberfläche verkürzt beschreibt (Pop-up-Typen,
Personalisierung). Die vollständige Aufnahme mit Belegen steht in
`HOSTAWAY-BWP-LUECKEN.md`; diese Datei ist der ARBEITSSTAND dazu.

Zahlen sind nachgemessen, nicht geschätzt.

---

## Fertig (0440–0444)

| | |
|---|---|
| **Personalisierungs-Regeln** | Auslöser × Aktion, 5 Auslöser, 4 Aktionen, Reihenfolge = Vorrang, Entwurf/Aktiv/Aus |
| **Pop-up-Vorlagen** | 12, mit Titel, Position und vorbelegten Abschnitten |
| **Pop-up-Position** | 3×3-Raster wie bei Duda |
| **Hinweisleiste** | klebend, mehrsprachig, Farben, schließbar |
| **Festliche Effekte** | 9 Partikel-Effekte als Canvas |
| **Eigenes JavaScript** | als Regel-Aktion |
| **Passwortschutz je Seite** | PBKDF2, signiertes Ticket, 24 h |
| **Einzelveröffentlichung** | mit Zeitstempel |
| **Entwurfszustand** | getrennt von „nicht live" |
| **Unterseiten** | drei Ebenen |
| **Seiten-Obergrenze** | 200 → 1000 |
| **Formulare** | Datei-Anlage (Upload-Endpunkt + Feld im Renderer), reCAPTCHA Enterprise (nicht abschaltbar, wie bei Hostaway), mehrseitig mit Zurück-Knopf ab drei Seiten, gestaltbarer Danke- UND Fehlertext, Webhook mit SSRF-Schutz, Bestätigungsmail, Weiterleitung, volle Editor-Oberfläche |

**Wo wir vorn sind:** `sitemap.xml`, `robots.txt`, `llms.txt` und RSS kommen in
Hostaways SEO-Artikel überhaupt nicht vor. Unser Schema-Markup entsteht
automatisch und ist einzeln abschaltbar — bei Hostaway baut der Kunde es mit
einem externen Generator und klebt es ins Kopf-HTML. Personalisierung läuft bei
uns auch auf mehrsprachigen und dynamischen Seiten; bei Duda ausdrücklich nicht.

---

## Offen

*Formulare sind fertig (Stand 25.08.2026, Etappe 4 des Baukasten-Plans) —
Upload-Endpunkt + Datei-Feld, reCAPTCHA Enterprise, mehrseitig mit Zurück-Knopf
ab drei Seiten, gestaltbarer Erfolgs- UND Fehlertext, volle Editor-Oberfläche.
Bedingte Logik hat Hostaway selbst nicht — dort steht „coming soon".*

### 1. Theme — der zweitgrößte Abstand
| | Hostaway | wir |
|---|---|---|
| Farben | **30 frei benennbare Rollen** | 7 feste Spalten |
| Schriften | Rollen DFLT · PAR · H1–H6, je 11 Einstellungen (Schrift, Größe getrennt Desktop/Mobil, Skalierung, Farbe, Format, Richtung, Gewicht, Zeilenhöhe, Laufweite, Großbuchstaben, Schatten) | 5 feste Schriftfelder |
| Abstände | getrennt für Abschnitt, Spalte, Innenspalte; koppelbar | — |
| Layout | Sidebar-Layout als Alternative zum Kopfbereich | — |
| Farbfindung | aus dem Logo erzeugen, häufigste Farben der Seite scannen | — |
| Kontrast | Prüfung gegen WCAG AA/AAA im Farbwähler | — |

### 2. Widgets — wir haben 17, Hostaway rund 40

Unsere: `hero` `rich_text` `image` `gallery` `button` `spacer` `contact`
`search` `properties_grid` `featured_properties` `reviews` `faq` `map`
`testimonials` `features` `form` `posts`

Fehlend, nach Hostaways Gruppen:

- **Basis** — Accordion · Erweitertes Accordion · Tabs · Erweiterte Tabs ·
  Breadcrumbs · Countdown · Tabelle (150 × 30) · Liste · Datei-Download ·
  Copyright (Jahr läuft mit) · Form/Shape
- **Medien** — Fotogalerie mit Lightbox und Instagram · Medien-Slider
  (25 Folien) · Video (Datei oder YouTube/Vimeo/Dailymotion, Video-Schema) ·
  Audio (SoundCloud/Mixcloud) · Vorher-Nachher
- **Business** — Öffnungszeiten · Anruf-Knopf · E-Mail-Knopf · mehrere
  Standorte · Google-Kalender
- **Social** — Social-Symbole · Teilen-Knopf · WhatsApp · RSS-Feed ·
  Facebook-Feed · X/Twitter-Feed
- **Erweitert** — HTML-Widget
- **Blog** — Beitragssuche (sucht nur Titel)

### 3. Editor
- **Layers-Panel** (Baumansicht aller Elemente)
- **Elemente je Gerät ausblenden** — Schwebeleiste, Kontextmenü, durchgestrichenes
  Auge, orange markierte Geräte
- **Snap-to-Grid** mit Linealen
- **Vorgefertigte Abschnitte** („Designed Sections": Intro, Features, About,
  Team, Testimonials …)
- **Position fixed und pinned**
- **Animationen** — Hover (9), Scroll (7), Eintritt (14), je feste Liste
- **50 automatische + 50 manuelle Backups**, Wiederherstellen mit Vorschau
- **Kommentare an der Seite**
- **Entwicklermodus**

### 4. Medien
- **Media Manager mit Ordnern** über alle Typen, Listen- und Kachelansicht
- **Bildeditor** — Zuschneiden, Rahmen, Helligkeit/Sättigung/Kontrast, Filter,
  Effekte, Weichzeichnen, Text, Overlay-Bilder, Symbole, **Hintergrund
  entfernen**
- **Stock** — Pexels kostenlos, Shutterstock 3,00 $ je Bild
- **Alt-Text per KI**
- **Import** von Facebook, Dropbox, Google Drive, Google Photos, Instagram
- Grenzen, die wir nicht führen: 15.000 Dateien, 100 Videos, größte Bildfläche
  3.145.728 Pixel

### 5. Seiten — Rest
- **Page-Builder-Modus**: Seite erst als Abfolge von bis zu 50 Abschnitten
  planen, dann `Save for Later` → „Pages in Progress"

### 6. KI
- **KI-Assistent im Texteditor** — verlängern, kürzen, übersetzen, verbessern,
  Grammatik, Tonfall ändern; Titel und Absätze erzeugen
- **Meta-Tags per KI** einzeln, für alle Seiten, oder „Import Meta Tags"
- **Business-Profil** als gemeinsame Grundlage der KI-Funktionen

### 7. Mehrsprachigkeit
- **Automatische Übersetzung** (Google Translate) beim Anlegen einer Sprache
- **Sprachauswahl-Widget** im Kopfbereich mit Flaggen-Varianten

*Hostaway erkauft das mit harten Einschränkungen: eine zweite Sprache ist eine
komplette Kopie der Website, Änderungen gleichen sich nicht ab, Blogbeiträge und
Seiten-SEO werden nicht übersetzt, und die Gesamtzahl der Seiten fällt auf etwa
200. Unsere Mehrsprachigkeit ist feldweise und hat keine dieser Grenzen.*
