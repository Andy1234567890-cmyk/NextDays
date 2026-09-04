"""Marktstand für die Oberfläche: Kurve, Kennzahlen, ehrlicher Hinweis.

Getrennt vom Router, weil hier eine fachliche Entscheidung steckt und keine
HTTP-Arbeit: WAS die Oberfläche über den Markt erfährt. Der Router ruft nur.

Grundsatz: keine Fremdnamen (siehe `beobachtung`). Was herausgeht, ist je
Tag ein Median über mindestens `_MIN_OBJEKTE` Objekte, die Streuung, der
eigene Preis daneben — und für die Karte jeder beobachtete Angebotspreis mit
seinem auf ~100 m gerundeten Ort. Ohne Name, ID oder Link lässt sich daraus
keine Wettbewerberliste bauen; mit den Punkten lässt sich aber sehen, wo die
Region teuer ist (Entscheidung des Nutzers vom 04.09.2026).
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from math import cos, radians

from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from ..ki_schemas import MarktAngebot, MarktPunkt, MarktStand
from .beobachtung import _MIN_OBJEKTE, _ZELLE_GRAD, Zelle
from .umgebung import _ART, _MAX_ALTER_TAGE, _QUELLE

log = get_logger("nextdays.pricing.market.stand")

# Wie weit die Kurve in die Zukunft reicht. Ein Jahr deckt jede Saison einmal
# ab; darüber hinaus ist die Marktbeobachtung so grob gerastert, dass eine
# Kurve mehr Genauigkeit vortäuschen würde, als sie hat.
_KURVE_TAGE = 365

# Kantenlänge in km (Anzeige): 0,45 Grad Breite sind rund 50 km. Gerundet, weil
# die Zelle ein Rechteck ist und jede Nachkommastelle Genauigkeit vortäuscht.
_ZELLE_KM = round(_ZELLE_GRAD * 111.0)

# Obergrenze der Kartenpunkte JE STICHTAG (Wurzel 8: kein unbegrenzter Bereich
# in einer Antwort). Gedeckelt wird je Tag und nicht insgesamt: ein Gesamtdeckel
# liesse die hinteren Stichtage leer ausgehen — genau der Zustand („Tag 3 und 4
# zeigt keine Daten"), der hier behoben wird.
#
# 300 liegt über dem, was die Quelle je Abruf hergibt (`quelle_airbnb.
# _MAX_TREFFER` = 200; gemessen am 04.09.2026 in der 50-km-Zelle um
# Stjerneskud 92–122 Angebote je Tag). Der Deckel greift also im Normalfall
# nicht, faengt aber eine dichte Region ab, bevor 23 Stichtage × 1 000 Punkte
# die Antwort auf Megabytes treiben und die Karte traege machen. Greift er,
# bleiben die dem Objekt NAECHSTEN Punkte — sie sind der relevantere Wettbewerb.
_MAX_ANGEBOTE_JE_TAG = 300


def marktstand_bauen(
    db: Client,
    property_id: str,
    _tenant_id: str | None = None,
) -> MarktStand:
    """Alles, was die Oberfläche über den Markt dieses Objekts zeigt.

    `_tenant_id` wird hier NICHT gebraucht und deshalb nicht gelesen: die
    Marktbeobachtung ist betriebsübergreifend, eine Rasterzelle bedient alle
    Objekte in ihr. Die Mandantenprüfung passiert eine Ebene höher im Router
    (`require_own_property`) — hier sie zu wiederholen, würde suggerieren, das
    Ergebnis hinge vom Betrieb ab. Der Parameter bleibt für Aufrufer erhalten,
    die ihn schon durchreichen.
    """
    standort = _standort(db, property_id)
    if standort is None:
        return MarktStand(
            property_id=property_id,
            mindestens_noetig=_MIN_OBJEKTE,
            radius_km=float(_ZELLE_KM),
            hinweis=(
                "Das Objekt hat keine Koordinaten oder keine Währung "
                "hinterlegt — ohne beides lässt sich kein Markt bestimmen."
            ),
        )
    zelle, waehrung, lat, lng = standort
    heute = date.today()
    zeilen = _raster(db, zelle, waehrung, heute, heute + timedelta(days=_KURVE_TAGE))
    if not zeilen:
        return MarktStand(
            property_id=property_id,
            mindestens_noetig=_MIN_OBJEKTE,
            radius_km=float(_ZELLE_KM),
            waehrung=waehrung,
            lat=lat,
            lng=lng,
            hinweis=(
                "Für diese Region liegen noch keine Marktdaten vor. Die "
                "Beobachtung läuft einmal täglich; nach dem nächsten Lauf "
                "steht hier das Preisniveau der Umgebung."
            ),
        )

    eigene = _eigene_preise(db, property_id, heute, heute + timedelta(days=_KURVE_TAGE))
    verlauf = [
        MarktPunkt(
            tag=z["tag"],
            markt_median=float(z["median_preis"]),
            p25=_zahl(z.get("p25_preis")),
            p75=_zahl(z.get("p75_preis")),
            anzahl=int(z.get("anzahl") or 0),
            eigener_preis=eigene.get(z["tag"]),
        )
        for z in zeilen
    ]
    naechste_30 = [
        p.markt_median
        for p in verlauf
        if date.fromisoformat(p.tag) <= heute + timedelta(days=30)
    ]
    juengste = max(str(z.get("abgerufen_am") or "") for z in zeilen)
    return MarktStand(
        property_id=property_id,
        vergleichsobjekte=verlauf[0].anzahl if verlauf else 0,
        mindestens_noetig=_MIN_OBJEKTE,
        radius_km=float(_ZELLE_KM),
        markt_median=(
            round(sum(naechste_30) / len(naechste_30), 2) if naechste_30 else None
        ),
        waehrung=waehrung,
        stand_vom=juengste[:19] or None,
        quelle=_QUELLE,
        lat=lat,
        lng=lng,
        verlauf=verlauf,
        angebote=_angebote(
            db, zelle, waehrung, [p.tag for p in verlauf], lat, lng
        ),
    )


def _standort(
    db: Client, property_id: str
) -> tuple[Zelle, str, float, float] | None:
    try:
        rows = (
            db.table("properties")
            .select("lat, lng, currency")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001
        log.warning("marktstand_objekt_unlesbar", fehler=str(exc)[:200])
        return None
    if not rows:
        return None
    r = rows[0]
    waehrung = (r.get("currency") or "").strip().upper()
    if r.get("lat") is None or r.get("lng") is None or not waehrung:
        return None
    try:
        lat, lng = float(r["lat"]), float(r["lng"])
        return (Zelle.fuer(lat, lng), waehrung, lat, lng)
    except (TypeError, ValueError):
        return None


def _raster(
    db: Client, zelle: Zelle, waehrung: str, von: date, bis: date
) -> list[dict]:
    grenze = datetime.now(UTC) - timedelta(days=_MAX_ALTER_TAGE)
    try:
        return (
            db.table("markt_beobachtung")
            .select("tag, median_preis, p25_preis, p75_preis, anzahl, abgerufen_am")
            .eq("zelle_lat", zelle.lat)
            .eq("zelle_lng", zelle.lng)
            .eq("objekt_art", _ART)
            .eq("quelle", _QUELLE)
            .eq("waehrung", waehrung)
            .gte("tag", von.isoformat())
            .lte("tag", bis.isoformat())
            .gte("abgerufen_am", grenze.isoformat())
            .order("tag")
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001
        log.warning("marktstand_raster_unlesbar", fehler=str(exc)[:200])
        return []


def _angebote(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    db: Client,
    zelle: Zelle,
    waehrung: str,
    tage: list[str],
    eigen_lat: float,
    eigen_lng: float,
) -> list[MarktAngebot]:
    """Alle beobachteten Angebotspreise der Zelle je Stichtag — die Punkte der Karte.

    Alle Tage auf einmal statt je Klick nachzuladen: ein Nachladen beim
    Umschalten macht die Karte träge. Die Menge ist je Tag gedeckelt
    (`_MAX_ANGEBOTE_JE_TAG`), damit die Antwort berechenbar bleibt.

    PAGINIERT über `fetch_all_rows`: 23 Stichtage × bis zu 200 Punkte sind bis
    zu 4 600 Zeilen, PostgREST liefert ohne Paginierung stillschweigend nur
    1 000. Die hinteren Stichtage kämen dann leer zurück — dasselbe Symptom
    („Tag 3 und 4 zeigt keine Daten") aus einer anderen Ursache.
    """
    if not tage:
        return []
    grenze = datetime.now(UTC) - timedelta(days=_MAX_ALTER_TAGE)
    try:
        rows = fetch_all_rows(
            db.table("markt_punkt")
            .select("tag, lat, lng, preis")
            .eq("zelle_lat", zelle.lat)
            .eq("zelle_lng", zelle.lng)
            .eq("objekt_art", _ART)
            .eq("quelle", _QUELLE)
            .eq("waehrung", waehrung)
            .in_("tag", tage)
            .gte("abgerufen_am", grenze.isoformat())
            .order("id")
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("marktstand_angebote_unlesbar", fehler=str(exc)[:200])
        return []
    je_tag: dict[str, list[MarktAngebot]] = {}
    for r in rows:
        preis = _zahl(r.get("preis"))
        la, lo = _zahl(r.get("lat")), _zahl(r.get("lng"))
        if preis is None or la is None or lo is None:
            continue
        tag = str(r.get("tag"))[:10]
        je_tag.setdefault(tag, []).append(
            MarktAngebot(tag=tag, lat=la, lng=lo, preis=preis)
        )
    raus: list[MarktAngebot] = []
    for tag in tage:
        raus.extend(
            _naechste(je_tag.get(tag, []), eigen_lat, eigen_lng, _MAX_ANGEBOTE_JE_TAG)
        )
    return raus


def _naechste(
    angebote: list[MarktAngebot], lat: float, lng: float, n: int
) -> list[MarktAngebot]:
    """Die `n` dem Objekt nächsten Angebote (alle, wenn weniger).

    Abstand als Näherung in Grad mit Breitenkorrektur — für „welche sind am
    nächsten" reicht das, eine Haversine wäre hier Genauigkeit ohne Nutzen.
    """
    if len(angebote) <= n:
        return angebote
    k = max(0.01, cos(radians(lat)))
    return sorted(
        angebote,
        key=lambda a: (a.lat - lat) ** 2 + ((a.lng - lng) * k) ** 2,
    )[:n]


def _eigene_preise(
    db: Client, property_id: str, von: date, bis: date
) -> dict[str, float]:
    """Der eigene berechnete Preis je Tag — für den Abstand in der Karte."""
    try:
        rows = (
            db.table("dynamic_prices")
            .select("date, price")
            .eq("property_id", property_id)
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001
        log.warning("marktstand_eigene_preise_unlesbar", fehler=str(exc)[:200])
        return {}
    raus: dict[str, float] = {}
    for r in rows:
        preis = _zahl(r.get("price"))
        if preis is not None:
            raus[str(r["date"])[:10]] = preis
    return raus


def _zahl(wert: object) -> float | None:
    if wert is None:
        return None
    try:
        return float(wert)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
