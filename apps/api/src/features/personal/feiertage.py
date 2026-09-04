"""Feiertage je Land/Region/Jahr — Import aus dem Paket `holidays` (0541, E3).

Die Tabelle `public.feiertage` ist global (kein Mandantenbezug, kein
Personenbezug). Befüllt wird sie idempotent über den UNIQUE-Index
(land, region, datum): ein zweiter Lauf fügt nichts doppelt ein (Wurzel 2).

Regionale Feiertage: `holidays` kennt für viele Länder Subdivisions (DE-BY,
ES-CT, …). Ein Betrieb wählt in seinen Regeln `feiertage_region`; die Abfrage
liefert dann landesweite + regionale Tage. Fehlt für das Land des Betriebs
jeder Eintrag, meldet `feiertage_laden` das LAUT (`FeiertageFehlen`) — keine
stille leere Menge, die jeden Feiertagszuschlag zu 0 macht (Wurzel 4/5).
"""

from __future__ import annotations

from datetime import date

import holidays as holidays_lib
from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.personal.feiertage")

_QUELLE = f"python-holidays {holidays_lib.__version__}"
_UNIQUE_VERLETZUNG = "23505"


class FeiertageFehlen(Exception):
    """Für Land/Jahr liegen keine Feiertage vor — Import fehlt."""


def unterstuetzt(land: str) -> bool:
    return land.upper() in holidays_lib.list_supported_countries()


def regionen(land: str) -> list[str]:
    """Subdivisions, die `holidays` für das Land kennt (leer = keine)."""
    return list(holidays_lib.list_supported_countries().get(land.upper(), []))


def _eintraege(land: str, jahr: int, region: str | None) -> list[dict[str, object]]:
    try:
        kalender = holidays_lib.country_holidays(land, subdiv=region, years=jahr, language="en_US")
    except (NotImplementedError, KeyError) as exc:
        log.warning("feiertage_land_unbekannt", land=land, region=region, fehler=str(exc))
        return []
    landesweit = holidays_lib.country_holidays(land, years=jahr, language="en_US")
    zeilen: list[dict[str, object]] = []
    for tag, name in sorted(kalender.items()):
        # Regionale Läufe liefern auch die landesweiten Tage mit — die stehen
        # schon unter region=NULL. Nur die echten Zusatztage tragen die Region.
        if region and tag in landesweit:
            continue
        zeilen.append(
            {
                "land": land.upper(),
                "region": region,
                "datum": tag.isoformat(),
                "name": str(name),
                "quelle": _QUELLE,
            }
        )
    return zeilen


def importieren(
    db: Client, land: str, jahre: list[int], *, regionen_mit: bool = True
) -> tuple[int, int]:
    """Feiertage für Land + Jahre einspielen. Gibt (eingefügt, vorhanden) zurück."""
    code = land.upper()
    if not unterstuetzt(code):
        raise FeiertageFehlen(f"Land {code} wird von der Feiertagsquelle nicht unterstützt.")
    eingefuegt = 0
    vorhanden = 0
    laeufe: list[str | None] = [None]
    if regionen_mit:
        laeufe.extend(regionen(code))
    for jahr in jahre:
        for region in laeufe:
            zeilen = _eintraege(code, jahr, region)
            if not zeilen:
                continue
            bestand = (
                db.table("feiertage")
                .select("datum, region")
                .eq("land", code)
                .gte("datum", f"{jahr}-01-01")
                .lte("datum", f"{jahr}-12-31")
                .execute()
            ).data or []
            schon = {(str(r.get("region") or ""), str(r["datum"])) for r in bestand}
            neu = [z for z in zeilen if (str(z["region"] or ""), str(z["datum"])) not in schon]
            vorhanden += len(zeilen) - len(neu)
            if not neu:
                continue
            try:
                db.table("feiertage").insert(neu).execute()
                eingefuegt += len(neu)
            except APIError as exc:
                # Rennen zweier Importe: der UNIQUE-Index ist der Backstop —
                # die Zeilen SIND da, also kein Fehler (Wurzel 2).
                if getattr(exc, "code", None) != _UNIQUE_VERLETZUNG:
                    raise
                vorhanden += len(neu)
    log.info(
        "feiertage_importiert",
        land=code,
        jahre=jahre,
        eingefuegt=eingefuegt,
        vorhanden=vorhanden,
    )
    return eingefuegt, vorhanden


def laden(db: Client, land: str, region: str | None, von: date, bis: date) -> dict[date, str]:
    """Feiertage im Zeitraum (landesweit + Region). Wirft, wenn für ein
    berührtes Jahr gar nichts vorliegt."""
    code = land.upper()
    rows = (
        db.table("feiertage")
        .select("datum, name, region")
        .eq("land", code)
        .gte("datum", von.isoformat())
        .lte("datum", bis.isoformat())
        .execute()
    ).data or []
    ergebnis: dict[date, str] = {}
    for r in rows:
        reg = r.get("region")
        if reg is not None and reg != region:
            continue
        ergebnis[date.fromisoformat(str(r["datum"]))] = str(r["name"])
    for jahr in range(von.year, bis.year + 1):
        if not any(d.year == jahr for d in ergebnis):
            # Ein Jahr ohne einen einzigen Feiertag gibt es in keinem EU-Land:
            # das ist ein fehlender Import, kein Datenstand.
            treffer = (
                db.table("feiertage")
                .select("id")
                .eq("land", code)
                .gte("datum", f"{jahr}-01-01")
                .lte("datum", f"{jahr}-12-31")
                .limit(1)
                .execute()
            ).data or []
            if not treffer:
                raise FeiertageFehlen(f"Für {code} {jahr} sind keine Feiertage importiert.")
    return ergebnis


def sicherstellen(db: Client, land: str, *, heute: date) -> None:
    """Laufendes und folgendes Jahr importieren, falls sie fehlen (Worker-Tick)."""
    for jahr in (heute.year, heute.year + 1):
        treffer = (
            db.table("feiertage")
            .select("id")
            .eq("land", land.upper())
            .gte("datum", f"{jahr}-01-01")
            .lte("datum", f"{jahr}-12-31")
            .limit(1)
            .execute()
        ).data or []
        if not treffer:
            importieren(db, land, [jahr])
