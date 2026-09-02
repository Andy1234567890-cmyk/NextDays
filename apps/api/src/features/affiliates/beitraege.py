"""Beiträge eines Partners (Stufe A der Reichweiten-Etappe, 0521).

Ein Beitrag (Reel, Video, Post) bekommt einen eigenen Link: bestehender Code
plus `utm_content`. Die Marketing-Seite meldet den Klick samt utm an
`/affiliates/clicks` (affiliate_clicks.utm), die Registrierung löst den
Beitrag beim Anlegen der Zuordnung auf (`beitrag_aus_klick` →
affiliate_referrals.post_id). So bleibt „welcher Beitrag brachte den Kunden"
auch dann bekannt, wenn die Klickzeile nach 90 Tagen gelöscht ist.

Scope (Wurzel 3/9): jeder Zugriff läuft über (id, affiliate_id) in EINER
Abfrage — nie laden und danach vergleichen.
"""

from __future__ import annotations

import re
import secrets
import unicodedata
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from postgrest.exceptions import APIError

from src.core.config import Settings
from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from . import video_freigabe
from .fehler import AffiliateError
from .kanaele import PLATTFORMEN, SOCIAL_PLATTFORMEN
from .schemas_reichweite import (
    BackofficeBeitrag,
    BeitragMetrik,
    PartnerBeitrag,
    PartnerBeitragAendern,
    PartnerBeitragAnlegen,
)

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.affiliates")

_UNIQUE_VIOLATION = "23505"
MAX_BEITRAEGE_JE_PARTNER = 500
# Zahlende Kunden wie im Kern des Slice: Zuordnung hat eine erste bezahlte
# Rechnung UND das Abo läuft (past_due = Zahlung nur verzögert).
ZAHLEND_STATUS = ("active", "past_due")


def _rows(res: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    return list(getattr(res, "data", None) or [])


def _ts(wert: str | datetime | None) -> datetime | None:
    if not wert:
        return None
    if isinstance(wert, datetime):
        return wert
    try:
        return datetime.fromisoformat(str(wert).replace("Z", "+00:00"))
    except ValueError:
        return None


# --- Link und utm_content ------------------------------------------------------------


def utm_content_bilden(title: str, published_at: datetime | None) -> str:
    """Lesbarer utm_content aus dem Titel: ascii, klein, Bindestriche.

    Das Datum kommt aus `published_at` (Angabe des Partners) — nicht aus
    unserer Uhr. Ohne Datum sorgt ein kurzes Zufallssuffix für Eindeutigkeit.
    """
    ascii_ = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_.lower()).strip("-")[:40].strip("-")
    suffix = published_at.date().isoformat() if published_at else secrets.token_hex(2)
    return f"{slug}-{suffix}" if slug else f"beitrag-{suffix}"


def link_bauen(
    settings: Settings,
    *,
    code: str,
    platform: str,
    utm_content: str,
    freigegeben: bool = True,
) -> str | None:
    """Fertiger Partner-Link mit utm-Parametern.

    None, wenn die Marketing-Basis fehlt (Wurzel 4: keine geratene Domain) ODER
    das Video des Beitrags nicht freigegeben ist (0523).

    DIE FREIGABE-SPERRE SITZT HIER, nicht in der Oberfläche: der Partner spricht
    dieselbe API an wie sein Dashboard, eine ausgegraute Schaltfläche hält
    niemanden auf, der `GET /affiliates/posts` aufruft (Wurzel 3). Solange nicht
    freigegeben ist, ENTSTEHT der Link gar nicht — es gibt nichts
    zurückzuhalten. `freigegeben` hat den Vorgabewert True, damit Aufrufe ohne
    Beitragszeile (Vorschau eines noch nicht angelegten Beitrags) unverändert
    funktionieren; alle Aufrufe MIT Zeile reichen den echten Stand durch.
    """
    if not freigegeben:
        return None
    basis = (settings.marketing_base_url or "").strip().rstrip("/")
    if not basis:
        log.warning("partner_beitrag_link_ohne_marketing_base_url")
        return None
    medium = "social" if platform in SOCIAL_PLATTFORMEN else "referral"
    return f"{basis}/p/{code}?utm_source={platform}&utm_medium={medium}&utm_content={utm_content}"


# --- Kennzahlen ----------------------------------------------------------------------


def abo_status(db: Client, tenant_ids: list[str]) -> dict[str, str]:
    if not tenant_ids:
        return {}
    rows = fetch_all_rows(
        db.table("tenant_subscription").select("tenant_id, status").in_("tenant_id", tenant_ids)
    )
    return {r["tenant_id"]: str(r.get("status") or "") for r in rows}


def kennzahlen(
    db: Client, posts: list[dict[str, Any]], *, affiliate_ids: list[str]
) -> dict[str, dict[str, Any]]:
    """Je Beitrag: Klicks 30/90 T., Registrierungen, zahlende Kunden, letzter Snapshot.

    Klicks werden über (code_id, utm.utm_content) zugeordnet — die Klickzeile
    kennt den Beitrag nicht, nur seinen Parameter.
    """
    aus: dict[str, dict[str, Any]] = {
        p["id"]: {
            "clicks_30d": 0,
            "clicks_90d": 0,
            "registrations": 0,
            "paying_customers": 0,
            "metrics": None,
        }
        for p in posts
    }
    if not posts:
        return aus
    schluessel = {(p["code_id"], p["utm_content"]): p["id"] for p in posts}
    jetzt = datetime.now(UTC)
    seit_30 = jetzt - timedelta(days=30)
    seit_90 = (jetzt - timedelta(days=90)).isoformat()
    klicks = fetch_all_rows(
        db.table("affiliate_clicks")
        .select("code_id, utm, created_at")
        .in_("affiliate_id", affiliate_ids)
        .gte("created_at", seit_90)
    )
    for k in klicks:
        utm = k.get("utm") or {}
        if not isinstance(utm, dict):
            continue
        post_id = schluessel.get((k["code_id"], str(utm.get("utm_content") or "")))
        if post_id is None:
            continue
        aus[post_id]["clicks_90d"] += 1
        ts = _ts(k.get("created_at"))
        if ts and ts >= seit_30:
            aus[post_id]["clicks_30d"] += 1

    refs = fetch_all_rows(
        db.table("affiliate_referrals")
        .select("post_id, tenant_id, status, first_paid_at")
        .in_("post_id", list(aus))
        .neq("status", "rejected")
    )
    abo = abo_status(db, [r["tenant_id"] for r in refs if r.get("first_paid_at")])
    for r in refs:
        eintrag = aus.get(r.get("post_id") or "")
        if eintrag is None:
            continue
        eintrag["registrations"] += 1
        if (
            r["status"] == "approved"
            and r.get("first_paid_at")
            and abo.get(r["tenant_id"]) in ZAHLEND_STATUS
        ):
            eintrag["paying_customers"] += 1

    metriken = fetch_all_rows(
        db.table("affiliate_post_metrics")
        .select("post_id, measured_at, views, likes, comments, shares, saves")
        .in_("post_id", list(aus))
        .order("measured_at", desc=True)
    )
    for m in metriken:
        eintrag = aus[m["post_id"]]
        if eintrag["metrics"] is None:
            eintrag["metrics"] = BeitragMetrik(
                measured_at=m["measured_at"],
                views=m.get("views"),
                likes=m.get("likes"),
                comments=m.get("comments"),
                shares=m.get("shares"),
                saves=m.get("saves"),
            )
    return aus


def _objekt(
    settings: Settings, row: dict[str, Any], code: str, zahlen: dict[str, Any]
) -> PartnerBeitrag:
    metrik: BeitragMetrik | None = zahlen.get("metrics")
    pro_1000 = None
    if metrik and metrik.views:
        pro_1000 = round(zahlen["clicks_90d"] / metrik.views * 1000, 2)
    return PartnerBeitrag(
        id=row["id"],
        code_id=row["code_id"],
        code=code,
        platform=row["platform"],
        url=row.get("url"),
        title=row["title"],
        utm_content=row["utm_content"],
        link=link_bauen(
            settings,
            code=code,
            platform=row["platform"],
            utm_content=row["utm_content"],
            freigegeben=video_freigabe.link_erlaubt(row),
        ),
        review_status=row.get("review_status") or "draft",
        review_reason_code=row.get("review_reason_code"),
        review_note=row.get("review_note"),
        video_vorhanden=bool(row.get("video_path")),
        video_uploaded_at=row.get("video_uploaded_at"),
        published_at=row.get("published_at"),
        created_at=row["created_at"],
        clicks_30d=zahlen["clicks_30d"],
        clicks_90d=zahlen["clicks_90d"],
        registrations=zahlen["registrations"],
        paying_customers=zahlen["paying_customers"],
        metrics=metrik,
        clicks_per_1000_views=pro_1000,
    )


def _codes(db: Client, code_ids: list[str]) -> dict[str, str]:
    if not code_ids:
        return {}
    rows = _rows(
        db.table("affiliate_referral_codes").select("id, code").in_("id", code_ids).execute()
    )
    return {r["id"]: r["code"] for r in rows}


def objekte(db: Client, settings: Settings, posts: list[dict[str, Any]]) -> list[PartnerBeitrag]:
    if not posts:
        return []
    codes = _codes(db, sorted({p["code_id"] for p in posts}))
    zahlen = kennzahlen(db, posts, affiliate_ids=sorted({p["affiliate_id"] for p in posts}))
    return [_objekt(settings, p, codes.get(p["code_id"], "?"), zahlen[p["id"]]) for p in posts]


# --- Partner: anlegen, ändern, lesen -------------------------------------------------


def _own_code(db: Client, *, affiliate_id: str, code_id: str) -> dict[str, Any]:
    rows = _rows(
        db.table("affiliate_referral_codes")
        .select("id, code, active")
        .eq("id", code_id)
        .eq("affiliate_id", affiliate_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise AffiliateError("Code nicht gefunden.", status_code=404)
    if not rows[0].get("active", True):
        raise AffiliateError("Dieser Code ist deaktiviert.", status_code=422)
    return rows[0]


def _own_post(db: Client, *, affiliate_id: str, post_id: str) -> dict[str, Any]:
    rows = _rows(
        db.table("affiliate_posts")
        .select("*")
        .eq("id", post_id)
        .eq("affiliate_id", affiliate_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise AffiliateError("Beitrag nicht gefunden.", status_code=404)
    return rows[0]


def anlegen(
    db: Client,
    settings: Settings,
    *,
    affiliate_id: str,
    code_id: str,
    req: PartnerBeitragAnlegen,
) -> PartnerBeitrag:
    _own_code(db, affiliate_id=affiliate_id, code_id=code_id)
    if req.platform not in PLATTFORMEN:
        raise AffiliateError("Plattform unbekannt.", status_code=422)
    anzahl = (
        db.table("affiliate_posts")
        .select("id", count="exact")
        .eq("affiliate_id", affiliate_id)
        .limit(1)
        .execute()
    ).count or 0
    if anzahl >= MAX_BEITRAEGE_JE_PARTNER:
        raise AffiliateError(
            f"Höchstens {MAX_BEITRAEGE_JE_PARTNER} Beiträge je Partner.", status_code=422
        )
    utm_content = req.utm_content or utm_content_bilden(req.title, req.published_at)
    zeile = {
        "affiliate_id": affiliate_id,
        "code_id": code_id,
        "platform": req.platform,
        "url": req.url,
        "title": req.title,
        "utm_content": utm_content,
        "published_at": req.published_at.isoformat() if req.published_at else None,
    }
    for versuch in range(3):
        try:
            res = db.table("affiliate_posts").insert(zeile).execute()
            break
        except APIError as exc:
            if getattr(exc, "code", None) != _UNIQUE_VIOLATION:
                raise
            if req.utm_content or versuch == 2:
                raise AffiliateError(
                    "Diesen utm_content gibt es für den Code schon.", status_code=409
                ) from exc
            zeile["utm_content"] = f"{utm_content}-{secrets.token_hex(2)}"
    rows = _rows(res)
    if not rows:
        raise AffiliateError("Beitrag konnte nicht angelegt werden.", status_code=500)
    log.info(
        "partner_beitrag_angelegt",
        affiliate_id=affiliate_id,
        post_id=rows[0]["id"],
        platform=req.platform,
    )
    return objekte(db, settings, [{**rows[0], "code_id": code_id, "affiliate_id": affiliate_id}])[0]


def aendern(
    db: Client,
    settings: Settings,
    *,
    affiliate_id: str,
    post_id: str,
    req: PartnerBeitragAendern,
) -> PartnerBeitrag:
    vorher = _own_post(db, affiliate_id=affiliate_id, post_id=post_id)
    updates = req.model_dump(exclude_unset=True)
    if updates.get("published_at") is not None:
        updates["published_at"] = updates["published_at"].isoformat()
    if "url" in updates and updates["url"] != vorher.get("url"):
        # Neue Adresse → die Plattform-Kennung muss neu gefunden werden.
        updates["external_post_id"] = None
    if not updates:
        return objekte(db, settings, [vorher])[0]
    res = (
        db.table("affiliate_posts")
        .update(updates)
        .eq("id", post_id)
        .eq("affiliate_id", affiliate_id)
        .execute()
    )
    rows = _rows(res)
    if not rows:
        raise AffiliateError("Beitrag nicht gefunden.", status_code=404)
    return objekte(db, settings, rows)[0]


def loeschen(db: Client, *, affiliate_id: str, post_id: str) -> None:
    """Löschen nur, solange keine Registrierung daran hängt — sonst verlöre die
    Zuordnung ihren Beitrag (FK set null wäre stiller Datenverlust)."""
    _own_post(db, affiliate_id=affiliate_id, post_id=post_id)
    refs = (
        db.table("affiliate_referrals")
        .select("id", count="exact")
        .eq("post_id", post_id)
        .limit(1)
        .execute()
    ).count or 0
    if refs:
        raise AffiliateError(
            "Beitrag hat bereits Registrierungen und kann nicht gelöscht werden.",
            status_code=409,
        )
    db.table("affiliate_posts").delete().eq("id", post_id).eq(
        "affiliate_id", affiliate_id
    ).execute()
    log.info("partner_beitrag_geloescht", affiliate_id=affiliate_id, post_id=post_id)


def liste(db: Client, settings: Settings, *, affiliate_id: str) -> list[PartnerBeitrag]:
    rows = fetch_all_rows(
        db.table("affiliate_posts")
        .select("*")
        .eq("affiliate_id", affiliate_id)
        .order("created_at", desc=True)
    )
    return objekte(db, settings, rows)


def eigener(db: Client, settings: Settings, *, affiliate_id: str, post_id: str) -> PartnerBeitrag:
    return objekte(db, settings, [_own_post(db, affiliate_id=affiliate_id, post_id=post_id)])[0]


# --- Hook für die Zuordnung (attribution.zuordnen) ----------------------------------------


def beitrag_aus_klick(db: Client, *, code_id: str, utm: dict[str, Any] | None) -> str | None:
    """Beitrag zu einem Klick: (code_id, utm_content) → post_id oder None."""
    if not isinstance(utm, dict):
        return None
    utm_content = str(utm.get("utm_content") or "").strip()
    if not utm_content:
        return None
    rows = _rows(
        db.table("affiliate_posts")
        .select("id")
        .eq("code_id", code_id)
        .eq("utm_content", utm_content)
        .limit(1)
        .execute()
    )
    return rows[0]["id"] if rows else None


# --- Backoffice ----------------------------------------------------------------------------


def _partner_namen(db: Client, ids: list[str]) -> dict[str, str]:
    if not ids:
        return {}
    rows = _rows(db.table("affiliates").select("id, full_name, company").in_("id", ids).execute())
    return {r["id"]: r.get("company") or r["full_name"] for r in rows}


def bo_objekte(
    db: Client, settings: Settings, posts: list[dict[str, Any]]
) -> list[BackofficeBeitrag]:
    if not posts:
        return []
    namen = _partner_namen(db, sorted({p["affiliate_id"] for p in posts}))
    return [
        BackofficeBeitrag(
            **b.model_dump(),
            affiliate_id=p["affiliate_id"],
            partner_name=namen.get(p["affiliate_id"], "?"),
        )
        for b, p in zip(objekte(db, settings, posts), posts, strict=True)
    ]


def bo_liste(db: Client, settings: Settings, *, affiliate_id: str) -> list[BackofficeBeitrag]:
    rows = fetch_all_rows(
        db.table("affiliate_posts")
        .select("*")
        .eq("affiliate_id", affiliate_id)
        .order("created_at", desc=True)
    )
    return bo_objekte(db, settings, rows)


def bo_top(db: Client, settings: Settings, *, limit: int = 20) -> list[BackofficeBeitrag]:
    """Top-Beiträge programmweit: zahlende Kunden, dann Registrierungen, dann Klicks."""
    rows = fetch_all_rows(db.table("affiliate_posts").select("*").order("created_at", desc=True))
    alle = bo_objekte(db, settings, rows)
    alle.sort(
        key=lambda b: (
            -b.paying_customers,
            -b.registrations,
            -b.clicks_90d,
            -(b.metrics.views or 0) if b.metrics else 0,
        )
    )
    return alle[:limit]


def zaehler_je_partner(db: Client, ids: list[str]) -> dict[str, int]:
    if not ids:
        return {}
    rows = fetch_all_rows(
        db.table("affiliate_posts").select("affiliate_id").in_("affiliate_id", ids)
    )
    aus: dict[str, int] = defaultdict(int)
    for r in rows:
        aus[r["affiliate_id"]] += 1
    return dict(aus)
