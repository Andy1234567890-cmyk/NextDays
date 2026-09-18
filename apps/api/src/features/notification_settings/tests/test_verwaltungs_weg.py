"""Der Verwaltungs-Weg: ein Betrieb stellt die Benachrichtigungen SEINER Leute ein.

Geprüft wird hier genau die Grenze, die den Weg von einer IDOR trennt: dass
`/nutzer/{user_id}` die fremde ID NICHT ungeprüft übernimmt, sondern nur eine
Zeile des eigenen Tenants erreicht (Wurzel 3/9). Dazu kommt, dass die
Pflicht-E-Mail-Regel auch auf diesem Weg gilt — ein Admin darf einer
Mitarbeiterin die vertraglich nötige Mail nicht abdrehen.

Bewusst MIT Double statt gegen die echte DB: Der Befund ist eine Frage der
Abfrage (welche Filter gehen an PostgREST?), nicht der Persistenz. Ein Double
zeigt sie direkt und läuft in jedem Lauf mit — die DB-Tests nebenan brauchen
ALLOW_INTEGRATION_TESTS und schweigen sonst. Genau in dieser Lücke säße der
Fehler, den niemand bemerkt.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.notification_settings.schemas import NotificationSettingsUpdate
from src.features.notification_settings.service import (
    NotificationScopeFehler,
    NotificationSettingsService,
)

EIGENER_TENANT = "11111111-1111-1111-1111-111111111111"
FREMDER_TENANT = "22222222-2222-2222-2222-222222222222"
MITARBEITERIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
FREMDE_PERSON = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
ADMIN = "cccccccc-cccc-cccc-cccc-cccccccccccc"

# Wer zu welchem Betrieb gehört. Das Double antwortet NUR, wenn die Abfrage
# beide Filter mitbringt — fehlt der Tenant-Filter, findet sie nichts und der
# Test schlägt fehl. Das ist die eigentliche Aussage dieser Datei.
_USERS = {
    MITARBEITERIN: EIGENER_TENANT,
    ADMIN: EIGENER_TENANT,
    FREMDE_PERSON: FREMDER_TENANT,
}


class _Abfrage:
    def __init__(self, tabelle: str, doppel: _DoppelDb) -> None:
        self._tabelle = tabelle
        self._doppel = doppel
        self._filter: dict[str, Any] = {}

    def select(self, *_a: Any, **_k: Any) -> _Abfrage:
        return self

    def eq(self, spalte: str, wert: Any) -> _Abfrage:
        self._filter[spalte] = wert
        return self

    def limit(self, _n: int) -> _Abfrage:
        return self

    def upsert(self, zeile: dict[str, Any], **_k: Any) -> _Abfrage:
        self._doppel.geschrieben.append((self._tabelle, zeile))
        return self

    def execute(self) -> Any:
        if self._tabelle == "users":
            self._doppel.user_abfragen.append(dict(self._filter))
            gesucht = self._filter.get("id")
            # Exakt die Semantik von load_scoped: (id, tenant_id) müssen BEIDE
            # passen. Ein Aufruf ohne tenant_id-Filter bekommt `None` und damit
            # nie einen Treffer.
            passt = (
                gesucht in _USERS
                and _USERS[gesucht] == self._filter.get("tenant_id")
            )
            return type("R", (), {"data": [{"id": gesucht}] if passt else []})()
        # notification_settings: der Einfachheit halber immer leer → Defaults.
        return type("R", (), {"data": []})()


class _DoppelDb:
    """Minimales Supabase-Double — nur was dieser Pfad wirklich aufruft."""

    def __init__(self) -> None:
        self.geschrieben: list[tuple[str, dict[str, Any]]] = []
        self.user_abfragen: list[dict[str, Any]] = []

    def table(self, name: str) -> _Abfrage:
        return _Abfrage(name, self)


@pytest.fixture
def db() -> _DoppelDb:
    return _DoppelDb()


@pytest.fixture
def service(db: _DoppelDb) -> NotificationSettingsService:
    return NotificationSettingsService(db=db)  # type: ignore[arg-type]


@pytest.fixture
def admin() -> AuthContext:
    return AuthContext(user_id=ADMIN, tenant_id=EIGENER_TENANT, role="admin")


def test_eigener_mitarbeiter_ist_erreichbar(
    service: NotificationSettingsService, admin: AuthContext
) -> None:
    """Der Normalfall: die Übersicht einer Kollegin im eigenen Betrieb."""
    overview = service.overview_fuer_nutzer(admin, MITARBEITERIN)
    assert overview.kategorien, "Der Katalog muss vollständig ankommen."


def test_fremder_tenant_wird_nicht_gefunden(
    service: NotificationSettingsService, admin: AuthContext
) -> None:
    """Die ID eines Nutzers aus einem ANDEREN Betrieb führt auf 404 — nicht auf
    403 und nicht auf dessen Daten. Gleiche Meldung wie „gibt es nicht", damit
    die Existenz eines fremden Kontos keine Auskunft ist."""
    with pytest.raises(NotificationScopeFehler) as exc:
        service.overview_fuer_nutzer(admin, FREMDE_PERSON)
    assert exc.value.status_code == 404


def test_abfrage_traegt_den_tenant_filter(
    service: NotificationSettingsService, admin: AuthContext, db: _DoppelDb
) -> None:
    """Der eigentliche Schutz, direkt gemessen: die users-Abfrage filtert auf
    BEIDES. Ein späterer Umbau, der `load_scoped` gegen ein rohes `.eq("id")`
    tauscht, fällt genau hier auf — und nicht erst beim Kunden."""
    service.overview_fuer_nutzer(admin, MITARBEITERIN)
    assert db.user_abfragen == [{"id": MITARBEITERIN, "tenant_id": EIGENER_TENANT}]


def test_ohne_tenant_kein_zugriff(service: NotificationSettingsService) -> None:
    """Ein Konto ohne Unternehmen kann niemanden verwalten (fail-closed,
    Wurzel 5) — sonst liefe die Abfrage mit tenant_id=None ins Leere und der
    Grund bliebe unklar."""
    ohne = AuthContext(user_id=ADMIN, tenant_id=None, role="admin")
    with pytest.raises(NotificationScopeFehler) as exc:
        service.overview_fuer_nutzer(ohne, MITARBEITERIN)
    assert exc.value.status_code == 403


def test_pflicht_mail_gilt_auch_fuer_den_admin(
    service: NotificationSettingsService, admin: AuthContext, db: _DoppelDb
) -> None:
    """`owner_booking_email` ist vertraglich nötig. Der Verwaltungs-Weg darf
    kein Schlupfloch um `email_pflicht` sein — der Schreibpfad korrigiert den
    Wunsch still auf `true` zurück, wie im eigenen Pfad."""
    service.update_fuer_nutzer(
        admin,
        MITARBEITERIN,
        NotificationSettingsUpdate(owner_booking_email=False),
    )
    _, zeile = db.geschrieben[-1]
    assert zeile["owner_booking_email"] is True


def test_schreiben_trifft_den_zielnutzer_nicht_den_admin(
    service: NotificationSettingsService, admin: AuthContext, db: _DoppelDb
) -> None:
    """Die Zeile gehört der Mitarbeiterin. Würde hier `ctx.user_id` stehen,
    schaltete der Admin unbemerkt seine EIGENEN Mails ab — ein Fehler, den die
    Oberfläche nie zeigt, weil sie danach die fremde Zeile neu lädt."""
    service.update_fuer_nutzer(
        admin,
        MITARBEITERIN,
        NotificationSettingsUpdate(reminders_email=False),
    )
    _, zeile = db.geschrieben[-1]
    assert zeile["user_id"] == MITARBEITERIN
    assert zeile["reminders_email"] is False
