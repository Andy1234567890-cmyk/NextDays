"""Die Entdopplung muss fuer ALLE Kanaele gelten, nicht nur fuer die Glocke.

DER BEFUND: `dedup_key` wirkte ausschliesslich in `_glocke()` ueber den
partiellen UNIQUE-Index `notifications_dedup_offen_uq`. Danach lief
`for kanal in kategorie.kanaele` unbedingt weiter — E-Mail und SMS gingen also
auch dann raus, wenn die Glocke die Meldung gerade als „steht schon offen da"
abgewiesen hatte.

Was das real bedeutete:
  * `_melde_eigentuemer` (reservations/_base.py) meldet bei JEDEM `moved`-Event.
    Fuenf Umbuchungen derselben Buchung = eine Glocke, aber fuenf Mails und
    fuenf SMS. `owner_booking` ist `email_pflicht=True`, also nicht abwaehlbar
    — der Eigentuemer konnte sich nicht einmal wehren.
  * `bookings_sync` meldet beim Re-Import nach geloeschter Staging-Zeile erneut.

`dienstleistungen`/`ereignisse` schuetzen sich teils mit einem eigenen Flag;
der Riegel gehoert aber an die EINE Stelle, durch die alle Kanaele laufen —
sonst vergisst ihn der naechste Aufrufer wieder (Wurzel 2).
"""
from __future__ import annotations

from types import SimpleNamespace

from src.features.notification_settings.dispatcher import NotificationDispatcher


class _Tabelle:
    """`notifications`-Insert, der beim ZWEITEN Mal den 23505 wirft.

    Genau das Verhalten des partiellen UNIQUE-Index: dieselbe ungelesene
    Meldung ein zweites Mal einzufuegen schlaegt fehl.
    """

    def __init__(self, db: _DB, name: str) -> None:
        self._db = db
        self._name = name
        self._zeile: dict | None = None

    def insert(self, zeile: dict) -> _Tabelle:
        self._zeile = zeile
        return self

    def select(self, *_a: object, **_k: object) -> _Tabelle:
        return self

    def eq(self, *_a: object) -> _Tabelle:
        return self

    def limit(self, *_a: object) -> _Tabelle:
        return self

    def execute(self) -> SimpleNamespace:
        if self._name == "users":
            return SimpleNamespace(
                data=[
                    {
                        "email": "eigentuemer@example.com",
                        "phone": "+4915100000000",
                        "preferred_language": "de",
                    }
                ]
            )
        if self._name == "notifications" and self._zeile is not None:
            schluessel = self._zeile.get("dedup_key")
            # Der echte Index ist PARTIELL: `where dedup_key is not null and
            # gelesen_am is null` (0287). Ohne Schluessel gibt es keine
            # Entdopplung — jede Meldung ist dann eine neue Zeile.
            if schluessel is not None:
                if schluessel in self._db.offen:
                    msg = "duplicate key value violates unique constraint (23505)"
                    raise RuntimeError(msg)
                self._db.offen.add(schluessel)
            return SimpleNamespace(data=[self._zeile])
        return SimpleNamespace(data=[])


class _DB:
    def __init__(self) -> None:
        self.offen: set[str | None] = set()

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)


class _Settings:
    """Alle Kanaele erlaubt — der Nutzer will die Meldung ausdruecklich."""

    def soll_senden(self, *_a: object) -> bool:
        return True


class _Mail:
    def __init__(self) -> None:
        self.gesendet: list[object] = []

    def send(self, nachricht: object) -> None:
        self.gesendet.append(nachricht)


def _dispatcher(db: _DB, mail: _Mail) -> NotificationDispatcher:
    return NotificationDispatcher(
        db, settings_service=_Settings(), mail=mail  # type: ignore[arg-type]
    )


def _sende(dispatcher: NotificationDispatcher) -> object:
    return dispatcher.sende(
        user_id="owner-1",
        schluessel="owner_booking",
        betreff="Buchung geändert: Villa",
        text="Erika · Airbnb",
        tenant_id="t-1",
        property_id="p-1",
        ziel_pfad="/portal/buchungen/r-1",
        # Derselbe Schluessel wie beim ersten Mal: das EREIGNIS ist dasselbe.
        dedup_key="buchung:moved:r-1",
    )


def test_zweite_meldung_schickt_keine_zweite_mail(monkeypatch) -> None:
    """Der Kern: beim zweiten identischen Ereignis geht KEINE Mail raus."""
    gesendete_sms: list[str] = []
    monkeypatch.setattr(
        "src.features.notification_settings.dispatcher.send_sms",
        lambda ziel, text: gesendete_sms.append(f"{ziel}:{text}"),
    )
    db = _DB()
    mail = _Mail()
    dispatcher = _dispatcher(db, mail)

    erste = _sende(dispatcher)
    assert "inapp" in erste.gesendet
    assert "email" in erste.gesendet
    assert len(mail.gesendet) == 1
    assert len(gesendete_sms) == 1

    zweite = _sende(dispatcher)
    # Nichts wurde zugestellt — und es wird auch nichts still als „gesendet"
    # gebucht (Wurzel 5): der Grund steht im Ergebnis.
    assert zweite.gesendet == []
    assert any("bereits" in e for e in zweite.uebersprungen)
    assert len(mail.gesendet) == 1  # UNVERAENDERT
    assert len(gesendete_sms) == 1  # UNVERAENDERT


def test_fuenf_umbuchungen_ergeben_eine_mail(monkeypatch) -> None:
    """Der Fall aus dem Befund: fuenf `moved`-Events derselben Buchung.

    Vorher: 5 Mails + 5 SMS an einen Eigentuemer, der den Mail-Kanal wegen
    `email_pflicht=True` nicht einmal abschalten kann.
    """
    sms: list[str] = []
    monkeypatch.setattr(
        "src.features.notification_settings.dispatcher.send_sms",
        lambda ziel, text: sms.append(ziel),
    )
    db = _DB()
    mail = _Mail()
    dispatcher = _dispatcher(db, mail)
    for _ in range(5):
        _sende(dispatcher)
    assert len(mail.gesendet) == 1
    assert len(sms) == 1


def test_anderes_ereignis_meldet_weiterhin(monkeypatch) -> None:
    """Die Gegenprobe: ein ANDERER `dedup_key` ist ein anderes Ereignis und
    muss durchkommen. Der Riegel darf nicht zum Maulkorb werden."""
    sms: list[str] = []
    monkeypatch.setattr(
        "src.features.notification_settings.dispatcher.send_sms",
        lambda ziel, text: sms.append(ziel),
    )
    db = _DB()
    mail = _Mail()
    dispatcher = _dispatcher(db, mail)
    _sende(dispatcher)
    dispatcher.sende(
        user_id="owner-1",
        schluessel="owner_booking",
        betreff="Buchung storniert: Villa",
        text="Erika · Airbnb",
        tenant_id="t-1",
        property_id="p-1",
        dedup_key="buchung:cancelled:r-1",  # ANDERES Ereignis
    )
    assert len(mail.gesendet) == 2
    assert len(sms) == 2


def test_ohne_dedup_key_bleibt_alles_wie_bisher(monkeypatch) -> None:
    """Aufrufer ohne `dedup_key` (keine Entdopplung gewuenscht) melden
    weiterhin bei jedem Aufruf — der Fix aendert an ihnen nichts."""
    sms: list[str] = []
    monkeypatch.setattr(
        "src.features.notification_settings.dispatcher.send_sms",
        lambda ziel, text: sms.append(ziel),
    )
    db = _DB()
    mail = _Mail()
    dispatcher = _dispatcher(db, mail)
    for _ in range(3):
        dispatcher.sende(
            user_id="owner-1",
            schluessel="owner_booking",
            betreff="Neue Buchung: Villa",
            text="",
            tenant_id="t-1",
        )
    assert len(mail.gesendet) == 3
    assert len(sms) == 3
