"""Identitaets-Ereignisse kommen wiederholt und in beliebiger Reihenfolge.

LIVE AM 17.09.2026. Die Kontoseite zeigte „Wird geprueft …", obwohl bei Stripe
BEIDE Pruefsitzungen des Gastgebers auf `verified` standen. In der Datenbank
stand `processing`, mit der Kennung der AELTEREN Sitzung und einem
Verarbeitungszeitpunkt eine Stunde nach der erfolgreichen Pruefung.

Solange die Webhook-Geheimnisse fehlten, quittierte die Route jedes Ereignis mit
400. Stripe sammelte sie und stellte den Rueckstand nach der Reparatur erneut zu
— in beliebiger Reihenfolge. So traf `processing` der Sitzung von 12:33 ein,
NACHDEM `verified` der Sitzung von 12:47 verarbeitet war, und ueberschrieb sie.
Der Handler schrieb bedingungslos.

Das ist kein Sonderfall der Stoerung (Wurzel 2): Stripe garantiert die
Reihenfolge generell nicht. Massgeblich ist der Zeitpunkt des EREIGNISSES, nicht
unsere Uhr (Wurzel 5b) — unsere war hier ja gerade die verspaetete.
"""

from datetime import UTC, datetime

from src.features.payments.webhook import handle_stripe_event

USER = "6e994467-af91-4ccd-a0eb-41fbd4a13dbc"
TENANT = "0fe625f7-0867-4995-919a-d75333220447"

# Die echten Zeitpunkte des Vorfalls.
ALT = 1789562040        # processing, Sitzung vs_1UGI2B (12:33)
NEU = 1789562879        # verified,   Sitzung vs_1UGIFg (12:47)


class _Ergebnis:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Tabelle:
    def __init__(self, db: "_DB", name: str) -> None:
        self._db = db
        self._name = name
        self._update: dict | None = None

    def select(self, *_s: str) -> "_Tabelle":
        return self

    def insert(self, werte: dict) -> "_Tabelle":
        self._db.inserts.append((self._name, werte))
        return self

    def upsert(self, werte: dict, **_kw: object) -> "_Tabelle":
        # Der Event-Claim: jede Kennung nur einmal (Wurzel 2).
        neu = werte["id"] not in self._db.geclaimt
        self._db.geclaimt.add(werte["id"])
        self._db.claim_ergebnis = [werte] if neu else []
        return self

    def update(self, werte: dict) -> "_Tabelle":
        self._update = werte
        return self

    def eq(self, *_a: object) -> "_Tabelle":
        return self

    def limit(self, *_a: object) -> "_Tabelle":
        return self

    def execute(self) -> _Ergebnis:
        if self._name == "stripe_webhook_event":
            return _Ergebnis(self._db.claim_ergebnis)
        if self._update is not None:
            self._db.zeilen.setdefault(self._name, {}).update(self._update)
            self._db.updates.append((self._name, dict(self._update)))
            return _Ergebnis([{"id": USER}])
        return _Ergebnis([self._db.zeilen.get(self._name, {})])


class _DB:
    def __init__(self) -> None:
        self.zeilen: dict[str, dict] = {"users": {}}
        self.updates: list[tuple[str, dict]] = []
        self.inserts: list[tuple[str, dict]] = []
        self.geclaimt: set[str] = set()
        self.claim_ergebnis: list[dict] = []

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)


def _ereignis(typ: str, session: str, created: int) -> dict:
    return {
        "id": f"evt_{session}_{typ}",
        "type": f"identity.verification_session.{typ}",
        "created": created,
        "data": {
            "object": {
                "id": session,
                "object": "identity.verification_session",
                "status": typ,
                "metadata": {"user_id": USER, "tenant_id": TENANT},
            }
        },
    }


def _senden(db: _DB, ereignis: dict) -> None:
    handle_stripe_event(db, ereignis, now_iso=datetime.now(UTC).isoformat())  # type: ignore[arg-type]


def test_nachzuegler_ueberschreibt_das_ergebnis_nicht() -> None:
    """DER Fall. Zuerst das neue `verified`, danach das alte `processing`."""
    db = _DB()
    _senden(db, _ereignis("verified", "vs_neu", NEU))
    assert db.zeilen["users"]["identity_status"] == "verified"

    _senden(db, _ereignis("processing", "vs_alt", ALT))
    assert db.zeilen["users"]["identity_status"] == "verified"
    assert db.zeilen["users"]["identity_session_id"] == "vs_neu"


def test_richtige_reihenfolge_kommt_weiterhin_durch() -> None:
    """Die Gegenprobe: der Guard darf echte Fortschritte nicht blockieren."""
    db = _DB()
    _senden(db, _ereignis("processing", "vs_a", ALT))
    assert db.zeilen["users"]["identity_status"] == "processing"

    _senden(db, _ereignis("verified", "vs_a", ALT + 1))
    assert db.zeilen["users"]["identity_status"] == "verified"


def test_erneute_pruefung_nach_einer_verifizierung_gilt() -> None:
    """Ein SPAETERES `requires_input` ist kein Nachzuegler, sondern eine neue
    Tatsache — etwa wenn Stripe eine gepruefte Identitaet nachtraeglich
    beanstandet. Es muss durchkommen."""
    db = _DB()
    _senden(db, _ereignis("verified", "vs_a", NEU))
    _senden(db, _ereignis("requires_input", "vs_b", NEU + 500))
    assert db.zeilen["users"]["identity_status"] == "requires_input"


def test_zeitpunkt_ist_der_des_ereignisses_nicht_unsere_uhr() -> None:
    """Wurzel 5b. Bei einer Wiederholung liegt unsere Uhr beliebig weit hinter
    dem echten Zeitpunkt — am 17.09.2026 eine Stunde."""
    db = _DB()
    _senden(db, _ereignis("verified", "vs_a", NEU))
    erwartet = datetime.fromtimestamp(NEU, UTC).isoformat()
    assert db.zeilen["users"]["identity_verified_at"] == erwartet
    assert db.zeilen["users"]["identity_event_at"] == erwartet
