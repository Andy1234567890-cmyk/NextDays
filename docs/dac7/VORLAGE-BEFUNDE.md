# Was in der amtlichen Vorlage steht — und was daraus folgt

Quelle: `docs/dac7/CSV fil indberetning til DAC7 2025.xlsm` (Skattestyrelsen).

**Regel dieses Dokuments:** Hier steht nur, was in der Vorlage **belegt** ist,
mit Fundstelle. Was ich vermute, steht unter „Offen" und ist als Vermutung
gekennzeichnet. Nichts hier ist abgeleitet, hergeleitet oder aus anderen
Quellen (deutsches PStTG, OECD-Text, Recherche) ergänzt.

Grund für diese Trennung: In diesem Modul ist einmal eine Eigentümer-Logik
gelandet, die in der Vorlage nirgends vorkommt — sie stammte aus einer
Rechtsrecherche. Das Modul geht an die dänische Regierung; eine plausible
Erfindung ist dort schlimmer als eine offene Lücke.

## Leseprotokoll — Stand 11.09.2026

Das Archiv hat 79 Dateien. Alles Fachliche ist gelesen.

**Diese Überschrift stand bis zum 11.09.2026 auf „vollständig". Sie war es
nicht** — und zwar nicht, weil ein Text übersehen wurde, sondern weil eine
ganze FRAGEKLASSE nie gestellt worden war: *wie die Datei technisch
vorliegt*. Alle 45 Befunde bis dahin betrafen Feldinhalte — Namen,
Pflichten, Wertelisten, Kardinalitäten. Die Kodierung, das Zeilenende, das
Trennzeichen: nie gefragt.

Aufgefallen ist es nicht an der Vorlage, sondern am Ergebnis: Die erzeugte
Datei öffnete in Excel als EINE Spalte statt 89 (Befund 46). `vbaProject.bin`
stand dabei seit dem ersten Durchlauf als „gelesen" — der Export-Aufruf
darin war nie ausgewertet worden.

Lehre für jeden weiteren Durchlauf: Ein Träger als „gelesen" zu markieren
sagt nichts darüber, welche FRAGEN an ihn gestellt wurden.

| Teil | Inhalt | gelesen |
|---|---|---|
| `sheet1` Kolonner (versteckt) | Belegungsmatrix: welche Spalte bei welchem Zeilentyp | ja |
| `sheet2` Typer (versteckt) | 29 Zeilentypen mit `<H>`/`<T>`-Markierung und DPI-XML-Pfad | ja |
| `sheet3` Vejledningstekster (versteckt) | **274 Feldzeilen** in 58 Unterblöcken unter 9 Hauptobjekten, mit Typ, Kardinalität, Zusatzobjekt (hier stand „283 Felder“ — nie nachgezählt) | ja |
| `sheet4` Introduktion | 1 Zelle; die Anleitung steht in `drawing1.xml` | ja |
| `sheet5` Ordliste | Begriffe + Zeilentypen mit Haupt-/Zusatzzeilen-Angabe | ja |
| `sheet6` Indberetning | 89 Spalten + Datenvalidierung | ja |
| `sheet7` Enumerationer (versteckt) | 13 Wertelisten | ja |
| `sheet8` Dokumentation af koden (versteckt) | leer; Text in `drawing2.xml` | ja |
| `sheet9` Eksempel Oversigt | 886 Zeilen, 36 Werte, Beispielübersicht | ja |
| `sheet10`–`sheet14` | die 5 Beispiele, zellenweise | ja |
| `comments1–4` | 4×89 Feldbeschreibungen, inkl. der 27 Abweichungen | ja |
| ⚠ | **die Kommentare tragen MEHR als `Vejledningstekster`** — zwei bedingte Pflichten stehen nur dort (Befund 17). Bei jeder Feldfrage beide Quellen lesen. | |
| `threadedComments1–4` | dieselben Texte, nichts Zusätzliches | ja, verglichen |
| `drawing1.xml` | **die eigentliche Anleitung** (Textboxen) | ja |
| `drawing2.xml` | Dokumentation der Makros | ja |
| `vbaProject.bin` | **17 Module, 15 Prozeduren** — der Quelltext ist kennwortgeschützt (`DPB=`) und war bis zum 11.09.2026 NICHT gelesen; gelesen war `drawing2.xml`, die Beschreibung (Befund 48) | ja, seit 11.09.2026 per `oletools` |
| `xl/styles.xml` + Schriftart der Kopfzeile | **FACHLICH: der Fettdruck markiert die Pflichtfelder** (Befund 20) | ja |
| `xl/media/image2.jpg` | **FACHLICH: der Entscheidungsbaum** — nur als Bild | ja |
| `xl/media/image1.png` | Windows-Dialog „Blockierung aufheben" — kein Fachinhalt | ja, geprüft |
| `theme`, `printerSettings`, `customXml`, `docMetadata`, `ctrlProps`, `vmlDrawing2–5` | Gestaltung, Druck, SharePoint-Metadaten, Purview-Label, Notizanker | geprüft am 11.09.2026: **Beiwerk, bestätigt** |
| `docProps/core.xml`, `app.xml` | `creator=Skattestyrelsen`, `keywords=DAC7, DPI`, erstellt 16.03.2023, geändert 20.01.2026, `lastModifiedBy=Jeanine Ågaard`; Excel 2016+ | geprüft; ergänzt Befund 24 |
| **nicht vorhanden** | keine Formel (`<f>`) in keinem Blatt, kein `calcChain.xml`, kein `conditionalFormatting` (`dxfs count="0"`), kein `sheetProtection`, keine `tableParts`, kein `externalLink`, kein `<hyperlink>`, keine `dataValidation type="custom"`, `<numFmts>` leer | negativ belegt am 11.09.2026 |

**Zwei Träger tragen Fachinhalt, obwohl sie nach Gestaltung aussehen:** der
Fettdruck in `styles.xml` (Pflichtfelder) und `image2.jpg` (der
Entscheidungsbaum). Hier stand beides bis zum 11.09.2026 unter „nicht
fachlich" — und der Entscheidungsbaum war im selben Dokument weiter unten
längst ausgewertet. Wer die Datei mit `data_only=True` liest, sieht von
beidem nichts.

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
`Jesperhus Allé 2 7000 Fredericia`.

(Hier stand bis zum 11.09.2026 ein zweites Beispiel, `LeCampz, SARL` →
`LeCampz SARL`. **Das war erfunden** — die Datei führt den Namen dreimal,
jedes Mal schlicht als `LeCampz`, und sie enthält überhaupt keinen
Firmennamen mit Komma. Genau der Fehlertyp, den die Präambel verbietet.
Der Befund selbst bleibt gültig: Die fünf `ADDR_FREE`-Werte tragen ihn.)

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

Das Blatt `Indberetning` in `docs/dac7/CSV fil indberetning til DAC7 2025.xlsm`
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
Reihenfolge** als `Indberetning` und die 5 Beispiele: 27 Positionen weichen
ab, nämlich **54–78 sowie 88/89** (hier stand bis zum 11.09.2026 „53–77 und
87/88" — um eins verschoben, was bei einer Matrix, vor deren
positionsbasierter Auswertung Befund 28 ausdrücklich warnt, besonders
heikel ist). Für die CSV zählt `Indberetning`, denn das VBA exportiert
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

## Befund 44 — ein vierter Makro verteilt die Währung automatisch (und die Doku nennt die falsche Spalte)

`drawing2.xml` beschreibt einen Makro, den der Abschnitt „Was das VBA beim
Export tut" nicht führt:

> `Private Sub Worksheet_Change` — „har som funktion at skrive valutakoden
> fra **kolonne BH** til de andre celler i samme række, som også skal
> indeholde valutakoder. Dette gøres ud fra en antagelse om, at en sælger
> som regel har foretaget alle transaktioner for den samme aktivitetstype
> i samme valuta."

Das ist fachlich wichtig: Die Währung wird beim Tippen **automatisch über
die Zeile verteilt**. Befund 23 stellt fest „die Währung ist strukturell"
und „wechselt je Aktivitätszeile" — der Grund dafür ist dieser Makro, nicht
Disziplin beim Ausfüllen. Der Nutzer kann den kopierten Wert überschreiben.

**Und die amtliche Dokumentation nennt die falsche Quellspalte:** `BH` ist
`RS_ACT_NUM_Q2` — eine Stückzahl, keine Währung. Die erste `*_CCY`-Spalte
ist `BC` (`RS_ACT_CONS_Q1_CCY`). Vierter Fehler dieser Klasse nach
Befund 22 (zwei) und 42.

## Befund 45 — Abdeckung: was im Archiv keinen Fachinhalt trägt

Zur Vollständigkeit, damit kein Teil ungeprüft gilt. Das Archiv hat **79
Dateien**. Ohne Fachinhalt und deshalb in keinem Befund:

| Teil | Inhalt |
|---|---|
| `xl/ctrlProps/ctrlProp1–3.xml` | die drei Schaltflächen des Blattes `Introduktion` |
| `xl/sharedStrings.xml` | die Zeichenketten aller Blätter (indirekt zitiert in Befund 23) |
| `[Content_Types].xml`, `_rels/.rels` | OPC-Gerüst |
| `xl/worksheets/_rels/sheet*.xml.rels` | **Zuordnung Blatt → Kommentardatei** |

Die letzte Zeile ist keine Formalie: Über sie läuft der Beleg für
Befund 38 (`comments1` → `sheet6` = `Indberetning`). Wer die
Kommentardateien nach Nummer zuordnet statt über die Rels, vertauscht die
Textschichten.

**Ergänzung zu Befund 24:** `docProps/core.xml` trägt
`dcterms:modified = 2026-01-20`, `dc:creator = Skattestyrelsen`,
`created = 2023-03-16` und als `lastModifiedBy` einen dritten Namen,
**Jeanine Ågaard** — neben Bjarke Bitsch (UFST) und Kristian Toksvig. Die
Kette Behörde → Bearbeiter → Betrieb ist damit auch über die Metadaten
belegt.

**Ergänzung zu `Enumerationer`:** Das Blatt hat eine **14. Spalte ohne
Überschrift**, die in Zelle `N21` den verwaisten Einzelwert `CAT001` trägt
— ein Rest der Umstellung `001` → `CAT001` (Befund 38). Keine Werteliste,
von keiner Validierung referenziert.

## Befund 42 — fünf Betragsspalten tragen zwei einander ausschließende Validierungen

Die Währungsliste `Enumerationer!$H$2:$H$187` liegt nicht auf 13, sondern
auf **18 Spalten**. Fünf davon sind **Betragsspalten**, keine
Währungsspalten:

`RS_ACT_FEES_Q1`, `_Q2`, `_Q3`, `_Q4` und `RS_ACT_TAX_Q3`

Diese fünf tragen gleichzeitig `type="whole"` (Ganzzahl 0 bis
99 999 999 999 999) **und** die Währungsliste — zwei Regeln, die sich
gegenseitig ausschließen. Ein dritter Fehler derselben Klasse wie
`RS_PERM_ESTABLISHMENT`→`MsgVersionEnum` und `DOC_TYPE_INDIC`→`E2:E8`
(Befund 22).

Für unsere Prüfung ändert sich nichts: Die 13 echten `*_CCY`-Spalten gegen
`WAEHRUNGEN`, die Betragsspalten ganzzahlig (Befund 30).

## Befund 43 — nie ausgewertet: `Kolonner` Zeile 2 und 4, `Typer` Spalte B

Drei Spalten der Vorlage tragen Fachinhalt und kamen in keinem Befund vor.

**`Typer` Spalte B — die alten Zeilentyp-Namen.** Für alle 29 Zeilentypen
steht dort der Kurzname einer **früheren Formatgeneration**: `MSG`, `PO`,
`RS_IND_STD`, `RS_ENT_STD`, `RS_ACT_IP_PL`, `RS_ACT_TR_DT`, `PO_ADDR`,
`AD_TIN` und so fort. Relevant, weil eine eingehende Altdatei diese Kürzel
tragen kann — und weil `RS_IND_STD` das Suffix `_STD` („standard
identifikation") führt, das im heutigen Namen fehlt.

**`Kolonner` Zeile 4 („comment") — Feld → DPI-XML-Objekt, für alle 89
Spalten.** Die feldgenaue Ergänzung zu `Typer` Spalte C, die nur je
Zeilentyp auflöst. Zwei Dinge stehen nur hier:

- Das Suffix `*` markiert durchgängig die **wiederholbaren** Objekte
  (`* Residence`, `* Tax Identification Number`, `* Address`,
  `* Relevant Activity`). Das ist eine zweite, **maschinenlesbare** Quelle
  für die Kardinalitäten aus Befund 39.
- `RS_ACT_DK_GRI(_CCY)` und die BFE-Nummer tragen
  `Property Listing DK | Transportation Rental Detail DK` — die BFE-Spalte
  ist also auch am Fahrzeug-Detailobjekt vorgesehen, obwohl die Matrix sie
  für `ACT_TR_Detail` nicht ankreuzt. Noch ein Selbstwiderspruch.

**`Kolonner` Zeile 2 („column description") — die englischen Klarnamen.**
Die Brücke zwischen CSV-Spaltenname und OECD-/DPI-Begriff. Fachlich am
wichtigsten: `RS_PERM_ESTABLISHMENT` heißt dort ausdrücklich
„Entity seller permanent establishment **country**" — unabhängiger Beleg
dafür, dass seine Validierung gegen `MsgVersionEnum` ein Vorlagenfehler ist
und dort ein EU-Ländercode gehört (Befund 22).

**`Ordliste` — zwei Definitionen mit Regelgehalt**, bisher nur als Quelle
abweichender Schreibweisen zitiert:

> `Assumed Platform Operator`: „Flere operatører kan være juridisk
> ansvarlige for samme platform. I så fald skal **den rapporterende part
> angives som Platform Operator og den/de andre operatører som Assumed
> Platform Operator**."

Das ist die Rollenverteilung PO↔AD als **Regel** — Befund 23 leitet sie
bisher nur aus dem Beispielaufbau ab.

> `Platform`: „…hvor brugere kan formidle og sælge aktiviteter **samt
> afregne med køber**."

Das Abrechnungsmerkmal stützt Befund 15 (myNextDays ist kein Betreiber)
aus der amtlichen Datei selbst statt aus einer externen Quelle.

**`Typer` Zeilen 15–17 sind verrutscht:** `RS_ENT_Organisation_Name` trägt
die Financial-Identifier-Beschreibung, `RS_ENT_Permanent_Establishment` die
Organisation-Name-Beschreibung, `RS_Financial_Identifier` schlicht
„Nationalitet." `Ordliste` hat an diesen Stellen die richtigen Texte.

Hier stand die Vermutung, `RS_IND_Nationality` sei „beim Verrutschen
herausgefallen". **Das trägt nicht:** Der Versatz umfasst genau drei
aufeinanderfolgende Zeilen und endet dort — Zeile 18 sitzt wieder richtig.
Ein herausgefallener Eintrag würde alles Nachfolgende verschieben. Und
`Ordliste` kennt `RS_IND_Nationality` ebenfalls nicht. Der Zeilentyp steht
ausschließlich in `Enumerationer` Spalte A; warum, ist aus der Datei nicht
zu belegen.

## Befund 38 — DIE WICHTIGSTE EINSICHT: die Datei trägt ZWEI Textschichten

Die Zellkommentare existieren in zwei Fassungen. Das erklärt fast jeden
„Selbstwiderspruch", den dieses Dokument bisher verzeichnet hat:

| Schicht | Blätter | Autor | Datum |
|---|---|---|---|
| **2024 — maßgeblich** | `Indberetning` (`comments1.xml`) | Kristian Toksvig | 08.01.2024 |
| 2023 — veraltet | `Eksempel 1`, `1.1`, `Eks 2` (`comments2/3/4.xml`) | Bjarke Bitsch, UFST | 08.08.2023 |

`comments2`, `3` und `4` sind untereinander wortgleich. **27 von 89 Feldern
unterscheiden sich zwischen den Schichten**, davon acht inhaltlich.

Maßgeblich ist die 2024er Fassung: Sie hängt am Arbeitsblatt
`Indberetning`, das das VBA exportiert, und ist die jüngere (Befund 29).

### Was sich geändert hat — wörtlich gegenübergestellt

| Feld | 2023 (veraltet) | 2024 (gültig) |
|---|---|---|
| `ADDR_COUNTRY_SUB_ENTITY` | „Anvendes **ikke** til danske adresser." | „Anvendes i de tilfælde det indgår i adressen." |
| `RS_BIRTH_COUNTRY` | „Enten birth country eller … **Obligatorisk hvis TIN unknown**." | „Fødselslandsnavn" |
| `RS_ACT_DK_VEHICLE_REG_NUM` | „… **når Vehicle category er 001**" | „Kørertøjets registreringsnummer" |
| `CORR_DOC_REF_ID` | „… DOC_TYPE_INDIC=**OECD2**." | „… DOC_TYPE_INDIC=**OECD2 eller OECD3**." |
| `RS_ACT_DK_GRI_CCY` | „Obligatorisk hvis Gross Rental Income amount er angivet" | „Bruttolejeindtægten skal oplyses i **DKK**" |
| `RS_ACT_DK_VEHICLE_CAT` | Werte `001`/`002`/`003` | Werte **`CAT001`**/`CAT002`/`CAT003` |
| `MSG_MESSAGE_REF_ID` u. a. | `<afsenderland>…` + „skal altid være DK" | `<DK>` hart eingesetzt |
| `ADDR_SUITE` | „Værelse" (Zimmer) | „**Sidedør**" (Seiteneingang) |
| `RS_FI_ACCT_NUMBER` | „Kontonummer" | „Registrerings- og kontonummer, **med bindestreg**" |

### Folgen für die bisherigen Befunde

- **Befund 32 ist hinfällig.** Das Verbot „`ADDR_COUNTRY_SUB_ENTITY` nicht
  bei dänischen Adressen" gehört zur 2023er Schicht und wurde 2024 ins
  Gegenteil geändert. Die Vorlage hat im gültigen Stand **kein einziges
  Feldverbot**.
- **Befund 31 halbiert sich.** Von den drei bedingten Pflichten überlebt
  nur `RS_BIRTH_PLACE_CITY` („Obligatorisk hvis TIN unknown", in **beiden**
  Schichten). Die Geburtsland-Entweder-oder-Regel und die
  CAT001-Kennzeichenpflicht sind 2024 gestrichen — als Hinweis brauchbar,
  als Fehler nicht belegt.
- **Befund 35 ist kein Selbstwiderspruch, sondern eine Versionsfolge.**
  2023 nur `OECD2`, 2024 `OECD2 oder OECD3`. Die Entscheidung für die
  weitere Lesart war richtig, die Begründung ist jetzt härter.
- **Befund 12 und 17 stehen auf der alten Schicht.** Sowohl BFE→GRI als
  auch GRI→GRI_CCY stehen **nur** in den 2023er-Kommentaren; 2024 sind
  beide durch andere Texte ersetzt. Inhaltlich bleiben sie sinnvoll (eine
  Währung ohne Betrag ist sinnlos), aber als amtliche Pflicht des
  aktuellen Stands sind sie **nicht mehr belegt**.
- **`001` ist eine veraltete Schreibweise.** Eine Datei mit
  `RS_ACT_DK_VEHICLE_CAT=001` ist abzulehnen, nicht umzuschreiben.

**Regel für jede künftige Prüfung: Ein Kommentar aus `comments2/3/4.xml`
ist ein historischer Beleg, keine geltende Vorgabe. Gültig ist
`comments1.xml`.**

## Befund 39 — `ADDR_LEGAL_ADDRESS_TYPE` ist NUR beim Betreiber Pflicht

`Vejledningstekster`, Kardinalität desselben Felds je Block:

| Block | Kardinalität |
|---|---|
| `PO_Platform_Operator` | **`1..*`** |
| `AG`, `AD`, `RS_ENT`, `RS_IND` | `0..*` |
| `ACT_Immovable_Property` | `0..1` |

Das ist die Kardinalitäts-Entsprechung zur Kommentarregel „For rowtype
PO_Platform_Operator skal mindst én adresse af typen OECD304 være
angivet". Eine Prüfung „`ADDR_LEGAL_ADDRESS_TYPE` fehlt" darf deshalb
**ausschließlich** bei der PO-Zeile feuern — sonst meldet sie an jeder
Verkäuferzeile einen Fehler, den es nicht gibt. Derselbe Fehlertyp wie bei
`ADDR_CITY` in Befund 20, nur umgekehrt.

Weitere Kardinalitäts-Unterschiede desselben Felds zwischen Blöcken:

- **`RESIDENCE`**: bei `PO` und `AG` `0..*` (optional), bei `AD` und beiden
  Verkäufern `1..*` (Pflicht). Für den eigenen Betreibersatz erfüllt
  `PO_NEXUS` dieselbe Funktion; der fremde Betreiber (`AD`) hat kein
  Nexus-Feld und braucht deshalb die Ansässigkeit.
- **`TIN`/`TIN_ISSUED_BY`/`TIN_UNKNOWN`**: bei Verkäufern `1..1`, bei
  Betreibern `1..*`. **Ein Verkäufer darf genau eine Steuernummer haben.**
  Das ist die Regel hinter der Beobachtung aus Befund 23 („ein Verkäufer je
  Steuerdomizil") — und der Grund, warum der Zusatzzeilentyp
  `RS_Tax_Identification_Number` für Verkäufer sinnlos ist.
- **`RS_ACT_DK_GRI`**: bei `ACT_Immovable_Property` `0..1`, bei
  `ACT_TR_Detail` `0..*`. Eine Immobilie hat eine Bruttomieteinnahme, ein
  Fahrzeugsatz je Fahrzeug eine. Das ist der Grund für die Existenz von
  `ACT_TR_Detail`.
- Bei `AD_Assumed_Platform_Operator` sind die Kardinalitätszellen von
  `TIN`/`TIN_ISSUED_BY`/`TIN_UNKNOWN` **leer** — als einzige der 274
  Feldzeilen. Fail-closed: Für `AD` ist die TIN-Pflicht unbelegt und darf
  nicht erzwungen werden.

## Befund 40 — `ACT_Sale_Of_Goods` hat in der Feldtabelle keinen Block

Der Zeilentyp steht in `Enumerationer`, in `Typer` und in `Kolonner` (mit
30 erlaubten Feldern) — aber `Vejledningstekster` kennt ihn **nicht**. Für
ihn existiert damit **keine einzige amtliche Kardinalitätsangabe**.

Befund 33 leitet seine Pflichtmenge daraus ab, dass er dieselbe Feldmenge
wie `ACT_Personal_Services` hat. Das ist zulässig und nachgeprüft — aber es
ist eine **Analogie, keine Fundstelle**. So gehört es vermerkt.

Weitere Korrekturen an der Blockzählung: `Vejledningstekster` hat **274
Feldzeilen in 58 Unterblöcken unter 9 Hauptobjekten** (Hauptblock =
Kopfzeile „Kolonnenavn“, davon gibt es neun). Hier stand zwischenzeitlich
„56 Unterblöcke unter 10 Hauptobjekten“ — beide Zahlen falsch, nachgezählt
sind es 58 und 9. `Transportation Rental Details` ist ein Unterblock ohne
eigenen Kopf, und `Activities` ist eine Zwischenüberschrift, kein
Hauptobjekt. Und `ACT_TR_Transportation_Rental` trägt in `Kolonner`
**34** erlaubte Felder, nicht 30 — die vier DK-Fahrzeugfelder dürfen
direkt in der Hauptzeile stehen, was die Feldtabelle nur für
`ACT_TR_Detail` vorsieht.

## Befund 41 — bei Typkonflikten gilt `Kolonner`, nicht `Vejledningstekster`

Zwei Felder tragen in den beiden Typquellen Unvereinbares:

| Feld | `Kolonner` Zeile 3 | `Vejledningstekster` Spalte D |
|---|---|---|
| `RS_ACT_DK_VEHICLE_REG_NUM` | `Text` | **`Integer`** |
| `RS_ACT_DK_VEHICLE_CAT` | `VehicleEnum` | **`Integer`** |

Beide `Integer`-Angaben sind offensichtlich falsch: Ein dänisches
Kennzeichen (`AB 12 345`) ist keine Ganzzahl, `CAT001` erst recht nicht.
Wer `Vejledningstekster` Spalte D als Typquelle nimmt, lehnt jedes echte
Kennzeichen ab.

Für Befund 30 (Ganzzahlpflicht der Beträge) ändert das nichts — der
Schluss stützt sich auf `Kolonner` Zeile 3 plus die Datenvalidierung
`type="whole"`, beide unstrittig.

## Befund 30 — Beträge dürfen KEINE Nachkommastellen haben; unsere Prüfung erlaubt sie

Dreifach belegt: `Kolonner` Zeile 3 führt `RS_ACT_CONS/FEES/TAX_Q1-4`,
`RS_ACT_DK_GRI` und die BFE-Nummer als Typ **`Integer`**; die
Datenvalidierung setzt `type="whole"`; und in den Beispielen steht nirgends
eine Nachkommastelle. DAC7 kennt keine Øre.

`_betrag_pruefen` in `pruefung_csv.py` prüft aber nur das Vorzeichen:

```python
zahl = float(wert.replace(",", "."))   # macht aus "1234,56" aktiv 1234.56
if zahl < 0: ...                        # nur negativ wird beanstandet
```

`RS_ACT_CONS_Q1=1234,56` geht damit nicht nur durch — das `replace`
**interpretiert es als gültig**. `_GANZZAHLSPALTEN` enthält nur
`RS_ACT_NUM_Qx` und `RENTED_DAYS`; die 13 Betragsspalten fehlen dort.

Zu tun: Die Betragsspalten müssen ganzzahlig geprüft werden. Das `replace`
auf Komma gehört weg — ein Komma im Betrag ist nach der Vorlage ein
Fehler, keine andere Schreibweise.

## Befund 31 — drei bedingte Pflichten fehlen, alle nur in den Kommentaren belegt

Die Reihe aus Befund 17 setzt sich fort: Bedingungen, die weder in der
Feldtabelle noch im Blatt stehen, sondern ausschließlich in den
Zellkommentaren der Beispielblätter.

**`TIN_UNKNOWN=SANDT` zieht eine ganze Kette nach sich.** Wer keine
Steuernummer hat, muss anders identifizierbar sein:

| Feld | Kommentar |
|---|---|
| `RS_BIRTH_PLACE_CITY` | „Obligatorisk hvis TIN unknown." |
| `RS_BIRTH_COUNTRY` | „**Enten** birth country **eller** birth country former name. Obligatorisk hvis TIN unknown." |
| `RS_BIRTH_FORMER_COUNTRY_NAME` | gleichlautend |

Das ist zugleich die einzige **Entweder-oder-Beziehung zwischen zwei
Feldern** in der ganzen Vorlage. Keines der drei Felder kommt in
`pruefung_csv.py` vor — und der Auslöser `TIN_UNKNOWN` wird wegen des
toten Spaltennamens (Befund 18) ohnehin nie gelesen.

**`DPI910` verlangt eine Erläuterung.** `Vejledningstekster` R265:
„Tekstbeskrivelse af hvilken anden type ejendom, der er udlejet **når
'DPI910' er valgt** som ejendomstype." `RS_ACT_OTHER_PROP_TYPE` kommt in
unserer Prüfung nicht vor. Fängt zwei Fälle: `DPI910` ohne Erläuterung
(die Behörde weiß nicht, was vermietet wurde) und Erläuterung bei einer
anderen Objektart (Widerspruch).

**Fahrzeugkennzeichen bei Kategorie 001.** Kommentar `CK1`: „Skal udfyldes
med køretøjets registreringsnummer, **når Vehicle category er 001**."
Heute folgenlos, weil wir nur Immobilien melden — aber dieselbe Bauart wie
BFE→GRI, und beim ersten Fahrzeug fehlt sie.

## Befund 32 — HINFÄLLIG (siehe Befund 38): das Feldverbot gehört zur alten Schicht

`Vejledningstekster` R114/R144/R187/R227 und Kommentar `AB1`:
**„City sub entity. Anvendes ikke til danske adresser."**

Das ist die einzige Stelle der Vorlage mit einem „anvendes ikke" — ein
Verbot statt einer Pflicht, und an eine Bedingung geknüpft
(`ADDR_COUNTRY='DK'`). Nicht geprüft. Als Hinweis prüfbar: gefülltes
`ADDR_COUNTRY_SUB_ENTITY` bei dänischer Adresse.

**Aufgelöst durch Befund 38:** Das ist kein Widerspruch, sondern ein
Versionswechsel. Die vier „nicht bei DK"-Stellen gehören zur **2023er
Schicht**, die zwei anderen zur **2024er**. Skattestyrelsen hat das Verbot
**aufgehoben** — der gültige Text lautet „Anvendes i de tilfælde det indgår
i adressen."

**Diese Prüfregel darf NICHT gebaut werden.** Der aktuelle Stand der
Vorlage kennt kein einziges Feldverbot.

## Befund 33 — 26 von 31 Zeilentypen laufen ohne jede Pflichtprüfung durch

`vorlage.ROW_TYPES` führt 31 Werte, `_PFLICHT` deckt **fünf** ab. Alles
andere passiert `_pflicht_pruefen` mit einem leeren Satz.

Bei den 21 Zusatzzeilen ist das richtig — `drawing1.xml`: „Alle
tilføjelsesrækker er optionelle at udfylde".

**Die Lücke sind die fünf Hauptzeilen:**

| Zeilentyp | Folge |
|---|---|
| `AD_Assumed_Platform_Operator` | Nullmeldung ohne Pflichtfelder wird angenommen |
| `AG_Assuming_Platform_Operator` | Ankündigung ohne `AG_DOC_REF_ID`, `TIN`, `RESIDENCE` geht durch |
| `ACT_Personal_Services` | keine Quartalspflicht |
| `ACT_Sale_Of_Goods` | keine Quartalspflicht |
| `ACT_TR_Transportation_Rental` | keine Quartalspflicht |

Die Pflichtsätze lassen sich direkt aus der Matrix ableiten: `AD`/`AG`
haben je 21 erlaubte Felder mit demselben Kern wie `PO_Platform_Operator`;
`ACT_Personal_Services` und `ACT_Sale_Of_Goods` haben **exakt dieselben 30
Felder** — die 28 Quartalsfelder plus `ROW_TYPE` und `RS_DOC_REF_ID`, also
dieselbe Quartalspflicht wie Immobilien, nur ohne Adresse.

**Die Matrix als Hinweisprüfung** („Feld gefüllt, obwohl für diesen
Zeilentyp nicht vorgesehen") wäre belastbar: Kein einziges der 89 Felder
ist in keinem Zeilentyp erlaubt, und alle fünf Beispielblätter halten sie
ausnahmslos ein. Als **Fehler** darf sie nicht wirken (Befund 28: sie
steuert die Anzeige), als Hinweis fängt sie:

- `MSG_MESSAGE_REF_ID`/`PO_DOC_REF_ID` in einer Verkäuferzeile — heute
  fällt nur die *Wiederholung* auf, der erste falsch platzierte Wert bleibt
  stumm
- Quartalsbeträge in einer Verkäuferzeile
- `ADDR_*` in einer Nicht-Immobilien-Aktivität
- `DOC_TYPE_INDIC` in einer `ACT_*`-Zeile
- Fahrzeugfelder in einer Immobilienzeile und umgekehrt

## Befund 34 — „Alle rækker skal referere til samme MessageRefId" meint den XML-Baum, nicht die CSV-Zeile

`Vejledningstekster` R6/R23 und Kommentar `B1`/`C1`: „**Alle rækker** i
samme besked skal referere til samme MessageRefId" — gleichlautend für
`PO_DOC_REF_ID`.

Wörtlich gelesen hieße das: jede Zeile trägt die Kennung. Das ist falsch
und war schon einmal die Ursache eines Fehlers (siehe Befund 8). Die
Auflösung wie bei der Kardinalität: Der Satz beschreibt die **logische
Zugehörigkeit im DPI-XML-Baum**, nicht eine Wiederholungspflicht in der
CSV. Belegt durch die Matrix (`MSG_MESSAGE_REF_ID` nur bei `Message`
angekreuzt, `PO_DOC_REF_ID` nur bei `PO_Platform_Operator`) und durch alle
fünf Beispielblätter.

Steht hier, weil die Formulierung beim nächsten Leser denselben Irrtum
auslöst.

## Befund 35 — die Vorlage widerspricht sich bei `CORR_DOC_REF_ID` und OECD3

| Fundstelle | Bedingung |
|---|---|
| `Vejledningstekster` R25 (PO), Kommentar `N1` am **Arbeitsblatt** | „OECD2 **eller OECD3**" |
| `Vejledningstekster` R67/R97/R127/R170, Kommentare der Beispielblätter | nur „OECD2" |
| `drawing1.xml` Punkt 4.2 | „OECD2 **eller OECD3**" |

Zwei zu zwei. Maßgeblich ist die weitere Lesart (OECD2 **und** OECD3): Sie
steht in der Anleitung und im Kommentar des Arbeitsblatts `Indberetning`,
das nach Befund 29 das jüngere und exportierte Blatt ist. Fachlich ist sie
auch die einzig sinnvolle — eine Löschung ohne Angabe, was gelöscht werden
soll, ist wertlos.

Zweite Hälfte desselben Satzes, bisher nicht belegt: **„Skal (kun)
anvendes"** — die Regel gilt beidseitig. `CORR_DOC_REF_ID` bei `OECD0`
oder `OECD1` ist ein Verstoß.

## Befund 36 — Nullmeldung und Ankündigung sind FREIWILLIG

`Eksempel Oversigt` F9 und F11, beide wörtlich: **„Indberetningen er
optionel."**

Das schränkt Befund 19 ein: Die Prüfung „`DPI403` ↔ keine Verkäuferzeile"
gilt weiterhin für eine eingereichte Datei — aber eine **fehlende**
Nullmeldung ist kein Fehler. Die Empfangsstelle darf sie nicht anmahnen.

## Befund 37 — wir dürfen in einer Kundenmeldung nicht vorkommen

`Eksempel Oversigt` F10, wörtlich:

> „Hvis indberetningen foretages af en **delegeret tredjepart** f.eks. en
> professionel service udbyder som ikke selv er operatør af platformen, så
> **må indberetningen ikke indeholde oplysninger om den delegerede
> tredjepart**. Rapporterende Platform Operator og Assumed Platform
> Operator skal **altid** være operatører der juridisk tegner for
> platformen."

Das ist die amtliche Gegenprobe zu Befund 15 — und sie sagt mehr: Befund 15
begründet, dass myNextDays nicht meldepflichtig ist. Hier steht, dass wir
in der Datei **auch nicht genannt werden dürfen**. `PO` und `AD` sind
ausschließlich der Betrieb.

Nicht maschinell prüfbar, aber eine harte Regel für unseren Erzeuger — und
ein Beleg aus der amtlichen Datei statt aus einer externen Quelle.

## Befund 27 — die Dropdowns der Vorlage haben ein Loch: Zeile 27 ist ausgespart

Fünf der elf x14-Validierungen tragen einen zerrissenen Bereich:

```
AC2:AC26  …  AC28:AC1048576     ← Zeile 27 fehlt
AF2:AF26  …  AF28:AF1048576
AG2:AG26  …  AG28:AG1048576
AI2:AI26  …  AI28:AI1048576
AD2:AD26  …  AD28:AD1048576
AM2:AM26  …  AM28:AM1048576
```

Zeile 27 ist **keine Leerzeile**: Sie trägt 42 gefüllte Felder, eine
`ACT_Immovable_Property`-Zeile mit `RS_DOC_REF_ID=DK202544179377_012`,
Oddenvej 3 in Hjørring, `ADDR_COUNTRY=DK`.

Entstanden ist das beim Einfügen einer Zeile: Excel zerreißt den
Validierungsbereich, und niemand merkt es, weil **ein fehlendes Dropdown
stumm ist** — die Zelle sieht aus wie jede andere, nimmt aber jeden Wert
an. `ADDR_COUNTRY` steht dort ungeprüft gegen die 252 Ländercodes.

Die Lehre für unseren Prüfer: **Die Excel-Dropdowns sind kein verlässlicher
Schutz.** Sie belegen, WAS gilt (Befund 22), aber sie erzwingen es nicht
lückenlos. Jeder Enum-Wert muss serverseitig gegen `Enumerationer` geprüft
werden — für jede Zeile, ohne Ausnahme. Dieselbe Klasse wie eine tote
Prüfregel (Befund 18): eine Kontrolle, die stumm ausfällt, ist schlimmer
als keine, weil man sich auf sie verlässt.

## Befund 28 — die Erlaubnismatrix `Kolonner` darf nie über den Spaltenindex gelesen werden

`Kolonner` trägt eine Matrix ROW_TYPE × Feld (`X` = für diesen Zeilentyp
vorgesehen). Sie ist fachlich wertvoll — aber ihre Spaltenreihenfolge
weicht ab Position 54 von `Indberetning` ab (Befund zur Blattreihenfolge
oben, 27 Positionen).

Wer die Matrix **positionsbasiert** gegen die CSV-Spalten legt — der
naheliegende Weg —, bekommt für 27 der 89 Spalten die Regel eines fremden
Feldes. Auflösen ausschließlich über den **Feldnamen** in `Kolonner` Zeile 1.

Was die Matrix sauber hergibt:

| Zeilentyp | erlaubte Felder |
|---|---|
| `Message` | 8 |
| `ACT_TR_Detail` | 6 — `ROW_TYPE`, `RS_DOC_REF_ID`, `RS_ACT_DK_GRI(_CCY)`, `RS_ACT_DK_VEHICLE_CAT`, `…_REG_NUM` |
| `ACT_Immovable_Property` | als einziger Aktivitätstyp die zwölf `ADDR_*` plus `LAND_REG_NUM`, `PROP_TYPE`, `RENTED_DAYS`, BFE |
| `ACT_Personal_Services` / `ACT_Sale_Of_Goods` | exakt dieselbe Feldmenge |

Wichtig bleibt die Einschränkung von oben: Ein fehlendes Kreuz heißt „dem
Nutzer nicht gezeigt", nicht „unzulässig" — die Matrix steuert
`DisplayColumnsForRowtype`, nicht die Gültigkeit.

## Befund 29 — die Beispielblätter sind eine ÄLTERE Generation als das Eingabeblatt

Die Zellkommentare sind maschinell gesetzt (je Blatt exakt 89, alle mit
derselben Sekunde — ein Lauf des Makros, nicht 89 Eingaben; Wurzel 5b in
der Vorlage selbst). Ihre Zeitstempel trennen zwei Schichten:

| Blatt | Autor | Datum |
|---|---|---|
| `Indberetning` | Kristian Toksvig | **2024-01-08** |
| `Eksempel 1`, `1.1`, `Eks 2` | Bjarke Bitsch (`bbi@UFST.DK`) | **2023-08-08** |
| `Eksempel 2.1`, `3`, `Oversigt` | — kein Kommentarlauf | jünger, nachträglich eingefügt |

Diese Trennlinie deckt sich exakt mit dem Datumsformat-Ausreißer aus
Befund 26: Die 2023er-Blätter tragen `MSG_REPORTING_PERIOD` als
Serial-Zahl, die späteren als Text.

**Folge: Bei einem Widerspruch zwischen Beispielblatt und `Indberetning`
gilt `Indberetning`.** Es ist das Blatt, das das VBA exportiert, und das
jüngere.

## Befund 24 — diese Datei ist NICHT die Blankovorlage der Behörde

`xl/workbook.xml`, `x15ac:absPath`:

```
G:\Meine Ablage\AIRSMIL\Husejer\Afregning husejere\DAC7\indberetning 2025\
```

Der zuletzt speichernde Rechner hatte eine **deutschsprachige**
Google-Drive-Ablage („Meine Ablage") des Betriebs AIRSMIL im Ordner
„Abrechnung Hausbesitzer". Es ist also eine weitergereichte
Arbeitskopie, keine Blankovorlage von Skattestyrelsen.

Das erklärt die echten Personendaten im Blatt `Indberetning` (siehe die
Warnung weiter unten): Sie sind nicht Teil der amtlichen Vorlage, sondern
die tatsächliche Meldung eines Betriebs. Für die Frage „was ist amtlich
verbindlich" heißt das: **`Indberetning` Zeile 1 ist amtlich (Spaltenkopf,
Fettdruck, Validierung), Zeile 2 ff. sind Fremddaten.**

Verfasser der Zellkommentare (`xl/persons/person.xml`): **Bjarke Bitsch**,
`bbi@UFST.DK` — Udviklings- og Forenklingsstyrelsen, die IT-Behörde der
dänischen Steuerverwaltung. Das ist der amtliche Urheber. Ein zweiter Name
(Kristian Toksvig) trägt kein Verzeichniskonto.

## Befund 25 — fünf Spalten sind ab Werk ausgeblendet, eine davon ist Pflicht

`xl/worksheets/sheet6.xml`, `<col min="31" max="35" hidden="1">`:

| Spalte | Feld | fett = Pflicht |
|---|---|---|
| 31 | `IN` | nein |
| 32 | `IN_ISSUED_BY` | nein |
| 33 | `IN_TYPE` | nein |
| 34 | **`ORGANISATION_NAME`** | **ja** |
| 35 | `PO_NEXUS` | nein |

**`ORGANISATION_NAME` ist fett (also Pflicht) und trotzdem unsichtbar.**
Wer das Blatt öffnet und ausfüllt, sieht diese Pflichtspalte nicht — sie
wird erst durch `DisplayColumnsForRowtype` eingeblendet, wenn man in
Spalte A einen passenden Zeilentyp wählt.

Für den Export folgenlos: `EksporterCSV` läuft über
`Cells(1,1).CurrentRegion.Columns.Count` und nimmt ausgeblendete Spalten
mit. Die CSV hat immer 89 Felder.

## Befund 26 — die Datumsspalten sind als TEXT formatiert

`MSG_REPORTING_PERIOD` (Spalte K) steht auf Zahlenformat `@` (Text). Die
Werte im Arbeitsblatt sind entsprechend Zeichenketten.

Das ist die Absicherung gegen das Gebietsschema: `EksporterCSV` liest den
Zellinhalt über `stringContent = Cells(R, k)`, also die **angezeigte**
Darstellung. Bei einer Text-Zelle kommt zeichengetreu `DD-MM-YYYY` heraus;
bei einer echten Datums-Zelle hinge das Ergebnis vom Windows-Regionalformat
des ausführenden Rechners ab.

Genau dieser Fall tritt in der Vorlage selbst auf: In `Eksempel 1` und
`1.1` ist `MSG_REPORTING_PERIOD` **kein Text**, sondern die Seriennummer
`45291` mit Datumsformat — in `Eksempel 2.1` und `3` wieder Text. Zwei der
fünf Beispielblätter verletzen die eigene Formatvorgabe.

Folge für unseren Erzeuger: Datumsfelder immer als Zeichenkette
`DD-MM-YYYY` schreiben, nie als Datumswert. Alle Betragsspalten stehen auf
`0` (ganzzahlig, keine Dezimalstellen), `TIN` auf Text — letzteres
verhindert, dass führende Nullen einer CPR-Nummer verloren gehen.

## Befund 23 — die Beispielblätter: Regeln, die nur vorgeführt werden

Die fünf Beispielblätter sind die einzige Stelle, an der der Aufbau
vollständig durchgespielt wird. Was sie zeigen und nirgends als Text steht:

**Wahrheitswerte — zwei Schreibweisen in der Quelle, EINE in der CSV.**
Im Roh-XML sind `TIN_UNKNOWN` echte Excel-Booleans (`t="b"`, Wert `0`),
`PO_ASSUMED_REPORTING` dagegen eine Zeichenkette (`t="s"` → sharedString
1027 = `SANDT`). Beim Export macht `commaReplace` daraus per
`Replace(";FALSE;", ";FALSK;")` in beiden Fällen die dänische Form. **Damit
ist `SANDT`/`FALSK` als einzig zulässige CSV-Schreibweise dreifach belegt**
(Dropdown, VBA, Export) — die Beispielblätter zeigen `False` nur, weil sie
den Export noch nicht durchlaufen haben. Unsere strenge Prüfung ist richtig.

**`DPI403` heißt nicht „Nullmeldung", sondern „Meldung ohne
Verkäuferdaten".** Es trägt zwei verschiedene Fälle, unterschieden allein
durch die Folgezeilen:

| | Ankündigung (Bsp. 2) | Nullmeldung (Bsp. 3) |
|---|---|---|
| `MSG_MESSAGE_TYPE_INDIC` | `DPI403` | `DPI403` |
| Folgezeilen | `PO` + **`AG_Assuming_PO`** | `PO` + n × `AD_Assumed_PO` |
| `PO_ASSUMED_REPORTING` | **`SANDT`** | leer |

Das schärft Befund 19: Die Prüfung „`DPI403` ↔ keine Verkäuferzeile" gilt
für beide, aber `PO_ASSUMED_REPORTING=SANDT` nur für die Ankündigung.
`AG` und `AD` treten nie gemeinsam auf.

**`MSG_SENDING_ENTITY_IN` — die Regel „nur bei `DPI403`" ist WIDERLEGT.**
In den fünf Beispielblättern sieht es so aus (leer bei `DPI401`/`DPI402`,
gefüllt bei `DPI403`). Das maßgebliche Arbeitsblatt `Indberetning` ist aber
`DPI401` **und** trägt `MSG_SENDING_ENTITY_IN = 44179377` — derselbe Wert,
den Befund 10 als Beleg zitiert.

Nach Befund 29 (bei Widerspruch gilt `Indberetning`) ist die Regel damit
falsch. Eine Prüfung „SEI nur bei DPI403" **würde die echte Meldung des
Betriebs ablehnen.** Die Feldtabelle führt es als `0..1` — optional, in
jeder Meldungsart. Hier stand bis zum 11.09.2026 das Gegenteil.

**Die Korrektur ist ein Vollersatz, kein Delta.** `Eksempel 1.1` wiederholt
alle 30 Quartalswerte des korrigierten Verkäufers unverändert und schickt
seine Aktivitätszeilen komplett mit — in geänderter ANZAHL (zwei
`ACT_TR_Detail` statt einer). Nicht korrigierte Verkäufer fehlen ganz. Die
`PO`-Zeile behält bei `OECD0` ihre alte `PO_DOC_REF_ID`; der korrigierte
Verkäufer bekommt eine neue (`…013COR`) und trägt die alte in
`CORR_DOC_REF_ID`. Die `ACT_*`-Zeilen tragen die NEUE Kennung, aber
**kein** eigenes `CORR_DOC_REF_ID`.

**`ACT_*`-Zeilen tragen kein `DOC_TYPE_INDIC`** — in allen fünf Blättern
ausnahmslos leer. Sie sind kein eigenständiges Dokument, sondern hängen
allein über `RS_DOC_REF_ID` am Verkäufer. In `pruefung_csv.py` ist das
korrekt abgebildet (`_PFLICHT["ACT_Immovable_Property"]` verlangt es nicht).

**Ein Verkäufer je Steuerdomizil, nicht eine Zeile mit mehreren TIN.**
`Eksempel 1` führt denselben Menschen (`Jens Karlsen`) zweimal: einmal mit
`RESIDENCE=DK`, einmal mit `RESIDENCE=HU` — zwei eigene `RS_DOC_REF_ID`.
Die Mehrfachwert-Zeilentypen (`RS_Residence_Country_Code`,
`RS_Tax_Identification_Number`, `RS_Address`, `RS_IND_Middle_Name`) kommen
in KEINEM Beispiel vor; vorgeführt wird als Zusatzzeile nur `ACT_TR_Detail`.

**Die Währung ist strukturell, nicht wertabhängig.** `*_CCY` wird auch bei
Betrag `0` und bei LEEREM Betrag gesetzt. Ein Betrag ohne Währung kommt
nirgends vor. Die Währung wechselt je Aktivitätszeile (Immobilien `DKK`,
Fahrzeuge `EUR` im selben Verkäufer) — es gibt keine Meldungswährung.

**„Kein Umsatz" steht mal als `0`, mal als LEER.** Dieselbe Immobilie
(`RS_ACT_LAND_REG_NUM=3465LKE`) trägt in `Eksempel 1` Z8
`RS_ACT_NUM_Q1..Q4 = 1, 0, 0, 0`, in `Eksempel 2.1` Z7 dagegen
`1, leer, leer, leer`. Ein Prüfer darf beides nicht unterscheiden.

(Hier stand als Beleg `RS_ACT_NUM_Q2=0` gegen leer — falsches Feld, dort
steht in beiden Blättern `4`. Die Beobachtung stimmt, der Beleg zeigte auf
die falsche Zeile.)

**`RS_ACT_DK_GRI` ist KEINE Ableitung der Quartalssummen.** Zwei Zeilen mit
identischen `CONS`-Werten (Summe 10000) tragen GRI `20000` bzw. `10000`.
Das stützt Befund 13: GRI ist eine eigenständig gemeldete Größe.

**`MSG_VERSION` ist die Zeichenkette `1.0`** — als Zahl gelesen würde `1`
daraus, und die Meldung wäre formal falsch.

**`MSG_REPORTING_PERIOD` ist uneinheitlich abgelegt:** in `Eksempel 1` und
`1.1` ein echter Excel-Datumswert (`45291`), in den drei anderen der Text
`31-12-2023`. Beim Export ergibt das je nach Gebietsschema
unterschiedliche Schreibweisen — ein Grund mehr, `31-12-YYYY` beim Empfang
hart zu prüfen (Befund 6).

**Zwei Datenfehler der Vorlage, die nicht nachgebaut werden dürfen:**
`Eksempel 1` Z10 lässt `RS_ACT_FEES_Q2` leer, während die Währung gesetzt
ist und alle Nachbarzeilen `0` tragen. Und `Eksempel 3` Z3 gibt
`SummertimeHouses I/S` den TIN `4567893641`, der in `Eks 2` der belgischen
`BuchendorBetriebung` gehört — Copy-Paste zwischen den Blättern.

## Befund 22 — ELF weitere Datenvalidierungen standen im x14-Erweiterungsblock

Der Abschnitt oben nannte vier `dataValidation`-Einträge. Das ist die
Hälfte der Wahrheit: Eine Validierung, die auf einen **anderen Blattbereich**
zeigt (`Enumerationer!$B$2:$B$253`), passt nicht ins alte Schema und steht
deshalb in `<x14:dataValidations>` am Ende von `sheet6.xml` — ein
Erweiterungsblock, den ein `grep "<dataValidation "` nicht findet.

Dort stehen **11 weitere Regeln**, die jede Enum-Spalte maschinell
erzwingen:

| Werteliste | erzwingt |
|---|---|
| `Enumerationer!B2:B253` (Länder) | `RESIDENCE`, `TIN_ISSUED_BY`, `ADDR_COUNTRY`, `IN_ISSUED_BY`, `RS_BIRTH_COUNTRY` |
| `H2:H187` (Währungen) | **alle 13 `*_CCY`-Spalten** |
| `D2:D4` | `MSG_MESSAGE_TYPE_INDIC` |
| `E2:E8` | `DOC_TYPE_INDIC` |
| `F2:F6` | `IN_TYPE` |
| `G2:G6` | `PO_NEXUS` |
| `I2:I11` | `RS_ACT_PROP_TYPE` |
| `J2:J4` | `RS_ACT_DK_VEHICLE_CAT` |
| `K2` | `MSG_VERSION` |
| `L2:L6` | `ADDR_LEGAL_ADDRESS_TYPE` |
| `M2:M28` | `RS_PERM_ESTABLISHMENT` |

Abgleich gegen `_WERTELISTEN` in `pruefung_csv.py`:

- **13 Währungsspalten sind amtlich validiert — bei uns prüft KEINE einzige
  gegen `vorlage.WAEHRUNGEN`.** Die Liste mit 186 Codes liegt vor und wird
  nie benutzt. `RS_ACT_CONS_Q1_CCY = "KRONEN"` geht heute durch.
- Drei weitere Spalten sind amtlich gegen eine Liste validiert und bei uns
  ungeprüft: `IN_ISSUED_BY`, `RS_BIRTH_COUNTRY`, `RS_PERM_ESTABLISHMENT`.

Ein Fehler der Vorlage fällt dabei auf: `DOC_TYPE_INDIC` validiert gegen
`E2:E8`, obwohl `DocTypeIndicEnum` nur vier Werte hat (E5–E8 leer) — die
Liste lässt dadurch auch den Leerwert zu.

**KORRIGIERT am 11.09.2026:** Hier stand ein zweiter, angeblicher Fehler der
Vorlage — `RS_PERM_ESTABLISHMENT` werde gegen `M2:M28` validiert, und
Spalte M sei `MsgVersionEnum` mit dem einzigen Wert `1.0`. Das war falsch.
Nachgezählt in `Enumerationer` Zeile 1:

| Spalte | Liste |
|---|---|
| K | `MsgVersionEnum` |
| L | `LegalAddressTypeEnum` |
| **M** | **`EUCountryCodeEnum`** (27 Werte) |

`MsgVersionEnum` ist **K**, nicht M. Die Validierung `M2:M28` zeigt also
auf die EU-Länderliste und ist **korrekt** — genau wie die Feldtabelle es
verlangt. Der Vorlage wurde hier ein Fehler unterstellt, der bei uns lag:
eine um zwei Spalten verschobene Zuordnung.

Was bleibt, ist allein die offene Bindung auf unserer Seite:
`RS_PERM_ESTABLISHMENT` gegen `vorlage.EU_LAENDERCODES` prüfen. Die Liste
ist definiert und wird in `pruefung_csv.py` **nirgends benutzt**.

`ROW_TYPE` (Spalte A) hat **gar keine** Validierung; der Wert kommt
ausschließlich über das VBA-Formular.

## Was das VBA beim Export tut

`EksporterCSV` + `commaReplace`, in dieser Reihenfolge:
1. ersetzt in allen Zellen `,` durch `|`
2. schreibt `!` in Spalte 90 als Endemarke
3. speichert als `xlCSVUTF8` (also **UTF-8**, kommagetrennt)
4. ersetzt danach im Dateiinhalt `,`→`;`, dann `|`→`,`
5. ersetzt `;FALSE;`→`;FALSK;` und `;TRUE;`→`;SANDT;`
6. entfernt `;!` (die Endemarke)

Folge: **Kommas bleiben im Textfeld erhalten** (sie werden nur temporär
getauscht).

Hier stand bis zum 11.09.2026: „Unser `csv_dk._text()` ersetzt Kommas
dauerhaft durch Leerzeichen … Noch nicht bewertet." Beides ist überholt —
bewertet wurde es in Befund 4, und der Code ersetzt seit dem 10.09.2026
kein Komma mehr (`csv_dk.py:50`, ausdrücklich: „Das KOMMA gehört bewusst
NICHT dazu"). Das Semikolon wird weiter ersetzt; dort ist unsere Erzeugung
bewusst strenger als die Vorlage, weil ein Semikolon im Feldwert die Zeile
zerreißt und die Vorlage kein Maskieren kennt.

## Die Feldtabelle — Pflichtangaben mit Kardinalität

`Vejledningstekster` ist die Quelle, aus der das Makro `OpdaterVejledningstekster`
die Zellkommentare erzeugt. Sie hat je Feld: Kolonnenavn, Attribut, Vejledning,
**Type**, **Kardinalitet**, **Tilføjelsesobjekt**. Das ist die einzige Stelle,
die Pflicht von Kür trennt.

Was unser CSV-Serialisierer (`csv_dk.py`) bei vollständiger Meldung erfüllt:

- `PO_Platform_Operator`: alle 4 Pflichtfelder ✓
- `ACT_Immovable_Property`, Quartalsfelder: alle **28** Pflichtfelder ✓
  (`RS_ACT_NUM/CONS/FEES/TAX` × Q1–Q4 samt Währungen sind **jeweils `1..1`** —
  also auch dann zu schreiben, wenn der Wert 0 ist; die Beispiele zeigen genau
  das)
- `RS_IND`/`RS_ENT`/`ACT_*`: `MSG_MESSAGE_REF_ID`, `RS_DOC_REF_ID`,
  `DOC_TYPE_INDIC` ✓ — **`PO_DOC_REF_ID` fehlt** (Befund 3)
- `Message`: es fehlen `MSG_TRANSMITTING_COUNTRY`, `MSG_RECEIVING_COUNTRY`,
  `MSG_MESSAGE_TYPE`, `MSG_TIMESTAMP` — **diese vier gibt es unter den 89
  CSV-Spalten nicht**, sie existieren nur im DPI-XML. Kein Fehler für die CSV.
  Die Vormerkung „für den Formatwechsel 2026" ist seit dem 11.09.2026
  **erledigt**: `xml_dpi._messagespec` schreibt alle vier
  (`TransmittingCountry`, `ReceivingCountry`, `MessageType`, `Timestamp` —
  `xml_dpi.py:176–184`).

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

## Befund 20 — die Pflichtfelder stehen als FETTDRUCK in der Datei

Die Anleitung (`drawings/drawing1.xml`) sagt es wörtlich:

> „De med **fed** markerede overskrifter, angiver obligatoriske felter dvs.
> de altid skal udfyldes for en given type af række/rowtype."

Die Pflicht steht also nicht nur in der Kardinalitätsspalte, sondern als
**Zellformatierung** in Zeile 1 des Blattes `Indberetning`. Wer die Datei
als Werte liest (`data_only=True`), sieht davon nichts — man muss die
Schriftart abfragen:

```python
wb = openpyxl.load_workbook(datei)          # OHNE data_only
fett = {c.value for c in wb['Indberetning'][1] if c.font and c.font.b}
```

**47 Spalten sind fett.** Abgleich gegen
`apps/dac7-staging/src/core/pruefung_csv.py`:

| | |
|---|---|
| fett in der Vorlage | 47 |
| davon in `_QUARTALSPFLICHT` (28 Quartalsfelder) | vollständig, deckungsgleich |
| davon in `_PFLICHT` je Zeilentyp | 14 |
| **weder noch** | **5** |

Die fünf ungedeckten: `ROW_TYPE`, `TIN_ISSUED_BY`, `ADDR_CITY`,
`AD_DOC_REF_ID`, `AG_DOC_REF_ID`.

- `ROW_TYPE` wird strukturell geprüft (unbekannter Typ → Befund), nur nicht
  über `_PFLICHT` — kein echter Mangel.
- `AD_DOC_REF_ID` / `AG_DOC_REF_ID` betreffen die Zeilentypen
  `AD_Assumed_*` und `AG_Assuming_*`, für die `_PFLICHT` überhaupt keinen
  Satz führt (es kennt nur fünf Zeilentypen). Sie werden in einer
  Nullmeldung gebraucht (Befund 19).
- **`TIN_ISSUED_BY` und `ADDR_CITY` sind die echte Lücke.** Beide sind in
  jeder Verkäufer- und Betreiberzeile fett, beide fehlen in unserer
  Pflichtliste. `ADDR_CITY` trägt zusätzlich die bedingte Regel
  „Obligatorisk hvis ADDR_FREE ikke udfyldes" — die Kombination „kein Ort,
  kein Freitext" läuft heute durch.

Dass die Quartalsfelder exakt übereinstimmen, ist der Gegenbeweis zur
Sorge, der Fettdruck sei bloß Gestaltung: Er deckt sich Feld für Feld mit
der Kardinalität `1..1` aus `Vejledningstekster`.

## Befund 21 — der Korrekturablauf steht nur in der Anleitung

`drawings/drawing1.xml`, wörtlich — vier Bedingungen, die bei JEDER
Korrektur gelten:

> 1. Nyt MessageRefId skal angives
> 2. MessageTypeIndic skal udfyldes med „DPI401" for at tilføje eller
>    „DPI402" for at rette og slette
> 3. Message timestamp skal opdateres
> 4. For hvert højniveauobjekt (Platform Operator, Reportable Seller,
>    Assuming PO, Assumed PO):
>    4.1 DocTypeIndic = OECD0 (gensend) / OECD1 (ny) / OECD2 (korrektion) /
>        OECD3 (sletning)
>    4.2 **CorrDocRefId skal udfyldes**, hvis DocTypeIndic = OECD2 eller OECD3
>    4.3 **Nyt DocRefId skal angives**, hvis DocTypeIndic = OECD1, OECD2
>        oder OECD3

Punkt 4.2 und 4.3 sind Kopplungen, die unsere Prüfung nicht kennt:
`CORR_DOC_REF_ID` kommt in `pruefung_csv.py` weder in `_PFLICHT` noch in
`_WERTELISTEN` vor. Eine Korrekturdatei mit `OECD2` ohne
`CORR_DOC_REF_ID` wird angenommen — die Behörde weiß dann nicht, welcher
Satz korrigiert werden soll.

Ebenfalls nur hier: **„for hver type skal der indberettes summeres pr.
kvartal. Undtagelsen er aktivitetstypen Immovable Property, hvor der skal
indberettes en række pr. ejendom."** Das ist die Begründung dafür, warum
Immobilien je Objekt eine Zeile bekommen und die anderen drei
Aktivitätstypen je Verkäufer nur eine.

## Befund 19 — die Nullmeldung fehlt in der CSV-Prüfung ganz

Der Baum endet an ZWEI Stellen in einer `Nulindberetning` — und beide
Wege sind Meldungen ohne eine einzige Verkäuferzeile:

- keine Verkäufer vorhanden („Ingen sælgere")
- ein anderer Betreiber meldet („Nulindberetning om anvendelse af anden
  indberetter")

Daraus folgen drei Regeln, die in keinem Blatt stehen:

1. **Ohne Verkäuferzeile MUSS `MSG_MESSAGE_TYPE_INDIC` auf `DPI403`
   stehen.** Umgekehrt: mit `DPI403` darf keine Verkäufer- oder
   Aktivitätszeile in der Datei sein. Belegt durch Blatt
   `Eksempel 3 Nulindberetning`: `DPI403`, danach nur `PO_Platform_Operator`
   und zwei `AD_Assumed_Platform_Operator` — kein `RS_*`, kein `ACT_*`.
2. **Der Weg „anderer meldet" verlangt eine `AG_Assuming_Platform_Operator`-
   Zeile.** Blatt `Eks 2 Anvende anden indberetter` zeigt genau das:
   `DPI403` + `PO_Platform_Operator` + `AG_Assuming_Platform_Operator`.
3. Eine `ACT_TR_Detail`-Zeile ist laut Baum **optional** und nur „hvis
   flere" — sie hängt immer unter `ACT_TR_Transportation_Rental`.

Stand im Code: `_datei_pruefen` in
`apps/dac7-staging/src/core/pruefung_csv.py` prüft genau eine
`Message`-Zeile, genau eine `PO_Platform_Operator`-Zeile und dass die erste
Datenzeile die `Message` ist. `DPI403` kommt in der ganzen CSV-Prüfung
**nicht vor** (nur `pruefung_xml.py` kennt die Regel). Eine Meldung ohne
Verkäufer mit `DPI401` wird angenommen, obwohl die Behörde sie als
Nullmeldung erwartet — und eine `DPI403`-Datei mit Verkäuferzeilen
ebenfalls.

Das ist die dritte Regel dieser Art: fachlich eindeutig, aber ausschließlich
im **Bild** hinterlegt. Wer nur Blätter und Kommentare liest, findet sie
nicht.

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

Belegt: (Hier standen fünf CPR-Nummern als „Belegt:“ — `010190-1234` und vier weitere. **Sie existieren in der Datei nicht.** Die echten 18 lauten `111179-2691`, `050275-3142`, `140461-0062` und so fort. Der Befund selbst stimmt: 18 von 18 tragen den Bindestrich. Zweiter erfundener Beleg in diesem Dokument nach `LeCampz, SARL` — beide Male anonymisierte Wunschwerte statt Abschrift.)
Alle 18 tragen den Bindestrich, keine einzige steht ohne. (Hier stand noch `050594-5678` — die letzte der fünf erfundenen Nummern; die Korrektur davor hatte den angebrochenen Satz nicht mit erfasst.)

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

## Befund 17 — KORRIGIERT: die zweite Kopplung ist GRI → Währung, nicht GRI → BFE

Hier stand bis zum 11.09.2026, die BFE/GRI-Kopplung gelte „in beide
Richtungen". **Das war falsch** — eine Fehlzuordnung der Zelle. Die beiden
Sätze hängen an benachbarten, aber verschiedenen Spalten:

| Zelle | Spalte | Kommentar |
|---|---|---|
| `CG1` | `RS_ACT_DK_GRI` | „Mandatory if Real Property Registration Number BFE er provided" |
| `CH1` | **`RS_ACT_DK_GRI_CCY`** | „Obligatorisk hvis Gross Rental Income amount er angivet" |
| `CI1` | `RS_ACT_DK_REAL_PROP_REG_NUM` | — keine Bedingung |

Die BFE-Spalte trägt **keine** Bedingung. Was wirklich gilt:

1. **BFE gesetzt → GRI Pflicht** (`CG1`) — in `pruefung_csv.py` geprüft.
2. **GRI gesetzt → GRI_CCY Pflicht** (`CH1`) — **nicht geprüft**, und
   zusammen mit „Bruttolejeindtægten skal oplyses i DKK" heißt das:
   `RS_ACT_DK_GRI_CCY` muss gesetzt UND `DKK` sein.

Die Lehre ist dieselbe wie beim Fettdruck: Eine Zellreferenz muss über den
Spaltenkopf aufgelöst werden (`CH` ist Spalte 86 = `RS_ACT_DK_GRI_CCY`),
nicht nach Gefühl dem inhaltlich naheliegenden Feld zugeordnet. Eine
erfundene Pflicht ist genau der Fehler, den dieses Dokument in der Präambel
verbietet — hier ist er mir selbst unterlaufen.

Wo die Bedingungen stehen, ist ebenfalls zu beachten: `comments1.xml` gehört
zum Arbeitsblatt `Indberetning` und trägt an `CG1`/`CH1` **keine**
Bedingung. Die Bedingungen stehen nur in `comments2/3/4.xml`, also an den
Beispielblättern. Sie gelten trotzdem — es ist dieselbe amtliche Datei —,
aber wer nur das Arbeitsblatt liest, findet sie nicht.

## Befund 18 — `RS_TIN_UNKNOWN` gibt es nicht: eine Prüfung, die nie feuert

`pruefung_csv.py:125`:

```python
_WAHRHEITSSPALTEN = ("PO_ASSUMED_REPORTING", "RS_TIN_UNKNOWN")
```

Die Spalte heißt in der Vorlage `TIN_UNKNOWN` — Position 18 des
Spaltenkopfs, so auch in `vorlage.SPALTEN`. `RS_TIN_UNKNOWN` kommt in der
gesamten amtlichen Datei **null Mal** vor und steht auch in unserer eigenen
Spaltenliste nicht. Die Wahrheitswert-Prüfung greift für diese Spalte
deshalb nie: `TIN_UNKNOWN=ja`, `=1`, `=vielleicht` passieren ungeprüft.

Doppelt belegt, dass die Prüfung dort hingehört: Die Datenvalidierung der
Vorlage legt genau auf diese Spalte (`R`) die Liste `SANDT,FALSK`.

Es ist derselbe erfundene Präfix wie bei `ORGANISATION_NAME` (siehe den
Kommentar in `pruefung_csv.py`) — dort geräumt, hier stehen geblieben. Eine
Prüfregel, die auf einen Spaltennamen zeigt, den es nicht gibt, ist stumm:
weder `ruff` noch `pylint` noch `pytest` sehen sie, weil die Fake-DB und die
Testdaten jeden Namen annehmen (vgl. `db-spalten-pruefen.py`, dieselbe
Fehlerklasse).

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

## Befund 16 — HINFÄLLIG (widerlegt, siehe „Keine offenen Fragen“) — Quartalszuordnung ist frei wählbar

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

## Befund 46 — die Datei braucht ein BOM: das Makro exportiert `xlCSVUTF8`

**Die erste technische Eigenschaft der Datei, die je geprüft wurde** — und
sie war falsch umgesetzt.

### Der Beleg — und seine KORREKTUR vom 11.09.2026

Das Makro `EksporterCSV` (`Module1.bas`, per `oletools` dekomprimiert)
speichert die Meldung zunächst so:

```vba
:147  Application.ActiveWorkbook.SaveAs fileName:=csvFile, _
:148      FileFormat:=xlCSVUTF8, CreateBackup:=False
```

`xlCSVUTF8` schreibt UTF-8 **mit Byte Order Mark** (`EF BB BF`) — das ist
sein Unterschied zum älteren `xlCSV`, das in der Systemkodierung schreibt.

**Hier stand bis zum 11.09.2026 der Schluss: „Die Behörde exportiert ihre
eigene Vorlage also mit BOM." Das ist falsch.** Die Belegkette endete eine
Stufe zu früh — fünf Zeilen weiter passiert das:

```vba
:152  Call commaReplace(currentFilePath, filnavn, csvFile)
```

Und `commaReplace` schreibt **dieselbe Datei neu**:

```vba
:189  Const ForReading = 1
:204  Set objTS = objFSO.OpenTextFile(strFullPath1, ForReading)
:205  strContents = objTS.ReadAll
      ' … sechs Replace-Aufrufe …
:216  Set objTS = objFSO.CreateTextFile(strFullPath1)
:217  objTS.Write strContents
```

`OpenTextFile` und `CreateTextFile` stehen **ohne** `Format`-Parameter da.
Damit gilt ihr Vorgabewert: **ANSI**, also die Windows-Systemcodepage.
Gegengeprüft über das ganze VBA-Projekt (17 Module): **null** Treffer für
`Tristate`, `Unicode`, `ADODB`, `Charset` oder `Local:=`; das einzige
`Format:=` ist jenes `xlCSVUTF8` in Zeile 148.

Folge: Das BOM wird als drei ANSI-Zeichen gelesen und als drei ANSI-Zeichen
zurückgeschrieben — auf CP1252 wird daraus `ï»¿`, kein BOM mehr. Die
UTF-8-Kodierung der Umlaute geht im selben Schritt verloren.

**`xlCSVUTF8` beschreibt also nur den Zwischenstand, nicht die fertige
Datei.** Die amtliche Enddatei ist ANSI mit einem zu Text verunfallten BOM.

### Warum das BOM trotzdem richtig ist

Der Grund hat sich geändert, die Entscheidung nicht:

* **Nicht** aus Nachbau-Treue — die Vorlage liefert am Ende kein BOM.
* **Sondern** weil Excel auf einem deutschen oder dänischen System das `;`
  nur bei vorhandenem BOM als Trennzeichen erkennt. Genau daran scheiterte
  die Ansicht (siehe unten).

Was die Vorlage hier tut, ist ein **Fehler ihres Makros**, keine Vorgabe.
Ihm zu folgen hieße, eine kaputte Kodierung nachzubauen.

Das ist Wurzel 5b in anderer Gestalt: eine plausible Belegkette, die eine
Stufe zu früh endet, sieht wie ein Beweis aus. `FileFormat:=xlCSVUTF8` zu
finden und daraus „die Behörde schreibt UTF-8 mit BOM" zu schließen, war
genau dieser Fehler — der Aufruf fünf Zeilen später macht es zunichte.

### Warum es auffiel — und warum erst so spät

Die erzeugte Datei war inhaltlich korrekt: 22 Zeilen, jede mit genau 89
Feldern, Trennzeichen `;`. Jede Prüfung war grün — unsere eigene
Dateiprüfung, die unabhängige Empfangsstelle, 215 Tests.

Sichtbar wurde der Mangel erst beim ÖFFNEN: Excel auf einem deutschen oder
dänischen System erkennt das `;` nur dann als Trennzeichen, wenn ein BOM die
Datei als UTF-8 ausweist. Ohne BOM legt es die ganze Zeile in EINE Spalte.
Gemeldet wurde es als *„die csv zum download kommt immer noch hochformat"* —
und genau so sah es aus: 22 Zeilen à einem Feld statt 22 × 89.

Das ist die Lehre dieses Befunds: **Eine Datei kann jede Prüfung bestehen und
trotzdem unbrauchbar sein.** Alle Prüfstellen dekodieren die Bytes selbst und
strippen ein BOM stillschweigend — keine von ihnen konnte sein Fehlen
bemerken. Nur ein Mensch mit Excel sah es.

### Was beide Seiten damit tun

| Stelle | Verhalten |
|---|---|
| `csv_dk.schreiben` | schreibt die BOM (`_BOM`, seit 11.09.2026) |
| `dateipruefung` (eigene Prüfung) | strippt sie ausdrücklich: `roh[0].lstrip("\ufeff")` |
| Empfangsstelle `einreichung._text_lesen` | dekodiert mit `utf-8-sig`, entfernt sie dabei |
| Download im PMS | zweiter Backstop in `dac7-meldung.tsx` (`speichern`) |

Gegengeprüft am echten Weg: Der Download liefert `239,187,191` vor `ROW`
(6731 Byte), und die Empfangsstelle nimmt die Datei weiter an — Quittung
`DK-20260911-BD6D10`, 21 Sätze, 0 Fehler.

### Festgeschrieben

`test_csv_dk.py::test_datei_beginnt_mit_bom`. Eigener Test, weil die BOM
sonst still wegfällt: JEDER Leser strippt sie, also bliebe jeder andere Test
grün. Die Hilfsfunktion `_zeilen` der Tests zieht sie ab — so wie jeder
echte Leser —, damit die übrigen Prüfungen weiter das Richtige messen.

### Was daraus für die Prüfung folgt

Unsere Prüfung fordert die BOM **nicht** ein. Das ist Absicht: Eine
eingereichte Datei ohne BOM ist inhaltlich vollwertig, und die Behörde
selbst nimmt beide an. Die BOM ist eine Vorgabe an unsere ERZEUGUNG, keine
Annahmebedingung.

## Befund 47 — die technischen Eigenschaften der Datei, vollständig

Die Frageklasse, die bis zum 11.09.2026 nie gestellt wurde (siehe
Leseprotokoll). Quelle durchgehend: `Module1.bas` aus `xl/vbaProject.bin`
(per `oletools` dekomprimiert) und `xl/worksheets/sheet6.xml`.

| Eigenschaft | Vorlage | unsere Erzeugung | Urteil |
|---|---|---|---|
| Trennzeichen | `;` — aber **nicht** an Excel gesetzt, sondern per `Replace(strContents, ",", ";")` (`:206`) NACH dem Speichern | `TRENNZEICHEN = ";"` | stimmt überein |
| Zeilenende | **CRLF** (Excel-`SaveAs`; `objTS.Write` `:217` schreibt den Puffer unverändert, kein `Replace` berührt `vbCr`/`vbLf`) | **LF** (`csv_dk.py:368`) | **weicht ab** |
| Kodierung (Enddatei) | ANSI, BOM zerstört (Befund 46) | echtes UTF-8 + BOM | weicht ab — **wir sind richtig** |
| Abschluss | genau ein Terminator, keine Leerzeile (`Write`, nicht `WriteLine`) | genau einer | Struktur stimmt |
| Spaltenreihenfolge | 89 Spalten A…CK, Zeile 1 von `sheet6.xml` | `SPALTEN` identisch | stimmt überein |
| Ausgeblendete Spalten | **31–35** tragen `hidden="1"` und gehen trotzdem in den Export | immer alle 89 | stimmt überein |
| Beträge | `numFmtId="1"` = Formatcode `0`; **keine** eigenen `<numFmts>` in der Mappe | `str(int(...))`, kaufmännisch | stimmt überein |
| Datumsspalten | `numFmtId="49"` = `@`, also **Text** — regionsunabhängig | `%d-%m-%Y` | kein Konflikt |
| Dateiname | frei wählbar, Vorschlag `CSV file for upload <Datum>` per `InputBox` (`:126`); Behördenkonvention **nicht feststellbar** | `dac7-{jahr}-{ref}.csv` | zulässig |
| Quoting | Excel-Quoting bei `"` bleibt stehen; **kein** Semikolon-Schutz | `;`→Leerzeichen, `"`→`'` | weicht ab — **wir sind strenger** |

### CRLF gegen LF — die einzige offene Abweichung

Die Vorlage **produziert** CRLF. Dass sie es **fordert**, steht nirgends.
Der einzige harte Beleg zeigt in die andere Richtung: Unsere LF-Datei wurde
von der Empfangsstelle angenommen (Quittung `DK-20260911-BD6D10`), und
unsere eigene Prüfung normalisiert `\r\n` → `\n` (`dateipruefung.py:482`).

Bewertung: **keine Änderung.** Jeder CSV-Leser nimmt beides, und ein
Zeilenende auf Verdacht umzustellen würde die Prüfsumme jeder bestehenden
Meldung ändern, ohne einen belegten Mangel zu beheben. Sobald die Behörde
CRLF verlangt, ist es eine Zeile in `csv_dk.schreiben`.

### Zwei Mängel der Vorlage, die unsere Erzeugung nicht hat

**1. Ein eingegebenes `|` wird still zu einem Komma.** Der Ablauf tauscht
im Arbeitsblatt `,` → `|` (`:101–111`), nach dem Speichern `,` → `;`
(`:206`) und dann `|` → `,` (`:208`). Der letzte Schritt wirkt auf den
GANZEN Dateiinhalt — also auch auf ein `|`, das ein Nutzer selbst getippt
hat. Es verwandelt sich in ein Komma, unauffällig, weil `|` in Anschriften
selten ist. Wir gehen diesen Umweg nicht und haben den Mangel nicht.

**2. Ein eingegebenes Semikolon zerreißt die Zeile.** Excel quotet beim
Speichern nur Felder, die das **damalige** Trennzeichen enthalten — und das
ist zu diesem Zeitpunkt das Komma. Ein Semikolon im Feldwert wird also
nicht gequotet und landet roh in der Datei, wo es nach `:206` nicht mehr von
einem echten Trennzeichen zu unterscheiden ist. Unser `_text()` ersetzt
Semikolons deshalb (`csv_dk.py:52`) — hier sind wir bewusst strenger als
die Vorlage, und das ist in `csv_dk.py:77–79` begründet.

**3. `;FALSE;` / `;TRUE;` werden positionsabhängig ersetzt** (`:209–210`):
Die Ersetzung verlangt ein Semikolon auf beiden Seiten. In der letzten
Spalte gäbe es rechts keines — gerettet wird der Fall nur dadurch, dass die
Endemarke `;!` erst danach entfernt wird (`:211–212`). Eine fragile
Konstruktion, aber kein aktueller Fehler: In Spalte 1 und 89 steht nie ein
Wahrheitswert.

### Was nicht feststellbar ist

* Ob die Upload-Stelle eine **Namenskonvention** verlangt — im VBA keine,
  in der Vorlage nirgends erwähnt.
* Ob die Behörde **CRLF** verlangt oder LF ebenso annimmt.
* Das genaue Byte-Ergebnis von `commaReplace` auf einem echten dänischen
  Windows. Das ANSI-Verhalten der Vorgabewerte von
  `OpenTextFile`/`CreateTextFile` ist dokumentiert und im Code verifiziert
  (kein `Format`-Parameter), aber hier nicht ausgeführt — es gibt auf diesem
  Rechner kein Excel und kein WSH.

## Befund 48 — der VBA-Quelltext war nie gelesen: er ist kennwortgeschützt

Das Leseprotokoll führte `vbaProject.bin` seit dem ersten Durchlauf als
„gelesen: ja". Gelesen war `drawing2.xml` — die amtliche BESCHREIBUNG der
Makros. Der Quelltext selbst liegt komprimiert (MS-OVBA) im Binärstream und
**ist mit einem Kennwort geschützt**:

```
xl/vbaProject.bin → Stream PROJECT:  DPB="686A894A8A4A8A4A"
```

Excel zeigt den Code damit nicht an. Daran endeten sieben Durchläufe. Der
Weg daran vorbei ist `oletools`:

```python
from oletools.olevba import VBA_Parser
for _, _, name, code in VBA_Parser(pfad).extract_macros(): ...
```

Ergebnis: **17 Module mit 15 Prozeduren** — die Doku kannte „Module1,
RowTypeInput, Blattmakros".

### Vier Vorbelegungen, die nur im Quelltext stehen

`Ark3.cls`, `Worksheet_Change` — was die Vorlage beim Tippen selbst einträgt:

| Auslöser | Wirkung | Beleg |
|---|---|---|
| `ROW_TYPE = "Message"` | Spalte 7 (`MSG_SENDING_ENTITY_IN`) ← `"Angiv SE nummer her"` | `:33` |
| `ROW_TYPE = "PO_Platform_Operator"` | Spalte 30 (`ADDR_LEGAL_ADDRESS_TYPE`) ← `"OECD304"` | `:25` |
| eine der vier `ACT_*`-Zeilen | alle 4 Anzahl-Spalten ← `"0"`, alle 12 Betragsspalten ← `"0"`, alle 12 `*_CCY` ← `"DKK"` | `:57–74` |
| Eingabe in Spalte 55 | Wert wird in die 11 übrigen Quartals-`*_CCY` kopiert | `:37–51` |

Die Spaltenlisten stehen wörtlich im Code:

```vba
:18  columnIndexArray_Currency = Array(55, 57, 59, 62, 64, 66, 69, 71, 73, 76, 78, 80)
:19  columnIndexArray_Number   = Array(53, 60, 67, 74)
```

### Was das für bestehende Befunde bedeutet

**Befund 44 ist damit hart belegt.** Er stellte fest, dass `drawing2.xml`
die falsche Spalte nennt (BH statt BC), und erschloss die richtige aus der
Feldliste. Der Quelltext beweist es: `If Target.Column = 55` (`:37`), und
Spalte 55 ist `RS_ACT_CONS_Q1_CCY`. Die Beschreibung der Behörde ist an
dieser Stelle falsch, ihr Code richtig.

**`OECD304` und `DKK` sind Vorbelegungen der Vorlage**, nicht bloß
Ableitungen aus der Feldtabelle. Unsere `pruefung.py:124` erzwingt OECD304
für den Betreiber — jetzt aus dem Quelltext der Behörde belegt statt
erschlossen.

**Die Quartalswerte werden auf `0` vorbelegt, nicht leer gelassen.** Das
stützt Befund 23 („die Währung ist strukturell") aus einer zweiten Quelle:
`csv_dk._quartalswerte_setzen` schreibt alle vier Quartale unbedingt —
deckungsgleich mit dem Verhalten der Vorlage.

**Das Array hat 12 Einträge, die Doku nennt 13 `*_CCY`-Spalten — beides ist
richtig.** Die 13., `RS_ACT_DK_GRI_CCY` (Spalte 86), fehlt im Array
absichtlich: Sie gehört zum dänischen Anhang und gilt nur bei gesetztem
GRI. Die automatische DKK-Vorbelegung betrifft nur die 12 Quartalsspalten.

### Ein fünftes Makro, das die Doku nicht kennt

`FarveFormaterCeller` (`Module1.bas`) färbt Spalte A nach Objektklasse.
Reine Bedienhilfe. Die Doku sprach von vier Makros; es sind fünf, plus
`importCSV` und `ClearContentsIndberetning` hinter den Schaltflächen.

### Kein Änderungsbedarf am Code

Jede der vier Vorbelegungen ist mit unserer Erzeugung deckungsgleich. Der
Wert des Befunds ist ein anderer: **drei Regeln, die bisher als Ableitung
geführt wurden, sind jetzt aus dem Quelltext der Behörde belegt.**

### Die methodische Lehre

Ein Träger gilt erst als gelesen, wenn er **dekomprimiert** gelesen wurde.
`vbaProject.bin` ist ein Binärformat mit Kennwortschutz — dass Excel den
Code verweigert, heißt nicht, dass er unlesbar ist. Wer die Beschreibung
liest, weil der Code geschützt ist, hat die Beschreibung gelesen.

## Befund 49 — 14 Spalten füllt unsere Erzeugung nie; zwei davon sind eine Attrappe

Gemessen: `csv_dk.py` setzt 75 der 89 Spalten. Die 14 übrigen:

| Spalte | Warum leer | Urteil |
|---|---|---|
| `ADDR_FREE` | wir erheben Anschriften strukturiert (`AddressFix`) | zulässig, `0..1` |
| `ADDR_SUITE`, `ADDR_FLOOR`, `ADDR_DISTRICT`, `ADDR_POB` | erheben wir nicht | zulässig, `0..1` |
| `ADDR_COUNTRY_SUB_ENTITY` | Region; 2024 vom Verbot zur Erlaubnis geändert (Befund 38) | zulässig |
| `RS_FI_OTHER_INFO` | Freitext zum Konto | zulässig |
| `RS_BIRTH_PLACE_CITY_SUB_ENTITY`, `RS_BIRTH_FORMER_COUNTRY_NAME` | erheben wir nicht | zulässig |
| `RS_NM_GENERAL_SUFFIX` | Namenszusatz | zulässig |
| `RS_ACT_DK_VEHICLE_CAT`, `RS_ACT_DK_VEHICLE_REG_NUM` | Fahrzeugvermietung — wir vermieten Immobilien | zulässig |
| **`AD_DOC_REF_ID`**, **`AG_DOC_REF_ID`** | Kennungen der Zeilentypen `AD_Assumed_*` / `AG_Assuming_*` | **siehe unten** |

Die ersten zwölf sind `0..1`-Felder, die wir nicht erheben — eine leere
optionale Spalte ist kein Mangel.

### Die Attrappe: `PO_ASSUMED_REPORTING` ist nicht erreichbar

`AD_DOC_REF_ID` und `AG_DOC_REF_ID` gehören zum Weg **„ein anderer
Plattformbetreiber meldet für uns"**. Diesen Weg kennt unser Modell — und
kann ihn doch nicht gehen:

| Stelle | Zustand |
|---|---|
| `modell.py:268` | `meldung_uebernommen: bool = False` — das Feld existiert |
| `csv_dk.py:219` | schreibt es nach `PO_ASSUMED_REPORTING` |
| `xml_dpi.py:207` | schreibt `AssumedReporting`, wenn wahr |
| `aufbau.py` | **setzt es nirgends** — kein Treffer für `assumed`/`uebernommen` |
| `taxpayer_info` (Live-DB) | **keine Spalte dafür** — 23 Spalten geprüft |

Es gibt also keinen Weg, das Feld auf `True` zu bringen. Die Meldung
schreibt immer `FALSK`, und die Zeilentypen `AD_*`/`AG_*` entstehen nie.

**Was das praktisch heißt:** Für den Betrieb, der selbst meldet, ist alles
richtig — `FALSK` ist dann die zutreffende Aussage. Wer aber die Meldung
einem anderen Betreiber überlässt, kann das im Modul nicht erfassen; die
Meldung behauptet dann, er melde selbst. Der Fall ist damit nicht falsch
umgesetzt, sondern **gar nicht** umgesetzt — und das Feld im Modell
verdeckt es, weil es aussieht, als wäre es vorgesehen.

Zusammen mit Befund 19 (Nullmeldung `DPI403` ungeprüft) betrifft das
denselben Ablauf: Nach der Vorlage ist „anderer meldet" eine
Nullmeldung + `PO_Platform_Operator` + `AG_Assuming_Platform_Operator`
(Zeile 1200 dieser Datei).

### Bewertung

Kein Fehler in der erzeugten Datei. Ein Feld ohne Weg dorthin ist aber
schlimmer als ein fehlendes Feld: Es sieht nach einer Funktion aus, die es
nicht gibt. Entweder bekommt es eine Datenquelle, oder es gehört mit einem
Kommentar als „bewusst nicht erreichbar" markiert.

## Befund 50 — welche Zeilentypen unsere Erzeugung baut: 9 von 31

Gemessen am 11.09.2026 (`csv_dk.py`, Aufrufe von `_Zeile(...)`):

| gebaut | Typ | Rolle |
|---|---|---|
| ✓ | `Message` | Hauptzeile |
| ✓ | `PO_Platform_Operator` | Hauptzeile |
| ✓ | `RS_IND_Individual_Seller` | Hauptzeile (`:245`, bedingt) |
| ✓ | `RS_ENT_Entity_Seller` | Hauptzeile (`:247`, bedingt) |
| ✓ | `ACT_Immovable_Property` | Hauptzeile |
| ✓ | `PO_Residence_Country_Code` | Zusatzzeile |
| ✓ | `PO_Tax_Identification_Number` | Zusatzzeile |
| ✓ | `RS_Residence_Country_Code` | Zusatzzeile |
| ✓ | `RS_Tax_Identification_Number` | Zusatzzeile |

**Die 22 übrigen sind kein Mangel** — und das ist belegt, nicht
angenommen:

* **17 sind Zusatzzeilen** (`<T>` im Blatt `Typer`). `drawing1.xml`: Alle
  Zusatzzeilen sind optional; ihr einziger Zweck ist, ein
  Wiederholfeld ein zweites Mal zu tragen. Wer nur eine Ansässigkeit und
  eine Steuernummer hat, braucht keine (Befund 33).
* **3 betreffen andere Tätigkeitsarten** — `ACT_Personal_Services`,
  `ACT_Sale_Of_Goods`, `ACT_TR_Transportation_Rental` samt `ACT_TR_Detail`.
  Wir vermieten Immobilien.
* **2 betreffen den Weg „anderer meldet"** — `AD_Assumed_*` und
  `AG_Assuming_Platform_Operator`. Nicht umgesetzt, siehe Befund 49.

### Eine Zählung, die auseinandergeht — und warum das keine Lücke ist

Beim Nachzählen am 11.09.2026:

| Quelle | Zeilentypen |
|---|---|
| Blatt `Typer`, Spalte A | **29** (verifiziert: 30 Zellen, davon eine Kopfzeile) |
| Blatt `Enumerationer` | **31** |
| unsere `vorlage.ROW_TYPES` (Empfangsstelle) | **31** |

Die Doku führte das bereits als „uneinheitlich in der Vorlage, ohne Folge
für uns" und benannte die Ursache: `RS_IND_Nationality` steht in
`Enumerationer`, hat in `Kolonner` aber **keine einzige Spalte** — er wäre
nicht befüllbar. Unsere Empfangsstelle nimmt die größere Menge (31) und ist
damit eher zu großzügig als zu streng; das ist für einen Prüfer die
richtige Richtung.

Gegengeprüft: **Kein Zeilentyp, den unsere Erzeugung baut, ist der
Empfangsstelle unbekannt.** Die Kreuzprüfung ist an dieser Stelle dicht.

## Befund 51 — `ADDR_FREE` fehlt: der amtliche Ausweg für Anschriften

**Ein echter Mangel unserer Erzeugung**, kein Doku-Problem.

### Der Beleg

`ADDR_FREE` (Spalte S) ist im Blatt `Eksempel 2.1 Initiel` **fünfmal
belegt** — mit genau den Anschriften, die strukturiert nicht gehen:

```
S6  = Jesperhus Allé 2, 7000 Fredericia
S7  = Jørgens Plads 90, 9000 Århus
S8  = Budapest, Hős u. 8-10, 1087 Ungarn
S9  = Budapest, Hungária krt. 30/A, 1087 Ungarn
S10 = Budapest, Hős u. 1/a, 1087 Ungarn
```

Der Zellkommentar sagt, wann das Feld gilt — gleichlautend in **allen vier**
`threadedComment`-Dateien:

> „Obligatorisk hvis de strukturerede adressefelter ikke kan udfyldes."
> *(Pflicht, wenn die strukturierten Anschriftsfelder nicht gefüllt werden
> können.)*

### Was bei uns passiert

| Stelle | Zustand |
|---|---|
| `modell.Anschrift` | hat **kein** Feld für den Freitext (Felder: `land`, `strasse`, `hausnummer`, `plz`, `ort`, `art`) |
| `Anschrift.vollstaendig` | `bool(self.land) and bool(self.ort)` |
| `pruefung.py:57` | `bericht.fehler_melden(..., "ADDR_CITY", "Ort der Anschrift fehlt")` |
| `csv_dk._anschrift_setzen` | setzt `ADDR_FREE` nie |

Der Docstring unseres eigenen Modells beschreibt die Regel **richtig**:

> „Die Vorlage verlangt Land und entweder Ort **oder eine Freitextfassung**."

Der Code daneben prüft nur `ort`. Eine Anschrift ohne Ort scheitert damit an
`ADDR_CITY`, obwohl die Vorlage den Ausweg kennt und vorführt — und der
Betrieb kann den Mangel nicht beheben, weil es kein Feld dafür gibt.

### Warum das zusammenhängt mit Befund 4

Genau diese fünf Zellen waren der Beleg dafür, dass Kommas in Textfeldern
erhalten bleiben. Der Befund las sie als Kommabeweis und übersah, dass sie
zugleich ein Feld belegen, das wir nie füllen.

### Zu tun

`Anschrift` braucht ein Feld `freitext`, `vollstaendig` muss es
berücksichtigen, `_anschrift_setzen` es schreiben, und `pruefung.py:57` darf
`ADDR_CITY` nur verlangen, wenn kein Freitext vorliegt. Ohne
Datenerfassung dafür bleibt es allerdings leer — die Erfassung ist der
größere Teil der Arbeit.

## Befund 52 — die Positionen in `Kolonner` und `Indberetning` stimmen NICHT überein

Nachgerechnet am 11.09.2026: **27 der 89 Positionen weichen ab.**

| Position | `Indberetning` (die Datei) | `Kolonner` (die Matrix) |
|---|---|---|
| 54 | `RS_ACT_CONS_Q1` | `RS_ACT_NUM_Q2` |
| 55 | `RS_ACT_CONS_Q1_CCY` | `RS_ACT_NUM_Q3` |
| … | … | … |
| 88 | `RS_ACT_DK_VEHICLE_CAT` | `RS_ACT_DK_VEHICLE_REG_NUM` |
| 89 | `RS_ACT_DK_VEHICLE_REG_NUM` | `RS_ACT_DK_VEHICLE_CAT` |

Betroffen sind die Positionen **54–78** und **88/89**. Die Ursache ist die
Sortierung: `Indberetning` gruppiert nach Quartal (`NUM_Q1, CONS_Q1,
FEES_Q1, TAX_Q1, NUM_Q2, …`), `Kolonner` nach Kennzahl (`NUM_Q1..Q4,
CONS_Q1..Q4, …`).

### Die Vorlage tappt in ihre eigene Falle

Das VBA setzt Positionsgleichheit ausdrücklich voraus:

> „afgørende at de vises i samme rækkefølge, så kolonne 3 i arket Kolonner
> svarer til række 3"

Diese Voraussetzung ist **verletzt**. `DisplayColumnsForRowtype` löst
allerdings über den **Namen** auf (Spaltenname aus `Kolonner` Zeile 1 in
`Indberetning` Zeile 1 gesucht) — der Fehler bleibt deshalb ohne Wirkung,
aber er steht da.

### Für uns

Ohne Folge, **solange über den Namen aufgelöst wird**. Unsere
`spalten.SPALTEN` folgt `Indberetning`, also dem Blatt, das exportiert wird
— verifiziert positionsgleich mit der Kopfzeile aller fünf Beispielblätter.
Wer die Matrix je positionsbasiert auswerten will, liest im Bereich 54–78
die falschen Spalten.

## Befund 53 — drei verschiedene Betragsobergrenzen, zwei davon Tippfehler

Die Datenvalidierung auf `Indberetning` setzt `type="whole"` mit
`formula1=0` — negative Beträge sind amtlich ausgeschlossen. Die
Obergrenze ist aber **nicht** einheitlich:

| Spalte | Obergrenze | Stellen |
|---|---|---|
| die meisten Betrags- und Anzahlspalten | `99999999999999` | 14 Neunen |
| `RS_ACT_TAX_Q1` (BF) | `9999999999999990000` | 15 Neunen + 4 Nullen |
| `RS_ACT_TAX_Q2` (BM) | `99999999999999900000` | 15 Neunen + 5 Nullen |

`RS_ACT_TAX_Q2` erlaubt damit das **10⁶-fache** von `RS_ACT_TAX_Q3` — für
dasselbe Feld in einem anderen Quartal.

**Die Ursache ist belegbar Excels 15-Stellen-Grenze:** `9999999999999990000`
ist `999999999999999 × 10⁴`. Der Bearbeiter tippte 19 bzw. 20 Neunen, Excel
speicherte nur 15 signifikante Stellen und füllte mit Nullen auf. Die
gewollte Grenze ist die der Mehrheit, `99999999999999`.

### Drei Negativbeweise aus derselben Prüfung

Gegengeprüft über das ganze Blatt:

| gesucht | gefunden |
|---|---|
| `errorTitle`, `<error`, `promptTitle`, `<prompt` | **0×** — die Validierungen tragen keine eigenen Fehlertexte; Excel zeigt seinen Standard. Diese Quelle ist leer. |
| `textLength` | **0×** — die 100-Zeichen-Regel für `MSG_MESSAGE_REF_ID` steht nur im Zellkommentar, nicht als Validierung. |
| `allowBlank="0"` | **0×** — **`allowBlank` ist KEINE dritte Pflichtfeld-Quelle.** Alle Validierungen erlauben leer. Die zwei bekannten Quellen (Fettdruck, Kardinalität `1..1`) bleiben die einzigen. |

### Was unsere Prüfung davon nicht kann

`_betrag_pruefen` (`pruefung_csv.py:327`) prüft **nur** `zahl < 0`. Es gibt
keine Obergrenze. Ein Betrag mit 20 Stellen geht bei uns durch und fällt
erst bei der Behörde auf. Zusätzlich rechnet die Funktion mit `float` —
oberhalb von 2⁵³ wäre die Grenze ohnehin nicht exakt prüfbar.

## Befund 54 — die Steuernummer des Verkäufers ist ungeprüft: `1..1`, aber nicht in `_PFLICHT`

**Der schwerste Befund dieser Runde.** Bei DAC7 ist die Steuer-ID des
Verkäufers die zentrale Angabe — sie ist der Zweck der Meldung.

### Der Beleg aus der Feldtabelle

`Vejledningstekster` (= `xl/worksheets/sheet3.xml`), nachgelesen Zeile für
Zeile:

| Zeile | Feld | Kardinalität | Typ |
|---|---|---|---|
| R131 | `TIN` (Entity Seller) | **`1..1`** | Text |
| R132 | `TIN_ISSUED_BY` | **`1..1`** | CountryCode |
| R133 | `TIN_UNKNOWN` | **`1..1`** | Boolean |
| R174 | `TIN` (Individual Seller) | **`1..1`** | Text |
| R175 | `TIN_ISSUED_BY` | **`1..1`** | CountryCode |
| R176 | `TIN_UNKNOWN` | **`1..1`** | Boolean |

### Was `_PFLICHT` führt

```python
"RS_IND_Individual_Seller": (
    "RS_DOC_REF_ID", "DOC_TYPE_INDIC", "RESIDENCE", "ADDR_COUNTRY",
    "RS_NM_FIRST_NAME", "RS_NM_LAST_NAME", "RS_BIRTH_DATE",
),
"RS_ENT_Entity_Seller": (
    "RS_DOC_REF_ID", "DOC_TYPE_INDIC", "RESIDENCE", "ADDR_COUNTRY",
    "ORGANISATION_NAME",
),
```

`TIN` steht in **keiner** der beiden Listen — nur beim
`PO_Platform_Operator`. Eine eingereichte Meldung ohne Steuernummer des
Vermieters wird von unserer Empfangsstelle **angenommen**.

Für unsere eigene Erzeugung ist das ohne Wirkung: `aufbau.py` erzeugt
keinen Anbieter ohne meldefähige Steuernummer. Der Mangel greift bei jeder
FREMDEN Datei — und damit genau in der Rolle, für die die Empfangsstelle
gebaut ist.

### Und die Gegenrichtung: `RESIDENCE` ist zu streng

`_PFLICHT["PO_Platform_Operator"]` verlangt `RESIDENCE`. Die Feldtabelle
führt es dort mit **`0..*`** (R27) — beim Betreiber erfüllt `PO_NEXUS` die
Funktion. Unsere Prüfung erzeugt damit einen **Falsch-Fehler gegen eine
korrekte Datei**.

Dieselbe Klasse wie Befund 39 (`ADDR_LEGAL_ADDRESS_TYPE`), nur in die
andere Richtung: Dort war die Doku zu lax, hier ist der Code zu streng.

### Zwei weitere Pflichtfelder fehlen beim Betreiber

| Feld | Zeile | Kardinalität |
|---|---|---|
| `ORGANISATION_NAME` | R50 | `1..1` |
| `ADDR_LEGAL_ADDRESS_TYPE` | R44 | `1..*`, dazu die OECD304-Regel |

`OECD304` prüft bisher nur der Erzeuger (`pruefung.py:124`), nicht die
Empfangsstelle. Eine fremd erzeugte Datei kommt daran vorbei.

## Befund 55 — die Zahlen der Feldtabelle, nachgezählt

Alle drei Angaben der Doku bestätigt: **274 Feldzeilen, 9 Hauptobjekte,
58 Unterblöcke.** Die frühere Angabe „283 Felder" war falsch.

### Die neun Hauptobjekte samt Feldzahl

| Hauptobjekt | Felder | von uns erzeugt |
|---|---|---|
| Message | 12 | ✓ |
| Reportable Platform Operator | 29 | ✓ |
| Assuming Platform Operator | 23 | **nein** (Befund 49) |
| Assumed Platform Operator | 23 | **nein** (Befund 49) |
| Entity Seller | 32 | ✓ |
| Individual Seller | 36 | ✓ |
| Immovable Property | 51 | ✓ |
| Personal Services | 32 | nein — wir vermieten Immobilien |
| Transportation Rental | 36 | nein — dito |

`ACT_Sale_Of_Goods` führt die Feldtabelle **überhaupt nicht** (Befund 40),
obwohl `Enumerationer` und `Kolonner` ihn kennen.

### Die Kardinalitäten in Zahlen

141 × `1..1`, 36 × `0..1`, 17 × `1..*`, 77 × `0..*`, **3 × leer** (R101–103:
`TIN`/`TIN_ISSUED_BY`/`TIN_UNKNOWN` beim Assumed PO — die Tabelle lässt die
Angabe dort offen).

Vier `1..1`-Felder sind **keine CSV-Spalte**: `MSG_MESSAGE_TYPE`,
`MSG_TRANSMITTING_COUNTRY`, `MSG_RECEIVING_COUNTRY`, `MSG_TIMESTAMP`. Sie
existieren nur im XML-Objektmodell — für `_PFLICHT` zu Recht ohne Belang,
und seit dem 11.09.2026 von `xml_dpi.py` geschrieben.

### Befund 30 bestätigt — die Zahl 13 stimmt

`Kolonner` Zeile 3 führt **19** Integer-Spalten. Davon prüfen wir 5 mit
`isdigit()` (`RS_ACT_NUM_Q1–4`, `RS_ACT_RENTED_DAYS`), eine weitere separat
(`RS_ACT_DK_REAL_PROP_REG_NUM`) — und genau **13** laufen durch
`_betrag_pruefen`, das mit `float` rechnet und Nachkommastellen durchlässt:
`RS_ACT_CONS_Q1–4`, `RS_ACT_FEES_Q1–4`, `RS_ACT_TAX_Q1–4`,
`RS_ACT_DK_GRI`.

Keine Integer-Spalte ist ganz ungeprüft. Der Erzeuger schreibt korrekt
ganzzahlig (`csv_dk.py:102`) — die Lücke liegt allein in der
Empfangsprüfung.

### Stiller Datenverlust bei Mehrfachangaben

Die Tabelle führt 14 Wiederholgruppen; in der flachen CSV entsprechen dem
20 Zusatzzeilentypen. Wir erzeugen vier. Bei drei davon ist das mehr als
eine fehlende Zeile — `modell.py` kann die Mehrfachheit gar nicht abbilden:

| Gruppe | Kardinalität | unser Modell |
|---|---|---|
| `RS_ADDR` (Anschriften) | `0..*` | genau **eine** `Anschrift` |
| `RS_PRS_NM` (Namenssätze) | `0..*` | genau **ein** Namenssatz |
| `RS_FI` (Finanzkonten) | `0..*` | genau **ein** `Finanzkonto` |

Ein Verkäufer mit zwei Konten verliert das zweite **still** — es
verschwindet, ohne dass etwas fehlschlägt. Für den Regelfall eines
Ferienhausvermieters unkritisch, aber es ist ein Datenverlust ohne Meldung.

### Was ausdrücklich KEIN Befund ist

Zwei Punkte gegengeprüft, damit sie nicht als Lücke wiederkehren:

* **`MSG_MESSAGE_REF_ID` ist in allen neun Hauptobjekten `1..1`** — in der
  CSV aber nur in der `Message`-Zeile gefüllt, belegt durch alle fünf
  Beispielblätter. Unser `_EINMALIG`-Check ist korrekt (Befund 8).
* **Längen- und Zeichenregeln** stehen nur in den Prosa-Hinweisen (R6: der
  eindeutige Teil der MessageRefId ≤ 100 Zeichen, nur Buchstaben und
  Ziffern), nicht in den Typspalten. Wir prüfen sie nicht — bekannt.

## Was am 11.09.2026 dazukam — drei Module, die es beim Schreiben nicht gab

Dieses Dokument beschreibt die VORLAGE, nicht unseren Code. Es trifft aber
an vielen Stellen Aussagen über ihn („unser Serialisierer", „wir prüfen
nicht"), und die veralten. Der Stand:

| Modul | Was es tut | Bezug zu diesem Dokument |
|---|---|---|
| `csv_dk.py` | die 89-Spalten-CSV | überall gemeint, wenn „unser Serialisierer" steht |
| `xml_dpi.py` | **NEU** — DPI-XML der OECD | erledigt die Vormerkung „Formatwechsel 2026"; schreibt die vier `Message`-Felder, die der CSV fehlen |
| `umschlag.py` | **NEU** — Verschlüsselung (RSA-4096-OAEP + AES-256-GCM) | keine Vorgabe der Vorlage; sie sagt zur Übertragung nichts |
| `uebermittlung.py` | **NEU** — Übergabe an den Versanddienst | ebenso |

**Was die Vorlage dazu NICHT sagt** — und das ist der wichtige Teil: Zur
Verschlüsselung, zur Übertragungsstrecke und zum Dateinamen der Einreichung
steht in der Vorlage nichts. Das Verfahren des Umschlags ist deshalb **von
uns festgelegt**, nicht abgeleitet. Sobald Skattestyrelsen einen eigenen
öffentlichen Schlüssel oder ein Übertragungsformat nennt, gilt deren
Vorgabe und diese Stelle gehört korrigiert.

Beschrieben ist der Weg in `docs/dac7/UEBERMITTLUNGSWEG.md`.

Die zwei Serialisierer lesen **denselben** gerechneten Baum (`modell.py`).
Wo sie auseinanderlaufen, ist einer von beiden falsch — ein Test hält
fest, dass beide denselben Betrag gleich runden
(`test_xml_dpi.py::test_betraege_sind_ganzzahlig_wie_in_der_csv`).

## Befund 56 — die Empfangsstelle wies jede Datei ab, die wir selbst erzeugen (BOM)

**Gefunden beim Kreuztest gegen die amtlichen Beispielblätter, nicht von
einem Test.** Der schwerste Befund dieser Runde, weil er den kompletten
Weg blockiert hätte.

### Was passierte

Alle fünf Beispielblätter der Vorlage, als CSV exportiert und bei unserer
Empfangsstelle eingereicht:

```
=== eks1:   angenommen=False  fehler=2
   Z1  ROW_TYPE      [Spaltenkopf] Spalte fehlt
   Z1  ﻿ROW_TYPE     [Spaltenkopf] unbekannte Spalte '﻿ROW_TYPE'
```

Fünfmal derselbe Fehler. `csv_pruefen` las den UTF-8-BOM als Teil des
ersten Spaltennamens und verwarf damit den gesamten Spaltenkopf.

### Warum das zusammenhängt mit Befund 46

Genau diesen BOM setzt unsere eigene Erzeugung (`csv_dk.py:347`) — mit
gutem Grund: Ohne ihn öffnet Excel die Datei auf einer dänischen oder
deutschen Installation als eine einzige Spalte. Die beiden Seiten
widersprachen sich also: Die Erzeugung schrieb einen BOM, den die
Empfangsstelle als Fehler zurückwies.

Keiner der 80 Tests fand das, weil die Testdaten keinen BOM tragen. Die
Erzeugung wurde nie durch die eigene Empfangsstelle geschickt.

### Behoben

`csv_pruefen` verwirft den BOM (`inhalt.lstrip("﻿")`), statt ihn zu
bemängeln — er ist bei dieser Meldung erwartet, nicht geduldet.

## Befund 57 — `1..1` der Feldtabelle gilt je GRUPPE, nicht je Zeile

Dieser Befund **korrigiert Befund 54** und verhindert einen Fehler, den
seine wörtliche Umsetzung erzeugt hätte.

### Der Beleg: Spalte F der Feldtabelle

`Vejledningstekster` hat eine vierte Spalte, die bisher nie ausgewertet
wurde: **`Rowtype/Tilføjelsesobjekt (hvis mulighed for flere)`** — die
Wiederholgruppe, zu der ein Feld gehört.

| Zeile | Feld | Kardinalität | **Gruppe (Spalte F)** |
|---|---|---|---|
| R131 | `TIN` | `1..1` | `RS_TIN` |
| R132 | `TIN_ISSUED_BY` | `1..1` | `RS_TIN` |
| R133 | `TIN_UNKNOWN` | `1..1` | `RS_TIN` |
| R129 | `RESIDENCE` | `1..*` | `RS_RES` |
| R135 | `ADDR_FREE` | `0..*` | `RS_ADDR` |

Die `1..1` bedeutet damit: *innerhalb einer `RS_TIN`-Gruppe genau einmal* —
nicht *in jeder Verkäuferzeile vorhanden*. Die Gruppe selbst ist
wiederholbar (dafür gibt es die Zeilentypen `RS_Tax_Identification_Number`
und `RS_Residence_Country_Code`).

### Die Gegenprobe an den Beispielen

`TIN_UNKNOWN` in allen fünf Beispielblättern:

| Zeilentyp | `TIN_UNKNOWN` |
|---|---|
| `PO_Platform_Operator` (5×) | `0` |
| `AD_Assumed_Platform_Operator` (4×) | `0` bzw. leer |
| **`RS_IND_Individual_Seller` (4×)** | **leer** |
| **`RS_ENT_Entity_Seller` (3×)** | **leer** |

In **keiner** Verkäuferzeile ist es belegt. Als unbedingte Pflicht
geführt, hätte unsere Empfangsstelle jedes amtliche Beispiel abgewiesen.

### Umgesetzt

`TIN` und `TIN_ISSUED_BY` sind jetzt Pflicht bei beiden Verkäufertypen
(Befund 54 bestätigt), `TIN_UNKNOWN` ausdrücklich **nicht** — mit dieser
Begründung im Code.

## Befund 58 — die Quartalsspalten: Feldtabelle und Beispiele widersprechen sich

Der zweite Widerspruch der Vorlage mit sich selbst (nach Befund 52).

### Der Beleg

Die Feldtabelle führt **alle 28 Quartalsspalten** mit `1..1` (R231–R261,
selbst nachgelesen): `NUM`, `CONS`, `FEES`, `TAX` je Quartal, samt
Währungen.

Das Blatt `Eksempel 2.1 Initiel`, Zeile 7 — ein Objekt, das nur im ersten
Quartal vermietet war:

| Spalte | Wert |
|---|---|
| `RS_ACT_NUM_Q1` | `1` |
| `RS_ACT_CONS_Q1` | `10000` |
| `RS_ACT_CONS_Q1_CCY` | `DKK` |
| `RS_ACT_NUM_Q2/Q3/Q4` | **leer** |
| `RS_ACT_CONS_Q2/Q3/Q4` | **leer** |
| `RS_ACT_CONS_Q2_CCY` … `Q4_CCY` | **`DKK`** |
| alle `FEES_*`, `TAX_*` | **leer** |

Bemerkenswert ist die letzte Zeile der Tabelle: Die **Währung** steht auch
in den leeren Quartalen. Die Behörde behandelt sie als Eigenschaft der
Spalte, den Betrag als Eigenschaft des Geschäfts.

### Wie wir es aufgelöst haben

Zugunsten der Beispiele — eine Prüfung, die die Musterdatei der Behörde
mit 44 Fehlern abweist, ist falsch. Fachlich stützt es dasselbe: Ein
Quartal ohne Vermietung ist eine leere Zelle, keine Null. Eine Null
behauptete eine Vermietung zum Preis von nichts (Wurzel 4).

Geprüft wird stattdessen, was fachlich tragfähig ist:

| Regel | Begründung |
|---|---|
| mindestens **ein** Quartal belegt | eine Zeile ohne jeden Wert meldet keine Tätigkeit |
| zu **jedem belegten Betrag** seine Währung | ein Betrag ohne Währung ist in einer Meldung über 27 Mitgliedstaaten keine Zahl, sondern eine Vermutung |

### Ergebnis

Vorher: 4 von 5 Beispielblättern abgewiesen, 44 Fehler bei `Eksempel 2.1`.
Nachher: **5 von 5 angenommen, 0 Fehler** — und 17 von 17 gezielten
Negativproben weiterhin gefangen.

## Befund 59 — `RS_ACT_DK_GRI` gibt es ZWEIMAL, mit verschiedener Bedeutung

Die Feldtabelle führt die Bruttomieteinnahme an zwei Stellen:

| Zeile | Kardinalität | Gruppe | Block |
|---|---|---|---|
| R267 | `0..1` | `N/A` | Immobilien (`ACT_Immovable_Property`) |
| R352 | `0..*` | `RS_ACT_TR_DT` | Fahrzeuge (`ACT_TR_Detail`) |

Im Fahrzeugblock ist es keine Mieteinnahme, und die Beispielblätter führen
es dort in **EUR** (`Eksempel 1`, Zeilen 13/14).

Eine Regel „`RS_ACT_DK_GRI_CCY` muss `DKK` sein" gilt daher **nur bei
Immobilien**. Ohne diese Einschränkung meldete unsere Prüfung die
Beispielblätter `Eksempel 1` und `1.1` als fehlerhaft — live passiert, im
zweiten Kreuztestlauf dieser Runde.

Dieselbe Klasse wie Befund 22: eine Regel, die aus einem Feldnamen
abgeleitet wurde, ohne zu prüfen, in welchem Block er steht.

## Befund 60 — der Zeilentyp bestimmt, ob ein Datum ein Datum ist

Beim Export der Beispielblätter meldete unsere Prüfung
`MSG_REPORTING_PERIOD = '45291'` als Formatfehler. **Das war kein
Vorlagenfehler, sondern ein Fehler des Prüfwerkzeugs** — und er ist hier
festgehalten, weil er eine Klasse beschreibt.

`45291` ist die Excel-Seriennummer für den 31.12.2023. Die Zelle `K2` trägt
`s="40"`, also ein Zahlenformat mit Datumscode; der Wert im XML ist die
Zahl. Wer die Blätter roh ausliest, bekommt Zahlen statt Daten.

Für unsere Auswertung heißt das: **Jede Aussage über Datumsfelder der
Beispielblätter, die ohne Auflösung von `numFmtId` entstanden ist, ist
unbrauchbar.** Der Export für den Kreuztest rechnet sie jetzt um
(`1899-12-30 + n Tage`).

## Zu tun — Stand 11.09.2026, nach der Behebungsrunde

### Erledigt in dieser Runde

Alle mit Kreuztest gegen die fünf amtlichen Beispielblätter belegt:
**5/5 angenommen, 0 Fehler**, und **17/17 gezielte Negativproben
gefangen**. 80/80 Tests `dac7-staging` grün, 215/215 `taxpayer` grün,
`ruff` sauber, `pylint` 10.00/10 auf `pruefung_csv.py`.

| # | Was | Wo | Befund |
|---|---|---|---|
| 1 | **`ADDR_FREE`** eingeführt: Feld `freitext` in `Anschrift`, in `vollstaendig`, in `_anschrift_setzen`, im XML als `AddressFree`; `ADDR_CITY` nur noch verlangt, wenn kein Freitext vorliegt | `modell.py`, `csv_dk.py`, `xml_dpi.py`, `pruefung.py` | 51 |
| 2 | **`TIN` + `TIN_ISSUED_BY`** in `_PFLICHT` beider Verkäufertypen | `pruefung_csv.py` | 54 |
| 3 | **`RESIDENCE`** aus `_PFLICHT["PO_Platform_Operator"]` entfernt (`0..*`) | `pruefung_csv.py` | 54 |
| 4 | **`ORGANISATION_NAME`** + **`ADDR_LEGAL_ADDRESS_TYPE`** beim Betreiber ergänzt, samt OECD304-Prüfung in der Empfangsstelle | `pruefung_csv.py` | 54 |
| 5 | **Obergrenze** `≤ 99 999 999 999 999`, **`Decimal`** statt `float`, Nachkommastellen abgewiesen, `replace(",", ".")` entfernt | `pruefung_csv.py` | 53, 30 |
| 6 | **`EU_LAENDERCODES`** an `RS_PERM_ESTABLISHMENT` gebunden (hatte null Aufrufer) | `pruefung_csv.py` | 22 |
| 7 | **`RS_TIN_UNKNOWN` → `TIN_UNKNOWN`**: die Spalte gab es nie, die Prüfung war eine Attrappe | `pruefung_csv.py` | 18 |
| 8 | **Die 13 `*_CCY`-Spalten** gegen `WAEHRUNGEN` geprüft, dazu `IN_ISSUED_BY` und `RS_BIRTH_COUNTRY` | `pruefung_csv.py` | 22 |
| 9 | **GRI → Währung**: bei gesetzter Bruttomieteinnahme ist `*_CCY` Pflicht und muss `DKK` sein — **nur bei Immobilien** | `pruefung_csv.py` | 17, 59 |
| 10 | **`CORR_DOC_REF_ID` beidseitig**: Pflicht bei `OECD2`/`OECD3`, verboten bei `OECD0`/`OECD1` | `pruefung_csv.py` | 21, 35 |
| 11 | **`DPI910` → `RS_ACT_OTHER_PROP_TYPE`** als bedingte Pflicht | `pruefung_csv.py` | 31 |
| 12 | **Nullmeldung beidseitig**: `DPI403` ↔ keine Verkäuferzeile, in beide Richtungen | `pruefung_csv.py` | 19 |
| 13 | **BOM** wird verworfen statt bemängelt — die Empfangsstelle wies vorher JEDE eigene Datei ab | `pruefung_csv.py` | **56** |
| 14 | **Quartalspflichten** neu gefasst: mindestens ein Quartal belegt + Währung je belegtem Betrag, statt 28 Einzelpflichten | `pruefung_csv.py` | **58** |
| 15 | **Wahrheitswerte**: `0`/`1` und `TRUE`/`FALSE` zusätzlich zu `SANDT`/`FALSK` — die Beispiele tragen `0` | `pruefung_csv.py` | **57** |

### Noch offen

| # | Was | Wo | Schwere |
|---|---|---|---|
| 1 | **Erfassung** für `ADDR_FREE`: Das Feld existiert jetzt im Modell und wird geschrieben, aber `aufbau.py` speist es nirgends — es bleibt in der Praxis leer. Eine Oberfläche dafür fehlt. Der größere Teil der Arbeit, wie in Befund 51 vermerkt. | `aufbau.py`, Objekt-/Eigentümermaske | **hoch** |
| 2 | Zeilentyp-Matrix (Befund 33): Pflichtsätze für `AD_*`, `AG_*`, `ACT_Personal_Services`, `ACT_Sale_Of_Goods`, `ACT_TR_*`. Heute prüft die Empfangsstelle nur die fünf Typen, die wir selbst erzeugen — die übrigen 26 laufen ungeprüft durch. | `pruefung_csv.py` | mittel |
| 3 | `TIN_UNKNOWN` → `RS_BIRTH_PLACE_CITY` (Befund 31), `ADDR_LEGAL_ADDRESS_TYPE` nur bei `PO`/`AG` als Pflicht (Befund 39) | `pruefung_csv.py` | mittel |
| 4 | Mehrfache Anschriften/Namen/Konten je Anbieter — heute stiller Verlust | `modell.py` | niedrig für Ferienobjekte (Befund 55) |
| 5 | `PO_ASSUMED_REPORTING` entweder Datenquelle geben oder als bewusst nicht erreichbar markieren | `modell.py`, `aufbau.py` | niedrig (Befund 49) |
| 6 | Der Kreuztest gegen die fünf Beispielblätter läuft als Skript im Scratchpad, nicht in CI. Genau er hat die Befunde 56–59 gefunden — er gehört in den `dac7-staging`-Job. | CI | **mittel** |

### Der Weg Ende zu Ende, gemessen am 11.09.2026

Nicht behauptet, sondern gefahren — unsere eigene Erzeugung (mit
`ADDR_FREE`) durch die geänderte Empfangsstelle:

| Station | Ergebnis |
|---|---|
| Verschlüsseln | 2 204 Byte Klartext → 4 087 Byte Umschlag, 7,8 ms |
| Empfang | 4 087 Byte |
| Entschlüsselung | RSA-4096-OAEP-SHA256 + AES-256-GCM, **528 ms erster Lauf → 8,2 ms danach** (`lru_cache` auf dem PEM-Parse) |
| Formaterkennung | als CSV gelesen, UTF-8 |
| Prüfung | 4 Sätze, **angenommen**, 0 Fehler |
| Dublettensperre | Lauf 2 und 3 **abgewiesen** — anderer Umschlag, gleicher Klartext |
| Quittung | `DK-20260911-D1BAE4` |

Die Dublettensperre ist dabei der interessante Teil: Jede Verschlüsselung
erzeugt andere Bytes (frischer Nonce). Sie greift deshalb an der Prüfsumme
des KLARTEXTS — sonst ginge dieselbe Meldung beliebig oft durch, und der
Vermieter würde mehrfach veranlagt.

Ebenso gefahren: das amtliche Beispielblatt `Eksempel 2.1` unverschlüsselt
durch dieselbe Stelle — 12 Sätze, angenommen, Quittung
`DK-20260911-E17E9F`.

### Die Testlücke, die diese Runde offengelegt hat

Vier der fünf neuen Befunde (56–59) waren für alle 80 Tests unsichtbar und
wurden erst sichtbar, als die **amtlichen Beispielblätter** durch die
Empfangsstelle liefen. Der Grund ist in jedem Fall derselbe: Die Testdaten
sind nach unserer Vorstellung gebaut — sie tragen keinen BOM, füllen alle
vier Quartale und kennen keine Fahrzeugzeilen.

Das ist dieselbe Wurzel wie die Trennung von `vorlage.py` und
`spalten.py`: Eine Prüfung gegen die eigene Vorstellung findet den
gemeinsamen Denkfehler nicht. Die Beispielblätter sind der einzige Prüfstein
in diesem Modul, der nicht von uns stammt — deshalb Punkt 6 der offenen
Liste.

## Keine offenen Fragen — die Vorlage beantwortet sie alle

Hier standen drei Punkte als „noch nicht geprüft". Das war falsch: Jede
Antwort steht in der Datei, nur nicht im Blatt, sondern in
`comments*.xml` und `drawings/drawing*.xml`. Wer nur die Blattwerte liest,
hält Beantwortetes für offen.

**`RS_ACT_DK_GRI` in DKK — ja, ausnahmslos.**
Zellkommentar, wörtlich: „Bruttolejeindtægten skal oplyses i DKK". Kein
„bør", keine Ausnahme für ausländische Währung. Fakturiert ein Betrieb in
EUR (Alpenzeit Chalets), wird für dieses Feld umgerechnet — die übrigen
`*_CCY`-Spalten behalten die Rechnungswährung, nur GRI ist festgenagelt.

**Quartalszuordnung — kein Ermessen.**
Alle vier Kennzahl-Kommentare sagen dasselbe: „i hvert kvartal af
rapporteringsperioden" (`RS_ACT_CONS`), „for kvartalet" (`RS_ACT_NUM`),
„i hvert kvartal" (`RS_ACT_FEES`, `RS_ACT_TAX`). Befund 16 hat das
Gegenteil behauptet; die Kardinalität `1..1` je Quartalsspalte bestätigt
die Kommentare.

**Kommas in Textfeldern — erlaubt, mit einer Ausnahme.**
`drawing2.xml` beschreibt den Zweck des Tauschs: „Den anvendes til at
erstatte kommaer med semikolon, så det bliver en semikolonsepareret CSV
fil." Der Tausch `,`→`|`→`,` ist reine Mechanik des Trennzeichens, kein
Verbot. Namen und Anschriften dürfen Kommas tragen — und tun es seit der
Korrektur von Befund 4 auch bei uns (`csv_dk.py:50`). Der Satz „unser
`_text()` ist hier strenger als die Vorlage und verändert Daten ohne Not"
stand hier bis zum 11.09.2026 und beschrieb einen behobenen Zustand.
Die Ausnahme steht im **Zellkommentar** `comments1.xml` an
`MSG_MESSAGE_REF_ID` (nicht in `drawing2.xml`, wie hier bis zum
11.09.2026 stand): „må maksimalt være 100 tegn, og må kun indeholde tal og
bogstaver (dvs. ingen specialtegn)". Diese Regel prüfen wir nicht (weder Länge noch Zeichensatz);
ein Semikolon darin zerreißt die Zeile.
