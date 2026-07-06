"""Supabase-Client-Factory. Anon- und Service-Role-Client getrennt.

Service-Role umgeht RLS → nur in vertrauenswürdigen Server-Pfaden nutzen,
nie mit Gast-/User-Input ohne tenant-Scope.
"""
from functools import lru_cache

import httpx
from supabase import Client, create_client

from .config import get_settings
from .logging import get_logger

log = get_logger("nextdays.supabase")

# Verbindungsabbrüche, die NICHT vom Server beantwortet wurden (tote Keep-Alive-
# Verbindung): Kong/PostgREST schließt idle HTTP/2-Connections serverseitig; der
# nächste Reuse einer gecachten Verbindung läuft ins Leere. Da der Request den
# Server nie erreicht hat, ist ein erneuter Versuch idempotenz-sicher.
_STALE_CONNECTION_ERRORS = (
    httpx.RemoteProtocolError,  # "Server disconnected without sending a response"
    httpx.ConnectError,
    httpx.ReadError,
)
# Bei den obigen Fehlern wurde garantiert nichts gesendet → auch nicht-idempotente
# Methoden (POST) sicher wiederholbar. Ein Versuch reicht: httpx wirft die tote
# Verbindung aus dem Pool, der Retry öffnet eine frische.
_MAX_RETRIES = 2


class _ReconnectingTransport(httpx.BaseTransport):
    """Wiederholt Requests, deren Keep-Alive-Verbindung serverseitig geschlossen
    wurde. Wrappt den echten Transport, statt ihn zu ersetzen — TLS/HTTP2/Pool-
    Verhalten bleibt unverändert; nur der „Server disconnected"-Fall wird
    abgefangen und mit frischer Verbindung neu versucht."""

    def __init__(self, inner: httpx.BaseTransport) -> None:
        self._inner = inner

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        for attempt in range(_MAX_RETRIES + 1):
            try:
                return self._inner.handle_request(request)
            except _STALE_CONNECTION_ERRORS as exc:
                if attempt >= _MAX_RETRIES:
                    raise
                log.warning(
                    "supabase_stale_connection_retry",
                    attempt=attempt + 1,
                    method=request.method,
                    url=str(request.url),
                    error=type(exc).__name__,
                )
        # Unerreichbar: range liefert immer ≥1 Iteration, die entweder
        # zurückkehrt oder (im letzten Durchlauf) re-raised.
        raise RuntimeError("unreachable")  # pragma: no cover

    def close(self) -> None:
        self._inner.close()


def _harden(client: Client) -> Client:
    """Den httpx-Transport jeder Sub-Session des Clients gegen tote Keep-Alive-
    Verbindungen absichern. Greift auf das vom supabase-py intern gebaute
    httpx.Client zu (postgrest/auth/storage/functions haben je eine eigene)."""
    sessions = [
        getattr(getattr(client, attr, None), "session", None)
        for attr in ("postgrest", "auth", "storage", "functions")
    ]
    for session in sessions:
        transport = getattr(session, "_transport", None)
        if transport is not None and not isinstance(
            transport, _ReconnectingTransport
        ):
            # supabase-py exponiert kein öffentliches Transport-API; der interne
            # httpx-Client wird nach Konstruktion gehärtet.
            session._transport = _ReconnectingTransport(transport)  # noqa: SLF001  # pylint: disable=protected-access
    return client


@lru_cache
def get_anon_client() -> Client:
    """Client mit Anon-Key. Respektiert RLS. Default für User-gebundene Calls."""
    settings = get_settings()
    return _harden(
        create_client(
            settings.supabase_url,
            settings.supabase_anon_key.get_secret_value(),
        )
    )


@lru_cache
def get_service_client() -> Client:
    """Client mit Service-Role-Key. Umgeht RLS. Nur für Admin-/System-Pfade."""
    settings = get_settings()
    return _harden(
        create_client(
            settings.supabase_url,
            settings.supabase_service_role_key.get_secret_value(),
        )
    )


# PostgREST cappt jede Antwort standardmäßig bei PGRST_DB_MAX_ROWS (deploy: 1000).
# Ein Query ohne .range()/.limit() liefert also STILL höchstens so viele Zeilen —
# für Aggregationen über viele Zeilen (Owner-Statement-Summen, Portal-Einnahmen,
# Forecast-Training) ist das ein geräuschloser Datenverlust. `fetch_all_rows` holt
# ALLE Zeilen paginiert nach.
_PAGE_SIZE = 1000


def fetch_all_rows(query: object, *, page_size: int = _PAGE_SIZE) -> list[dict]:
    """Alle Zeilen eines PostgREST-Selects paginiert laden (umgeht den 1000er-Cap).

    `query` ist ein fertig gefilterter, NOCH NICHT ausgeführter PostgREST-Query
    (ohne .range()/.limit()/.execute()); er MUSS eine stabile Sortierung tragen
    (.order(...)), sonst kann Pagination Zeilen doppelt/gar nicht liefern. Der
    Query wird für jede Seite frisch mit .range() ausgeführt — supabase-py-Builder
    sind wiederverwendbar, solange man .range() je Aufruf neu setzt.
    """
    rows: list[dict] = []
    offset = 0
    while True:
        page = (
            query.range(offset, offset + page_size - 1).execute().data or []
        )
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def load_scoped(
    db: Client,
    table: str,
    row_id: str,
    tenant_id: str,
    *,
    columns: str = "*",
    not_found: Exception,
) -> dict:
    """Lädt EINE Zeile per ID UND erzwingt tenant-Scope in EINEM Schritt.

    Service-Role umgeht RLS, daher MUSS jeder per-ID-Zugriff explizit auf den
    Tenant scopen (Wurzel: „der Anfrage vertrauen"). Getrennt in Load-dann-Check
    lässt sich der Check vergessen — hier ist beides untrennbar: filtert direkt
    per (id, tenant_id) und wirft `not_found`, wenn die Zeile nicht existiert ODER
    einem fremden Tenant gehört (bewusst dieselbe Meldung — kein Existenz-Leak an
    einen fremden Tenant). Jeder Slice übergibt seine eigene Fehlerklasse.
    """
    rows = (
        db.table(table)
        .select(columns)
        .eq("id", row_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    if not rows:
        raise not_found
    return rows[0]
