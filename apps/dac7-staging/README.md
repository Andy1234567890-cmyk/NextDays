# DAC7-Teststufe — simulierte Empfangsstelle

Spielt Skattestyrelsen. Nimmt eine DAC7-Meldung als CSV oder XML entgegen,
prüft sie gegen die amtliche Vorlage und quittiert wie die Behörde — mit
Quittungsnummer, Prüfsumme und Befundliste je Zeile und Spalte.

## Wozu

Den echten Weg kann man nicht üben. Skattestyrelsen hat keine Testumgebung,
und eine Probeeinreichung bei der echten Behörde ist eine Steuermeldung. Ein
Betrieb erfährt also erst am 31. Januar, ob seine Datei angenommen wird.

## Die wichtigste Regel: kein gemeinsamer Code

Dieser Dienst teilt mit dem PMS **nichts** — keinen Prozess, kein Image,
keine Datenbank, keinen Import.

Würde er die Prüfregeln aus `apps/api/.../dac7/` importieren, prüfte unsere
Datei gegen unsere eigene Vorstellung von ihr: Ein Denkfehler in der
Erzeugung wäre dann auch einer in der Prüfung und bliebe unsichtbar. Genau
dieser Kurzschluss ist bei der Channex-Facility-Map schon einmal passiert —
der Unit-Test verglich die Map mit sich selbst und war grün, während bei
allen Portalen die Ausstattung fehlte.

`src/core/vorlage.py` ist deshalb eine **unabhängige zweite Lesung**
derselben xlsm-Datei. Weichen beide Fassungen voneinander ab, ist das ein
Befund und der Zweck dieses Dienstes.

**Der erste Kreuztest hat sofort einen geliefert:** Die Empfangsstelle
verlangte `MSG_SENDING_ENTITY_IN` als Pflichtfeld, die Feldtabelle
`Vejledningstekster` führt es mit Kardinalität `0..1`. Nicht unsere
Erzeugung war zu lax — die Prüfung war zu streng.

## Auf welchem Server

Auf dem **zweiten**, nicht neben dem PMS. Erst dann ist die Einreichung eine
echte Netzwerkstrecke: Zeitüberschreitungen, Verbindungsabbrüche und
TLS-Fehler treten wirklich auf, statt im selben Prozess wegoptimiert zu
werden.

## Betrieb

```bash
uv sync --extra dev
STAGING_TOKEN=<geheim> uv run uvicorn src.main:app --port 8100
```

`STAGING_TOKEN` hat **keinen Vorgabewert**: Ohne das Kennwort fährt der
Dienst nicht hoch. Ein Standardpasswort wäre schlimmer als keines, weil es
niemand ändert — und eine offene Empfangsstelle im Netz ist eine Einladung,
echte Steuerdaten irgendwohin hochzuladen.

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `STAGING_TOKEN` | — (Pflicht) | Kennwort für jede Anfrage (`X-Staging-Token`) |
| `AUFBEWAHRUNG_STUNDEN` | 24 | wie lange Quittungen leben |
| `MAX_DATEI_BYTES` | 20 MB | Obergrenze je Einreichung |
| `ERLAUBTE_HERKUENFTE` | leer | CORS, kommagetrennt; leer = kein Browser-Zugriff |

## Einreichen

```bash
curl -X POST https://<host>/v1/einreichung \
  -H 'X-Staging-Token: <TOKEN>' \
  -F 'datei=@meldung.csv'
```

Angenommen wird nur eine **fehlerfreie** Datei. Ein „teilweise angenommen"
gibt es bei der Behörde nicht.

## Fehlerfälle erzwingen

Der Gutfall lässt sich auch gegen die echte Behörde prüfen — einmal im Jahr.
Der Fehlerpfad nicht: Niemand reicht absichtlich eine kaputte Steuermeldung
ein. Dafür gibt es `X-Staging-Verhalten`:

| Wert | Wirkung |
|---|---|
| `normal` | regulär prüfen (Vorgabe) |
| `ablehnen` | unabhängig vom Inhalt zurückweisen |
| `wartung` | 503, Empfangsstelle nicht erreichbar |
| `zeitueberschreitung` | Antwort verzögern, bis der Aufrufer aufgibt |
| `doppelt` | Meldung als bereits eingereicht zurückweisen |

## Datenschutz

Eingereichte Dateien enthalten CPR-Nummern, Namen, Anschriften und
Bankverbindungen — auch in einer Teststufe, sobald jemand eine echte Meldung
hochlädt.

Der Dienst speichert den **Rohinhalt nicht**. Abgelegt werden nur
Prüfsumme, Kennzahlen und Befunde, und auch die nur befristet im
Arbeitsspeicher. Ein Neustart löscht alles. Das ist keine Schwäche, sondern
die Absicht: Eine Teststufe, deren Inhalt einen Neustart überlebt, ist ein
Datenlager.

`DELETE /v1/quittungen` verwirft alles sofort — für den Fall, dass
versehentlich eine echte Meldung eingereicht wurde.

Protokolliert werden nur Kennzahlen, nie ein Feldwert und nie ein Ausschnitt
der Datei.

## Genau ein Arbeiter

Das Protokoll lebt im Prozessspeicher. Mit mehreren uvicorn-Arbeitern hätte
jeder sein eigenes, und eine Quittung wäre nur in dem Prozess abrufbar, der
sie ausgestellt hat. Die Last rechtfertigt keinen zweiten: Ein Betrieb reicht
seine Meldung einmal im Jahr ein.

## Grenzen dieser Nachbildung

* **Kein amtliches XSD.** Die XML-Prüfung prüft Struktur und Werte, ersetzt
  aber keine Schema-Validierung. Sobald das XSD vorliegt, gehört eine echte
  danebengestellt — nicht an ihre Stelle.
* **Keine MitID-Anmeldung**, nur ein gemeinsames Geheimnis.
* **Eine Annahme hier ist keine Zusage der Behörde.**

## Tests

```bash
STAGING_TOKEN=test-token-nicht-echt uv run pytest src/tests -q
```

Jeder Test baut genau **einen** Fehler ein und erwartet, dass die
Gegenstelle ihn findet. Ein Prüfer, der alles annimmt, ist schlimmer als
keiner: Er erzeugt die Zuversicht, die Datei sei in Ordnung.
