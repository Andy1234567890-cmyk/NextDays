# KI-Autoantwort und Wissensdatenbank — der Plan

Der EINE Plan für dieses Vorhaben. Grundlage: Hostaways Hilfe-Center
(9 Artikel, gelesen — davon 4 im Volltext am 30.08.2026 nachgereicht:
Kontext, Best Practices, FAQ, Eskalationen), **alle 27 UI-Screenshots** in
`docs/ki auto/`,
Wettbewerbsrecherche (Guesty, Hospitable, iGMS, Enso, HostAI, Lodgify) und
eine Bestandsaufnahme des eigenen Codes samt Live-DB.

> **Stand 30.08.2026 (abends)**
>
> * **Etappe 1 + 2 (Backend): GEBAUT.** Migrationen 0492–0495 live.
> * **Etappe 3 + 4: GEBAUT.** Migrationen 0496–0500 live eingespielt und
>   gegengeprüft (0 Grants für anon/authenticated auf allen neuen Tabellen),
>   **4793 Tests grün**, ruff sauber, pylint 10.00/10, `tsc --noEmit` und
>   ESLint in web + builder ohne Fehler, 24 Sprachdateien vollständig mit
>   heilen Platzhaltern.
> * **Der Deploy steht aus.** Nichts davon läuft in Produktion.
>
> Was gegenüber dem Plan ANDERS gebaut wurde, mit Grund, steht in
> Abschnitt 21.
>
> **Korrektur vom 30.08.2026:** Nach dem Durchsehen der vier
> Nachtragsartikel kamen elf Punkte dazu. Der schwerste: „Fakten aus
> gesendeten Nachrichten lernen" stand hier als „bauen wir bewusst nicht" —
> das war meine Meinung gegen eine belegte Produktentscheidung. Es wird
> gebaut (Abschnitt 11a).
>
> Teil I beschreibt Befund und Architektur, **Teil II die Oberfläche bis ins
> einzelne Bedienelement**, Teil III den Stand und die Reihenfolge.

---

# TEIL I — Befund und Architektur

## 1. Der Befund: Was fehlt, ist nicht die Wissensdatenbank

Die Seite „Wissensdatenbank" ist gebaut und live **leer** (0 Zeilen in
`inbox_knowledge_fact`). Das ist aber nicht die eigentliche Lücke.

**Der Industriestandard sind ZWEI Schichten**, und uns fehlt die wichtigere:

| Schicht | Was | Bei uns |
|---|---|---|
| **Live-Kontext** | Wird zur Laufzeit eingespeist, nie gespeichert | fast ganz **fehlend** |
| **Kuratiertes Wissen** | Fakten, die jemand pflegt | gebaut, leer |

Hostaway speist die KI aus sechs Quellen. Fünf davon zieht das System
**automatisch**, ohne dass jemand etwas eintippt:

1. Objektdaten — Beschreibung, Ausstattung, Hausregeln, WLAN, Türcode,
   Schlüsselabholung, Stornobedingungen, Betten/Bäder
2. Reservierung — Gast, Personenzahl, Zahlungsstatus, An-/Abreise
3. Gesprächsverlauf — alle Nachrichten
4. **Kalender-Verfügbarkeit** — freie Zeiträume, Sperrgrund (gebucht /
   Eigentümer / Wartung), Mindest- und Höchstaufenthalt
5. Regeln des Betriebs
6. Wissensdatenbank (Handeingabe) ← **nur diese haben wir**

### Was bei uns ungenutzt herumliegt

Live gemessen:

```
properties.type_attributes->'messaging'   700.628 Zeichen, 19 Objekte
  Schlüssel: checkIn, checkOut, wifi, wifiName, wifiPassword,
             directions, doorInstructions, rules, localGuide, emergency
             (jeweils mehrsprachig {"de": …, "en": …})

properties.type_attributes->'policies'    193.937 Zeichen, 19 Objekte
  Schlüssel: checkInTime, checkOutTime, cancellation, payment,
             haustiereErlaubt, rauchenErlaubt, feiernErlaubt, kinderErlaubt,
             depositText, rentalAgreement, …

properties.description                     11.402 Zeichen, 39 von 44 Objekten
reservations                                  556 Zeilen
inbox_knowledge_fact                            0 Zeilen
```

Ein Betrieb hat die Gästemappe also **gepflegt** — die KI sieht davon
nichts. Er müsste jeden Fakt ein zweites Mal eintippen.

### Die Zahl, die die Architektur entscheidet

Ein einzelnes Objekt hat bis zu **39.744 Zeichen** Gästemappe. Das
Prompt-Limit des Vertex-Clients liegt bei **24.000**
(`ki_client.py:70`). Eine einzige Gästemappe sprengt den Prompt.

„Alles hineinschütten" ist damit ausgeschlossen. Es braucht Auswahl —
und zwar frageabhängig.

### Weitere Lücken

- **Keine automatische Antwort.** `ai_reply` ist ein Vorschlag auf
  Knopfdruck; ein Mensch sendet. Grep nach `auto_reply`/`auto_send`:
  null Treffer.
- **Keine Regeln.** Ein einziges Freitextfeld „Zusätzliche Anweisung"
  in `inbox_ai_settings`.
- **Keine Eskalation.**
- **Kein Retrieval.** `_wissen_fuer_thread` lädt bis zu 60 Fakten
  vollständig, ohne Bezug zur Frage.
- **Doppelte Logik.** `inbox/anhaenge.py:355` und
  `whatsapp/service.py:1157` sind zwei Kopien derselben Wissensauswahl.

---

## 2. Anbieterwechsel: Groq → Vertex

Entschieden am 29.08.2026. Der Posteingang läuft heute über **Groq**
(`inbox/ai.py:25`, Server in den USA). Vertex ist bereits gebaut
(`site_config/ki_client.py`, 415 Zeilen) und läuft in **europe-west4**.

Der Grund ist Datenschutz, nicht Technik: Gastnachrichten enthalten
Namen, Türcodes, Adressen und Aufenthaltszeiten. Die verlassen mit
diesem Wechsel die EU nicht mehr.

**Was der Wechsel bedeutet:**

- `VertexClient` wandert aus `site_config` an einen gemeinsamen Ort
  (`core/ki/`), weil ihn dann zwei Slices nutzen. Der Docstring in
  `ki_client.py:1-27` begründet heute noch das Nebeneinander beider
  Anbieter — er wird mit dem Wechsel unwahr und muss mit.
- `site_ai_usage.funktion` hat einen CHECK-Constraint mit sechs Werten
  (`0465_website_ki_nutzung.sql`). Für Gastantworten braucht es einen
  siebten — sonst schlägt jede Protokollzeile fehl.
- Groq bleibt vorerst für Preiserklärung (`pricing/explain.py`) und
  Dashboard-Chat. Kein Big-Bang.

---

## 3. Der Aufbau

### 3.1 Datenmodell

**Neue Tabellen** (eine Migration je Etappe, nicht alle auf einmal):

```
ki_regel                     Die Steuerung — was darf die KI, wie
  tenant_id, name, aktiv
  gilt_fuer            'alle' | 'auswahl'
  zustellart           'entwurf' | 'automatisch'
  anweisung            text (Freitext, Platzhalter erlaubt)
  ist_eskalation       bool   — dann wird NICHT geantwortet, sondern gemeldet
  benachrichtigen      bool
  verwendet_zaehler    int    — „Used"-Spalte aus dem Screenshot
  zuletzt_verwendet_at timestamptz

ki_regel_objekt              n:m, wenn gilt_fuer='auswahl'
  regel_id, property_id

ki_wissen_quelle             Woher ein Fakt stammt
  tenant_id, property_id (NULL = betriebsweit)
  art                  'manuell' | 'dokument' | 'nachricht' | 'objektdaten'
  datei_pfad, hochgeladen_von, created_at

ki_antwort_protokoll         Was die KI getan hat — Pflicht, nicht Kür
  tenant_id, thread_id, regel_id
  frage_auszug, antwort, zustellart, gesendet_at
  quellen jsonb        — welche Fakten/Felder die Antwort trugen
  eskaliert bool, grund text
```

**Bestehende erweitern:**

```
inbox_knowledge_fact  + titel text          (Screenshot zeigt Titel + Text)
                      + kategorie text      (Objekt / Buchung / Umgebung / Sonstiges)
                      + quelle_id           → ki_wissen_quelle
                      + embedding vector    (Etappe 3)

inbox_ai_settings     + aktiv bool          (der große Schalter)
                      + antwortlaenge text
                      + verzoegerung_minuten int
```

`source` gibt es in `inbox_knowledge_fact` bereits mit CHECK
`('manual','document','message')` — die Werte passen, es fehlt nur die
Verknüpfung zur Quelle.

### 3.2 Der Kontext-Sammler — das Herzstück

Ein Modul `inbox/ki_kontext.py`, das aus einem Thread den vollständigen
Kontext baut. **Es speichert nichts** — es liest bei jedem Aufruf frisch.

Das ist bewusst gegen Hospitables Weg entschieden: Deren „Knowledge Hub"
ist ein **Schnappschuss**, spätere Änderungen an den Objektdaten fließen
laut deren eigener Doku nicht nach. Ein WLAN-Passwort, das sich ändert,
bleibt dort für immer falsch. Das ist genau der Fehler, den unsere
Wurzel 1 beschreibt: eine Kopie ohne gepflegten Gegenzustand.

Quellen des Sammlers:

| Quelle | Woher | Anmerkung |
|---|---|---|
| Gästemappe | `properties.type_attributes->'messaging'` | mehrsprachig, Sprache des Gastes wählen |
| Richtlinien | `properties.type_attributes->'policies'` | Haustiere, Rauchen, Stornierung |
| Objekt | `properties.description`, Adresse, Kapazität | |
| Reservierung | bereits vorhanden über `get_reservation_detail` | |
| Verlauf | bereits vorhanden | |
| **Verfügbarkeit** | `availability`/`reservations` | neu; freie Zeiträume + Sperrgrund |
| Fakten | `inbox_knowledge_fact` | die kuratierte Schicht |

**Zwei Regeln, die nicht verhandelbar sind:**

1. **Der Datensplit gilt auch hier.** Der Kontext läuft durch dieselbe
   Gast-Maske wie der Posteingang (`load_guest_mask`). Ein Mitarbeiter
   ohne `VIEW_GUEST_NAME` darf über die KI nicht sehen, was ihm die
   Oberfläche verwehrt (Wurzel 3).
2. **Zugangsdaten nur bei bestätigter Buchung.** Türcode, WLAN und
   Adresse gehen nicht in den Kontext, solange die Reservierung nicht
   bestätigt ist. Hospitable hat das als nicht abschaltbare Sperre —
   zu Recht: eine Anfrage ist keine Buchung.

### 3.3 Retrieval — erst wenn nötig

**Etappe 1 und 2 kommen ohne Vektorsuche aus.** Der Kontext eines
Threads betrifft genau ein Objekt; dessen Gästemappe ist im Mittel
37.000 Zeichen, im schlimmsten Fall 39.744. Ein erster Schnitt nach
Abschnitten (checkIn, wifi, rules …) und eine Auswahl nach Stichwort
der Frage bringt das unter 24.000.

**Etappe 3 baut echtes Retrieval**, wenn die Praxis zeigt, dass die
Auswahl nach Stichwort nicht reicht. Die Postgres-Erweiterung `vector`
ist auf dem Server **verfügbar (0.8.2), aber nicht installiert** —
`create extension vector` genügt. Dann: Abschnitte in Blöcke schneiden,
Embedding je Block (Vertex `text-embedding`), Ähnlichkeitssuche zur
Frage, die besten 10 in den Prompt.

Ehrlicher Negativbefund aus der Recherche: **Kein Anbieter dokumentiert
öffentlich RAG, Embeddings oder eine Vektor-DB.** Weder Hostaway noch
Guesty noch Hospitable. Wer etwas über deren Retrieval behauptet, hat
keine Quelle. Wir bauen es, weil unsere Datenmenge es verlangt — nicht,
weil es Standard wäre.

### 3.4 Regeln

Aus den Screenshots (`image-11.png`, `image-12.png`) und Hostaways
Best-Practice-Artikel:

- **Eine Regel = ein Thema.** Bedingte Logik wird auf zwei Regeln
  aufgeteilt, nicht in eine „wenn/dann" gepresst.
- **Ton, Sprache und Signatur sind KEINE Regeln**, sondern stehen im
  Allgemein-Reiter. Als Regel formuliert würden sie auf jede Nachricht
  passen und die Zustell-Logik aushebeln.
- **Zustellart je Regel**: `entwurf` oder `automatisch`. Das ist der
  Kern der Steuerung — „die KI darf X beantworten" heißt: für X gibt es
  eine Regel mit `zustellart='automatisch'`.
- **Vorgabe ist immer `entwurf`.** Automatisch wird bewusst eingeschaltet.

**Fest eingebaute Sperre** (nicht abschaltbar): Zu Geld (Erstattung,
Rabatt, Entschädigung), Zahlungsdaten, Sicherheitsvorfällen und
Verfügbarkeitszusagen antwortet die KI **nie** automatisch — auch wenn
eine Regel es erlaubt. Sie erzeugt dort einen Entwurf. Der Grund ist
derselbe wie bei Hospitable: Diese Antworten sind entweder Geld wert
oder rechtlich bindend.

### 3.5 Wissenslücke: kein Entwurf, sondern ein benannter Mangel

Wenn die KI die Antwort nicht in den Quellen findet, erfindet sie
nichts und schreibt auch keine Ausweichfloskel. Sie meldet **welche
Angabe fehlt** und bietet an, sie als Fakt anzulegen.

Das ist Wurzel 4 in Produktform: kein plausibler Ersatzwert, sondern
lautes Fehlschlagen. Hostaway macht es genauso — es ist der Punkt, an
dem sich die Wissensdatenbank von selbst füllt.

### 3.6 Eskalation

Eine Regel mit `ist_eskalation = true` **antwortet nicht**, sondern
meldet. Zwei Auslöser:

- Negative Stimmung (das Modell beurteilt sie)
- Eigene Auslöser des Betriebs („kein warmes Wasser", „Anwalt",
  „Wasserschaden")

Die Meldung läuft über den bestehenden Benachrichtigungs-Katalog
(`notification_settings/katalog.py`), nicht über einen neuen Weg.

### 3.7 Debugging — Pflicht, nicht Zugabe

Hostaway hat ein sichtbares **Kontext-Panel**: Der Nutzer sieht, was
die KI weiß. Das übernehmen wir, und zwar aus einem konkreten Grund:
Ohne diese Ansicht ist eine falsche Antwort nicht diagnostizierbar —
man rät, ob ein Fakt fehlte, eine Regel griff oder das Modell sich
etwas zurechtlegte.

Drei Ebenen:

1. **Kontext-Panel** am Thread: alle Quellen, die in den Prompt gingen
2. **`sources` an jeder Antwort** (existiert bereits) — erweitert um
   den Weg, etwa `Gästemappe → WLAN`
3. **`ki_antwort_protokoll`**: was wurde wann warum gesendet, welche
   Regel griff, welche Quellen trugen es

Wie diese drei Ebenen in der Oberfläche aussehen, steht in Teil II
(Abschnitt 10.1 für das Kontext-Panel, 12 für die Quellen am Vorschlag).

---

# TEIL II — Die Oberfläche

Alles Folgende ist an den 27 Screenshots in `docs/ki auto/` gemessen, nicht
geschätzt. Die Farbwerte stammen aus einer Pixelmessung der Vorlagen.

## 4. Was fehlt — gezählt

| Element der Vorlage | Screenshot | Bei uns |
|---|---|---|
| Objektliste → Detailseite | `image-7`, `image-6` | flache Liste |
| Titel **und** Text je Fakt | `…16.54.55` | nur Text |
| Kategorie (7 Stück) | `…16.54.55` | **fehlt** |
| Quelle als Spalte | `image-6` | in der DB, unsichtbar |
| Volltextsuche | `image-7` | **fehlt** |
| Filter nach Kategorie/Quelle | `image-9` | nur Objekt-Auswahl |
| Sortierbare Spalten | `image-7` | **fehlt** |
| Mehrfachauswahl + Sammellöschen | `image-9` | **fehlt** |
| Paginierung („20 pro Seite") | `image-6` | **fehlt** |
| PDF-Import | `image-9` | **fehlt** |
| Regel-Dialog als Seitenpanel | `image-5`, `…16.26.48` | Inline-Block |
| Dreispaltiger Dialog-Aufbau | `image-5` | einspaltig |
| Zwei Eskalations-Schalter | `image-5` | ein Kontrollkästchen |
| Kontextmenü (⋮) je Zeile | `image-3` | zwei Icons |
| Antwortlänge | `…11.39.14` | **fehlt** |
| Verzögerung als Auswahl | `…17.19.37` | freies Zahlenfeld |
| Test-KI-Panel | `…11.48.25` | **fehlt** |
| Kontext-Panel (6 Quellen) | `…17.19.37` | nur Quellenliste |
| „KI beibringen" bei Lücke | `image-8` | **fehlt** |
| Vorlagen-Regeln | `…16.26.48` | **fehlt** |
| „Deaktiviert"-Abzeichen | `image-1` | **fehlt** |

Aus den Nachtragsartikeln (Kontext · Best Practices · FAQ), am 30.08.2026
ergänzt:

| Element der Doku | Bei uns |
|---|---|
| **Fakten aus gesendeten Nachrichten lernen** | **fehlt** (war fälschlich als „nicht bauen" eingeordnet) |
| **Eskalation durch negative Stimmung** | **fehlt** |
| **Eskalationshinweis am Thread** + Ansicht „Eskaliert" | **fehlt** |
| **Benachrichtigungskanal wählbar** | **fehlt** |
| Strukturierte Regeln (`Wann:` / `Antworte mit:`) | **fehlt** |
| Warnung vor den drei Anti-Mustern | **fehlt** |
| Verfügbarkeit am An-/Abreisetag, Sperrgrund, Min/Max | teils gröber |
| 6 Objektfelder (Ausstattung, Betten, Bäder, Kapazität, Reinigung, Zimmertyp) | **fehlt** im Kontext |
| 3 Reservierungsfelder (Gastland, Haustiere/Kleinkinder, Zahlungsstatus) | **fehlt** im Kontext |
| KI-Vorschlag in der App | **fehlt** |
| Objekt-Tags für Regelgruppen | **haben wir gar nicht** (siehe 18) |

## 5. Gestaltung — die gemessenen Werte

Aus den Vorlagen ausgelesen (Pixelmessung):

| Rolle | Vorlage | Bei uns |
|---|---|---|
| Akzent | `#00bdba` (Türkis) | `--accent` unseres Themas |
| Dunkel (Knöpfe, Schalter an) | `#181d27` | `--foreground` |
| Seitenhintergrund | `#fff7f2` (warm) | `--background` |
| Kartenfläche | `#ffffff` | `--card` |
| Zeilentrenner | `#eff0f0` | `--border` |
| „Automatisch"-Abzeichen | Fläche `#eafef3`, Rand `#b8f1ce` | **1:1 übernehmen** |
| „Deaktiviert"-Abzeichen | Fläche `#ffe7ad`, Text `#be6136` | **1:1 übernehmen** |
| Vorschlag-Rahmen | Verlauf `#ff004c` → `#ff7200` → `#ffab19` | **1:1 übernehmen** |

**Struktur pixelgenau, Farben aus unserem Thema** — mit drei Ausnahmen: die
beiden Abzeichenfarben und der Verlauf-Rahmen werden übernommen, weil sie
Bedeutung tragen (grün = sendet selbst, gelb = aus, Verlauf = von der KI).

Grund für den Rest: Hostaways Türkis auf unserem Hintergrund wäre eine dritte
Akzentfarbe im Produkt. Die drei Ausnahmen kommen als benannte Tokens in
`globals.css` — die Regel „keine arbitrary Hex" bleibt gewahrt.

Weiterhin verbindlich: **rem statt px**, **Pill-Knöpfe**, keine arbitrary
Hex-Werte in Klassen.

## 6. Der Rahmen: Kopfzeile und Reiter

```
┌──────────────────────────────────────────────────────────────────────┐
│  KI-Antworten  ⟨Deaktiviert⟩                                         │
│  ┌──────────┬────────┬───────────────────┐    [⬤ KI-Antworten an ⓘ] │
│  │Allgemein │ Regeln │ Wissensdatenbank  │        [✓ Speichern]      │
│  └──────────┴────────┴───────────────────┘                           │
└──────────────────────────────────────────────────────────────────────┘
```

**Titelzeile** — `font-display text-lg font-extrabold`. Rechts daneben, NUR
wenn der große Schalter aus ist, ein Abzeichen **„Deaktiviert"**
(`rounded-full px-2 py-0.5 text-xs`, gelb). Ist die KI an, steht dort nichts —
belegt durch `image-1` gegen `image-2`.

**Reiter** — Allgemein · Regeln · Wissensdatenbank. Der aktive trägt eine
2 px starke Unterstreichung in der Akzentfarbe und `font-semibold`; die
übrigen `text-muted-foreground`. Die Unterstreichung ist nur so breit wie der
Text, nicht wie die Zelle.

**Großer Schalter** rechts, mit Beschriftung, die den Zustand NENNT:
„KI-Antworten aktiv" / „KI-Antworten aus". Dahinter ein Fragezeichen mit
Tooltip (`image-13`):

> Lassen Sie die KI Gastfragen beantworten. Sie können vor dem Senden prüfen
> und freigeben — oder Regeln festlegen, die vollautomatisch antworten.

**„Speichern"** — dunkler Pill-Knopf mit Häkchen-Icon, nur aktiv bei
ungespeicherten Änderungen. Er gilt für „Allgemein"; Regeln und Fakten
speichern in ihren eigenen Dialogen.

**Verlassen mit ungespeicherten Änderungen** fragt nach. Eine Tonfall-
Einstellung, die beim Reiterwechsel still verfällt, ist ein Datenverlust, den
niemand bemerkt.

## 7. Reiter „Allgemein"

Zwei Karten untereinander (`rounded-2xl border bg-card p-6`), darin je eine
Überschrift, ein Trennstrich und Zeilen aus Beschriftung links (feste Breite
`14rem`) und Bedienelement rechts (max. `28rem`).

### 7.1 Karte „Allgemein"

| Beschriftung | Typ | Werte | Vorgabe |
|---|---|---|---|
| Tonfall * | Auswahl | Freundlich · Neutral · Formell · Locker | Freundlich |
| Antwortlänge * | Auswahl | **NEU** — Kurz · Standard · Ausführlich | Standard |
| Sprache * | Auswahl | Automatisch + 24 Sprachen | Automatisch |
| Signatur | Textfeld | max. 200 | leer |
| Zusätzliche Anweisung | Textbereich, 4 Zeilen | max. 1000, mit Zähler | leer |

Ein `*` markiert Pflichtfelder (in der Vorlage türkis, bei uns in der
Akzentfarbe).

**Antwortlänge** wirkt auf zwei Dinge: `MAX_ANTWORT_TOKENS` (300 / 600 / 1200)
und eine Zeile im System-Prompt. Ohne sie bekommt jeder Betrieb dieselbe
Länge — für ein Hotel zu knapp, für eine Ferienwohnung zu lang.

Unter „Sprache = Automatisch" kleingedruckt: *„In der Sprache des Gastes, wie
sie das Portal meldet."*

### 7.2 Karte „Automatische Antwort"

Direkt unter der Überschrift ein Erklärsatz (`text-sm text-muted-foreground`):

> Damit die KI selbst antwortet, legen Sie im Reiter „Regeln" eine Regel an
> und setzen deren Zustellung auf „Automatisch senden".

Dieser Satz steht so in der Vorlage (`…17.19.37`) und gehört übernommen: der
Schalter allein tut nichts, und das ist die häufigste Rückfrage.

| Beschriftung | Typ | Werte | Vorgabe |
|---|---|---|---|
| Verzögerung vor dem Versand * | Auswahl | Keine · 1 · 3 · 5 · 10 · 15 · 30 · 60 Minuten | 5 Minuten |

Auswahl statt freiem Zahlenfeld: „7 Minuten" bringt gegenüber „5" nichts, und
eine Liste ist auf dem Telefon bedienbar. Darunter:

> Zeit, in der Ihr Team zuvorkommen kann — und die die Antwort menschlicher
> wirken lässt. Antwortet in dieser Zeit ein Mensch, wird die KI-Antwort
> verworfen.

## 8. Reiter „Regeln"

### 8.1 Die Liste

```
┌────────────────────────────────────────────────────────────────────────┐
│  Regeln (12)                                    [+ Regel hinzufügen]   │
├────────────────────────────────────────────────────────────────────────┤
│      Regel                        Verwendet ⓘ  Gilt für     Geändert   │
├────────────────────────────────────────────────────────────────────────┤
│ ⬤   WLAN-Fragen  ⟨Automatisch⟩       13×     Alle Objekte  16.12.25 ⋮ │
│     WLAN-Code: 12345. Antworte freundlich und knapp; nenne das…        │
├────────────────────────────────────────────────────────────────────────┤
│ ○   Beschwerden  ⟨Eskalation⟩         0×     3 Objekte     07.10.25 ⋮ │
│     Bei Beschwerden übernimmt ein Mensch.                              │
└────────────────────────────────────────────────────────────────────────┘
```

**Kopfzeile:** „Regeln (12)" links, rechts ein dunkler Pill-Knopf
„+ Regel hinzufügen".

**Spaltenkopf** (`text-xs text-muted-foreground`, Zeilenhöhe `2.75rem`):
Regel · Verwendet · Gilt für · Geändert. Sortierbar sind Regel, Verwendet und
Geändert (Pfeil ⇅ am Kopf, aktiv ↑/↓). Hinter „Verwendet" ein Fragezeichen:
*„Wie oft diese Regel eine Antwort geprägt hat."*

**Je Zeile:**

| Element | Gestaltung |
|---|---|
| Kippschalter | `h-5 w-9`, an = Akzentfarbe, aus = `bg-muted`; wirkt sofort ohne Speichern |
| Name | `font-medium`, einzeilig gekürzt |
| Anweisung | darunter, `line-clamp-2 text-sm text-muted-foreground` |
| Abzeichen | grün „Automatisch" (`#eafef3`/`#b8f1ce`), gelb „Eskalation"; Entwurf trägt keins |
| Verwendet | `13×`; bei 0 in `text-muted-foreground` |
| Gilt für | „Alle Objekte" oder „3 Objekte" (klickbar → zeigt welche) |
| Geändert | Datum kurz |
| ⋮-Menü | Bearbeiten · Duplizieren · Löschen (`image-3`) |

**Warnhinweis** über der Liste, wenn automatische Regeln bestehen, der große
Schalter aber aus ist (gelber Kasten):

> Es gibt Regeln mit „Automatisch senden", aber die automatische Antwort ist
> ausgeschaltet.  **[Jetzt einschalten]**

### 8.2 Vorlagen-Regeln

Die Vorlage liefert fertige Regeln mit („Hostaway example: …", `…16.26.48`).
Wir übernehmen das mit **acht eigenen**:

| Name | Zustellart | Vorgabe |
|---|---|---|
| Sprache des Gastes treffen | Entwurf | an |
| Jede Teilfrage einzeln beantworten | Entwurf | an |
| Hausordnung nie übergehen | Entwurf | an |
| Nur mit Daten bestätigen, keine Rabatte | Entwurf | an |
| Zugangsdaten erst kurz vor Anreise | Entwurf | an |
| WLAN und Anreise beantworten | **Automatisch** | **aus** |
| Umgebungstipps geben | **Automatisch** | **aus** |
| Beschwerden eskalieren | Eskalation | aus |

Die automatischen sind **standardmäßig aus**: Vorlagen sind Angebote, keine
stillschweigende Erlaubnis, an Gäste zu schreiben.

Angeboten in einem Kasten über der Liste („Vorschläge zum Einschalten"), der
verschwindet, sobald der Betrieb sie übernommen oder weggeklickt hat. Das ist
zugleich der leere Zustand: Wer vor einer leeren Regelliste steht, legt keine
an.

### 8.3 Der Regel-Dialog

Rechtes **Seitenpanel** (`max-w-3xl`, von rechts eingeschoben), NICHT inline.
Dreispaltig: links Abschnittstitel mit Erklärung (`w-1/3`), rechts die Felder.

```
┌──────────────────────────────────────────────────────────────┐
│  Regel hinzufügen                                         ✕  │
├──────────────────────────────────────────────────────────────┤
│  Grundlagen *          Name *        [__________________]    │
│  Regeln sagen der KI,  Gilt für *    [Alle Objekte      ▾]   │
│  wie sie auf Gast-     Zustellung *  [Entwurf           ▾]   │
│  nachrichten           Aktiv *       [⬤]                     │
│  antworten soll                                               │
├──────────────────────────────────────────────────────────────┤
│  Anweisung *           ┌──────────────────────────────────┐  │
│  Beschreiben Sie, für  │                                  │  │
│  welche Nachrichten    │                                  │  │
│  die Regel gilt und    │                                  │  │
│  wie die KI antworten  └──────────────────────────────────┘  │
│  soll                                  0 / 2000     [{ }]    │
│  → Beispiele ansehen                                          │
├──────────────────────────────────────────────────────────────┤
│  Eskalation            Im Posteingang melden      [○]        │
│  Wann ein Mensch       Benachrichtigung senden ⓘ  [○]        │
│  übernehmen soll                                              │
│  → Mehr erfahren                                              │
├──────────────────────────────────────────────────────────────┤
│                               [Abbrechen]  [✓ Speichern]     │
└──────────────────────────────────────────────────────────────┘
```

Abschnitte durch Trennstriche getrennt, Fußzeile klebt unten
(`sticky bottom-0`).

**Feld für Feld:**

| Feld | Verhalten |
|---|---|
| Name * | max. 200; Speichern gesperrt, solange leer |
| Gilt für * | „Alle Objekte" / „Nur ausgewählte Objekte", mit Haus-Icon (`image-4`) |
| Objekte * | nur bei „ausgewählte": Mehrfachauswahl mit Suche, Gewählte als Chips mit ✕ |
| Zustellung * | „Entwurf (vor dem Senden prüfen)" / „Automatisch senden" |
| Aktiv * | Kippschalter, Vorgabe an |
| Anweisung * | Textbereich 6 Zeilen, max. 2000, Zähler unten rechts |
| Im Posteingang melden | Kippschalter, Vorgabe aus |
| Benachrichtigung senden | Kippschalter, Vorgabe aus, mit Fragezeichen |

**Zwei getrennte Eskalations-Schalter** statt eines Kontrollkästchens
(`image-5`). Das sind zwei Entscheidungen: „Im Posteingang melden" markiert
den Thread; „Benachrichtigung senden" schickt zusätzlich eine Meldung über den
bestehenden Katalog. Wer jede Beschwerde als E-Mail will, ist ein anderer
Betrieb als wer sie im Posteingang sehen will.

Ist einer der beiden an, wird „Zustellung" auf „Entwurf" gesetzt und gesperrt
— eine Eskalationsregel, die automatisch sendet, ist ein Widerspruch, der
stumm nichts täte.

**Platzhalter-Wähler** `{ }` am Textbereich (`image-12`): öffnet den bekannten
Katalog mit Suche und drei Gruppen (Standardfelder · Objektfelder ·
Buchungsfelder), fügt an der Cursorposition ein.

**„Beispiele ansehen"** öffnet eine Liste guter Anweisungen zum Übernehmen.

**Bearbeiten** nutzt dasselbe Panel mit dem Titel „Regel bearbeiten"
(`image-4`).

### 8.4 Strukturierte Regeln: Wann / Bedingung / Antworte mit / Außer

Die Vorlage empfiehlt ausdrücklich, Regeln mit **Bezeichnern** zu schreiben:

> Die Verwendung von Bezeichnungen wie `Wann:`, `Bedingung:`, `Antworte mit:`
> und `Außer:` direkt im Regeltext gibt der KI eine klare Struktur. Im
> Vergleich zu einem unstrukturierten Textblock liefern gekennzeichnete Regeln
> konsistentere und präzisere Antworten.

| Bezeichner | Pflicht | Bedeutung |
|---|---|---|
| **Wann:** | ja | Die Gastnachricht oder Situation, die die Regel auslöst |
| **Bedingung:** | nein | Zusätzliche Voraussetzung |
| **Antworte mit:** | ja | Was die KI antworten soll |
| **Außer:** | nein | Sonderfälle, in denen die Regel NICHT gilt |

**Umsetzung:** Freitext bleibt Freitext (die Vorlage nutzt denselben Editor),
aber der Textbereich bekommt vier Einfügeknöpfe über dem Feld und eine
Platzhalter-Vorlage beim Anlegen:

```
Wann:
Antworte mit:
```

Wer strukturiert schreiben will, hat es leicht; wer frei schreibt, wird nicht
gehindert. **Kein Zwang** — eine erzwungene Struktur wäre vier Pflichtfelder,
wo die Vorlage einen Textbereich hat.

**„Beispiele ansehen"** öffnet die sechs Muster aus der Doku, jedes zum
Übernehmen: Sprachwahl · Grußformel · Bedingte Antwort (A/B) ·
Bestätigung des Gastes · Gebührenanfrage · Fehlerbehebung (A/B).

### 8.5 Die Anti-Muster als Warnung im Dialog

Die Doku nennt sechs Fehler, die Betriebe machen. Drei davon kann die
Oberfläche erkennen und beim Speichern warnen (nicht blockieren):

| Anti-Muster | Erkennung | Warnung |
|---|---|---|
| **Ton-/Sprachregel** | Anweisung enthält „Ton", „Sprache", „Signatur", „antworte auf …" ohne „Wann:" | „Ton, Sprache und Signatur gehören in den Reiter „Allgemein". Als Regel treffen sie auf jede Nachricht zu und hebeln die Zustell-Logik aus." |
| **Wenn/Dann in einer Regel** | Text enthält „wenn … sonst" oder „falls nicht" | „Bedingte Logik gehört in zwei Regeln — eine je Zweig. Das gibt der KI eindeutige Anweisungen." |
| **Doppelte Anweisung** | Zwei aktive Regeln mit sehr ähnlichem Text | „Eine ähnliche Regel gibt es bereits (…). Jede Anweisung sollte an genau einer Stelle stehen." |

Warnungen, keine Sperren: der Betrieb kennt sein Geschäft. Aber diese drei
Fehler kosten Antwortqualität, und niemand merkt es von allein.

**Ein Hinweis, der immer steht** (unter dem Speichern-Knopf):

> Änderungen gelten nur für neue Nachrichten. Bereits erzeugte Entwürfe
> bleiben, wie sie sind.

Das steht so in der Doku und ist die zweithäufigste Rückfrage.


## 9. Reiter „Wissensdatenbank"

Zwei Ebenen wie in der Vorlage: erst die Objekte, dann deren Fakten.

### 9.1 Ebene 1 — Objektliste

```
┌────────────────────────────────────────────────────────────────────┐
│                                              [🔍 Suchen…]          │
├────────────────────────────────────────────────────────────────────┤
│  Objekt (29) ⇅         Ort           Fakten     Geändert ↑         │
├────────────────────────────────────────────────────────────────────┤
│  ▣ Betriebsweit        —                3      12.05.26        ⋮   │
├────────────────────────────────────────────────────────────────────┤
│  🖼 FeWo Stjerneskud   Hirtshals        5      27.03.26        ⋮   │
│  🖼 Feriehus Line      Vidstrup         0      —               ⋮   │
├────────────────────────────────────────────────────────────────────┤
│  Pro Seite: [20 ▾]                ← Zurück   1   Weiter →          │
└────────────────────────────────────────────────────────────────────┘
```

**Je Zeile:** Objektfoto (`size-8 rounded object-cover`; fehlt es, ein
Platzhalter-Icon — kein erfundenes Bild), Name `font-medium`, Ort,
Faktenzahl, Datum der letzten Änderung, ⋮-Menü (Fakten anzeigen · Fakten
hochladen).

**Zeile „Betriebsweit"** ganz oben, optisch abgesetzt: die Fakten ohne
Objektbezug. In der Vorlage fehlt sie, weil dort jeder Fakt an einem Listing
hängt — bei uns gibt es betriebsweite Fakten, und ohne diese Zeile wären sie
unerreichbar.

**Suche** über Name und Ort, entprellt (300 ms). **Sortierbar** nach Objekt,
Fakten und Geändert. **Paginierung** unten: „Pro Seite" (10/20/50) links,
Zurück/Seite/Weiter rechts.

Die Spalte **Fakten** ist die Botschaft dieser Ansicht: Sie zeigt auf einen
Blick, welche Objekte gepflegt sind. Eine `0` steht in
`text-muted-foreground` — nicht rot: ungepflegt ist kein Fehler, sondern ein
Hinweis.

### 9.2 Ebene 2 — Fakten eines Objekts

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Zurück zur Wissensdatenbank                                     │
│  🖼 FeWo Stjerneskud                                                │
│  📍 Hirtshals    ☰ Fakten: 5     [📄 Fakten hochladen]  [+ Fakt]   │
├────────────────────────────────────────────────────────────────────┤
│  [⚙ Filter]                                  [🔍 Suchen…]          │
├────────────────────────────────────────────────────────────────────┤
│  ☐  Fakt (5) ⇅               Kategorie      Quelle    Geändert ↑   │
├────────────────────────────────────────────────────────────────────┤
│  ☐  WLAN-Passwort            Ausstattung    Manuell   12.05.26 ⋮   │
│     Netz MERCUSYS_E4E4, Passwort 23473393                          │
├────────────────────────────────────────────────────────────────────┤
│  ☐  Tauben auf dem Balkon    Sonstiges      Dokument  27.03.26 ⋮   │
│     Wenn Tauben auf den Balkon kommen, bitte nicht stören…         │
├────────────────────────────────────────────────────────────────────┤
│  2 ausgewählt          [🗑 Löschen]                                 │
│  Pro Seite: [20 ▾]                ← Zurück   1   Weiter →          │
└────────────────────────────────────────────────────────────────────┘
```

**Kopf:** Zurück-Link, Objektfoto + Name, darunter Ort und Faktenzahl mit
Icons. Rechts zwei Knöpfe: „Fakten hochladen" (hell, Dokument-Icon) und
„+ Fakt" (dunkel) — `image-6`.

**Je Zeile:** Kontrollkästchen, **Titel** `font-medium`, darunter der Text
einzeilig gekürzt, Kategorie als Wort, Quelle als Wort, Datum, ⋮-Menü
(Bearbeiten · Löschen).

Kategorie als **Wort, nicht als Farbpunkt**: sieben Farben kann niemand
auseinanderhalten.

**Mehrfachauswahl:** Kontrollkästchen je Zeile plus „alle wählen" im Kopf.
Sobald etwas gewählt ist, schiebt sich unten eine Leiste ein: „2 ausgewählt"
und „Löschen" (mit Rückfrage).

**Filter** öffnet ein Panel: Kategorie (7 Kontrollkästchen) und Quelle (3).
Aktive Filter erscheinen als Chips neben dem Knopf, mit ✕ und „Alle
zurücksetzen".

**Suche** über Titel und Text, entprellt.

### 9.3 Fakt anlegen und bearbeiten

Seitenpanel (`max-w-xl`):

| Feld | Typ | Regeln |
|---|---|---|
| Titel * | Textfeld | max. 200 |
| Fakt * | Textbereich, 6 Zeilen | max. 2000, mit Zähler |
| Kategorie * | Auswahl | die sieben |
| Gilt für | Auswahl | Nur dieses Objekt / Alle Objekte |

Die sieben Kategorien:

| Wert | Beschriftung | Beispiel |
|---|---|---|
| `objekt` | Objektangaben | Größe, Lage, Betten |
| `anreise` | An- und Abreise | Zeiten, Schlüssel, Türcode |
| `buchung` | Buchung und Zahlung | Storno, Kaution, Rechnung |
| `umgebung` | Umgebung | Restaurants, Strand, Ausflüge |
| `stoerung` | Störungen | Was tun bei Defekt, Notfallnummer |
| `ausstattung` | Ausstattung | WLAN, Sauna, Grill, Waschmaschine |
| `sonstiges` | Sonstiges | alles andere |

### 9.4 PDF-Import

**Schritt 1 — Hochladen.** Seitenpanel (`image-9`):

```
┌───────────────────────────────────────────┐
│  Fakten hochladen                      ✕  │
├───────────────────────────────────────────┤
│  Datei *                                   │
│  ┌─────────────────────────────────────┐  │
│  │               ⬆                      │  │
│  │  Klicken zum Hochladen oder Datei    │  │
│  │           hierher ziehen             │  │
│  │           PDF (max. 20 MB)           │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  Gilt für *   [Nur ausgewählte Objekte ▾] │
│  Objekte *    [FeWo Stjerneskud ✕      ▾] │
├───────────────────────────────────────────┤
│                  [Abbrechen] [Hochladen]  │
└───────────────────────────────────────────┘
```

Ablagefeld gestrichelt, Wolken-Icon, bei Dateiüberfahrt in der Akzentfarbe.
Nach der Wahl: Dateiname, Größe und ✕ zum Entfernen. Nur PDF, max. 20 MB —
beides **serverseitig** geprüft, nicht nur im Dialog.

**Schritt 2 — Prüfen.** Der Import ist **zweistufig**:

```
┌─────────────────────────────────────────────────────────┐
│  12 Fakten gefunden in „Hausordnung_2026.pdf"           │
│  Prüfen Sie, was übernommen werden soll.                │
├─────────────────────────────────────────────────────────┤
│  ☑  Ruhezeiten                    [Hausordnung     ▾]   │
│     Von 22 bis 7 Uhr gilt Nachtruhe.                    │
├─────────────────────────────────────────────────────────┤
│  ☑  Mülltrennung                  [Sonstiges       ▾]   │
│     Restmüll in die graue Tonne, Papier in die blaue.   │
├─────────────────────────────────────────────────────────┤
│  ☐  Preisliste 2024               [Sonstiges       ▾]   │
│     Übernachtung ab 89 €                                │
│     ⚠ Enthält einen Betrag — bitte prüfen, ob aktuell   │
├─────────────────────────────────────────────────────────┤
│  2 von 12 gewählt         [Verwerfen] [✓ Übernehmen]    │
└─────────────────────────────────────────────────────────┘
```

Titel und Text sind editierbar, die Kategorie je Vorschlag änderbar.

**Warum zweistufig** — das geht über die Vorlage hinaus: Ein Dokument, das
ungeprüft in die Wissensdatenbank fließt, macht die KI zur Sprecherin eines
Textes, den niemand gelesen hat, inklusive veralteter Preise und alter
Türcodes. Die Vorlage zeigt nur den Upload, nicht was danach passiert.

**Der Warnhinweis** erscheint, wo das Modell einen Betrag oder eine Jahreszahl
erkennt. Ein alter Preis in der Wissensdatenbank ist eine falsche Zusage.

**Während der Verarbeitung** zeigt das Panel einen Fortschritt („Dokument wird
gelesen…"). Schlägt es fehl, steht der Grund da — nicht „Fehler".

## 10. Test-KI und Kontext

Rechte Spalte neben allen drei Reitern (`w-96`), mit zwei eigenen Reitern und
einem Knopf zum Ein-/Ausklappen (`…17.19.37`).

### 10.1 Reiter „Kontext"

```
┌──────────────────────────────┐
│  Test-KI  │  Kontext      ⧉  │
├──────────────────────────────┤
│  KI-Kontext                  │
│  Woraus die KI ihre          │
│  Antworten baut              │
├──────────────────────────────┤
│  ☰ Wissensdatenbank       ▾  │
│  📅 Aktuelle Verfügbarkeit ▾  │
│  📅 Kalender (120 Tage)    ▾  │
│  💬 Gesprächsverlauf       ▾  │
│  🏠 Objektangaben          ▾  │
│  📋 Reservierung           ▾  │
└──────────────────────────────┘
```

Sechs ausklappbare Abschnitte, je mit Icon. Aufgeklappt stehen die
**tatsächlichen Werte** für das gewählte Objekt — nicht eine Beschreibung,
sondern der Text, der in den Prompt geht.

Je Abschnitt oben rechts die Zeichenzahl (`7.220 Zeichen`), bei gekürzten ein
Hinweis: *„gekürzt von 8.941 auf 2.502 Zeichen"*.

**Gesperrte Abschnitte** (Türcode ohne bestätigte Buchung) erscheinen
ausgegraut mit dem Grund daneben — nicht unsichtbar, sonst sucht jemand den
Fehler in der Gästemappe.

**Das ist die Debugging-Pflicht in Produktform.** Ohne diese Ansicht ist eine
falsche Antwort nicht diagnostizierbar.

### 10.2 Reiter „Test-KI"

```
┌──────────────────────────────┐
│  Test-KI  │  Kontext    ↺ ⧉  │
├──────────────────────────────┤
│  Testen als                  │
│  [FeWo Stjerneskud       ▾]  │
├──────────────────────────────┤
│  Gast: Wie ist das WLAN?     │
│                              │
│  KI: Das Netz heißt          │
│  MERCUSYS_E4E4, das          │
│  Passwort 23473393.          │
│  ┌────────────────────────┐  │
│  │ Quellen (3)         ▾  │  │
│  │ ✓ Gästemappe → WLAN    │  │
│  │ ✓ Objektdaten          │  │
│  │ ⚠ Hausordnung gekürzt  │  │
│  └────────────────────────┘  │
│  Regel: WLAN-Fragen          │
│  Zustellung: Automatisch     │
├──────────────────────────────┤
│  [Frage eingeben…]      [→]  │
└──────────────────────────────┘
```

**Es wird nichts gesendet.** Der Test läuft gegen dieselbe Kette wie der
Ernstfall, nur ohne Versand — und zeigt, was im Ernstfall passieren WÜRDE:
welche Regel griff, welche Zustellart, ob eine Sperre zuschlug.

Objektauswahl oben (`…11.48.25`). Das Rückstell-Icon (↺) leert das Gespräch.
Mehrere Fragen nacheinander bauen einen Verlauf auf — wie im Ernstfall.

Ein Betrieb kann so vor dem Einschalten prüfen, ob seine Regeln greifen.

### 10.3 Die sechs Kontextquellen im Einzelnen

Die Doku listet auf, was in jeder Quelle steht. Der Plan hatte das gröber;
hier steht, was das Kontext-Panel je Abschnitt zeigen MUSS — und was unser
Sammler heute schon liefert:

**1. Wissensdatenbank** — alle Fakten des Objekts plus die betriebsweiten.
*Gebaut.*

**2. Aktueller Verfügbarkeitsstatus** — vier Aussagen, die die Vorlage
ausdrücklich nennt:

| Aussage | Bei uns |
|---|---|
| Check-in am Abreisetag des Gastes möglich? | ableitbar aus `freie_einheiten_spannen` |
| Abreise am Anreisetag möglich? | ableitbar |
| Am Tag VOR der Anreise frei? | ableitbar — trägt „können wir früher kommen?" |
| Am Abreisetag frei? | ableitbar — trägt „können wir später bleiben?" |

Diese vier sind heute NICHT ausformuliert; der Sammler liefert nur die
Spannen. Sie werden als eigene Zeilen ergänzt: „Früher anreisen (09.09.):
1 Einheit frei". Ohne sie muss das Modell aus Spannen rechnen, und genau da
irrt es.

**3. Kalenderverfügbarkeit** — Spannen, **Sperrgrund** (gebucht / vom
Eigentümer gesperrt / Wartung) und **Mindest-/Höchstaufenthalt** je Spanne.
Der Sperrgrund fehlt heute: `availability.status` und `label` tragen ihn,
der Sammler liest ihn nicht. Wird ergänzt — „belegt" und „wegen Wartung
gesperrt" sind für den Gast zwei verschiedene Antworten.

**4. Gesprächsverlauf** — alle ein- und ausgehenden Nachrichten. *Gebaut.*

**5. Objektangaben** — die Doku listet 15 Felder. Abgleich:

| Feld | Bei uns |
|---|---|
| Beschreibung, Adresse, Stadt | gebaut |
| Ausstattung | **fehlt** — `properties.amenities` wird nicht gelesen |
| Stornierungsbedingungen | gebaut (`policies.cancellation`) |
| Reinigungsstatus | **fehlt** — trägt „ist schon sauber?" |
| Bäder, Schlafzimmer, Betten (Zahl + Art) | **fehlt** |
| Hausregeln | gebaut |
| Schlüsselabholung | gebaut (`doorInstructions`) |
| Max. Kinder und Haustiere | teilweise (`haustiereMax`) |
| Gästekapazität, Zimmertyp | **fehlt** |
| WLAN-Zugangsdaten | gebaut |

Sechs Lücken. Alle sind einfache Spalten an `properties` — sie kommen in den
Sammler, mit demselben Zeichendeckel wie der Rest.

**6. Reservierungsdetails** — Türcode, Zeiten, Gastland, Name, Anzahl
Gäste/Kinder/Haustiere/Kleinkinder, Zahlungsstatus, Status.
Bei uns fehlen heute **Gastland**, **Haustiere/Kleinkinder** und
**Zahlungsstatus**. Der Zahlungsstatus ist der wichtigste davon: „habe ich
schon bezahlt?" ist eine häufige Frage, und ohne ihn muss die KI passen.


## 11. Im Chat: „KI beibringen"

Findet die KI die Antwort nicht, erscheint im Verlauf ein Kasten (`image-8`):

```
┌───────────────────────────────────────────────────┐
│  ⓘ  Der KI das für die Zukunft beibringen      ✕  │
│                                                    │
│  • Ergänzen Sie, ob es eine Ladestation gibt —    │
│    wo sie steht, welcher Stecker, welche Kosten.  │
│  • Halten Sie fest, ob sie allen Gästen offen     │
│    steht oder reserviert werden muss.             │
│                                                    │
│                              [Fakten hinzufügen]  │
└───────────────────────────────────────────────────┘
```

Heller Kasten mit Info-Icon, Aufzählung, rechts unten der Knopf in der
Akzentfarbe. Schließbar mit ✕.

**„Fakten hinzufügen"** öffnet den Fakt-Dialog mit **vorausgefülltem Titel und
Kategorie**, das Objekt ist gesetzt. Der Betrieb muss nur den Text schreiben.

Das ist der Punkt, an dem sich die Wissensdatenbank von selbst füllt: der
Betrieb sieht die Lücke genau dann, wenn sie ihn stört. Ohne diesen Weg bleibt
sie leer, egal wie gut die Verwaltungsmaske ist.

Der Vorschlagstext kommt aus demselben Vertex-Aufruf wie die Antwort — ein
zweiter Aufruf für einen Hinweis wäre die Rechnung nicht wert.

## 11a. Aus gesendeten Nachrichten lernen

**Entschieden am 30.08.2026: still im Hintergrund, wie in der Vorlage.**

Jede Antwort, die ein MENSCH an einen Gast sendet, wird ausgewertet. Findet
das Modell darin einen Fakt, der noch nicht in der Wissensdatenbank steht,
legt es ihn an — mit Quelle `Nachrichten`. Ohne Rückfrage, ohne Kennzeichnung,
ohne zusätzlichen Klick.

> Sie machen einfach das, was Sie ohnehin schon tun: Sie antworten den Gästen.
> Währenddessen beobachtet die KI im Stillen, erfasst nützliche neue Fakten
> und lernt, zukünftige, sich wiederholende Fragen besser zu beantworten.

**Die Kontrolle sitzt danach, nicht davor** — genau wie in der Vorlage
beschrieben: Objektliste nach „Geändert" sortieren, oben stehen die Objekte
mit den neuesten Fakten, anklicken, durchsehen, anpassen oder löschen. Der
Filter „Quelle = Nachrichten" zeigt gezielt die automatisch gelernten.

**Was ausgewertet wird und was nicht:**

| Nachricht | Ausgewertet |
|---|---|
| Von einem Menschen an den Gast gesendet | **ja** |
| Von der KI gesendet (`quelle='ki'`) | nein — sonst lernt sie von sich selbst |
| Automail (`quelle='automation'`) | nein — Vorlagentext, kein Wissen |
| Vom Gast eingegangen | nein — das ist die Frage, nicht die Antwort |

Der Ausschluss der eigenen Antworten ist kein Detail: Ohne ihn schriebe die
KI ihre eigenen Formulierungen als „Fakten" fort und verstärkte jeden Fehler,
den sie einmal gemacht hat.

**Wann ausgewertet wird:** im selben Tick wie der Versand, aber als eigener,
best-effort Schritt. Schlägt die Auswertung fehl, ist die Nachricht trotzdem
beim Gast — sie ist das Wichtigere.

**Was ein Fakt sein darf:** eine Angabe über das Objekt oder den Betrieb, die
auch für den nächsten Gast gilt. NICHT: Absprachen mit diesem einen Gast
(„Ich lege Ihnen den Schlüssel unter die Matte"), Höflichkeitsfloskeln,
Terminzusagen. Das steht so im Extraktions-Prompt und wird von einem Test
abgedeckt.

**Dubletten:** Vor dem Anlegen wird gegen die bestehenden Fakten desselben
Objekts geprüft. Ein Fakt, der dasselbe sagt wie ein vorhandener, wird nicht
angelegt — sonst steht das WLAN-Passwort nach zwanzig Antworten zwanzigmal da.

**Nicht abschaltbar in dieser Runde.** Die Vorlage kennt keinen Schalter, und
ein Schalter, den niemand findet, ist keiner. Wer die Fakten nicht will,
löscht sie über den Filter — das ist derselbe Weg, den die Vorlage empfiehlt.


## 11b. Eskalation: negative Stimmung erkennen

Die Vorlage erkennt **zwei** Arten von Eskalation. Bisher hatte der Plan nur
die zweite:

1. **Negative Stimmung** — das Modell beurteilt sie. Braucht keine Regel.
2. **Eigene Auslöser** des Betriebs — „kein warmes Wasser", „Anwalt",
   „Waschbär". Als Eskalationsregel formuliert.

**Entschieden am 30.08.2026: im selben Aufruf mitliefern.** Das Modell gibt
zusammen mit der Antwort eine Einschätzung zurück:

```json
{ "antwort": "…", "stimmung": "negativ", "grund": "Gast ist verärgert über…" }
```

Kein zweiter Vertex-Aufruf: bei 556 Reservierungen wäre ein eigener Aufruf je
eingehender Nachricht auf der Rechnung spürbar, und die Latenz käme obendrauf.

**Der Preis dieser Wahl, offen benannt:** Die Stimmungsprüfung greift nur,
wenn ohnehin eine Antwort erzeugt wird. Ein Thread ohne passende Regel wird
nicht bewertet. Für die Praxis reicht das — die Beschwerde eines Gastes ist
fast immer eine Nachricht, auf die man antworten will. Zeigt sich das anders,
kommt ein eigener, günstiger Aufruf nach.

### Der Eskalationshinweis am Thread

Erkennt die KI eine Eskalation, bekommt die Konversation ein Merkmal — das
steht so in der Vorlage („Konversationen mit negativem Tenor erhalten im
Posteingang einen Eskalationshinweis"):

```
┌────────────────────────────────────────────────┐
│ 🔴 Karmina Cordero            ⟨Eskalation⟩     │
│    Das ist jetzt die dritte Nacht ohne war…    │
│    FeWo Stjerneskud · vor 4 Min.               │
└────────────────────────────────────────────────┘
```

* **In der Thread-Liste**: rotes Abzeichen „Eskalation", Zeile hervorgehoben
* **Im Filter**: eine eigene Ansicht „Eskaliert" neben Aktiv/Archiv/Papierkorb
* **Im Thread**: ein Kasten oben mit dem Grund
  (*„Gast ist verärgert über fehlendes warmes Wasser"*) und
  **[Erledigt]** zum Zurücknehmen
* **Kein Vorschlag** wird gesendet, auch mit automatischer Regel nicht

Das Merkmal ist zurücknehmbar. Eine Eskalation, die nur ein Mensch für
erledigt erklären kann, ist eine Aufgabe — keine dauerhafte Markierung.

### Benachrichtigung, Kanal wählbar

Die Vorlage lässt den Kanal wählen (Mobil · Desktop · E-Mail · aus). Bei uns
ist das der bestehende Benachrichtigungs-Katalog: eine neue Kategorie
`ki_eskalation` im Tab „Posteingang" mit den Kanälen **E-Mail und Push**.

Kein SMS-Kanal: eine Beschwerde ist dringend, aber keine SMS wert — dieselbe
Abwägung wie bei den anderen Posteingang-Kategorien.

Der Schalter „Benachrichtigung senden" in der Regel entscheidet, OB gemeldet
wird; der Katalog entscheidet, WIE. Zwei Ebenen, wie überall sonst im Produkt.


## 12. Der Antwortvorschlag im Chat

Bleibt inline, bekommt aber den **Farbverlauf-Rahmen** aus der Vorlage
(`image.png`, gemessen): 2 px, links `#ff004c` über `#ff7200` nach rechts
`#ffab19`.

Umgesetzt als Hülle mit `bg-gradient-to-r` und innenliegender Karte. Er
unterscheidet den KI-Vorschlag vom Rest des Verlaufs, ohne ein Abzeichen zu
brauchen.

Bereits gebaut: Quellen-Aufklapper, „Bearbeiten", „Senden", ✕ zum Verwerfen.

## 13. Verhalten auf kleinen Schirmen

| Bereich | Unter 768 px |
|---|---|
| Reiter | waagerecht scrollbar |
| Test-/Kontext-Panel | eingeklappt; Knopf in der Kopfzeile öffnet es als Vollbild |
| Regel-Dialog | Vollbild statt Seitenpanel |
| Tabellen | Karten statt Zeilen, Spalten untereinander |
| Kopfzeile | Titel und Schalter untereinander |

## 13a. Mobile

Die Vorlage unterstützt KI-Antworten **auch in der App**. Bei uns ist das
`mobile-nextdays` (die Verwaltungs-App des Betriebs).

**In dieser Runde:** der Antwortvorschlag im Chat — derselbe Weg, dieselbe
API, mit Quellen-Aufklapper und „Bearbeiten/Senden". Das Auto-Lernen aus
gesendeten Nachrichten greift dort automatisch mit, weil es serverseitig am
Versand hängt und nicht an der Oberfläche.

**Nicht in dieser Runde:** Regeln und Wissensdatenbank verwalten. Beides sind
Tabellen mit Filtern, Sortierung und Seitenpanels — auf dem Telefon ein
eigenes Vorhaben. Der Betrieb pflegt sie am Rechner, die App nutzt sie.

Der Eskalationshinweis erscheint in der App als Push (Kategorie
`ki_eskalation`) und als Abzeichen in der Thread-Liste.


## 14. Leere Zustände

| Wo | Text |
|---|---|
| Regeln, keine | „Noch keine Regeln. Ohne Regel schlägt die KI nur vor und sendet nie von allein." + Vorlagen-Regeln |
| Objektliste, keine Objekte | „Keine Objekte angelegt." + Link zu `/objekte` |
| Fakten, keine | „Für dieses Objekt sind noch keine Fakten hinterlegt. Die KI nutzt trotzdem Gästemappe, Richtlinien und Kalender." |
| Suche ohne Treffer | „Keine Treffer für „xyz"." + „Suche zurücksetzen" |
| Protokoll, leer | „Noch keine KI-Antworten." |

Der Text bei den Fakten ist wichtig: Ein Betrieb, der „keine Fakten" liest,
hält die KI für ahnungslos — dabei kennt sie die ganze Gästemappe.

## 14a. Verhalten, das erklärt werden muss

Vier Punkte aus der FAQ, die als Rückfrage ankommen, wenn die Oberfläche sie
nicht selbst beantwortet:

| Verhalten | Wo es steht |
|---|---|
| **Nur neue Nachrichten** bekommen einen Vorschlag. Was vor dem Einschalten ankam, bleibt ohne. | Hinweis im leeren Zustand des Chats, einmalig nach dem Einschalten |
| **Nur wenn die letzte Nachricht vom Gast ist.** Hat der Gastgeber zuletzt geschrieben, gibt es nichts vorzuschlagen. | ergibt sich; kein Hinweis nötig |
| **Regeländerungen wirken nicht rückwirkend** auf bereits erzeugte Entwürfe. | Satz unter dem Speichern-Knopf im Regel-Dialog (8.5) |
| **Die KI lernt nicht daraus, dass Sie den Vorschlag bearbeiten** — sie lernt aus Fakten und (neu) aus gesendeten Nachrichten. | Tooltip am Vorschlag |

Der letzte Punkt ist der wichtigste: Wer glaubt, seine Korrekturen bringen der
KI etwas bei, korrigiert monatelang dieselbe Stelle. Das Auto-Lernen aus
gesendeten Nachrichten (11a) macht diese Erwartung nachträglich wahr — aber
nur für Fakten, nicht für den Ton.


---

# TEIL III — Stand, Daten und Reihenfolge

## 15. Was am 29.08.2026 gebaut wurde

### Etappe 1 — Der Kontext

| Datei | Was |
|---|---|
| `core/ki/client.py` | Vertex-Client, aus `site_config` hierher verschoben |
| `inbox/ki_kontext.py` | Der Sammler |
| `inbox/ki_antwort.py` | Prompt, Aufruf, Vorschlag — eine Stelle für Posteingang UND WhatsApp |
| 0492 | `site_ai_usage.funktion` kennt `gast_antwort` |

**Drei Doppelungen verschwunden:** `anhaenge._wissen_fuer_thread` und
`whatsapp._ki_wissen` (zwei Kopien derselben Abfrage) sowie der zweite
Prompt-Vorbau im WhatsApp-Pfad.

**Ein Bug fiel auf:** `whatsapp._ki_reservierung` gab die Objekt-ID in JEDEM
Zweig als `None` zurück. Objektbezogene Fakten haben den WhatsApp-Pfad nie
erreicht, obwohl der Code so aussah, als täte er es.

**Zwei Live-Datenformen, die kein Leser kannte:** `checkIn` liegt bei einem
Objekt als blanker String vor (`messaging_texte` verwirft das still), und
`directions`/`localGuide` stehen als `{"da":"","de":"","en":""}` da — wahr,
aber leer.

### Etappe 2 — Regeln und Autoantwort

| Datei | Was |
|---|---|
| `inbox/ki_regeln.py` | Regeln, Zustell-Entscheidung, Themensperre, Protokoll |
| `inbox/ki_autoantwort.py` | Planen → Abbrechen → Senden |
| 0493 | `ki_regel`, `ki_regel_objekt`, `ki_antwort_protokoll`, großer Schalter |
| 0494 | `ki_autoantwort_warteschlange` (partielles UNIQUE je Thread) |
| 0495 | `portal_messages.quelle` kennt `ki` |
| `ki-regeln-tab.tsx` | Regeln-Reiter — **wird nach Teil II überarbeitet** |
| `inbox-konversation.tsx` | Quellen am Vorschlag |

### Live gemessen

* Vertex antwortet aus `europe-west4` in ~1,1 s.
* Vier echte Gastfragen gegen das größte Objekt: WLAN, Anreise und
  Hausordnung korrekt; Erstattung und Wasserschaden bleiben Entwurf.
* Wurzel-6-Gegenprobe: **0** Rechte für anon/authenticated auf allen vier
  neuen Tabellen, RLS überall an.

## 16. Was an Daten noch fehlt

| Migration | Was |
|---|---|
| **0496** | `inbox_knowledge_fact` + `titel`, `kategorie`, `quelle_id`; Volltextindex (GIN); `ki_wissen_quelle`; Bucket `ki-wissen-dokumente` (PDF, 20 MB, privat) |
| **0497** | `inbox_ai_settings` + `antwortlaenge`; `ki_regel` + `eskalation_posteingang` (der zweite Schalter) |
| **0498** | `channex_booking` + `eskalation_at`, `eskalation_grund`, `eskalation_erledigt_at` — der Hinweis am Thread; Index für die Ansicht „Eskaliert" |
| **0499** | `notification_settings` + `ki_eskalation_email`, `ki_eskalation_push` (neue Kategorie im Katalog) |

Die sieben Kategorien als feste Menge (CHECK), nicht als Freitext: frei
tippbare Kategorien laufen binnen Wochen auseinander („WLAN", „Wlan",
„Internet"), und der Filter darüber wird wertlos.

`objekt · anreise · buchung · umgebung · stoerung · ausstattung · sonstiges`

`ki_wissen_quelle` bekommt RLS, restriktive Policy `for all` und
`revoke all from anon, authenticated` (Wurzel 6): dort stehen Dokumente mit
Türcodes und Hausordnungen.

`quelle_id` hängt mit `on delete set null` (nicht `cascade`): wird ein
Dokument gelöscht, bleiben die daraus BESTÄTIGTEN Fakten. Der Betrieb hat sie
geprüft; sie gehören ihm, nicht der Datei.

## 17. Reihenfolge

1. **0496 + 0497** — Datenschicht, live einspielen und gegenprüfen
2. **Wissensdatenbank** — beide Ebenen, Suche, Filter, Sortierung,
   Mehrfachauswahl, Paginierung, Fakt-Dialog
3. **PDF-Import** — Upload, Vertex-Extraktion, Prüfliste
4. **Regeln** — Seitenpanel, zweiter Eskalations-Schalter, ⋮-Menü,
   Vorlagen-Regeln
5. **Allgemein** — Antwortlänge, Verzögerung als Auswahl, „Deaktiviert",
   Tooltips
6. **Test-KI + Kontext-Panel**
7. **„KI beibringen"** im Chat
8. **Kontext vervollständigen** — die neun fehlenden Felder aus 10.3
   (Verfügbarkeit am An-/Abreisetag, Sperrgrund, Ausstattung, Betten, Bäder,
   Kapazität, Zimmertyp, Gastland, Zahlungsstatus)
9. **Aus gesendeten Nachrichten lernen** (11a) — Extraktion, Dublettenprüfung,
   Quelle `Nachrichten`
10. **Eskalation** (11b) — Stimmung im selben Aufruf, Merkmal am Thread,
    Ansicht „Eskaliert", Benachrichtigungs-Kategorie
11. **Strukturierte Regeln + Anti-Muster-Warnungen** (8.4/8.5)
12. **Verlauf-Rahmen** am Vorschlag
13. **Mobile** — Vorschlag im Chat von `mobile-nextdays`
14. Übersetzung in 24 Sprachen, alle Gates

## 18. Was bewusst NICHT gebaut wird

* **Vektorsuche.** Gemessen: 42.619 Zeichen werden auf 7.220 verdichtet, die
  Antworten sind konkret. `vector` (0.8.2 verfügbar) bleibt uninstalliert, bis
  die Praxis etwas anderes zeigt.
* **Objekt-Tags.** Die Vorlage ordnet Regeln über Tags („Luxus", „Stadt")
  Objektgruppen zu, die sich dynamisch aktualisieren. Wir haben keine Tags an
  `properties` — das wäre ein eigenes Vorhaben, das weit über die KI
  hinausreicht (Kalender, Preise und Kanalmanager wollten sie auch). Bis
  dahin: Mehrfachauswahl einzelner Objekte. Als bekannte Lücke vermerkt, nicht
  als Entscheidung dagegen.
* **Regeln über mehrere Objekte hinweg.** Auch die Vorlage kann das nicht
  („Aktuell ist der Kontext der KI auf eine Reservierung und deren Eintrag
  beschränkt"). Eine Regel, die den Kalender eines ANDEREN Objekts prüft,
  wird es hier ebenso wenig geben.
* **Hostaways Türkis als Akzentfarbe.** Struktur ja, Farbe nein: eine dritte
  Akzentfarbe im Produkt wäre ein Rückschritt. Ausnahmen sind die zwei
  Abzeichenfarben und der Verlauf-Rahmen, weil sie Bedeutung tragen.

## 19. Was ungeklärt bleibt

* **Wie viele Nachrichten sich automatisieren lassen.** Enso Connect nennt
  öffentlich 45 % (2025). Hostaway wirbt mit „bis zu 89 %" — eine
  Marketingzahl ohne Methodik.
* **Der Cron-Takt** für `/internal/dispatch-ki-autoantworten` (empfohlen: jede
  Minute) ist nicht eingerichtet. Ohne ihn wird geplant, aber nie gesendet.
* **Deploy.** Nichts von Etappe 1 und 2 ist deployt.
* **Objekt-Tags.** Die Vorlage hängt Regeln an dynamische Tags; wir haben an
  `properties` keine. Ob wir sie einführen, ist eine Entscheidung weit über
  die KI hinaus (Kalender, Preise und Kanalmanager wollten sie auch).
* **Ob die Stimmungsprüfung im selben Aufruf reicht.** Sie greift nur, wenn
  ohnehin eine Antwort erzeugt wird. Ein Thread ohne passende Regel wird nicht
  bewertet — das ist die bewusste Gegenleistung dafür, keinen zweiten
  Vertex-Aufruf je Gastnachricht zu bezahlen.
* **Ob das Auto-Lernen brauchbare Fakten liefert.** Das entscheidet ein Blick
  in die Wissensdatenbank nach zwei Wochen Betrieb, nicht eine Annahme. Der
  Filter „Quelle = Nachrichten" ist genau dafür da.

## 20. Quellen

**Hostaway-Hilfe** (gelesen am 29.08.2026),
`support.hostaway.com/hc/en-us/articles/` — 39324725643291 (How It Works),
47585356692635 (Set Up), 47585167501339 (Rules), 48569626199707 (Knowledge
Base), 48010239661211 (Escalations), 48618866434459 (Context), 47584414989723
(Best Practices), 47591597148571 (Test & Delays), 47584783624987 (FAQ)

**Wettbewerber:** Guesty ReplyAI (`help.guesty.com/…/16697585390621`),
Hospitable Knowledge Hub (`help.hospitable.com/…/9716792`) und AI Auto Replies
(`…/10977601`), iGMS AI Agent (`help.igms.com/…/12700312`)

**UI-Vorlagen:** `docs/ki auto/` — 27 Screenshots, alle gelesen. Die
tragenden: `image-1`/`image-2` (Kopfzeile aus/an), `image-3` (⋮-Menü),
`image-4`/`image-5` (Regel-Dialog), `image-6`/`image-7` (Wissensdatenbank),
`image-8` („KI beibringen"), `image-9` (PDF-Import), `image-10`/`image-11`
(Listen), `image-12` (Platzhalter-Wähler), `image-13` (Tooltip), `image.png`
(Vorschlag mit Verlauf-Rahmen), `…16.54.55`/`…16.55.40` (Fakten mit
Kategorien), `…17.19.37`/`…11.48.25`/`…11.39.14` (Test/Kontext/Allgemein),
`…16.26.48` (Vorlagen-Regeln)

Farbwerte durch Pixelmessung der Vorlagen ermittelt, nicht geschätzt.

---

## 21. Was anders gebaut wurde als geplant

Fünf Stellen, an denen der Bau vom Plan abgewichen ist. Jede aus einem Grund,
der sich erst beim Bauen zeigte.

### 21.1 Eskalation: eigene Tabelle statt Spalten an `channex_booking`

**Plan (Abschnitt 16, 0498):** `channex_booking` + `eskalation_at`,
`eskalation_grund`, `eskalation_erledigt_at`.

**Gebaut:** eine eigene Tabelle `ki_eskalation`.

Der Plan hätte die halbe Wahrheit abgebildet. Ein Verlauf liegt bei uns in
EINER VON ZWEI Tabellen — `channex_booking` (Portale) oder
`whatsapp_conversation`. Spalten an nur einer hätten bedeutet: derselbe Gast,
der über WhatsApp schreibt, kann nie eskalieren, und niemand merkt warum. Die
Alternative — dieselben drei Spalten zweimal — ist genau die Doppelung, die in
ein paar Monaten auseinanderläuft.

Die eigene Tabelle bringt zwei Dinge mit, die Spalten nicht könnten: einen
partiellen UNIQUE (`erledigt_at is null`), der EINE offene Eskalation je
Verlauf erzwingt, und `erledigt_von` — eine Eskalation, die nur die KI setzen
und niemand aufheben kann, wäre eine dauerhafte Markierung statt einer Aufgabe.

### 21.2 Eine sechste Migration (0500)

Nicht im Plan: `site_ai_usage.funktion` braucht `wissen_import` und
`wissen_lernen`. Fehlt ein Name im CHECK, steigt `ki_nutzung._schreiben` STILL
aus — der Zähler bewegt sich nicht, `deckel_pruefen` prüft einen Stand, der nie
steigt, und der Tagesdeckel wird zur Attrappe. Ausgerechnet beim Import, der
ein ganzes PDF durch Gemini schickt, wäre das der teuerste Ort dafür.

Zwei Namen statt einem, weil sich die beiden unterschiedlich verhalten: der
Import ist ein seltener teurer Einzelaufruf, das Lernen ein häufiger kleiner.
In einem Topf liesse sich später nicht sagen, welcher den Deckel gesprengt hat.

### 21.3 Stimmung als Markierungszeile statt JSON

**Plan (11b):** `{ "antwort": "…", "stimmung": "negativ", "grund": "…" }`.

**Gebaut:** eine zweite Markierungszeile `[STIMMUNG NEGATIV: …]`, dieselbe Form
wie die schon bestehende `[FEHLENDE ANGABE: …]`.

Grund: Ein JSON-Antwortschema zwingt das Modell, den Antworttext in eine Hülle
zu schreiben — und das verschlechtert messbar die Prosa darin. Der Antworttext
ist hier aber das Produkt; die Stimmung ist Beiwerk. Zwei Zeilen am Anfang
kosten nichts und lassen sich robust entfernen.

Wichtig dabei: Beide Zeilen werden über EINEN Helfer getrennt
(`markierungen_trennen`), nicht per `startswith`. Stünde die Stimmungszeile
zuerst, hätte ein `startswith("[FEHLENDE ANGABE")` die Wissenslücke übersehen —
und BEIDE Markierungen wären an den Gast gegangen. Genau dieser Fall stand vor
dem Umbau im Code.

### 21.4 Der Takt läuft in der App, nicht per Cron

**Plan (Abschnitt 19):** „Der Cron-Takt für `/internal/dispatch-ki-autoantworten`
ist nicht eingerichtet."

**Gebaut:** `inbox/ki_takt.py` — ein asyncio-Loop im Minutentakt, gestartet im
`lifespan` von `main.py`. Der interne Endpunkt bleibt als Sicherheitsnetz.

Grund: Es gibt im Projekt keinen externen Cron-Mechanismus, der die internen
Endpunkte ruft (nachgesehen: null Treffer ausserhalb des Routers). Der
Nachrichten-Scheduler löst dasselbe Problem seit jeher in-process. Ein Plan-
Punkt, der auf eine Infrastruktur wartet, die es nicht gibt, wäre für immer
offen geblieben — und ohne ihn wird geplant und nie gesendet.

Bewusst ein POLL und keine Timer je Zeile (anders als beim Nachrichten-
Scheduler): die Wartezeit vor einer KI-Antwort ist absichtlich ungenau, sie
soll menschlich wirken.

### 21.5 Objektauswahl mit Bild statt `MultiSelect`

**Plan (8.3):** „Mehrfachauswahl mit Suche, Gewählte als Chips mit ✕".

**Gebaut:** `ObjektMehrfachauswahl` — die Komponente, die der Preise-Bereich
und die Eigentümer-Zuordnung schon nutzen: Bild, Name und Ort je Zeile.

Grund kam aus dem Betrieb: 18 Objekte, die „Feriehus Line", „Feriehus Oluf",
„Feriehus Grævlinge" heissen. Am Namen unterscheidet sie niemand, am Foto
sofort. Eine dritte Kopie desselben Musters wäre ohnehin falsch gewesen.

### 21.6 Zwei neue Prüfskripte, die es vorher nicht gab

Beide entstanden aus Fehlern, die WÄHREND dieses Baus passiert sind:

* **`scripts/diagnose/use-server-exporte-pruefen.mjs`** — zwei `export const`
  in `web/lib/inbox.ts` legten `/posteingang` mit HTTP 500 lahm. Next.js meldet
  das erst in „Collecting page data", ohne Datei und ohne Symbol; `tsc` und
  ESLint sehen nichts. Das Skript prüft alle 91 `"use server"`-Dateien.
* **`scripts/diagnose/typografische-quotes-pruefen.py`** — ein `„` in einem
  f-String bricht das Literal, und die Fehlermeldung zeigt auf die falsche
  Zeile. In dieser Sitzung viermal passiert. Das Skript prüft 974 Dateien.

Dazu die Live-Probe **`scripts/diagnose/ki-wissen-pruefen.py`**: Schema,
Kontext-Sammler gegen das grösste echte Objekt, Themensperre, Dublettenprüfung.
Sie hat gezeigt, dass die grösste Gästemappe inzwischen **68.741 Zeichen** hat
(der Plan nannte 42.619) — der Sammler verdichtet sie auf 6.201 und wählt
frageabhängig richtig aus.
