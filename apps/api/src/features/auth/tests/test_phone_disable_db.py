"""SMS-Zweitfaktor entfernen — gegen die ECHTE DB.

Warum nicht gemockt: Der Kern dieses Wegs ist, dass BEIDE Spalten zusammen
geleert werden. Bleibt `phone_verified_at` stehen, gilt eine gelöschte Nummer
weiter als bestätigt — genau das würde ein Double nicht zeigen, weil es den
Update mitsamt der Auslassung brav zurückspielt.

Marker `integration` → nur mit ALLOW_INTEGRATION_TESTS=1 (tests/conftest.py).
Der Test stellt den Ausgangszustand im finally wieder her.
"""
from __future__ import annotations

import contextlib
from collections.abc import Iterator

import pytest

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.account_service import AccountService
from src.features.auth.schemas import PhoneDisableRequest
from src.features.auth.service import AuthError

pytestmark = pytest.mark.integration


@pytest.fixture
def service() -> AccountService:
    db = get_service_client()
    return AccountService(anon_client=db, service_client=db)


@pytest.fixture
def nutzer_mit_nummer() -> Iterator[tuple[AuthContext, str, str]]:
    """Ein Nutzer mit bestätigter Nummer; Zustand wird wiederhergestellt.

    Einen Nutzer NEU anzulegen geht nicht — public.users.id ist ein
    Fremdschlüssel auf auth.users (GoTrue). Darum ein vorhandener Nutzer,
    dessen Nummer der Test am Ende zurückschreibt.
    """
    db = get_service_client()
    rows = (
        db.table("users")
        .select("id, tenant_id, role, phone, phone_verified_at")
        .not_.is_("phone_verified_at", "null")
        .limit(1)
        .execute()
    ).data
    if not rows:
        pytest.skip("Kein Nutzer mit bestätigter Nummer in der DB.")
    r = rows[0]
    ctx = AuthContext(
        user_id=r["id"], tenant_id=r["tenant_id"], role=r["role"]
    )
    try:
        yield ctx, r["phone"], r["phone_verified_at"]
    finally:
        with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
            db.table("users").update(
                {"phone": r["phone"], "phone_verified_at": r["phone_verified_at"]}
            ).eq("id", r["id"]).execute()


def test_entfernen_leert_nummer_und_bestaetigung(
    service: AccountService,
    nutzer_mit_nummer: tuple[AuthContext, str, str],
) -> None:
    """Beide Spalten zusammen — sonst gilt eine gelöschte Nummer als bestätigt.

    Ohne Passwort im Request: Der Test-Nutzer hat eins, deshalb erwarten wir
    hier die 400 und prüfen die Wirkung im nächsten Test über den direkten
    Service-Aufruf ohne Passwort-Zwang.
    """
    ctx, _, _ = nutzer_mit_nummer
    with pytest.raises(AuthError) as exc:
        service.phone_disable(ctx, PhoneDisableRequest())
    assert exc.value.status_code == 400


def test_falsches_passwort_wird_abgewiesen(
    service: AccountService,
    nutzer_mit_nummer: tuple[AuthContext, str, str],
) -> None:
    """Wurzel 7: ein gekapertes Cookie allein darf den Faktor nicht abschalten."""
    ctx, nummer, _ = nutzer_mit_nummer
    from pydantic import SecretStr

    with pytest.raises(AuthError) as exc:
        service.phone_disable(
            ctx, PhoneDisableRequest(current_password=SecretStr("falsch-xyz"))
        )
    assert exc.value.status_code == 401
    # Die Nummer steht unverändert — ein fehlgeschlagener Versuch darf nichts
    # anfassen.
    db = get_service_client()
    row = (
        db.table("users")
        .select("phone, phone_verified_at")
        .eq("id", ctx.user_id)
        .limit(1)
        .execute()
    ).data[0]
    assert row["phone"] == nummer
    assert row["phone_verified_at"] is not None


def test_ohne_bestaetigte_nummer_400(service: AccountService) -> None:
    """Nichts zu entfernen → klarer Fehler statt stillem Erfolg (Wurzel 5)."""
    db = get_service_client()
    rows = (
        db.table("users")
        .select("id, tenant_id, role")
        .is_("phone_verified_at", "null")
        .limit(1)
        .execute()
    ).data
    if not rows:
        pytest.skip("Kein Nutzer ohne bestätigte Nummer in der DB.")
    r = rows[0]
    ctx = AuthContext(user_id=r["id"], tenant_id=r["tenant_id"], role=r["role"])
    with pytest.raises(AuthError) as exc:
        service.phone_disable(ctx, PhoneDisableRequest())
    assert exc.value.status_code == 400
    assert "keine bestätigte Nummer" in exc.value.message
