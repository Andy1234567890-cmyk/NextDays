"""HTTP-Client für die Channex-API (Channel-Manager / OTA-Distribution).

Kapselt die offizielle Channex REST-API (https://docs.channex.io). Channex ist
der konkrete Channel-Manager-Provider hinter unserem `channel_manager`-Slice.

Eckdaten (aus der Channex-Doku):
  - Auth: Header `user-api-key: <KEY>`
  - Body bei POST/PUT immer gewrappt: {"<entity>": {...}}  (z.B. {"property": {...}})
  - Antwort enthält mind. eins von: data | meta | error
  - Pagination: pagination[page]=…&pagination[limit]=… (max 100)
  - Filter: filter[feld]=… / filter[feld][gte|lte|not|gt|lt]=…
  - Rate-Limits (pro Property/Minute): 20 ARI gesamt, je 10 Availability/Restrictions
    → bei Überschreitung HTTP 429; wir warten und versuchen erneut (Backoff).

Beträge: Channex akzeptiert Cent-Integer (20000 = 200,00) ODER Dezimal-String
("200.00"). Wir nutzen durchgängig Cent-Integer (eindeutig, keine Rundungsfehler).
"""
from __future__ import annotations

import time
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

if TYPE_CHECKING:
    from src.jobs.channex_budget import BudgetDecision

log = get_logger("nextdays.channex")

# Callback-Signatur des kontoweiten Channex-Budgets: bekommt die (optionale)
# Channex-Property-ID des anstehenden Calls, gibt eine BudgetDecision zurück.
# So kann JEDER echte HTTP-Call (nicht nur der erste Job-Schritt) ein Token
# ziehen — sonst umgeht ein Batch-Job (reconcile_tenant, process_ari_outbox)
# mit N Calls das Konto-Limit für 1 Token.
BudgetCallback = Callable[[str | None], "BudgetDecision"]


def _budget_property_id(
    params: dict[str, Any] | None, json: dict[str, Any] | None
) -> str | None:
    """Channex-Property-ID des anstehenden Calls für die Property-Budget-Ebene
    ermitteln (best effort). ARI-Pushes tragen sie je Eintrag in
    ``values[].property_id`` (availability/restrictions), Reads im Query-Filter
    ``filter[property_id]``. Findet sich keine (z. B. Gruppen-/Property-Liste),
    zählt der Call nur auf der Konto-Ebene — das Konto-Limit greift IMMER."""
    if params:
        pid = params.get("filter[property_id]")
        if isinstance(pid, str) and pid:
            return pid
    if json:
        values = json.get("values")
        if isinstance(values, list):
            for entry in values:
                if isinstance(entry, dict):
                    pid = entry.get("property_id")
                    if isinstance(pid, str) and pid:
                        return pid
    return None


class ChannexError(Exception):
    """Fehler beim Aufruf der Channex-API.

    `status_code` ist der nach außen (an unsere API-Clients) zu meldende Code.
    `channex_status` ist der ursprüngliche HTTP-Status von Channex (Debug).
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 502,
        channex_status: int | None = None,
        payload: object | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.channex_status = channex_status
        self.payload = payload


class ChannexBudgetExhausted(Exception):
    """Kontoweites Channex-Token-Budget vor einem Call erschöpft.

    Wird geworfen, wenn das Budget-Callback einen Call ablehnt und auch die
    gedeckelte Kurz-Wartezeit kein Token freigab. Der Worker behandelt das als
    retry-würdig → der laufende (Batch-)Job wird verzögert (deferred), statt
    Channex mit weiteren Calls zu überfahren. `retry_after` = Sekunden, bis
    frühestens wieder ein Token frei wird.

    BEWUSST KEINE Unterklasse von ChannexError: die Batch-Handler (reconcile,
    process_ari_outbox) fangen ChannexError intern ab (echter Push-Fehler →
    Zeile failed / Reconcile no-op). Eine Budget-Erschöpfung ist aber KEIN
    Push-Fehler, sondern muss ungefiltert bis zum Worker durchschlagen, damit
    der GANZE Job verzögert wird — nicht einzelne Zeilen als „fehlgeschlagen"
    markiert werden. Als eigenständige Exception passiert genau das.
    """

    def __init__(self, message: str, *, retry_after: int) -> None:
        super().__init__(message)
        self.message = message
        self.retry_after = retry_after


class ChannexClient:
    """Dünner, synchroner Client um die Channex-API.

    Synchron (httpx.Client), passend zur restlichen Service-Schicht (Supabase-
    Python-Client ist ebenfalls synchron). Eine Instanz pro Request ist ok;
    der Client wird nach Gebrauch geschlossen (Context-Manager unterstützt).
    """

    # 429-Backoff: Channex empfiehlt ~1 Min Pause. Wir staffeln vorsichtig.
    _RETRY_BACKOFF_SECONDS = (2.0, 5.0, 15.0)

    # Budget-Ablehnung: max. so viele kurze Waits im Request-Thread, bevor der
    # Call als ChannexBudgetExhausted abgebrochen wird (→ Job-Retry statt den
    # Event-Loop/Thread über Sekunden zu blockieren). Der Job wacht dann per
    # retry_after wieder auf. Deckel je Wait, damit ein volles Fenster (z. B.
    # 60 s) nicht sekundenlang im Thread hängt.
    _BUDGET_MAX_WAITS = 2
    _BUDGET_WAIT_CAP_SECONDS = 1.0

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float = 30.0,
        before_call: BudgetCallback | None = None,
    ) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.channex_api_key.get_secret_value()
        self._base_url = (base_url or settings.channex_base_url).rstrip("/")
        self._timeout = timeout
        # Optionales Budget-Callback: der Worker reicht hier das kontoweite
        # Channex-Token-Budget durch. Ohne Callback (Request-Pfad, Tests) läuft
        # der Client unverändert — jeder echte HTTP-Call geht ohne Token-Gate.
        self._before_call = before_call

    @property
    def is_configured(self) -> bool:
        """True, wenn ein API-Key gesetzt ist (sonst läuft nichts gegen Channex)."""
        return bool(self._api_key)

    @property
    def web_host(self) -> str:
        """Host der Channex-Web-App (für iFrame-Exchange), aus der base_url
        abgeleitet: …/api/v1 → Host ohne /api/v1."""
        return self._base_url.removesuffix("/api/v1").rstrip("/")

    # -- interner Request mit Auth, Wrapping, 429-Backoff, Fehler-Mapping -------
    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        bearer: str | None = None,
    ) -> dict[str, Any]:
        if not self.is_configured:
            raise ChannexError(
                "Channex ist nicht konfiguriert (CHANNEX_API_KEY fehlt).",
                status_code=503,
            )

        url = f"{self._base_url}/{path.lstrip('/')}"
        # Standard: user-api-key. Für Session-JWT-Endpunkte (Airbnb-OAuth-Link)
        # stattdessen Bearer — diese meta-Endpunkte lehnen den api-key ab (422).
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
        else:
            headers["user-api-key"] = self._api_key

        budget_property_id = _budget_property_id(params, json)

        last_exc: Exception | None = None
        # +1 finaler Versuch nach allen Backoffs.
        for attempt in range(len(self._RETRY_BACKOFF_SECONDS) + 1):
            # Kontoweites Budget VOR JEDEM echten HTTP-Round-Trip ziehen (falls ein
            # Callback gesetzt ist) — auch vor jedem 429-Retry. Sonst deckt EIN Token
            # bis zu (Retries+1) echte Channex-Requests ab und das Budget unterzählt
            # die reale Last genau dann, wenn Channex bereits 429 liefert (die
            # Situation, für die die Drosselung gebaut ist).
            self._acquire_budget(budget_property_id)
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    resp = client.request(
                        method, url, headers=headers, params=params, json=json
                    )
            except httpx.HTTPError as exc:
                log.error("channex_network_error", url=url, error=str(exc))
                raise ChannexError(
                    "Channex nicht erreichbar (Netzwerkfehler).", status_code=502
                ) from exc

            # Rate-Limit → warten und erneut versuchen.
            if resp.status_code == 429:
                if attempt < len(self._RETRY_BACKOFF_SECONDS):
                    wait = self._RETRY_BACKOFF_SECONDS[attempt]
                    log.warning("channex_rate_limited", url=url, retry_in=wait)
                    time.sleep(wait)
                    continue
                raise ChannexError(
                    "Channex-Rate-Limit erreicht (429). Bitte später erneut.",
                    status_code=429,
                    channex_status=429,
                )

            return self._handle_response(resp, url)

        # Theoretisch unerreichbar (Schleife kehrt immer zurück oder wirft).
        raise ChannexError(
            "Channex-Aufruf fehlgeschlagen.", status_code=502
        ) from last_exc

    def _acquire_budget(self, channex_property_id: str | None) -> None:
        """Vor jedem echten HTTP-Call ein Token aus dem kontoweiten Budget ziehen.

        Ohne gesetztes Callback (Request-Pfad, Tests) passiert nichts. Wird der
        Call abgelehnt, warten wir GEDECKELT ein paar Mal kurz (ein Fenster kann
        gerade abgelaufen sein); gibt das Budget dann immer noch kein Token her,
        werfen wir ChannexBudgetExhausted → der Worker verzögert den Job (statt
        den Thread über Sekunden zu blockieren oder Channex zu überfahren).
        """
        if self._before_call is None:
            return
        for _ in range(self._BUDGET_MAX_WAITS + 1):
            decision = self._before_call(channex_property_id)
            if decision.allowed:
                return
            wait = min(max(decision.retry_after, 0), self._BUDGET_WAIT_CAP_SECONDS)
            if wait <= 0:
                break
            log.info(
                "channex_budget_wait",
                property_id=channex_property_id,
                retry_after=decision.retry_after,
            )
            time.sleep(wait)
        # Nach den gedeckelten Waits immer noch kein Token → Job-Retry auslösen.
        raise ChannexBudgetExhausted(
            "Channex-Budget erschöpft — Call verzögert.",
            retry_after=max(decision.retry_after, 1),
        )

    def _handle_response(self, resp: httpx.Response, url: str) -> dict[str, Any]:
        try:
            body: dict[str, Any] = resp.json() if resp.content else {}
        except ValueError:
            body = {}

        if resp.is_success:
            return body

        # Fehler: Channex liefert {"errors": {...}} oder {"error": {...}}.
        detail = body.get("errors") or body.get("error") or body
        message = self._extract_message(detail) or f"Channex-Fehler {resp.status_code}."
        log.error(
            "channex_api_error",
            url=url,
            status=resp.status_code,
            detail=detail,
        )
        # Validierungs-/Auth-Fehler von Channex 1:1 durchreichen, sonst 502.
        passthrough = resp.status_code in (400, 401, 403, 404, 422)
        raise ChannexError(
            message,
            status_code=resp.status_code if passthrough else 502,
            channex_status=resp.status_code,
            payload=detail,
        )

    @staticmethod
    def _extract_message(detail: object) -> str | None:
        if isinstance(detail, dict):
            for key in ("title", "message", "detail"):
                val = detail.get(key)
                if isinstance(val, str):
                    return val
            # Validierungsfehler: {"feld": ["msg", ...]}
            for val in detail.values():
                if isinstance(val, list) and val and isinstance(val[0], str):
                    return val[0]
        if isinstance(detail, str):
            return detail
        return None

    # -- öffentliche Convenience-Methoden --------------------------------------
    def get(self, path: str, *, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("GET", path, params=params)

    def post(
        self, path: str, *, json: dict[str, Any], bearer: str | None = None
    ) -> dict[str, Any]:
        return self._request("POST", path, json=json, bearer=bearer)

    def put(self, path: str, *, json: dict[str, Any]) -> dict[str, Any]:
        return self._request("PUT", path, json=json)

    def delete(self, path: str, *, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("DELETE", path, params=params)

    # ----- Groups (je Tenant eine Group im Whitelabel-Konto) ------------------
    def create_group(self, title: str) -> dict[str, Any]:
        """Legt eine Channex-Group an (nur `title` ist Pflicht). Group-ID liegt
        in data.id der Antwort."""
        return self.post("groups", json={"group": {"title": title}})

    def assign_property_to_group(
        self, group_id: str, channex_property_id: str
    ) -> dict[str, Any]:
        """Ordnet eine bestehende Property einer Group zu (eigener Endpoint,
        nicht über ein Property-Attribut)."""
        return self.post(
            f"groups/{group_id}/properties/{channex_property_id}", json={}
        )

    # ----- Properties ---------------------------------------------------------
    def create_property(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("properties", json={"property": attributes})

    def update_property(self, channex_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"properties/{channex_id}", json={"property": attributes})

    def get_property(self, channex_id: str) -> dict[str, Any]:
        return self.get(f"properties/{channex_id}")

    def list_properties(
        self, *, page: int = 1, limit: int = 100, group_id: str | None = None
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "pagination[page]": page,
            "pagination[limit]": limit,
        }
        # White-label: nur Properties der Tenant-Group (sonst sähe man fremde
        # Mandanten desselben Channex-Kontos).
        if group_id:
            params["filter[group_id]"] = group_id
        return self.get("properties", params=params)

    # ----- Room Types ---------------------------------------------------------
    def create_room_type(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("room_types", json={"room_type": attributes})

    def update_room_type(self, channex_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"room_types/{channex_id}", json={"room_type": attributes})

    def get_room_types(self, property_id: str) -> dict[str, Any]:
        """Room-Types einer Property (für den Import). filter[property_id]."""
        return self.get("room_types", params={"filter[property_id]": property_id})

    # ----- Rate Plans ---------------------------------------------------------
    def create_rate_plan(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("rate_plans", json={"rate_plan": attributes})

    def update_rate_plan(self, channex_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"rate_plans/{channex_id}", json={"rate_plan": attributes})

    def get_rate_plans(self, property_id: str) -> dict[str, Any]:
        """Rate-Plans einer Property (für den Import). filter[property_id].
        Bei READ kommt options[].rate als Dezimalstring zurück."""
        return self.get("rate_plans", params={"filter[property_id]": property_id})

    # ----- Taxes & Tax-Sets ---------------------------------------------------
    def create_tax(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("taxes", json={"tax": attributes})

    def update_tax(self, tax_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"taxes/{tax_id}", json={"tax": attributes})

    def create_tax_set(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("tax_sets", json={"tax_set": attributes})

    def update_tax_set(self, tax_set_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"tax_sets/{tax_set_id}", json={"tax_set": attributes})

    # ----- ARI: Availability + Restrictions/Rates -----------------------------
    def update_availability(self, values: list[dict[str, Any]]) -> dict[str, Any]:
        """Verfügbarkeit setzen. `values` = Liste von Updates (s. Channex-ARI).

        Getrennt von Preisen senden (Channex priorisiert Availability-Queue).
        """
        return self.post("availability", json={"values": values})

    def update_restrictions(self, values: list[dict[str, Any]]) -> dict[str, Any]:
        """Preise + Restriktionen setzen (rate, min_stay_*, stop_sell, …)."""
        return self.post("restrictions", json={"values": values})

    def get_availability(
        self, property_id: str, *, date_from: str, date_to: str
    ) -> dict[str, Any]:
        return self.get(
            "availability",
            params={
                "filter[property_id]": property_id,
                "filter[date][gte]": date_from,
                "filter[date][lte]": date_to,
            },
        )

    def get_restrictions(
        self,
        property_id: str,
        *,
        date_from: str,
        date_to: str,
        restrictions: str = "rate,min_stay_arrival,stop_sell",
    ) -> dict[str, Any]:
        """Restriktionen lesen (Readback/Verifikation).

        `filter[restrictions]` ist laut Channex PFLICHT — ohne den Parameter
        antwortet die API mit 400 "restrictions is required". `availability`
        ist KEINE Restriction (das liest man über get_availability)."""
        return self.get(
            "restrictions",
            params={
                "filter[property_id]": property_id,
                "filter[date][gte]": date_from,
                "filter[date][lte]": date_to,
                "filter[restrictions]": restrictions,
            },
        )

    # ----- Bookings (Pull via Revisions-Feed + Ack) ---------------------------
    def get_booking_revisions_feed(self) -> dict[str, Any]:
        """Nicht-bestätigte Buchungs-Revisionen (primärer Weg laut Channex)."""
        return self.get("booking_revisions/feed")

    def ack_booking_revision(self, revision_id: str) -> dict[str, Any]:
        """Revision bestätigen (erst NACH erfolgreichem Speichern aufrufen)."""
        return self.post(f"booking_revisions/{revision_id}/ack", json={})

    def get_booking(self, booking_id: str) -> dict[str, Any]:
        return self.get(f"bookings/{booking_id}")

    def list_bookings_for_property(
        self,
        property_id: str,
        *,
        page: int = 1,
        limit: int = 100,
        inserted_after: str | None = None,
    ) -> dict[str, Any]:
        """GET /bookings für GENAU EINE Property (Initial-/Recovery-Import).
        Channex-Doku WARNT: NICHT periodisch nutzen — laufend läuft über den
        Revisions-Feed. Antwort: data[], meta{total,limit,page}, order
        inserted_at desc."""
        params: dict[str, Any] = {
            "filter[property_id]": property_id,
            "pagination[page]": page,
            "pagination[limit]": limit,
        }
        if inserted_after:
            params["filter[inserted_at][gte]"] = inserted_after
        return self.get("bookings", params=params)

    # ----- Channels (OTA-Verbindungen; inhouse Channel-API) -------------------
    # Verifizierter 4-Stufen-Flow (references/api.md, live gegen Staging geprüft):
    #   1) test_connection  {channel, settings:{hotel_id}}   → Zugangsdaten prüfen
    #   2) mapping_details  {channel, settings:{hotel_id}}   → OTA-Zimmer/Raten
    #   3) POST /channels   {channel, group_id, properties:[uuid], rate_plans:[…]}
    #   4) /channels/:id/activate                            → live (startet inaktiv)
    # WICHTIG: room_type_code/rate_plan_code sind INTEGER; group_id ist Pflicht;
    # DELETE nur bei inaktivem Kanal (sonst 422 "is active").
    def list_channel_catalog(self) -> dict[str, Any]:
        """Katalog aller verbindbaren OTAs inkl. Feld-Definitionen (`params`,
        `rate_params`, `channel_restrictions`). Quelle der Wahrheit für die
        Verbinden-Maske — Felder NICHT raten, sondern von hier nehmen."""
        return self.get("channels/list")

    def list_channels(self, *, property_id: str | None = None) -> dict[str, Any]:
        """Bereits verbundene Kanäle (optional auf eine Property gefiltert)."""
        params = {"filter[property_id]": property_id} if property_id else None
        return self.get("channels", params=params)

    def get_channel(self, channel_id: str) -> dict[str, Any]:
        return self.get(f"channels/{channel_id}")

    def test_channel_connection(
        self, *, channel: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        """Schritt 1: OTA-Zugangsdaten prüfen, BEVOR etwas angelegt wird.
        `settings.hotel_id` = die Property-ID beim OTA (z.B. Booking.com-Extranet-ID)."""
        return self.post(
            "channels/test_connection",
            json={"channel": channel, "settings": settings},
        )

    def get_channel_mapping_details(
        self, *, channel: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        """Schritt 2: OTA-seitige Zimmer/Raten lesen. Für Booking.com liefert
        data.rooms[].rates[], jeweils mit INTEGER-`id` (= room_type_code /
        rate_plan_code), `pricing` (OBP/PP), `max_persons`, `occupancies`."""
        return self.post(
            "channels/mapping_details",
            json={"channel": channel, "settings": settings},
        )

    def create_channel(self, attributes: dict[str, Any]) -> dict[str, Any]:
        """Schritt 3: Kanal anlegen (startet INAKTIV). Erwartet u.a. `channel`,
        `group_id` (Pflicht!), `properties:[uuid]`, `rate_plans:[{rate_plan_id,
        settings:{room_type_code(int), rate_plan_code(int), occupancy, …}}]`,
        `settings:{hotel_id}`."""
        return self.post("channels", json={"channel": attributes})

    def update_channel(self, channel_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"channels/{channel_id}", json={"channel": attributes})

    def activate_channel(self, channel_id: str) -> dict[str, Any]:
        """Schritt 4: Kanal live schalten (Kanäle werden inaktiv erstellt)."""
        return self.post(f"channels/{channel_id}/activate", json={})

    def deactivate_channel(self, channel_id: str) -> dict[str, Any]:
        """Kanal pausieren. Auch nötig VOR dem Löschen (sonst 422 'is active')."""
        return self.post(f"channels/{channel_id}/deactivate", json={})

    def delete_channel(self, channel_id: str) -> dict[str, Any]:
        """Kanal löschen — muss vorher inaktiv sein (deactivate_channel)."""
        return self.delete(f"channels/{channel_id}")

    def list_groups(self) -> dict[str, Any]:
        """Groups, auf die der Key Zugriff hat (für die group_id beim Channel-Create)."""
        return self.get("groups")

    # ----- Airbnb-OAuth (white-label, ohne iFrame) ----------------------------
    # Airbnb hat KEIN eingebbares Credential; die Verbindung läuft über eine echte
    # airbnb.com-OAuth-URL, die ein dedizierter meta-Endpunkt erzeugt. Verifiziert
    # 2026-06-26 live gegen Staging + Channex-SPA-Bundle (kein Raten):
    #   1) POST auth/one_time_token {property_id, group_id, username} → data.token
    #   2) GET  auth/exchange?oauth_session_key=<token>&app_mode=headless
    #          → data.attributes.token (Session-JWT)
    #   3) POST meta/airbnb/connection_link  (JWT-Bearer!) {connection_link:{…}}
    #          → data.attributes.url  (= airbnb.com/oauth2/auth?…)
    # Doku: docs/CHANNEX-FELDER.md §4a.
    def create_one_time_token(
        self, *, property_id: str, group_id: str, username: str
    ) -> str:
        """Schritt 1: One-Time-Token (15 Min, einmalig) für den JWT-Exchange."""
        res = self.post(
            "auth/one_time_token",
            json={
                "property_id": property_id,
                "group_id": group_id,
                "username": username,
            },
        )
        token = (res.get("data") or {}).get("token")
        if not token:
            raise ChannexError(
                "Channex lieferte kein One-Time-Token.", status_code=502, payload=res
            )
        return token

    def exchange_one_time_token(self, one_time_token: str) -> str:
        """Schritt 2: One-Time-Token gegen einen Session-JWT tauschen.

        WICHTIG: Nur GET; nur mit `Accept: application/json` (sonst liefert der
        Pfad die Channex-SPA-HTML). `app_mode=headless` = ohne Channex-Chrome."""
        res = self.get(
            "auth/exchange",
            params={"oauth_session_key": one_time_token, "app_mode": "headless"},
        )
        jwt = ((res.get("data") or {}).get("attributes") or {}).get("token")
        if not jwt:
            raise ChannexError(
                "Channex lieferte keinen Session-JWT.", status_code=502, payload=res
            )
        return jwt

    def create_airbnb_connection_link(
        self, *, jwt: str, connection_link: dict[str, Any]
    ) -> str:
        """Schritt 3: echte Airbnb-OAuth-URL erzeugen (zum Öffnen ODER Kopieren).

        Braucht den Session-JWT als Bearer (api-key allein → 422). `connection_link`
        snake_case: {group_id, properties:[uuid], channel_id?, title, request_id,
        settings:{booking_amount_settings, cohost_payout_calculations, min_stay_type,
        send_email_notifications, email?}}. Gibt die airbnb.com-OAuth-URL zurück."""
        res = self.post(
            "meta/airbnb/connection_link",
            json={"connection_link": connection_link},
            bearer=jwt,
        )
        url = ((res.get("data") or {}).get("attributes") or {}).get("url")
        if not url:
            raise ChannexError(
                "Channex lieferte keine Airbnb-OAuth-URL.",
                status_code=502, payload=res,
            )
        return url

    # ----- Webhooks -----------------------------------------------------------
    def create_webhook(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("webhooks", json={"webhook": attributes})

    def list_webhooks(self) -> dict[str, Any]:
        return self.get("webhooks")

    def delete_webhook(self, webhook_id: str) -> dict[str, Any]:
        return self.delete(f"webhooks/{webhook_id}")

    # ----- Messages (Gäste-Chat: Booking.com, Airbnb, Expedia) ----------------
    # Channex omni-channel Messaging-API. Ein Thread gehört i.d.R. zu einer
    # Booking (relationships.booking); Airbnb-„Inquiry" kann threadlos sein.
    # Doku: https://docs.channex.io/api-v.1-documentation/messages-collection
    def get_messages_for_booking(self, channex_booking_id: str) -> dict[str, Any]:
        """Nachrichten einer Buchung lesen (data[] mit message, sender, time)."""
        return self.get(f"bookings/{channex_booking_id}/messages")

    def send_message_for_booking(
        self, channex_booking_id: str, message: str
    ) -> dict[str, Any]:
        """Antwort an den Gast senden (geht an die OTA des Threads zurück)."""
        return self.post(
            f"bookings/{channex_booking_id}/messages",
            json={"message": {"message": message}},
        )
