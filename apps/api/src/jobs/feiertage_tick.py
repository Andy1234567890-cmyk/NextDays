"""Tages-Tick: Feiertage und Schulferien in `dp_feiertage` holen (0562).

Einreihen und Abarbeiten stehen zusammen (Muster `markt_beobachtung_tick`):
der Worker kennt nur Registry und Aufruf.

WARUM EIN JOB UND NICHT IM RECOMPUTE
====================================
Wie bei der Marktbeobachtung: der Recompute liest nur. Eine Preisberechnung
darf nie an der Erreichbarkeit eines Dritten haengen. Hier laeuft EIN Abruf
pro Tag fuer alle Laender, die irgendein Objekt mit Dynamic Pricing braucht
(Objektland + Quellmaerkte); das Ergebnis liegt in der Tabelle.

QUELLEN (beide oeffentlich, ohne Schluessel, EU-gehostet)
========================================================
  * Nager.Date       — gesetzliche Feiertage je Land und Jahr
                       https://date.nager.at/api/v3/PublicHolidays/{jahr}/{land}
  * OpenHolidays API — Schulferien je Land und Zeitraum, regional
                       https://openholidaysapi.org/SchoolHolidays?countryIsoCode=..

Fail-CLOSED je Quelle: antwortet eine nicht, bleibt der Bestand dieses Landes
stehen (er ist ja nicht falsch geworden), der Ausfall steht im Log und im
Ergebnis. Kein Fantasie-Feiertag, keine erfundene Ferienwoche (Wurzel 4).
Beide Hosts sind fest — kein nutzergelieferter URL-Anteil (Wurzel 8).
"""
from __future__ import annotations

import time
from datetime import UTC, date, datetime
from typing import Any

import httpx
from supabase import Client

from src.core.logging import get_logger
from src.jobs.channex_budget import ChannexBudget
from src.jobs.queue import enqueue

log = get_logger("nextdays.jobs.feiertage_tick")

JOB_TYPE = "feiertage_feed"

_NAGER = "https://date.nager.at/api/v3/PublicHolidays/{jahr}/{land}"
_OPENHOLIDAYS = "https://openholidaysapi.org/SchoolHolidays"
_TIMEOUT_S = 20.0
# Zwischen zwei Fremdaufrufen kurz warten — die Quellen sind frei, nicht unsere.
_PAUSE_S = 0.5
# Dieses und das naechste Jahr: der Push-Horizont ist 365 Tage.
_JAHRE_VORAUS = 1


def einreihen(db: Client, bucket: int) -> int:
    """Genau einen Lauf je Tag einreihen (betriebsuebergreifend)."""
    enqueue(db, JOB_TYPE, payload={}, dedup_key=f"feiertage_tick:{bucket}")
    log.info("feiertage_eingereiht", bucket=bucket)
    return 1


def handle(
    db: Client, _payload: dict[str, Any], _budget: ChannexBudget | None = None
) -> dict[str, Any]:
    """Worker-Handler des Jobs `feiertage_feed`. Zieht KEIN Channex-Budget."""
    return FeiertageFeed(db).lauf()


class FeiertageFeed:
    def __init__(self, db: Client) -> None:
        self._db = db

    def lauf(self) -> dict[str, Any]:
        laender = self._laender()
        heute = datetime.now(UTC).date()
        jahre = [heute.year + i for i in range(_JAHRE_VORAUS + 1)]
        ergebnis: dict[str, Any] = {
            "laender": sorted(laender), "feiertage": 0, "ferien": 0, "fehler": [],
        }
        if not laender:
            log.info("feiertage_keine_laender")
            return ergebnis
        for land in sorted(laender):
            for jahr in jahre:
                try:
                    ergebnis["feiertage"] += self._feiertage(land, jahr)
                except (httpx.HTTPError, ValueError) as exc:
                    ergebnis["fehler"].append(f"feiertag:{land}:{jahr}: {str(exc)[:120]}")
                    log.warning(
                        "feiertage_quelle_fehlgeschlagen",
                        land=land, jahr=jahr, error=str(exc)[:200],
                    )
                time.sleep(_PAUSE_S)
            try:
                ergebnis["ferien"] += self._schulferien(
                    land, date(jahre[0], 1, 1), date(jahre[-1], 12, 31)
                )
            except (httpx.HTTPError, ValueError) as exc:
                ergebnis["fehler"].append(f"ferien:{land}: {str(exc)[:120]}")
                log.warning("schulferien_quelle_fehlgeschlagen", land=land, error=str(exc)[:200])
            time.sleep(_PAUSE_S)
        log.info("feiertage_feed_fertig", **{k: v for k, v in ergebnis.items() if k != "laender"})
        return ergebnis

    # -- Laender: Objektland + Quellmaerkte aller DP-Objekte ------------------------------
    def _laender(self) -> set[str]:
        rows = (
            self._db.table("dp_settings")
            .select("property_id, quellmaerkte, feiertag_uplift_pct, ferien_uplift_pct")
            .eq("enabled", True)
            .execute()
        ).data or []
        # Nur Objekte, bei denen ein Aufschlag eingestellt ist — sonst wuerde
        # der Feed fuer niemanden etwas aendern.
        relevant = [
            r for r in rows
            if float(r.get("feiertag_uplift_pct") or 0) > 0
            or float(r.get("ferien_uplift_pct") or 0) > 0
        ]
        if not relevant:
            return set()
        laender: set[str] = set()
        for r in relevant:
            laender.update(str(c).upper() for c in (r.get("quellmaerkte") or []) if c)
        ids = [str(r["property_id"]) for r in relevant]
        for i in range(0, len(ids), 100):
            props = (
                self._db.table("properties")
                .select("country")
                .in_("id", ids[i : i + 100])
                .execute()
            ).data or []
            laender.update(str(p["country"]).upper() for p in props if p.get("country"))
        return {c for c in laender if len(c) == 2 and c.isalpha()}

    # -- Quelle 1: Nager.Date (Feiertage) --------------------------------------------------
    def _feiertage(self, land: str, jahr: int) -> int:
        resp = httpx.get(_NAGER.format(jahr=jahr, land=land), timeout=_TIMEOUT_S)
        if resp.status_code == 204:  # Land bekannt, keine Daten
            return 0
        resp.raise_for_status()
        daten = resp.json()
        if not isinstance(daten, list):
            raise ValueError("unerwartete Antwort (keine Liste)")
        zeilen: list[dict[str, Any]] = []
        for h in daten:
            tag = str(h.get("date") or "")[:10]
            if len(tag) != 10:
                continue
            # Nur landesweite Feiertage ODER regionale mit Region — beides
            # zaehlt; `counties` liefert Nager als Liste von Codes.
            counties = h.get("counties") or []
            typen = h.get("types") or []
            if typen and "Public" not in typen:
                continue  # Bank/Optional/Observance sind keine freien Tage
            name = str(h.get("localName") or h.get("name") or "Feiertag")
            regionen = [str(c) for c in counties] if counties else [None]
            for region in regionen:
                zeilen.append(
                    {
                        "land": land,
                        "region": region,
                        "art": "feiertag",
                        "name": name[:120],
                        "von": tag,
                        "bis": tag,
                        "quelle": "nager.date",
                        "extern_key": f"{tag}:{name[:60]}",
                        "geladen_am": datetime.now(UTC).isoformat(),
                    }
                )
        self._upsert(zeilen)
        return len(zeilen)

    # -- Quelle 2: OpenHolidays (Schulferien) -------------------------------------------
    def _schulferien(self, land: str, von: date, bis: date) -> int:
        resp = httpx.get(
            _OPENHOLIDAYS,
            params={
                "countryIsoCode": land,
                "validFrom": von.isoformat(),
                "validTo": bis.isoformat(),
            },
            headers={"Accept": "application/json"},
            timeout=_TIMEOUT_S,
        )
        if resp.status_code == 404:  # Land nicht im Datenbestand
            return 0
        resp.raise_for_status()
        daten = resp.json()
        if not isinstance(daten, list):
            raise ValueError("unerwartete Antwort (keine Liste)")
        zeilen: list[dict[str, Any]] = []
        for f in daten:
            start = str(f.get("startDate") or "")[:10]
            ende = str(f.get("endDate") or "")[:10]
            if len(start) != 10 or len(ende) != 10:
                continue
            name = _name(f.get("name"))
            subdivs = f.get("subdivisions") or []
            regionen = [str(s.get("code") or s.get("shortName") or "") for s in subdivs] or [None]
            for region in regionen:
                zeilen.append(
                    {
                        "land": land,
                        "region": region or None,
                        "art": "schulferien",
                        "name": name[:120],
                        "von": start,
                        "bis": ende,
                        "quelle": "openholidaysapi.org",
                        "extern_key": str(f.get("id") or f"{start}:{ende}:{name[:40]}"),
                        "geladen_am": datetime.now(UTC).isoformat(),
                    }
                )
        self._upsert(zeilen)
        return len(zeilen)

    def _upsert(self, zeilen: list[dict[str, Any]]) -> None:
        """Idempotent ueber den eindeutigen Index (land, region, art, extern_key)."""
        if not zeilen:
            return
        # PostgREST braucht fuer den Konflikt exakt die Indexspalten; `region`
        # ist per coalesce indiziert — deshalb NULL vorher zu '' machen ist
        # KEINE Option (die Spalte selbst bleibt NULL fuer landesweit). Wir
        # dedupen deshalb selbst: erst vorhandene Schluessel lesen, dann nur
        # neue einfuegen (Wurzel 2).
        land = zeilen[0]["land"]
        art = zeilen[0]["art"]
        vorhanden = (
            self._db.table("dp_feiertage")
            .select("region, extern_key")
            .eq("land", land)
            .eq("art", art)
            .in_("extern_key", sorted({z["extern_key"] for z in zeilen}))
            .execute()
        ).data or []
        schon = {(r.get("region") or "", r["extern_key"]) for r in vorhanden}
        neu = [z for z in zeilen if ((z["region"] or ""), z["extern_key"]) not in schon]
        for i in range(0, len(neu), 200):
            self._db.table("dp_feiertage").insert(neu[i : i + 200]).execute()


def _name(wert: object) -> str:
    """OpenHolidays liefert Namen als Liste {language, text}."""
    if isinstance(wert, list):
        for n in wert:
            if isinstance(n, dict) and n.get("text"):
                return str(n["text"])
    if isinstance(wert, str):
        return wert
    return "Schulferien"
