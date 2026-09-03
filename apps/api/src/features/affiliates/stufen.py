"""Monatslauf: Rang jedes Partners nach den zahlenden Kunden seiner STRUKTUR.

REGELN (Plan Abschnitt 2, Punkte 4–6; Abschnitt 7 Master-Strategie):
  * Zahlender Kunde = Zuordnung `approved` mit erster bezahlter Rechnung UND
    Abo des Betriebs `active`/`past_due`. Registrierte ohne Zahlung zählen
    nicht (sonst wären Bot-Anmeldungen ein Rang).
  * Für den Rang zählt die STRUKTUR: eigene Kunden PLUS die Kunden ALLER
    Partner darunter, über alle Ebenen (`sponsor_affiliate_id`-Kette,
    Strukturvertrieb seit 03.09.2026 — vorher eine Ebene), 1:1. Ein Kunde
    zählt also bei jedem Partner der Kette über seinem Werber einmal. Das ist
    gewollt (Zettel 3 B „1:1-Anrechnung").
  * Aufstieg SOFORT beim Stichtag. Jeder dabei ERREICHTE Rang mit einem
    Eintrag in `affiliate_tier_bonuses` zahlt einmalig den Aufstiegsbonus —
    auch wenn zwei Ränge in einem Monat übersprungen werden, und nie zweimal
    (UNIQUE (affiliate_id, tier_id) where kind='bonus', 0525).
  * Rückstufung erst, wenn die Zahl an ZWEI Stichtagen in Folge unter dem
    aktuellen Rang lag (`tier_below_since` merkt den ersten) — ein einzelner
    Churn soll den Satz nicht sofort drücken.
  * Der neue Satz gilt nur für Provisionen AB dem Wechsel; verbuchte Zeilen
    behalten ihren Satz (steht an der Zeile, Wurzel 4).

Der Worker ruft `raenge_bewerten` am Monatsersten; mehrfaches Aufrufen am
selben Tag ist unschädlich (der Vergleich ist zustandsbasiert, nicht zählend).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

if TYPE_CHECKING:
    from supabase import Client

    from .mails import PartnerMails

log = get_logger("nextdays.affiliates.stufen")

_ZAHLEND_STATUS = ("active", "past_due")
_UNIQUE_VIOLATION = "23505"
# Erstattungsfenster des Bonus — dasselbe wie für jede andere Zeile (provision.KARENZ_TAGE;
# hier wiederholt, weil provision dieses Modul nicht importieren soll).
BONUS_KARENZ_TAGE = 30


def rang_fuer(anzahl: int, tiers: list[dict[str, Any]]) -> dict[str, Any]:
    """Der Rang, dessen Bereich die Kundenzahl enthält (Bereiche aus 0517)."""
    passend = [
        t
        for t in tiers
        if int(t["min_customers"]) <= anzahl
        and (t.get("max_customers") is None or anzahl <= int(t["max_customers"]))
    ]
    if passend:
        return max(passend, key=lambda t: int(t["min_customers"]))
    # Lücke in der Staffel (Datenfehler) → niedrigster Rang, laut geloggt.
    log.error("partner_staffel_luecke", anzahl=anzahl)
    return min(tiers, key=lambda t: int(t["sort"]))


def zahlende_kunden_je_partner(db: Client) -> dict[str, int]:
    refs = fetch_all_rows(
        db.table("affiliate_referrals")
        .select("affiliate_id, tenant_id, status, first_paid_at")
        .eq("status", "approved")
        .not_.is_("first_paid_at", "null")
    )
    tenant_ids = sorted({r["tenant_id"] for r in refs})
    abo: dict[str, str] = {}
    for i in range(0, len(tenant_ids), 200):
        for s in fetch_all_rows(
            db.table("tenant_subscription")
            .select("tenant_id, status")
            .in_("tenant_id", tenant_ids[i : i + 200])
        ):
            abo[s["tenant_id"]] = str(s.get("status") or "")
    zaehler: dict[str, int] = {}
    for r in refs:
        if abo.get(r["tenant_id"]) in _ZAHLEND_STATUS:
            zaehler[r["affiliate_id"]] = zaehler.get(r["affiliate_id"], 0) + 1
    return zaehler


def struktur_kunden_je_partner(
    db: Client, eigene: dict[str, int] | None = None
) -> dict[str, int]:
    """Eigene zahlende Kunden PLUS die aller Partner darunter, über ALLE Ebenen.

    Partner ohne Team bekommen ihre eigene Zahl; ein Sponsor ohne eigene
    Kunden, dessen Struktur welche hat, steht trotzdem drin. Die Summe je
    Knoten wird einmal berechnet und wiederverwendet (Baum, nicht Pfad-Summe:
    bei 1000 Partnern in 10 Ebenen sind das 1000 Additionen, nicht 10 000).
    Ein Zyklus in der Kette (den der DB-Trigger verbietet) wird laut geloggt
    und dort abgeschnitten, statt endlos zu zählen (Wurzel 8)."""
    eigene = eigene if eigene is not None else zahlende_kunden_je_partner(db)
    kinder: dict[str, list[str]] = {}
    for row in fetch_all_rows(
        db.table("affiliates")
        .select("id, sponsor_affiliate_id")
        .not_.is_("sponsor_affiliate_id", "null")
    ):
        kinder.setdefault(row["sponsor_affiliate_id"], []).append(row["id"])
    summen: dict[str, int] = {}

    def summe(knoten: str, pfad: frozenset[str]) -> int:
        if knoten in summen:
            return summen[knoten]
        if knoten in pfad:
            log.error("partner_struktur_zyklus", affiliate_id=knoten)
            return 0
        gesamt = eigene.get(knoten, 0) + sum(
            summe(k, pfad | {knoten}) for k in kinder.get(knoten, [])
        )
        summen[knoten] = gesamt
        return gesamt

    struktur = dict(eigene)
    for sponsor in kinder:
        struktur[sponsor] = summe(sponsor, frozenset())
    return struktur


def bonus_betraege(db: Client) -> dict[str, list[dict[str, Any]]]:
    """Aufstiegsbonus je Rang: Liste (currency, amount) aus `affiliate_tier_bonuses`."""
    je_rang: dict[str, list[dict[str, Any]]] = {}
    for b in fetch_all_rows(db.table("affiliate_tier_bonuses").select("*")):
        je_rang.setdefault(b["tier_id"], []).append(b)
    return je_rang


def bonus_buchen(
    db: Client,
    *,
    affiliate_id: str,
    tier: dict[str, Any],
    bonus: dict[str, Any],
    jetzt: datetime,
) -> bool:
    """Eine Bonus-Zeile (kind='bonus') für einen erreichten Rang. Idempotent
    über den UNIQUE-Index; False, wenn der Rang schon einmal bezahlt wurde.
    Kein Betrieb, keine Rechnung — referral_id/tenant_id bleiben leer (0525)."""
    betrag = Decimal(str(bonus["amount"]))
    if betrag <= 0:
        return False
    zeile = {
        "referral_id": None,
        "affiliate_id": affiliate_id,
        "tenant_id": None,
        "kind": "bonus",
        "currency": str(bonus["currency"]).upper(),
        "base_amount": "0.00",
        "rate": "0",
        "tier_id": tier["id"],
        "amount": str(betrag),
        "status": "pending",
        "matures_at": (jetzt + timedelta(days=BONUS_KARENZ_TAGE)).isoformat(),
        "period": jetzt.strftime("%Y-%m"),
        "reason": "rank_bonus",
    }
    try:
        db.table("affiliate_commissions").insert(zeile).execute()
    except APIError as exc:
        if getattr(exc, "code", None) == _UNIQUE_VIOLATION:
            log.info("partner_bonus_bereits_gezahlt", affiliate_id=affiliate_id, rang=tier["id"])
            return False
        raise
    log.info(
        "partner_bonus_gebucht",
        affiliate_id=affiliate_id,
        rang=tier["id"],
        betrag=str(betrag),
        currency=zeile["currency"],
    )
    return True


def _erreichte_raenge(
    tiers: list[dict[str, Any]], alt: dict[str, Any], neu: dict[str, Any]
) -> list[dict[str, Any]]:
    """Alle Ränge oberhalb des alten bis einschließlich des neuen — beim Sprung
    über zwei Stufen wird jede einmal erreicht."""
    return [
        t
        for t in tiers
        if int(alt["min_customers"]) < int(t["min_customers"]) <= int(neu["min_customers"])
    ]


def raenge_bewerten(
    db: Client, *, jetzt: datetime | None = None, mails: PartnerMails | None = None
) -> dict[str, int]:
    """Alle freigegebenen Partner einstufen. Gibt Zähler für das Log zurück."""
    jetzt = jetzt or datetime.now(UTC)
    tiers = fetch_all_rows(db.table("affiliate_tiers").select("*").order("sort"))
    if not tiers:
        log.error("partner_staffel_leer", hinweis="affiliate_tiers ist leer — kein Lauf.")
        return {"partner": 0, "aufstieg": 0, "abstieg": 0}
    tier_by_id = {t["id"]: t for t in tiers}
    partner = fetch_all_rows(
        db.table("affiliates")
        .select("id, email, full_name, language, current_tier_id, tier_below_since")
        .eq("status", "approved")
    )
    kunden = struktur_kunden_je_partner(db)
    boni = bonus_betraege(db)
    bilanz = {"partner": len(partner), "aufstieg": 0, "abstieg": 0, "bonus": 0}
    for p in partner:
        anzahl = kunden.get(p["id"], 0)
        aktuell = tier_by_id.get(p["current_tier_id"]) or tiers[0]
        ziel = rang_fuer(anzahl, tiers)
        if ziel["id"] == aktuell["id"]:
            if p.get("tier_below_since"):
                db.table("affiliates").update({"tier_below_since": None}).eq(
                    "id", p["id"]
                ).execute()
            continue
        hoeher = int(ziel["min_customers"]) > int(aktuell["min_customers"])
        if not hoeher:
            # Erster Stichtag darunter → nur merken; zweiter → zurückstufen.
            if not p.get("tier_below_since"):
                db.table("affiliates").update({"tier_below_since": jetzt.isoformat()}).eq(
                    "id", p["id"]
                ).execute()
                log.info("partner_rang_unter_schwelle", affiliate_id=p["id"], anzahl=anzahl)
                continue
        _wechseln(db, p, ziel, anzahl, jetzt)
        bilanz["aufstieg" if hoeher else "abstieg"] += 1
        bonus_text: str | None = None
        if hoeher:
            gezahlt: list[str] = []
            for erreicht in _erreichte_raenge(tiers, aktuell, ziel):
                for b in boni.get(erreicht["id"], []):
                    if bonus_buchen(db, affiliate_id=p["id"], tier=erreicht, bonus=b, jetzt=jetzt):
                        bilanz["bonus"] += 1
                        gezahlt.append(f"{Decimal(str(b['amount'])):.2f} {b['currency']}")
            bonus_text = " + ".join(gezahlt) or None
        if hoeher and mails is not None:
            try:
                mails.rang_erreicht(
                    email=p["email"],
                    name=p.get("full_name") or "",
                    sprache=p.get("language") or "en",
                    rang=ziel["name"],
                    satz_prozent=f"{(Decimal(str(ziel['rate'])) * 100).normalize():f}",
                    bonus=bonus_text,
                )
            except Exception as exc:  # noqa: BLE001 — Mail ist Nebenpfad des Laufs
                log.warning("partner_rang_mail_fehlgeschlagen", error=str(exc)[:200])
    log.info("partner_raenge_bewertet", **bilanz)
    return bilanz


def _wechseln(
    db: Client, p: dict[str, Any], ziel: dict[str, Any], anzahl: int, jetzt: datetime
) -> None:
    db.table("affiliate_tier_history").update({"valid_to": jetzt.isoformat()}).eq(
        "affiliate_id", p["id"]
    ).is_("valid_to", "null").execute()
    db.table("affiliate_tier_history").insert(
        {
            "affiliate_id": p["id"],
            "tier_id": ziel["id"],
            "valid_from": jetzt.isoformat(),
            "paying_customers": anzahl,
            "trigger_kind": "auto",
        }
    ).execute()
    db.table("affiliates").update({"current_tier_id": ziel["id"], "tier_below_since": None}).eq(
        "id", p["id"]
    ).execute()
    log.info(
        "partner_rang_gewechselt",
        affiliate_id=p["id"],
        von=p["current_tier_id"],
        nach=ziel["id"],
        anzahl=anzahl,
    )
