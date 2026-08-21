"""Service für externe iCal-Kalender (Belegungs-Sync).

Der Kunde abonniert pro Objekt externe .ics-Feeds; ein Sync liest sie und traegt
belegte Naechte als availability (status='blocked', source='ical') ein. Kein
Datenimport — nur Verfuegbarkeit.

Sicherheit (Wurzel 3/5): die iCal-URL kommt vom Kunden → SSRF-Schutz (kein
Zugriff auf interne/private Adressen), tenant-Scope auf property + calendar,
Fehler werden am Feed sichtbar gemacht statt verschluckt. Idempotenz (Wurzel 2):
availability-Upsert per (property_id, date); Gegenzustand (Wurzel 1): Naechte,
die NICHT mehr im Feed sind, werden aus den ical-Sperren dieses Feeds entfernt.
"""
from __future__ import annotations

import secrets
from datetime import date
from urllib.parse import urlparse

import httpx
from supabase import Client

from src.core.ausgehende_url import (
    UnsichereUrl,
    host_header,
    host_pinnen,
    oeffentliche_ips,
)
from src.core.dates import merge_day_ranges
from src.core.einheiten import AVAILABILITY_CONFLICT, je_einheit
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.jobs.queue import try_enqueue_ari

from .ical import ExportEvent, build_ical, parse_ical

log = get_logger("nextdays.external_calendar")

_SYNC_TIMEOUT = 20.0
_MAX_ICAL_BYTES = 5_000_000  # 5 MB Deckel — ein Belegungsfeed ist winzig
_MAX_REDIRECTS = 5


class ExternalCalendarError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _resolve_public(url: str) -> list[str]:
    """SSRF-Schutz über den gemeinsamen Kern (`core.ausgehende_url`).

    Die Prüfung selbst (Schema, Auflösung, jede IP öffentlich, IPv4-mapped,
    CGNAT) liegt dort — sie war früher hier UND in `features/mcp` als eigene
    Kopie vorhanden, und zwei Kopien einer Sicherheitsprüfung laufen
    auseinander. Hier bleibt nur die Übersetzung in den Slice-Fehler, damit der
    Aufrufer weiterhin sein 422 bekommt.
    """
    try:
        return oeffentliche_ips(url)
    except UnsichereUrl as exc:
        raise ExternalCalendarError(exc.grund, status_code=422) from exc


def _assert_public_url(url: str) -> None:
    """Eingangs-Validierung (Anlegen): URL muss auf eine öffentliche Adresse
    zeigen. Der eigentliche Fetch pinnt sich zusätzlich auf die IP (`_fetch`)."""
    _resolve_public(url)


class ExternalCalendarService:
    slice_name = "external_calendar"

    def __init__(self, *, service_client: Client | None = None) -> None:
        self._db = service_client

    def health(self):  # noqa: ANN201
        from .schemas import SliceHealth
        return SliceHealth(status="ok")

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise ExternalCalendarError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise ExternalCalendarError("DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    def _own_property(self, db: Client, tenant_id: str, property_id: str) -> None:
        """Objekt MUSS dem Tenant gehören (Wurzel 3: Service-Role umgeht RLS)."""
        rows = (
            db.table("properties").select("id")
            .eq("id", property_id).eq("tenant_id", tenant_id)
            .limit(1).execute()
        ).data
        if not rows:
            raise ExternalCalendarError("Objekt nicht gefunden.", status_code=404)

    # -- Verwaltung ---------------------------------------------------------
    def list_calendars(self, ctx: AuthContext, property_id: str) -> list[dict]:
        db, tenant_id = self._require(ctx)
        self._own_property(db, tenant_id, property_id)
        return (
            db.table("external_calendar").select("*")
            .eq("tenant_id", tenant_id).eq("property_id", property_id)
            .order("created_at").execute()
        ).data

    def overview(self, ctx: AuthContext) -> list[dict]:
        """Zentrale Kalender-Übersicht: ALLE Objekte des Tenants + ihre bereits
        verbundenen externen Kalender, in EINEM Aufruf. Der Kunde trägt hier pro
        Objekt seine externe iCal-URL ein — statt sie einzeln auf jeder
        Objektseite zu suchen. Tenant-Scope (Wurzel 3) über beide Tabellen."""
        db, tenant_id = self._require(ctx)
        props = (
            db.table("properties").select("id, title, status")
            .eq("tenant_id", tenant_id).order("title").execute()
        ).data
        feeds = (
            db.table("external_calendar").select("*")
            .eq("tenant_id", tenant_id).order("created_at").execute()
        ).data
        by_prop: dict[str, list[dict]] = {}
        for feed in feeds:
            by_prop.setdefault(feed["property_id"], []).append(feed)
        return [
            {
                "property_id": p["id"],
                "title": p.get("title") or "(ohne Titel)",
                "status": p.get("status"),
                "calendars": by_prop.get(p["id"], []),
            }
            for p in props
        ]

    # -- Export (öffentlicher .ics-Feed pro Objekt) -------------------------
    def ensure_export_token(self, ctx: AuthContext, property_id: str) -> dict:
        """Export-Token des Objekts sicherstellen (anlegen, falls noch keins) und
        {property_id, token} zurückgeben. Idempotent (Wurzel 2): ein bereits
        vorhandenes Token wird wiederverwendet, nicht überschrieben — sonst würde
        jeder Aufruf abonnierte Feeds ungültig machen."""
        db, tenant_id = self._require(ctx)
        rows = (
            db.table("properties").select("ical_export_token")
            .eq("id", property_id).eq("tenant_id", tenant_id)
            .limit(1).execute()
        ).data
        if not rows:
            raise ExternalCalendarError("Objekt nicht gefunden.", status_code=404)
        token = rows[0].get("ical_export_token")
        if not token:
            token = self._set_token(db, tenant_id, property_id)
        return {"property_id": property_id, "token": token}

    def rotate_export_token(self, ctx: AuthContext, property_id: str) -> dict:
        """Export-Token neu vergeben: macht die ALTE Feed-URL sofort ungültig
        (für den Fall, dass sie ungewollt geteilt wurde). Tenant-Scope (Wurzel 3)."""
        db, tenant_id = self._require(ctx)
        self._own_property(db, tenant_id, property_id)
        token = self._set_token(db, tenant_id, property_id)
        return {"property_id": property_id, "token": token}

    def _set_token(self, db: Client, tenant_id: str, property_id: str) -> str:
        token = secrets.token_urlsafe(32)
        res = (
            db.table("properties").update({"ical_export_token": token})
            .eq("id", property_id).eq("tenant_id", tenant_id)
            .execute()
        ).data
        if not res:
            raise ExternalCalendarError("Objekt nicht gefunden.", status_code=404)
        return token

    def export_feed(
        self, token: str, *, dtstamp: str, today: date, upcoming_only: bool = False
    ) -> str:
        """Öffentlichen iCal-Feed zu einem Token rendern (KEIN Auth — das Token
        IST der Zugang). Enthält NUR belegte Nächte (Buchungen + eigene Sperren),
        keine Gast-/Preis-/Stammdaten. Reimportierte iCal-Sperren (source='ical')
        werden BEWUSST ausgelassen, sonst würde ein Zwei-Wege-Feed die Belegung
        der Gegenseite an sie zurückspiegeln (Echo-Schleife). `upcoming_only`
        blendet Vergangenes aus (Lodgify „nur zukünftige Reservierungen"); `today`
        wird übergeben (kein Date.now im Modul → testbar)."""
        if self._db is None:
            raise ExternalCalendarError("DB nicht verfügbar.", status_code=500)
        if not token:
            raise ExternalCalendarError("Feed nicht gefunden.", status_code=404)
        prop = (
            self._db.table("properties")
            .select("id, title")
            .eq("ical_export_token", token)
            .limit(1).execute()
        ).data
        if not prop:
            raise ExternalCalendarError("Feed nicht gefunden.", status_code=404)
        property_id = prop[0]["id"]
        title = prop[0].get("title") or "Belegung"
        rows = (
            self._db.table("availability")
            .select("date, status, source")
            .eq("property_id", property_id)
            .in_("status", ["booked", "blocked"])
            .neq("source", "ical")
            .order("date")
            .execute()
        ).data
        booked = sorted(
            d
            for r in rows
            if r.get("date") and (d := date.fromisoformat(r["date"]))
            and (not upcoming_only or d >= today)
        )
        events = [
            ExportEvent(
                uid=f"{start.isoformat()}-{property_id}@mynextdays",
                start=start,
                end=end,  # exklusiv
                summary="Nicht verfügbar",
            )
            for start, end in merge_day_ranges(booked, end_exclusive=True)
        ]
        return build_ical(
            prod_id="myNextDays",
            cal_name=title,
            events=events,
            dtstamp=dtstamp,
        )

    def add_calendar(
        self, ctx: AuthContext, *, property_id: str, name: str, ical_url: str
    ) -> dict:
        db, tenant_id = self._require(ctx)
        self._own_property(db, tenant_id, property_id)
        _assert_public_url(ical_url)
        if not name.strip():
            raise ExternalCalendarError("Name fehlt.", status_code=422)
        row = {
            "tenant_id": tenant_id, "property_id": property_id,
            "name": name.strip(), "ical_url": ical_url.strip(),
            "last_status": "pending",
        }
        res = (
            db.table("external_calendar")
            .upsert(row, on_conflict="property_id,ical_url")
            .execute()
        ).data
        if not res:
            raise ExternalCalendarError(
                "Kalender konnte nicht angelegt werden.", status_code=500
            )
        return res[0]

    def remove_calendar(self, ctx: AuthContext, calendar_id: str) -> None:
        db, tenant_id = self._require(ctx)
        cal = self._own_calendar(db, tenant_id, calendar_id)
        # Gegenzustand (Wurzel 1): die von DIESEM Feed gesetzten ical-Sperren
        # freigeben, sonst blieben Phantom-Sperren nach dem Entfernen.
        self._clear_calendar_nights(db, cal["property_id"], calendar_id, keep=set())
        db.table("external_calendar").delete().eq(
            "tenant_id", tenant_id
        ).eq("id", calendar_id).execute()

    def _own_calendar(self, db: Client, tenant_id: str, calendar_id: str) -> dict:
        rows = (
            db.table("external_calendar").select("*")
            .eq("id", calendar_id).eq("tenant_id", tenant_id)
            .limit(1).execute()
        ).data
        if not rows:
            raise ExternalCalendarError("Kalender nicht gefunden.", status_code=404)
        return rows[0]

    # -- Sync ---------------------------------------------------------------
    def sync_now(self, ctx: AuthContext, calendar_id: str) -> dict:
        db, tenant_id = self._require(ctx)
        cal = self._own_calendar(db, tenant_id, calendar_id)
        return self.sync_calendar(db, cal)

    def sync_calendar(self, db: Client, cal: dict) -> dict:
        """Einen Feed synchronisieren. Robust: Fehler landen am Feed-Status
        (last_status/last_error), werfen aber NICHT (der Worker soll die anderen
        Feeds weiter syncen). Gibt den aktualisierten Feed zurück."""
        cal_id = cal["id"]
        property_id = cal["property_id"]
        now_iso = _now_iso()
        try:
            _assert_public_url(cal["ical_url"])
            text = self._fetch(cal["ical_url"])
            events = parse_ical(text)
            booked: set[date] = set()
            for ev in events:
                booked.update(ev.nights())
            self._apply_nights(db, property_id, cal_id, booked)
            update = {
                "last_synced_at": now_iso, "last_status": "ok",
                "last_error": None, "last_event_count": len(events),
            }
        except ExternalCalendarError as exc:
            update = {
                "last_synced_at": now_iso, "last_status": "error",
                "last_error": exc.message,
            }
        except (httpx.HTTPError, ValueError) as exc:
            update = {
                "last_synced_at": now_iso, "last_status": "error",
                "last_error": f"Feed-Fehler: {exc}",
            }
        res = (
            db.table("external_calendar").update(update)
            .eq("id", cal_id).execute()
        ).data
        return res[0] if res else {**cal, **update}

    def _fetch(self, url: str) -> str:
        """iCal laden. SSRF-hart:
        - Redirects manuell (kein `follow_redirects`), JEDER Hop wird revalidiert.
        - Pro Hop wird der Host aufgelöst, jede IP geprüft UND die Verbindung auf
          genau die geprüfte IP gepinnt — so kann DNS zwischen Prüfung und Connect
          nicht auf eine interne Adresse umbiegen (DNS-Rebinding/TOCTOU). TLS-Cert
          und SNI validieren weiterhin gegen den echten Hostnamen.
        - Body wird gestreamt und bei _MAX_ICAL_BYTES abgebrochen (kein
          Multi-GB-Download → Memory-DoS).
        Fail-closed (Wurzel 5)."""
        base_headers = {"User-Agent": "myNextDays-Calendar/1.0"}
        current = url
        with httpx.Client(timeout=_SYNC_TIMEOUT, follow_redirects=False) as client:
            for _ in range(_MAX_REDIRECTS + 1):
                ips = _resolve_public(current)
                parsed = urlparse(current)
                host = parsed.hostname or ""
                # Host-Header = Host(+Port), OHNE userinfo — die Ziel-Site erwartet
                # ihren Namen, nicht user:pass@host.
                echter_host = host_header(current)
                # Auf die geprüfte IP verbinden (Rebinding-Schutz), aber Host-Header
                # und SNI/Cert-Prüfung gegen den echten Hostnamen halten.
                pinned = parsed._replace(
                    netloc=host_pinnen(parsed.netloc, ips[0])
                ).geturl()
                request = client.build_request(
                    "GET", pinned,
                    headers={**base_headers, "Host": echter_host},
                    extensions={"sni_hostname": host},
                )
                resp = client.send(request, stream=True)
                try:
                    if resp.is_redirect:
                        location = resp.headers.get("location")
                        if not location:
                            raise ExternalCalendarError(
                                "Redirect ohne Ziel.", status_code=422
                            )
                        current = str(httpx.URL(current).join(location))
                        continue
                    resp.raise_for_status()
                    return self._read_capped(resp)
                finally:
                    resp.close()
        raise ExternalCalendarError("Zu viele Redirects.", status_code=422)

    @staticmethod
    def _read_capped(resp: httpx.Response) -> str:
        buf = bytearray()
        for chunk in resp.iter_bytes():
            buf.extend(chunk)
            if len(buf) > _MAX_ICAL_BYTES:
                raise ExternalCalendarError("Feed zu groß.", status_code=422)
        return bytes(buf).decode("utf-8", errors="replace")

    def _apply_nights(
        self, db: Client, property_id: str, calendar_id: str, booked: set[date]
    ) -> None:
        """Belegte Nächte als blocked/ical setzen (idempotent) UND Gegenzustand:
        Tage, die dieser Feed FRÜHER gesperrt hatte, jetzt aber nicht mehr liefert,
        wieder freigeben. Es werden AUSSCHLIESSLICH ical-Zeilen dieses Feeds
        angefasst — eigene Buchungen/OTA-Sperren bleiben unberührt (Wurzel 1)."""
        # Bestehende availability der betroffenen Tage EINMAL laden, um fremde
        # Belegungen (echte Buchung / OTA-Sperre / anderer Feed) NICHT zu
        # überschreiben. Eine iCal-Sperre darf nur auf einen freien Tag ODER auf
        # einen bereits von DIESEM Feed gesperrten Tag (Idempotenz). Sonst würde
        # der blinde Upsert eine 'booked'-Zeile mit 'blocked/ical' überschreiben
        # → echte Buchung verschwindet aus dem Kalender (Datenverlust, Wurzel 1).
        existing = {
            row["date"]: row
            for row in (
                db.table("availability")
                .select("date, status, source, external_calendar_id")
                .eq("property_id", property_id)
                .execute()
            ).data
        }
        gesperrt: list[date] = []
        for d in sorted(booked):
            iso = d.isoformat()
            cur = existing.get(iso)
            if cur is not None:
                # Fremd belegt (nicht von diesem Feed) → NICHT anfassen. Der Tag
                # ist ohnehin schon nicht buchbar; die fremde Quelle hat Vorrang.
                if cur.get("external_calendar_id") != calendar_id and \
                        cur.get("status") != "open":
                    continue
                if cur.get("external_calendar_id") == calendar_id:
                    # Schon von diesem Feed gesperrt: der Upsert ist idempotent,
                    # ein erneuter Push wäre reines Rauschen.
                    continue
            db.table("availability").upsert(
                je_einheit(db, property_id, [{
                    "property_id": property_id, "date": iso,
                    "status": "blocked", "source": "ical",
                    "external_calendar_id": calendar_id,
                }]),
                on_conflict=AVAILABILITY_CONFLICT,
            ).execute()
            gesperrt.append(d)
        # Gegenzustand: von DIESEM Feed gesetzte Tage, die nicht mehr belegt sind.
        freigegeben = self._clear_calendar_nights(
            db, property_id, calendar_id, keep=booked
        )
        # An die Portale melden (Wurzel 1). Ohne diesen Push war der iCal-Sync
        # der EINZIGE availability-Schreibpfad ohne ARI-Meldung: eine per Feed
        # importierte Fremdbelegung blieb bei Booking/Airbnb bis zum nächtlichen
        # Full-Sync verkäuflich (reales Doppelbuchungsfenster von bis zu 24 h),
        # und wieder freigewordene Tage blieben ebenso lange gesperrt.
        self._push_availability(db, property_id, gesperrt, 0)
        self._push_availability(db, property_id, freigegeben, 1)

    def _clear_calendar_nights(
        self, db: Client, property_id: str, calendar_id: str, *, keep: set[date]
    ) -> list[date]:
        """Alle availability-Zeilen dieses Feeds löschen, die NICHT in `keep`
        sind. Nur Zeilen mit external_calendar_id == calendar_id (fremde Sperren
        bleiben). Gibt die freigewordenen Tage zurück — der Aufrufer meldet sie
        an die Portale (Wurzel 1)."""
        existing = (
            db.table("availability").select("id, date")
            .eq("property_id", property_id)
            .eq("external_calendar_id", calendar_id)
            .execute()
        ).data
        keep_iso = {d.isoformat() for d in keep}
        frei: list[date] = []
        for row in existing:
            if row["date"] not in keep_iso:
                db.table("availability").delete().eq("id", row["id"]).execute()
                frei.append(date.fromisoformat(row["date"]))
        return frei

    def _push_availability(
        self, db: Client, property_id: str, tage: list[date], availability: int
    ) -> None:
        """Geänderte Tage als ARI-Job einreihen — zusammenhängende Tage in einer
        Spanne (merge_day_ranges), damit aus einem Feed-Lauf nicht hunderte Jobs
        werden. Vergangene Tage lässt der Push-Pfad selbst weg."""
        if not tage:
            return
        # Tenant über das Objekt: der Sync läuft auch im Worker ohne AuthContext.
        rows = (
            db.table("properties")
            .select("tenant_id").eq("id", property_id).limit(1).execute()
        ).data or []
        tenant_id = rows[0].get("tenant_id") if rows else None
        if not tenant_id:
            return
        # end_exclusive=False: der ARI-Push erwartet den LETZTEN belegten Tag.
        for start, end in merge_day_ranges(tage, end_exclusive=False):
            try_enqueue_ari(
                db, tenant_id, property_id, "availability",
                {"date_from": start.isoformat(),
                 "date_to": end.isoformat(),
                 "availability": availability},
            )


def _now_iso() -> str:
    from datetime import UTC, datetime
    return datetime.now(UTC).isoformat()
