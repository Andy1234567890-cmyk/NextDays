"""Tests für den zentralen, kanalübergreifenden Gast-Resolver (Prompt A).

Matching-Matrix: E-Mail / Telefon / Kanal-ID / Neuanlage, kein False-Merge nur
per Name, Mehrdeutigkeit → needs_review, Tenant-Isolation, Normalisierung.
"""
from src.features.guests.identity import (
    GuestContact,
    contact_from_ota_customer,
    normalize_email,
    normalize_phone,
    resolve_or_create_guest,
)


# --- In-Memory-DB ------------------------------------------------------------
class _Res:
    def __init__(self, data):  # noqa: ANN001
        self.data = data


class _Q:
    def __init__(self, store, name):  # noqa: ANN001
        self._store = store.setdefault(name, [])
        self._name = name
        self._db = store
        self._eq = {}
        self._ilike = {}
        self._op = "select"
        self._payload = None

    def select(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        self._op = "select"
        return self

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN002, ANN003, ANN201
        self._op = "upsert"
        self._payload = payload
        return self

    def eq(self, c, v):  # noqa: ANN001, ANN201
        self._eq[c] = v
        return self

    def ilike(self, c, v):  # noqa: ANN001, ANN201
        # Case-insensitiver Literal-Vergleich (Produktivcode escapt die Wildcards
        # via _like_escape, im Test kommen keine vor → als casefold-Gleichheit).
        self._ilike[c] = v.replace("\\", "")
        return self

    def limit(self, *_a, **_k):  # noqa: ANN002, ANN003, ANN201
        return self

    def execute(self):  # noqa: ANN201
        if self._op == "insert":
            row = dict(self._payload)
            row.setdefault("id", f"{self._name}-{len(self._store) + 1}")
            self._store.append(row)
            return _Res([row])
        match = [
            r
            for r in self._store
            if all(r.get(k) == v for k, v in self._eq.items())
            and all(
                str(r.get(k) or "").casefold() == str(v).casefold()
                for k, v in self._ilike.items()
            )
        ]
        if self._op == "update":
            for r in match:
                r.update(self._payload)
            return _Res(match)
        if self._op == "upsert":
            payload = dict(self._payload)
            keys = ("tenant_id", "channel", "external_id")
            existing = [
                r for r in self._store
                if all(r.get(k) == payload.get(k) for k in keys)
            ]
            if existing:
                existing[0].update(payload)
                return _Res([existing[0]])
            payload.setdefault("id", f"{self._name}-{len(self._store) + 1}")
            self._store.append(payload)
            return _Res([payload])
        return _Res(match)


class _DB:
    def __init__(self):
        self.store = {"guests": [], "guest_external_ids": []}

    def table(self, name):  # noqa: ANN001, ANN201
        return _Q(self.store, name)


def _seed_guest(db, tenant_id="t1", **fields):  # noqa: ANN001, ANN201
    row = {"tenant_id": tenant_id, "name": "Seed", "needs_review": False, **fields}
    row.setdefault("id", f"guests-{len(db.store['guests']) + 1}")
    db.store["guests"].append(row)
    return row["id"]


# --- Normalisierung ----------------------------------------------------------
def test_normalize_email():
    assert normalize_email("  Max@Example.COM ") == "max@example.com"
    assert normalize_email("") is None
    assert normalize_email(None) is None


def test_normalize_phone_e164():
    assert normalize_phone("+49 170 1234567") == "+491701234567"
    assert normalize_phone("0049 170 1234567") == "+491701234567"
    assert normalize_phone("01701234567") == "01701234567"  # ohne Vorwahl-Indikator
    assert normalize_phone("123") is None  # zu kurz
    assert normalize_phone(None) is None


# --- Matching-Matrix ---------------------------------------------------------
def test_match_by_email():
    db = _DB()
    gid = _seed_guest(db, email="m@x.de", phone="+491700000000")
    out = resolve_or_create_guest(
        db, "t1", GuestContact(first_name="Max", email="M@X.de")
    )
    assert out == gid
    assert len(db.store["guests"]) == 1  # kein Duplikat


def test_match_by_phone():
    db = _DB()
    gid = _seed_guest(db, email="alt@x.de", phone="+491701234567")
    out = resolve_or_create_guest(
        db, "t1", GuestContact(name="Max", phone="0049 170 1234567")
    )
    assert out == gid


def test_match_by_external_id():
    db = _DB()
    gid = _seed_guest(db)
    db.store["guest_external_ids"].append(
        {"tenant_id": "t1", "guest_id": gid, "channel": "whatsapp", "external_id": "49170999"}
    )
    out = resolve_or_create_guest(
        db, "t1",
        GuestContact(name="Anna", channel="whatsapp", external_ref="49170999"),
    )
    assert out == gid


def test_create_when_no_match():
    db = _DB()
    out = resolve_or_create_guest(
        db, "t1", GuestContact(first_name="Neu", last_name="Gast", email="neu@x.de")
    )
    assert out is not None
    assert len(db.store["guests"]) == 1
    assert db.store["guests"][0]["email"] == "neu@x.de"
    assert db.store["guests"][0]["needs_review"] is False


def test_no_merge_on_name_only():
    # Gleicher Name, KEINE gemeinsame E-Mail/Telefon → NICHT mergen, neu anlegen.
    db = _DB()
    _seed_guest(db, name="Max Mustermann", email="a@x.de")
    out = resolve_or_create_guest(
        db, "t1", GuestContact(name="Max Mustermann", email="b@x.de")
    )
    assert len(db.store["guests"]) == 2
    assert out == db.store["guests"][1]["id"]


def test_ambiguous_creates_needs_review():
    # E-Mail zeigt auf Gast A, Telefon auf Gast B → neuer Gast + needs_review.
    db = _DB()
    _seed_guest(db, email="a@x.de", phone="+490000000001")  # Gast A
    _seed_guest(db, email="b@x.de", phone="+490000000002")  # Gast B
    out = resolve_or_create_guest(
        db, "t1",
        GuestContact(name="Konflikt", email="a@x.de", phone="+490000000002"),
    )
    assert len(db.store["guests"]) == 3
    new_row = next(r for r in db.store["guests"] if r["id"] == out)
    assert new_row["needs_review"] is True


def test_backfill_missing_phone_on_email_match():
    db = _DB()
    gid = _seed_guest(db, email="m@x.de", phone=None)
    resolve_or_create_guest(
        db, "t1", GuestContact(email="m@x.de", phone="+491701234567")
    )
    row = next(r for r in db.store["guests"] if r["id"] == gid)
    assert row["phone"] == "+491701234567"  # ergänzt, nicht überschrieben


def test_links_external_id_on_create():
    db = _DB()
    out = resolve_or_create_guest(
        db, "t1",
        GuestContact(name="Anna", phone="+491701234567",
                     channel="whatsapp", external_ref="491701234567"),
    )
    links = db.store["guest_external_ids"]
    assert len(links) == 1
    assert links[0]["guest_id"] == out
    assert links[0]["channel"] == "whatsapp"


def test_tenant_isolation():
    # Gast in t1 darf nie für t2 gematcht werden.
    db = _DB()
    _seed_guest(db, tenant_id="t1", email="m@x.de")
    out = resolve_or_create_guest(db, "t2", GuestContact(email="m@x.de"))
    assert len(db.store["guests"]) == 2
    new_row = next(r for r in db.store["guests"] if r["id"] == out)
    assert new_row["tenant_id"] == "t2"


def test_returns_none_without_any_identifier():
    db = _DB()
    out = resolve_or_create_guest(db, "t1", GuestContact())
    assert out is None
    assert len(db.store["guests"]) == 0


def test_create_guest_race_returns_existing_on_unique_violation():
    """Verliert der Insert das Race (Unique-Index 0113), wird der vom Gewinner
    angelegte Gast geladen statt ein Duplikat zu erzeugen (Resolver idempotent)."""
    from postgrest.exceptions import APIError

    class _RacingQ(_Q):
        def execute(self):  # noqa: ANN201
            if self._op == "insert" and self._name == "guests":
                # Gewinner hat den Gast in der Lücke bereits angelegt.
                self._store.append({
                    "id": "guests-winner", "tenant_id": "t1",
                    "email": "race@x.de", "phone": None, "needs_review": False,
                })
                raise APIError({
                    "message": 'duplicate key value violates unique constraint '
                               '"guests_tenant_email_uq"',
                    "code": "23505", "hint": None, "details": None,
                })
            return super().execute()

    class _RacingDB(_DB):
        def table(self, name):  # noqa: ANN001, ANN201
            return _RacingQ(self.store, name)

    db = _RacingDB()
    out = resolve_or_create_guest(
        db, "t1", GuestContact(first_name="Race", email="race@x.de")
    )
    assert out == "guests-winner"
    # Kein zweiter Gast entstanden (nur der Gewinner liegt im Store).
    assert len(db.store["guests"]) == 1


def test_create_guest_reraises_unrelated_api_error():
    """Eine NICHT gast-bezogene APIError wird nicht verschluckt (weitergereicht)."""
    import pytest
    from postgrest.exceptions import APIError

    class _FailingQ(_Q):
        def execute(self):  # noqa: ANN201
            if self._op == "insert" and self._name == "guests":
                raise APIError({
                    "message": "permission denied for table guests",
                    "code": "42501", "hint": None, "details": None,
                })
            return super().execute()

    class _FailingDB(_DB):
        def table(self, name):  # noqa: ANN001, ANN201
            return _FailingQ(self.store, name)

    db = _FailingDB()
    with pytest.raises(APIError):
        resolve_or_create_guest(
            db, "t1", GuestContact(first_name="X", email="x@x.de")
        )


def test_contact_from_ota_customer():
    c = contact_from_ota_customer(
        {"name": "Max", "surname": "Mustermann", "mail": "m@x.de", "phone": "+49170",
         "id": "guest-42"},
        external_ref="R123",
    )
    assert c.first_name == "Max"
    assert c.last_name == "Mustermann"
    assert c.email == "m@x.de"
    assert c.channel == "ota"
    # external_ref = Reservierungscode (pro Buchung), stable_external_ref =
    # OTA-Guest-ID (pro Gast).
    assert c.external_ref == "R123"
    assert c.stable_external_ref == "guest-42"


def test_ota_stable_id_reuses_guest_across_bookings():
    # Zwei Buchungen desselben Gastes OHNE E-Mail/Telefon, aber mit derselben
    # OTA-Guest-ID (customer.id) → EIN Gast, nicht zwei (Härtung).
    db = _DB()
    c1 = contact_from_ota_customer(
        {"name": "Ada", "id": "guest-7"}, external_ref="RES-1"
    )
    c2 = contact_from_ota_customer(
        {"name": "Ada", "id": "guest-7"}, external_ref="RES-2"
    )
    g1 = resolve_or_create_guest(db, "t1", c1)
    g2 = resolve_or_create_guest(db, "t1", c2)
    assert g1 is not None and g1 == g2
    assert len(db.store["guests"]) == 1


def test_create_placeholder_guest_never_none():
    from src.features.guests.identity import create_placeholder_guest

    db = _DB()
    gid = create_placeholder_guest(db, "t1", channel="ota", external_ref="RES-X")
    assert gid is not None
    assert db.store["guests"][0]["name"] == "—"
    assert db.store["guests"][0]["needs_review"] is True
    # Redelivery mit demselben Reservierungscode → derselbe Platzhalter.
    gid2 = create_placeholder_guest(db, "t1", channel="ota", external_ref="RES-X")
    assert gid2 == gid
    assert len(db.store["guests"]) == 1
