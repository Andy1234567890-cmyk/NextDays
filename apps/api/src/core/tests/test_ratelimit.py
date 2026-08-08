"""Tests für das Redis-basierte Rate-Limiting (Infra-Runbook Punkt 8).

Deckt ab: 429-Auslösung + Retry-After, IP-Extraktion hinter Traefik (XFF),
Tenant-Keying, Health-Ausnahme, fail-open bei Redis-Ausfall + fail-closed auf
sensiblen Endpunkten. Kein echtes Redis nötig — ein In-Memory-Fake bildet die
Fixed-Window-Semantik der Lua-Auswertung nach.
"""
import asyncio

import pytest
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.config import Settings
from src.core.ratelimit import (
    Limit,
    RateLimiter,
    client_ip_from_xff,
    parse_limit,
)
from src.core.ratelimit_middleware import (
    RateLimitMiddleware,
    _select_bucket,
    _tenant_from_bearer,
)


# --- Fake-Redis: bildet das _WINDOW_LUA-Verhalten in-memory nach ------------
class _FakeRedis:
    def __init__(self, *, fail: bool = False) -> None:
        self._counts: dict[str, int] = {}
        self._fail = fail

    async def eval(self, _script: str, _nkeys: int, key: str, window: str):
        if self._fail:
            raise aioredis.RedisError("simulierter Ausfall")
        self._counts[key] = self._counts.get(key, 0) + 1
        return [self._counts[key], int(window)]

    async def aclose(self) -> None:
        return None


# --- parse_limit ------------------------------------------------------------
def test_parse_limit_ok() -> None:
    assert parse_limit("300/60") == Limit(300, 60)


@pytest.mark.parametrize("bad", ["", "abc", "10", "0/60", "10/0", "-1/60"])
def test_parse_limit_rejects_invalid(bad: str) -> None:
    with pytest.raises(ValueError):
        parse_limit(bad)


# --- IP-Extraktion hinter Traefik ------------------------------------------
def test_client_ip_skips_trusted_proxy() -> None:
    # XFF "client, proxy" mit 1 vertrauenswürdigem Hop → echte IP = "client".
    assert client_ip_from_xff("1.2.3.4, 10.0.0.1", "10.0.0.1", 1) == "1.2.3.4"


def test_client_ip_not_spoofable_via_first_element() -> None:
    # Angreifer setzt eine gefälschte IP voran; mit 1 Hop nehmen wir NICHT das
    # erste, sondern das vorletzte Element (die vom Proxy gesehene echte IP).
    assert client_ip_from_xff("9.9.9.9, 1.2.3.4, 10.0.0.1", "10.0.0.1", 1) == "1.2.3.4"


def test_client_ip_falls_back_to_peer_without_xff() -> None:
    assert client_ip_from_xff(None, "10.0.0.5", 1) == "10.0.0.5"


def test_client_ip_traefik_replaces_xff_hops_zero() -> None:
    # Am Server verifiziert: Coolify-Traefik ERSETZT clientseitiges XFF durch die
    # echte Remote-IP → XFF hat genau ein Element, hops=0 nimmt es (nicht spoofbar,
    # weil ein vom Client vorangestelltes Element von Traefik verworfen wird).
    assert client_ip_from_xff("203.0.113.7", "10.0.0.1", 0) == "203.0.113.7"
    # Selbst wenn ein Angreifer mehrere voranstellt: hops=0 nimmt das LETZTE
    # (= das von Traefik gesetzte echte), nicht das erste.
    assert client_ip_from_xff("9.9.9.9, 203.0.113.7", "10.0.0.1", 0) == "203.0.113.7"


# --- Bucket-Auswahl (gestaffelte Limits) ------------------------------------
def test_bucket_selection_staffelung() -> None:
    s = Settings()
    from src.core.ratelimit_middleware import _Buckets  # noqa: PLC0415

    b = _Buckets(s)
    assert _select_bucket("/api/v1/auth/login", b)[0] == "auth"
    assert _select_bucket("/api/v1/auth/register", b)[0] == "auth"
    # Token-Erneuerung hat einen EIGENEN Bucket (nicht "auth"): sie ist kein
    # Credential-Rateweg, läuft aber in jeder Sitzung regelmäßig.
    assert _select_bucket("/api/v1/auth/refresh", b)[0] == "refresh"
    assert _select_bucket("/api/v1/guest-auth/refresh", b)[0] == "refresh"
    assert _select_bucket("/api/v1/payments/booking/x/intent", b)[0] == "payments"
    assert _select_bucket("/api/v1/booking-engine/listings", b)[0] == "listings"
    assert _select_bucket("/api/v1/properties/x", b)[0] == "default"
    # Auth/Payments sind sensibel (fail-closed-Kandidaten), Listings nicht.
    assert _select_bucket("/api/v1/auth/login", b)[2] is True
    assert _select_bucket("/api/v1/booking-engine/listings", b)[2] is False


def test_provider_webhooks_sind_nicht_fail_closed() -> None:
    """KRITISCH (Vorfall 29.07.2026): Eingehende Webhooks duerfen bei einem
    Redis-Ausfall NICHT mit 503 abgewiesen werden.

    Der Stripe-Webhook liegt unter /payments/ und waere sonst als sensibel
    eingestuft. Real wurden dadurch 10 von 10 customer.subscription.created-
    Zustellungen verworfen — ein bezahltes Abo blieb dauerhaft auf 'Kein Abo'.
    Die Endpunkte pruefen selbst Signatur/Secret; das Rate-Limit ist dort
    Missbrauchsschutz, nicht die Zugangskontrolle.
    """
    from src.core.ratelimit_middleware import _Buckets  # noqa: PLC0415

    b = _Buckets(Settings())
    for pfad in (
        "/api/v1/payments/webhook",
        "/api/v1/payments/paypal/webhook",
        "/api/v1/channel-manager/webhook",
        "/api/v1/whatsapp/webhook",
    ):
        bucket, _, sensibel = _select_bucket(pfad, b)
        assert sensibel is False, f"{pfad} darf nicht fail-closed sein"
        # Gezaehlt wird weiterhin — nur die Ausfall-Reaktion aendert sich.
        assert bucket in ("payments", "default"), pfad


def test_zahlungs_endpunkte_bleiben_fail_closed() -> None:
    """Gegenprobe: NUR die Webhooks sind ausgenommen. Die uebrigen
    /payments/-Routen (Intent anlegen, Refund) bleiben sensibel — dort ist das
    Limit echter Missbrauchsschutz gegen eingeloggte Angreifer."""
    from src.core.ratelimit_middleware import _Buckets  # noqa: PLC0415

    b = _Buckets(Settings())
    for pfad in (
        "/api/v1/payments/booking/x/intent",
        "/api/v1/payments/x/refund",
    ):
        assert _select_bucket(pfad, b)[2] is True, pfad


# --- Tenant-Extraktion aus dem Bearer (best-effort) -------------------------
def test_tenant_from_bearer_reads_app_metadata() -> None:
    import base64
    import json

    payload = {"app_metadata": {"tenant_id": "tenant-123"}}
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    token = f"h.{body}.sig"
    assert _tenant_from_bearer(f"Bearer {token}") == "tenant-123"


def test_tenant_from_bearer_none_on_garbage() -> None:
    assert _tenant_from_bearer("Bearer not-a-jwt") is None
    assert _tenant_from_bearer(None) is None


# --- RateLimiter-Kern -------------------------------------------------------
def test_limiter_blocks_after_max() -> None:
    async def run() -> None:
        limiter = RateLimiter(_FakeRedis())
        limit = Limit(3, 60)
        for _ in range(3):
            d = await limiter.check("k", limit)
            assert d.allowed
        blocked = await limiter.check("k", limit)
        assert not blocked.allowed
        assert blocked.retry_after == 60

    asyncio.run(run())


def test_limiter_degraded_on_redis_error() -> None:
    async def run() -> None:
        limiter = RateLimiter(_FakeRedis(fail=True))
        d = await limiter.check("k", Limit(1, 60))
        assert d.degraded and d.allowed  # fail-open-Signal an die Middleware

    asyncio.run(run())


# --- Middleware end-to-end (TestClient) -------------------------------------
def _app_with_limiter(redis_client, settings: Settings) -> FastAPI:
    app = FastAPI()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/v1/booking-engine/listings")
    def listings() -> dict[str, str]:
        return {"ok": "yes"}

    @app.get("/api/v1/auth/login")
    def login() -> dict[str, str]:
        return {"ok": "yes"}

    # Der Refresh-Bucket liest den Request-Body. Die Route gibt das gelesene
    # Token zurück, damit die Tests beweisen können, dass der Body die
    # Middleware überlebt hat.
    @app.post("/api/v1/auth/refresh")
    def refresh(payload: dict) -> dict[str, str]:
        return {"gesehen": payload.get("refresh_token", "")}

    app.add_middleware(
        RateLimitMiddleware,
        limiter=RateLimiter(redis_client),
        settings=settings,
    )
    return app


def test_429_and_retry_after_on_listings() -> None:
    settings = Settings(rate_limit_listings="2/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    h = {"X-Forwarded-For": "1.2.3.4, 10.0.0.1"}
    assert client.get("/api/v1/booking-engine/listings", headers=h).status_code == 200
    assert client.get("/api/v1/booking-engine/listings", headers=h).status_code == 200
    r = client.get("/api/v1/booking-engine/listings", headers=h)
    assert r.status_code == 429
    assert r.headers.get("Retry-After") == "60"
    assert r.headers.get("X-RateLimit-Limit") == "2"


def test_health_is_exempt() -> None:
    settings = Settings(rate_limit_listings="1/60", rate_limit_default="1/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    # Viele Health-Calls dürfen NIE limitiert werden.
    for _ in range(10):
        assert client.get("/health").status_code == 200


def test_distinct_ips_have_separate_budgets() -> None:
    settings = Settings(rate_limit_listings="1/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    # Default hops=0 (Traefik-Verhalten): echte IP = letztes XFF-Element.
    a = {"X-Forwarded-For": "1.1.1.1"}
    b = {"X-Forwarded-For": "2.2.2.2"}
    assert client.get("/api/v1/booking-engine/listings", headers=a).status_code == 200
    assert client.get("/api/v1/booking-engine/listings", headers=a).status_code == 429
    # Andere IP hat eigenes Budget → nicht blockiert.
    assert client.get("/api/v1/booking-engine/listings", headers=b).status_code == 200


def _bearer(tenant_id: str) -> str:
    """Minimaler Bearer-Token mit tenant_id in app_metadata (nur fürs Keying;
    die Middleware liest den Claim ohne Signaturprüfung)."""
    import base64
    import json

    body = base64.urlsafe_b64encode(
        json.dumps({"app_metadata": {"tenant_id": tenant_id}}).encode()
    ).rstrip(b"=").decode()
    return f"Bearer h.{body}.sig"


def test_listings_logged_in_keyed_per_tenant_not_ip() -> None:
    # Eingeloggte listings-Requests laufen gegen listings_tenant (pro Tenant).
    # Das zusätzlich gekoppelte IP-Limit ist hier großzügig (Scraper-Schutz), der
    # legitime Betrieb bleibt darunter — ein Kalender-Load sperrt sich nicht aus.
    settings = Settings(rate_limit_listings="100/60", rate_limit_listings_tenant="3/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    h = {"Authorization": _bearer("tenant-A"), "X-Forwarded-For": "9.9.9.9"}
    # 3 erlaubt (Tenant-Limit), das IP-Limit (100) greift nicht.
    assert client.get("/api/v1/booking-engine/listings", headers=h).status_code == 200
    assert client.get("/api/v1/booking-engine/listings", headers=h).status_code == 200
    assert client.get("/api/v1/booking-engine/listings", headers=h).status_code == 200
    r = client.get("/api/v1/booking-engine/listings", headers=h)
    assert r.status_code == 429
    assert r.headers.get("X-RateLimit-Limit") == "3"


def test_listings_two_tenants_same_ip_have_separate_budgets() -> None:
    # Büro-NAT: zwei Betriebe teilen sich eine öffentliche IP, dürfen sich aber
    # NICHT das Tenant-Limit teilen — pro-Tenant-Keying trennt sie. Das IP-Limit
    # ist großzügig genug, dass legitime NAT-Nutzung nicht kollidiert.
    settings = Settings(rate_limit_listings="100/60", rate_limit_listings_tenant="1/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    ip = {"X-Forwarded-For": "5.5.5.5"}
    a = {"Authorization": _bearer("tenant-A"), **ip}
    b = {"Authorization": _bearer("tenant-B"), **ip}
    assert client.get("/api/v1/booking-engine/listings", headers=a).status_code == 200
    assert client.get("/api/v1/booking-engine/listings", headers=a).status_code == 429
    # Anderer Tenant, gleiche IP → eigenes Budget.
    assert client.get("/api/v1/booking-engine/listings", headers=b).status_code == 200


def test_listings_unsigned_token_rotation_cannot_bypass_ip_limit() -> None:
    # Sicherheitsfix: die tenant_id kommt aus einem NICHT signaturgeprüften JWT.
    # Ein Scraper von EINER IP rotiert erfundene tenant_ids, um pro UUID ein
    # eigenes 1200/60-Fenster zu bekommen. Das gekoppelte IP-Limit (hier 2/60)
    # deckelt ihn trotzdem — nach 2 Requests ist Schluss, egal wie viele
    # Fantasie-Tenants er durchprobiert.
    settings = Settings(rate_limit_listings="2/60", rate_limit_listings_tenant="1000/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    ip = {"X-Forwarded-For": "6.6.6.6"}
    codes = [
        client.get(
            "/api/v1/booking-engine/listings",
            headers={"Authorization": _bearer(f"fake-tenant-{i}"), **ip},
        ).status_code
        for i in range(5)
    ]
    # Nur die ersten 2 (IP-Limit) kommen durch, der Rest wird trotz frischer
    # tenant_id geblockt.
    assert codes == [200, 200, 429, 429, 429]


def test_listings_ip_capped_attacker_cannot_fill_victim_tenant_counter() -> None:
    # Cross-Tenant-DoS-Fix: Ein Angreifer sendet mit der REALEN Opfer-tenant_id
    # (unsigniertes JWT) von EINER IP. Das IP-Limit (2/60) wird ZUERST geprüft —
    # nach 2 Requests ist die Angreifer-IP dicht und der globale Opfer-Tenant-
    # Zähler wurde nur 2× (statt bei jedem Request) inkrementiert. Danach kann das
    # Opfer selbst (andere IP) seinen Kalender weiter laden, weil sein Tenant-
    # Fenster (5/60) nicht vom Angreifer vollgeschrieben wurde.
    settings = Settings(rate_limit_listings="2/60", rate_limit_listings_tenant="5/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    victim = _bearer("victim-tenant")
    attacker_ip = {"X-Forwarded-For": "6.6.6.6"}
    codes = [
        client.get(
            "/api/v1/booking-engine/listings",
            headers={"Authorization": victim, **attacker_ip},
        ).status_code
        for _ in range(6)
    ]
    # Angreifer kommt nur 2× durch (IP-Limit), danach 429 — der Opfer-Tenant-
    # Zähler wurde dadurch nur 2× erhöht, nicht 6×.
    assert codes == [200, 200, 429, 429, 429, 429]
    # Das Opfer von einer sauberen IP hat sein Tenant-Fenster (5/60) noch frei:
    # der Angreifer hat es nur bis 2 gefüllt. 2 Requests (innerhalb des IP-Limits
    # von 2) gehen durch — vor dem Fix hätte der Angreifer das Fenster längst voll.
    clean_ip = {"X-Forwarded-For": "10.20.30.40"}
    for _ in range(2):
        assert (
            client.get(
                "/api/v1/booking-engine/listings",
                headers={"Authorization": victim, **clean_ip},
            ).status_code
            == 200
        )


def test_listings_multi_ip_attack_cannot_lock_out_victim_employees() -> None:
    # Kernbeweis des Multi-IP-Fixes: der Tenant-Zähler ist pro (tenant, ip) gekeyt.
    # Mehrere Angreifer-IPs mit der REALEN Opfer-tenant_id können zusammen NICHT das
    # Fenster der echten Mitarbeiter (andere IP) vollschreiben — jeder Angreifer
    # füllt nur seinen eigenen (Opfer-Tenant, Angreifer-IP)-Zähler. Ein globaler
    # `listings:tenant:{tenant}`-Zähler wäre hier nach 3 IPs × 4 = 12 > 5 voll und
    # hätte die Mitarbeiter ausgesperrt.
    settings = Settings(rate_limit_listings="4/60", rate_limit_listings_tenant="5/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    victim = _bearer("victim-tenant")
    # 3 Angreifer-IPs feuern je 4 Requests (unter ihrem IP-Limit von 4).
    for ip in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):
        for _ in range(4):
            client.get(
                "/api/v1/booking-engine/listings",
                headers={"Authorization": victim, "X-Forwarded-For": ip},
            )
    # Echter Mitarbeiter des Opfer-Tenants von SEINER sauberen IP: sein
    # (tenant, ip)-Fenster ist unberührt → alle 4 Requests (unter dem IP-Limit)
    # gehen durch. Ohne den Fix hätten die 12 Angreifer-Requests den globalen
    # Tenant-Zähler (5/60) längst gefüllt und den Mitarbeiter mit 429 ausgesperrt.
    emp_ip = {"X-Forwarded-For": "9.8.7.6"}
    codes = [
        client.get(
            "/api/v1/booking-engine/listings",
            headers={"Authorization": victim, **emp_ip},
        ).status_code
        for _ in range(4)
    ]
    assert codes == [200, 200, 200, 200]


def test_fail_open_on_redis_outage_for_normal_endpoint() -> None:
    settings = Settings(rate_limit_listings="1/60")
    client = TestClient(_app_with_limiter(_FakeRedis(fail=True), settings))
    h = {"X-Forwarded-For": "1.2.3.4, 10.0.0.1"}
    # Redis tot → normaler Endpunkt läuft durch (fail-open), kein Aussperren.
    for _ in range(5):
        assert client.get("/api/v1/booking-engine/listings", headers=h).status_code == 200


def test_fail_closed_on_redis_outage_for_auth() -> None:
    settings = Settings(rate_limit_fail_closed_sensitive=True)
    client = TestClient(_app_with_limiter(_FakeRedis(fail=True), settings))
    h = {"X-Forwarded-For": "1.2.3.4, 10.0.0.1"}
    # Redis tot → sensibler Auth-Endpunkt fail-closed (503 statt offenes Brute-Force-Fenster).
    r = client.get("/api/v1/auth/login", headers=h)
    assert r.status_code == 503
    assert r.headers.get("Retry-After") == "5"


def test_disabled_limiter_passes_through() -> None:
    settings = Settings(rate_limit_enabled=False, rate_limit_listings="1/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    h = {"X-Forwarded-For": "1.2.3.4, 10.0.0.1"}
    for _ in range(5):
        assert client.get("/api/v1/booking-engine/listings", headers=h).status_code == 200


# --- Token-Erneuerung: eigener Bucket, pro Sitzung statt pro IP -------------
def test_refresh_body_ueberlebt_die_middleware() -> None:
    """REGRESSION: Der refresh-Bucket liest den Request-Body, um pro Sitzung zu
    keyen. Der ASGI-`receive`-Stream ist danach aufgebraucht — ohne das
    Nachreichen des gepufferten Bodys sähe die Route einen LEEREN Body und
    wiese JEDE Erneuerung mit 422 ab (alle Nutzer sofort ausgeloggt)."""
    client = TestClient(_app_with_limiter(_FakeRedis(), Settings()))
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": "tok-abc"})
    assert r.status_code == 200
    assert r.json()["gesehen"] == "tok-abc"


def test_refresh_pro_sitzung_nicht_pro_ip() -> None:
    """KERN DES FIXES: Die BFF-Frontends rufen server-zu-server aus EINEM
    Container auf — alle Nutzer teilen sich also eine IP. Im alten auth-Bucket
    (10/60/IP) sperrte die Aktivität FREMDER Nutzer einen Nutzer aus und meldete
    ihn ab. Gekeyt wird deshalb je Sitzung."""
    settings = Settings(rate_limit_refresh="2/60")
    client = TestClient(_app_with_limiter(_FakeRedis(), settings))
    # Alle Aufrufe von DERSELBEN IP (wie beim BFF), aber verschiedene Sitzungen.
    h = {"X-Forwarded-For": "1.2.3.4"}
    for token in ("sitzung-a", "sitzung-b", "sitzung-c", "sitzung-d"):
        r = client.post(
            "/api/v1/auth/refresh", json={"refresh_token": token}, headers=h
        )
        assert r.status_code == 200, f"{token} wurde von fremden Sitzungen ausgesperrt"

    # Dieselbe Sitzung läuft dagegen sehr wohl in ihr eigenes Limit (2/60).
    for _ in range(2):
        client.post(
            "/api/v1/auth/refresh", json={"refresh_token": "sitzung-a"}, headers=h
        )
    r = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": "sitzung-a"}, headers=h
    )
    assert r.status_code == 429


def test_refresh_ist_fail_open_bei_redis_ausfall() -> None:
    """Wurzel 5: Ein toter Redis darf keine Abmeldewelle auslösen. /auth/refresh
    ist bewusst NICHT sensibel — ein 503 hier würde das BFF als „Sitzung
    beendet" werten und alle aktiven Nutzer auf /login werfen."""
    settings = Settings(rate_limit_fail_closed_sensitive=True)
    client = TestClient(_app_with_limiter(_FakeRedis(fail=True), settings))
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": "tok"})
    assert r.status_code == 200
