# Booking Website Pro — was Hostaway hat und wir nicht

Grundlage: alle **71** Artikel der Reihe „Booking Website Pro" aus
`support.hostaway.com`, gelesen am 24.08.2026, ergänzt um Dudas eigene
Dokumentation dort, wo Hostaway die White-Label-Oberfläche nur verkürzt
beschreibt (Pop-up-Typen, Personalisierung). Jede Zeile ist belegt; wo eine
Angabe NICHT belegt ist, steht das ausdrücklich dabei.

Diese Datei ist eine Bestandsaufnahme, keine Zusage. Was davon gebaut wird,
entscheidet der Nutzer.

---

## 1. Personalisierung — bei uns gibt es das Konzept nicht

Hostaway/Duda kennt **Regeln** aus *Auslöser × Aktion*. Wir haben statt dessen
Auslöser direkt am Pop-up hängen. Der Unterschied ist nicht kosmetisch: eine
Regel kann dieselbe Aktion mit anderen Bedingungen mehrfach ausspielen, und
eine Aktion muss kein Pop-up sein.

**Auslöser** (mehrere kombinierbar)
| | Hostaway | wir |
|---|---|---|
| Gerät | Desktop / Mobil | ✅ am Pop-up |
| Ort | Stadt/Region/Land, ausgewertet als **50-km-Radius** | ✗ |
| Zeit | Startdatum · ganztägig · Uhrzeit von–bis · Zeitzone · Wiederholung täglich/wöchentlich/monatlich/jährlich · Enddatum (nie oder fest) | ✗ |
| Besuchszahl | „beim 1. Besuch" oder eigene Zahl | ✗ |
| Kampagnen-URL | Parameter im Query-String, dazu ein UTM-Baukasten (source/medium/campaign); zusätzlich: einmal je Besucher / nach N Tagen / beim Seitenaufruf | ✗ |
| kein Auslöser | Regel ist immer aktiv | ✗ |

**Aktionen** (genau eine je Regel)
| | Hostaway | wir |
|---|---|---|
| Pop-up | welches · auf welchen Seiten · **Position im 3×3-Raster** · sofort / nach N Sekunden / bei Verlassensabsicht / nach Scrollen | teilweise: keine Position, keine Seitenauswahl |
| Hinweisleiste oben | klebend, Text, Seitenauswahl, Ein- und Ausblendzeit. Kollidiert mit dem Cookie-Hinweis — der hat Vorrang und verdeckt sie | ✗ |
| JavaScript | eigener Code, Seitenauswahl | ✗ (bewusst) |
| Festliche Effekte | Schneeflocken · Feuerwerk · fallende Blätter · fallende Herzen · fallende Sterne · Fledermäuse · Geburtstag · Pride · St. Patrick's Day (+3 im Screenshot abgeschnitten); Seitenauswahl, Dauer in Sekunden oder „für immer" | ✗ (bewusst) |

**Regel-Verwaltung**: Liste mit Ziehen für die Priorität · Status `DRAFT` /
`DISABLED` · Schalter „einmal je Besucher" · Zusammenfassung mit `Edit` je Block
· `Preview` je Regel · Vorlagen-Kacheln: Build your own · Popup · Top bar message
· Festive effects · 1st visit popup · Newsletter popup · Campaign URL · Off Hours
· Return visit popup.

**Priorität**: gleiche Aktionsart auf derselben Seite → die oberste Regel
gewinnt. Verschiedene Aktionsarten dürfen gleichzeitig erscheinen. Gleiche
Aktionsart auf verschiedenen Seiten ebenfalls.

**Wo wir es besser machen können**: Personalisierung funktioniert bei Duda
**nicht auf mehrsprachigen Seiten und nicht auf dynamischen Seiten**. Bei uns
ist jede Seite mehrsprachig und jede Objektseite dynamisch — eine Regel, die
dort aussetzt, wäre bei uns wertlos. Wenn wir es bauen, muss es beides können.

## 2. Pop-up-Typen — zwölf Vorlagen beim Anlegen

Blank · Contact Us · Visit Us · Online Scheduling · Send Feedback · Welcome ·
New Store Item · Like Us on Facebook · Follow Us on Instagram · Promotion ·
Newsletter · More Info.
Belegt aus Dudas Produktankündigung „12 Fresh Popups"; Hostaways Artikel sagt
nur „Select a pop-up type. The pop-up type pre-populates the pop-up with
widgets." Die Liste im laufenden Hostaway-Editor ist nicht belegbar, ohne ein
Konto zu haben.

Weiteres zu Pop-ups: Größe durch Ziehen an der unteren rechten Ecke · jedes
verlinkbare Element kann „Close Popup" als Ziel bekommen (z. B. ein Knopf
„Nein danke") · Pop-ups erscheinen **einmal je Browser-Sitzung** · Verweise auf
ein Pop-up aus Text, Knopf und Galeriebild.

## 3. Seiten

- **Page Builder**: Seite erst als Abfolge von Abschnitten planen (bis **50**),
  verschieben, ersetzen, löschen — dann `Save for Later` (landet unter
  **„Pages in Progress"**) oder `Add Page to Site`.
- **Unterseiten bis drei Ebenen**, per Ziehen nach rechts eingerückt.
- **Einzelne Seite veröffentlichen** ohne die ganze Website. Kalender-Symbol als
  Marker; Theme-Änderungen gehen dabei NICHT mit; URL-Änderungen brauchen den
  vollen Publish; jedes Mal ein automatisches Backup; je Sprache getrennt.
- **Entwurfs-Zustand** je Seite, getrennt von „unveröffentlicht":
  `Set as a draft` / `Stage draft to publish`. Startseite, externe Links und
  Ordner können keine Entwürfe sein. Entwürfe sind automatisch `noindex`.
- **Im Menü verbergen** — Seite bleibt über die direkte Adresse erreichbar.
- **Passwortschutz je Seite** (bis 100 Zeichen, beliebige Zeichen) oder
  „nur für Mitglieder". Nicht für Anker- und dynamische Seiten. Abmelden geht
  nur über das Leeren des Caches.
- **Startseite wechseln** — die alte bekommt eine neue Adresse und bleibt;
  Links werden NICHT umgeschrieben.
- **In eine dynamische Seite umwandeln** (Collection wählen).
- **Grenzen**: 1000 Seiten, 1500 Blogbeiträge, **keine URL-Parameter**.
  Bei Mehrsprachigkeit sinkt die Gesamtzahl auf etwa 200.
- Menü der Seite: Rename · Hide in navigation · Duplicate · Publish page ·
  Page URL · SEO · Set Access · Convert to Dynamic Page · Set as a draft ·
  Delete.

## 4. Theme

- **Bis zu 30 Theme-Farben** mit frei benennbaren Rollen. Farben lassen sich
  **aus dem Logo erzeugen** oder aus den häufigsten Farben der Seite.
- **Text-Rollen**: DFLT (alles ohne eigene Rolle, samt Link-Zuständen
  normal/hover/besucht), PAR, H1–H6. Je Rolle: Schrift · Größe (Desktop/Tablet
  getrennt von Mobil) · „Scale text" (Größe folgt der Containerbreite) · Farbe ·
  Format · Richtung · Gewicht · Zeilenhöhe · Laufweite · Großbuchstaben ·
  Schatten.
- **Seitenbreite**: 1200 · 1440 · eigener Wert 960–1920 px bzw. 50–100 vw.
- **Abstände** getrennt für Abschnitt, Spalte und innere Spalte; horizontale
  Werte gekoppelt, entkoppelbar; „Reset to theme spacing".
- **Sidebar-Layout** als Alternative zum Kopfbereich (Desktop).
- Text-Skalierung ohne eigene Angabe: Desktop 100 %, Tablet 85 %, Mobil 80 %,
  nie unter 16 px, Tablet höchstens 60 px, Mobil höchstens 40 px.

## 5. Widgets — wir haben 17 Typen, Hostaway rund 40

Fehlend, nach Gruppen:
- **Basis**: Accordion · Breadcrumbs · Countdown · Tabelle (150 Zeilen × 30
  Spalten) · Liste · Datei-Download · Copyright (Jahr läuft mit) · Tabs ·
  Abstandhalter.
- **Medien**: Fotogalerie mit Lightbox und Instagram-Anbindung (100 Bilder) ·
  Medien-Slider (25 Folien) · Video (eigene Datei oder YouTube/Vimeo/
  Dailymotion, Video-Schema) · Audio (SoundCloud/Mixcloud) · Vorher-Nachher ·
  Form/Shape.
- **Business**: Kontaktformular · erweitertes Formular · Karte · mehrere
  Standorte · Öffnungszeiten · Anruf-Knopf · E-Mail-Knopf · Google-Kalender.
- **Social**: Social-Symbole · Teilen-Knopf · WhatsApp · RSS · Facebook-Feed ·
  X/Twitter-Feed.
- **Erweitert**: HTML · erweitertes Accordion · erweiterte Tabs.
- **Blog**: Alle Beiträge / Neueste Beiträge · Beitragssuche (sucht nur Titel).

## 6. Formulare — hier ist der Abstand am größten

Hostaways Kontaktformular kennt die Feldarten Text · Dropdown · Radio ·
Checkbox · Datum · Zeit · E-Mail · Telefon · Datei · Opt-in · Freitext ·
Click-to-Email · Zahl · Langtext. Dazu:
- **Datei-Upload**: höchstens 10 MB, eine Datei je Feld, Einsendungen laufen
  nach **90 Tagen** ab.
- **reCAPTCHA** ist bei neuen Formularen an und **nicht abschaltbar**.
- **Bestätigungsmail an den Absender**, standardmäßig an, mit Kopie seiner
  Antworten.
- **Weiterleitung nach dem Absenden** auf eine Seite oder fremde Adresse.
- **Google Sheets** live · **Webhook** (POST als JSON je Einsendung) · Slack.
- Erweitertes Formular zusätzlich: **mehrseitig** (ab 3 Seiten automatisch ein
  Zurück-Knopf), frei gestaltbare Erfolgs- und Fehlerseite, **CSV-Export**.
  Bedingte Logik ist dort ausdrücklich „coming soon", also auch bei Hostaway
  noch nicht da.

Wir haben: neun Feldarten, Pflichtfeld, Zustimmung, Speichern, Liste, CSV.
Es fehlen: Datei-Upload, Captcha, Bestätigungsmail, Weiterleitung, Webhook,
Mehrseitigkeit.

## 7. Editor

Layers-Panel · Elemente **je Gerät** ausblenden (Schwebeleiste, Kontextmenü,
durchgestrichenes Auge, orange markierte Geräte) · Snap-to-Grid mit Linealen ·
vorgefertigte Abschnitte („Designed Sections": Intro, Features, About, Team,
Testimonials …) · Undo/Redo · Kommentare an der Seite · **50 automatische und
50 manuelle Backups** · Entwicklermodus · Position „fixed" und „pinned" ·
Animationen (Hover, Scroll, Eintritt) mit je einer festen Liste von Effekten.

## 8. Medien

Media Manager mit Ordnern über alle Typen · Bibliotheken je Widget ·
Schnellauswahl · **Bildeditor** (Zuschneiden, Rahmen, Helligkeit/Sättigung/
Kontrast, Filter, Effekte, Weichzeichnen, Text, Overlay-Bilder, Symbole,
**Hintergrund entfernen**) · Stock von Pexels (kostenlos) und Shutterstock
(3,00 $ je Bild) · Alt-Text per KI · Import von Facebook, Dropbox, Google Drive,
Google Photos, Instagram.

Grenzen: 15.000 Bilder/Audio/Dateien je Website, 100 Videos, größte Bildfläche
3.145.728 Pixel, Logo 250–400 px breit, Favicon 24/36/48 px, Home-Screen-Symbol
mindestens 57×57 px.

## 9. Wo WIR vorn sind

- **sitemap.xml, robots.txt, llms.txt und der RSS-Feed** werden in Hostaways
  SEO-Artikel überhaupt nicht erwähnt. Wir liefern sie aus.
- **Strukturierte Daten** setzen wir automatisch und einzeln abschaltbar;
  Hostaway lässt den Kunden das Schema mit einem externen Generator bauen und
  ins Kopf-HTML der Seite kleben — nur „Local Business" entsteht automatisch.
- **Unsere SEO-Prüfung** nennt zehn benannte Befunde. Hostaway hat eine
  Zusammenfassung mit „Fix it", die Befundliste ist nicht dokumentiert.
- **Verlassensabsicht** als Auslöser haben weder Wix noch Squarespace.
- Personalisierung läuft bei uns auch auf mehrsprachigen und dynamischen Seiten
  — bei Duda ausdrücklich nicht.
