"""Fehlerformat der öffentlichen API — RFC 9457 (`application/problem+json`).

Warum ein Standard und kein eigenes Format: ein Entwickler, der unsere API
anbindet, bindet daneben fünf andere an. Ein Format, das er schon kennt, spart
ihm die Fehlerbehandlung. RFC 9457 („Problem Details for HTTP APIs", 2023, löst
RFC 7807 ab) ist dafür die einzige verbreitete Festlegung.

Recherche der Wettbewerber (20.08.2026) — beide kochen eigen:
  * Lodgify: `{"message", "code", "correlation_id", "event_id"}` mit einem
    eigenen Nummernkatalog (901 NoRateDefined … 999 NotAuthorized).
  * Hostaway: `{"status": "fail", "result": "<Text>"}` — die Fehlermeldung sitzt
    im gleichen Feld wie die Nutzdaten des Erfolgsfalls.
Von beiden übernommen wird die eine gute Idee: ein STABILER, maschinenlesbarer
Fehlercode neben dem HTTP-Status. Ein Client soll auf `min_stay_verletzt`
reagieren können, ohne deutschen Text zu parsen. Er steht hier als `type`-URI
(RFC-9457-konform) und zusätzlich als kurzes `code`-Feld, weil das in der Praxis
schneller gelesen wird.

Zusätzlich in jeder Antwort: `request_id`. Ohne sie ist jede Supportanfrage
(„gestern kam ein 500") nicht beantwortbar.
"""
from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

# Basis der `type`-URIs. Sie zeigt auf die veröffentlichte Fehlerliste im
# Entwicklerportal, und zwar auf den ANKER des jeweiligen Codes — eine URI, die
# ins Nichts führt, ist die häufigste Verletzung von RFC 9457. Hier stand
# zuerst `developers.mynextdays.dk/errors`: eine Subdomain, die es nicht gibt.
# Genau der Fehler, den der Absatz oben anprangert.
#
# Die Anker werden in `marketing/components/entwickler/api-fehlercodes.tsx` je
# Tabellenzeile gesetzt (`id="fehler-<code>"`, Unterstriche als Bindestriche).
# Wer einen neuen Fehlercode einführt, trägt ihn dort ein — sonst zeigt seine
# `type`-URI auf die richtige Seite, aber an keine Stelle darin.
#
# Die Seite ist der Anhang des Entwicklerportals und trägt NUR die Codeliste.
# Ein Anker mitten in einem längeren Kapitel wäre für diesen Sprung die falsche
# Adresse: RFC 9457 verlangt eine Beschreibung des Fehlertyps, nicht ein
# Kapitel, in dem sie irgendwo vorkommt.
FEHLER_BASIS_URI = "https://mynextdays.com/entwickler/fehlercodes"

MEDIENTYP = "application/problem+json"


class ApiFehler(Exception):
    """Ein Fehler, der als problem+json ausgeliefert wird.

    ``code`` ist der stabile Schlüssel (snake_case, nie übersetzt, nie
    umbenannt — Clients verzweigen darauf). ``detail`` ist der menschliche Text
    und darf sich jederzeit ändern.

    ``extra`` nimmt Felder auf, die zum Fehler gehören: bei einer verletzten
    Aufenthaltsregel etwa die geforderte Zahl. Genau das fehlt bei beiden
    Wettbewerbern und kostet den Entwickler einen zweiten Aufruf, um zu
    erfahren, WAS erwartet war.
    """

    def __init__(
        self,
        *,
        status: int,
        code: str,
        detail: str,
        titel: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status = status
        self.code = code
        self.detail = detail
        self.titel = titel or code.replace("_", " ").capitalize()
        self.extra = extra or {}


def problem_antwort(request: Request, fehler: ApiFehler) -> JSONResponse:
    """`ApiFehler` → problem+json-Antwort mit Request-ID und Fehler-URI."""
    # Anker-Form: Unterstriche werden zu Bindestrichen, weil Fragment-IDs in
    # HTML so geschrieben werden und die Doku-Seite sie so setzt.
    anker = fehler.code.replace("_", "-")
    koerper: dict[str, Any] = {
        "type": f"{FEHLER_BASIS_URI}#fehler-{anker}",
        "title": fehler.titel,
        "status": fehler.status,
        "detail": fehler.detail,
        "instance": str(request.url.path),
        "code": fehler.code,
        "request_id": getattr(request.state, "request_id", None),
        **fehler.extra,
    }
    return JSONResponse(
        status_code=fehler.status,
        content=koerper,
        media_type=MEDIENTYP,
    )


# -- Fertige Fehler, die überall gleich lauten sollen -----------------------
# Bewusst als Funktionen und nicht als Konstanten: eine Exception-Instanz, die
# als Modul-Konstante herumliegt, sammelt beim Werfen fremde Tracebacks ein.


def nicht_authentifiziert(detail: str = "Access-Token fehlt oder ist ungültig.") -> ApiFehler:
    """401 — kein oder kein gültiges Token.

    Bewusst dieselbe Meldung für „fehlt", „abgelaufen" und „Signatur falsch":
    die Unterscheidung hilft nur dem, der Tokens durchprobiert.
    """
    return ApiFehler(status=401, code="nicht_authentifiziert", detail=detail,
                     titel="Nicht authentifiziert")


def scope_fehlt(scope: str) -> ApiFehler:
    """403 — Token gültig, aber der Zugang hat diesen Scope nicht.

    Der fehlende Scope steht IM Fehler. Ohne diese Angabe sucht der Entwickler
    im Zweifel im falschen Bereich (Wurzel 9: Autorisierung ist keine
    Authentifizierung, und das muss man auch sagen können).
    """
    return ApiFehler(
        status=403,
        code="scope_fehlt",
        detail=f"Dieser Zugang hat den Scope '{scope}' nicht.",
        titel="Scope fehlt",
        extra={"erforderlicher_scope": scope},
    )


def objekt_nicht_erlaubt(property_id: str) -> ApiFehler:
    """403 — der Zugang ist auf bestimmte Objekte beschränkt, dieses ist nicht dabei."""
    return ApiFehler(
        status=403,
        code="objekt_nicht_erlaubt",
        detail=(
            "Dieser Zugang ist auf bestimmte Objekte beschränkt; "
            "das angefragte gehört nicht dazu."
        ),
        titel="Objekt nicht erlaubt",
        extra={"property_id": property_id},
    )


def nicht_gefunden(was: str = "Die angefragte Ressource") -> ApiFehler:
    """404 — existiert nicht ODER gehört einem fremden Betrieb.

    Bewusst nicht unterscheidbar: ein 403 statt 404 für fremde Datensätze würde
    deren Existenz verraten (Wurzel 3).
    """
    return ApiFehler(status=404, code="nicht_gefunden",
                     detail=f"{was} existiert nicht.", titel="Nicht gefunden")


def ungueltige_anfrage(detail: str, *, extra: dict[str, Any] | None = None) -> ApiFehler:
    """422 — die Anfrage ist formal in Ordnung, fachlich aber nicht erfüllbar."""
    return ApiFehler(status=422, code="ungueltige_anfrage", detail=detail,
                     titel="Ungültige Anfrage", extra=extra)


def konflikt(code: str, detail: str, *, extra: dict[str, Any] | None = None) -> ApiFehler:
    """409 — der Zustand widerspricht der Anfrage (Doppelanlage, Überbuchung)."""
    return ApiFehler(status=409, code=code, detail=detail, titel="Konflikt",
                     extra=extra)


def zu_viele_anfragen(retry_after: int, limit: int, fenster: int) -> ApiFehler:
    """429 — Rate-Limit erreicht. Die Zahlen gehören in den Fehler, nicht nur
    in die Header: ein Client, der die Header ignoriert, soll trotzdem lesen
    können, was gilt."""
    return ApiFehler(
        status=429,
        code="zu_viele_anfragen",
        detail=(
            f"Rate-Limit erreicht ({limit} Anfragen pro {fenster} s). "
            f"Nächster Versuch in {retry_after} s."
        ),
        titel="Zu viele Anfragen",
        extra={"retry_after": retry_after, "limit": limit, "fenster_sekunden": fenster},
    )


def nicht_konfiguriert(detail: str) -> ApiFehler:
    """503 — der Dienst kann die Anfrage nicht sicher bearbeiten (fehlendes
    Secret, fehlende DB). Fail-closed: NIE stattdessen ungeprüft weiterlaufen
    (Wurzel 5)."""
    return ApiFehler(status=503, code="nicht_konfiguriert", detail=detail,
                     titel="Dienst nicht verfügbar")
