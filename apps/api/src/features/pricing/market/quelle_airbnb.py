"""Preisquelle: oeffentlich ausgeschriebene Preise der Umgebung.

ABGRENZUNG
==========
Dieses Modul liest oeffentlich sichtbare Angebotspreise eines Kartenausschnitts
und gibt AUSSCHLIESSLICH eine Liste nackter Zahlen zurueck. Namen, Objekt-IDs,
Links und Koordinaten der fremden Inserate verlassen die Funktion nicht —
`preise_im_kasten` gibt `list[float]`, nichts weiter. Wer den Aufrufer aendert,
kann also nicht versehentlich Fremdnamen in die Datenbank oder in die
Oberflaeche tragen.

WARUM NUR "GANZE UNTERKUNFT"
============================
Ohne Typfilter sinkt der Median in der Hochsaison UNTER den der Nebensaison,
weil die guten Haeuser ausgebucht sind und Einzelzimmer die Liste fuellen.
Live gemessen am 04.09.2026 rund um Skagen: Juli-Median 671 ungefiltert gegen
1304 mit Filter, bei Oktober 1230 gegen 1524. Der ungefilterte Wert ist nicht
nur ungenau, er dreht das Vorzeichen der Saison um.

BETRIEB
=======
Die Bibliothek ist eine Fremdabhaengigkeit, die brechen kann, wenn die Quelle
ihre Struktur aendert (die Projekt-Historie zeigt genau solche Korrekturen).
Deshalb: jeder Fehler fuehrt zu einer LEEREN Liste und einer lauten
Protokollzeile, nie zu einem geschaetzten Wert (Wurzel 4) und nie zu einem
stillen Teilerfolg (Wurzel 5). Faellt die Quelle aus, bleibt der Markt-Faktor
neutral — das ist ein sichtbarer Stillstand, kein falscher Preis.
"""
from __future__ import annotations

from datetime import date, timedelta

from src.core.logging import get_logger

log = get_logger("nextdays.pricing.market.quelle")

# Nur ganze Unterkuenfte — siehe Modul-Docstring.
_ART = "Entire home/apt"

# Zoomstufe der Kartensuche. 12 deckt eine Rasterzelle ab, ohne dass die Quelle
# das Ergebnis auf einen Ausschnitt zusammenfasst.
_ZOOM = 12

# Obergrenze der Treffer, die ausgewertet werden (Wurzel 8). Der Median aendert
# sich ab ~100 Objekten nicht mehr nennenswert.
_MAX_TREFFER = 200


def verfuegbar() -> bool:
    """Ist die Quelle installiert? Ohne sie laeuft alles andere weiter."""
    try:
        # Nur die Importbarkeit interessiert; gebraucht wird die Bibliothek
        # erst im Abruf. Der Import ist deshalb absichtlich ohne Verwendung.
        import pyairbnb  # noqa: F401, PLC0415  # pylint: disable=unused-import
    except ImportError:
        return False
    return True


def preise_im_kasten(
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
    tag: date,
    waehrung: str,
) -> list[float]:
    """Angebotspreise fuer EINE Nacht im Kartenausschnitt.

    Gibt nur Zahlen zurueck — bewusst keine Namen, IDs oder Koordinaten (siehe
    Modul-Docstring). Leere Liste heisst „kein Signal", nicht „Preis 0".
    """
    roh = _abrufen(sw_lat, sw_lng, ne_lat, ne_lng, tag, waehrung)
    preise = [b for b in (_betrag(e, waehrung) for e in roh) if b is not None]
    log.info(
        "markt_quelle_abgerufen",
        tag=tag.isoformat(),
        treffer=len(roh),
        mit_preis=len(preise),
    )
    return preise


def _abrufen(
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
    tag: date,
    waehrung: str,
) -> list[dict]:
    """Der EINE Weg nach draussen. Beide oeffentlichen Funktionen laufen hier
    zusammen, damit Fehlerbehandlung und Deckelung nicht zweimal existieren."""
    try:
        import pyairbnb  # noqa: PLC0415
    except ImportError:
        log.warning("markt_quelle_nicht_installiert")
        return []
    if not waehrung:
        # Ohne Waehrung waere die Zahl bedeutungslos und im Vergleich mit dem
        # eigenen Basispreis grob falsch (Wurzel 4: kein Ersatzwert).
        log.warning("markt_quelle_ohne_waehrung")
        return []
    try:
        treffer = pyairbnb.search_all(
            check_in=tag.isoformat(),
            check_out=(tag + timedelta(days=1)).isoformat(),
            ne_lat=ne_lat,
            ne_long=ne_lng,
            sw_lat=sw_lat,
            sw_long=sw_lng,
            zoom_value=_ZOOM,
            currency=waehrung,
            price_min=0,
            price_max=0,
            place_type=_ART,
            amenities=[],
            free_cancellation=False,
            language="en",
            proxy_url="",
        )
    except Exception as exc:  # noqa: BLE001 — Fremdquelle darf den Lauf nicht kippen
        log.warning(
            "markt_quelle_abruf_fehlgeschlagen",
            tag=tag.isoformat(),
            grund=type(exc).__name__,
            fehler=str(exc)[:200],
        )
        return []
    return [e for e in (treffer or [])[:_MAX_TREFFER] if isinstance(e, dict)]


def preise_mit_ort(
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
    tag: date,
    waehrung: str,
) -> list[tuple[float, float, float]]:
    """Wie `preise_im_kasten`, aber je Treffer (preis, lat, lng).

    Die Koordinate wird gebraucht, weil das Preisniveau INNERHALB eines
    Gebiets stark schwankt — gemessen am 04.09.2026 rund um Tversted von 689
    DKK im Binnenland bis 2.574 DKK an der Kueste. Ein einziger Median ueber
    das ganze Gebiet fuehrt Kuestenobjekte in die Irre.

    Weiterhin OHNE Namen und ohne Objekt-IDs: der Aufrufer aggregiert die
    Punkte sofort zu Teilgebiets-Medianen, einzelne Koordinaten werden nie
    gespeichert (siehe `beobachtung_service._feinraster`).
    """
    roh = _abrufen(sw_lat, sw_lng, ne_lat, ne_lng, tag, waehrung)
    raus: list[tuple[float, float, float]] = []
    for eintrag in roh:
        betrag = _betrag(eintrag, waehrung)
        if betrag is None or not isinstance(eintrag, dict):
            continue
        koord = eintrag.get("coordinates") or {}
        if not isinstance(koord, dict):
            continue
        # Das Feld heisst in der Quelle "longitud" (ohne e) — kein Tippfehler.
        lat_roh, lng_roh = koord.get("latitude"), koord.get("longitud")
        try:
            raus.append((betrag, float(lat_roh), float(lng_roh)))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
    log.info(
        "markt_quelle_mit_ort",
        tag=tag.isoformat(),
        treffer=len(roh),
        mit_ort=len(raus),
    )
    return raus


def _betrag(eintrag: object, waehrung: str) -> float | None:
    """Preis eines Treffers — nur wenn er wirklich in der erwarteten Waehrung
    steht. Eine fremde Waehrung waere im Vergleich mit dem eigenen Basispreis
    ein Faktor jenseits jeder Deckelung, deshalb lieber kein Wert."""
    if not isinstance(eintrag, dict):
        return None
    einheit = ((eintrag.get("price") or {}).get("unit")) or {}
    if not isinstance(einheit, dict):
        return None
    gemeldet = (einheit.get("currency") or "").strip().upper()
    if gemeldet and gemeldet != waehrung.strip().upper():
        return None
    roh = einheit.get("amount")
    try:
        betrag = float(roh)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return betrag if betrag > 0 else None
