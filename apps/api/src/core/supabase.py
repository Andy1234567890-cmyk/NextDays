"""Supabase-Client-Factory. Anon- und Service-Role-Client getrennt.

Service-Role umgeht RLS → nur in vertrauenswürdigen Server-Pfaden nutzen,
nie mit Gast-/User-Input ohne tenant-Scope.
"""
from functools import lru_cache
from urllib.parse import quote

import httpx
from supabase import Client, ClientOptions, create_client

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
    # h2-Zustandsmaschine verweigert den Reuse einer bereits geschlossenen
    # HTTP/2-Verbindung ("Invalid input ConnectionInputs.RECV_* in state
    # ConnectionState.CLOSED") — gleiche Ursache (Kong schließt idle), gleicher
    # sicherer Ausweg: tote Verbindung verwerfen, frisch verbinden.
    httpx.LocalProtocolError,
)
# Bei den obigen Fehlern wurde garantiert nichts gesendet → auch nicht-idempotente
# Methoden (POST) sicher wiederholbar. Ein Versuch reicht: httpx wirft die tote
# Verbindung aus dem Pool, der Retry öffnet eine frische.
_MAX_RETRIES = 2

# Methoden ohne Seiteneffekt. Nur sie dürfen wiederholt werden, NACHDEM der
# Server bereits geantwortet hat (siehe `handle_request`): dann hat er den
# Request ausgeführt, und ein zweiter Versuch würde ein POST doppelt ausführen
# (Wurzel 2). Vor der Antwort ist jede Methode sicher wiederholbar.
_SICHERE_METHODEN = frozenset({"GET", "HEAD", "OPTIONS"})


class _ReconnectingTransport(httpx.BaseTransport):
    """Wiederholt Requests, deren Keep-Alive-Verbindung serverseitig geschlossen
    wurde. Wrappt den echten Transport, statt ihn zu ersetzen — TLS/HTTP2/Pool-
    Verhalten bleibt unverändert; nur der „Server disconnected"-Fall wird
    abgefangen und mit frischer Verbindung neu versucht."""

    def __init__(self, inner: httpx.BaseTransport) -> None:
        self._inner = inner

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        for attempt in range(_MAX_RETRIES + 1):
            antwort: httpx.Response | None = None
            try:
                antwort = self._inner.handle_request(request)
                # Body HIER lesen, nicht erst beim Aufrufer. Bei HTTP/2 schickt
                # Kong sein GOAWAY häufig ERST NACH den Headern: `handle_request`
                # kehrt dann sauber zurück und der Abbruch schlägt später in
                # `response.read()` zu — außerhalb dieses Retrys, also als 500
                # beim Nutzer. Das Lesen in den Retry hineinzuziehen ist der
                # einzige Weg, diesen Fall überhaupt zu erwischen.
                # supabase-py liest jede Antwort ohnehin vollständig, es geht
                # also kein Streaming verloren.
                antwort.read()
                return antwort
            except _STALE_CONNECTION_ERRORS as exc:
                if antwort is not None:
                    antwort.close()
                # Hat der Server schon geantwortet, hat er den Request auch
                # ausgeführt — dann darf nur eine seiteneffektfreie Methode
                # erneut laufen (Wurzel 2).
                begonnen = antwort is not None
                if attempt >= _MAX_RETRIES or (
                    begonnen and request.method.upper() not in _SICHERE_METHODEN
                ):
                    raise
                log.warning(
                    "supabase_stale_connection_retry",
                    attempt=attempt + 1,
                    method=request.method,
                    url=str(request.url),
                    error=type(exc).__name__,
                    phase="body" if begonnen else "connect",
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


def _zustandslose_optionen(**extra: object) -> ClientOptions:
    """ClientOptions ohne jeden Sitzungs-Zustand — Pflicht für JEDEN Client, der
    hier gebaut wird.

    supabase-py ist für EINEN Browser-Nutzer gedacht: `persist_session=True` +
    `auto_refresh_token=True` (beides Default) legen die zuletzt gesehene Session
    in einem prozessweiten MemoryStorage ab und starten einen `threading.Timer`,
    der das Refresh-Token dieser Session SPÄTER VON SELBST einlöst. Auf einem
    Server, wo derselbe Client-Instanz alle Nutzer bedient, heißt das:
      * `sign_in`/`refresh_session` von Nutzer B überschreibt A's Zustand,
      * A's Timer löst irgendwann A's Refresh-Token serverseitig ein und rotiert
        es — der Browser von A kennt das neue Token nicht,
      * A's nächster echter Refresh schickt das nun verbrauchte Token → GoTrue
        antwortet „Invalid Refresh Token: Already Used" → 401 → Zwangs-Logout.
    Genau das war die Ursache der willkürlichen Abmeldungen. Der Server hält
    KEINE Sitzung: jedes Token kommt pro Request vom Aufrufer.
    """
    return ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
        **extra,  # type: ignore[arg-type]
    )


@lru_cache
def get_anon_client() -> Client:
    """Client mit Anon-Key. Respektiert RLS. Default für User-gebundene Calls."""
    settings = get_settings()
    return _harden(
        create_client(
            settings.supabase_url,
            settings.supabase_anon_key.get_secret_value(),
            _zustandslose_optionen(),
        )
    )


def make_anon_client_with_user_agent(user_agent: str) -> Client:
    """Anon-Client, dessen Auth-Requests einen bestimmten User-Agent tragen.

    GoTrue speichert den User-Agent des Login-Requests in auth.sessions.user_agent
    (live verifiziert). Der globale Client trägt „python-httpx/…", weil der Login
    server-zu-server läuft — damit der Geräteverlauf den ECHTEN Browser zeigt,
    reichen wir den Browser-UA (vom BFF) hier bis an den GoTrue-Call durch.

    Nicht gecacht: pro Login potenziell ein anderer UA. Wird nur für den einen
    sign_in-Call verwendet und danach verworfen (der globale Client bleibt für
    alles andere). Ohne `_zustandslose_optionen` hinterließe jeder dieser
    Wegwerf-Clients einen lebenden Auto-Refresh-Thread."""
    settings = get_settings()
    options = _zustandslose_optionen(headers={"User-Agent": user_agent})
    return _harden(
        create_client(
            settings.supabase_url,
            settings.supabase_anon_key.get_secret_value(),
            options,
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
            _zustandslose_optionen(),
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


def public_storage_url(bucket: str, path: str) -> str:
    """Öffentliche URL eines Objekts in einem PUBLIC-Bucket — für Speichern gedacht.

    Bewusst NICHT `storage.get_public_url`: der Storage-Client kennt nur
    `supabase_url`, und das ist im Container die INTERNE Kong-Adresse
    (`http://kong:8000`). Eine damit gebaute und in die DB geschriebene URL ist im
    Browser und für OTAs unerreichbar — genau so war das Firmenlogo auf /konto ein
    kaputtes Bild und ging als toter Link an die Portale. Basis ist deshalb immer
    `storage_public_base` (von außen erreichbar).
    """
    base = get_settings().storage_public_base
    return f"{base}/storage/v1/object/public/{bucket}/{quote(path, safe='/')}"


def escape_like(value: str) -> str:
    """LIKE-/ILIKE-Metazeichen escapen, damit ein Wert EXAKT (case-insensitiv)
    matcht und kein Wildcard bildet.

    Ohne das wird aus einer E-Mail wie `a%@example.com` ein Wildcard-Muster, das
    fremde Zeilen trifft — bei Sperr-/Zuordnungsprüfungen ein Umgehungspfad
    (Wurzel 8). `\\` zuerst ersetzen, dann `%`/`_` (Reihenfolge zählt, sonst
    werden die eigenen Escape-Backslashes nochmals escaped).
    """
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


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
