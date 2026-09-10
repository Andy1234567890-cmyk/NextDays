"""Die simulierte Empfangsstelle fuer DAC7-Meldungen — eigener Dienst.

WOZU
====
Skattestyrelsen nimmt DAC7-Meldungen ueber TastSelv Erhverv entgegen. Diesen
Weg kann man nicht ueben: Es gibt keine Testumgebung, und eine
Probeeinreichung bei der echten Behoerde ist eine Steuermeldung. Ein
Betrieb erfaehrt also erst am 31. Januar, ob seine Datei angenommen wird.

Dieser Dienst spielt die Gegenstelle. Er nimmt CSV und XML entgegen, prueft
sie gegen die amtliche Vorlage und quittiert wie die Behoerde — mit
Quittungsnummer, Pruefsumme und Befundliste je Zeile und Spalte.

WARUM EIN EIGENER DIENST UND EIN EIGENER SERVER
================================================
Er darf mit dem PMS NICHTS teilen: keinen Prozess, kein Image, keine
Datenbank, keinen Import. Wuerde er die Pruefregeln aus `apps/api`
importieren, pruefte unsere Datei gegen unsere eigene Vorstellung von ihr —
ein Denkfehler in der Erzeugung waere dann auch einer in der Pruefung und
bliebe unsichtbar. Genau dieser Kurzschluss ist bei der Channex-Facility-Map
schon einmal passiert: Der Unit-Test verglich die Map mit sich selbst und
war gruen, waehrend bei allen Portalen die Ausstattung fehlte.

`core/vorlage.py` ist deshalb eine UNABHAENGIGE zweite Lesung derselben
xlsm-Datei. Weichen die beiden Fassungen voneinander ab, ist das ein Befund
und der Zweck dieses Dienstes.

Auf einem zweiten Server betrieben, ist die Einreichung zusaetzlich eine
echte Netzwerkstrecke: Zeitueberschreitungen, Verbindungsabbrueche und
TLS-Fehler treten dann wirklich auf, statt im selben Prozess wegoptimiert
zu werden.

DATENSCHUTZ
===========
Eingereichte Dateien enthalten CPR-Nummern, Namen, Anschriften und
Bankverbindungen. Dieser Dienst speichert den Rohinhalt NICHT — nur
Pruefsumme, Kennzahlen und Befunde, und auch die nur befristet im
Arbeitsspeicher. Ein Neustart loescht alles.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.config import get_settings
from .core.logging import configure_logging, get_logger
from .v1 import router as v1_router

log = get_logger("dac7staging")

BESCHREIBUNG = """
Simulierte Empfangsstelle fuer DAC7-Meldungen.

Sie verhaelt sich wie TastSelv Erhverv: Datei einreichen, Pruefung abwarten,
Quittung erhalten. Angenommen wird nur eine **fehlerfreie** Datei — ein
„teilweise angenommen" gibt es bei der Behoerde nicht.

### Einreichen

```
curl -X POST https://<host>/v1/einreichung \\
  -H 'X-Staging-Token: <TOKEN>' \\
  -F 'datei=@meldung.csv'
```

### Fehlerfaelle erzwingen

Der Kopf `X-Staging-Verhalten` bringt die Gegenstelle gezielt zum Ablehnen —
der Gutfall laesst sich auch gegen die echte Behoerde pruefen, der
Fehlerpfad nicht:

| Wert | Wirkung |
|---|---|
| `normal` | regulaer pruefen (Vorgabe) |
| `ablehnen` | unabhaengig vom Inhalt zurueckweisen |
| `wartung` | 503, Empfangsstelle nicht erreichbar |
| `zeitueberschreitung` | Antwort verzoegern, bis der Aufrufer aufgibt |
| `doppelt` | Meldung als bereits eingereicht zurueckweisen |

### Grenzen dieser Nachbildung

* Kein amtliches XSD — die XML-Pruefung prueft Struktur und Werte, ersetzt
  aber keine Schema-Validierung.
* Keine MitID-Anmeldung, nur ein gemeinsames Geheimnis.
* Eine Annahme hier ist **keine** Zusage der Behoerde.
"""


def create_app() -> FastAPI:
    einstellungen = get_settings()
    configure_logging(als_json=os.getenv("ENV", "").lower() == "production")

    app = FastAPI(
        title="DAC7 Teststufe — simulierte Empfangsstelle",
        description=BESCHREIBUNG,
        version="1.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    herkuenfte = einstellungen.herkunft_liste()
    if herkuenfte:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=herkuenfte,
            allow_methods=["GET", "POST", "DELETE"],
            allow_headers=["X-Staging-Token", "X-Staging-Verhalten", "Content-Type"],
        )

    app.include_router(v1_router)

    @app.get("/health", include_in_schema=False)
    def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "dienst": "dac7-staging"})

    log.info("dac7_staging_gestartet", herkuenfte=len(herkuenfte))
    return app


app = create_app()
