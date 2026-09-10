# DAC7-Meldemodul — Fachspezifikation

Stand: 10.09.2026 · Meldejahr 2025 · Erstes Zielformat: Dänemark (CSV, TastSelv Erhverv)

Dieses Dokument beschreibt, WAS gemeldet wird, WOHER jede Zahl stammt und
WARUM sie so und nicht anders gebildet wird. Es ist so geschrieben, dass eine
Steuerbehörde jede Zahl der erzeugten Datei bis auf die einzelne Buchung
zurückverfolgen kann.

## 1. Rechtsrahmen

Richtlinie (EU) 2021/514 (DAC7), umgesetzt in Dänemark über
bekendtgørelse 1253/2022, in Deutschland als PStTG. Die Feldnamen der
CSV-Datei stammen aus dem DPI-XML-Schema der OECD und sind EU-weit identisch;
sie werden nirgends übersetzt, gekürzt oder umbenannt.

Relevante Tätigkeit hier: **Vermietung unbeweglichen Vermögens**
(Immovable Property). Für sie gibt es **keine Bagatellgrenze** — die Grenze
"unter 30 Fälle und unter 2.000 EUR" gilt ausschließlich für Warenverkauf.
Schon eine einzige vergütete Buchung ist meldepflichtig.

Meldezeitraum ist stets das Kalenderjahr. Abgabefrist für 2025: 31.01.2026;
da dies ein Samstag ist, verschiebt sie sich auf Montag, den 02.02.2026.

## 2. Zwei Meldungen, ein Kern

Das Modul erzeugt zwei fachlich verschiedene Meldungen aus derselben Logik:

| | Meldender Plattformbetreiber | Gemeldete Anbieter | Datengrundlage |
|---|---|---|---|
| **A** | myBestDays (Marktplatzbetreiber) | die Betriebe (Tenants) | Buchungen über den Marktplatz-Kanal |
| **B** | der einzelne Betrieb | seine Verkaeufer | Direktbuchungen des Betriebs |

Beide erzeugen dieselbe Struktur (Message → Platform Operator → Seller →
Activity) und unterscheiden sich nur darin, wer Betreiber und wer Anbieter
ist. Deshalb wird die Hierarchie einmal gebaut und zweimal befüllt.

## 3. Kanalabgrenzung — welche Buchung gehört in welche Meldung

Das ist die fachlich heikelste Regel des Moduls. Wer eine Buchung doppelt
meldet, lässt den Vermieter doppelt veranlagen.

Grundsatz: **Es meldet, wer den Vertragsabschluss ermöglicht hat.**

| `reservations.channel` | Wer meldet | In unserer Datei |
|---|---|---|
| `booking`, `airbnb`, `vrbo`, `expedia` u. a. Portale | das Portal selbst | **nicht enthalten** |
| `portal` (myBestDays-Marktplatz) | myBestDays | Meldung **A** |
| `website` (Baukasten-Seite des Betriebs) | der Betrieb | Meldung **B** |
| `direct` (Telefon, Mail, Laufkundschaft) | niemand — kein Plattformgeschäft | **nicht enthalten** |

`direct` ist bewusst ausgeschlossen: Eine telefonische Buchung kommt nicht
"über eine Plattform" zustande. Sie mitzumelden wäre eine Falschmeldung.

Die Zuordnung wird je Meldung protokolliert: Der Prüfbericht weist aus, wie
viele Buchungen je Kanal einbezogen und wie viele mit welcher Begründung
ausgeschlossen wurden.

## 4. Herkunft jeder gemeldeten Zahl

### 4.1 Vergütung (`RS_ACT_CONS_Q1..Q4`)

Gemeldet wird die dem Anbieter **gezahlte oder gutgeschriebene** Vergütung.

Quelle: `reservations.total_amount` mit Währung `reservations.currency`.

**Nicht** aus `payments`: Diese Tabelle erfasst nur Zahlungen, die über unsere
eigene Zahlungsabwicklung laufen. Bei einer Booking- oder Airbnb-Buchung zahlt
der Gast an das Portal, es entsteht bei uns kein `payments`-Satz — die
Vergütung ist trotzdem geflossen. Live-Beleg (10.09.2026): für das Meldejahr
2025 existieren 732 Buchungen über 1.225.941,67, aber **null** Zahlungssätze;
eine Berechnung aus `payments` meldete eine leere Datei.

### 4.2 Quartalszuordnung

Maßgeblich ist der Zeitpunkt, zu dem die Vergütung gezahlt oder
gutgeschrieben wurde — nicht der Anreisetag.

Rangfolge der Quelle, ohne Ersatzwert:
1. Datum der erfolgreichen Zahlung (`payments.created_at`), wenn vorhanden
2. sonst `reservations.booked_at` (der echte Buchungszeitpunkt beim Portal)
3. fehlt beides, ist die Buchung **nicht meldefähig** und erscheint im
   Prüfbericht — sie wird nicht geraten.

`created_at` ist ausdrücklich **keine** zulässige Quelle: das ist der Zeitpunkt
unserer eigenen Verarbeitung, nicht der des Geschäftsvorfalls.

### 4.3 Gebühren (`RS_ACT_FEES_Q1..Q4`)

Vom Plattformbetreiber einbehaltene oder berechnete Gebühren und Provisionen.

Quelle: `reservations.ota_commission` + `reservations.channel_fee`, ergänzt um
`commission_ledger.commission_amount` für Marktplatz-Buchungen.

Fehlt der Wert, wird `0` gemeldet — das ist hier kein erfundener Ersatzwert,
sondern die zutreffende Aussage "es wurde keine Gebühr einbehalten". Für die
Portalkanäle, die ohnehin nicht in unsere Meldung gehören, entfällt die Frage.

### 4.4 Steuern (`RS_ACT_TAX_Q1..Q4`)

Vom Plattformbetreiber einbehaltene Steuern (z. B. abgeführte Kurtaxe).
Behalten wir keine Steuer ein, wird `0` gemeldet.

### 4.5 Anzahl Tätigkeiten (`RS_ACT_NUM_Q1..Q4`)

Zahl der Buchungen im Quartal, nicht Zahl der Zahlungen: eine in zwei Raten
bezahlte Buchung ist **eine** Tätigkeit.

### 4.6 Vermietungstage (`RS_ACT_RENTED_DAYS`)

Summe der Nächte (`check_out - check_in`) über alle einbezogenen Buchungen
des Meldejahres.

### 4.7 Objektart (`RS_ACT_PROP_TYPE`)

Abbildung unserer `properties.property_type` auf die OECD-Codes:

| unser Typ | Code | Bedeutung |
|---|---|---|
| ferienhaus, tiny_house | DPI904 | Haus |
| appartement | DPI905 | Wohnung |
| einzel-/doppel-/zweibett-/familienzimmer, junior_suite, suite | DPI902 | Hotelzimmer |
| hausboot | DPI908 | Boot |
| stellplatz | DPI909 | Parkplatz |
| glamping | DPI907 | Campingplatz |

Haben die Objekte einer Meldeeinheit unterschiedliche Typen, wird **kein**
Code gemeldet: Die Angabe ist nur "sofern vorhanden" verlangt, und ein
gemittelter Typ wäre erfunden.

### 4.8 Dänische Zusatzfelder

`RS_ACT_DK_GRI` (Bruttomieteinnahme) = ausgezahlte Vergütung + Gebühr −
Provision, zwingend in DKK. `RS_ACT_DK_REAL_PROP_REG_NUM` = BFE-Nummer.
Beide sind freiwillig, aber ohne sie kann Skattestyrelsen die
Steuererklaerung des Verkaeufers nicht vorbefuellen. Sie hängen als
länderspezifischer Anhang am Modell, nicht im gemeinsamen Kern — damit der
Wechsel auf DPI-XML sie nicht mitschleppt.

## 5. Struktur der Datei

Massgeblich ist die amtliche CSV-Vorlage von Skattestyrelsen, sonst nichts.
Ihr Beispielblatt zeigt den Aufbau:

    Message
      PO_Platform_Operator                  der meldende Betrieb
        RS_IND_Individual_Seller            ein Verkaeufer (Person)
          ACT_Immovable_Property                Fredericia
          ACT_Immovable_Property                Aarhus
        RS_ENT_Entity_Seller                ein Verkaeufer (Firma)
          ACT_Immovable_Property

Verknuepft wird ueber `RS_DOC_REF_ID`: Alle Zeilen eines Verkaeufers tragen
dieselbe Kennung. Je vermieteter Immobilie entsteht genau eine
Aktivitaetszeile — im Beispiel stehen unter einem Verkaeufer zwei Zeilen fuer
zwei Orte.

Ein **Verkaeufer** ist nach dem Glossar der Vorlage "en bruger af en
platform, der saelger aktiviteter igennem denne" — ein Nutzer der Plattform,
der ueber sie Taetigkeiten verkauft.

Die Vorlage kennt **keinen Eigentuemer**: Das Wort kommt in ihr nicht vor,
weder als Spalte noch im Text. Es wird deshalb auch im Modul nicht
verwendet.

## 6. Fail-closed: Was die Erzeugung abbricht

Eine Meldung an eine Steuerbehörde darf keine geratenen Werte enthalten.
Fehlt eines der folgenden Felder, wird die Datei **nicht** erzeugt; der
Prüfbericht benennt Anbieter und Feld:

- Steuer-ID (TIN) des Anbieters oder ersatzweise vollständiger Geburtsort
- Ansässigkeitsstaat des Anbieters
- Anschrift der Meldeeinheit
- Währung eines gemeldeten Betrags
- Quartalszuordnung eines Betrags (siehe 4.2)
- Steuerzahlerangaben des meldenden Betriebs (Meldung B)

Gemischte Währungen innerhalb einer Meldeeinheit machen die Summe unbrauchbar
und schließen die Einheit von der Meldung aus, statt über Währungsgrenzen zu
addieren.

## 7. Nachvollziehbarkeit und Korrekturen

Jeder Meldelauf wird als Datensatz gespeichert, nicht nur als Datei:
Meldejahr, Zeitpunkt, erzeugende Fassung, die vergebenen `DocRefId`s je
Anbieter und die Liste der einbezogenen Buchungen je Meldeeinheit.

Ohne gespeicherte `DocRefId` ist später **keine Korrektur** möglich —
`CORR_DOC_REF_ID` verweist auf genau diese Kennung.

Unterstützte Meldearten:
- `DPI401` Erstmeldung / Nachtrag (nur `OECD0`/`OECD1`)
- `DPI402` Korrektur und Löschung (nur `OECD0`/`OECD2`/`OECD3`)
- `DPI403` Nullmeldung (kein zu meldender Anbieter)

Derselbe Lauf zweimal erzeugt muss byte-identisch sein: feste Sortierung,
keine Zufallswerte, kein Zeitstempel in der Nutzlast außer dem definierten.

## 8. Dateiformat (Dänemark 2025)

- Trennzeichen `;`, Zeichensatz UTF-8
- 89 Spalten in der Reihenfolge des Blattes "Indberetning" der amtlichen
  Vorlage; die Namen werden unverändert übernommen
- Datum `DD-MM-YYYY`; `MSG_REPORTING_PERIOD` = `31-12-YYYY`
- Beträge ganzzahlig, ohne Tausendertrenner
- Kommas in Textfeldern werden vor dem Export ersetzt (Vorgabe der Vorlage)
- `MSG_MESSAGE_REF_ID` = `DK<Jahr>DK<SE-Nr><eindeutige Referenz>`
- `PO_DOC_REF_ID` / `RS_DOC_REF_ID` = `DK<Jahr><SE-Nr><eindeutige Referenz>`
- Referenzen enthalten nur Ziffern und Buchstaben, höchstens 100 Zeichen

Ab Meldejahr 2026 verlangt Dänemark XML. Der Kern erzeugt deshalb ein
format-neutrales Meldemodell; CSV und DPI-XML sind zwei Serialisierer über
demselben Baum. Die 89 Spalten sind die flachgeklopfte Fassung genau dieser
Hierarchie.

## 9. Bekannte Datenlücken im Bestand (Stand 10.09.2026)

Gemessen an der Live-Datenbank, nicht angenommen:

1. **Zwei Objekte tragen zwei Eintraege in `owner_properties`.** Die
   Vorlage fuehrt jede Immobilie unter genau einem Verkaeufer; solange
   zwei hinterlegt sind, meldet der Pruefbericht das als offenen Punkt.
2. **Ein Objekt hat keinen Eintrag in `owner_properties`.** Ohne
   Verkaeufer kann die Vorlage keine Aktivitaetszeile aufnehmen.
3. **Keine Grundbuch-/BFE-Nummer erfasst** (alle Objekte). Zulässig, aber
   ohne sie keine Vorbefuellung beim daenischen Verkaeufer.
4. **`channel_fee` durchgängig 0**, `ota_commission` nur bei Airbnb gesetzt.
5. **Die Mahnkaskade nach § 23 läuft nicht**: `pruefe_und_aktualisiere` hat
   keinen Cron-Aufrufer, die zwei vorgeschriebenen Erinnerungen werden nicht
   versendet. Das Unterlassen ist selbst bußgeldbewehrt.

## 9a. Dänische Steuernummern (CPR und CVR)

Vorgabe der amtlichen Anleitung zum Feld `TIN`:

> „Skatteidentifikationsnummer. I Danmark er det for privatpersoner et
> CPR-nummer, hvor formatet skal følge eksemplet her: `"1234567891"`.
> For danske virksomheder angives et CVR/SE nummer."

Daraus folgen drei Regeln, die das Modul erzwingt:

1. **Die Art hängt am Anbieter.** Eine Privatperson meldet ihre
   CPR-Nummer, eine Gesellschaft ihre CVR-/SE-Nummer. Welche Nummer gilt,
   entscheidet die Art des Anbieters — nicht das Feld, in dem sie
   zufällig steht. Eine achtstellige Firmennummer bei einer Privatperson
   wird abgewiesen, statt die Person unter fremder Kennung zu melden.
2. **Zehn Ziffern ohne Bindestrich.** Das Beispiel der Anleitung lautet
   `1234567891`. Im Bestand stehen die Nummern als `010190-1234`; sie
   werden beim Erzeugen normalisiert. Ohne das würde die Datei erst beim
   Hochladen abgelehnt.
3. **Prüfziffern werden gerechnet, soweit sie gelten.** Die CVR-Nummer
   trägt eine modulo-11-Prüfziffer — ein Zahlendreher fällt damit vor der
   Abgabe auf. Die CPR-Prüfziffer wurde zum 01.01.2007 abgeschafft;
   seither gibt es gültige Nummern, die die alte Probe nicht bestehen.
   Geprüft wird dort nur, was weiterhin gilt: Länge, Ziffern und ein
   plausibles Geburtsdatum in den ersten sechs Stellen.

Umgesetzt in `daenemark.py`, geprüft gegen drei tatsächlich vergebene
CVR-Nummern.

## 9d. Pflichtangaben woertlich aus der Anleitung

Diese Regeln stehen so in der amtlichen Anleitung und sind im Modul
umgesetzt:

| Feld | Anleitung | Umsetzung |
|---|---|---|
| `RS_BIRTH_DATE` | "Obligatorisk", `1..1` | Pflicht bei jeder Privatperson; erfasst in `owners.date_of_birth` (Migration 0629), nicht aus der CPR-Nummer gerechnet |
| `RS_BIRTH_PLACE_CITY` | "Obligatorisk hvis TIN unknown" | Pflicht nur bei gesetztem `TIN_UNKNOWN`, nicht bei fehlender Nummer |
| `RS_ACT_LAND_REG_NUM` | "matrikelnummer, max fire cifre + max tre bogstaver", Text | aus `properties.land_registration_number` |
| `RS_ACT_DK_REAL_PROP_REG_NUM` | BFE-Nummer, Integer | aus `properties.bfe_number` — ein **anderes** Feld; im Beispiel der Behoerde stehen dort `1234QJE` gegen `4560004` |
| `RS_FI_ACCT_NUMBER` | "Oplyses med bindestreg (Reg-Kontonummer)" | `bank_reg_nr` + `-` + `bank_konto_nr` |
| Korrektur | "skal der oplyses en ny unik vaerdi for DOC_REF_ID" | die Korrektur bekommt eine NEUE Kennung, die bisherige steht in `CORR_DOC_REF_ID`; sind beide gleich, bricht die Pruefung |
| Korrektur | "PO_Platform_Operator skal have DOC_TYPE_INDIC=OECD0" | in einer DPI402-Meldung muss der Betreiber erneut gesendet werden |

## 9c. Probelauf

Vor der ersten echten Meldung muss sich prüfen lassen, ob die Daten tragen.
Dafür gibt es den **Probelauf**: Er rechnet und prüft vollständig, legt aber
**nichts** ab.

| | Probelauf | Meldung erstellen |
|---|---|---|
| rechnet und prüft | ja | ja |
| erzeugt die Datei | ja (Vorschau) | ja |
| legt einen Lauf ab | **nein** | ja (Entwurf) |
| nach einer Abgabe möglich | ja | nein |
| Kennung zum Herunterladen | nein | ja |

Der Probelauf ist auch nach einer abgegebenen Meldung möglich — er ändert
nichts am abgegebenen Stand und beantwortet die Frage „wie sähe die Meldung
mit dem heutigen Datenstand aus".

Weil es dabei keine Kennung zum Herunterladen gibt, liefert die Antwort die
**ersten zwölf Zeilen der erzeugten Datei** samt Gesamtzeilenzahl. Ohne
diesen Blick bliebe „es hat geklappt" eine Behauptung. Zwölf Zeilen zeigen
Kopfzeile, Nachricht, Betreiber und die ersten Anbieter; ein vollständiger
Auszug würde die Steuernummern eines ganzen Bestands durch die Antwort
tragen.

In der Oberfläche stehen beide Wege nebeneinander, der Probelauf als
Hauptknopf: Er ist der richtige erste Schritt und kann nichts kaputtmachen.
Sein Ergebnis wird deutlich als Probelauf gekennzeichnet — eine Anzeige,
die wie eine gespeicherte Meldung aussieht, wäre eine Falschaussage über
den Stand der Dinge.

## 10. Aufbau des Moduls

### Backend `apps/api/src/features/taxpayer/dac7/`

| Datei | Aufgabe |
|---|---|
| `spalten.py` | die 89 Spaltennamen, maschinell aus der amtlichen Vorlage |
| `enums.py` | Länder, Währungen, Codelisten aus der Vorlage |
| `modell.py` | format-neutrale Hierarchie (trägt CSV **und** künftig XML) |
| `kanaele.py` | welche Buchung in welche Meldung gehört |
| `rechner.py` | Quartalswerte aus Buchungen |
| `aufbau.py` | Meldung aus dem Datenbestand eines Betriebs |
| `pruefung.py` | fail-closed vor der Dateierzeugung |
| `csv_dk.py` | Serialisierer für Dänemark |
| `kennungen.py` | Aufbau der Ref-IDs an einer Stelle |
| `daenemark.py` | CPR/CVR: Format und Prüfziffer |
| `service.py` | Meldeläufe erzeugen, speichern, abgeben |
| `router.py` | fünf Endpunkte unter `/api/v1/taxpayer/dac7` |

### Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/erzeugen` | Meldung berechnen (`probelauf: true` legt nichts ab) |
| GET | `/laeufe` | gespeicherte Läufe |
| GET | `/laeufe/{id}/datei` | die CSV |
| GET | `/laeufe/{id}/anbieter` | gemeldete Anbieter (Auskunft) |
| POST | `/laeufe/{id}/abgeben` | Abgabe bestätigen |

Alle verlangen die Berechtigung „Abrechnung verwalten". Der Mandanten-Scope
wird im Service erzwungen, nicht über die Datenbankrolle — der
Service-Client umgeht RLS.

### Datenbank (Migration 0627)

`dac7_meldelaeufe`, `dac7_meldelauf_anbieter`, `dac7_meldelauf_belege`.
RLS aktiv, restriktive Mandanten-Policy, kein Lese- oder Schreibrecht für
`anon`/`authenticated`. Gegen den Datenbank-Direktpfad geprüft: Lesen und
Schreiben werden beide verweigert.

### Oberfläche

Reiter „Steuerdokumente" unter Konto → Steuern. Drei Schritte: berechnen,
herunterladen, Abgabe bestätigen. Die Datei wird über eine Server Action
geholt, nicht über einen Link — sie enthält Steuer-IDs und Kontokennungen
und darf nie ohne Anmeldung abrufbar sein.

Was die Oberfläche NICHT tut: bei der Behörde hochladen. Das tut der Nutzer
selbst im Portal; die Anwendung behauptet nichts anderes.

## 11. Prüfstand

- 96 Tests des Moduls, davon 17 gegen die echte Datenbank
- Die Spaltenliste wird bei jedem Testlauf erneut aus der amtlichen Vorlage
  gelesen und verglichen — eine künftige Fassung mit geänderten Spalten
  bricht den Test, bevor eine Datei abgelehnt wird
- 6647 Tests des Gesamtsystems grün
- `db-spalten-pruefen.py`: 14 348 Spaltenangaben stimmen mit der Live-DB
- ruff sauber, pylint 10.00/10, TypeScript und ESLint ohne Fehler
- Komplexitäts-Gate ohne Zuwachs

## 12. Messung am Echtbestand

Probelauf gegen einen dänischen Betrieb, Meldejahr 2025:

| | |
|---|---|
| 255 Buchungen | ausgeschlossen — Booking.com meldet selbst |
| 181 Buchungen | ausgeschlossen — Airbnb meldet selbst |
| 27 Buchungen | ausgeschlossen — Direktbuchung ohne Plattform |
| 6 Buchungen | Vergütung fiel in ein anderes Meldejahr |
| **10 Buchungen** | **einbezogen** (eigene Website) |

Erkannte Maengel: 3 Verkaeufer ohne Steuer-Identifikationsnummer, 2 Objekte
mit zwei hinterlegten Verkaeufern. Es entstand keine Datei — der
Pruefbericht nennt Namen und Feld.
