"""Auswertung und Verdachtsprüfung der Reichweite (Stufe C, 0521).

Führt zusammen, was getrennt entsteht: Selbstauskunft (`affiliates.channels`),
Quelldaten (`affiliate_channel_snapshots`, `affiliate_post_metrics`) und unsere
Messung (Klicks, Registrierungen, zahlende Kunden). Verifiziert und
Selbstauskunft werden IMMER getrennt ausgegeben — die Summe „Reichweite" ohne
diese Trennung wäre eine Zahl, der niemand ansieht, wie viel davon geprüft ist.

Flags sind Hinweise für die manuelle Entscheidung, keine Sperre. Ihre
Schwellen sind Daten (`affiliate_reach_thresholds`, Wurzel 4); `value NULL`
schaltet eine Regel ab. Jeder Flag nennt Messwert UND Schwelle, damit das
Backoffice die Entscheidung nachvollziehen kann.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from src.core.config import Settings
from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from . import beitraege
from .fehler import AffiliateError
from .kanaele import plattform_aus_url
from .schemas_reichweite import (
    PROVIDER_JE_PLATTFORM,
    BackofficeBeitrag,
    BackofficeReichweite,
    BackofficeReichweiteSummary,
    FollowerTag,
    KanalReichweite,
    PartnerBeitrag,
    PartnerReichweite,
    ReichweiteFlag,
    ReichweiteSchwelle,
    ReichweiteTopKanal,
)

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.affiliates.reichweite")

VERLAUF_TAGE = 90
SPRUNG_TAGE = 7


def _rows(res: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    return list(getattr(res, "data", None) or [])


def _ts(wert: Any) -> datetime | None:  # noqa: ANN401
    if not wert:
        return None
    if isinstance(wert, datetime):
        return wert
    try:
        return datetime.fromisoformat(str(wert).replace("Z", "+00:00"))
    except ValueError:
        return None


def _f(wert: Any) -> float | None:  # noqa: ANN401
    if wert is None:
        return None
    try:
        return float(wert)
    except (TypeError, ValueError):
        return None


# --- Schwellen ------------------------------------------------------------------------


def schwellen(db: Client) -> dict[str, float | None]:
    rows = _rows(db.table("affiliate_reach_thresholds").select("key, value").execute())
    if not rows:
        # Tabelle leer = Migration nicht eingespielt. Laut, und keine Regel aktiv
        # — erfundene Standardwerte wären Wurzel 4.
        log.error(
            "affiliate_reach_thresholds_leer",
            hinweis="0521 einspielen — keine Verdachtsregel aktiv.",
        )
    return {r["key"]: _f(r.get("value")) for r in rows}


def schwellen_liste(db: Client) -> list[ReichweiteSchwelle]:
    rows = _rows(db.table("affiliate_reach_thresholds").select("*").order("key").execute())
    return [
        ReichweiteSchwelle(
            key=r["key"],
            value=_f(r.get("value")),
            description=r["description"],
            updated_at=r["updated_at"],
        )
        for r in rows
    ]


def schwelle_setzen(db: Client, *, key: str, value: float | None) -> ReichweiteSchwelle:
    res = (
        db.table("affiliate_reach_thresholds")
        .update({"value": value, "updated_at": datetime.now(UTC).isoformat()})
        .eq("key", key)
        .execute()
    )
    rows = _rows(res)
    if not rows:
        raise AffiliateError("Schwelle unbekannt.", status_code=404)
    log.info("affiliate_reach_threshold_gesetzt", key=key, value=value)
    r = rows[0]
    return ReichweiteSchwelle(
        key=r["key"],
        value=_f(r.get("value")),
        description=r["description"],
        updated_at=r["updated_at"],
    )


# --- Kanäle eines Partners -----------------------------------------------------------------


def _klicks_je_plattform(
    db: Client, affiliate_id: str, *, jetzt: datetime
) -> dict[str, dict[str, int]]:
    """Plattform → {28: n, 90: n}. Quelle: utm_source (unsere Beitragslinks) oder
    der Referrer-Host (plattform_aus_url) — sonst 'unbekannt'."""
    seit_90 = jetzt - timedelta(days=90)
    seit_28 = jetzt - timedelta(days=28)
    rows = fetch_all_rows(
        db.table("affiliate_clicks")
        .select("referrer, utm, created_at")
        .eq("affiliate_id", affiliate_id)
        .gte("created_at", seit_90.isoformat())
    )
    aus: dict[str, dict[str, int]] = defaultdict(lambda: {28: 0, 90: 0})
    for k in rows:
        utm = k.get("utm") or {}
        plattform = str(utm.get("utm_source") or "") if isinstance(utm, dict) else ""
        if not plattform and k.get("referrer"):
            plattform = plattform_aus_url(str(k["referrer"])) or ""
        plattform = plattform or "unbekannt"
        aus[plattform][90] += 1
        ts = _ts(k.get("created_at"))
        if ts and ts >= seit_28:
            aus[plattform][28] += 1
    return aus


def _snapshots(
    db: Client, affiliate_id: str, *, jetzt: datetime
) -> dict[str, list[dict[str, Any]]]:
    seit = (jetzt - timedelta(days=VERLAUF_TAGE)).date().isoformat()
    rows = fetch_all_rows(
        db.table("affiliate_channel_snapshots")
        .select(
            "connection_id, snapshot_date, measured_at, followers, views_28d, "
            "engagement_rate, posts_count"
        )
        .eq("affiliate_id", affiliate_id)
        .gte("snapshot_date", seit)
        .order("snapshot_date")
    )
    aus: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        aus[r["connection_id"]].append(r)
    return aus


def _deviation(selbst: int | None, verifiziert: int | None) -> float | None:
    if selbst is None or not verifiziert:
        return None
    return round((selbst - verifiziert) / verifiziert * 100, 1)


def kanaele(
    db: Client, *, affiliate_id: str, jetzt: datetime | None = None
) -> list[KanalReichweite]:
    """Alle Kanäle des Partners: Selbstauskunft neben verifizierten Werten."""
    jetzt = jetzt or datetime.now(UTC)
    partner = _rows(
        db.table("affiliates").select("id, channels").eq("id", affiliate_id).limit(1).execute()
    )
    if not partner:
        raise AffiliateError("Partner nicht gefunden.", status_code=404)
    eintraege = [k for k in (partner[0].get("channels") or []) if isinstance(k, dict)]
    verbindungen = fetch_all_rows(
        db.table("affiliate_channel_connections")
        .select("id, platform, account_name, account_url, revoked_at, last_error")
        .eq("affiliate_id", affiliate_id)
        .order("connected_at")
    )
    je_id = {v["id"]: v for v in verbindungen}
    snaps = _snapshots(db, affiliate_id, jetzt=jetzt)
    klicks = _klicks_je_plattform(db, affiliate_id, jetzt=jetzt)

    aus: list[KanalReichweite] = []
    for k in eintraege:
        conn = je_id.get(str(k.get("connection_id") or ""))
        verlauf = snaps.get(conn["id"], []) if conn else []
        letzter = verlauf[-1] if verlauf else None
        verified = bool(k.get("verified")) and conn is not None and not conn.get("revoked_at")
        selbst = (
            k.get("followers_self_reported")
            if "followers_self_reported" in k
            else k.get("followers")
        )
        verifiziert = letzter.get("followers") if (verified and letzter) else None
        plattform = str(k.get("platform") or "other")
        kl = klicks.get(plattform, {28: 0, 90: 0})
        views = letzter.get("views_28d") if (verified and letzter) else None
        aus.append(
            KanalReichweite(
                platform=plattform,
                account_name=(conn or {}).get("account_name") or k.get("handle"),
                account_url=(conn or {}).get("account_url") or k.get("url"),
                verified=verified,
                followers_verified=verifiziert,
                followers_self_reported=selbst if selbst is not None else None,
                deviation_pct=_deviation(selbst, verifiziert),
                views_28d=views,
                engagement_rate=_f(letzter.get("engagement_rate"))
                if (verified and letzter)
                else None,
                posts_count=letzter.get("posts_count") if (verified and letzter) else None,
                measured_at=letzter.get("measured_at") if (verified and letzter) else None,
                follower_history=[
                    FollowerTag(day=str(s["snapshot_date"]), followers=s.get("followers"))
                    for s in verlauf
                ],
                clicks_28d=kl[28],
                clicks_90d=kl[90],
                clicks_per_1000_views=round(kl[28] / views * 1000, 2) if views else None,
                revoked_at=(conn or {}).get("revoked_at"),
                last_error=(conn or {}).get("last_error"),
            )
        )
    # Verbindungen, die (noch) keinem Kanaleintrag zugeordnet sind — z. B.
    # widerrufen, bevor der Abgleich lief — bleiben sichtbar.
    bekannt = {str(k.get("connection_id")) for k in eintraege if k.get("connection_id")}
    for v in verbindungen:
        if v["id"] in bekannt or not v.get("revoked_at"):
            continue
        verlauf = snaps.get(v["id"], [])
        aus.append(
            KanalReichweite(
                platform=v["platform"],
                account_name=v.get("account_name"),
                account_url=v.get("account_url"),
                verified=False,
                followers_verified=None,
                followers_self_reported=None,
                deviation_pct=None,
                views_28d=None,
                engagement_rate=None,
                posts_count=None,
                measured_at=None,
                follower_history=[
                    FollowerTag(day=str(s["snapshot_date"]), followers=s.get("followers"))
                    for s in verlauf
                ],
                clicks_28d=0,
                clicks_90d=0,
                clicks_per_1000_views=None,
                revoked_at=v.get("revoked_at"),
                last_error=v.get("last_error"),
            )
        )
    return aus


# --- Flags ------------------------------------------------------------------------------------


def _sprung(verlauf: list[FollowerTag], *, tage: int) -> tuple[float | None, int | None]:
    """Prozentualer Follower-Zuwachs gegenüber dem Snapshot vor `tage` Tagen."""
    mit_wert = [t for t in verlauf if t.followers is not None]
    if len(mit_wert) < 2:
        return None, None
    letzter = mit_wert[-1]
    grenze = (datetime.fromisoformat(letzter.day) - timedelta(days=tage)).date().isoformat()
    frueher = [t for t in mit_wert if t.day <= grenze]
    basis = frueher[-1] if frueher else None
    if basis is None or not basis.followers:
        return None, None
    return round(
        (letzter.followers - basis.followers) / basis.followers * 100, 1
    ), letzter.followers  # type: ignore[operator]


def flags_bestimmen(
    kanaele_: list[KanalReichweite], posts: list[PartnerBeitrag], grenzen: dict[str, float | None]
) -> list[ReichweiteFlag]:
    aus: list[ReichweiteFlag] = []
    g = grenzen

    for k in kanaele_:
        if not k.verified:
            # Abweichung braucht beide Werte; die übrigen Regeln brauchen Quelldaten.
            continue
        name = k.account_name or k.platform
        sprung_pct, follower = _sprung(k.follower_history, tage=SPRUNG_TAGE)
        if (
            g.get("follower_jump_pct_7d") is not None
            and sprung_pct is not None
            and follower is not None
            and follower >= (g.get("follower_jump_min_followers") or 0)
            and sprung_pct > g["follower_jump_pct_7d"]  # type: ignore[operator]
        ):
            aus.append(
                ReichweiteFlag(
                    key="follower_jump",
                    subject=f"{k.platform}: {name}",
                    value=sprung_pct,
                    threshold=g["follower_jump_pct_7d"],  # type: ignore[arg-type]
                    detail=(
                        f"+{sprung_pct} % Follower in {SPRUNG_TAGE} Tagen; Views 28 T.: "
                        f"{k.views_28d if k.views_28d is not None else '—'}"
                    ),
                )
            )
        if (
            g.get("low_engagement_rate_pct") is not None
            and k.engagement_rate is not None
            and k.followers_verified is not None
            and k.followers_verified >= (g.get("low_engagement_min_followers") or 0)
            and k.engagement_rate * 100 < g["low_engagement_rate_pct"]  # type: ignore[operator]
        ):
            aus.append(
                ReichweiteFlag(
                    key="low_engagement",
                    subject=f"{k.platform}: {name}",
                    value=round(k.engagement_rate * 100, 2),
                    threshold=g["low_engagement_rate_pct"],  # type: ignore[arg-type]
                    detail=(
                        f"Engagement {round(k.engagement_rate * 100, 2)} % "
                        f"bei {k.followers_verified} Followern"
                    ),
                )
            )
        if g.get("self_report_deviation_pct") is not None and k.deviation_pct is not None:
            if abs(k.deviation_pct) > g["self_report_deviation_pct"]:  # type: ignore[operator]
                aus.append(
                    ReichweiteFlag(
                        key="self_report_deviation",
                        subject=f"{k.platform}: {name}",
                        value=k.deviation_pct,
                        threshold=g["self_report_deviation_pct"],  # type: ignore[arg-type]
                        detail=(
                            f"Selbstauskunft {k.followers_self_reported} "
                            f"vs. verifiziert {k.followers_verified}"
                        ),
                    )
                )

    grenze_views = g.get("views_without_click_min")
    if grenze_views is not None:
        for p in posts:
            views = p.metrics.views if p.metrics else None
            if views is not None and views >= grenze_views and p.clicks_90d == 0:
                aus.append(
                    ReichweiteFlag(
                        key="views_without_click",
                        subject=f"{p.platform}: {p.title}",
                        value=float(views),
                        threshold=grenze_views,
                        detail=f"{views} Views, 0 Klicks in 90 Tagen",
                    )
                )
    return aus


# --- Sichten ----------------------------------------------------------------------------------


def partner_sicht(db: Client, settings: Settings, *, affiliate_id: str) -> PartnerReichweite:
    """Eigene Werte des Partners — ohne Flags (die sind Backoffice-Hinweise)."""
    return PartnerReichweite(
        channels=kanaele(db, affiliate_id=affiliate_id),
        posts=beitraege.liste(db, settings, affiliate_id=affiliate_id),
    )


def bo_partner(db: Client, settings: Settings, *, affiliate_id: str) -> BackofficeReichweite:
    kan = kanaele(db, affiliate_id=affiliate_id)
    posts = beitraege.bo_liste(db, settings, affiliate_id=affiliate_id)
    return BackofficeReichweite(
        channels=kan,
        reach_verified=sum(k.followers_verified or 0 for k in kan if k.verified),
        reach_self_reported=sum(k.followers_self_reported or 0 for k in kan),
        flags=flags_bestimmen(kan, posts, schwellen(db)),
        posts=posts,
    )


def _kunden_je_plattform(db: Client, affiliate_ids: list[str]) -> dict[tuple[str, str], int]:
    """(affiliate_id, platform) → zahlende Kunden, die über einen Beitrag dieser
    Plattform kamen. Kunden ohne Beitrag zählen hier nicht — sie lassen sich
    keinem Kanal zuordnen, und Raten wäre Wurzel 4."""
    if not affiliate_ids:
        return {}
    refs = fetch_all_rows(
        db.table("affiliate_referrals")
        .select("affiliate_id, tenant_id, post_id, status, first_paid_at")
        .in_("affiliate_id", affiliate_ids)
        .eq("status", "approved")
        .not_.is_("post_id", "null")
    )
    refs = [r for r in refs if r.get("first_paid_at")]
    if not refs:
        return {}
    posts = _rows(
        db.table("affiliate_posts")
        .select("id, platform")
        .in_("id", sorted({r["post_id"] for r in refs}))
        .execute()
    )
    plattform_je_post = {p["id"]: p["platform"] for p in posts}
    abo = beitraege.abo_status(db, [r["tenant_id"] for r in refs])
    aus: dict[tuple[str, str], int] = defaultdict(int)
    for r in refs:
        if (
            abo.get(r["tenant_id"]) in beitraege.ZAHLEND_STATUS
            and r["post_id"] in plattform_je_post
        ):
            aus[(r["affiliate_id"], plattform_je_post[r["post_id"]])] += 1
    return dict(aus)


def bo_summary(db: Client, settings: Settings) -> BackofficeReichweiteSummary:
    partner = fetch_all_rows(
        db.table("affiliates").select("id, full_name, company, status, channels")
    )
    verbindungen = fetch_all_rows(
        db.table("affiliate_channel_connections").select(
            "id, affiliate_id, platform, account_name, revoked_at"
        )
    )
    aktive = [v for v in verbindungen if not v.get("revoked_at")]
    snaps: dict[str, dict[str, Any]] = {}
    if aktive:
        for r in fetch_all_rows(
            db.table("affiliate_channel_snapshots")
            .select("connection_id, followers")
            .in_("connection_id", [v["id"] for v in aktive])
            .order("measured_at", desc=True)
        ):
            snaps.setdefault(r["connection_id"], r)

    reach_verified = sum((snaps.get(v["id"]) or {}).get("followers") or 0 for v in aktive)
    reach_self = 0
    for p in partner:
        for k in p.get("channels") or []:
            if not isinstance(k, dict):
                continue
            wert = k.get("followers_self_reported") if k.get("verified") else k.get("followers")
            reach_self += int(wert or 0)

    namen = {p["id"]: p.get("company") or p["full_name"] for p in partner}
    kunden = _kunden_je_plattform(db, sorted({v["affiliate_id"] for v in aktive}))
    top: list[ReichweiteTopKanal] = []
    for v in aktive:
        follower = (snaps.get(v["id"]) or {}).get("followers") or 0
        if follower <= 0:
            continue
        k = kunden.get((v["affiliate_id"], v["platform"]), 0)
        top.append(
            ReichweiteTopKanal(
                affiliate_id=v["affiliate_id"],
                partner_name=namen.get(v["affiliate_id"], "?"),
                platform=v["platform"],
                followers=follower,
                paying_customers=k,
                customers_per_1000_followers=round(k / follower * 1000, 3),
            )
        )
    top.sort(key=lambda t: (-t.customers_per_1000_followers, -t.followers))

    flags_total = 0
    grenzen = schwellen(db)
    for aid in sorted({v["affiliate_id"] for v in aktive}):
        kan = kanaele(db, affiliate_id=aid)
        flags_total += len(
            flags_bestimmen(kan, beitraege.liste(db, settings, affiliate_id=aid), grenzen)
        )

    return BackofficeReichweiteSummary(
        reach_verified=reach_verified,
        reach_self_reported=reach_self,
        connections_active=len(aktive),
        connections_revoked=len(verbindungen) - len(aktive),
        partners_with_connection=len({v["affiliate_id"] for v in aktive}),
        flags_total=flags_total,
        top_channels=top[:10],
        top_posts=beitraege.bo_top(db, settings, limit=10),
    )


def verifizierbar(plattform: str) -> bool:
    return plattform in PROVIDER_JE_PLATTFORM


__all__ = [
    "BackofficeBeitrag",
    "bo_partner",
    "bo_summary",
    "flags_bestimmen",
    "kanaele",
    "partner_sicht",
    "schwelle_setzen",
    "schwellen",
    "schwellen_liste",
    "verifizierbar",
]
