"""Tracking (Aufrufe, Reichweite, Team-Kennzahlen, Betrugsflags) — Mixin des
AffiliatesService (Ausgliederung wegen der 1500-Zeilen-Grenze)."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from src.core.supabase import fetch_all_rows

from .kanaele import kanaele_aus_zeile
from .schemas import (
    BackofficeTracking,
    BackofficeTrackingSummary,
    SocialKanal,
    TrackingCode,
    TrackingQuelle,
    TrackingReichweite,
    TrackingTag,
)
from .team_service import _summe

if TYPE_CHECKING:
    from supabase import Client


_ZAHLEND_STATUS = ("active", "past_due")


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


def _host(url: str | None) -> str | None:
    if not url:
        return None
    from urllib.parse import urlsplit  # noqa: PLC0415

    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else (host or None)


def _reichweite(row: dict[str, Any]) -> int:
    """Summe der Follower über alle Kanäle (Selbstauskunft, 0 wenn nichts angegeben)."""
    return sum(
        int(k.get("followers") or 0) for k in (row.get("channels") or []) if isinstance(k, dict)
    )


def _top(zaehler: dict[str, int]) -> list[TrackingQuelle]:
    return [
        TrackingQuelle(name=n, clicks=c)
        for n, c in sorted(zaehler.items(), key=lambda x: -x[1])[:8]
    ]


class TrackingMixin:  # pylint: disable=too-few-public-methods
    """Braucht vom Host: _db, _bo_row, zahlende_kunden, _abo_status,
    _team_mitglieder, _team_zeilen."""

    _db: Client

    def _bo_row(self, affiliate_id: str) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError

    def zahlende_kunden(self, affiliate_id: str) -> int:  # pragma: no cover
        raise NotImplementedError

    def _abo_status(self, tenant_ids: list[str]) -> dict[str, str]:  # pragma: no cover
        raise NotImplementedError

    def _team_mitglieder(self, affiliate_id: str) -> list[dict[str, Any]]:  # pragma: no cover
        raise NotImplementedError

    def _team_zeilen(
        self, sponsor_id: str, mitglieder: list[str]
    ) -> tuple[list, list]:  # pragma: no cover
        raise NotImplementedError

    # --- Tracking: Aufrufe und Reichweite ----------------------------------------

    def bo_tracking(self, affiliate_id: str) -> BackofficeTracking:
        row = self._bo_row(affiliate_id)
        jetzt = datetime.now(UTC)
        seit_90, seit_30, seit_7 = (jetzt - timedelta(days=d) for d in (90, 30, 7))
        klicks = fetch_all_rows(
            self._db.table("affiliate_clicks")
            .select("id, code_id, referrer, utm, created_at")
            .eq("affiliate_id", affiliate_id)
            .gte("created_at", seit_90.isoformat())
        )
        codes = _rows(
            self._db.table("affiliate_referral_codes")
            .select("id, code, label, active")
            .eq("affiliate_id", affiliate_id)
            .order("created_at")
            .execute()
        )
        refs = fetch_all_rows(
            self._db.table("affiliate_referrals")
            .select("code_id, status, created_at")
            .eq("affiliate_id", affiliate_id)
            .neq("status", "rejected")
        )

        je_tag: dict[str, int] = defaultdict(int)
        je_code_30: dict[str, int] = defaultdict(int)
        je_code_90: dict[str, int] = defaultdict(int)
        referrer: dict[str, int] = defaultdict(int)
        quellen: dict[str, int] = defaultdict(int)
        n7 = n30 = 0
        for k in klicks:
            ts = _ts(k["created_at"])
            if ts is None:
                continue
            je_code_90[k["code_id"]] += 1
            if ts >= seit_30:
                n30 += 1
                je_code_30[k["code_id"]] += 1
                je_tag[ts.date().isoformat()] += 1
            if ts >= seit_7:
                n7 += 1
            referrer[_host(k.get("referrer")) or "direkt"] += 1
            utm = k.get("utm") or {}
            if isinstance(utm, dict) and utm.get("utm_source"):
                quellen[str(utm["utm_source"])[:60]] += 1

        reg_je_code: dict[str, int] = defaultdict(int)
        reg_30 = reg_90 = 0
        for r in refs:
            if r.get("code_id"):
                reg_je_code[r["code_id"]] += 1
            ts = _ts(r.get("created_at"))
            if ts and ts >= seit_30:
                reg_30 += 1
            if ts and ts >= seit_90:
                reg_90 += 1
        n90 = len(klicks)
        tage = [(jetzt - timedelta(days=i)).date().isoformat() for i in range(29, -1, -1)]
        kanaele: list[SocialKanal] = kanaele_aus_zeile(row, SocialKanal)
        mitglieder = self._team_mitglieder(affiliate_id)
        ertraege, overrides = self._team_zeilen(affiliate_id, [m["id"] for m in mitglieder])
        s30, s90 = seit_30.isoformat(), seit_90.isoformat()
        flag_zaehler: dict[str, int] = defaultdict(int)
        for r in fetch_all_rows(
            self._db.table("affiliate_referrals").select("flags").eq("affiliate_id", affiliate_id)
        ):
            for f in r.get("flags") or []:
                flag_zaehler[str(f)] += 1
        return BackofficeTracking(
            team_size=len(mitglieder),
            team_revenue_30d=_summe(
                [e for e in ertraege if str(e["created_at"]) >= s30], "base_amount"
            ),
            team_revenue_90d=_summe(
                [e for e in ertraege if str(e["created_at"]) >= s90], "base_amount"
            ),
            override_30d=_summe([o for o in overrides if str(o["created_at"]) >= s30]),
            override_90d=_summe([o for o in overrides if str(o["created_at"]) >= s90]),
            sponsor_flags=list(row.get("sponsor_flags") or []),
            referral_flags=[
                TrackingQuelle(name=n, clicks=c)
                for n, c in sorted(flag_zaehler.items(), key=lambda x: -x[1])
            ],
            clicks_7d=n7,
            clicks_30d=n30,
            clicks_90d=n90,
            clicks_by_day=[TrackingTag(day=t, clicks=je_tag.get(t, 0)) for t in tage],
            codes=[
                TrackingCode(
                    code=c["code"],
                    label=c.get("label"),
                    active=bool(c.get("active", True)),
                    clicks_30d=je_code_30.get(c["id"], 0),
                    clicks_90d=je_code_90.get(c["id"], 0),
                    registrations=reg_je_code.get(c["id"], 0),
                )
                for c in codes
            ],
            referrers=_top(referrer),
            utm_sources=_top(quellen),
            registrations=len(refs),
            registrations_30d=reg_30,
            paying_customers=self.zahlende_kunden(affiliate_id),
            conversion_90d=round(reg_90 / n90, 4) if n90 else None,
            reach_total=sum(k.followers or 0 for k in kanaele),
            reach=[
                TrackingReichweite(
                    platform=k.platform, url=k.url, handle=k.handle, followers=k.followers
                )
                for k in kanaele
            ],
        )

    def bo_tracking_summary(self) -> BackofficeTrackingSummary:
        partner = fetch_all_rows(self._db.table("affiliates").select("id, status, channels"))
        seit_30 = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        klicks = (
            self._db.table("affiliate_clicks")
            .select("id", count="exact")
            .gte("created_at", seit_30)
            .limit(1)
            .execute()
        )
        refs = fetch_all_rows(
            self._db.table("affiliate_referrals")
            .select("tenant_id, status, created_at, first_paid_at")
            .neq("status", "rejected")
        )
        abo = self._abo_status([r["tenant_id"] for r in refs if r.get("first_paid_at")])
        zahlend = sum(
            1
            for r in refs
            if r["status"] == "approved"
            and r.get("first_paid_at")
            and abo.get(r["tenant_id"]) in _ZAHLEND_STATUS
        )
        return BackofficeTrackingSummary(
            partners_total=len(partner),
            partners_approved=sum(1 for p in partner if p["status"] == "approved"),
            partners_pending=sum(1 for p in partner if p["status"] == "pending_review"),
            clicks_30d=klicks.count or 0,
            registrations_30d=sum(1 for r in refs if str(r.get("created_at") or "") >= seit_30),
            registrations_total=len(refs),
            paying_customers=zahlend,
            reach_total=sum(_reichweite(p) for p in partner),
        )
