"""Outbound-ARI: Verfügbarkeit/Preise/Restriktionen/Stop-Sell + Outbox.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
# pylint: disable=too-many-lines  # kohärente ARI-Push-Domäne (Availability/Rate/
# Restrictions/Stop-Sell/Outbox + Cron-Retry) — ein Split zerrisse die eng
# gekoppelte Push-/Outbox-/Superseding-Logik über mehrere Dateien.
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .channex_client import ChannexError
from .common import ist_demo_mapping, log
from .ota_aktionen import aktionsfaktor_je_tag
from .schemas import (
    AriPushRequest,
    AriPushResponse,
)


class _PendingRatePlanMapping(Exception):
    """Signal: das Objekt ist bei Channex gemanaged, hat aber (noch) KEINE
    Rate-Plans gemappt (Rate-Plan-Import noch nicht/teilweise gelaufen). Ein
    Restriktions-Push darf in diesem Fenster NICHT still als Erfolg gelten
    (BUG 9) — die Outbox-Zeile bleibt 'pending' und der Cron zieht sie nach,
    sobald das Mapping existiert. Interner Sentinel (nicht Teil des Channex-
    Fehlerpfads, deshalb KEIN ChannexError)."""

    def __init__(self, property_id: str) -> None:
        super().__init__(f"Rate-Plan-Mapping fehlt noch für {property_id}")
        self.property_id = property_id


def _as_date(value: date | str) -> date:
    """Ein Datum robust zu `date` normalisieren — akzeptiert `date` (Request-Pfad)
    ODER ISO-String (aus dem persistierten Outbox-payload)."""
    return value if isinstance(value, date) else date.fromisoformat(value[:10])


def _as_iso(value: date | str) -> str:
    """Ein Datum (date ODER ISO-String) zu einem ISO-Datumsstring normalisieren."""
    return _as_date(value).isoformat()


def _segment_to_payload(seg: dict[str, Any]) -> dict[str, Any]:
    """Ein push_rates_batch-Segment JSON-serialisierbar machen (date → ISO), damit
    es im Outbox-payload liegen und der Cron es unverändert neu aufbauen kann."""
    out: dict[str, Any] = {
        "date_from": _as_iso(seg["date_from"]),
        "date_to": _as_iso(seg["date_to"]),
    }
    if seg.get("rate_cents") is not None:
        out["rate_cents"] = seg["rate_cents"]
    if seg.get("min_stay") is not None:
        out["min_stay"] = seg["min_stay"]
    # Rate-Plan-genaues Segment (Hotel) muss den Cron-Retry überleben, sonst
    # spiegelt der Backstop den Preis wieder an ALLE Pläne.
    if seg.get("rate_plan_id") is not None:
        out["rate_plan_id"] = seg["rate_plan_id"]
    return out


def _aktionen_einrechnen(
    segments: list[dict[str, Any]], faktoren: dict[str, float]
) -> list[dict[str, Any]]:
    """Segmente an den Aktions-Grenzen aufteilen und die Preise senken.

    Ein Segment ist ein Zeitraum mit EINEM Preis. Gilt die Aktion nur an einem
    Teil davon, muss es geteilt werden — sonst bekäme entweder der Rabatt zu viele
    Tage oder zu wenige. Tag für Tag aufteilen und danach wieder bündeln wäre
    dasselbe Ergebnis mit mehr Code: hier wird direkt je Tag ein Ein-Tages-Segment
    gebildet, wenn sich der Faktor innerhalb des Segments ändert.

    Segmente ohne Preis (nur `min_stay`) bleiben unberührt — eine Aktion senkt
    keinen Mindestaufenthalt.
    """
    if not faktoren:
        return segments
    out: list[dict[str, Any]] = []
    for seg in segments:
        rate_cents = seg.get("rate_cents")
        if rate_cents is None:
            out.append(seg)
            continue
        von, bis = _as_date(seg["date_from"]), _as_date(seg["date_to"])
        # Betroffen? Sonst unverändert übernehmen (kein unnötiges Aufsplitten).
        tage = [von + timedelta(days=i) for i in range((bis - von).days + 1)]
        if not any(t.isoformat() in faktoren for t in tage):
            out.append(seg)
            continue
        for tag in tage:
            faktor = faktoren.get(tag.isoformat(), 1.0)
            # Mindestens 1 Cent: Channex lehnt rate 0 ab, und „geschenkt" war nie
            # gemeint — 100 % Rabatt gibt es in der Oberfläche nicht (max. 100 %
            # wäre bps 10000, dann bleibt 1 Cent statt eines abgelehnten Pushes).
            gesenkt = max(1, int(round(int(rate_cents) * faktor)))
            out.append({**seg, "date_from": tag, "date_to": tag,
                        "rate_cents": gesenkt})
    return out


def _rate_fields(rate_cents: int | None, min_stay: int | None) -> dict[str, Any]:
    """Preis/Min-Stay zu Channex-restriction-Feldern. Leer, wenn beide None."""
    fields: dict[str, Any] = {}
    if rate_cents is not None:
        fields["rate"] = rate_cents
    if min_stay is not None:
        fields["min_stay_arrival"] = min_stay
        fields["min_stay_through"] = min_stay
    return fields


def _restriction_fields_from_payload(
    kind: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Aus dem persistierten Outbox-payload die Channex-restriction-Felder für
    rate/min_stay/max_stay/cta_ctd rekonstruieren (kind-spezifisch). stop_sell und
    der batch-rate-Fall (segments) werden vom Aufrufer separat behandelt."""
    if kind in ("rate", "min_stay"):
        return _rate_fields(payload.get("rate_cents"), payload.get("min_stay"))
    if kind == "max_stay":
        return {"max_stay": max(0, int(payload["max_stay"]))}
    if kind == "cta_ctd":
        fields: dict[str, Any] = {}
        if payload.get("closed_to_arrival") is not None:
            fields["closed_to_arrival"] = payload["closed_to_arrival"]
        if payload.get("closed_to_departure") is not None:
            fields["closed_to_departure"] = payload["closed_to_departure"]
        # Kombinierte Bulk-Restriktionen (Test 7): Min-/Max-Stay/Preis können
        # im selben Outbox-Payload liegen und werden mit rekonstruiert.
        if payload.get("min_stay") is not None:
            fields["min_stay_arrival"] = payload["min_stay"]
            fields["min_stay_through"] = payload["min_stay"]
        if payload.get("max_stay") is not None:
            fields["max_stay"] = max(0, int(payload["max_stay"]))
        if payload.get("rate_cents") is not None:
            fields["rate"] = payload["rate_cents"]
        return fields
    return {}


def _restriction_values(
    plans: list[dict[str, str]],
    fields: dict[str, Any],
    date_from: date,
    date_to: date,
    rate_plan_id: str | None = None,
) -> list[dict[str, Any]]:
    """`fields` als Range-value(s) je Rate-Plan ausgeben (date_from/date_to,
    Einzeltag als `date`). Standard: ALLE Rate-Plans. Mit `rate_plan_id` NUR der
    lokal passende Plan (Hotel: rate-plan-genauer Preis, kein Spiegeln). Leer ohne
    fields."""
    if not fields:
        return []
    targets = (
        [m for m in plans if m.get("local_rate_plan_id") == rate_plan_id]
        if rate_plan_id
        else plans
    )
    values: list[dict[str, Any]] = []
    for mapping in targets:
        base = {
            "property_id": mapping["channex_property_id"],
            "rate_plan_id": mapping["channex_rate_plan_id"],
            **fields,
        }
        values.extend(_expand_restriction_values(base, date_from, date_to))
    return values


def _iso_days(date_from: str, date_to: str) -> list[str]:
    """Alle ISO-Tage [date_from … date_to] inklusiv."""
    lo = date.fromisoformat(date_from[:10])
    hi = date.fromisoformat(date_to[:10])
    out: list[str] = []
    cur = lo
    while cur <= hi:
        out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out


def _group_iso_days_to_ranges(days: set[str]) -> list[tuple[str, str]]:
    """Sortierte ISO-Tage zu zusammenhängenden [von, bis]-Intervallen bündeln
    (inklusiv), damit der Availability-Push wenige Ranges statt vieler Einzeltage
    sendet. Leere Menge → keine Ranges."""
    if not days:
        return []
    ordered = sorted(date.fromisoformat(d) for d in days)
    ranges: list[tuple[str, str]] = []
    start = prev = ordered[0]
    for cur in ordered[1:]:
        if (cur - prev).days == 1:
            prev = cur
            continue
        ranges.append((start.isoformat(), prev.isoformat()))
        start = prev = cur
    ranges.append((start.isoformat(), prev.isoformat()))
    return ranges


def _merge_equal_value_days(
    drift: dict[str, int], feld: str, rate_plan_id: str
) -> list[dict[str, Any]]:
    """Drift-Tage mit GLEICHEM Wert zu date_range-Segmenten bündeln.

    `drift` ist {ISO-Tag: Wert}. Zusammengefasst wird nur, was denselben Wert
    trägt UND lückenlos aufeinanderfolgt — sonst würde eine Range einen Tag mit
    abweichendem Preis/Min-Stay überschreiben. Ergebnis ist nach Startdatum
    sortiert (stabile, lesbare Payload).
    """
    if not drift:
        return []
    tage_je_wert: dict[int, set[str]] = {}
    for iso, wert in drift.items():
        tage_je_wert.setdefault(wert, set()).add(iso)
    segmente: list[dict[str, Any]] = []
    for wert, tage in tage_je_wert.items():
        for von, bis in _group_iso_days_to_ranges(tage):
            segmente.append({
                "date_from": von,
                "date_to": bis,
                feld: wert,
                "rate_plan_id": rate_plan_id,
            })
    segmente.sort(key=lambda s: (s["date_from"], s["date_to"]))
    return segmente


def _expand_restriction_values(
    base: dict[str, Any], date_from: date, date_to: date
) -> list[dict[str, Any]]:
    """Einen Restriction-Wert als EINEN Range-Wert (date_from/date_to) ausgeben.

    Der Channex-`restrictions`-Endpoint akzeptiert je Wert entweder ein einzelnes
    `date` ODER das Paar `date_from`/`date_to` — seine eigene Validierung sagt:
    "Should be included field date or fields pair date_from/date_to". Live gegen
    staging verifiziert (PUT + Readback): ein Range-Wert setzt jeden Tag des
    Bereichs, die Ränder bleiben unberührt.

    Ein Wert je Tag zu senden ist zwar wirkungsgleich, bläht den Request aber um
    den Faktor der Bereichslänge und verletzt die Zertifizierungsvorgabe
    ("use date_range syntax with merged sequences instead of single-date objects",
    Tests 3/4/7/8). Ein Einzeltag wird als `date` gesendet — Channex erwartet für
    Single-Date-Updates genau das.

    `base` enthält property_id/rate_plan_id + die Restriction-Felder (rate,
    min_stay_*, stop_sell, closed_to_*, max_stay, days). date_from/date_to werden
    NICHT aus base gelesen — der Aufrufer übergibt sie explizit.
    """
    if date_from == date_to:
        return [{**base, "date": date_from.isoformat()}]
    return [
        {**base, "date_from": date_from.isoformat(), "date_to": date_to.isoformat()}
    ]


_WEEKDAY_NAMES = ["mo", "tu", "we", "th", "fr", "sa", "su"]  # Channex-Format, Mo=0


def _apply_weekday_mask(
    value: dict[str, Any], weekday_allow: set[int] | None
) -> dict[str, Any] | None:
    """Wochentags-Maske auf ein restriction-value anwenden. Range-values bekommen
    das NATIVE Channex-`days`-Feld; ein Einzeltag-value (`date`) trägt kein
    days-Feld und wird lokal geprüft (None = Tag fällt aus der Maske)."""
    if weekday_allow is None:
        return value
    if "date" in value:
        wd = date.fromisoformat(value["date"]).weekday()
        return value if wd in weekday_allow else None
    value["days"] = [n for i, n in enumerate(_WEEKDAY_NAMES) if i in weekday_allow]
    return value


def _exclude_superseded_days(
    values: list[dict[str, Any]], superseded: set[str]
) -> list[dict[str, Any]]:
    """Von einer neueren Outbox-Zeile abgedeckte Tage TAG-GENAU aus restriction-
    values entfernen. Einzeltag-values (`date`) werden gefiltert; Range-values
    (`date_from`/`date_to`) werden um die abgedeckten Tage ZERSCHNITTEN und als
    Teil-Ranges neu emittiert — ein reiner `date`-Filter griffe bei Ranges nicht
    mehr (der superseded Tag bliebe im Range und überschriebe den neueren Wert).
    Ein Wochentags-Feld (`days`) bleibt an Teil-Ranges erhalten; kollabiert ein
    Range auf einen Einzeltag, wird der Wochentag lokal geprüft (ein `date`-value
    trägt kein days-Feld)."""
    if not superseded:
        return values
    out: list[dict[str, Any]] = []
    for v in values:
        if "date" in v:
            if v["date"] not in superseded:
                out.append(v)
            continue
        keep = set(_iso_days(v["date_from"], v["date_to"])) - superseded
        base = {k: x for k, x in v.items() if k not in ("date_from", "date_to")}
        day_mask = base.pop("days", None)
        for lo, hi in _group_iso_days_to_ranges(keep):
            if lo == hi:
                wd = date.fromisoformat(lo).weekday()
                if day_mask is not None and _WEEKDAY_NAMES[wd] not in day_mask:
                    continue
                out.append({**base, "date": lo})
                continue
            sub = {**base, "date_from": lo, "date_to": hi}
            if day_mask is not None:
                sub["days"] = day_mask
            out.append(sub)
    return out


class AriPushMixin:
    """Outbound-ARI: Verfügbarkeit/Preise/Restriktionen/Stop-Sell + Outbox."""


    # -- ARI-Push --------------------------------------------------------------
    def push_ari(self, ctx: AuthContext, req: AriPushRequest) -> AriPushResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        warnings: list[str] = []

        # Verfügbarkeit: room_type_map_id → (channex_property_id, channex_room_type_id)
        avail_values: list[dict[str, Any]] = []
        for upd in req.availability:
            mapping = self._room_type_mapping(db, tenant_id, upd.room_type_map_id)
            if mapping is None:
                warnings.append(f"Room-Type-Mapping {upd.room_type_map_id} unbekannt.")
                continue
            if not self._map_is_channex_managed(
                db, tenant_id, mapping["property_map_id"]
            ):
                warnings.append(
                    f"Room-Type-Mapping {upd.room_type_map_id} übersprungen "
                    "(nicht bei Channex angelegt)."
                )
                continue
            avail_values.append(
                {
                    "property_id": mapping["channex_property_id"],
                    "room_type_id": mapping["channex_room_type_id"],
                    "date_from": upd.date_from.isoformat(),
                    "date_to": upd.date_to.isoformat(),
                    "availability": upd.availability,
                }
            )

        # Preise/Restriktionen: rate_plan_map_id → (channex_property_id, channex_rate_plan_id)
        rate_values: list[dict[str, Any]] = []
        for upd in req.rates:
            mapping = self._rate_plan_mapping(db, tenant_id, upd.rate_plan_map_id)
            if mapping is None:
                warnings.append(f"Rate-Plan-Mapping {upd.rate_plan_map_id} unbekannt.")
                continue
            if not self._map_is_channex_managed(
                db, tenant_id, mapping["property_map_id"]
            ):
                warnings.append(
                    f"Rate-Plan-Mapping {upd.rate_plan_map_id} übersprungen "
                    "(nicht bei Channex angelegt)."
                )
                continue
            base: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
            }
            if upd.rate_cents is not None:
                base["rate"] = upd.rate_cents  # Cent-Integer
            if upd.min_stay_arrival is not None:
                base["min_stay_arrival"] = upd.min_stay_arrival
            if upd.stop_sell is not None:
                base["stop_sell"] = 1 if upd.stop_sell else 0
            # Range-Syntax (date_from/date_to, Einzeltag als `date`) — von Channex
            # dokumentiert und live per PUT+Readback verifiziert; Zertifizierungs-
            # vorgabe: merged date_range statt Einzeltag-Objekten.
            rate_values.extend(
                _expand_restriction_values(base, upd.date_from, upd.date_to)
            )

        # Trace-Kontext setzen, damit availability/restrictions-Pushes ihre
        # Channex-Task-ID in channex_debug_log schreiben (sichtbarer Verlauf +
        # Zertifizierung). property_id (lokal) aus dem ersten Mapping ableiten.
        local_pid = self._local_property_for_push(db, tenant_id, avail_values, rate_values)

        avail_tasks = rate_tasks = 0
        try:
            # Availability getrennt senden (Channex-Priorität), dann Preise.
            if avail_values:
                self._trace_step(
                    tenant_id=tenant_id, property_id=local_pid, step="availability"
                )
                res_a = self._channex.update_availability(avail_values)
                avail_tasks = len(res_a.get("data") or [])
                warnings += list((res_a.get("meta") or {}).get("warnings") or [])
            if rate_values:
                self._trace_step(
                    tenant_id=tenant_id, property_id=local_pid, step="restrictions"
                )
                res_r = self._channex.update_restrictions(rate_values)
                rate_tasks = len(res_r.get("data") or [])
                warnings += list((res_r.get("meta") or {}).get("warnings") or [])
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        return AriPushResponse(
            availability_tasks=avail_tasks,
            rate_tasks=rate_tasks,
            warnings=[str(w) for w in warnings],
        )

    def _local_property_for_push(
        self, db: Client, tenant_id: str,
        avail_values: list[dict[str, Any]], rate_values: list[dict[str, Any]],
    ) -> str | None:
        """Lokale property_id aus der channex_property_id des ersten Push-Werts
        (für den Trace-Kontext). None, wenn kein Wert/kein Mapping — dann fällt der
        Trace-Eintrag nur nicht dem Objekt zu, der Push läuft trotzdem."""
        vals = avail_values or rate_values
        if not vals:
            return None
        cpid = vals[0].get("property_id")
        if not cpid:
            return None
        row = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", cpid)
            .limit(1)
            .execute()
        ).data
        return row[0]["property_id"] if row else None

    # -- Realtime-Verfügbarkeits-Push (Doppelbuchungsschutz) -------------------
    # Der Buchungskalender (availability) ist die oberste Wahrheit. Jede lokale
    # Änderung pusht SOFORT die Channex-Verfügbarkeit, damit OTAs den Tag nicht
    # mehr/wieder verkaufen. Persistiert in ari_outbox (Retry bei Ausfall).
    def _resolve_channex_room_type(
        self, db: Client, tenant_id: str, property_id: str,
    ) -> dict[str, str] | None:
        """property_id → (channex_property_id, channex_room_type_id). None, wenn
        nicht mit Channex verbunden.

        1 Objekt = 1 buchbare Einheit, also EIN Room-Type je Objekt. Gesucht wird
        zuerst über `local_unit_ref = property_id` (der synthetische
        FeWo-Room-Type). Findet sich dort nichts, greift der Fallback auf die
        Room-Type-Map der Property.

        Warum der Fallback nötig ist: Bei einer GETEILTEN Channex-Property
        (Hotel, n Zimmer → 1 Property) trägt die Map `local_unit_ref =
        room_type.id`, nicht die property_id. Der frühere harte Filter fand
        solche Zimmer nie → sie fielen still aus dem Verfügbarkeits-Push
        (Channex-Zertifizierung 17.07.2026: „Availability update has no data for
        room type(s)"). `_resolve_channex_rate_plans` wurde für exakt dieses
        Problem bereits repariert; hier fehlte die Entsprechung.
        """
        pm = (
            db.table("channex_property_map")
            .select("id, channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return None
        rt = (
            db.table("channex_room_type_map")
            .select("channex_room_type_id")
            .eq("tenant_id", tenant_id)
            .eq("property_map_id", pm[0]["id"])
            .eq("local_unit_ref", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not rt:
            # Geteilte Property: Map hängt an room_type.id statt property_id.
            # Älteste Map gewinnt (stabil über Aufrufe hinweg).
            rt = (
                db.table("channex_room_type_map")
                .select("channex_room_type_id")
                .eq("tenant_id", tenant_id)
                .eq("property_map_id", pm[0]["id"])
                .is_("deleted_at", "null")
                .order("created_at")
                .limit(1)
                .execute()
            ).data
        if not rt:
            return None
        return {
            "channex_property_id": pm[0]["channex_property_id"],
            "channex_room_type_id": rt[0]["channex_room_type_id"],
        }

    def _is_channex_managed(
        self, db: Client, tenant_id: str, property_id: str
    ) -> bool:
        """True, wenn das Objekt bei Channex angelegt ist (aktives property_map,
        deleted_at IS NULL).

        Eine Quelle der Wahrheit für „darf für dieses Objekt Inventar an Channex":
        ein gemanagtes Objekt ist verkaufsbereit — Verfügbarkeit/Preise gehen an
        Channex, UNABHÄNGIG davon, ob schon ein OTA-Kanal verbunden ist. Welche
        OTA das Kontingent zeigt, steuert Channex selbst über den (de)aktivierten
        Channel (set_connection_active → deactivate_channel). Das frühere Gate
        „mindestens ein aktiver Kanal" war ein Deadlock: ohne OTA kein Push →
        Channex meldet availability=0 → Objekt überall „gesperrt". Tenant-Scope
        explizit, da der Service-Role-Key die RLS umgeht. `sync_enabled` wird stets
        gemeinsam mit `deleted_at` gesetzt → `deleted_at IS NULL` genügt.

        Ein Platzhalter statt einer echten Channex-ID (Demo-Betriebe der
        Marketing-Screenshots) zählt NICHT als gemanagt: sonst geht jeder Preis-/
        Restriktions-Push mit einer erfundenen ID raus, Channex antwortet „Bad
        Request", und der Job läuft zehnmal in den Retry — auf Kosten des
        kontoweiten Anfrage-Budgets aller echten Betriebe."""
        res = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        return bool(res) and not ist_demo_mapping(res[0].get("channex_property_id"))

    def _property_id_for_map(
        self, db: Client, tenant_id: str, property_map_id: str
    ) -> str | None:
        """property_map_id → lokale property_id (für das Gate in push_ari)."""
        pm = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("id", property_map_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        return pm[0]["property_id"] if pm else None

    def _map_is_channex_managed(
        self, db: Client, tenant_id: str, property_map_id: str
    ) -> bool:
        """Gate über die property_map_id (push_ari arbeitet auf Mapping-Ebene)."""
        property_id = self._property_id_for_map(db, tenant_id, property_map_id)
        if property_id is None:
            return False
        return self._is_channex_managed(db, tenant_id, property_id)

    def _newer_covered_days(
        self, db: Client, property_id: str, created_at: str, outbox_id: str | None,
    ) -> set[str]:
        """ISO-Tage, die von einer NEUEREN ari_outbox-Zeile desselben Objekts
        abgedeckt sind (created_at strikt später). Diese Tage trägt die aktuelle
        Zeile NICHT mehr an Channex — die jüngste Absicht je Tag gewinnt (1 Objekt
        = 1 Einheit, eine Superseding-Domäne je Objekt).

        Deckt beide Superseding-Lücken ab: (1) der schnelle Job-Pfad nutzt es
        (nicht nur der Cron), (2) es arbeitet TAG-GENAU (eine ältere Zeile wird
        nur für die überlappenden Tage übersprungen, ihre übrigen Tage gehen
        weiterhin raus). `created_at` kann fehlen (frisch angelegte Zeile ohne
        DB-Roundtrip) → dann konservativ leer (nichts überspringen).

        NUR 'pending'/'done'-Zeilen zählen als Supersessor: eine 'failed'-Zeile hat
        ihren Wert NIE zuverlässig an Channex übertragen — sie darf eine ältere,
        echte Sperre (avail=0) nicht dauerhaft unterdrücken (sonst erreicht weder
        der alte noch der neue Wert Channex, und die gebuchten Nächte bleiben auf
        OTAs verkaufbar). 'pending' zählt weiter, weil diese neuere Zeile selbst
        noch gepusht wird (jüngste Absicht) — kippt sie später auf 'failed', gibt
        sie die Tage beim nächsten Retry der älteren Zeile automatisch frei."""
        if not created_at:
            return set()
        q = (
            db.table("ari_outbox")
            .select("date_from,date_to,created_at")
            .eq("property_id", property_id)
            .gt("created_at", created_at)
            .in_("status", ["pending", "done"])
        )
        if outbox_id is not None:
            q = q.neq("id", outbox_id)
        rows = q.execute().data or []
        covered: set[str] = set()
        for r in rows:
            covered.update(_iso_days(str(r["date_from"]), str(r["date_to"])))
        return covered

    def push_availability_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        availability: int,
        outbox_id: str | None = None,
    ) -> bool:
        """Verfügbarkeit (absolute Menge je Tag) für einen Zeitraum an Channex
        pushen. date_to inklusiv. Persistiert in ari_outbox und versucht den
        Sofort-Push; bei Fehler bleibt die Zeile 'pending' (Cron-Retry). No-op,
        wenn Channex nicht konfiguriert oder die Property nicht verbunden ist.

        Rückgabe: True, wenn der Channex-Call fehlschlug (der Worker-Handler
        wirft dann → schneller Job-Backoff); False bei Erfolg/No-op.

        `outbox_id`: bereits vom Aufrufer persistierte ari_outbox-Zeile (z. B.
        atomar mit der Buchung über die RPC 0104). Dann wird DIESE Zeile
        abgearbeitet statt eine zweite anzulegen; ist sie nicht mehr 'pending'
        (Cron war schneller), ist nichts zu tun.

        1 Objekt = 1 Einheit: der Push geht an den synthetischen Channex-Room-Type
        des Objekts (binär)."""
        if not self._channex.is_configured or self._db is None:
            return False
        db = self._db

        prior_attempts = 0
        created_at = ""
        if outbox_id is not None:
            existing = (
                db.table("ari_outbox")
                .select("id,status,attempts,created_at")
                .eq("id", outbox_id)
                .limit(1)
                .execute()
            ).data
            if not existing or existing[0]["status"] != "pending":
                return False  # bereits abgearbeitet (Cron/Doppel) → fertig
            prior_attempts = existing[0]["attempts"] or 0
            created_at = str(existing[0].get("created_at") or "")

        mapping = self._resolve_channex_room_type(db, tenant_id, property_id)
        if mapping is None:
            return False  # nicht mit Channex verbunden → nichts zu pushen
        if not self._is_channex_managed(db, tenant_id, property_id):
            return False  # alle Kanäle des Objekts auf Aus → kein Push

        if outbox_id is None:
            outbox = (
                db.table("ari_outbox")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "date_from": date_from.isoformat(),
                        "date_to": date_to.isoformat(),
                        "availability": availability,
                        "status": "pending",
                    }
                )
                .execute()
            ).data
            outbox_id = outbox[0]["id"] if outbox else None
            created_at = str(outbox[0].get("created_at") or "") if outbox else ""

        # Superseding TAG-GENAU + im schnellen Pfad: nur die Tage pushen, für die
        # KEINE neuere Outbox-Zeile desselben Objekts existiert (jüngste Absicht
        # je Tag gewinnt). Verhindert, dass ein älterer avail-Wert (z. B. Storno-
        # Freigabe) einen inzwischen live gegangenen neueren Wert (neue Buchung)
        # überschreibt — auch wenn die Jobs nebenläufig/umsortiert laufen.
        superseded = self._newer_covered_days(
            db, property_id, created_at, outbox_id
        )
        push_ranges = _group_iso_days_to_ranges(
            set(_iso_days(date_from.isoformat(), date_to.isoformat())) - superseded
        )

        # Trace-Kontext für den Client-Sink: der schnelle availability-Delta-Pfad
        # (Buchung/Storno/Kalender-Block, Tests 9/10). Ohne diese Zeile erschiene die
        # Task-ID erst beim Cron-Nachzug (process_ari_outbox), nicht beim Sofort-Push.
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="availability"
        )
        try:
            # ALLE Ranges in EINEM Request (values-Array), nicht ein Request je
            # Range: Channex-Zertifizierung verlangt gebündelte date_range-
            # Updates statt vieler Einzel-Calls.
            if push_ranges:
                self._channex.update_availability(
                    [
                        {
                            "property_id": mapping["channex_property_id"],
                            "room_type_id": mapping["channex_room_type_id"],
                            "date_from": r_from,
                            "date_to": r_to,
                            "availability": availability,
                        }
                        for r_from, r_to in push_ranges
                    ]
                )
            if outbox_id:
                # Guard status='pending': falls ein paralleler process_ari_outbox-
                # Tick dieselbe Zeile schon abgehakt hat, kein zweiter Übergang.
                db.table("ari_outbox").update(
                    {"status": "done", "attempts": prior_attempts + 1}
                ).eq("id", outbox_id).eq("status", "pending").execute()
            log.info(
                "ari_push_done",
                tenant_id=tenant_id,
                property_id=property_id,
                availability=availability,
                pushed_ranges=len(push_ranges),
                superseded_days=len(superseded),
            )
            return False
        except ChannexError as exc:
            if outbox_id:
                # Guard status='pending' (wie Erfolgspfad + process_ari_outbox):
                # hat ein paralleler Cron-Tick die Zeile bereits erfolgreich auf
                # 'done' gesetzt, darf der leicht verzögerte Fehler dieses Job-
                # Pfads nicht einen veralteten last_error/attempts blind auf die
                # erledigte Zeile schreiben.
                db.table("ari_outbox").update(
                    {"attempts": prior_attempts + 1, "last_error": exc.message}
                ).eq("id", outbox_id).eq("status", "pending").execute()
            log.warning(
                "ari_push_failed_queued",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )
            # Fehler signalisieren: der Worker-Handler wirft → schneller
            # Job-Backoff (1/5/15 min) statt erst der 15-min-Reconcile-Tick.
            # Die ari_outbox bleibt der zusätzliche Backstop.
            return True

    def _resolve_channex_rate_plans(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, str]]:
        """property_id → ALLE (channex_property_id, channex_rate_plan_id) der
        Property über die Room-Type/Rate-Plan-Kette. Leere Liste, wenn nicht
        verbunden. Channex-Restrictions (stop_sell/CTA/CTD/min_stay/rate) wirken
        PRO Rate-Plan — hat ein Objekt mehrere, muss jeder Plan bespielt werden.

        Sammelt ALLE nicht-gelöschten Room-Type-Maps der Property ein, nicht nur
        den synthetischen Ferienwohnungs-Room-Type (local_unit_ref = property_id):
        ein Hotel legt je Zimmerkategorie einen eigenen Channex-Room-Type an
        (local_unit_ref = room_type.id, s. content_sync). Der frühere Filter auf
        NUR local_unit_ref = property_id fand für Hotels NIE einen Rate-Plan → jeder
        Restriktions-/Preis-Push blieb ewig 'pending' ('Rate-Plan-Mapping fehlt')."""
        pm = (
            db.table("channex_property_map")
            .select("id, channex_property_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return []
        # ALLE Room-Type-Maps der Property (synthetischer FeWo-Room-Type UND je
        # Hotel-Kategorie einer) — nicht auf local_unit_ref = property_id einengen.
        rtms = (
            db.table("channex_room_type_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("property_map_id", pm[0]["id"])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        if not rtms:
            return []
        rps = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id, local_rate_plan_id")
            .eq("tenant_id", tenant_id)
            .in_("room_type_map_id", [r["id"] for r in rtms])
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        ).data or []
        channex_property_id = pm[0]["channex_property_id"]
        return [
            {
                "channex_property_id": channex_property_id,
                "channex_rate_plan_id": rp["channex_rate_plan_id"],
                # Lokaler Rate-Plan-Bezug: erlaubt push_rates_batch, ein Segment
                # gezielt an GENAU diesen Plan zu schicken (Hotel: Twin/BAR ≠
                # Double/B&B), statt an alle zu spiegeln. None = alt/ungemappt.
                "local_rate_plan_id": rp.get("local_rate_plan_id"),
            }
            for rp in rps
            if rp.get("channex_rate_plan_id")
        ]

    # -- Restriktions-Outbox (dauerhafter Backstop) ----------------------------
    # Wie ari_outbox (0033) für Availability, aber für Stop-Sell/Rate/Min-Stay/
    # Max-Stay/CTA-CTD/restrictions: jede Push-Absicht wird VOR dem Channex-Call
    # persistiert und nach Erfolg 'done' markiert. Bei Channex-Ausfall bleibt sie
    # 'pending' und der Reconcile-Cron (process_restriction_outbox) zieht sie nach.
    # Persistiert werden die PARAMETER (kind + payload), nicht die aufgelösten
    # Channex-values — so löst der Retry das Rate-Plan-Mapping NEU auf und heilt
    # auch das Fenster, in dem ein channex-managtes Objekt noch KEINEN Rate-Plan
    # gemappt hat (BUG 9: sonst würde der Push still als Erfolg verworfen).
    def _enqueue_restriction_outbox(
        self,
        tenant_id: str,
        property_id: str,
        kind: str,
        payload: dict[str, Any],
        date_from: date,
        date_to: date,
    ) -> str | None:
        """Restriktions-Push-Absicht als 'pending'-Zeile persistieren. Gibt die
        Zeilen-ID zurück (oder None, wenn kein DB-Client vorhanden)."""
        if self._db is None:
            return None
        row = (
            self._db.table("ari_restriction_outbox")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "kind": kind,
                    "payload": payload,
                    "date_from": date_from.isoformat(),
                    "date_to": date_to.isoformat(),
                    "status": "pending",
                }
            )
            .execute()
        ).data
        return row[0]["id"] if row else None

    def _mark_restriction_outbox(
        self, outbox_id: str | None, status: str, *, error: str | None = None
    ) -> None:
        """Eine Restriktions-Outbox-Zeile abschließen (done) oder als fehlgeschlagen
        markieren. Guard status='pending', damit ein paralleler Cron-Tick den
        Zustand nicht doppelt umschreibt. 'pending' lässt der Cron liegen — hier
        wird nie AKTIV auf 'pending' gesetzt (die Zeile ist bereits pending)."""
        if outbox_id is None or self._db is None:
            return
        patch: dict[str, Any] = {"status": status}
        if error is not None:
            patch["last_error"] = error
        (
            self._db.table("ari_restriction_outbox")
            .update(patch)
            .eq("id", outbox_id)
            .eq("status", "pending")
            .execute()
        )

    def _push_restriction_values_all_plans(
        self,
        tenant_id: str,
        property_id: str,
        fields: dict[str, Any],
        date_from: date,
        date_to: date,
    ) -> int | None:
        """Restriction-`fields` (rate/min_stay/max_stay/CTA/CTD) für ALLE
        Rate-Plans der Property über den Zeitraum expandieren und gebündelt
        pushen. Gibt die Anzahl gesendeter values zurück, oder None bei No-op
        (nicht bei Channex gemanaged). Wirft ChannexError beim Sende-Fehler ODER
        einen _PendingRatePlanMapping-Sentinel, wenn das Objekt zwar managed ist,
        aber (noch) KEINE Rate-Plans gemappt hat — der Aufrufer lässt die
        Outbox-Zeile dann 'pending' (BUG 9: kein stilles Verwerfen als Erfolg).

        Der Kern des Rate-Plan-Fix: früher traf nur EIN (zufälliger) Rate-Plan
        die Restriction; jetzt jeder — sonst verkauft ein OTA über einen anderen
        Rate-Plan weiter."""
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return None  # nicht bei Channex angelegt → kein Push (echter No-op)
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch (Import nicht/teils
            # gelaufen). NICHT still als Erfolg abhaken — der Push muss offen bleiben
            # und der Cron ihn nachziehen, sobald das Mapping existiert.
            raise _PendingRatePlanMapping(property_id)
        values = _restriction_values(plans, fields, date_from, date_to)
        if not values:
            return 0
        # Trace-Kontext für den Client-Sink: dieser Delta-Pfad (min_stay, max_stay,
        # stop_sell, CTA/CTD, Zeitraum-Preis) ist der einzige Weg der Worker-getriebenen
        # Sofort-Pushes zu update_restrictions — ohne diese Zeile erschiene die Channex-
        # Task-ID der Tests 4–8 erst beim Cron-Nachzug in channex_debug_log.
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="restrictions"
        )
        for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
            self._channex.update_restrictions(values[i : i + self._RESTRICTIONS_CHUNK])
        return len(values)

    def _push_fields_with_outbox(
        self,
        tenant_id: str,
        property_id: str,
        kind: str,
        payload: dict[str, Any],
        fields: dict[str, Any],
        date_from: date,
        date_to: date,
        log_event: str,
    ) -> bool:
        """Gemeinsamer Pfad für rate/max_stay/cta_ctd: Absicht in die Restriktions-
        Outbox persistieren, dann für ALLE Rate-Plans pushen und die Zeile
        abschließen. Rückgabe True = Channex-Fehler ODER fehlendes Rate-Plan-Mapping
        (Worker-Handler wirft → Job-Retry); die Outbox-Zeile bleibt in beiden Fällen
        'pending' und der Cron zieht sie nach. `payload` sind die Parameter zum
        Neu-Aufbauen beim Retry (Selbstheilung); `fields` die daraus abgeleiteten
        Channex-Restriction-Felder für den Sofort-Push."""
        # Zuerst persistieren (VOR dem Channex-Call), damit ein Ausfall/Prozesstod
        # den Wert nicht verliert. Bei nicht-gemanagtem Objekt gar nicht erst
        # anlegen (echter No-op) — sonst würde der Cron endlos eine Zeile für ein
        # Objekt retryen, das gar nicht bei Channex liegt.
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return False
        outbox_id = self._enqueue_restriction_outbox(
            tenant_id, property_id, kind, payload, date_from, date_to
        )
        try:
            sent = self._push_restriction_values_all_plans(
                tenant_id, property_id, fields, date_from, date_to
            )
            self._mark_restriction_outbox(outbox_id, "done")
            if sent is not None:
                # Ist-Spiegel fortschreiben (0246) — GENAU wie im Batch-Pfad.
                # Ohne das bliebe der Schatten auf dem alten Wert stehen und der
                # nächste Abgleich hielte den gerade gepushten Preis für eine
                # Differenz und schickte ihn ein zweites Mal (unnötiger Verkehr
                # gegen die Auflage „nur Änderungen senden"). Live gesehen am
                # 01.08.2026: Tagespreis 333 kam an, der Schatten stand weiter
                # auf 103,20.
                self._write_ari_shadow_for_range(
                    tenant_id, property_id, fields, date_from, date_to
                )
                log.info(
                    log_event, tenant_id=tenant_id, property_id=property_id, days=sent,
                )
            return False
        except _PendingRatePlanMapping:
            # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch → Zeile bleibt
            # 'pending' (nicht 'done'), der Cron zieht sie nach, sobald das Mapping
            # existiert. True → Job-Retry (Backoff), statt still Erfolg zu melden.
            log.info(
                "restriction_push_deferred_no_rate_plan",
                tenant_id=tenant_id, property_id=property_id, kind=kind,
            )
            return True
        except ChannexError as exc:
            # Outbox-Zeile bleibt 'pending' (Cron-Backstop); zusätzlich Job-Retry.
            log.warning(
                f"{log_event}_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
            )
            return True

    def push_rate_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        rate_cents: int | None = None,
        *,
        min_stay: int | None = None,
    ) -> bool:
        """Preis und/oder Mindestaufenthalt für einen Zeitraum an Channex pushen
        (Restrictions, ALLE Rate-Plans). Mindestens eines von rate_cents/min_stay
        setzen. Rückgabe True = Channex-Fehler/fehlendes Mapping (Worker-Handler
        wirft → Job-Backoff); die Restriktions-Outbox bleibt der Backstop. No-op,
        wenn nicht verbunden. date_to inkl."""
        if not self._channex.is_configured or self._db is None:
            return False
        if rate_cents is None and min_stay is None:
            return False
        fields: dict[str, Any] = {}
        if rate_cents is not None:
            fields["rate"] = rate_cents
        if min_stay is not None:
            fields["min_stay_arrival"] = min_stay
            fields["min_stay_through"] = min_stay
        # kind unterscheidet Preis (rate) von reinem Min-Stay, damit der Cron beim
        # Retry dieselben Parameter neu aufbaut.
        kind = "rate" if rate_cents is not None else "min_stay"
        payload = {"rate_cents": rate_cents, "min_stay": min_stay}
        return self._push_fields_with_outbox(
            tenant_id, property_id, kind, payload, fields, date_from, date_to,
            "restriction_push_done",
        )

    def push_max_stay_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        max_stay: int,
    ) -> bool:
        """Maximalaufenthalt (max_stay-Restriction) für einen Zeitraum an Channex
        pushen (ALLE Rate-Plans). Channex-Key ist `max_stay` (NICHT
        max_stay_arrival — das nimmt Channex zwar per 200 an, persistiert es aber
        nicht; live verifiziert). 0 = keine Obergrenze. Rückgabe True =
        Channex-Fehler/fehlendes Mapping (Job-Retry); die Restriktions-Outbox bleibt
        der Backstop. No-op ohne Verbindung/Mapping. date_to inkl."""
        if not self._channex.is_configured or self._db is None:
            return False
        clamped = max(0, int(max_stay))
        return self._push_fields_with_outbox(
            tenant_id, property_id, "max_stay", {"max_stay": clamped},
            {"max_stay": clamped}, date_from, date_to, "max_stay_push_done",
        )

    def push_restrictions_for_property(
        self,
        tenant_id: str,
        property_id: str,
        date_from: date,
        date_to: date,
        *,
        closed_to_arrival: bool | None = None,
        closed_to_departure: bool | None = None,
        min_stay: int | None = None,
        max_stay: int | None = None,
        rate_cents: int | None = None,
    ) -> bool:
        """Kombinierte Restriktionen (CTA/CTD/Min-Stay/Max-Stay/Preis) für einen
        Zeitraum in EINEM Channex-Call pushen (ALLE Rate-Plans). Nur gesetzte
        Felder (None = unverändert) — eine UI-Aktion, die mehrere Restriktionen
        zugleich setzt (Bulk-Update), erzeugt so EINEN Request statt mehrerer
        (Channex-Zertifizierung Test 7). Rückgabe True = Channex-Fehler/
        fehlendes Mapping (Job-Retry); die Restriktions-Outbox bleibt der
        Backstop. No-op, wenn nicht verbunden. date_to inklusiv."""
        if not self._channex.is_configured or self._db is None:
            return False
        fields: dict[str, Any] = {}
        if closed_to_arrival is not None:
            fields["closed_to_arrival"] = closed_to_arrival
        if closed_to_departure is not None:
            fields["closed_to_departure"] = closed_to_departure
        if min_stay is not None:
            fields["min_stay_arrival"] = min_stay
            fields["min_stay_through"] = min_stay
        if max_stay is not None:
            fields["max_stay"] = max(0, int(max_stay))
        if rate_cents is not None:
            fields["rate"] = rate_cents
        if not fields:
            return False
        payload = {
            "closed_to_arrival": closed_to_arrival,
            "closed_to_departure": closed_to_departure,
            "min_stay": min_stay,
            "max_stay": max_stay,
            "rate_cents": rate_cents,
        }
        return self._push_fields_with_outbox(
            tenant_id, property_id, "cta_ctd", payload, fields, date_from, date_to,
            "cta_ctd_push_done",
        )

    @staticmethod
    def _stop_sell_values(
        plans: list[dict[str, str]],
        spans: list[tuple[date, date]],
        stop_sell: bool,
        days: list[str] | None,
    ) -> list[dict[str, Any]]:
        """Aus Rate-Plans + Spannen die Stop-Sell-values bauen (Range-Syntax).
        Vergangene Tage werden auf heute geklemmt (Channex weist sie sonst ab).
        `days` filtert optional auf Wochentage (mo…su): an Range-values als
        NATIVES Channex-`days`-Feld (laut ARI-Doku unterstützt — "List of days
        which should be affected by update"); ein Einzeltag-value (`date`) trägt
        kein days-Feld und wird lokal geprüft. Statisch/pur, damit Direktpfad und
        Cron dieselbe Aufbaulogik teilen."""
        today = date.today()
        weekday_allow = (
            {i for i, n in enumerate(_WEEKDAY_NAMES) if n in days} if days else None
        )
        values: list[dict[str, Any]] = []
        for mapping in plans:
            base: dict[str, Any] = {
                "property_id": mapping["channex_property_id"],
                "rate_plan_id": mapping["channex_rate_plan_id"],
                "stop_sell": stop_sell,
            }
            for span_start, span_end in spans:
                if span_end < today:
                    continue
                for v in _expand_restriction_values(
                    base, max(span_start, today), span_end
                ):
                    masked = _apply_weekday_mask(v, weekday_allow)
                    if masked is not None:
                        values.append(masked)
        return values

    def push_stop_sell_for_property(
        self,
        tenant_id: str,
        property_id: str,
        spans: list[tuple[date, date]],
        *,
        stop_sell: bool,
        days: list[str] | None = None,
    ) -> bool:
        """Verkaufsstopp (stop_sell-Restriction, Rate-Plan-Ebene) für einen oder
        mehrere Zeiträume an Channex pushen — EIN Request mit mehreren values.
        `days` filtert optional auf Wochentage (Channex-nativ: mo…su). Vergangene
        Daten weist Channex ab → Spannen werden auf heute geklemmt. Rückgabe True
        = Channex-Fehler/fehlendes Rate-Plan-Mapping (Worker-Handler wirft →
        schneller Job-Backoff; ein gescheiterter Verkaufsstopp würde OTAs sonst
        weiter verkaufen lassen). Die Absicht wird VOR dem Push in der Restriktions-
        Outbox persistiert (Cron-Backstop). No-op ohne Verbindung/Mapping. date_to
        inklusiv."""
        if not self._channex.is_configured or self._db is None or not spans:
            return False
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return False  # nicht bei Channex angelegt → kein Push (echter No-op)
        # Absicht ZUERST persistieren (VOR dem Channex-Call): ein gescheiterter
        # Verkaufsstopp darf nicht verloren gehen. Outbox-Range = Min/Max über alle
        # Spannen; die vollständigen Spannen/Tage liegen im payload (Neu-Aufbau beim
        # Cron-Retry, inkl. Selbstheilung bei nachträglichem Rate-Plan-Mapping).
        out_from = min(s for s, _ in spans)
        out_to = max(e for _, e in spans)
        payload = {
            "spans": [[s.isoformat(), e.isoformat()] for s, e in spans],
            "stop_sell": stop_sell,
            "days": days,
        }
        outbox_id = self._enqueue_restriction_outbox(
            tenant_id, property_id, "stop_sell", payload, out_from, out_to
        )
        # ALLE Rate-Plans der Property — ein Stop-Sell wirkt pro Rate-Plan; sonst
        # bleibt ein zweiter (z. B. Non-Refundable → Expedia) buchbar.
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch → Zeile bleibt
            # 'pending', der Cron zieht sie nach. True → Job-Retry statt still Erfolg.
            log.info(
                "stop_sell_push_deferred_no_rate_plan",
                tenant_id=tenant_id, property_id=property_id,
            )
            return True
        values = self._stop_sell_values(plans, spans, stop_sell, days)
        if not values:
            # Nur Vergangenheit/leerer Wochentag-Filter → nichts zu senden; Absicht
            # ist erledigt (kein echter Wert offen).
            self._mark_restriction_outbox(outbox_id, "done")
            return False
        # Trace-Kontext für den Client-Sink: eigener Push-Pfad (nicht über
        # _push_restriction_values_all_plans), damit die stop_sell-Task-ID (Test 6)
        # schon beim Sofort-Push in channex_debug_log erscheint, nicht erst per Cron.
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="restrictions"
        )
        try:
            for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                self._channex.update_restrictions(values[i : i + self._RESTRICTIONS_CHUNK])
            self._mark_restriction_outbox(outbox_id, "done")
            log.info(
                "stop_sell_push_done",
                tenant_id=tenant_id, property_id=property_id,
                stop_sell=stop_sell, spans=len(values),
            )
            return False
        except ChannexError as exc:
            # Outbox-Zeile bleibt 'pending' (Cron-Backstop); zusätzlich Job-Retry.
            log.warning(
                "stop_sell_push_failed",
                tenant_id=tenant_id, property_id=property_id, error=exc.message,
            )
            return True

    # Channex akzeptiert viele Werte je Restrictions-Request; values sind Range-
    # komprimiert (date_from/date_to), der Chunk ist nur der Backstop gegen
    # pathologisch viele Segmente — statt hunderter Einzel-Requests (429-Flut,
    # Channex-Skill: „batch, hundreds of small requests per minute is
    # abuse-shaped"). Regelfall: EIN Request.
    _RESTRICTIONS_CHUNK = 500

    def push_rates_batch(
        self,
        tenant_id: str,
        property_id: str,
        segments: list[dict[str, Any]],
    ) -> None:
        """Mehrere Preis-/Min-Stay-Intervalle eines Objekts in EINEM (bzw. wenigen
        gechunkten) Channex-Restrictions-Request pushen.

        `segments` = Liste von {date_from, date_to (inkl.), rate_cents?, min_stay?}.
        Das Channex-Mapping wird nur EINMAL aufgelöst (statt pro Intervall).
        Die Absicht wird VOR dem Push in der Restriktions-Outbox persistiert; bei
        Fehler/fehlendem Rate-Plan-Mapping bleibt sie 'pending' und der Cron zieht
        sie nach. No-op, wenn nicht verbunden oder keine Segmente."""
        if not self._channex.is_configured or self._db is None or not segments:
            return
        if not self._is_channex_managed(self._db, tenant_id, property_id):
            return  # nicht bei Channex angelegt → kein Batch-Preis-Push (No-op)
        # Trace-Kontext: Task-ID des Preis-/Restriktions-Pushes sichtbar in
        # channex_debug_log (Verlauf + Zertifizierung, Tests 2-4/8).
        self._trace_step(
            tenant_id=tenant_id, property_id=property_id, step="restrictions"
        )
        # Absicht ZUERST persistieren. Outbox-Range = Min/Max über alle Segmente;
        # die Segmente liegen im payload (Neu-Aufbau beim Cron-Retry). date_from/
        # date_to der Segmente können date oder ISO-String sein → normalisieren.
        seg_from = min(_as_iso(s["date_from"]) for s in segments)
        seg_to = max(_as_iso(s["date_to"]) for s in segments)
        payload = {"segments": [_segment_to_payload(s) for s in segments]}
        outbox_id = self._enqueue_restriction_outbox(
            tenant_id, property_id, "rate",
            payload, date.fromisoformat(seg_from), date.fromisoformat(seg_to),
        )
        # ALLE Rate-Plans der Property (nicht nur einer) — die Mappings werden
        # EINMAL aufgelöst und für alle Segmente wiederverwendet.
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        if not plans:
            # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch → Zeile bleibt
            # 'pending', der Cron zieht sie nach. Best-effort-Kontrakt (kein Return).
            log.info(
                "restriction_push_batch_deferred_no_rate_plan",
                tenant_id=tenant_id, property_id=property_id,
            )
            return
        # AKTIONEN in den gesendeten Preis rechnen — HIER und nur hier, weil dies
        # die letzte Station vor Channex ist und ALLE Preis-Pusher hier ankommen
        # (Dynamic Pricing, Datumspreise, Kalender, Kanal-Backfill). An jedem
        # Aufrufer einzeln wäre es die vierte Kopie derselben Regel.
        #
        # Der Tagespreis ist der Träger für alles, was sich AM TAG entscheiden
        # lässt (Zeitraum, keine Bedingung). Mindestaufenthalt, Frühbucher und
        # Last Minute bleiben hier draußen — sie hängen an der BUCHUNG und gingen
        # pauschal gesenkt an JEDEN Portal-Gast. Für Airbnb übernimmt sie der
        # zweite Weg (airbnb_aktionen.py: Airbnbs eigene Rabattregeln).
        faktoren = aktionsfaktor_je_tag(
            self._db,
            property_id,
            von=date.fromisoformat(seg_from),
            bis=date.fromisoformat(seg_to),
        )
        segments = _aktionen_einrechnen(segments, faktoren)

        values: list[dict[str, Any]] = []
        for seg in segments:
            rate_cents = seg.get("rate_cents")
            min_stay = seg.get("min_stay")
            if rate_cents is None and min_stay is None:
                continue
            # Rate-Plan-genaues Segment (Hotel): nur an GENAU diesen lokalen
            # Rate-Plan pushen, nicht an alle spiegeln. Ohne rate_plan_id (FeWo,
            # min_stay-Default, Dynamic Pricing) gilt weiter: an alle Pläne.
            seg_plan = seg.get("rate_plan_id")
            targets = (
                [m for m in plans if m.get("local_rate_plan_id") == seg_plan]
                if seg_plan
                else plans
            )
            for mapping in targets:
                base: dict[str, Any] = {
                    "property_id": mapping["channex_property_id"],
                    "rate_plan_id": mapping["channex_rate_plan_id"],
                }
                if rate_cents is not None:
                    base["rate"] = rate_cents
                if min_stay is not None:
                    base["min_stay_arrival"] = min_stay
                    base["min_stay_through"] = min_stay
                # Range-Syntax (Einzeltag als `date`).
                values.extend(
                    _expand_restriction_values(
                        base, _as_date(seg["date_from"]), _as_date(seg["date_to"])
                    )
                )
        if not values:
            self._mark_restriction_outbox(outbox_id, "done")
            return
        pushed = 0
        try:
            for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                chunk = values[i : i + self._RESTRICTIONS_CHUNK]
                self._channex.update_restrictions(chunk)
                pushed += len(chunk)
            self._mark_restriction_outbox(outbox_id, "done")
            # Erst NACH dem erfolgreichen Push den lokalen Ist-Spiegel
            # fortschreiben — er ersetzt das Zurücklesen der ARI bei Channex.
            self._write_ari_shadow(
                tenant_id, property_id, segments,
                [m["local_rate_plan_id"] for m in plans if m.get("local_rate_plan_id")],
            )
            log.info(
                "restriction_push_batch_done",
                tenant_id=tenant_id,
                property_id=property_id,
                intervals=pushed,
            )
        except ChannexError as exc:
            # Outbox-Zeile bleibt 'pending' (Cron-Backstop).
            log.warning(
                "restriction_push_batch_failed",
                tenant_id=tenant_id,
                property_id=property_id,
                error=exc.message,
            )

    # -- Desired-State-Reconciler für Rate-Plan-Datumspreise -------------------
    @staticmethod
    def _channex_rate_to_cents(value: str | float | None) -> int | None:
        """Ein von Channex ZURÜCKGELESENES rate-Feld zu Cent normalisieren. Achtung
        Asymmetrie (Channex-Doku): geschrieben wird `rate` als Cent-Integer (13800),
        ZURÜCK kommt es als Dezimal-String in Haupteinheit ("138.00"). Ein naiver
        Vergleich meldete sonst immer Drift. None bei fehlend/ungültig."""
        if value is None:
            return None
        try:
            return int(round(float(value) * 100))
        except (TypeError, ValueError):
            return None

    def reconcile_rate_plan_prices(
        self, tenant_id: str, property_id: str, horizon_days: int = 365
    ) -> dict[str, int]:
        """Push-only-Abgleich: vergleicht die volle Soll-Preiskurve je Plan
        (Resolver: Datumspreis > Overrides > Dynamic > Wochentag > Plan-Basis)
        gegen den LOKALEN Schatten des zuletzt gepushten Stands
        (`channex_ari_shadow`) und pusht NUR die Differenz — pro Rate-Plan.

        Channex wird dabei NICHT gelesen: wir sind die Quelle der Wahrheit, und
        Channex hat das Zurücklesen der ARI ausdrücklich untersagt. Selbstheilend
        bleibt es trotzdem: der Schatten wird erst NACH einem erfolgreichen Push
        fortgeschrieben, ein fehlgeschlagener Push bleibt also Differenz und wird
        beim nächsten Lauf erneut gesendet. No-op, wenn nicht verbunden.
        Rückgabe {checked, drift, pushed_segments}."""
        result = {"checked": 0, "drift": 0, "pushed_segments": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        plans = (
            self._resolve_channex_rate_plans(db, tenant_id, property_id)
            if self._is_channex_managed(db, tenant_id, property_id)
            else []
        )
        local_rate_plan_ids = [
            p["local_rate_plan_id"] for p in plans if p.get("local_rate_plan_id")
        ]
        if not local_rate_plan_ids:
            return result
        today = date.today()
        horizon = today + timedelta(days=horizon_days)

        # SOLL: volle Preiskurve je lokalem Rate-Plan {local_rate_plan_id:
        # {iso: cents}} — Basispreis durchgehend + Datumspreise (Resolver).
        desired = self._load_desired_rate_plan_prices(
            db, property_id, local_rate_plan_ids, today, horizon
        )
        if not any(desired.values()):
            return result

        # SOLL: datumsgenaue Mindestaufenthalte je lokalem Rate-Plan.
        desired_min = self._load_desired_rate_plan_min_stays(
            db, local_rate_plan_ids, today, horizon
        )

        # IST: unser eigener Schatten des zuletzt GEPUSHTEN Stands — kein
        # Channex-Read (siehe Docstring).
        shadow = self._load_ari_shadow(
            db, tenant_id, local_rate_plan_ids, today, horizon
        )

        # Differenz je Rate-Plan sammeln und als rate-plan-genaue Segmente pushen.
        segments: list[dict[str, Any]] = []
        for local_rp in local_rate_plan_ids:
            have_days = shadow.get(local_rp) or {}
            want = desired.get(local_rp) or {}
            price_drift = {
                iso: cents
                for iso, cents in want.items()
                if (have_days.get(iso) or {}).get("rate_cents") != cents
            }
            want_min = desired_min.get(local_rp) or {}
            min_drift = {
                iso: ms
                for iso, ms in want_min.items()
                if (have_days.get(iso) or {}).get("min_stay") != ms
            }
            checked = len(want) + len(want_min)
            drift = len(price_drift) + len(min_drift)
            result["checked"] += checked
            result["drift"] += drift
            # Sichtbaren Sync-Status je Plan festhalten (Frontend liest ihn live).
            self._write_rate_plan_sync_state(db, local_rp, drift)
            # Gleichwertige AUFEINANDERFOLGENDE Tage zu einem date_range
            # bündeln, statt je Tag ein Objekt zu senden. Die Channex-
            # Zertifizierung mahnt Einzeltag-Objekte ausdrücklich an („Use
            # date_range syntax with merged sequences"); bei Drift über einen
            # längeren Zeitraum entstanden hier hunderte davon.
            segments.extend(
                _merge_equal_value_days(price_drift, "rate_cents", local_rp)
            )
            segments.extend(
                _merge_equal_value_days(min_drift, "min_stay", local_rp)
            )
        if segments:
            self.push_rates_batch(tenant_id, property_id, segments)
            result["pushed_segments"] = len(segments)
            log.info(
                "reconcile_rate_prices_drift_pushed",
                tenant_id=tenant_id, property_id=property_id,
                checked=result["checked"], drift=result["drift"],
            )
        return result

    @staticmethod
    def _to_int(value: str | int | None) -> int | None:
        """Ein Channex-min_stay-Feld zu int normalisieren (kommt als int oder str).
        None bei fehlend/ungültig."""
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _load_desired_rate_plan_min_stays(
        self, db: Client, local_rate_plan_ids: list[str], start: date, end: date
    ) -> dict[str, dict[str, int]]:
        """Soll-Mindestaufenthalte aus rate_plan_min_stay_overrides je lokalem Rate-
        Plan im Horizont: {local_rate_plan_id: {iso: min_stay}}. Fehlt die Tabelle
        (Umgebung vor 0150), leer → kein Min-Stay-Abgleich (kein Crash)."""
        try:
            rows = (
                db.table("rate_plan_min_stay_overrides")
                .select("rate_plan_id, date, min_stay")
                .in_("rate_plan_id", local_rate_plan_ids)
                .gte("date", start.isoformat())
                .lte("date", end.isoformat())
                .not_.is_("min_stay", "null")
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = kein Min-Stay
            log.warning("rate_plan_min_stay_overrides_unavailable", error=str(exc))
            return {}
        out: dict[str, dict[str, int]] = {}
        for r in rows:
            rp = r.get("rate_plan_id")
            iso = r.get("date")
            ms = self._to_int(r.get("min_stay"))
            if rp is None or iso is None or ms is None:
                continue
            out.setdefault(str(rp), {})[str(iso)] = ms
        return out

    # -- Lokaler Schatten des zuletzt gepushten ARI-Stands ---------------------
    # Ersetzt das von Channex untersagte Zurücklesen der ARI: Ist = was WIR
    # zuletzt erfolgreich gepusht haben.
    _SHADOW_PAGE = 1000

    def _load_ari_shadow(
        self, db: Client, tenant_id: str,
        local_rate_plan_ids: list[str], start: date, end: date,
    ) -> dict[str, dict[str, dict[str, int | None]]]:
        """{local_rate_plan_id: {iso: {rate_cents, min_stay}}} aus dem Schatten.
        Seitenweise gelesen — ein Horizont über mehrere Pläne überschreitet die
        PostgREST-Zeilengrenze, und eine abgeschnittene Seite hieße unnötige
        Wiederholungs-Pushes. Fehlt die Tabelle (Umgebung vor 0246), leer: dann
        gilt alles als Differenz und wird einmalig neu gepusht (kein Crash)."""
        out: dict[str, dict[str, dict[str, int | None]]] = {}
        offset = 0
        while True:
            try:
                rows = (
                    db.table("channex_ari_shadow")
                    .select("rate_plan_id, date, rate_cents, min_stay")
                    .eq("tenant_id", tenant_id)
                    .in_("rate_plan_id", local_rate_plan_ids)
                    .gte("date", start.isoformat())
                    .lte("date", end.isoformat())
                    .order("rate_plan_id")
                    .order("date")
                    .range(offset, offset + self._SHADOW_PAGE - 1)
                    .execute()
                ).data or []
            except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = leerer Ist
                log.warning("channex_ari_shadow_unavailable", error=str(exc)[:200])
                return {}
            for r in rows:
                out.setdefault(str(r["rate_plan_id"]), {})[str(r["date"])] = {
                    "rate_cents": self._to_int(r.get("rate_cents")),
                    "min_stay": self._to_int(r.get("min_stay")),
                }
            if len(rows) < self._SHADOW_PAGE:
                return out
            offset += self._SHADOW_PAGE

    def seed_ari_shadow(
        self, tenant_id: str, property_id: str, horizon_days: int = 365
    ) -> dict[str, int]:
        """EINMALIGE Erstbefüllung des Schattens aus dem Soll — ohne zu pushen.

        Nötig genau einmal bei der Einführung von 0246: bis dahin hielt der alte
        Abgleich (mit Channex-Readback) den Kanal auf dem Soll-Stand, der Schatten
        ist aber leer. Ohne diese Befüllung gälte beim ersten Lauf die komplette
        Preiskurve als Differenz und würde am Stück neu gesendet — genau die
        Request-Flut, die wir abstellen. Bewusst KEIN Automatismus im normalen
        Lauf: ein neu verbundenes Objekt MUSS seine Preise initial senden.
        Rückgabe {rate_plans, days}."""
        result = {"rate_plans": 0, "days": 0}
        if self._db is None:
            return result
        db = self._db
        plans = (
            self._resolve_channex_rate_plans(db, tenant_id, property_id)
            if self._is_channex_managed(db, tenant_id, property_id)
            else []
        )
        local_ids = [p["local_rate_plan_id"] for p in plans if p.get("local_rate_plan_id")]
        if not local_ids:
            return result
        today = date.today()
        horizon = today + timedelta(days=horizon_days)
        desired = self._load_desired_rate_plan_prices(
            db, property_id, local_ids, today, horizon
        )
        desired_min = self._load_desired_rate_plan_min_stays(
            db, local_ids, today, horizon
        )
        for local_rp in local_ids:
            prices = desired.get(local_rp) or {}
            min_stays = desired_min.get(local_rp) or {}
            segments: list[dict[str, Any]] = []
            segments.extend(_merge_equal_value_days(prices, "rate_cents", local_rp))
            segments.extend(_merge_equal_value_days(min_stays, "min_stay", local_rp))
            if not segments:
                continue
            self._write_ari_shadow(tenant_id, property_id, segments, [local_rp])
            result["rate_plans"] += 1
            result["days"] += len(prices) + len(min_stays)
        log.info(
            "channex_ari_shadow_seeded",
            tenant_id=tenant_id, property_id=property_id, **result,
        )
        return result

    def _write_ari_shadow(
        self, tenant_id: str, property_id: str, segments: list[dict[str, Any]],
        rate_plan_ids: list[str],
    ) -> None:
        """Den soeben ERFOLGREICH gepushten Stand festschreiben. `segments` sind
        dieselben Intervalle, die an Channex gingen; ein Segment ohne
        `rate_plan_id` galt für alle Pläne des Objekts und wird entsprechend für
        alle gespiegelt. Preis- und Min-Stay-Zeilen werden GETRENNT geschrieben,
        damit ein reiner Min-Stay-Push den gespiegelten Preis nicht auf NULL
        zurücksetzt. Best-effort: ein Schreibfehler darf den Push nicht kippen
        (Wurzel 5) — der Tag gilt dann beim nächsten Lauf erneut als Differenz."""
        if self._db is None or not segments or not rate_plan_ids:
            return
        rate_rows: list[dict[str, Any]] = []
        min_rows: list[dict[str, Any]] = []
        for seg in segments:
            rate_cents = seg.get("rate_cents")
            min_stay = seg.get("min_stay")
            if rate_cents is None and min_stay is None:
                continue
            seg_plan = seg.get("rate_plan_id")
            targets = [seg_plan] if seg_plan else rate_plan_ids
            days = _iso_days(_as_iso(seg["date_from"]), _as_iso(seg["date_to"]))
            for plan_id in targets:
                if plan_id not in rate_plan_ids:
                    continue
                for iso in days:
                    key = {
                        "tenant_id": tenant_id,
                        "property_id": property_id,
                        "rate_plan_id": plan_id,
                        "date": iso,
                        # Beim UPDATE-Zweig des Upserts greift der Spalten-Default
                        # (now()) nicht — ohne dieses Feld trüge ein aktualisierter
                        # Spiegel-Eintrag für immer seinen Anlage-Zeitpunkt und
                        # wäre als Diagnose („wann zuletzt gepusht?") wertlos.
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                    if rate_cents is not None:
                        rate_rows.append({**key, "rate_cents": int(rate_cents)})
                    if min_stay is not None:
                        min_rows.append({**key, "min_stay": int(min_stay)})
        for rows in (rate_rows, min_rows):
            for i in range(0, len(rows), self._SHADOW_PAGE):
                try:
                    self._db.table("channex_ari_shadow").upsert(
                        rows[i : i + self._SHADOW_PAGE],
                        on_conflict="tenant_id,rate_plan_id,date",
                    ).execute()
                except Exception as exc:  # noqa: BLE001 — Spiegel nie den Push kippen
                    log.warning(
                        "channex_ari_shadow_write_failed",
                        tenant_id=tenant_id, property_id=property_id,
                        error=str(exc)[:200],
                    )
                    return

    def _write_ari_shadow_for_range(
        self, tenant_id: str, property_id: str, fields: dict[str, Any],
        date_from: date, date_to: date,
    ) -> None:
        """Den Ist-Spiegel für einen SOFORT gepushten Zeitraum fortschreiben.

        `fields` sind die Channex-Restriction-Felder des Pushes; interessant für
        den Spiegel sind nur Preis (`rate`) und Mindestaufenthalt
        (`min_stay_arrival`). Alles andere (CTA/CTD, max_stay) führt der Spiegel
        nicht. `date_to` ist inklusiv — genau wie in den push_*-Methoden und in
        `_iso_days`, das der Spiegel-Schreiber benutzt."""
        rate_cents = fields.get("rate")
        min_stay = fields.get("min_stay_arrival")
        if rate_cents is None and min_stay is None or self._db is None:
            return
        plans = self._resolve_channex_rate_plans(self._db, tenant_id, property_id)
        lokale = [p["local_rate_plan_id"] for p in plans if p.get("local_rate_plan_id")]
        if not lokale:
            return
        segment = {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "rate_cents": rate_cents,
            "min_stay": min_stay,
        }
        self._write_ari_shadow(tenant_id, property_id, [segment], lokale)

    def _write_rate_plan_sync_state(
        self, db: Client, rate_plan_id: str, drift_count: int
    ) -> None:
        """Sync-Status eines Rate-Plans festhalten (in_sync = kein Drift). Best-
        effort: ein Statuschreib-Fehler darf den Reconcile-Push nicht kippen
        (Wurzel 5). checked_at markiert den Zeitpunkt des letzten Abgleichs."""
        try:
            db.table("rate_plan_sync_state").upsert(
                {
                    "rate_plan_id": rate_plan_id,
                    "in_sync": drift_count == 0,
                    "drift_count": drift_count,
                    "checked_at": datetime.now(UTC).isoformat(),
                },
                on_conflict="rate_plan_id",
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Status nie den Hauptpfad kippen
            log.warning("rate_plan_sync_state_write_failed", error=str(exc)[:200])

    def _load_desired_rate_plan_prices(
        self, db: Client, property_id: str,
        local_rate_plan_ids: list[str], start: date, end: date,
    ) -> dict[str, dict[str, int]]:
        """Soll-Preiskurve je lokalem Rate-Plan im Horizont [start, end]:
        {local_rate_plan_id: {iso: cents}} — die VOLLE Kurve aus dem zentralen
        Resolver (Datumspreis > Objekt-Override > Dynamic > Wochentag >
        Plan-Basispreis), nicht nur die Datumspreise. Sonst heilt der Reconciler
        den durchgehenden Plan-Grundpreis nie und ein property-weiter Push kann
        B&B/BAR dauerhaft mit der falschen Kurve überschreiben. Tage ohne
        auflösbaren Preis (kein Basispreis, kein Override) fließen nicht ins
        Soll ein — kein erfundener Preis (Wurzel 4)."""
        from src.features.pricing.resolver import (  # noqa: PLC0415
            PricingError,
            PricingResolver,
        )

        resolver = PricingResolver(service_client=db)
        out: dict[str, dict[str, int]] = {}
        for rp in local_rate_plan_ids:
            try:
                days = resolver.effective_prices(
                    property_id, start, end + timedelta(days=1), rate_plan_id=rp
                )
            except PricingError:
                # Mapping zeigt auf einen gelöschten/fremden Plan → diesen Plan
                # überspringen, nicht den ganzen Reconcile kippen (Wurzel 5).
                log.warning(
                    "reconcile_rate_plan_missing",
                    property_id=property_id, rate_plan_id=rp,
                )
                continue
            # DIESELBE Aktions-Senkung wie beim Push (push_rates_batch). Ohne sie
            # sähe der Reconciler den rabattierten Preis bei Channex als „Drift"
            # und würde ihn auf den Listenpreis zurückschreiben — der Rabatt wäre
            # nach dem nächsten Abgleich wieder weg (Wurzel 1: Soll und Ist müssen
            # dieselbe Rechnung sein).
            faktoren = aktionsfaktor_je_tag(db, property_id, von=start, bis=end)
            curve: dict[str, int] = {}
            for entry in days:
                if entry.price is None:
                    continue
                cents = int(round(float(entry.price) * 100))
                if cents <= 0:
                    continue
                iso = entry.date.isoformat()
                faktor = faktoren.get(iso)
                if faktor is not None:
                    cents = max(1, int(round(cents * faktor)))
                curve[iso] = cents
            out[rp] = curve
        return out

    @staticmethod
    def _restriction_row_fields(row: dict[str, Any]) -> dict[str, Any]:
        """Eine generische Restriktions-Zeile in Channex-Felder übersetzen. Nur
        gesetzte Felder (None überspringen). min_stay → min_stay_arrival+through
        (getrennte Werte wären ein eigenes Feld). Dieselbe Übersetzung wie
        push_restrictions_for_property/push_rates_batch — hier für die generische
        Zeilen-Liste (Zertifizierung Test 3-8: heterogene Restriktionen in 1 Call)."""
        fields: dict[str, Any] = {}
        rate_cents = row.get("rate_cents")
        if rate_cents is not None:
            fields["rate"] = rate_cents
        min_stay = row.get("min_stay")
        if min_stay is not None:
            fields["min_stay_arrival"] = min_stay
            fields["min_stay_through"] = min_stay
        max_stay = row.get("max_stay")
        if max_stay is not None:
            fields["max_stay"] = max(0, int(max_stay))
        if row.get("closed_to_arrival") is not None:
            fields["closed_to_arrival"] = bool(row["closed_to_arrival"])
        if row.get("closed_to_departure") is not None:
            fields["closed_to_departure"] = bool(row["closed_to_departure"])
        if row.get("stop_sell") is not None:
            fields["stop_sell"] = bool(row["stop_sell"])
        return fields

    def push_restriction_rows_for_property(
        self,
        tenant_id: str,
        property_id: str,
        rows: list[dict[str, Any]],
    ) -> None:
        """Eine HETEROGENE Liste von Restriktions-Zeilen EINES Objekts in einem
        Channex-Request pushen — dünner Wrapper um push_restriction_rows_multi
        (ein Objekt = eine Gruppe). Jede Zeile: {date_from, date_to (inkl.),
        rate_cents?, min_stay?, max_stay?, closed_to_arrival?,
        closed_to_departure?, stop_sell?, rate_plan_id?}."""
        self.push_restriction_rows_multi(tenant_id, {property_id: rows})

    def push_restriction_rows_multi(
        self,
        tenant_id: str,
        rows_by_property: dict[str, list[dict[str, Any]]],
    ) -> None:
        """Heterogene Restriktions-Zeilen MEHRERER Objekte (Hotel: Zimmer) in so
        wenigen Channex-Calls wie möglich pushen: die values werden je
        channex_property_id gebündelt — teilen sich die Zimmer EINE Channex-
        Property (0158), ist die gesamte Aktion EIN POST /restrictions
        (Zertifizierung Tests 3-8: „1 API call" über Room-Types hinweg). Channex
        erlaubt nur EINE property_id je Request („Only one ID per request"),
        daher je Channex-Property genau ein Call. Die Absicht wird je Objekt VOR
        dem Push in der Restriktions-Outbox persistiert (Cron-Backstop; der
        Retry läuft dann ggf. je Objekt einzeln — Korrektheit vor Call-Zahl)."""
        if not self._channex.is_configured or self._db is None or not rows_by_property:
            return
        db = self._db
        grouped: dict[str, dict[str, list[Any]]] = {}
        for property_id, rows in rows_by_property.items():
            if not rows or not self._is_channex_managed(db, tenant_id, property_id):
                continue
            outbox_id = self._enqueue_restriction_outbox(
                tenant_id, property_id, "restriction_rows", {"rows": rows},
                min(_as_date(r["date_from"]) for r in rows),
                max(_as_date(r["date_to"]) for r in rows),
            )
            plans = self._resolve_channex_rate_plans(db, tenant_id, property_id)
            if not plans:
                # BUG 9: managed, aber Rate-Plan-Mapping fehlt noch → Zeile bleibt
                # 'pending', der Cron zieht sie nach.
                log.info(
                    "restriction_rows_deferred_no_rate_plan",
                    tenant_id=tenant_id, property_id=property_id,
                )
                continue
            values: list[dict[str, Any]] = []
            for row in rows:
                fields = self._restriction_row_fields(row)
                if not fields:
                    continue
                values.extend(
                    _restriction_values(
                        plans, fields, _as_date(row["date_from"]),
                        _as_date(row["date_to"]),
                        rate_plan_id=row.get("rate_plan_id"),
                    )
                )
            bucket = grouped.setdefault(
                plans[0]["channex_property_id"],
                {"values": [], "outbox": [], "pids": []},
            )
            bucket["values"].extend(values)
            bucket["outbox"].append(outbox_id)
            bucket["pids"].append(property_id)
        for bucket in grouped.values():
            self._push_restriction_bucket(tenant_id, bucket)

    def _push_restriction_bucket(
        self, tenant_id: str, bucket: dict[str, list[Any]]
    ) -> None:
        """Die gebündelten values EINER Channex-Property senden und die
        zugehörigen Outbox-Zeilen abschließen. Bei Channex-Fehler bleiben ALLE
        Zeilen des Buckets 'pending' (Cron-Backstop je Objekt)."""
        if not bucket["values"]:
            for oid in bucket["outbox"]:
                self._mark_restriction_outbox(oid, "done")
            return
        self._trace_step(
            tenant_id=tenant_id, property_id=bucket["pids"][0], step="restrictions"
        )
        try:
            for i in range(0, len(bucket["values"]), self._RESTRICTIONS_CHUNK):
                self._channex.update_restrictions(
                    bucket["values"][i : i + self._RESTRICTIONS_CHUNK]
                )
            for oid in bucket["outbox"]:
                self._mark_restriction_outbox(oid, "done")
            log.info(
                "restriction_rows_push_done",
                tenant_id=tenant_id, properties=len(bucket["pids"]),
                values=len(bucket["values"]),
            )
        except ChannexError as exc:
            # Outbox-Zeilen bleiben 'pending' (Cron-Backstop).
            log.warning(
                "restriction_rows_push_failed",
                tenant_id=tenant_id, error=exc.message,
            )

    @staticmethod
    def _superseding_days_by_row(rows: list[dict]) -> dict[str, set[str]]:
        """Je pending-Zeile die Tage, die von einer NEUEREN Zeile (späterer Index
        bei created_at-Sortierung) desselben Objekts abgedeckt sind. TAG-GENAU:
        eine ältere Zeile wird nur für die überlappenden Tage übersprungen, ihre
        übrigen Tage gehen weiterhin an Channex (Teil-Überlappung verliert keine
        Tage). 1 Objekt = 1 Einheit → eine Superseding-Domäne je Objekt."""
        by_row: dict[str, set[str]] = {}
        day_lists = [
            _iso_days(str(r["date_from"]), str(r["date_to"])) for r in rows
        ]
        for i, older in enumerate(rows):
            covered: set[str] = set()
            older_days = set(day_lists[i])
            for j in range(i + 1, len(rows)):
                if rows[j]["property_id"] != older["property_id"]:
                    continue
                covered |= older_days & set(day_lists[j])
            by_row[older["id"]] = covered
        return by_row

    def process_ari_outbox(self, limit: int = 200) -> dict[str, int]:
        """Offene ari_outbox-Zeilen erneut an Channex pushen (Cron-Retry).
        Idempotent (absoluter Set-Wert je Tag). Superseding TAG-GENAU: von einer
        neueren Absicht abgedeckte Tage werden übersprungen, die restlichen Tage
        der Zeile aber weiterhin gepusht (keine verlorene Freigabe)."""
        result = {"processed": 0, "done": 0, "failed": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        rows = (
            db.table("ari_outbox")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(limit)
            .execute()
        ).data or []
        superseding = self._superseding_days_by_row(rows)
        for r in rows:
            result["processed"] += 1
            mapping = self._resolve_channex_room_type(
                db, r["tenant_id"], r["property_id"]
            )
            if mapping is None:
                # „kein Mapping" ist PERMANENT (nie angelegt oder soft-deleted) →
                # nichts zu pushen. Als done abhaken (übersprungen), damit der Cron
                # nicht endlos retryt. _resolve_channex_room_type prüft bereits
                # deleted_at IS NULL (deckt _is_channex_managed ab).
                db.table("ari_outbox").update(
                    {"status": "done",
                     "last_error": "nicht bei Channex angelegt (übersprungen)"}
                ).eq("id", r["id"]).execute()
                result["done"] += 1
                continue
            # Nur die Tage pushen, die keine NEUERE Zeile abdeckt. Superseding aus
            # ZWEI Quellen vereinigen: (1) die Batch-lokalen pending-Zeilen und
            # (2) neuere pending/done-Zeilen aus der DB (_newer_covered_days). Ohne
            # (2) sähe der Cron eine bereits erfolgreich gepushte NEUERE done-Zeile
            # (z. B. neue Buchung avail=0) nicht und würde eine ältere pending-Zeile
            # (z. B. Storno-Freigabe avail=1) für dieselben Tage pushen → er
            # überschreibt das jüngere avail=0 und öffnet einen gebuchten Tag wieder
            # bei den OTAs. Symmetrisch zum schnellen push_availability-Pfad.
            superseded_days = superseding.get(r["id"], set()) | self._newer_covered_days(
                db, r["property_id"], str(r.get("created_at") or ""), r["id"],
            )
            days = set(_iso_days(str(r["date_from"]), str(r["date_to"])))
            push_ranges = _group_iso_days_to_ranges(days - superseded_days)
            if not push_ranges:
                # Komplett von neueren Absichten überholt → nichts pushen, abhaken.
                db.table("ari_outbox").update(
                    {"status": "done", "last_error": "superseded (neuere Absicht)"}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
                continue
            # Trace-Kontext je Zeile: Task-ID des availability-Pushes wird sichtbar
            # in channex_debug_log geschrieben (Verlauf + Zertifizierung).
            self._trace_step(
                tenant_id=r["tenant_id"], property_id=r["property_id"],
                step="availability",
            )
            try:
                # ALLE Ranges dieser Zeile in EINEM Request (s. schneller Pfad).
                self._channex.update_availability(
                    [
                        {
                            "property_id": mapping["channex_property_id"],
                            "room_type_id": mapping["channex_room_type_id"],
                            "date_from": r_from,
                            "date_to": r_to,
                            "availability": r["availability"],
                        }
                        for r_from, r_to in push_ranges
                    ]
                )
                # Guard status='pending' wie in den übrigen Zweigen: arbeitet der
                # schnelle push_availability_for_property-Pfad dieselbe Zeile
                # nebenläufig ab, darf der Cron ihren Zustand/attempts-Zähler nicht
                # blind überschreiben (konsistenter attempts-/last_error-Verlauf).
                db.table("ari_outbox").update(
                    {"status": "done", "attempts": (r["attempts"] or 0) + 1}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
            except ChannexError as exc:
                attempts = (r["attempts"] or 0) + 1
                # Nach 10 Versuchen aufgeben (failed), sonst weiter pending.
                new_status = "failed" if attempts >= 10 else "pending"
                # Guard status='pending' wie in den Erfolgs-Zweigen: arbeitet der
                # schnelle push_availability_for_property-Pfad dieselbe Zeile
                # nebenläufig ab und hat sie bereits erfolgreich auf 'done' gesetzt,
                # darf dieser Cron-Fehler sie NICHT auf 'failed'/'pending'
                # zurückkippen — sonst zählt _newer_covered_days sie erneut als
                # aktiven Supersessor (done→failed) bzw. der Push liefe doppelt.
                db.table("ari_outbox").update(
                    {"status": new_status, "attempts": attempts, "last_error": exc.message}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                if new_status == "failed":
                    result["failed"] += 1
        if result["processed"]:
            log.info("ari_outbox_processed", **result)
        return result

    def _restriction_values_from_row(
        self, row: dict[str, Any], plans: list[dict[str, str]]
    ) -> list[dict[str, Any]]:
        """Aus einer persistierten Restriktions-Outbox-Zeile (kind + payload) und den
        AKTUELL aufgelösten Rate-Plans die Channex-restriction-values neu aufbauen.
        Selbstheilung: das Rate-Plan-Mapping wird beim Retry frisch übergeben — eine
        Zeile, die beim Ersteinstellen noch kein Mapping hatte, wird jetzt bespielt.
        Leere Liste, wenn nichts (mehr) zu senden ist."""
        kind = row["kind"]
        payload = row.get("payload") or {}
        date_from = _as_date(row["date_from"])
        date_to = _as_date(row["date_to"])
        if kind == "stop_sell":
            spans = [
                (_as_date(a), _as_date(b)) for a, b in (payload.get("spans") or [])
            ]
            return self._stop_sell_values(
                plans, spans, bool(payload.get("stop_sell")), payload.get("days")
            )
        if kind == "rate" and payload.get("segments") is not None:
            # push_rates_batch-Ursprung: mehrere Segmente in EINER Zeile.
            values: list[dict[str, Any]] = []
            for seg in payload["segments"]:
                fields = _rate_fields(seg.get("rate_cents"), seg.get("min_stay"))
                if not fields:
                    continue
                values.extend(
                    _restriction_values(
                        plans, fields, _as_date(seg["date_from"]),
                        _as_date(seg["date_to"]), seg.get("rate_plan_id"),
                    )
                )
            return values
        if kind == "restriction_rows" and payload.get("rows") is not None:
            # push_restriction_rows_for_property-Ursprung: heterogene Zeilen
            # (rate/min_stay/max_stay/CTA/CTD/stop_sell je Zeile eigen) in EINER
            # Outbox-Zeile — beim Cron-Retry pro Zeile neu expandieren.
            row_values: list[dict[str, Any]] = []
            for r in payload["rows"]:
                fields = self._restriction_row_fields(r)
                if not fields:
                    continue
                row_values.extend(
                    _restriction_values(
                        plans, fields, _as_date(r["date_from"]), _as_date(r["date_to"]),
                        rate_plan_id=r.get("rate_plan_id"),
                    )
                )
            return row_values
        fields = _restriction_fields_from_payload(kind, payload)
        if not fields:
            return []
        return _restriction_values(plans, fields, date_from, date_to)

    def process_restriction_outbox(self, limit: int = 200) -> dict[str, int]:
        """Offene ari_restriction_outbox-Zeilen erneut an Channex pushen (Cron-Retry,
        dauerhafter Backstop für Stop-Sell/Rate/Min-Stay/Max-Stay/CTA-CTD). Baut die
        values je Zeile aus dem persistierten kind+payload NEU auf und löst das Rate-
        Plan-Mapping frisch auf (Selbstheilung: eine Zeile ohne Mapping beim
        Ersteinstellen wird bespielt, sobald der Rate-Plan-Import gelaufen ist).
        Nach 10 Versuchen ohne Mapping/mit Fehler → 'failed'."""
        result = {"processed": 0, "done": 0, "failed": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        rows = (
            db.table("ari_restriction_outbox")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .limit(limit)
            .execute()
        ).data or []
        for r in rows:
            result["processed"] += 1
            tenant_id, property_id = r["tenant_id"], r["property_id"]
            # Superseding TAG-GENAU: die von einer NEUEREN Zeile desselben
            # (property_id, kind) abgedeckten Tage werden übersprungen, die
            # RESTLICHEN Tage dieser Zeile gehen weiter an Channex. Sonst würde eine
            # schmale neuere Zeile (z. B. Preis 15.–16.) den weiten älteren Wert
            # (1.–31.) für dessen GESAMTEN Zeitraum unterdrücken → 29 Tage bleiben
            # stale (Falschpreis/-Sperre an OTAs). Ist die Zeile KOMPLETT überdeckt,
            # abhaken (nichts mehr zu pushen).
            superseded_days = self._superseded_restriction_days(db, r)
            own_days = self._restriction_row_days(r)
            if own_days and own_days <= superseded_days:
                db.table("ari_restriction_outbox").update(
                    {"status": "done", "last_error": "superseded (neuere Absicht)"}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
                continue
            if not self._is_channex_managed(db, tenant_id, property_id):
                # Nicht (mehr) bei Channex angelegt → nichts zu pushen, abhaken
                # (kein Endlos-Retry). Analog zu process_ari_outbox.
                db.table("ari_restriction_outbox").update(
                    {"status": "done",
                     "last_error": "nicht bei Channex angelegt (übersprungen)"}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
                continue
            plans = self._resolve_channex_rate_plans(db, tenant_id, property_id)
            attempts = (r.get("attempts") or 0) + 1
            if not plans:
                # BUG 9: managed, aber Rate-Plan-Mapping fehlt weiterhin → 'pending'
                # lassen (weiter warten), bis der Import es anlegt; erst nach 10
                # Versuchen aufgeben, damit eine dauerhaft kaputte Zeile nicht ewig
                # retryt.
                self._bump_restriction_attempts(
                    r, attempts, "Rate-Plan-Mapping fehlt noch", result
                )
                continue
            # Trace-Kontext je Zeile: Task-ID des restrictions-Pushes sichtbar
            # in channex_debug_log (Verlauf + Zertifizierung).
            self._trace_step(
                tenant_id=tenant_id, property_id=property_id, step="restrictions"
            )
            try:
                values = self._restriction_values_from_row(r, plans)
                # Von einer neueren Zeile abgedeckte Tage herausfiltern (tag-genau,
                # Range-values werden dafür zerschnitten).
                values = _exclude_superseded_days(values, superseded_days)
                for i in range(0, len(values), self._RESTRICTIONS_CHUNK):
                    self._channex.update_restrictions(
                        values[i : i + self._RESTRICTIONS_CHUNK]
                    )
                db.table("ari_restriction_outbox").update(
                    {"status": "done", "attempts": attempts}
                ).eq("id", r["id"]).eq("status", "pending").execute()
                result["done"] += 1
            except ChannexError as exc:
                self._bump_restriction_attempts(r, attempts, exc.message, result)
        if result["processed"]:
            log.info("ari_restriction_outbox_processed", **result)
        return result

    @staticmethod
    def _restriction_row_days(row: dict[str, Any]) -> set[str]:
        """Die von einer Restriktions-Outbox-Zeile TATSÄCHLICH abgedeckten ISO-Tage.
        stop_sell (spans) und rate (segments) tragen ihre echten Tage im payload —
        so werden Lücken zwischen disjunkten Spans/Segmenten NICHT als abgedeckt
        gezählt (sonst würde ein älterer Wert für einen Lückentag fälschlich
        superseded). Generische Zeilen decken date_from..date_to durchgehend ab."""
        payload = row.get("payload") or {}
        days: set[str] = set()
        if row["kind"] == "stop_sell" and payload.get("spans"):
            for a, b in payload["spans"]:
                days.update(_iso_days(str(a), str(b)))
            return days
        if row["kind"] == "rate" and payload.get("segments") is not None:
            for seg in payload["segments"]:
                days.update(_iso_days(str(seg["date_from"]), str(seg["date_to"])))
            return days
        if row["kind"] == "restriction_rows" and payload.get("rows") is not None:
            for r in payload["rows"]:
                days.update(_iso_days(str(r["date_from"]), str(r["date_to"])))
            return days
        return set(_iso_days(str(row["date_from"]), str(row["date_to"])))

    @staticmethod
    def _rate_row_plan_ids(row: dict[str, Any]) -> set[str | None]:
        """Die von einer rate-Zeile betroffenen lokalen Rate-Plans. Ein Segment mit
        rate_plan_id zielt auf GENAU diesen Plan (Hotel-Datumspreis); None = property-
        weit (min_stay-Default u. ä., gilt für alle Pläne). Andere kinds: {None}."""
        payload = row.get("payload") or {}
        if row.get("kind") == "rate" and payload.get("segments") is not None:
            return {seg.get("rate_plan_id") for seg in payload["segments"]}
        return {None}

    def _superseded_restriction_days(
        self, db: Client, row: dict[str, Any]
    ) -> set[str]:
        """ISO-Tage dieser Zeile, die von einer NEUEREN Outbox-Zeile desselben
        (property_id, kind) abgedeckt sind (created_at später). TAG-GENAU wie der
        Availability-Pfad (_newer_covered_days): nur die überlappenden Tage werden
        übersprungen, die restlichen Tage der Zeile gehen weiter an Channex — sonst
        unterdrückt eine schmale neuere Zeile (z. B. Preis für 15.–16.) den weiten
        älteren Wert (1.–31.) für dessen GESAMTEN Zeitraum (stale Falschpreis/-Sperre
        an OTAs). Nur pending/done zählen als gültiger Supersessor (failed nie).

        Bei rate-Zeilen zusätzlich PRO RATE-PLAN getrennt: ein Datumspreis für
        Twin/BAR darf einen gleichzeitigen Double/B&B-Preis NICHT verdrängen (Hotel,
        rate-plan-genau). Ein property-weites Segment (rate_plan_id None, z. B.
        min_stay) supersediert/wird supersediert plan-übergreifend."""
        created_at = str(row.get("created_at") or "")
        if not created_at:
            return set()
        own_days = self._restriction_row_days(row)
        own_plans = self._rate_row_plan_ids(row)
        newer_rows = (
            db.table("ari_restriction_outbox")
            .select("kind, payload, date_from, date_to")
            .eq("property_id", row["property_id"])
            .eq("kind", row["kind"])
            .gt("created_at", created_at)
            .in_("status", ["pending", "done"])
            .lte("date_from", str(row["date_to"]))
            .gte("date_to", str(row["date_from"]))
            .neq("id", row["id"])
            .execute()
        ).data or []
        covered: set[str] = set()
        for nr in newer_rows:
            newer_plans = self._rate_row_plan_ids(nr)
            # Nur superseden, wenn die neuere Zeile denselben Rate-Plan trifft — oder
            # eine der beiden property-weit (None) ist. Sonst kollidieren Datumspreise
            # verschiedener Rate-Plans desselben Objekts fälschlich.
            if own_plans & newer_plans or None in own_plans or None in newer_plans:
                covered |= self._restriction_row_days(nr)
        return own_days & covered

    def _bump_restriction_attempts(
        self, row: dict[str, Any], attempts: int, error: str, result: dict[str, int]
    ) -> None:
        """attempts erhöhen und nach 10 Versuchen auf 'failed' schalten, sonst
        'pending' lassen (Guard status='pending'). Zählt fehlgeschlagene Zeilen."""
        new_status = "failed" if attempts >= 10 else "pending"
        self._db.table("ari_restriction_outbox").update(
            {"status": new_status, "attempts": attempts, "last_error": error}
        ).eq("id", row["id"]).eq("status", "pending").execute()
        if new_status == "failed":
            result["failed"] += 1

    # -- DB-Mapping-Lookups ----------------------------------------------------
    def _room_type_mapping(
        self, db: Client, tenant_id: str, room_type_map_id: str
    ) -> dict[str, str] | None:
        rt = (
            db.table("channex_room_type_map")
            .select("channex_room_type_id, property_map_id")
            .eq("id", room_type_map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not rt.data:
            return None
        prop = self._channex_property_id(db, tenant_id, rt.data[0]["property_map_id"])
        if not prop:
            return None
        return {
            "channex_property_id": prop,
            "channex_room_type_id": rt.data[0]["channex_room_type_id"],
            "property_map_id": rt.data[0]["property_map_id"],
        }

    def _rate_plan_mapping(
        self, db: Client, tenant_id: str, rate_plan_map_id: str
    ) -> dict[str, str] | None:
        rp = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id, room_type_map_id")
            .eq("id", rate_plan_map_id)
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        if not rp.data:
            return None
        rt = (
            db.table("channex_room_type_map")
            .select("property_map_id")
            .eq("id", rp.data[0]["room_type_map_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not rt.data:
            return None
        prop = self._channex_property_id(db, tenant_id, rt.data[0]["property_map_id"])
        if not prop:
            return None
        return {
            "channex_property_id": prop,
            "channex_rate_plan_id": rp.data[0]["channex_rate_plan_id"],
            "property_map_id": rt.data[0]["property_map_id"],
        }

    def _channex_property_id(
        self, db: Client, tenant_id: str, property_map_id: str
    ) -> str | None:
        pm = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("id", property_map_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        return pm.data[0]["channex_property_id"] if pm.data else None
