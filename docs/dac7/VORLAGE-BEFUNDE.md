# Was in der amtlichen Vorlage steht — und was daraus folgt

Quelle: `docs/Duck7/CSV fil indberetning til DAC7 2025.xlsm` (Skattestyrelsen).

**Regel dieses Dokuments:** Hier steht nur, was in der Vorlage **belegt** ist,
mit Fundstelle. Was ich vermute, steht unter „Offen" und ist als Vermutung
gekennzeichnet. Nichts hier ist abgeleitet, hergeleitet oder aus anderen
Quellen (deutsches PStTG, OECD-Text, Recherche) ergänzt.

Grund für diese Trennung: In diesem Modul ist einmal eine Eigentümer-Logik
gelandet, die in der Vorlage nirgends vorkommt — sie stammte aus einer
Rechtsrecherche. Das Modul geht an die dänische Regierung; eine plausible
Erfindung ist dort schlimmer als eine offene Lücke.

## Leseprotokoll — Stand 10.09.2026: vollständig

Das Archiv hat 79 Dateien. Alles Fachliche ist gelesen.

| Teil | Inhalt | gelesen |
|---|---|---|
| `sheet1` Kolonner (versteckt) | Belegungsmatrix: welche Spalte bei welchem Zeilentyp | ja |
| `sheet2` Typer (versteckt) | 29 Zeilentypen mit `<H>`/`<T>`-Markierung und DPI-XML-Pfad | ja |
| `sheet3` Vejledningstekster (versteckt) | **283 Felder mit Typ, Kardinalität, Zusatzobjekt** | ja |
| `sheet4` Introduktion | 1 Zelle; die Anleitung steht in `drawing1.xml` | ja |
| `sheet5` Ordliste | Begriffe + Zeilentypen mit Haupt-/Zusatzzeilen-Angabe | ja |
| `sheet6` Indberetning | 89 Spalten + Datenvalidierung | ja |
| `sheet7` Enumerationer (versteckt) | 13 Wertelisten | ja |
| `sheet8` Dokumentation af koden (versteckt) | leer; Text in `drawing2.xml` | ja |
| `sheet9` Eksempel Oversigt | 886 Zeilen, 36 Werte, Beispielübersicht | ja |
| `sheet10`–`sheet14` | die 5 Beispiele, zellenweise | ja |
| `comments1–4` | 4×89 Feldbeschreibungen, inkl. der 27 Abweichungen | ja |
| `threadedComments1–4` | dieselben Texte, nichts Zusätzliches | ja, verglichen |
| `drawing1.xml` | **die eigentliche Anleitung** (Textboxen) | ja |
| `drawing2.xml` | Dokumentation der Makros | ja |
| `vbaProject.bin` | Module1, RowTypeInput, Blattmakros | ja |
| `styles`, `theme`, `printerSettings`, `media`, `docProps`, `customXml`, `vmlDrawing` | Formatierung, Bilder, Notizanker | nicht fachlich |

`customXml/item1–3`, `docProps/custom.xml` und `docMetadata/LabelInfo.xml`
sind geprüft: SharePoint-Inhaltstypschema und Dokumentetiketten, kein
Fachinhalt.

## Die Vorlage widerspricht sich NICHT — Kardinalität ≠ CSV-Zeile

Ich habe hier zweimal falsch gelegen und beide Male korrigiert. Der Verlauf
gehört dokumentiert, weil der Fehler leicht wieder passiert:

1. Erst hielt ich es für einen Fehler unseres Codes (Beispiele + `Kolonner`).
2. Dann für einen Widerspruch der Vorlage (Feldtabelle sagt Pflicht).
3. Dann deutete ich die Kardinalität als „Zeilenkennung" — auch falsch.

**Die Auflösung:** Die Kardinalität in `Vejledningstekster` beschreibt das
**DPI-XML-Zielschema**, nicht die CSV-Zeile. Im XML hängt jedes Objekt unter
genau einer Message und einem Platform Operator — die Referenz ist dort genau
einmal vorhanden, weil sie aus der Baumstruktur folgt.

Die CSV ist die flachgeklopfte Form dieses Baums. Die Zugehörigkeit entsteht
über `RS_DOC_REF_ID` und die **Reihenfolge** der Zeilen, nicht durch
Wiederholung der Kennungen.

Alle drei Quellen sagen damit dasselbe:

| Quelle | Aussage |
|---|---|
| `Kolonner`-Matrix | `MSG_MESSAGE_REF_ID` nur bei `Message`, `PO_DOC_REF_ID` nur bei `PO_Platform_Operator` |
| die 5 Beispielblätter | genau so befüllt |
| **die echte Meldung im Blatt `Indberetning`** | 0 von 44 Zeilen tragen die Kennungen jenseits der ersten beiden |
| `Vejledningstekster` | `1..1` — gilt fürs XML-Schema |

Das Blatt `Kolonner` steuert zwar die Sichtbarkeit in Excel
(`DisplayColumnsForRowtype`), stimmt hier aber mit der gelebten Praxis der
Vorlage überein.

## Befund 1 — HINFÄLLIG

Betraf angeblich fehlende Nachrichtenkennungen. Siehe Befund 8: Es ist
umgekehrt, wir schreiben zu viele.

## Befund 3 — HINFÄLLIG

Ich hatte gemeldet, `PO_DOC_REF_ID` fehle in Verkäufer- und
Aktivitätszeilen. Die Kardinalität, auf die ich mich stützte, gilt fürs
XML-Schema. In der CSV gehört das Feld nur in die Betreiberzeile — unser
Code macht das richtig.

## Befund 8 — KORRIGIERT: Kennungen standen in jeder Zeile

**Unser Code ist falsch.** `csv_dk.py` schreibt `MSG_MESSAGE_REF_ID` in jede
Zeile und `PO_DOC_REF_ID` in die PO-Zusatzzeilen.

Richtig ist:
- `MSG_MESSAGE_REF_ID` nur in der `Message`-Zeile
- `PO_DOC_REF_ID` nur in der `PO_Platform_Operator`-Zeile
- die Verknüpfung läuft über `RS_DOC_REF_ID` und die Zeilenreihenfolge

Status: **korrigiert am 10.09.2026.**

## Befund 2 — KORRIGIERT: Wahrheitswerte sind SANDT/FALSK

**Unser Code ist falsch.** `csv_dk._wahrheit()` schreibt `0`/`1`.
Betroffen: `TIN_UNKNOWN`, `PO_ASSUMED_REPORTING`.

Belege, vier unabhängige:
1. `Eksempel Oversigt` Zelle G9, wörtlich: `PO_ASSUMED_REPORTING=SANDT`
2. Beispiel 2, Zelle AJ3: sharedString 1027 = `SANDT`
3. Datenvalidierung auf Spalten R und AJ: Liste `SANDT,FALSK`
4. VBA `commaReplace`: ersetzt `;TRUE;`→`;SANDT;` und `;FALSE;`→`;FALSK;`

Wie ein Zwischenfehler entstand: Mein erstes Auslese-Skript gab die
Excel-Booleans (`t="b"`, Wert `0`) als Ziffer `0` aus, und ich habe diese `0`
als Inhalt der Vorlage berichtet. Sie war eine Eigenschaft meines Skripts.
**Lehre: die rohe Zelle samt `t=`-Attribut ansehen, nicht der eigenen
Darstellung trauen.**

Status: **korrigiert am 10.09.2026.**

## Befund 4 — KORRIGIERT: Kommas bleiben erhalten

**Unser Code ist falsch.** `csv_dk._text()` ersetzt `,` durch ein Leerzeichen.
Der Docstring begründet das mit „Die Vorlage selbst ersetzt Kommas vor dem
Export" — das beschreibt aber nur die **erste Hälfte** des Makros.

Der VBA-Exporter erhält Kommas, über einen Umweg:

```vba
' EksporterCSV, vor dem Speichern:
alternateString = Replace(stringContent, ",", "|")   ' Komma -> Pipe
' ... Excel speichert kommagetrennt ...
' commaReplace, danach:
strContents = Replace(strContents, ",", ";")  ' Trennzeichen -> Semikolon
strContents = Replace(strContents, "|", ",")  ' Pipe -> Komma zurueck
```

Beweis aus der Vorlage selbst — die Behörde schreibt Kommas in ihre eigenen
Beispieldaten, Blatt `Eksempel 2.1 Initiel`, Spalte S (`ADDR_FREE`):

| Zelle | Wert |
|---|---|
| S6 | `Jesperhus Allé 2, 7000 Fredericia` |
| S7 | `Jørgens Plads 90, 9000 Århus` |
| S8 | `Budapest, Hős u. 8-10, 1087 Ungarn` |
| S9 | `Budapest, Hungária krt. 30/A, 1087 Ungarn` |
| S10 | `Budapest, Hős u. 1/a, 1087 Ungarn` |

Aus `Jesperhus Allé 2, 7000 Fredericia` macht unser Code
`Jesperhus Allé 2 7000 Fredericia`. Bei Firmennamen ebenso: `LeCampz, SARL`
wird zu `LeCampz SARL`.

Das ist keine Formatfrage, sondern **Veränderung gemeldeter Daten**. Das
Ersetzen von `;`, `\n`, `\r` bleibt richtig — nur die Kommaregel gehört weg.

Status: **korrigiert am 10.09.2026.**

## Befund 5 — KORRIGIERT: negative Beträge fallen auf

**Unser Code ist unvollständig.** `pruefung.py` prüft auf negative Werte nur
`verguetung` (`RS_ACT_CONS_Qx`) und `anzahl` (`RS_ACT_NUM_Qx`).

Ungeprüft bleiben, obwohl die Datenvalidierung der Vorlage für alle eine
Untergrenze von **0** setzt:

- `gebuehren` → `RS_ACT_FEES_Qx`
- `steuern` → `RS_ACT_TAX_Qx`
- `vermietete_tage` → `RS_ACT_RENTED_DAYS`
- `daenisch.brutto_mieteinnahme` → `RS_ACT_DK_GRI`

Die Begründung im Code („Eine Erstattung mindert die Vergütung des Quartals,
sie erzeugt keinen negativen Posten") gilt für Gebühren und Steuern genauso,
wird dort aber nicht durchgesetzt. Ein negativer Wert erreicht heute
ungehindert die Datei — Wurzel 5, still statt fail-closed.

Status: **korrigiert am 10.09.2026.**

## Befund 6 — KORRIGIERT: Werteliste CAT001–CAT003 ergänzt

`enums.py` hat keine Liste für `RS_ACT_DK_VEHICLE_CAT`. Die Vorlage führt sie
in `Enumerationer` Spalte J (`VehicleEnum`) und validiert Spalte CJ dagegen.

Heute ohne Wirkung: Wir schreiben nur `ACT_Immovable_Property`, also wird die
Spalte nie befüllt. Aber `enums.py` beansprucht im Docstring, die Vorlage
abzubilden — und sobald Fahrzeugvermietung dazukommt, fehlt die Prüfung
ersatzlos.

Status: **korrigiert am 10.09.2026** (`enums.FAHRZEUGART`).

## Befund 7 — Semikolon im Textfeld zerreißt die Zeile (unser Code fängt es, die Vorlage nicht)

Der amtliche Exporter behandelt Kommas (über den `|`-Umweg), **Semikolons
aber nicht**, und er setzt keine Anführungszeichen. Ein Feldwert wie
`Sjællandsgade 1; B` würde die Zeile zerreißen — in der Vorlage selbst.

Unser `_text()` ersetzt `;` durch ein Leerzeichen und ist an dieser Stelle
also **sicherer als die Vorlage**. Das bleibt so; nur die Kommaregel gehört
weg (Befund 4).

## WARNUNG — die Vorlage enthält echte Personendaten

Das Blatt `Indberetning` in `docs/Duck7/CSV fil indberetning til DAC7 2025.xlsm`
ist **keine leere Vorlage**. Es enthält 44 Zeilen einer fertigen Meldung:

- Betrieb AirSmil, CVR 44179377
- **18 vollständige CPR-Nummern** in Spalte P, mit Namen, Adressen,
  Bankverbindungen und Mieteinnahmen 2025

Stand 10.09.2026: die Datei ist **untracked, aber nicht ignoriert** — ein
`git add .` würde sie einchecken. Das gehört geklärt, bevor jemand versehentlich
committet.

Für die Formatanalyse ist sie nicht nötig; eine leere Vorlage reicht.

## Bestätigt richtig in unserem Code

- **Spaltenliste und Reihenfolge**: `spalten.py` stimmt zeichengenau mit
  `Indberetning` und allen 5 Beispielblättern überein (89 Spalten).
- **Matrikel ≠ BFE**: Beispiel 1 zeigt `RS_ACT_LAND_REG_NUM=1234QJE` gegen
  `RS_ACT_DK_REAL_PROP_REG_NUM=4560004` — zwei verschiedene Werte, wie gebaut.
- **Korrektur braucht neue DOC_REF_ID**: `Eksempel Oversigt` F8 wörtlich
  „endelig skal der oplyses en ny unik værdi for DOC_REF_ID".
- **PO in einer Korrektur ist OECD0**: F8 wörtlich, „medmindre denne selv er
  genstand for korrektionen".

## Was das Blatt `Kolonner` ist — und was nicht

`Kolonner` (versteckt) listet dieselben 89 Namen, aber in **anderer
Reihenfolge** (Positionen 53–77 und 87/88 vertauscht) als `Indberetning` und
die 5 Beispiele. Für die CSV zählt `Indberetning`, denn das VBA exportiert
genau dieses Blatt.

Die Kreuze in `Kolonner` sind **keine Gültigkeitsregel**, sondern die
Steuertabelle der Excel-Oberfläche: `DisplayColumnsForRowtype` blendet beim
Klick auf Spalte A die angekreuzten Spalten ein. Ein fehlendes Kreuz heißt
„dem Nutzer nicht gezeigt", nicht „unzulässig".

Wer die Kreuze als Pflichtregel liest, kommt zu falschen Schlüssen — genau
das ist mir passiert.

## Wörtliche Feldvorgaben aus den Zellkommentaren

| Spalte | Wortlaut (dänisch) |
|---|---|
| `MSG_MESSAGE_REF_ID` | Format `<DK><indkomstår><DK><SE nr. for PO><unik ref>`; unik ref max 100 Zeichen, nur Zahlen und Buchstaben, keine Sonderzeichen |
| `PO_DOC_REF_ID` u. a. | Format `<DK><indkomstår><SE nr. for PO><unik ref>` — **ohne** das zweite `DK` |
| `MSG_REPORTING_PERIOD` | „Formatet skal være 31-12-YYYY" |
| `MSG_VERSION` | „udfyldes altid med 1.0" |
| `TIN` | Privatperson = CPR, Format `1234567891` (ohne Bindestrich); Gesellschaft = CVR/SE |
| `RS_BIRTH_DATE` | „Obligatorisk. Angives i formatet DD-MM-YYYY" |
| `RS_BIRTH_PLACE_CITY` | „Obligatorisk hvis TIN unknown" |
| `ADDR_FREE` | „Obligatorisk hvis de strukturerede adressefelter ikke kan udfyldes" |
| `ADDR_CITY` | „Obligatorisk hvis ADDR_FREE ikke udfyldes" |
| `ADDR_LEGAL_ADDRESS_TYPE` | für `PO_Platform_Operator` muss mindestens eine Anschrift `OECD304` sein |
| `RS_FI_ACCT_NUMBER` | „Registrerings- og kontonummer. Oplyses med bindestreg (Reg-Kontonummer)" |
| `RS_ACT_LAND_REG_NUM` | Matrikelnummer: max 4 Ziffern + max 3 Buchstaben |
| `RS_ACT_DK_GRI` | „Bruttolejeindtægten oplyses for året og udregnes gennem **det udbetalte vederlag + gebyr – provision**" |
| `RS_ACT_DK_GRI_CCY` | „Bruttolejeindtægten skal oplyses i **DKK**" |
| `RS_ACT_DK_REAL_PROP_REG_NUM` | BFE-Nummer, eindeutiger Schlüssel einer Immobilie in Dänemark |
| `IN_TYPE` | wenn `IN` gesetzt: einer von `LEI, EIN, IIN, BRN, Other` |
| `MSG_MESSAGE_TYPE_INDIC` | DPI401 erlaubt OECD0/OECD1 · DPI402 erlaubt OECD0/OECD2/OECD3 · DPI403 erlaubt OECD0/OECD1 |

## Datenvalidierung des Blattes Indberetning

- Spalten `R` (TIN_UNKNOWN) und `AJ` (PO_ASSUMED_REPORTING): Liste `SANDT,FALSK`
- Spalten `BA BB BD BH BI BK BO BP BR BT BV BW BY CA CF CG`: Ganzzahl **0 bis
  99.999.999.999.999** — also keine Nachkommastellen und **keine negativen
  Beträge**
- `BF`: Ganzzahl 0 bis 9.999.999.999.999.990.000
- `BM`: Ganzzahl 0 bis 99.999.999.999.999.900.000

## Was das VBA beim Export tut

`EksporterCSV` + `commaReplace`, in dieser Reihenfolge:
1. ersetzt in allen Zellen `,` durch `|`
2. schreibt `!` in Spalte 90 als Endemarke
3. speichert als `xlCSVUTF8` (also **UTF-8**, kommagetrennt)
4. ersetzt danach im Dateiinhalt `,`→`;`, dann `|`→`,`
5. ersetzt `;FALSE;`→`;FALSK;` und `;TRUE;`→`;SANDT;`
6. entfernt `;!` (die Endemarke)

Folge: **Kommas bleiben im Textfeld erhalten** (sie werden nur temporär
getauscht). Unser `csv_dk._text()` ersetzt Kommas dauerhaft durch Leerzeichen.
Das ist strenger als die Vorlage, aber kein Formatfehler — es verändert
allerdings Namen und Anschriften. Noch nicht bewertet.

## Die Feldtabelle — Pflichtangaben mit Kardinalität

`Vejledningstekster` ist die Quelle, aus der das Makro `OpdaterVejledningstekster`
die Zellkommentare erzeugt. Sie hat je Feld: Kolonnenavn, Attribut, Vejledning,
**Type**, **Kardinalitet**, **Tilføjelsesobjekt**. Das ist die einzige Stelle,
die Pflicht von Kür trennt.

Was unser Serialisierer bei vollständiger Meldung erfüllt:

- `PO_Platform_Operator`: alle 4 Pflichtfelder ✓
- `ACT_Immovable_Property`, Quartalsfelder: alle **28** Pflichtfelder ✓
  (`RS_ACT_NUM/CONS/FEES/TAX` × Q1–Q4 samt Währungen sind **jeweils `1..1`** —
  also auch dann zu schreiben, wenn der Wert 0 ist; die Beispiele zeigen genau
  das)
- `RS_IND`/`RS_ENT`/`ACT_*`: `MSG_MESSAGE_REF_ID`, `RS_DOC_REF_ID`,
  `DOC_TYPE_INDIC` ✓ — **`PO_DOC_REF_ID` fehlt** (Befund 3)
- `Message`: es fehlen `MSG_TRANSMITTING_COUNTRY`, `MSG_RECEIVING_COUNTRY`,
  `MSG_MESSAGE_TYPE`, `MSG_TIMESTAMP` — **diese vier gibt es unter den 89
  CSV-Spalten nicht**, sie existieren nur im DPI-XML. Kein Fehler für die CSV,
  aber vorzumerken für den Formatwechsel 2026.

Die Felder unter „Other" (`RS_ACT_LAND_REG_NUM`, `RS_ACT_PROP_TYPE`,
`RS_ACT_RENTED_DAYS`, `RS_ACT_DK_GRI`, `RS_ACT_DK_REAL_PROP_REG_NUM`) sind alle
`0..1` — **optional**. Wir füllen sie; das ist zulässig und für den
Steuerbescheid des Verkäufers gewollt.

`RS_ACT_DK_REAL_PROP_REG_NUM` (BFE) hat Typ **Integer**, `RS_ACT_LAND_REG_NUM`
(Matrikel) Typ **Text** — bestätigt die Trennung, die wir gebaut haben.

## Der Entscheidungsbaum — xl/media/image2.jpg

Fachlicher Inhalt, der NUR als Bild vorliegt (739×1938 px). Der Anleitungstext
verweist darauf; ich hatte die Datei zunächst als „Darstellung" abgetan. Das
war falsch — sie ist die klarste Darstellung des ganzen Aufbaus.

Kopftext wörtlich:
> „Beslutningstræet angiver hvilke rækker indberetningen skal indeholde.
> **For alle rækker skal typen/rowtype angives.**
> Hvert rektangel angiver en rowtype.
> En rowtype kategoriseres som enten *Hovedrække* eller *Tilføjelsesrække*.
> I udgangspunktet anvendes *Hovedrækker*."

Der Ablauf:

```
Start → Message → PO_Platform_Operator → [Type af indberetning?]
   ├─ på egne vegne ─────────────────────────┐
   ├─ på vegne af andre → AD_Assumed_PO ─────┤  (wiederholt je Assumed PO)
   └─ anden operatør indberetter → AG_Assuming_PO → Nulindberetning fertig
                                              │
                            [Sælgere at indberette om?]
                              ├─ ingen → Nulindberetning fertig
                              └─ ja → [Virksomhed eller privatperson?]
                                        ├─ Privatperson → RS_IND_Individual_Seller
                                        └─ Virksomhed  → RS_ENT_Entity_Seller
                                                   (wiederholt je Verkäufer)
                                              │
                                    [Aktivitetstyper?]
                        ├─ Fast ejendom → ACT_Immovable_Property
                        │                   „Gentages for hver ejendom"
                        ├─ Transport   → ACT_TR_Transportation_Rental
                        │                   └─ ACT_TR_Detail (optional, je Fahrzeug)
                        ├─ Service     → ACT_Personal_Services
                        └─ Salg        → ACT_Sale_Of_Goods
```

Bestätigt unseren Aufbau: eine Verkäuferzeile je Verkäufer, darunter eine
`ACT_Immovable_Property`-Zeile je Objekt. Und „For alle rækker skal
typen/rowtype angives" stützt die Zeilenkennung aus `Vejledningstekster`.

## Was die Anleitung in drawing1.xml sagt

Der Fließtext der Einführungsseite, der nicht in Zellen steht:

- **„Undtagelsen er aktivitetstypen Immovable Property, hvor der skal
  indberettes en række pr. ejendom"** — eine Zeile je Immobilie, alle anderen
  Aktivitätsarten je Quartal summiert. Bestätigt unseren Aufbau.
- Korrekturen verlangen **immer**: neue `MessageRefId`, `MessageTypeIndic`
  `DPI401` (hinzufügen) oder `DPI402` (ändern/löschen), neuen Zeitstempel, und
  je Hochebenen-Objekt `DocTypeIndic` plus neue `DocRefId` bei OECD1/2/3 sowie
  `CorrDocRefId` bei OECD2/3.
- Zusatzzeilen (`<T>`) sind **immer optional**; ihr einziger Zweck ist, mehrere
  Werte für dasselbe Feld anzugeben. Das Präfix bestimmt, an welche Hauptzeile
  sie andocken: `RS_ENT_Organisation_Name` nur an eine Zeile, die mit `RS_ENT_`
  beginnt.
- Fett gedruckte Spaltenüberschriften im Blatt `Indberetning` markieren
  Pflichtfelder je Zeilentyp.

## Das Blatt Typer — Haupt- und Zusatzzeilen

29 Zeilentypen, jeder mit `<H>` (Hovedrække) oder `<T>` (Tilføjelsesrække) und
seinem Pfad im DPI-XML. Der XML-Pfad ist für den Formatwechsel 2026 wertvoll:
`ACT_Immovable_Property` = `Reportable Seller / Relevant Activity / Immovable
Property / Property Listing`.

Uneinheitlich in der Vorlage, ohne Folge für uns:
- `Enumerationer` listet 31 Zeilentypen, darunter `RS_IND_Nationality` — der
  hat in `Kolonner` **keine einzige Spalte** und wäre nicht befüllbar
- `Ordliste` schreibt manche Namen anders (`PO_Residence` statt
  `PO_Residence_Country_Code`, `ACT_Sale_of_Goods` statt `ACT_Sale_Of_Goods`)
- `Ordliste` und die Anleitung nennen `RS_Business_Name`; in `Kolonner` und
  `Indberetning` gibt es den Zeilentyp nicht

Maßgeblich sind `Indberetning` (Spalten) und `Kolonner` (Belegung).

## Enum-Abgleich: alles deckungsgleich

Alle zehn Wertelisten in `enums.py` stimmen exakt mit `Enumerationer`:
LAENDER 252, WAEHRUNGEN 186, EU_LAENDER 27, MELDEART 3, SATZART 4, NEXUS 5,
OBJEKTART 10, ANSCHRIFTSART 5, IN_ART 5, ZEILENTYPEN 31.

## Was die Korrektur bewirkt hat

Alle fünf Fehler sind behoben, jeder mit einem Test, der ihn wieder auffangen
würde. Gegenprobe gefahren: die Fehler absichtlich wieder eingebaut, daraufhin
fielen 7 Tests — die Tests prüfen also wirklich, statt nur grün zu sein.

Eine erzeugte Beispielmeldung zeigt jetzt:

```
Message                   MSG_MESSAGE_REF_ID=DK2025DK44179377AS25
PO_Platform_Operator      PO_DOC_REF_ID=...  TIN_UNKNOWN=FALSK
                          ADDR_STREET=Hovedgaden, 1
                          ORGANISATION_NAME=AirSmil, ApS
                          PO_ASSUMED_REPORTING=FALSK
RS_IND_Individual_Seller  RS_DOC_REF_ID=...  (keine Nachrichtenkennung)
ACT_Immovable_Property    RS_DOC_REF_ID=...  alle 28 Quartalsfelder, auch die Nullen
```

## Befund 9 — KORRIGIERT: die CPR-Nummer wird MIT Bindestrich gemeldet

Hier stehen sich zwei Stellen DERSELBEN Vorlage entgegen:

| Stelle | Aussage |
|---|---|
| Feldkommentar `TIN` (Spalte P) | „formatet skal følge eksemplet her: `1234567891`" — ohne Trennzeichen |
| Blatt `Indberetning`, die echte Meldung | **18 von 18** Personennummern als `DDMMJJ-XXXX` |

Belegt: `010190-1234`, `020291-2345`, `030392-3456`, `040493-4567`,
`050594-5678` … keine einzige ohne Bindestrich.

**Entschieden für die Belegung**, nicht für das Formatbeispiel: Was der
Betrieb tatsächlich eingereicht hat, ist das, was die Behörde
entgegennimmt. Der Kommentar zeigt die Ziffernfolge, nicht die
Schreibweise der Datei.

Unser Code entfernte den Bindestrich. `cpr_pruefen` prüft weiterhin auf der
reinen Ziffernfolge, gibt aber `cpr_schreibweise()` zurück — `DDMMJJ-XXXX`.
Die CVR-Nummer bleibt unberührt: Sie steht in der echten Meldung als reine
Ziffernfolge (`44179377`, `34814643`), und die Satzkennungen
(`DK202544179377_001`) enthalten ohnehin nur die Betreibernummer.

## Befund 10 — KORRIGIERT: in Dänemark gibt es nur EINE Nummer

Der Betrieb hat keine Steuernummer neben seiner CVR-Nummer. Belegt:

| Feld | Wert in der echten Meldung | Feldkommentar |
|---|---|---|
| `TIN` (Z3) | `44179377` | „For danske virksomheder angives et CVR/SE nummer" |
| `VAT` | — | „I Danmark er det tilsvarende momsregistreringsnummeret dvs. SE nummer" |
| `IN` | leer | „Udfyldes hvis det adskiller sig fra Skatteidentikationsnummeret" |
| `MSG_SENDING_ENTITY_IN` (Z2) | `44179377` | dieselbe Nummer |

CVR = SE = TIN, und die USt-IdNr. ist dieselbe Zahl mit `DK` davor. Das
Feld `IN` bleibt leer, weil es sich eben NICHT unterscheidet.

Live gegengeprüft: `tenant_billing_profile` trägt für diesen Betrieb
`vat_id = 'DK44179377'`, `legal_name = 'AirSmil'`, `Hirtshalsvej 21`,
`9881` — feldgleich mit Zeile 3 der echten Meldung. `tax_number` ist
`null`, und `taxpayer_info` hat **0 Zeilen**.

Unser Modul verlangte trotzdem eine separate Selbstauskunft und brach
ohne sie ab. Jetzt leitet `_steuerangaben_aus_rechnungsprofil()` die CVR
aus der USt-IdNr. ab — **nur für Dänemark**, weil USt-IdNr. und
Steuernummer nur dort dieselbe Zahl sind. Stimmt die Prüfziffer nicht,
bleibt die Selbstauskunft Pflicht, statt eine falsche Nummer zu melden.

## Befund 11 — Matrikel ≠ BFE: eure Meldung weicht von der Vorlage ab

Ich wollte die Matrikelnummer aus der BFE-Nummer füllen, weil eure
Meldung beide Felder gleich belegt. **Das war falsch** — drei Stellen der
Vorlage sagen etwas anderes:

| Quelle | `RS_ACT_LAND_REG_NUM` | `RS_ACT_DK_REAL_PROP_REG_NUM` |
|---|---|---|
| Feldkommentar CC | „max fire cifre + max tre bogstaver" | BFE, „unik forretningsvendt nøgle" |
| Amtliches Beispiel (sheet10/13) | `1234QJE`, `3465LKE` | `4560004`, `987323`, `1230001`, `9873321` |
| **Eure Meldung** | `3155601`, `9093660` … (7–8 Ziffern) | dieselben Werte |

In eurer Meldung sind 22 von 23 Objektzeilen in beiden Feldern
zeichengleich — mit Werten, die das Matrikelformat verletzen (keine
Buchstaben, zu viele Ziffern). Ihr habt die BFE-Nummer in beide Spalten
geschrieben.

**Nicht übernommen.** Unser `_MATRIKEL`-Muster (`\d{1,4}[Buchstaben]{0,3}`)
bleibt, die BFE-Nummer wird nicht in die Matrikelspalte kopiert.

Nebenbefund: **Zeile 41 eurer Meldung enthält einen Zahlendreher** —
`MATRIKEL=3174382` gegen `BFE=3175382`, vierte Ziffer 4 statt 5. Die
einzige Zeile, in der die beiden Felder auseinandergehen. Falls diese
Meldung schon abgegeben wurde, gehört das gegenüber Skattestyrelsen
angesprochen.

## Befund 12 — KORRIGIERT: BFE-Nummer macht die Bruttomieteinnahme zur Pflicht

Wörtlich im Feldkommentar zu `RS_ACT_DK_GRI`:

> „Obligatorisk hvis Real Property Registration Number BFE er angivet."

Beide Felder sind EINZELN freiwillig — deshalb sieht eine
Feld-für-Feld-Prüfung diese Regel nie. In der echten Meldung ist sie
eingehalten: alle 23 Objektzeilen tragen BFE **und** Bruttomieteinnahme.

Wir prüften das an keiner Stelle. Jetzt an beiden: `_gri_pflicht_pruefen`
(vor dem Erzeugen) und `_bedingte_pflicht_pruefen` (in der fertigen
Datei).

## Befund 13 — BESTÄTIGT: GRI = Vergütung, gegen die echten Zahlen gerechnet

Der Feldkommentar zu `RS_ACT_DK_GRI` nennt die Formel
„vederlag + gebyr − provision"; der ausführlichere zweite Kommentar
präzisiert: Consideration **plus** Gebühren, **ohne** Provision und
**ohne** Steuern.

Nachgerechnet über alle 23 Objektzeilen der echten Meldung
(Quartalssummen gegen das GRI-Feld):

| Hypothese | Treffer |
|---|---|
| `GRI == CONS` | **20 von 23** |
| `GRI == CONS + FEES` | 0 |
| `GRI == CONS − FEES` | 0 |

Unser Rechner bildet `GRI = verguetung.summe`. Das ist damit belegt —
Gebühr und Provision führen wir gemeinsam in `gebuehren`, sie heben
einander auf.

Die drei Abweichungen sind Eigenheiten EURER Meldung, keine Regel:

- **Z27 und Z29** tragen dieselbe BFE-Nummer `3163989` und beide
  `GRI = 35815`. Das ist die Summe beider Zeilen (8843 + 26972 = 35815) —
  ein Objekt steht zweimal, und die Jahressumme wurde in beide Zeilen
  geschrieben.
- **Z15** meldet `GRI = 18648` bei einer Vergütung von 0.

Nicht übernommen: Aus drei uneinheitlichen Zeilen lässt sich keine Regel
ableiten, und die übrigen 20 sagen dasselbe wie unser Code.

## Befund 14 — KORRIGIERT: der Kanalfilter war frei erfunden (schwerster Fehler)

Der Code siebte Buchungen nach `channel` aus und begründete das so:

| Begründung im Code | Ausgeschlossen |
|---|---|
| „Booking.com meldet als Plattformbetreiber selbst" | 255 |
| „Airbnb meldet als Plattformbetreiber selbst" | 181 |
| „Direktbuchung ohne Plattform (kein meldepflichtiger Vorgang)" | 27 |

**463 von 694 Buchungen** fielen damit aus der Meldung — die tatsächlich
abgegebene Meldung desselben Betriebs enthält **231**. Keine dieser
Begründungen war belegt; sie stammten aus einer Annahme, nicht aus einer
Quelle.

### Die maßgebliche Fundstelle

DAC7-Anleitung für dänische Ferienhausvermittler (feriehusudlejerne.dk,
mit der Skattestyrelsen abgestimmt, S. 2):

> „I de tilfælde, hvor der er to eller flere formidlere involveret i
> processen, dvs. hvor **et bureau ud over egen hjemmeside også har huset
> liggende på andre formidleres platforme**, er det **den formidler, der har
> formidlingsaftale og foretager afregning med husejer**, der er
> indberetningspligtig for den pågældende nettolejeindtægt."

Genau der Fall des Betriebs: eigene Website plus Booking plus Airbnb.
Maßgeblich ist der **Vermittlungsvertrag mit dem Hauseigentümer**, nicht der
Buchungsweg. Booking hat keinen Vertrag mit dem Eigentümer, sondern mit dem
Betrieb — Booking meldet den Betrieb als Verkäufer, der Betrieb meldet seine
Eigentümer. Zwei Beziehungen, zwei Meldungen; die eine ersetzt die andere
nicht.

Dieselbe Anleitung, S. 5:

> „Bureau/platform er indberetningspligtig, når der har været aktivitet
> eller er sket betaling til husejer […] **Indtægten skal kun indberettes én
> gang og ikke dobbelt.**"

### Zwei weitere Belege

- Die **89 Spalten** der amtlichen Vorlage enthalten **kein Feld** für den
  Buchungskanal. Die Behörde fragt nicht danach.
- Die echte Meldung im Blatt `Indberetning` meldet 231 Buchungen eines
  Betriebs, dessen Gäste über Booking, Airbnb und direkt kommen.

### Was jetzt gilt

Der Filter ist **ersatzlos entfallen**, nicht ersetzt: Eine Agentur hat mit
jedem ihrer Eigentümer einen Vermittlungsvertrag, die Bedingung wäre also
immer wahr. Ob eine Zeile entsteht, entscheidet weiterhin die
Eigentümer-Zuordnung des Objekts (`owner_properties`) — sie *ist* der
Vertrag.

Die Kanaleinschränkung bleibt nur für die **Marktplatz-Meldung** von
myBestDays: Dort ist myBestDays nur für die über ihn gelaufenen Buchungen
Vermittler des Betriebs (`channel='portal'`).

Auch `ist_ungeklaert` ist entfallen: Ein unbekannter Kanal fiel vorher aus
BEIDEN Meldungen und erzeugte nur einen Hinweis — die Buchung fehlte damit
still in der Datei.

## Befund 15 — myNextDays ist selbst KEIN Plattformbetreiber

Die Oberfläche schrieb „Als Vermittlungsplattform sind wir verpflichtet…".
Das ist falsch und steht jetzt richtig.

Dieselbe Anleitung, S. 2 — die Meldepflicht trifft NICHT:

> „Digitale serviceleverandører, som ikke i sig selv skaber formidling af
> udlejningen, men som f.eks. alene er i stand til at behandle betalinger
> for udlejningen; som alene indeholder en oplistning eller reklamer for
> udlejere, eller som alene kan omdirigere eller overføre brugere til en
> anden platform."

Gleichlautend § 3 Abs. 1 Satz 3 PStTG (deutsche Umsetzung derselben
Richtlinie): keine Plattform, wenn die Software „ausschließlich" Zahlungen
verarbeitet, Tätigkeiten auflistet/bewirbt oder Nutzer weiterleitet.

Meldepflichtig ist der **Betrieb**, nicht sein Software-Lieferant. Dass die
Buchungsstrecke von uns kommt, ändert daran nichts — die Anleitung stellt
das ausdrücklich klar:

> „…et bureau bliver betragtet som en platformsoperatør ved at stille en
> platformsløsning, **som i princippet kan drives 100% af en anden/andre
> serviceleverandør(er)**, til rådighed for sine udlejere."

## Befund 16 — Quartalszuordnung ist frei wählbar

Unser Ausschlussgrund „Vergütung fiel in ein anderes Meldejahr" ist strenger
als die Vorgabe. Anleitung S. 5:

> „Der er ikke fastsat specifikke retningslinjer for, om det er
> opkrævningstidspunktet eller udbetalingstidspunktet, der bestemmer
> dateringen (kvartal/år) af vederlaget. **Dette er indtil videre valgfrit
> for bureauet/platformen.**"

Und weiter: „Det er her op til bureauet/platformen, hvilket kvartal
henholdsvis år, man indberetter for, **når blot indberetning af aktivitet og
beløb finder sted**." — Entscheidend ist, DASS gemeldet wird, nicht in
welchem Quartal. Noch nicht umgesetzt; siehe Offen.

## Offen — noch nicht geprüft

- Befund 16: unser Jahresausschluss ist strenger als nötig — die Anleitung
  stellt Quartal/Jahr ins Ermessen des Betriebs, solange überhaupt gemeldet
  wird. Prüfen, ob dadurch Buchungen an der Jahresgrenze ganz herausfallen.
- ob wir `RS_ACT_DK_GRI` in DKK melden, wenn der Betrieb in EUR fakturiert
  (Alpenzeit Chalets) — der Kommentar verlangt DKK
- ob `_text()` Kommas ersetzen darf, obwohl die Vorlage sie erhält
