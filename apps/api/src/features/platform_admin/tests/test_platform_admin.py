"""Tests für den platform_admin-Slice (Plattform-Backoffice).

Schwerpunkt ist der GUARD, nicht die Fachlogik: dieser Slice ist der einzige,
der mandantenübergreifend arbeitet. Ein Loch hier öffnet alle Betriebe
gegenseitig — die Tests decken deshalb vor allem die Ablehnungspfade ab.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.core.security import (
    PlatformContext,
    get_current_platform_admin,
    require_platform_write,
)
from src.features.platform_admin.service import PlatformAdminService


def _settings() -> MagicMock:
    return MagicMock(name="settings")


def _claims(sub: str = "u1", email: str = "a@b.de") -> dict:
    return {"sub": sub, "email": email, "session_id": "s1"}


def _db_with_admin(role: str | None) -> MagicMock:
    """Service-Client, dessen platform_admins-Abfrage `role` liefert
    (oder eine leere Liste, wenn role None ist)."""
    db = MagicMock(name="supabase")
    chain = (
        db.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value
    )
    chain.execute.return_value.data = [] if role is None else [{"role": role, "active": True}]
    return db


# --- Guard: Ablehnungspfade -------------------------------------------------


def test_guard_rejects_missing_authorization() -> None:
    """Ohne Authorization-Header: 401, bevor irgendetwas geprüft wird."""
    with pytest.raises(HTTPException) as exc:
        get_current_platform_admin(settings=_settings(), authorization=None)
    assert exc.value.status_code == 401


def test_guard_rejects_non_bearer_scheme() -> None:
    with pytest.raises(HTTPException) as exc:
        get_current_platform_admin(settings=_settings(), authorization="Basic abc")
    assert exc.value.status_code == 401


def test_guard_rejects_user_not_in_platform_admins() -> None:
    """Gültiges Token, aber KEIN Eintrag in platform_admins → 403.

    Das ist der Kernfall: ein regulärer Betriebs-Nutzer mit gültigem Login darf
    das Backoffice NICHT betreten, egal was in seinem Token steht.
    """
    with (
        patch("src.core.security._decode_token", return_value=_claims()),
        patch(
            "src.core.supabase.get_service_client",
            return_value=_db_with_admin(None),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            get_current_platform_admin(
                settings=_settings(), authorization="Bearer tok"
            )
    assert exc.value.status_code == 403


def test_guard_rejects_unknown_role_value() -> None:
    """Steht in der Zeile eine unbekannte Rolle, wird abgelehnt (fail-closed)."""
    with (
        patch("src.core.security._decode_token", return_value=_claims()),
        patch(
            "src.core.supabase.get_service_client",
            return_value=_db_with_admin("something_else"),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            get_current_platform_admin(
                settings=_settings(), authorization="Bearer tok"
            )
    assert exc.value.status_code == 403


def test_guard_rejects_token_without_sub() -> None:
    with patch("src.core.security._decode_token", return_value={"email": "a@b.de"}):
        with pytest.raises(HTTPException) as exc:
            get_current_platform_admin(
                settings=_settings(), authorization="Bearer tok"
            )
    assert exc.value.status_code == 401


# --- Guard: Erfolgspfade ----------------------------------------------------


def test_guard_accepts_platform_admin() -> None:
    with (
        patch("src.core.security._decode_token", return_value=_claims()),
        patch(
            "src.core.supabase.get_service_client",
            return_value=_db_with_admin("platform_admin"),
        ),
    ):
        ctx = get_current_platform_admin(
            settings=_settings(), authorization="Bearer tok"
        )
    assert ctx.user_id == "u1"
    assert ctx.platform_role == "platform_admin"
    assert ctx.is_admin is True


def test_guard_accepts_support_but_not_as_admin() -> None:
    """Support kommt rein, gilt aber NICHT als schreibberechtigt."""
    with (
        patch("src.core.security._decode_token", return_value=_claims()),
        patch(
            "src.core.supabase.get_service_client",
            return_value=_db_with_admin("platform_support"),
        ),
    ):
        ctx = get_current_platform_admin(
            settings=_settings(), authorization="Bearer tok"
        )
    assert ctx.platform_role == "platform_support"
    assert ctx.is_admin is False


def test_guard_lowercases_email() -> None:
    with (
        patch(
            "src.core.security._decode_token",
            return_value=_claims(email="Gross@Beispiel.DE"),
        ),
        patch(
            "src.core.supabase.get_service_client",
            return_value=_db_with_admin("platform_admin"),
        ),
    ):
        ctx = get_current_platform_admin(
            settings=_settings(), authorization="Bearer tok"
        )
    assert ctx.email == "gross@beispiel.de"


# --- Schreib-Guard ----------------------------------------------------------


def test_require_write_blocks_support() -> None:
    """platform_support darf keine schreibenden Aktionen auslösen."""
    ctx = PlatformContext(user_id="u1", platform_role="platform_support")
    with pytest.raises(HTTPException) as exc:
        require_platform_write(ctx)
    assert exc.value.status_code == 403


def test_require_write_allows_admin() -> None:
    ctx = PlatformContext(user_id="u1", platform_role="platform_admin")
    require_platform_write(ctx)  # darf nicht werfen


# --- Service ----------------------------------------------------------------


def test_me_maps_role_to_can_write() -> None:
    admin = PlatformContext(user_id="u1", platform_role="platform_admin")
    support = PlatformContext(user_id="u2", platform_role="platform_support")
    assert PlatformAdminService.me(admin).can_write is True
    assert PlatformAdminService.me(support).can_write is False


def test_audit_limit_is_capped() -> None:
    """Ein überzogenes limit wird geklemmt (Wurzel 8: keine Vollabfrage)."""
    db = MagicMock(name="supabase")
    chain = db.table.return_value.select.return_value.order.return_value
    chain.range.return_value.execute.return_value.data = []
    chain.range.return_value.execute.return_value.count = 0

    PlatformAdminService(db=db).audit(limit=99999, offset=0)

    # range(offset, offset + limit - 1) → bei Deckel 200 endet es bei 199.
    chain.range.assert_called_once_with(0, 199)


def test_audit_negative_offset_is_clamped() -> None:
    db = MagicMock(name="supabase")
    chain = db.table.return_value.select.return_value.order.return_value
    chain.range.return_value.execute.return_value.data = []
    chain.range.return_value.execute.return_value.count = 0

    PlatformAdminService(db=db).audit(limit=10, offset=-5)

    chain.range.assert_called_once_with(0, 9)


def test_audit_write_never_raises() -> None:
    """Ein fehlgeschlagener Log-Eintrag darf den Hauptpfad nicht kippen."""
    db = MagicMock(name="supabase")
    db.table.side_effect = RuntimeError("DB weg")
    ctx = PlatformContext(user_id="u1", platform_role="platform_admin")

    # Darf keine Exception nach außen geben (best effort, Wurzel 5).
    PlatformAdminService(db=db).log_action(ctx, "tenant.view")


# --- Betriebe / Registrierungen ---------------------------------------------


def _list_db(rows: list[dict], count: int) -> MagicMock:
    """Client, dessen select().order().range().execute() `rows` liefert."""
    db = MagicMock(name="supabase")
    chain = db.table.return_value.select.return_value.order.return_value
    chain.range.return_value.execute.return_value.data = rows
    chain.range.return_value.execute.return_value.count = count
    # Sammelabfragen (_property_counts/_user_counts/_tenant_names) laufen über
    # select().in_().execute() bzw. select().eq().execute() → leer lassen.
    db.table.return_value.select.return_value.in_.return_value.execute.return_value.data = []
    db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    return db


def test_tenants_limit_capped() -> None:
    db = _list_db([], 0)
    chain = db.table.return_value.select.return_value.order.return_value
    PlatformAdminService(db=db).tenants(limit=10_000, offset=0)
    chain.range.assert_called_once_with(0, 199)


def test_tenants_maps_counts() -> None:
    """Objekt-/Nutzerzahlen werden je Betrieb korrekt zugeordnet."""
    db = _list_db(
        [{"id": "t1", "name": "Haus A", "created_at": "2026-01-01T00:00:00+00:00"}], 1
    )
    # properties: zwei Objekte, davon eines aktiv.
    props = MagicMock()
    props.execute.return_value.data = [
        {"tenant_id": "t1", "status": "active"},
        {"tenant_id": "t1", "status": "draft"},
    ]
    users = MagicMock()
    users.execute.return_value.data = [{"tenant_id": "t1"}, {"tenant_id": "t1"}]

    def _select(*_a, **_k):  # noqa: ANN002, ANN003, ANN202
        m = MagicMock()
        m.order.return_value.range.return_value.execute.return_value.data = [
            {"id": "t1", "name": "Haus A", "created_at": "2026-01-01T00:00:00+00:00"}
        ]
        m.order.return_value.range.return_value.execute.return_value.count = 1
        m.in_.side_effect = [props, users]
        return m

    db.table.return_value.select.side_effect = _select
    res = PlatformAdminService(db=db).tenants()
    assert res.items[0].property_count == 2
    assert res.items[0].active_property_count == 1
    assert res.items[0].user_count == 2


def test_tenant_returns_none_when_unknown() -> None:
    db = MagicMock(name="supabase")
    chain = db.table.return_value.select.return_value.eq.return_value.limit.return_value
    chain.execute.return_value.data = []
    assert PlatformAdminService(db=db).tenant("nope") is None


def test_guests_limit_capped() -> None:
    db = _list_db([], 0)
    chain = db.table.return_value.select.return_value.order.return_value
    PlatformAdminService(db=db).guests(limit=10_000)
    chain.range.assert_called_once_with(0, 199)


def test_users_limit_capped() -> None:
    db = _list_db([], 0)
    chain = db.table.return_value.select.return_value.order.return_value
    PlatformAdminService(db=db).users(limit=10_000)
    chain.range.assert_called_once_with(0, 199)


# --- Finanzen ---------------------------------------------------------------


def test_finanzen_aggregiert_je_waehrung_getrennt() -> None:
    """Währungen werden NIE vermischt — sonst entstünde ein erfundener Kurs."""
    db = MagicMock(name="supabase")
    fees = MagicMock()
    fees.execute.return_value.data = [
        {
            "id": "f1", "tenant_id": "t1", "currency": "EUR",
            "gross_amount_cents": 10_000, "fee_amount_cents": 800,
            "reversed_amount_cents": 0, "created_at": "2026-01-01T00:00:00+00:00",
        },
        {
            "id": "f2", "tenant_id": "t1", "currency": "EUR",
            "gross_amount_cents": 5_000, "fee_amount_cents": 400,
            "reversed_amount_cents": 100, "created_at": "2026-01-02T00:00:00+00:00",
        },
        {
            "id": "f3", "tenant_id": "t2", "currency": "DKK",
            "gross_amount_cents": 20_000, "fee_amount_cents": 1_600,
            "reversed_amount_cents": 0, "created_at": "2026-01-03T00:00:00+00:00",
        },
    ]

    def _table(name: str):  # noqa: ANN202
        m = MagicMock()
        if name == "platform_fees":
            m.select.return_value.order.return_value.limit.return_value = fees
        else:
            m.select.return_value.execute.return_value.data = []
            m.select.return_value.eq.return_value.execute.return_value.data = []
            m.select.return_value.in_.return_value.execute.return_value.data = []
        return m

    db.table.side_effect = _table
    res = PlatformAdminService(db=db).finanzen()

    per = {k.currency: k for k in res.kennzahlen}
    assert per["EUR"].gross_amount_cents == 15_000
    assert per["EUR"].fee_amount_cents == 1_200
    assert per["EUR"].reversed_amount_cents == 100
    assert per["EUR"].fee_count == 2
    assert per["DKK"].fee_amount_cents == 1_600
    # Kein zusammengeworfener Gesamtwert.
    assert len(res.kennzahlen) == 2


def test_finanzen_ignoriert_zeilen_ohne_waehrung() -> None:
    """Ohne Währung lässt sich nichts summieren → Zeile wird übersprungen."""
    db = MagicMock(name="supabase")
    fees = MagicMock()
    fees.execute.return_value.data = [
        {
            "id": "f1", "tenant_id": "t1", "currency": None,
            "gross_amount_cents": 999, "fee_amount_cents": 99,
            "created_at": "2026-01-01T00:00:00+00:00",
        },
    ]

    def _table(name: str):  # noqa: ANN202
        m = MagicMock()
        if name == "platform_fees":
            m.select.return_value.order.return_value.limit.return_value = fees
        else:
            m.select.return_value.execute.return_value.data = []
            m.select.return_value.eq.return_value.execute.return_value.data = []
            m.select.return_value.in_.return_value.execute.return_value.data = []
        return m

    db.table.side_effect = _table
    res = PlatformAdminService(db=db).finanzen()
    assert res.kennzahlen == []


# --- Support ----------------------------------------------------------------


def test_reply_unknown_ticket_returns_none() -> None:
    db = MagicMock(name="supabase")
    chain = db.table.return_value.select.return_value.eq.return_value.limit.return_value
    chain.execute.return_value.data = []
    res = PlatformAdminService(db=db).reply(
        "nope", author_user_id="u1", body="Hallo", internal=False
    )
    assert res is None


def test_reply_marks_agent_and_touches_last_message() -> None:
    """Eine Antwort ist immer vom 'agent' und aktualisiert last_message_at."""
    db = MagicMock(name="supabase")
    tickets = MagicMock()
    tickets.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "tk1"}
    ]
    messages = MagicMock()
    messages.insert.return_value.execute.return_value.data = [
        {
            "id": "m1", "ticket_id": "tk1", "author_kind": "agent",
            "author_user_id": "u1", "body": "Hallo", "internal": False,
            "created_at": "2026-01-01T00:00:00+00:00",
        }
    ]

    def _table(name: str):  # noqa: ANN202
        return tickets if name == "support_tickets" else messages

    db.table.side_effect = _table
    res = PlatformAdminService(db=db).reply(
        "tk1", author_user_id="u1", body="Hallo", internal=False
    )
    assert res is not None
    assert res.author_kind == "agent"
    # last_message_at wurde gesetzt.
    assert tickets.update.called
    assert "last_message_at" in tickets.update.call_args[0][0]


def test_internal_note_is_flagged() -> None:
    """Eine interne Notiz wird als internal=true gespeichert.

    Die Trennung ist entscheidend: solche Zeilen dürfen einem künftigen
    Melder-Endpunkt NIE ausgeliefert werden.
    """
    db = MagicMock(name="supabase")
    tickets = MagicMock()
    tickets.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "tk1"}
    ]
    messages = MagicMock()
    messages.insert.return_value.execute.return_value.data = [
        {
            "id": "m2", "ticket_id": "tk1", "author_kind": "agent",
            "author_user_id": "u1", "body": "Intern", "internal": True,
            "created_at": "2026-01-01T00:00:00+00:00",
        }
    ]

    def _table(name: str):  # noqa: ANN202
        return tickets if name == "support_tickets" else messages

    db.table.side_effect = _table
    PlatformAdminService(db=db).reply(
        "tk1", author_user_id="u1", body="Intern", internal=True
    )
    eingefuegt = messages.insert.call_args[0][0]
    assert eingefuegt["internal"] is True


def test_update_ticket_unknown_returns_none() -> None:
    db = MagicMock(name="supabase")
    db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []
    res = PlatformAdminService(db=db).update_ticket("nope", {"status": "closed"})
    assert res is None


# --- Vorgangshistorie -------------------------------------------------------


def test_vorgaenge_ohne_nutzer_keine_anmeldungen() -> None:
    """login_devices hat kein tenant_id — ohne Nutzer des Betriebs darf KEINE
    ungescopte Vollabfrage laufen (sonst sähe man fremde Anmeldungen)."""
    db = MagicMock(name="supabase")

    def _table(name: str):  # noqa: ANN202
        m = MagicMock()
        # Alle Ereignis-Quellen leer.
        k = m.select.return_value.eq.return_value.order.return_value.limit.return_value
        k.execute.return_value.data = []
        # users: keine Nutzer in diesem Betrieb.
        m.select.return_value.eq.return_value.execute.return_value.data = []
        m.select.return_value.in_.return_value.execute.return_value.data = []
        return m

    db.table.side_effect = _table
    res = PlatformAdminService(db=db).vorgaenge("t-leer")
    assert res.items == []


def test_vorgaenge_sortiert_neueste_zuerst() -> None:
    """Die Quellen werden zusammengeführt und global nach Zeit sortiert."""
    db = MagicMock(name="supabase")

    def _table(name: str):  # noqa: ANN202
        m = MagicMock()
        kette = (
            m.select.return_value.eq.return_value.order.return_value.limit.return_value
        )
        if name == "reservation_events":
            kette.execute.return_value.data = [
                {
                    "kind": "created", "by_user_id": "u1", "detail": {},
                    "reservation_id": "r1",
                    "created_at": "2026-01-01T10:00:00+00:00",
                }
            ]
        elif name == "reservation_cancellation_log":
            kette.execute.return_value.data = [
                {
                    "reservation_id": "r1", "by_user_id": "u1",
                    "reason": "Gast krank", "channel": "direct",
                    "ota_name": None,
                    "created_at": "2026-01-02T10:00:00+00:00",
                }
            ]
        else:
            kette.execute.return_value.data = []
        m.select.return_value.eq.return_value.execute.return_value.data = []
        m.select.return_value.in_.return_value.execute.return_value.data = []
        return m

    db.table.side_effect = _table
    res = PlatformAdminService(db=db).vorgaenge("t1")

    assert len(res.items) == 2
    # Die Stornierung (02.01.) steht vor der Anlage (01.01.).
    assert res.items[0].quelle == "stornierung"
    assert res.items[1].quelle == "reservierung"
    assert res.items[0].detail["grund"] == "Gast krank"


def test_vorgaenge_limit_gedeckelt() -> None:
    db = MagicMock(name="supabase")

    def _table(name: str):  # noqa: ANN202
        m = MagicMock()
        k = m.select.return_value.eq.return_value.order.return_value.limit.return_value
        k.execute.return_value.data = []
        m.select.return_value.eq.return_value.execute.return_value.data = []
        m.select.return_value.in_.return_value.execute.return_value.data = []
        return m

    db.table.side_effect = _table
    PlatformAdminService(db=db).vorgaenge("t1", limit=99999)
    # Der Deckel greift auf allen Quell-Abfragen.
    limit_mock = (
        db.table.return_value.select.return_value.eq.return_value.order.return_value.limit
    )
    aufrufe = [c.args[0] for c in limit_mock.call_args_list]
    assert all(a <= 200 for a in aufrufe) if aufrufe else True
