# DAC7-Versand-API

Der **einzige** Dienst von myNextDays, der mit der Steuerbehörde spricht.

## Die drei Dienste

| Dienst | Rolle |
|---|---|
| `apps/api` | PMS — erzeugt die Meldung aus den Buchungen |
| **`apps/dac7-API`** | reicht sie bei der Behörde ein |
| `apps/dac7-staging` | die simulierte Behörde (zweiter Server) |

Keiner importiert vom anderen.

## Warum eigenständig

Eine Steuermeldung geht nach draußen und ist nicht zurückholbar. Was
diesen Weg geht, soll an einer Stelle sichtbar sein — eine Datei, ein
Empfänger, ein Protokoll. Läge der Versand in der PMS-API, wäre er ein
Endpunkt unter zweihundert anderen, und jede Änderung am Dashboard
könnte ihn mitreißen.

Dazu die Zugangsdaten: Dieser Dienst hält sie.

## Was er nicht tut

Nicht rechnen, nicht prüfen, keine Datenbank. Er bekommt eine **fertige**
Datei. Das Erzeugen bleibt im PMS, wo die Daten liegen; das Prüfen tut
die Behörde. Eine dritte Meinung dazwischen wäre eine Fehlerquelle.

## Einreichen

```bash
curl -X POST https://<host>/v1/einreichen \
  -H 'X-Versand-Token: <TOKEN>' \
  -F 'datei=@meldung.csv'
```

## Die Antwort ist dreiwertig

| `angenommen` | Bedeutung | `wiederholbar` |
|---|---|---|
| `true` | angenommen | `false` — ein zweiter Versand wäre eine Doppelmeldung |
| `false` | abgewiesen, gilt als nicht eingereicht | `true` |
| `null` | **unbekannt** — die Antwort kam nicht an | `false` |

Der dritte Fall ist der gefährliche. Eine Zeitüberschreitung heißt
**nicht**, dass nichts ankam: Die Datei kann die Behörde erreicht haben,
während die Antwort verlorenging. Wer daraufhin erneut sendet, erzeugt
eine Doppelmeldung — und der Vermieter wird doppelt veranlagt.

Jede Antwort nennt `ziel` und `ist_teststufe`. Eine Meldung, von der
niemand weiß, ob sie an die echte Behörde ging, ist wertlos.

## Konfiguration

| Variable | Vorgabe | Bedeutung |
|---|---|---|
| `VERSAND_TOKEN` | — (Pflicht) | wer hier einreichen darf |
| `AMT_URL` | — (Pflicht) | die Gegenstelle |
| `AMT_BASIC_USER` / `_PASSWORD` | leer | HTTP-Basic der Gegenstelle |
| `AMT_TOKEN` | leer | Token der Gegenstelle |
| `AMT_IST_TESTSTUFE` | `true` | nur Kennzeichnung; die Adresse entscheidet |
| `ZEITLIMIT_S` | 60 | Wartezeit auf die Behörde |

`VERSAND_TOKEN` und `AMT_URL` haben **keinen Vorgabewert**: Ohne sie
fährt der Dienst nicht hoch. Besonders `AMT_URL` — eine falsch
konfigurierte Umgebung, die still an die **echte** Behörde sendet, ist
der teuerste denkbare Fehler dieses Dienstes.

## Tests

```bash
VERSAND_TOKEN=test-versand-token AMT_URL=https://amt.beispiel.test \
  uv run pytest src/tests -q
```

Der Schwerpunkt liegt auf dem unklaren Ausgang: Was passiert bei
Zeitüberschreitung, bei unlesbarer Antwort, bei Netzfehler — und ob der
Dienst dann ehrlich `null` sagt statt `false`.
