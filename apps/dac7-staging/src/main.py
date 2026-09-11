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
Bankverbindungen. Der Rohinhalt wird AUFBEWAHRT — er muss es, sonst kann
die Stelle nicht zeigen, was uebermittelt wurde, und genau dafuer gibt es
sie. Aber ausschliesslich im Arbeitsspeicher, befristet auf die
Aufbewahrungsdauer: Ein Neustart loescht alles, `DELETE /v1/quittungen`
ebenso. Nichts geht auf Platte, nichts in ein Log.

Hier stand bis zum 11.09.2026 "speichert den Rohinhalt NICHT". Das war
richtig, solange die Seite nur Pruefsumme und Zeilenzahl zeigte — und
damit unbrauchbar: Niemand konnte pruefen, WAS in der Meldung steht.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response

from .core.config import get_settings
from .core.logging import configure_logging, get_logger
from .oberflaeche import meldungsseite, startseite
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

`doppelt` erzwingt die Zurueckweisung; sie passiert aber ohnehin von
selbst, sobald dieselbe Datei ein zweites Mal ankommt (siehe unten).

### Einmaligkeit

Dieselbe Datei wird kein zweites Mal angenommen — erkannt an der
SHA-256-Summe der Bytes. "Indtaegten skal kun indberettes een gang og
ikke dobbelt": Ein Wiederholungsversuch nach einem Zeitlimit darf keine
zweite Meldung erzeugen. Gesperrt wird nur gegen ANGENOMMENES; eine
korrigierte Datei geht durch, und wer unveraendert erneut sendet,
bekommt weiterhin seinen eigenen Fehler.

### Was eingereicht wurde, ansehen

Die Quittung traegt die uebermittelten Saetze mit (`saetze`), je Satz
die belegten Spalten. Im Browser zeigt `/meldung/<quittungsnummer>`
dieselbe Meldung als Raster wie die CSV, darunter die Datei im Original;
`/meldung/<quittungsnummer>/datei` liefert sie unveraendert zum
Herunterladen.

### Zustand und Guete

`/health` gibt ohne Anmeldung Annahmequote und Laufzeiten zurueck
(Mittel, langsamstes Fuenftel, schlechtester Wert) — keine Inhalte, keine
Quittungsnummern.

### Aufbewahrung

Einreichungen liegen NUR im Arbeitsspeicher und nur befristet
(Vorgabe 24 Stunden). Ein Neustart loescht sie, `DELETE /v1/quittungen`
ebenso. Nichts wird auf Platte geschrieben, nichts in ein Log.

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

    # --- Oberflaeche -------------------------------------------------------
    # Die Behoerde hat eine (TastSelv Erhverv). Eine Teststufe, die nur per
    # curl bedienbar ist, uebt den Weg nicht, den ein Betrieb spaeter geht.
    # `include_in_schema=False`: Die Seiten gehoeren nicht in die
    # API-Referenz, sie SIND die Bedienung.

    @app.get("/", include_in_schema=False)
    def seite() -> HTMLResponse:
        from .core.protokoll import kennzahlen
        from .v1.einreichung import PROTOKOLL

        eintraege = PROTOKOLL.liste()
        return HTMLResponse(
            startseite(eintraege, kennzahlen(eintraege), get_settings())
        )

    @app.get("/meldung/{nummer}", include_in_schema=False)
    def meldung(nummer: str) -> HTMLResponse:
        """Was in EINER eingegangenen Meldung steht — Satz fuer Satz.

        Der Posteingang nennt nur Pruefsumme und Zeilenzahl. Damit laesst
        sich nicht pruefen, WAS uebermittelt wurde — und genau dafuer gibt
        es diese Stelle: sehen, was in der Meldung steht, bevor sie zur
        Behoerde geht.
        """
        from .v1.einreichung import PROTOKOLL

        eintrag = PROTOKOLL.holen(nummer)
        if eintrag is None:
            return HTMLResponse(
                startseite(PROTOKOLL.liste()).replace(
                    "</h1>",
                    "</h1><div class='karte'><h2 class='fehler'>Unbekannte "
                    "Quittung</h2><p>Zu dieser Nummer liegt nichts vor. "
                    "Eintraege verfallen nach der Aufbewahrungsfrist.</p></div>",
                ),
                status_code=404,
            )
        return HTMLResponse(meldungsseite(eintrag))

    @app.get("/meldung/{nummer}/datei", include_in_schema=False)
    def meldungsdatei(nummer: str) -> Response:
        """Die eingereichte Datei im Original zum Herunterladen.

        `text/plain` und `Content-Disposition: attachment`: Der Inhalt
        stammt von aussen und darf im Browser nie als Markup ausgefuehrt
        werden (Wurzel 8).
        """
        from .v1.einreichung import PROTOKOLL

        eintrag = PROTOKOLL.holen(nummer)
        if eintrag is None or not eintrag.rohtext:
            return Response("Nicht vorhanden.", status_code=404,
                            media_type="text/plain; charset=utf-8")
        sicher = "".join(
            z for z in eintrag.dateiname if z.isalnum() or z in "._-"
        )[:80]
        return Response(
            eintrag.rohtext,
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{sicher or "meldung.csv"}"',
                "X-Content-Type-Options": "nosniff",
            },
        )

    @app.get("/health", include_in_schema=False)
    def health() -> JSONResponse:
        """Zustand und Uebermittlungsgueten — maschinenlesbar.

        Ein blosses "ok" sagt nur, dass der Prozess laeuft. Wer wissen
        will, ob der Weg zur Behoerde traegt, braucht die Laufzeiten und
        die Annahmequote. Keine Inhalte, keine Quittungsnummern: Die
        Antwort geht ohne Anmeldung hinaus.
        """
        from .core.protokoll import kennzahlen
        from .v1.einreichung import PROTOKOLL

        k = kennzahlen(PROTOKOLL.liste())
        return JSONResponse(
            {
                "status": "ok",
                "dienst": "dac7-staging",
                "einreichungen": k.gesamt,
                "angenommen": k.angenommen,
                "abgewiesen": k.abgewiesen,
                "annahmequote_prozent": round(k.annahmequote, 1),
                "dauer_mittel_ms": round(k.dauer_mittel_ms, 1),
                "dauer_p80_ms": round(k.dauer_p80_ms, 1),
                "dauer_langsamste_ms": round(k.dauer_langsamste_ms, 1),
                "aufbewahrung_stunden": get_settings().aufbewahrung_stunden,
            }
        )

    log.info("dac7_staging_gestartet", herkuenfte=len(herkuenfte))
    return app


app = create_app()
