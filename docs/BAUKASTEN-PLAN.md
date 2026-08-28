# Plan: Baukasten fertigstellen

Stand 25.08.2026. Grundlage: `HOSTAWAY-BWP-STAND.md` (Lückenliste),
`BUCHUNGSSTRECKE-VORBILDER.md` (Anbietervergleich) und der heute erhobene
Ist-Zustand im Code.

## Was heute schon steht — und was daran fehlt

Der KI-Teil ist weiter, als die Lückenliste sagt. Ein Agent hat ihn gebaut,
bevor er am Opus-Wochenlimit abbrach:

| Teil | Zustand |
|---|---|
| `ki_client.py` (Vertex AI) | 415 Zeilen, Dienstkonto aus `VERTEX_SERVICE_ACCOUNT_B64` |
| `ki_texte.py` · `ki_bild.py` · `ki_profil.py` · `ki_nutzung.py` · `ki_herkunft.py` | 1981 Zeilen |
| `ki_router.py` | 7 Endpunkte, in `main.py` angeschlossen |
| Migrationen 0463–0465 | live eingespielt (Herkunft, Geschäftsprofil, Verbrauch) |
| `web/lib/site-ki.ts` | 10 Funktionen, vollständig |
| `web/components/…/ki-textknopf.tsx` | vorhanden — **wird nirgends importiert** |

**Es läuft trotzdem nichts.** Drei Gründe, alle außerhalb des Codes:

1. `aiplatform.googleapis.com` ist im Projekt **nicht aktiviert** (nur
   `translate.googleapis.com` läuft).
2. `VERTEX_SERVICE_ACCOUNT_B64` und `VERTEX_PROJECT_ID` sind **leer**.
3. Keine einzige Oberfläche ruft die Funktionen auf.

---

## Etappe 1 — KI scharf schalten (Voraussetzung für alles Weitere)

Ohne diese Schritte ist jede KI-Oberfläche ein Knopf, der 503 liefert.

1. `gcloud services enable aiplatform.googleapis.com` im Projekt
   `project-460d8aaf-4b7d-4d13-b3a`.
2. Dienstkonto mit **genau einer** Rolle `roles/aiplatform.user` anlegen,
   Schlüssel erzeugen, als **einzeiliges Base64** ablegen.
   *Warum einzeilig:* ein mehrzeiliges Secret zerbricht den Coolify-Deploy
   (bekannt, siehe Memory).
3. Variablen in **BEIDEN** Coolify-Anwendungen setzen — `api` **und** `worker`.
   *Warum beide:* sie fahren denselben Code, haben aber getrennte
   Variablenlisten. Genau daran sind am 25.08. schon die Mail-Variablen
   gescheitert: die API hatte sie, der Worker keine, und niemand hat es
   gemerkt, weil nichts geloggt wurde.
4. `bash scripts/diagnose/…` — ein Diagnoseskript, das Schlüssel, Region und
   einen Testaufruf prüft, gehört dazu. Ein KI-Knopf, der still nichts tut, ist
   der Fehler, den man nicht findet.

Region: **europe-west4**, so wie in `config.py` voreingestellt. Modell
`gemini-2.5-flash` — für Kurztexte ausreichend und um ein Vielfaches billiger
als Pro.

**Offen und vor dem ersten Kundendatensatz zu klären:** der genaue Wortlaut zur
„ML processing location" bei Vertex AI. Datenresidenz und Verarbeitungsort sind
bei Google zwei verschiedene Dinge; die Seite war bei der Recherche nicht
auslesbar.

---

## Etappe 2 — SEO mit KI (der Schwerpunkt)

Der Endpunkt `POST /site-config/ki/seo` existiert und liefert Titel und
Beschreibung. Was fehlt, ist der Weg dorthin.

### 2.1 Im SEO-Reiter, je Seite
- Neben „SEO-Titel" und „SEO-Beschreibung" je ein **Erzeugen-Knopf**.
- Er füllt das Feld als **Vorschlag**, nicht als fertigen Wert: der Kunde sieht
  ihn, bevor er ihn übernimmt. Das ist nicht Höflichkeit, sondern die
  Voraussetzung für die Ausnahme „redaktionelle Kontrolle" im EU AI Act
  (Art. 50 Abs. 4) — reines Durchwinken erfüllt sie nicht.
- Die Länge wird **gegen dieselbe Grenze geprüft** wie ein getippter Wert.
  Ein Vorschlag, der beim Speichern 422 wirft, ist schlimmer als keiner.

### 2.2 Für alle Seiten auf einmal
- „Für alle Seiten erzeugen" mit Vorschau-Liste und Häkchen je Seite.
- **Nur leere Felder** werden vorgeschlagen. Ein bestehender Text wird nie
  überschrieben — er ist die Arbeit eines Menschen (Wurzel 1: der Gegenzustand
  gehört mitgepflegt, hier heißt das: gar nicht anfassen).
- Harte Obergrenze je Lauf, eigener Rate-Limit-Bucket (Wurzel 8).

### 2.3 Herkunft und Kennzeichnung
`content_origin` steht seit 0463 an `site_pages` und `site_blocks`. Es muss
gesetzt werden, wo es entsteht:
- `ai_generated` bei einem übernommenen Vorschlag,
- `ai_rewritten` beim Umschreiben,
- `human` bleibt der Standard.

Sichtbar wird das im Dashboard (ein kleines Zeichen am Feld), **nicht** beim
Gast — eine Objektbeschreibung ist Werbung, keine „Angelegenheit von
öffentlichem Interesse". Bei **Blogbeiträgen** kommt ein Fußhinweis dazu.

### 2.4 Das Geschäftsprofil
`site_ai_profile` (0464) ist die gemeinsame Grundlage aller KI-Funktionen.
Hostaway lässt es den Kunden tippen. Wir **leiten es ab** — aus Konto, Objekten
und Gebäuden — und lassen es nur nachbearbeiten. `kiProfilVorschlag()` gibt es
bereits.

### 2.5 Alt-Texte
`POST /ki/alt-text` existiert. Er gehört an zwei Stellen: in die Mediathek (je
Bild) und in den Bild-Baustein. Alt-Texte sind der SEO-Teil, den niemand von
Hand pflegt — und der einzige, bei dem die KI mehr sieht als der Mensch, der
das Bild vor Wochen hochgeladen hat.

---

## Etappe 3 — Theme auf den gezeigten Aufbau

Die **Felder** sind vollständig (Schrift, Größe Desktop/Mobil, Skalierung,
Farbe, Stärke, Zeilenhöhe, Laufweite, Großbuchstaben, Schatten, Link-Zustände).
Falsch ist der **Aufbau**: eine lange Rolle unter „DESIGN" statt Unterseiten mit
`‹ TITEL ? ◻ ✕`. Dazu fehlen:
- 30 frei benennbare Farbrollen (wir haben 7 feste),
- Abstände getrennt für Abschnitt/Spalte/Innenspalte,
- Sidebar-Layout,
- Farben aus dem Logo erzeugen,
- WCAG-Kontrastprüfung im Farbwähler.

---

## Etappe 4 — Formulare zu Ende (fertig, Stand 25.08.2026)

Upload-Endpunkt + Datei-Feld im Renderer, reCAPTCHA Enterprise (dieselbe Kette
wie das Kontaktformular der Marketing-Seite, nicht abschaltbar), mehrseitige
Formulare mit Zurück-Knopf ab drei Seiten, gestaltbarer Danke- UND Fehlertext
(`success_text`/`error_text` — eine konkrete Server-Meldung hat immer Vorrang
vor dem Fehlertext-Rückfall), Editor-Oberfläche für alles Neue (Datei-Feld,
Webhook-Adresse, Bestätigungsmail, Weiterleitungsziel, Seiten-Aufteilung). Der
Gast erfährt jetzt auch, wenn eine Bestätigungsmail rausging
(`bestaetigung_gesendet` in der Absende-Antwort).

---

## Etappe 5 — Medien

Migration 0460 (Ordner) liegt geschrieben da. Es fehlen: die Ordner-Oberfläche,
der Bildeditor (Zuschneiden, Helligkeit, Filter — im Browser, mit
EXIF-Drehung und Safari-Canvas-Grenze), Stock-Fotos über Pexels und Unsplash
(Schlüssel serverseitig, Unsplash-Attribution ist Vertragspflicht).

**Freistellen kann Google nicht** — Imagen ersetzt den Hintergrund, statt ihn
transparent zu machen; die Vision API liefert nur Rechtecke. Dafür bräuchte es
`rembg` selbst gehostet oder remove.bg.

---

## Etappe 6 — Rest

Widgets: Social-Symbole, Teilen, WhatsApp, RSS, Facebook-Feed, HTML-Widget,
erweitertes Accordion und Tabs. Editor: Snap-to-Grid, vorgefertigte Abschnitte,
fixed/pinned, Animationen, **50+50 Backups**, Kommentare. Mehrsprachigkeit:
automatische Übersetzung beim Anlegen einer Sprache, Sprachauswahl-Widget.

---

## Reihenfolge und Begründung

1. **Etappe 1** zuerst — ohne sie ist alles Weitere an der KI unprüfbar.
2. **Etappe 2** (SEO) — sie ist der Schwerpunkt und hat das fertigste Backend.
3. **Etappe 4** (Formulare) vor Theme: ein Formular ohne Datei-Feld ist eine
   Zusage, die der Renderer nicht einlöst; ein Theme-Panel mit falschem Aufbau
   ist unschön, aber vollständig.
4. **Etappe 3** (Theme), **5** (Medien), **6** (Rest).
