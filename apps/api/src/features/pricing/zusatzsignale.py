"""Zusatzsignale des Dynamic Pricing (0562): Preisgrenzen, Vorjahresanker,
Feiertage — und der Verlauf.

Alles hier LIEST nur (Ausnahme: `verlauf_schreiben`) und liefert dem Recompute
je Tag einen Wert, den die Engine als Signal bekommt. Fremdquellen werden hier
NICHT abgerufen — der Feiertags-Feed laeuft als eigener Tagesjob
(`jobs/feiertage_tick.py`) und legt seine Daten in `dp_feiertage` ab; hier
wird nur gelesen. Eine Preisberechnung haengt nie an der Erreichbarkeit eines
Dritten (dasselbe Prinzip wie bei der Marktbeobachtung).

WARUM EIN EIGENES MODUL
=======================
`recompute.py` ist mit 1100 Zeilen die groesste Datei des Slices. Jedes neue
Signal dort hinein zu legen macht die eine Rechenwahrheit unlesbar. Hier stehen
die Lader nebeneinander, testbar mit derselben Fake-DB wie der Recompute.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

log = get_logger("nextdays.pricing.zusatzsignale")

# Wie weit um denselben Kalendertag des Vorjahres herum nach Buchungen gesucht
# wird (±3 Tage = dieselbe Woche, wochentagsunabhaengig).
_ANKER_FENSTER_TAGE = 3
# Ein Jahr zurueck. Nicht 52 Wochen: der Nutzer denkt in „letztes Jahr im Juli".
_ANKER_JAHR_TAGE = 365
# Buchungsstatus, die als echte Nachfrage zaehlen.
_ANKER_STATUS = ("confirmed", "completed")


# ------------------------------------------------------------------ Grenzen
def preisgrenzen_je_tag(
    db: Client, property_id: str, start: date, end: date
) -> dict[str, tuple[float | None, float | None]]:
    """{ISO-Tag: (min, max)} aus `dp_preisgrenzen` fuer [start, end).

    Die SPEZIFISCHSTE Grenze gewinnt je Tag: erst eine mit Wochentagen vor einer
    ohne, dann der kuerzere Zeitraum vor dem laengeren. Bei `jaehrlich` wird der
    Zeitraum in jedes Jahr des Horizonts projiziert (Monat/Tag, Jahr laeuft
    mit; ein Zeitraum ueber den Jahreswechsel bleibt zusammenhaengend).

    Tage ohne Treffer fehlen im Ergebnis — dort gilt dp_settings.min/max_price.
    """
    try:
        rows = fetch_all_rows(
            db.table("dp_preisgrenzen")
            .select("von, bis, wochentage, jaehrlich, min_price, max_price")
            .eq("property_id", property_id)
            .order("id")
        )
    except Exception as exc:  # noqa: BLE001 — Tabelle fehlt (vor 0562) = keine Grenzen
        log.warning("dp_preisgrenzen_unlesbar", error=str(exc)[:200])
        return {}
    if not rows:
        return {}
    out: dict[str, tuple[float | None, float | None]] = {}
    # (spezifitaet, min, max) je Tag; hoehere Spezifitaet ueberschreibt.
    beste: dict[str, tuple[int, float | None, float | None]] = {}
    for r in rows:
        von = _as_date(r.get("von"))
        bis = _as_date(r.get("bis"))
        if von is None or bis is None:
            continue
        wochentage = {int(w) for w in (r.get("wochentage") or [])} or None
        laenge = (bis - von).days + 1
        # Spezifitaet: Wochentage zaehlen mehr als jede Laenge; darunter
        # gewinnt der kuerzere Zeitraum (10_000 Tage sind weit jenseits 730).
        spez = (10_000 if wochentage else 0) + (10_000 - min(laenge, 9_999))
        mn = _opt_float(r.get("min_price"))
        mx = _opt_float(r.get("max_price"))
        for tag in _zeitraum_tage(von, bis, bool(r.get("jaehrlich")), start, end):
            if wochentage is not None and tag.weekday() not in wochentage:
                continue
            iso = tag.isoformat()
            alt = beste.get(iso)
            if alt is None or spez > alt[0]:
                beste[iso] = (spez, mn, mx)
    for iso, (_s, mn, mx) in beste.items():
        out[iso] = (mn, mx)
    return out


def _zeitraum_tage(
    von: date, bis: date, jaehrlich: bool, start: date, end: date
) -> list[date]:
    """Alle Tage des Zeitraums innerhalb [start, end) — bei `jaehrlich` fuer
    jedes Jahr, das der Horizont beruehrt."""
    if not jaehrlich:
        lo, hi = max(von, start), min(bis, end - timedelta(days=1))
        return _tage(lo, hi)
    out: list[date] = []
    dauer = (bis - von).days
    for jahr in range(start.year - 1, end.year + 1):
        v = _verschiebe_jahr(von, jahr)
        b = v + timedelta(days=dauer)
        lo, hi = max(v, start), min(b, end - timedelta(days=1))
        out.extend(_tage(lo, hi))
    return out


def _verschiebe_jahr(d: date, jahr: int) -> date:
    """Denselben Monat/Tag in `jahr`; 29.02. faellt auf den 28.02."""
    try:
        return d.replace(year=jahr)
    except ValueError:
        return d.replace(year=jahr, day=28)


def _tage(lo: date, hi: date) -> list[date]:
    if hi < lo:
        return []
    return [lo + timedelta(days=i) for i in range((hi - lo).days + 1)]


# -------------------------------------------------------------------- Anker
def anker_je_tag(
    db: Client, property_id: str, start: date, end: date
) -> dict[str, float]:
    """{ISO-Tag: bester Netto-Nachtpreis derselben Woche im Vorjahr}.

    Aus den EIGENEN Buchungen: `total_amount / Naechte` je belegter Nacht, dann
    je Zieltag das Maximum ueber den Vorjahres-Tag ±3 Tage. Tage ohne Buchung
    damals fehlen — kein Anker, kein erfundener Wert (Wurzel 4).

    `total_amount` ist bei Portalbuchungen der Netto-Payout (Airbnb nach
    Provision) — deshalb wirkt der Anker nur als Untergrenze nach oben, nie
    als Zielpreis (siehe `engine._anker_factor`).
    """
    vj_start = start - timedelta(days=_ANKER_JAHR_TAGE + _ANKER_FENSTER_TAGE)
    vj_end = end - timedelta(days=_ANKER_JAHR_TAGE - _ANKER_FENSTER_TAGE)
    try:
        rows = fetch_all_rows(
            db.table("reservations")
            .select("check_in, check_out, total_amount, status")
            .eq("property_id", property_id)
            .in_("status", list(_ANKER_STATUS))
            .lt("check_in", vj_end.isoformat())
            .gt("check_out", vj_start.isoformat())
            .order("check_in")
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("dp_anker_unlesbar", error=str(exc)[:200])
        return {}
    nacht_max: dict[date, float] = {}
    for r in rows:
        ci, co = _as_date(r.get("check_in")), _as_date(r.get("check_out"))
        betrag = _opt_float(r.get("total_amount"))
        if ci is None or co is None or betrag is None or betrag <= 0:
            continue
        naechte = (co - ci).days
        if naechte <= 0:
            continue
        je_nacht = betrag / naechte
        for i in range(naechte):
            n = ci + timedelta(days=i)
            if nacht_max.get(n, 0.0) < je_nacht:
                nacht_max[n] = je_nacht
    if not nacht_max:
        return {}
    out: dict[str, float] = {}
    cur = start
    while cur < end:
        mitte = cur - timedelta(days=_ANKER_JAHR_TAGE)
        beste = max(
            (
                nacht_max.get(mitte + timedelta(days=d), 0.0)
                for d in range(-_ANKER_FENSTER_TAGE, _ANKER_FENSTER_TAGE + 1)
            ),
            default=0.0,
        )
        if beste > 0:
            out[cur.isoformat()] = round(beste, 2)
        cur += timedelta(days=1)
    return out


# ---------------------------------------------------------------- Feiertage
def feiertage_je_tag(
    db: Client, laender: list[str], start: date, end: date
) -> dict[str, dict[str, bool]]:
    """{ISO-Tag: {"feiertag": bool, "ferien": bool}} aus `dp_feiertage` fuer
    die genannten Laender (Objektland + Quellmaerkte). Regionale Schulferien
    zaehlen, sobald IRGENDEINE Region des Landes Ferien hat — der Gast reist
    aus dem ganzen Land an, nicht aus einem Bundesland."""
    codes = sorted({c.strip().upper() for c in laender if c and c.strip()})
    if not codes:
        return {}
    try:
        rows = fetch_all_rows(
            db.table("dp_feiertage")
            .select("art, von, bis")
            .in_("land", codes)
            .lt("von", end.isoformat())
            .gte("bis", start.isoformat())
            .order("id")
        )
    except Exception as exc:  # noqa: BLE001 — Tabelle fehlt = keine Feiertage
        log.warning("dp_feiertage_unlesbar", error=str(exc)[:200])
        return {}
    out: dict[str, dict[str, bool]] = defaultdict(
        lambda: {"feiertag": False, "ferien": False}
    )
    for r in rows:
        von, bis = _as_date(r.get("von")), _as_date(r.get("bis"))
        if von is None or bis is None:
            continue
        schluessel = "feiertag" if r.get("art") == "feiertag" else "ferien"
        lo, hi = max(von, start), min(bis, end - timedelta(days=1))
        for tag in _tage(lo, hi):
            out[tag.isoformat()][schluessel] = True
    return dict(out)


def objektland(db: Client, property_id: str) -> str | None:
    """ISO-Land des Objekts (`properties.country`); None, wenn nicht gepflegt."""
    try:
        res = (
            db.table("properties")
            .select("country")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001
        log.warning("dp_objektland_unlesbar", error=str(exc)[:200])
        return None
    land = (res[0].get("country") if res else None) or None
    return str(land).upper() if land else None


# ------------------------------------------------------------------ Verlauf
def verlauf_schreiben(  # pylint: disable=too-many-arguments
    db: Client,
    property_id: str,
    *,
    von: date,
    bis: date,
    ereignis: str,
    details: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> None:
    """Einen Eintrag in `dp_verlauf` ablegen (SiteMinder „History").

    Best-effort, aber laut: der Verlauf ist Auskunft, kein Hauptpfad — ein
    Fehler hier darf weder Push noch Tagesmodus kippen, muss aber im Log
    stehen (Wurzel 5).
    """
    try:
        db.table("dp_verlauf").insert(
            {
                "property_id": property_id,
                "von": von.isoformat(),
                "bis": bis.isoformat(),
                "ereignis": ereignis,
                "details": details or {},
                "user_id": user_id,
                "created_at": datetime.now(UTC).isoformat(),
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "dp_verlauf_schreiben_fehlgeschlagen",
            property_id=property_id,
            ereignis=ereignis,
            error=str(exc)[:200],
        )


# ------------------------------------------------------------------- Helfer
def _as_date(value: object) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and len(value) >= 10:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _opt_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- Saison (0565)
def saison_vorhanden(db: Client, property_id: str) -> bool:
    """Hat das Objekt einen Saisonkalender — mindestens EINE Saison mit
    zugewiesenem Zeitraum? Ohne ihn ist die Regel „Mindestpreis aus dem
    Saisonkalender" nicht waehlbar: ein Schalter, der nichts steuert, waere
    eine Attrappe."""
    try:
        res = (
            db.table("property_season_assignments")
            .select("id")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — Tabelle fehlt = kein Kalender
        log.warning("saison_zuweisungen_unlesbar", error=str(exc)[:200])
        return False
    return bool(res)


def saison_untergrenze_je_tag(
    db: Client, property_id: str, base: float | None, start: date, end: date
) -> dict[str, float]:
    """{ISO-Tag: Saisonpreis} fuer [start, end) aus dem Saisonkalender.

    DIESELBE Preisregel wie beim Materialisieren in den Kalender
    (calendar._season_price_for_day): 'fixed' = der Betrag, 'percent' =
    Grundpreis des Ratenplans ± Prozent. Ohne Grundpreis hat eine Prozent-
    Saison keinen Preis — der Tag fehlt dann (nichts erfinden, Wurzel 4).

    Mehrere Saisons: es zaehlt die Saison, in der der Tag liegt. Ueberlappen
    sich Zuweisungen, gewinnt die zuletzt angelegte — wie beim Uebermalen im
    Saisonkalender („last win", 0138). Tage ohne Saison fehlen im Ergebnis;
    dort gilt der normale Mindestpreis.
    """
    try:
        saisons = {
            str(r["id"]): r
            for r in fetch_all_rows(
                db.table("property_seasons")
                .select("id, mode, amount")
                .eq("property_id", property_id)
            )
        }
        zuweisungen = fetch_all_rows(
            db.table("property_season_assignments")
            .select("season_id, start_date, end_date, created_at")
            .eq("property_id", property_id)
            .lte("start_date", (end - timedelta(days=1)).isoformat())
            .gte("end_date", start.isoformat())
            .order("created_at")
        )
    except Exception as exc:  # noqa: BLE001 — Tabelle fehlt = kein Kalender
        log.warning("saison_untergrenze_unlesbar", error=str(exc)[:200])
        return {}
    out: dict[str, float] = {}
    for z in zuweisungen:
        saison = saisons.get(str(z.get("season_id")))
        von, bis = _as_date(z.get("start_date")), _as_date(z.get("end_date"))
        if saison is None or von is None or bis is None:
            continue
        preis = _saisonpreis(saison, base)
        if preis is None:
            continue
        tag = max(von, start)
        letzter = min(bis, end - timedelta(days=1))
        while tag <= letzter:
            out[tag.isoformat()] = preis  # spaetere Zuweisung ueberschreibt
            tag += timedelta(days=1)
    return out


def _saisonpreis(saison: dict[str, Any], base: float | None) -> float | None:
    try:
        betrag = float(saison.get("amount"))
    except (TypeError, ValueError):
        return None
    if saison.get("mode") == "fixed":
        return round(betrag, 2)
    if base is None or base <= 0:
        return None
    return round(base * (1 + betrag / 100), 2)


def saison_untergrenzen_bulk(
    db: Client,
    basis_je_objekt: dict[str, float | None],
    start: date,
    end: date,
) -> dict[str, tuple[float, float, int]]:
    """{property_id: (min, max, tage)} der Saison-Untergrenzen im Horizont —
    fuer die Objektliste in ZWEI Abfragen statt einer je Zeile (N+1).
    Objekte ohne Saisontag mit Preis fehlen im Ergebnis."""
    ids = list(basis_je_objekt)
    if not ids:
        return {}
    out: dict[str, tuple[float, float, int]] = {}
    try:
        for i in range(0, len(ids), 100):
            block = ids[i : i + 100]
            saisons = {
                str(r["id"]): r
                for r in fetch_all_rows(
                    db.table("property_seasons")
                    .select("id, property_id, mode, amount")
                    .in_("property_id", block)
                )
            }
            zuweisungen = fetch_all_rows(
                db.table("property_season_assignments")
                .select("property_id, season_id, start_date, end_date, created_at")
                .in_("property_id", block)
                .lte("start_date", (end - timedelta(days=1)).isoformat())
                .gte("end_date", start.isoformat())
                .order("created_at")
            )
            je_tag: dict[str, dict[str, float]] = defaultdict(dict)
            for z in zuweisungen:
                pid = str(z.get("property_id"))
                saison = saisons.get(str(z.get("season_id")))
                von, bis = _as_date(z.get("start_date")), _as_date(z.get("end_date"))
                if saison is None or von is None or bis is None:
                    continue
                preis = _saisonpreis(saison, basis_je_objekt.get(pid))
                if preis is None:
                    continue
                tag = max(von, start)
                letzter = min(bis, end - timedelta(days=1))
                while tag <= letzter:
                    je_tag[pid][tag.isoformat()] = preis
                    tag += timedelta(days=1)
            for pid, tage in je_tag.items():
                if tage:
                    out[pid] = (min(tage.values()), max(tage.values()), len(tage))
    except Exception as exc:  # noqa: BLE001 — Tabelle fehlt = kein Kalender
        log.warning("saison_untergrenzen_bulk_unlesbar", error=str(exc)[:200])
        return {}
    return out
