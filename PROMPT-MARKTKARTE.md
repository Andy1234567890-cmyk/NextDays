# Auftrag: Marktkarte im Dynamic Pricing fertigstellen

Du arbeitest im Repo `/Users/andystaudinger/NextDays` (Branch `main`).
Lies **zuerst** `CLAUDE.md` im Wurzelverzeichnis — die 9 Wurzeln und das
Qualitätsgate dort sind verbindlich und gehen diesem Dokument vor.

---

## 1. Das Ziel in einem Satz

Jeder Betrieb, der im Dynamic Pricing die Regel **„Marktdaten nutzen"**
aktiviert hat, sieht auf einer Google-Karte **alle Unterkunftspreise im
50-km-Umkreis seines Objekts**, einmal täglich frisch abgerufen — und der
Preisfaktor der Engine rechnet mit demselben Datenbestand.

**Der Nutzer hat wörtlich gesagt:**
> „50km Umkreis mit alle objekte preise müssen einmal täglich abgerufen werden
> so das wir es anzeigen können."
> „und das muss sich täglich aktualisieren wo die regel aktive ist"

Und, nachdem eine frühere Fassung leere Tage mit einem Erklärtext kaschierte:
> „was machst du für hinweis texte ich will das es geht !!"

**Daraus folgt die wichtigste Regel dieses Auftrags:** Ein Hinweistext ist
keine Lösung. Wenn die Karte an einem Tag leer ist, ist der Auftrag an dieser
Stelle nicht erfüllt — auch dann nicht, wenn die Leere ehrlich erklärt wird.
Die Karte muss an **jedem** abgerufenen Stichtag Punkte zeigen.

---

## 2. Was bereits gebaut und live ist

Der Zustand ist **uncommitted**, aber die Migrationen sind eingespielt und die
Kette läuft nachweislich. Nichts davon ist Entwurf — es ist gemessen.

### Migrationen (alle live eingespielt)

| Datei | Inhalt |
|---|---|
| `supabase/migrations/0556_marktbeobachtung.sql` | `markt_beobachtung` — ein Median je Grobzelle/Tag. **Speist den Preisfaktor.** |
| `supabase/migrations/0557_marktbeobachtung_feinraster.sql` | `markt_beobachtung_zelle` — Teilgebiete ~11 km. **Sackgasse, siehe § 3.** |
| `supabase/migrations/0558_marktpunkte.sql` | `markt_punkt` — jeder beobachtete Preis als Einzelpunkt. **Speist die Karte.** |

Alle drei: RLS an, `select` für `authenticated`, `revoke insert/update/delete`
für `anon, authenticated`. Marktdaten sind bewusst betriebsübergreifend lesbar
(das ist der Produktnutzen), aber nur der Server schreibt.

### Backend

```
apps/api/src/features/pricing/market/
  beobachtung.py            Zelle (Raster), stichtage(), aggregieren()
  quelle_airbnb.py          preise_im_kasten() -> list[float]
                            preise_mit_ort()   -> list[(preis, lat, lng)]
                            _abrufen()         gemeinsamer Weg nach draußen
  beobachtung_service.py    MarktBeobachtung.lauf() — der tägliche Durchlauf
  umgebung.py               UmgebungProvider — liest das Raster, interpoliert
  stand.py                  marktstand_bauen() — alles für die Oberfläche
apps/api/src/jobs/
  markt_beobachtung_tick.py Job `markt_beobachtung`, am Tagestakt registriert
```

- `src/worker.py`: Import (Z. 44), Registry `HANDLERS` (Z. 656),
  Einreihung am täglichen Tick (Z. ~1419). **Verifiziert:**
  `'markt_beobachtung' in HANDLERS` ist `True`, 25 Handler gesamt.
- `recompute.py::_market_provider` wählt in dieser Reihenfolge:
  Comp-Set von Hand → `UmgebungProvider` (wenn `hat_daten()`) → `UmkreisProvider`
  → externer Anbieter. Kein Provider ruft eine Fremdquelle ab; alle lesen nur.
- `pyairbnb 2.2.2` ist via `uv add` in `apps/api/pyproject.toml` aufgenommen.

### Frontend

- `web/components/dynamic-pricing/markt-karte.tsx` — die Karte
  (`@vis.gl/react-google-maps`, wie `reservierungen/property-location.tsx`;
  Key `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `googleMaps: true` in `next.config.ts`,
  CSP bereits freigegeben — **keine neue Kartentechnik einführen**).
- `web/components/dynamic-pricing/dp-edit-sheet.tsx` — bindet `<MarktKarte>` im
  Marktdaten-Block ein.
- `web/lib/dynamic-pricing.ts` — Typen `MarktPunkt`, `MarktGebiet`, `MarktStand`.

### Schemas

`apps/api/src/features/pricing/ki_schemas.py`: `MarktPunkt` (Tageskurve),
`MarktGebiet` (Kartenpunkt), `MarktStand` (Kennzahlen + Kurve + Gebiete + Koordinaten).

### Gemessener Beweis, dass die Kette trägt

Objekt **„FeWo *Stjerneskud*"** (57.554 / 10.1502, DKK, Basispreis 550):

```
gewählter Provider: umgebung
Tag           Markt   Faktor   Wirkung
2026-09-24      939   1.1415    14.1 %
2026-10-14      931   1.1387    13.9 %
2026-11-03      951   1.1458    14.6 %
2026-11-23      970   1.1529    15.3 %
```

Vorher stand der Markt-Faktor **an allen 400 Tagen auf exakt 1,0** — eine
Attrappe. Das ist der Kern dessen, was hier repariert wurde.

---

## 3. Der offene Punkt — und warum die naheliegende Lösung falsch war

### Symptom
Der Nutzer: *„3 und 4 tage zeigt keine daten"*.

### Ursache, gemessen
Das Feinraster (0557) gruppiert Objekte in Teilgebiete von ~11 km und zeigt
eine Gruppe erst ab **fünf** Objekten. In Nordjütland ist die Dichte zu gering:

```
Grobzelle 57.625/10.125, Tag 2026-12-11: 15 Objekte
  (57.5, 10.0)  n=4   zu dünn
  (57.5, 10.2)  n=3   zu dünn
  (57.6, 10.2)  n=3   zu dünn
  (57.6, 10.1)  n=3   zu dünn
  (57.5, 10.1)  n=2   zu dünn
  → 0 sichtbare Teilgebiete
```

### Was schon versucht wurde — nicht wiederholen
1. **Feinraster 0,05° (~5,5 km)** → 7 Teilgebiete, davon 1 über der Schwelle.
2. **Feinraster 0,1° (~11 km)** → 1–2 Teilgebiete, an manchen Tagen 0.
3. **Erklärtext auf der leeren Karte** → vom Nutzer ausdrücklich abgelehnt.

Die Schwelle von fünf ist beim **Median** richtig (ein Median aus drei Häusern
ist faktisch der Preis eines Nachbarn). Für die **Karte** ist Gruppierung
überhaupt der falsche Zuschnitt.

### Die Entscheidung des Nutzers
> „mach doch ganz einfach in der region 50 km alle objekte nur mit preis"

Also: **kein Raster, keine Schwelle, jeder Preis ein Punkt.** Tabelle
`markt_punkt` (0558) existiert dafür bereits.

---

## 4. Was du zu tun hast

### 4.1 Radius auf 50 km — teilweise erledigt, verifizieren

`beobachtung.py`: `_ZELLE_GRAD` ist von `0.25` auf `0.45` geändert (~50 km
Breite, verifiziert: Kasten 57.15–57.6 = 50 km). **Prüfe die Folgen:**

- `stand.py::_ZELLE_KM` leitet sich aus `_ZELLE_GRAD` ab → zeigt jetzt 50 statt 28.
- Bereits gespeicherte Zeilen tragen die **alten** Zellkoordinaten
  (57.625/10.125). Nach der Änderung rechnet `Zelle.fuer()` andere Werte
  (57.375/10.125) → die Altdaten werden nicht mehr gefunden.
  **Entscheide bewusst und begründe im Code:** Altbestand per Migration
  umrechnen oder verwerfen und neu abrufen. Verwerfen ist vertretbar (die Daten
  sind einen Tag alt), aber es muss dastehen, dass es Absicht war.

### 4.2 Kartenpunkte statt Teilgebiete — teilweise erledigt, fertigstellen

`beobachtung_service.py` hat bereits `_punkte_schreiben()` statt `_feinraster()`.
Offen:

- **`stand.py::_gebiete()` liest noch `markt_beobachtung_zelle`** → auf
  `markt_punkt` umstellen. Jeder Punkt wird ein `MarktGebiet` mit `anzahl=1`.
  Überlege, ob `MarktGebiet` dann noch der richtige Name ist — ein Punkt ist
  kein Gebiet mehr. Wenn du umbenennst, dann konsequent durch Schema, Frontend-Typ
  und Karte.
- **Obergrenze setzen (Wurzel 8):** Bei 50 km können es je Tag mehrere hundert
  Punkte werden. Deckle die Zahl der an die Oberfläche gelieferten Punkte
  (Vorschlag: 300) und begründe die Zahl im Code. Ohne Deckel wird die Antwort
  groß und die Karte träge.
- **`markt_beobachtung_zelle` (0557) ist damit verwaist.** CLAUDE.md verbietet
  eigenmächtiges Löschen: Tabelle und Migration **stehen lassen**, im
  Tabellenkommentar vermerken, dass sie durch `markt_punkt` abgelöst wurde und
  warum. Nicht löschen, nicht heimlich weiterbefüllen.

### 4.3 Nur Objekte mit aktiver Regel — erledigt, verifizieren

`_zellen_mit_objekten()` liest jetzt zuerst `dp_settings.market_enabled = true`
und filtert `properties` darauf. Prüfe live, dass die Zellenliste dadurch
kleiner wird und die richtigen Zellen enthält.

### 4.4 Täglicher Lauf — Kette schließen

Der Job ist registriert und am Tagestakt eingereiht. Zu prüfen und zu belegen:

- Ein voller `lauf()` schreibt für **jeden** Stichtag Zeilen in `markt_punkt`.
- `stichtage()` liefert derzeit 23 Termine (nah 7-tägig bis Tag 90, dann
  30-tägig bis Tag 400). Bei ~50 Punkten je Abruf sind das je Zelle rund 1 150
  Zeilen pro Tag. Prüfe, ob das mit `_PAUSE_SEKUNDEN = 3.0` in vertretbarer
  Zeit durchläuft, und ob die Tabelle nicht unbegrenzt wächst
  (`_punkte_schreiben` räumt seinen Tag vor dem Schreiben ab — verifiziere das
  wirklich, es ist Wurzel 1).
- **Idempotenz (Wurzel 2):** zweimal am selben Tag laufen darf keine Dubletten
  erzeugen.

### 4.5 Karte: jeder Tag zeigt Punkte

- `markt-karte.tsx` filtert Punkte auf den gewählten Tag (`gebieteHeute`).
- **Der Erklärtext für leere Tage muss weg**, sobald jeder Tag Punkte hat. Er
  war die abgelehnte Notlösung. Ein Fallback für den echten Ausnahmefall
  (Quelle ausgefallen, Objekt ohne Koordinaten) bleibt richtig — aber er darf
  nicht der Normalfall sein.
- Farbskala relativ zur gezeigten Region (bereits so gebaut: `gebietsFarbe()`).
- Der eigene Marker liegt über den Marktpunkten und zeigt den eigenen Preis.

---

## 5. Unverhandelbare Grenzen

### 5.1 Keine fremden Objektnamen — bewusste Produktentscheidung

Der Nutzer wurde vor die Wahl gestellt („aggregiert ohne Namen" vs. „mit
Hausnamen") und hat **ausdrücklich „Aggregiert, ohne Namen" gewählt.**

Begründung: eine Sammlung benannter Fremdinserate im Produkt wäre eine
Wettbewerber-Datenbank, die myNextDays weiterverkauft — EU-Datenbankrichtlinie
96/9/EG und DSGVO (Gastgeberdaten) greifen dann deutlich schärfer. Das Risiko
trägt myNextDays als Anbieter, nicht der Kunde.

**Konkret gilt:**
- `quelle_airbnb.preise_im_kasten()` gibt `list[float]` zurück — nackte Zahlen.
- `preise_mit_ort()` gibt `list[tuple[float, float, float]]` — Preis + Ort.
- **Weder Name noch `room_id` noch Link verlässt dieses Modul.**
- `markt_punkt` speichert Ort auf ~100 m gerundet (`numeric(8,3)`) — genug für
  die Karte, zu grob für eine Adresse.
- Der Test `test_quelle_gibt_nur_zahlen_heraus` prüft die Rückgabesignatur und
  schlägt fehl, wenn jemand das aufweicht. **Diesen Test nicht anpassen, um ihn
  grün zu bekommen.**

### 5.2 Rechtslage — dem Nutzer bekannt, seine Entscheidung

Recherchiert und dem Nutzer vorgelegt: Airbnbs `robots.txt` sperrt die
Preis-Pfade, EU-Datenbankrecht und DSGVO sind einschlägig. Der Nutzer hat sich
in Kenntnis dessen für diesen Weg entschieden.

**Daraus folgt für dich:** Bau es sauber, aber diskutiere es nicht erneut. Was
technisch geboten bleibt: gedrosselte Abrufe (`_PAUSE_SEKUNDEN`), Deckelung
(`_MAX_TREFFER`, `_MAX_ZELLEN`, `_MAX_STICHTAGE`), und **fail-closed** — fällt
die Quelle aus, gibt es kein Signal und der Faktor bleibt neutral, nie ein
geschätzter Ersatzwert.

### 5.3 Was nachweislich NICHT funktioniert — nicht erneut versuchen

Alles live geprüft am 04.09.2026:

| Weg | Befund |
|---|---|
| Google Places API (New) | 20 Unterkünfte um Skagen, **0 mit Preis**. Place Details mit `FieldMask: *` → **39 Felder, kein einziges Preisfeld**. |
| Google Travel / `/travel/search` | Consent-Wall (302 auf `consent.google.com`) **und** Googles eigene `robots.txt` sperrt `/travel/search`. |
| Google Hotel Ads / Travel Partner API | Nur **Einliefern** eigener Preise. `priceViews` = eigene Preise, kein Wettbewerbsvergleich. Im gcloud-Katalog gar nicht vorhanden. |
| Vertex AI Grounding | 35 $/1000 Abfragen, und die Zahl wäre **halluzinierbar** — untragbar als Grundlage eines Verkaufspreises. |
| `pyairbnb.get_calendar()` | 365 Tage Verfügbarkeit, **alle `localPriceFormatted = null`**. Keine Preise. |
| Inside Airbnb | Nordjütland fehlt (nur 123 Großstädte), Kalender-CSV **ohne Preisspalte**, quartalsweise. |
| Eurostat | Keine Preise. NUTS-3 nur jährlich, ~20 Monate alt. |
| OpenStreetMap / Overpass | 528 Objekte in Nordjylland, **0 mit `price`**. |
| Umkreis über eigene Plattform | **40 von 44** aktiven Objekten haben null Nachbarn fremder Betriebe (erst 5 Betriebe auf der Plattform). |

Der einzige funktionierende Weg zu Tagespreisen ist `pyairbnb.search_all()` mit
Datumsfenster — gemessen: 280 Treffer um Skagen, **100 % mit Preis in DKK**.

### 5.4 Typfilter ist Pflicht, nicht Kosmetik

`quelle_airbnb._ART = "Entire home/apt"`. Ohne diesen Filter sinkt der Median
in der Hochsaison **unter** den der Nebensaison, weil die guten Häuser
ausgebucht sind und Einzelzimmer die Liste füllen:

```
Juli  ungefiltert 671 DKK  |  mit Typfilter 1304 DKK
Okt.  ungefiltert 1230 DKK |  mit Typfilter 1524 DKK
```

Ohne Filter dreht sich das Vorzeichen der Saison um. Nicht entfernen.

### 5.5 Währung — kein Ersatzwert (Wurzel 4)

Der Markt-Faktor rechnet `(comp_price - base) / base`. Ein USD-Median gegen
einen DKK-Basispreis ergäbe sofort einen Faktor am Anschlag. Deshalb:

- Währung kommt aus `properties.currency` (Migration 0161).
- `_betrag()` verwirft Treffer, deren gemeldete Währung abweicht.
- Fehlt die Währung, wird **nicht** abgerufen (`preise_im_kasten` gibt `[]`).
- Liegen in einer Zelle Objekte verschiedener Währungen, wird je Währung
  separat abgerufen.

---

## 6. Qualitätsgate (aus CLAUDE.md, gilt vollständig)

```bash
# Backend — nur der berührte Slice, NIE der volle Lauf wiederholt
cd apps/api
uv run pytest src/features/pricing -q          # zuletzt: 161 passed
uv run ruff check src/
uv run pylint src/features/pricing/market/ src/jobs/markt_beobachtung_tick.py
#   -> muss 10.00/10 bleiben

# Frontend
cd web
bunx tsc --noEmit                              # 0 Fehler
bun run lint                                   # 0 Fehler; Warnungen zuletzt 292 — keine neuen
```

**Ausdrücklich verboten** (CLAUDE.md, mit Begründung dort):
- `next build` lokal — in keiner Variante.
- Wiederholte Volltests oder pytest im Hintergrund (8 GB RAM).
- Playwright. Für Laufzeitproben: `node scripts/diagnose/chrome-lesen.mjs`.
- Migrationen automatisch einspielen — nur über `supabase/apply-migrations.sh`.
- Committen, pushen, deployen ohne ausdrückliche Ansage des Nutzers.
- Dateien löschen ohne Auftrag.
- `git checkout --` (Hook-blockiert).

**Neue Tabelle?** RLS + `revoke` + gedanklicher `curl`-Test mit anon-Key
(lesen **und** schreiben) — Wurzel 6.

---

## 7. Wie du arbeiten sollst

**Messen, nicht annehmen.** Jede Aussage über Verhalten muss aus einem echten
Lauf gegen die Live-DB stammen. Der Nutzer hat mehrfach erlebt, dass etwas
„fertig" hieß und eine Attrappe war — der Markt-Faktor stand ein halbes Jahr
auf 1,0, ohne dass es jemand sah.

**Nicht fragen, bauen.** Der Nutzer hat mehrfach und deutlich gesagt, dass er
Rückfragen statt Ergebnissen nicht will („ES REICHT", „du hast genug
informationen", „ich habe keine lust mit dir zu diskutieren !! ich habe dir
einen auftrag gegeben"). Der Auftrag ist eindeutig: 50 km, alle Preise, täglich,
angezeigt. Bau ihn zu Ende. Nur wenn eine Entscheidung das Produkt in eine
andere Richtung lenkt (nicht: welchen Parameterwert du wählst), frag.

**Wissensgraph zuerst.** `.mcp.json` bringt den MCP-Server `graphify`
(46 760 Knoten). Vor jeder Änderung an einer Methode mit unbekannter
Aufruferzahl: `get_neighbors`. Vor dem Eintauchen in einen fremden Bereich:
`query_graph`. Nicht greppen, wo der Graph die Kanten kennt.

**Kommentare erklären das Warum.** Der Codestil dieses Projekts begründet
Entscheidungen im Code, mit Datum und Messwert, wo es eine gab. Beispiel aus
`beobachtung.py`:

```python
# Kantenlaenge eines Teilgebiets fuer die Karte (~11 km).
#
# Die Groesse ist gemessen, nicht geschaetzt. Mit 0,05 Grad (~5,5 km) zerfielen
# 16 Objekte einer Grobzelle in SIEBEN Teilgebiete, von denen nur EINES die
# Fuenferschwelle erreichte — die Karte waere fast leer geblieben.
```

Schreib so weiter. Keine Kommentare, die wiederholen, was der Code sagt.

**Deutsche Bezeichner und deutsche Oberflächentexte.** Das ist die
Projektsprache. Neue UI-Strings brauchen später i18n in 24 Sprachen — leg sie
so an, dass das möglich ist.

**Sprich Deutsch mit dem Nutzer.** Kurz, ohne Vorrede, ohne Zusammenfassung am
Ende, wenn er nicht danach fragt.

---

## 8. Abnahme — daran misst sich „fertig"

1. Ein voller `MarktBeobachtung.lauf()` gegen die Live-DB schreibt für **jeden**
   der 23 Stichtage Zeilen in `markt_punkt` — belegt durch eine Abfrage, die
   Zeilen je Tag zählt.
2. `marktstand_bauen()` liefert für ein Objekt mit aktiver Regel an **jedem**
   Tag der Kurve Kartenpunkte — belegt durch Ausgabe, nicht durch Behauptung.
3. Der Markt-Faktor bleibt wirksam (Referenz: 1,14–1,15 bei „Stjerneskud",
   550 DKK Basis gegen ~940 DKK Markt).
4. Der Erklärtext für leere Tage ist aus dem Normalfall verschwunden.
5. Ein zweiter Lauf am selben Tag erzeugt keine Dubletten.
6. Alle Gates aus § 6 grün.
7. Nichts committet.

Wenn ein Punkt nicht erreichbar ist, sag **welcher und warum** — mit Messwert.
Nicht drumherum bauen, nicht mit einem Hinweistext zudecken.
