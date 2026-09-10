"""Die Versand-API von myNextDays — der einzige Weg zur Steuerbehoerde.

WAS DIESER DIENST IST
=====================
Die eine Stelle, die mit der Behoerde spricht. Das PMS erzeugt die
Meldung und uebergibt sie hier; dieser Dienst reicht sie ein und gibt die
Quittung zurueck.

WARUM EIGENSTAENDIG
===================
Eine Steuermeldung geht nach draussen und ist nicht zurueckholbar. Was
diesen Weg geht, soll an EINER Stelle sichtbar sein — eine Datei, ein
Empfaenger, ein Protokoll. Laege der Versand in der PMS-API, waere er ein
Endpunkt unter zweihundert anderen, und jede Aenderung am Dashboard
koennte ihn mitreissen.

Dazu die Zugangsdaten: Dieser Dienst haelt sie. Je weniger Code daneben
liegt, desto kleiner die Angriffsflaeche.

WAS ER NICHT TUT
================
Nicht rechnen, nicht pruefen, keine Datenbank. Er bekommt eine FERTIGE
Datei. Das Erzeugen bleibt im PMS, wo die Daten liegen; das Pruefen tut
die Behoerde. Eine dritte Meinung dazwischen waere eine Fehlerquelle.

DIE DREI DIENSTE UND IHRE ROLLEN
================================
    apps/api            PMS — erzeugt die Meldung aus den Buchungen
    apps/dac7-versand   DIESER — reicht sie bei der Behoerde ein
    apps/dac7-staging   die simulierte Behoerde (zweiter Server)

Keiner importiert vom anderen.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .core.config import get_settings
from .core.logging import configure_logging, get_logger
from .v1 import router as v1_router

log = get_logger("dac7versand")

BESCHREIBUNG = """
Reicht eine fertige DAC7-Meldung bei der Steuerbehoerde ein.

```
curl -X POST https://<host>/v1/einreichen \\
  -H 'X-Versand-Token: <TOKEN>' \\
  -F 'datei=@meldung.csv'
```

### Die Antwort ist dreiwertig

| `angenommen` | Bedeutung |
|---|---|
| `true` | Die Behoerde hat die Meldung angenommen. |
| `false` | Sie hat sie abgewiesen — die Datei gilt als nicht eingereicht. |
| `null` | **Unbekannt.** Die Antwort kam nicht an; die Datei kann
           die Behoerde trotzdem erreicht haben. |

Bei `null` steht `wiederholbar` auf `false`: Erst klaeren, ob die erste
Datei ankam — sonst entsteht eine Doppelmeldung, und der Vermieter wird
doppelt veranlagt.

Jede Antwort nennt `ziel` und `ist_teststufe`. Eine Meldung, von der
niemand weiss, ob sie an die echte Behoerde ging, ist wertlos.
"""


def create_app() -> FastAPI:
    e = get_settings()
    configure_logging(als_json=os.getenv("ENV", "").lower() == "production")

    app = FastAPI(
        title="myNextDays — DAC7-Versand",
        description=BESCHREIBUNG,
        version="1.0.0",
    )
    app.include_router(v1_router)

    @app.get("/health", include_in_schema=False)
    def health() -> JSONResponse:
        # Das ZIEL gehoert in die Statusauskunft: Beim Betrieb muss ohne
        # Umweg erkennbar sein, ob dieser Dienst gerade auf die Teststufe
        # oder auf die echte Behoerde zeigt.
        return JSONResponse(
            {
                "status": "ok",
                "dienst": "dac7-versand",
                "ziel": e.amt_url,
                "teststufe": e.amt_ist_teststufe,
            }
        )

    log.info("dac7_versand_gestartet", ziel=e.amt_url, teststufe=e.amt_ist_teststufe)
    return app


app = create_app()
