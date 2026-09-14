# Der Übermittlungsweg — von myNextDays zur Empfangsstelle

Stand: 11.09.2026 · Meldejahr 2025 (CSV) und 2026 (DPI-XML) · Dänemark

Diese Beschreibung ist für Skattestyrelsen geschrieben: Sie zeigt, **wie
die Daten eines Betriebs bei der Behörde ankommen** — verschlüsselt,
wieder lesbar, und mit einem Protokoll, das jede Station benennt.

## Der Weg in einem Bild

```
 Betrieb (PMS)                Versanddienst            Empfangsstelle
 apps/api                     apps/dac7-API            apps/dac7-staging
 ─────────────                ─────────────            ─────────────────
 Buchungen, Objekte,
 Eigentümer
      │
      │ rechnen             ein Meldemodell, zwei Formate
      ▼
 Meldung (Baum)
      │
      ├──► csv_dk.py  ──► CSV  (89 Spalten, Meldejahr 2025)
      └──► xml_dpi.py ──► DPI-XML (OECD, ab Meldejahr 2026)
      │
      │ POST /v1/einreichen
      ▼
                         umschlag.py
                         AES-256-GCM + RSA-4096-OAEP
                              │
                              │ POST /v1/einreichung
                              │ (über das offene Netz, TLS)
                              ▼
                                                  umschlag.py öffnen
                                                  prüfen gegen die Vorlage
                                                  quittieren
                                                       │
      ◄────────────────────────────────────────────────┘
      Quittung: Nummer, Prüfsumme, Befunde, Weg
```

## Warum drei Dienste und nicht einer

| Dienst | Aufgabe | Warum getrennt |
|---|---|---|
| `apps/api` | rechnet die Meldung | kennt die Betriebsdaten, spricht **nie** mit der Behörde |
| `apps/dac7-API` | reicht sie ein | die **einzige** Stelle, die nach außen sendet — ein Ort, an dem nachvollziehbar ist, was das Haus an eine Behörde geschickt hat |
| `apps/dac7-staging` | spielt die Behörde | prüft mit einer **unabhängigen zweiten Lesung** derselben amtlichen Vorlage |

Die Trennung der letzten beiden ist der Kern: Würde die Empfangsstelle
die Prüfregeln aus `apps/api` importieren, prüfte unsere Datei gegen
unsere eigene Vorstellung von ihr. Ein Denkfehler in der Erzeugung wäre
dann auch einer in der Prüfung und bliebe unsichtbar.

**Der Kreuztest hat bereits Befunde geliefert** — dafür ist er da:

* Die Empfangsstelle verlangte `MSG_SENDING_ENTITY_IN` als Pflichtfeld,
  die Feldtabelle `Vejledningstekster` führt es mit Kardinalität `0..1`.
  Nicht unsere Erzeugung war zu lax, die Prüfung war zu streng.
* Beim ersten XML-Durchlauf fiel `PO_NEXUS=OECD304` auf — ein
  Anschriftstyp im Nexus-Feld. Gültig sind `RPONEX1`–`RPONEX5`.

Die Empfangsstelle läuft auf einem **zweiten Server**
(`dac7-test.mynextdays.dk`, 62.238.4.193), nicht neben dem PMS. Erst
dann ist die Einreichung eine echte Netzwerkstrecke: Zeitüberschreitungen,
Verbindungsabbrüche und TLS-Fehler treten wirklich auf.

## Die zwei Formate

Beide entstehen aus **demselben gerechneten Baum** (`modell.py`), keiner
ist eine Umwandlung des anderen. Die 89 CSV-Spalten sind die
flachgeklopfte Fassung dieser Hierarchie, das DPI-XML ihre verschachtelte.

| | CSV (2025) | DPI-XML (ab 2026) |
|---|---|---|
| Struktur | 89 Spalten, `ROW_TYPE` je Zeile | Baum `DPI_OECD` |
| Zugehörigkeit | über `RS_DOC_REF_ID` + Zeilenreihenfolge | über die Verschachtelung |
| Datum | `31-12-2025` | `2025-12-31` (ISO 8601) |
| Währung | eigene Spalte je Quartal | Attribut `currCode` am Betrag |
| Mehrfachangaben | Zusatzzeilen (`RS_Residence_Country_Code`) | mehrere gleichnamige Elemente |
| Nationale Felder | `RS_ACT_DK_*` | eigener Knoten `DKSupplement` |

Die Zusatzzeilen der CSV haben im XML **keine Entsprechung** — sie sind
ein Artefakt des flachen Formats, keine fachliche Angabe.

Beide Serialisierer runden gleich (kaufmännisch, ganzzahlig). Liefen sie
auseinander, widersprächen sich CSV und XML derselben Meldung, und
niemand könnte sagen, welche die richtige ist. Ein Test hält das fest.

## Die Verschlüsselung

Skattestyrelsen hat uns bisher keinen öffentlichen Schlüssel genannt. Bis
dahin gilt das hier festgelegte Verfahren; es ist austauschbar, sobald
der echte Schlüssel vorliegt.

**Hybrid**, weil keins der beiden Verfahren allein genügt:

```
Meldedatei    --AES-256-GCM-->   Geheimtext        (beliebig groß)
AES-Schlüssel --RSA-4096-OAEP--> verpackter Schlüssel
```

RSA kann nur wenige hundert Byte verschlüsseln, eine Meldedatei ist
megabytegroß. AES allein bräuchte einen vorher geteilten Schlüssel —
genau das Problem, das hier gelöst werden soll.

* **GCM, nicht CBC.** GCM erkennt Veränderungen. Ein gekippter
  Geheimtext fällt beim Entschlüsseln auf, statt zu plausiblem Müll zu
  werden. Bei einer Steuermeldung ist eine unbemerkte Verfälschung
  schlimmer als ein Fehlschlag.
* **OAEP, nicht PKCS#1 v1.5.** Letzteres ist gegen
  Bleichenbacher-Angriffe anfällig.
* **Der Kopf geht authentifiziert mit.** Wer ihn nachträglich ändert —
  etwa den Dateinamen —, macht den Geheimtext unlesbar.
* **Die Prüfsumme ist die des Klartexts.** Damit lässt sich nach dem
  Entschlüsseln belegen, dass genau die Datei ankam, die losgeschickt
  wurde. Über den Geheimtext ginge das nicht: Jede Verschlüsselung
  derselben Datei sieht anders aus (frischer Nonce).

Der Kopf bleibt **lesbar** — die Gegenstelle muss wissen, womit sie
öffnen soll, bevor sie öffnen kann. Er nennt Verfahren, Zeitpunkt,
Schlüsselkennung und Prüfsumme, **nie einen Feldwert der Meldung**.

Den öffentlichen Schlüssel holt der Absender bei der Gegenstelle selbst:
`GET /v1/schluessel`. Von Hand kopiert veraltet er, und bei einem
Schlüsselwechsel verschlüsselt der Absender weiter gegen den alten.

### Was geprüft ist

| Angriff | Ergebnis |
|---|---|
| Umschlag mit fremdem Schlüssel | abgewiesen, Grund benannt |
| ein Byte im Geheimtext gekippt | abgewiesen (AES-GCM) |
| Kopf manipuliert | abgewiesen |
| zweimal dieselbe Datei | anderer Geheimtext, Dublette trotzdem erkannt |
| 2048-Bit-Schlüssel angeboten | abgewiesen, kein Ausweichen auf schwächer |
| Schlüssel unbrauchbar | **nicht gesendet**, kein Ausweichen auf Klartext |
| Verschlüsselung verlangt, Schlüssel fehlt | **nicht gesendet** (fail-closed) |

Die Dublettensperre greift am **Klartext**, nicht an den empfangenen
Bytes: Zwei Umschläge desselben Inhalts haben verschiedene Bytes, dieselbe
Meldung ginge sonst beliebig oft durch. *„Indtægten skal kun indberettes
een gang og ikke dobbelt."*

## Das Schrittprotokoll

Jede Einreichung trägt ihre Stationen mit — sichtbar unter
`/meldung/<quittungsnummer>` und in der Quittung (`schritte`):

| # | Station | Nachweis |
|---|---|---|
| 1 | Empfang | Bytes, SHA-256 der empfangenen Daten |
| 2 | Entschlüsselung | Verfahren, Schlüsselkennung, Prüfsumme bestätigt |
| 3 | Formaterkennung | CSV oder XML, Zeichenzahl |
| 4 | Prüfung | Zahl der Sätze je Zeilentyp |
| 5 | Dublettenprüfung | SHA-256 des Klartexts |
| 6 | Quittung | angenommen / zurückgewiesen |

Jede Station trägt ihre **eigene Dauer**. Damit ist sichtbar, was die
Verschlüsselung kostet, statt es behaupten zu müssen.

Gemessen an einer echten Meldung (21 Sätze, 8 Verkäufer, 11 Objekte):

| Station | CSV | XML |
|---|---|---|
| Entschlüsselung | 6,3 ms | 6,3 ms |
| Prüfung | 2,6 ms | 2,2 ms |
| übrige | < 0,1 ms | < 0,1 ms |

Der **erste** Aufruf im Prozess kostet 400 ms mehr. Das ist nicht die
Entschlüsselung, sondern das Einlesen des PEM-Schlüssels: gemessen
396 ms gegen 6,9 ms für die RSA-Operation selbst. Der Schlüssel ist über
die Prozesslaufzeit konstant und wird deshalb zwischengespeichert — ohne
das steckten 98 % der Zeit im wiederholten Parsen desselben Schlüssels,
und das Protokoll wies eine „Entschlüsselung" aus, die keine war.

Der Nachweis ist bewusst ein **Beleg**, kein Inhalt: eine Prüfsumme, eine
Schlüsselkennung, eine Zahl. Nie ein Feldwert der Meldung.

## Der Vorführbetrieb

`Nordstrand Feriehusudlejning` (Ringkøbing, CVR 39128454) — ein
dänischer Ferienhausvermieter mit elf Objekten in Westjütland.

* 6 Verkäufer als Privatperson (CPR) und 2 als Gesellschaft (CVR) —
  beide Zeilentypen der Vorlage kommen vor
* elf Objekte mit BFE-Nummer und Matrikelnummer
* 1365 einbezogene Buchungen des Meldejahres 2025, 645.989 DKK
* `tenants.ist_vorfuehrbetrieb` (Migration 0630) hebt für **ihn allein**
  die Vorführ-Riegel auf

Die Riegel selbst bleiben: `is_demo` schützt weiterhin den öffentlichen
Live-Vorschau-Zugang (`Nordlys`) gegen Schreibzugriffe — dort die Sperre
zu lösen hieße, die Schaufenster-Demo für jeden Besucher schreibbar zu
machen. Unberührt bleiben in jedem Fall RLS, der Mandanten-Scope jeder
Abfrage und die Capability-Prüfung der Endpunkte: Der Vorführbetrieb kann
genau das, was sein eigener Admin könnte.

### Ein Befund aus den echten Daten

Beim ersten Lauf gegen die Live-Datenbank fielen **alle 1365 Buchungen
heraus**: „kein Zahlungs- oder Buchungszeitpunkt — Quartal nicht
bestimmbar". Die Meldung wäre leer gewesen, obwohl der Betrieb ein ganzes
Jahr vermietet hatte.

Der Rechner verhält sich dabei **richtig**: Er fällt nicht auf
`created_at` zurück. Das ist unsere Verarbeitungszeit, nicht der
Zeitpunkt der fremden Handlung — ein daraus geratenes Quartal wäre eine
Falschaussage in einer Steuermeldung, die niemand als Fehler erkennt.

Bei den Demo-Daten war `booked_at` beim Erzeugen nie gesetzt worden; der
Wert wurde nachgetragen. Bei einem **echten** Betrieb wäre das falsch:
Dort fehlt der Wert, weil das Portal ihn nicht geliefert hat, und dann
ist der Ausschluss samt Prüfbericht die richtige Antwort.

## Was diese Stufe nicht leistet

* **Kein amtliches XSD.** Die XML-Prüfung prüft Struktur und Werte,
  ersetzt aber keine Schema-Validierung. Sobald das XSD vorliegt, gehört
  eine echte danebengestellt — nicht an ihre Stelle.
* **Keine MitID-Anmeldung**, nur ein gemeinsames Geheimnis.
* **Eine Annahme hier ist keine Zusage der Behörde.** Der Lauf wird
  deshalb auch **nicht** automatisch als „abgegeben" gekennzeichnet:
  Das ist die Aussage des Betriebs, dass die Meldung bei der Behörde
  liegt — und in der Teststufe liegt sie bei uns.
* **Der unklare Ausgang ist ein eigener Zustand.** Eine
  Zeitüberschreitung heißt *nicht*, dass nichts ankam. `angenommen:
  null` wird bis in die Oberfläche durchgereicht, statt zu „nicht
  gesendet" verkürzt zu werden — sonst erzeugt der nächste Klick die
  Doppelmeldung.

## Einstellungen

| Dienst | Variable | Bedeutung |
|---|---|---|
| `apps/api` | `DAC7_VERSAND_URL` | Adresse des Versanddienstes; leer = keine Übermittlung aus der Oberfläche |
| | `DAC7_VERSAND_TOKEN` | Kennwort dorthin |
| `apps/dac7-API` | `AMT_URL` | die Gegenstelle (Pflicht, kein Vorgabewert) |
| | `AMT_PUBKEY` | öffentlicher Schlüssel der Gegenstelle; leer = Klartext |
| | `VERSCHLUESSELUNG_PFLICHT` | `true` = ohne Schlüssel **nicht** senden |
| | `AMT_IST_TESTSTUFE` | nur die Kennzeichnung; die Adresse entscheidet |
| `apps/dac7-staging` | `EMPFAENGER_PRIVKEY` | privater Schlüssel; leer = nimmt nur Klartext |
| | `EMPFAENGER_PUBKEY` | wird unter `/v1/schluessel` veröffentlicht |
| | `STAGING_TOKEN` | Kennwort (Pflicht, fail-closed) |

Kein Vorgabewert zeigt auf die echte Behörde: Eine falsch konfigurierte
Umgebung, die still an die echte Behörde sendet, ist der teuerste denkbare
Fehler dieses Bereichs.

Die privaten Schlüssel gehören in Coolify als Secret, **nie ins Repo**.

## Schnittstellen

**Betrieb (`apps/api`, `/api/v1/taxpayer/dac7`)**

| | |
|---|---|
| `POST /erzeugen` | Meldung rechnen (`probelauf: true` speichert nichts) |
| `GET /laeufe/{id}/datei?format=csv\|xml` | die Datei herunterladen |
| `POST /laeufe/{id}/uebermitteln` | an die Empfangsstelle senden |
| `GET /uebermittlung` | ob die Übermittlung eingerichtet ist |
| `POST /laeufe/{id}/abgeben` | Aussage des Betriebs, nicht unsere |

**Empfangsstelle (`apps/dac7-staging`)**

| | |
|---|---|
| `POST /v1/einreichung` | Meldung einreichen (CSV, XML, Umschlag) |
| `GET /v1/schluessel` | öffentlicher Schlüssel — ohne Anmeldung |
| `GET /v1/quittungen` | Empfangsprotokoll |
| `DELETE /v1/quittungen` | alles sofort verwerfen |
| `GET /meldung/<nummer>` | der Weg, der Umschlagkopf, die Sätze |
| `GET /health` | Annahmequote und Laufzeiten, ohne Anmeldung |

Der Umschlag wird am **Inhalt** erkannt, nicht an der Dateiendung: Ein
Absender soll nicht ankündigen müssen, was er schickt.

## Datenschutz

Eingereichte Dateien tragen CPR-Nummern, Namen, Anschriften und
Kontokennungen. Sie liegen **ausschließlich im Arbeitsspeicher** der
Empfangsstelle und nur für die Aufbewahrungsdauer (Vorgabe 24 Stunden):
Ein Neustart löscht alles, `DELETE /v1/quittungen` ebenso. Nichts wird
auf Platte geschrieben, nichts in ein Log — protokolliert werden nur
Kennzahlen.

Ein Umschlag, der sich nicht öffnen lässt, wird **ohne Rohinhalt**
abgelegt: Er ist Geheimtext, ihn anzuzeigen hilft niemandem, und bei
einem falschen Schlüssel könnte er echte Daten tragen.
