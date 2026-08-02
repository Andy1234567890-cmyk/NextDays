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
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

if TYPE_CHECKING:
    from src.jobs.channex_budget import BudgetDecision


@dataclass(slots=True)
class ChannexCallTrace:
    """Ein einzelner Channex-HTTP-Call als Trace-Zeile (sichtbares Flow-Debugging).

    Der Client füllt die technischen Felder (Methode/Pfad/Status/Bodies/Dauer/ID);
    tenant/property/step reicht der Slice über den ``trace_sink`` nach — der Client
    bleibt tenant-agnostisch (kein DB-Zugriff hier)."""

    method: str
    path: str
    request_body: dict[str, Any] | None
    response_body: dict[str, Any] | None
    channex_id: str | None
    http_status: int | None
    duration_ms: int
    ok: bool
    error: str | None


# Sink für Call-Traces: der Slice hängt hier das Persistieren in channex_debug_log
# ein (mit tenant/property/step). Ohne Sink (Tests, Request-Pfad ohne Debug) läuft
# der Client unverändert — nur strukturiertes Logging, keine DB-Zeile.
TraceSink = Callable[[ChannexCallTrace], None]

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


def _json_or_none(resp: httpx.Response) -> dict[str, Any] | None:
    """Response-Body als dict (für Fehler-Traces), sonst None — nie werfen."""
    try:
        body = resp.json() if resp.content else None
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


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

    def __init__(
        self, message: str, *, retry_after: int, progressed: bool = False
    ) -> None:
        super().__init__(message)
        self.message = message
        self.retry_after = retry_after
        # True, wenn der (Batch-)Job VOR dem Erschöpfen bereits echten Fortschritt
        # gemacht hat (Zeilen erfolgreich gepusht). Der Worker setzt dann den
        # defer_count-Livelock-Zähler zurück — nur ein Job OHNE jeden Fortschritt
        # (echter Redis-Ausfall) läuft in den Deckel und stirbt als 'dead'.
        self.progressed = progressed


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
        trace_sink: TraceSink | None = None,
    ) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.channex_api_key.get_secret_value()
        self._base_url = (base_url or settings.channex_base_url).rstrip("/")
        self._timeout = timeout
        # Optionales Budget-Callback: der Worker reicht hier das kontoweite
        # Channex-Token-Budget durch. Ohne Callback (Request-Pfad, Tests) läuft
        # der Client unverändert — jeder echte HTTP-Call geht ohne Token-Gate.
        self._before_call = before_call
        # Optionaler Trace-Sink: sichtbares Flow-Debugging. Der Slice persistiert
        # hier jeden Call (channex_debug_log). Ohne Sink: nur strukturiertes Log.
        self._trace_sink = trace_sink

    def set_trace_sink(self, sink: TraceSink | None) -> None:
        """Trace-Sink nachträglich setzen — nötig, wenn der Client fertig gebaut
        übergeben wird (Worker-Pfad mit before_call-Budget), damit AUCH die
        ARI-/Availability-Pushes ihre Task-ID in channex_debug_log schreiben
        (Zertifizierung braucht die Task-ID jedes Calls, nicht nur des
        Content-Syncs). Vorhandener Sink wird nicht überschrieben."""
        if self._trace_sink is None:
            self._trace_sink = sink

    def _emit_trace(
        self,
        *,
        method: str,
        path: str,
        request_body: dict[str, Any] | None,
        response_body: dict[str, Any] | None,
        http_status: int | None,
        started: float,
        ok: bool,
        error: str | None,
    ) -> None:
        """Einen Call-Trace an Log UND Sink geben (best effort, nie den Hauptpfad
        kippen: Wurzel 5)."""
        duration_ms = int((time.perf_counter() - started) * 1000)
        channex_id: str | None = None
        if isinstance(response_body, dict):
            data = response_body.get("data")
            # Content-Sync (property/room_type/rate_plan): data = Objekt mit id.
            # ARI (availability/restrictions): data = Liste von Task-Objekten —
            # die Channex-Task-ID (fürs Zertifizierungsformular) ist data[0].id.
            if isinstance(data, dict):
                cid = data.get("id")
                channex_id = cid if isinstance(cid, str) else None
            elif isinstance(data, list) and data and isinstance(data[0], dict):
                cid = data[0].get("id")
                channex_id = cid if isinstance(cid, str) else None
        # Strukturiertes Log für JEDEN Call (Erfolg inklusive — bisher fehlte das).
        log.info(
            "channex_call",
            method=method,
            path=path,
            status=http_status,
            duration_ms=duration_ms,
            ok=ok,
            channex_id=channex_id,
        )
        if self._trace_sink is None:
            return
        try:
            self._trace_sink(
                ChannexCallTrace(
                    method=method,
                    path=path,
                    request_body=request_body,
                    response_body=response_body,
                    channex_id=channex_id,
                    http_status=http_status,
                    duration_ms=duration_ms,
                    ok=ok,
                    error=error,
                )
            )
        except Exception as exc:  # noqa: BLE001 - Trace darf den Call nie kippen
            log.warning("channex_trace_sink_failed", error=str(exc))

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
            # Trace-Zeitmessung je echtem Round-Trip (sichtbares Flow-Debugging).
            started = time.perf_counter()
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    resp = client.request(
                        method, url, headers=headers, params=params, json=json
                    )
            except httpx.HTTPError as exc:
                log.error("channex_network_error", url=url, error=str(exc))
                self._emit_trace(
                    method=method, path=path, request_body=json, response_body=None,
                    http_status=None, started=started, ok=False,
                    error=f"Netzwerkfehler: {exc}",
                )
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
                self._emit_trace(
                    method=method, path=path, request_body=json, response_body=None,
                    http_status=429, started=started, ok=False,
                    error="Rate-Limit (429).",
                )
                raise ChannexError(
                    "Channex-Rate-Limit erreicht (429). Bitte später erneut.",
                    status_code=429,
                    channex_status=429,
                )

            # Antwort (Erfolg oder Fehler) verarbeiten — Trace in beiden Fällen.
            try:
                body = self._handle_response(resp, url)
            except ChannexError as exc:
                self._emit_trace(
                    method=method, path=path, request_body=json,
                    response_body=_json_or_none(resp), http_status=resp.status_code,
                    started=started, ok=False, error=exc.message,
                )
                raise
            self._emit_trace(
                method=method, path=path, request_body=json, response_body=body,
                http_status=resp.status_code, started=started, ok=True, error=None,
            )
            return body

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

        # DEBUG: den KOMPLETTEN rohen Fehler protokollieren — nicht nur das
        # geparste `errors`-Feld. So sehen wir jedes Zusatzfeld, das Channex im
        # 422-Body mitschickt (welcher bestehende Kanal, welche property/Konto den
        # Konflikt hält), inkl. Response-Header und rohem Text vor jeder Umwandlung.
        try:
            raw_text = resp.text
        except (UnicodeDecodeError, httpx.HTTPError):
            raw_text = "<nicht lesbar>"
        log.error(
            "channex_api_error_RAW",
            url=url,
            status=resp.status_code,
            full_body=body,
            raw_text=raw_text[:4000],
            headers=dict(resp.headers),
            request_method=resp.request.method,
            request_url=str(resp.request.url),
            request_body=(
                resp.request.content.decode("utf-8", "replace")[:4000]
                if resp.request.content else None
            ),
        )

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

    @classmethod
    def _extract_message(cls, detail: object) -> str | None:
        """Die AUSSAGEKRÄFTIGSTE Meldung aus einem Channex-Fehler ziehen.

        Channex antwortet auf Validierungsfehler mit
        {"code": …, "title": "Validation Error", "details": {"settings":
        ["channel with the same settings already exists"]}} — der Titel ist
        immer derselbe und sagt nichts. Deshalb zuerst in `details` schauen,
        sonst wäre jede Ursache dieselbe nichtssagende Zeile (und unsere
        Sonderbehandlungen, die auf den Text prüfen, griffen nie)."""
        if isinstance(detail, dict):
            aus_details = cls._extract_message(detail.get("details"))
            if aus_details:
                return aus_details
            for key in ("title", "message", "detail"):
                val = detail.get(key)
                if isinstance(val, str):
                    return val
            # Validierungsfehler: {"feld": ["msg", ...]}
            for val in detail.values():
                if isinstance(val, list) and val and isinstance(val[0], str):
                    return val[0]
        if isinstance(detail, list) and detail and isinstance(detail[0], str):
            return detail[0]
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

    def delete_group(self, group_id: str) -> dict[str, Any]:
        """Channex-Group löschen — idempotent: ein 404 (Group bereits weg) ist
        KEIN Fehler, wir geben {} zurück. Gegenzustand zu `create_group`
        (Wurzel 1): Test-Cleanup und der Waisen-Sweeper müssen eine angelegte
        Group wieder abbauen können. Muster wie `_prune_orphan_rate_plans`
        (404 = schon weg). Andere Fehler (z. B. Group hat noch Properties → 400)
        werden durchgereicht, damit der Aufrufer nichts still verliert."""
        try:
            return self.delete(f"groups/{group_id}")
        except ChannexError as exc:
            if exc.channex_status == 404:
                return {}
            raise

    # ----- Properties ---------------------------------------------------------
    def create_property(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("properties", json={"property": attributes})

    def update_property(self, channex_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"properties/{channex_id}", json={"property": attributes})

    def get_property(self, channex_id: str) -> dict[str, Any]:
        return self.get(f"properties/{channex_id}")

    def delete_property(self, channex_id: str, *, force: bool = False) -> dict[str, Any]:
        """Property in Channex löschen (irreversibel). Ohne `force` blockt Channex,
        wenn noch ein Kanal hängt (422) — bewusst: erst Kanäle abbauen."""
        params = {"force": "true"} if force else None
        return self.delete(f"properties/{channex_id}", params=params)

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

    def delete_room_type(self, channex_id: str, *, force: bool = False) -> dict[str, Any]:
        """Room-Type löschen. Ohne `force` Fehler, wenn an einen Kanal gemappt —
        Löschkette (Doku: „break the chain") bewusst fail-closed."""
        params = {"force": "true"} if force else None
        return self.delete(f"room_types/{channex_id}", params=params)

    # ----- Rate Plans ---------------------------------------------------------
    def create_rate_plan(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("rate_plans", json={"rate_plan": attributes})

    def update_rate_plan(self, channex_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"rate_plans/{channex_id}", json={"rate_plan": attributes})

    def get_rate_plans(self, property_id: str) -> dict[str, Any]:
        """Rate-Plans einer Property (für den Import). filter[property_id].
        Bei READ kommt options[].rate als Dezimalstring zurück."""
        return self.get("rate_plans", params={"filter[property_id]": property_id})

    def delete_rate_plan(self, channex_id: str, *, force: bool = False) -> dict[str, Any]:
        """Rate-Plan löschen. Ohne `force` Fehler, wenn an einen Kanal gemappt —
        Löschkette (Doku: „break the chain") bewusst fail-closed."""
        params = {"force": "true"} if force else None
        return self.delete(f"rate_plans/{channex_id}", params=params)

    # ----- Taxes & Tax-Sets ---------------------------------------------------
    def create_tax(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("taxes", json={"tax": attributes})

    def update_tax(self, tax_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"taxes/{tax_id}", json={"tax": attributes})

    def create_tax_set(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("tax_sets", json={"tax_set": attributes})

    def update_tax_set(self, tax_set_id: str, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.put(f"tax_sets/{tax_set_id}", json={"tax_set": attributes})

    # ----- Hotel Policies (Check-in/-out, Haustiere, Parken, Internet, Rauchen) --
    # Pflicht für Google-Kanal/Instant-Booking-Page-Readiness; children_fee am
    # Rate-Plan greift nur mit Altersgrenzen aus der Policy.
    def create_hotel_policy(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post("hotel_policies", json={"hotel_policy": attributes})

    def update_hotel_policy(
        self, policy_id: str, attributes: dict[str, Any]
    ) -> dict[str, Any]:
        return self.put(f"hotel_policies/{policy_id}", json={"hotel_policy": attributes})

    def delete_hotel_policy(self, policy_id: str) -> dict[str, Any]:
        return self.delete(f"hotel_policies/{policy_id}")

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
    def get_booking_revisions_feed(
        self, *, page: int = 1, limit: int = 100
    ) -> dict[str, Any]:
        """Nicht-bestätigte Buchungs-Revisionen (primärer Weg laut Channex).

        WICHTIG: ohne Pagination liefert Channex nur die ersten 10 — wir holen
        max. 100 je Seite, älteste zuerst (order[inserted_at]=asc), damit
        Revisionen in Ereignis-Reihenfolge verarbeitet werden."""
        return self.get(
            "booking_revisions/feed",
            params={
                "pagination[page]": page,
                "pagination[limit]": limit,
                "order[inserted_at]": "asc",
            },
        )

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
        arrival_from: str | None = None,
    ) -> dict[str, Any]:
        """GET /bookings für GENAU EINE Property (Initial-/Recovery-Import).
        Channex-Doku WARNT: NICHT periodisch nutzen — laufend läuft über den
        Revisions-Feed. Antwort: data[], meta{total,limit,page}, order
        inserted_at desc.

        Zwei Datumsfilter (Channex-Doku, bookings-collection):
        - ``inserted_after`` → filter[inserted_at][gte]: wann Channex die
          Buchung SAH (Recovery nach Ausfall ab Zeitpunkt X).
        - ``arrival_from``   → filter[arrival_date][gte]: Anreisedatum (YYYY-MM-DD).
          Für den Onboarding-Bestandsimport („alle künftigen Buchungen ab
          heute") ist DAS der richtige Filter, nicht inserted_at."""
        params: dict[str, Any] = {
            "filter[property_id]": property_id,
            "pagination[page]": page,
            "pagination[limit]": limit,
        }
        if inserted_after:
            params["filter[inserted_at][gte]"] = inserted_after
        if arrival_from:
            params["filter[arrival_date][gte]"] = arrival_from
        return self.get("bookings", params=params)

    # ----- Booking CRS (Buchungen in Channex anlegen/ändern; Beta) ------------
    # Erfordert die installierte "Booking CRS"-App je Property. Hält Channex mit
    # PMS-seitigen Änderungen (Move/Reprice/Storno) synchron — Channex mergt
    # spätere OTA-Revisionen diff-basiert (Overrides-Logik der Doku).
    def crs_create_booking(self, booking: dict[str, Any]) -> dict[str, Any]:
        return self.post("bookings", json={"booking": booking})

    def crs_update_booking(
        self, booking_id: str, booking: dict[str, Any]
    ) -> dict[str, Any]:
        return self.put(f"bookings/{booking_id}", json={"booking": booking})

    # ----- Reporting API (Booking.com: No-Show / Invalid Card) ----------------
    def report_no_show(
        self, booking_id: str, *, waived_fees: bool
    ) -> dict[str, Any]:
        """No-Show melden (ab 00:00 Objektzeit am Anreisetag, bis 48h danach)."""
        return self.post(
            f"bookings/{booking_id}/no_show",
            json={"no_show_report": {"waived_fees": waived_fees}},
        )

    def report_invalid_card(self, booking_id: str) -> dict[str, Any]:
        """Ungültige Kreditkarte melden (bis 00:00 Objektzeit am Anreisetag)."""
        return self.post(f"bookings/{booking_id}/invalid_card", json={})

    def report_cancel_due_invalid_card(self, booking_id: str) -> dict[str, Any]:
        """Buchung wegen ungültiger Karte stornieren (Booking.com-Regeln)."""
        return self.post(f"bookings/{booking_id}/cancel_due_invalid_card", json={})

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

    def run_channel_action(self, channel_id: str, action: str) -> dict[str, Any]:
        """Eine kanal-eigene Aktion auslösen (Katalogfeld `actions`, z.B.
        `load_future_reservations` = Buchungen holen, die VOR der Verbindung
        entstanden sind). Pfad live verifiziert (01.08.2026): GET auf
        channels/{id}/action/{name} → 200; die anderen Schreibweisen antworten
        mit 404."""
        return self.get(f"channels/{channel_id}/action/{action}")

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

    # ----- Applications (Freischaltungen je Objekt) ---------------------------
    # Der Gäste-Chat ist bei Channex eine kostenpflichtige „Application", die je
    # Property installiert sein MUSS. Ohne sie antwortet die Messaging-API mit
    # 403 „forbidden" — nicht mit einer leeren Liste. Genau daran hing der
    # Posteingang: die Threads standen da, die Nachrichten kamen nie.
    # Doku: https://docs.channex.io/api-v.1-documentation/applications-api
    CHAT_APP_CODE = "channex_messages"

    def list_applications(self) -> dict[str, Any]:
        """Katalog der verfügbaren Anwendungen (code, title, price)."""
        return self.get("applications")

    def list_installed_applications(self) -> dict[str, Any]:
        """Bereits installierte Anwendungen (je Property)."""
        return self.get("applications/installed")

    def install_application(
        self, *, channex_property_id: str, application_code: str
    ) -> dict[str, Any]:
        """Anwendung an einer Property installieren.

        KOSTENPFLICHTIG je Property — der Aufrufer muss das ausdrücklich
        auslösen, nie ein Hintergrund-Job. Channex empfiehlt den `code` statt
        der ID, damit die Konstante in der Umgebung stabil bleibt.
        """
        return self.post(
            "applications/install",
            json={
                "application_installation": {
                    "property_id": channex_property_id,
                    "application_code": application_code,
                }
            },
        )

    def uninstall_application(self, installation_id: str) -> dict[str, Any]:
        return self.delete(f"applications/{installation_id}/uninstall")

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

    # ----- Message-Threads (inkl. Airbnb-Inquiries ohne Buchung) --------------
    def list_message_threads(
        self, *, page: int = 1, limit: int = 50
    ) -> dict[str, Any]:
        """Alle Threads des Kontos (relationships.property zeigt das Objekt —
        der Aufrufer MUSS tenant-scopen). Enthält Airbnb-Inquiry-Threads ohne
        Buchung."""
        return self.get(
            "message_threads",
            params={"pagination[page]": page, "pagination[limit]": limit},
        )

    def get_message_thread(self, thread_id: str) -> dict[str, Any]:
        """Einen Thread lesen (inkl. relationships.property für den Tenant-Scope)."""
        return self.get(f"message_threads/{thread_id}")

    def get_thread_messages(
        self, thread_id: str, *, page: int = 1, limit: int = 50
    ) -> dict[str, Any]:
        return self.get(
            f"message_threads/{thread_id}/messages",
            params={"pagination[page]": page, "pagination[limit]": limit},
        )

    def send_thread_message(self, thread_id: str, message: str) -> dict[str, Any]:
        return self.post(
            f"message_threads/{thread_id}/messages",
            json={"message": {"message": message}},
        )

    def close_message_thread(self, thread_id: str) -> dict[str, Any]:
        return self.post(f"message_threads/{thread_id}/close", json={})

    def mark_thread_no_reply_needed(self, thread_id: str) -> dict[str, Any]:
        """Nur Booking.com: Thread als „keine Antwort nötig" markieren (zählt
        deren Reaktionszeit-Scoring korrekt)."""
        return self.post(f"message_threads/{thread_id}/no_reply_needed", json={})

    def create_attachment(
        self, *, file_b64: str, file_name: str, file_type: str
    ) -> str:
        """Anhang hochladen (Base64) → Attachment-ID für send_booking_attachment."""
        res = self.post(
            "attachments",
            json={"attachment": {
                "file": file_b64, "file_name": file_name, "file_type": file_type,
            }},
        )
        attachment_id = (res.get("data") or {}).get("id")
        if not attachment_id:
            raise ChannexError(
                "Channex lieferte keine Attachment-ID.", status_code=502, payload=res
            )
        return str(attachment_id)

    def send_booking_attachment(
        self, channex_booking_id: str, attachment_id: str, *, message: str | None = None
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"attachment_id": attachment_id}
        if message:
            payload["message"] = message
        return self.post(
            f"bookings/{channex_booking_id}/messages", json={"message": payload}
        )

    # ----- Reviews & Scores (Booking.com, Airbnb, Expedia) --------------------
    def list_reviews(
        self,
        *,
        property_ids: list[str] | None = None,
        page: int = 1,
        limit: int = 50,
    ) -> dict[str, Any]:
        """Gäste-Bewertungen (kontoweit; optional auf Channex-Property-IDs
        gefiltert — der Aufrufer MUSS tenant-scopen)."""
        params: dict[str, Any] = {
            "pagination[page]": page,
            "pagination[limit]": limit,
        }
        if property_ids:
            params["filter[property_id]"] = ",".join(property_ids)
        return self.get("reviews", params=params)

    def get_review(self, review_id: str) -> dict[str, Any]:
        return self.get(f"reviews/{review_id}")

    def reply_review(self, review_id: str, reply: str) -> dict[str, Any]:
        return self.post(
            f"reviews/{review_id}/reply", json={"reply": {"reply": reply}}
        )

    def send_airbnb_guest_review(
        self, review_id: str, review: dict[str, Any]
    ) -> dict[str, Any]:
        """Gast-Bewertung des Hosts (nur Airbnb): scores/tags/public+private
        review/is_reviewee_recommended — Struktur laut Reviews-Collection."""
        return self.post(f"reviews/{review_id}/guest_review", json={"review": review})

    def get_property_score(
        self, channex_property_id: str, *, detailed: bool = False
    ) -> dict[str, Any]:
        suffix = "/detailed" if detailed else ""
        return self.get(f"scores/{channex_property_id}{suffix}")

    # ----- Availability Rules (kanal-spezifische Kontingente) -----------------
    # close_out | availability_offset | max_availability je Kanal + Room-Type.
    def list_availability_rules(self, channex_property_id: str) -> dict[str, Any]:
        return self.get(
            "channel_availability_rules",
            params={"filter[property_id]": channex_property_id},
        )

    def get_availability_rule(self, rule_id: str) -> dict[str, Any]:
        return self.get(f"channel_availability_rules/{rule_id}")

    def create_availability_rule(self, attributes: dict[str, Any]) -> dict[str, Any]:
        return self.post(
            "channel_availability_rules",
            json={"channel_availability_rule": attributes},
        )

    def update_availability_rule(
        self, rule_id: str, attributes: dict[str, Any]
    ) -> dict[str, Any]:
        return self.put(
            f"channel_availability_rules/{rule_id}",
            json={"channel_availability_rule": attributes},
        )

    def delete_availability_rule(self, rule_id: str) -> dict[str, Any]:
        return self.delete(f"channel_availability_rules/{rule_id}")
