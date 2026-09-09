"""Tests des verschlüsselten Eigentümer-Chats (0611, ADR-0029).

Geprüft wird, was NICHT auffiele, wenn es kaputt wäre — die Zusagen, die man
einer Chat-Oberfläche nicht ansieht:

  1. Der Server bestimmt den Empfängerkreis. Ein Client, der ein fremdes Gerät
     mitschickt, darf es nicht in den Verteiler bekommen (Wurzel 3).
  2. Fehlt der Schlüssel für EINEN Empfänger, wird abgewiesen statt abgelegt —
     sonst wäre die Nachricht für ihn stumm unlesbar (Wurzel 5).
  3. Ein gesperrtes Gerät bekommt keine neuen Schlüssel, die ALTEN bleiben
     aber stehen (Wurzel 1).
  4. Zwei gleichzeitige Erstnachrichten ergeben EINEN Faden (Wurzel 2).
  5. Freigeben dürfen nur admin/co_admin (Festlegung vom 09.09.2026).
  6. Die Registrierung verlangt einen echten Besitznachweis, und dieselbe
     Signatur registriert kein zweites Gerät (Wurzel 2).
"""

import base64
import pathlib
from datetime import UTC, datetime

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from src.features.owner_chat import freigabe, geraete, kern, moderation
from src.features.owner_chat.fehler import OwnerChatError


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    """Fake-PostgREST mit den Operationen dieses Slice."""

    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: object = None
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._is: tuple[str, str] | None = None
        self._on_conflict: str | None = None

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload: object) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> "_Query":
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload: object, on_conflict: str | None = None) -> "_Query":
        self._op = "upsert"
        self._payload = payload
        self._on_conflict = on_conflict
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, vals)
        return self

    def is_(self, col: str, val: str) -> "_Query":
        self._is = (col, val)
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def _match(self, row: dict) -> bool:
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._is:
            col, _ = self._is
            ok = row.get(col) is None
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op in ("insert", "upsert"):
            payloads = (
                self._payload
                if isinstance(self._payload, list)
                else [self._payload]
            )
            neu = []
            for roh in payloads:
                zeile = dict(roh or {})
                if self._op == "upsert" and self._on_conflict:
                    schluessel = self._on_conflict.split(",")
                    treffer = [
                        r for r in rows
                        if all(str(r.get(k)) == str(zeile.get(k)) for k in schluessel)
                    ]
                    if treffer:
                        for k, v in zeile.items():
                            treffer[0][k] = _jetzt() if v == "now()" else v
                        neu.append(treffer[0])
                        continue
                if self._db.kollision and self._table == "owner_threads":
                    # Ein Konkurrent war schneller: der UNIQUE-Index schlägt zu.
                    self._db.kollision = False
                    rows.append(
                        {
                            "id": "faden-konkurrent",
                            "tenant_id": zeile.get("tenant_id"),
                            "property_id": zeile.get("property_id"),
                        }
                    )
                    raise RuntimeError('duplicate key value violates "23505"')
                zeile.setdefault("id", f"{self._table}-{self._db.next_id()}")
                zeile.setdefault("sent_at", _jetzt())
                # PostgREST löst `now()` in der DB auf; die Fake-DB legte den
                # String ab, worauf jeder Zeitvergleich fehlschlug.
                for k, v in list(zeile.items()):
                    if v == "now()":
                        zeile[k] = _jetzt()
                rows.append(zeile)
                neu.append(zeile)
            return _Result(neu)
        treffer = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in treffer:
                r.update(self._payload or {})
            return _Result(treffer)
        if self._op == "delete":
            for r in treffer:
                rows.remove(r)
            return _Result(treffer)
        return _Result(treffer)


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.kollision = False
        self._n = 0

    def next_id(self) -> int:
        self._n += 1
        return self._n

    def table(self, name: str) -> _Query:
        return _Query(self, name)


T = "tenant-1"
P = "prop-1"


def _jetzt() -> str:
    """Was die DB für `now()` einsetzen würde — bei JEDEM Schreibvorgang neu.

    Als Konstante zur Importzeit gebildet war das ein Zeitzünder: die
    Registrierungs-Aufgabe gilt 300 s, der volle Testlauf dauert über 600 s.
    Kam `owner_chat` später als fünf Minuten nach dem Import an die Reihe,
    galt jede Aufgabe als abgelaufen und drei Tests wurden rot — im CI
    reproduzierbar, lokal nie, weil der Slice allein in Sekunden durchläuft
    (CLAUDE.md: Tests nie umgebungsabhängig; hier: nie zeitabhängig).
    """
    return datetime.now(UTC).isoformat()


def _basis() -> dict[str, list[dict]]:
    """Ein Objekt, ein Eigentümer, eine Mitarbeiterin — je ein Gerät."""
    return {
        "users": [
            {
                "id": "user-agentur",
                "tenant_id": T,
                "role": "admin",
                "permissions": None,
            },
            {
                "id": "user-owner",
                "tenant_id": T,
                "role": "owner",
                "permissions": None,
            },
        ],
        "owners": [{"id": "owner-1", "tenant_id": T, "user_id": "user-owner"}],
        # Der Empfängerkreis liest DIESE Tabelle — dieselbe, gegen die auch
        # der Zugriff geprüft wird (09.09.2026, siehe `eigentuemer_nutzer`).
        "owner_property_assignments": [
            {"tenant_id": T, "user_id": "user-owner", "property_id": P}
        ],
        "owner_properties": [{"owner_id": "owner-1", "property_id": P}],
        "owner_family_members": [],
        "owner_chat_devices": [
            {
                "id": "dev-agentur",
                "tenant_id": T,
                "user_id": "user-agentur",
                "seite": "agency",
                "public_key": "AA==",
                "gesperrt_am": None,
            },
            {
                "id": "dev-owner",
                "tenant_id": T,
                "user_id": "user-owner",
                "seite": "owner",
                "public_key": "BB==",
                "gesperrt_am": None,
            },
        ],
        "owner_threads": [{"id": "faden-1", "tenant_id": T, "property_id": P}],
        "owner_messages": [],
        "owner_message_keys": [],
        "owner_chat_freigaben": [],
        "owner_chat_aufgaben": [],
    }


def _senden(db: _DB, schluessel: dict[str, str]) -> dict:
    geraete_liste = kern.empfaenger_geraete(db, T, P)
    return kern.nachricht_ablegen(
        db,
        T,
        "faden-1",
        seite="owner",
        user_id="user-owner",
        sender_name="Rene",
        chiffre="Y2hpZmZyZQ==",
        schluessel=schluessel,
        geraete=geraete_liste,
        bilder=[],
        sender_key="BB==",
    )


# --- Empfängerkreis ----------------------------------------------------------


def test_empfaengerkreis_umfasst_beide_seiten() -> None:
    db = _DB(_basis())
    ids = {str(g["id"]) for g in kern.empfaenger_geraete(db, T, P)}
    assert ids == {"dev-agentur", "dev-owner"}


def test_eigentuemer_zaehlt_nicht_als_agentur_empfaenger() -> None:
    """Rolle `owner` steht im selben Mandanten — sie darf nicht doppelt zählen.

    Ohne den Ausschluss in `agentur_nutzer` erschiene der Eigentümer auf
    BEIDEN Seiten; die Agenturliste wäre dann keine Aussage mehr darüber, wer
    im Betrieb mitliest.
    """
    db = _DB(_basis())
    assert kern.agentur_nutzer(db, T) == ["user-agentur"]


def test_gesperrtes_geraet_bekommt_keine_neuen_schluessel() -> None:
    daten = _basis()
    daten["owner_chat_devices"][0]["gesperrt_am"] = "2026-09-01T00:00:00Z"
    db = _DB(daten)
    ids = {str(g["id"]) for g in kern.empfaenger_geraete(db, T, P)}
    assert ids == {"dev-owner"}


def test_familienmitglied_ist_empfaenger() -> None:
    """Wer Portalzugang hat, muss mitlesen können (Festlegung 09.09.2026).

    Der Zugang steht in `owner_property_assignments` — Familienmitglieder
    haben KEINEN Eintrag in `owner_properties`, und genau deshalb liest der
    Empfängerkreis die Zuweisungstabelle.
    """
    daten = _basis()
    daten["owner_property_assignments"].append(
        {"tenant_id": T, "user_id": "user-tochter", "property_id": P}
    )
    daten["owner_chat_devices"].append(
        {
            "id": "dev-tochter",
            "tenant_id": T,
            "user_id": "user-tochter",
            "seite": "owner",
            "public_key": "CC==",
            "gesperrt_am": None,
        }
    )
    db = _DB(daten)
    ids = {str(g["id"]) for g in kern.empfaenger_geraete(db, T, P)}
    assert "dev-tochter" in ids


# --- Vollständigkeit der Schlüssel -------------------------------------------


def test_fehlender_schluessel_wird_abgewiesen() -> None:
    """Wurzel 5: lieber 409 als eine Nachricht, die ein Empfänger nie öffnet."""
    db = _DB(_basis())
    with pytest.raises(OwnerChatError) as exc:
        _senden(db, {"dev-owner": "k1"})  # dev-agentur fehlt
    assert exc.value.status_code == 409
    assert db.tables["owner_messages"] == []


def test_fremdes_geraet_wird_nicht_in_den_verteiler_geschrieben() -> None:
    """Wurzel 3: der Server bestimmt den Kreis, nicht der Client.

    Der Client schickt einen Schlüssel für ein Gerät mit, das NICHT zum
    Gespräch gehört. Käme er durch, läse dieses Gerät ab sofort mit.
    """
    db = _DB(_basis())
    _senden(db, {"dev-owner": "k1", "dev-agentur": "k2", "dev-fremd": "k3"})
    abgelegt = {z["device_id"] for z in db.tables["owner_message_keys"]}
    assert abgelegt == {"dev-owner", "dev-agentur"}
    assert "dev-fremd" not in abgelegt


def test_leere_nachricht_wird_abgewiesen() -> None:
    db = _DB(_basis())
    with pytest.raises(OwnerChatError) as exc:
        kern.nachricht_ablegen(
            db,
            T,
            "faden-1",
            seite="owner",
            user_id="user-owner",
            sender_name="Rene",
            chiffre="",
            schluessel={},
            geraete=[],
            bilder=[],
            sender_key="BB==",
        )
    assert exc.value.status_code == 422


def test_zu_langer_chiffretext_wird_abgewiesen() -> None:
    """Wurzel 8: harte Obergrenze, auch wenn wir den Inhalt nicht lesen."""
    db = _DB(_basis())
    with pytest.raises(OwnerChatError) as exc:
        kern.nachricht_ablegen(
            db,
            T,
            "faden-1",
            seite="owner",
            user_id="user-owner",
            sender_name="Rene",
            chiffre="x" * (kern.MAX_CHIFFRE_BYTES + 1),
            schluessel={},
            geraete=[],
            bilder=[],
            sender_key="BB==",
        )
    assert exc.value.status_code == 422


def test_gesendete_nachricht_zieht_den_thread_kopf_nach() -> None:
    """Wurzel 1: ohne `last_message_at` stünde das Gespräch weiter unten."""
    db = _DB(_basis())
    _senden(db, {"dev-owner": "k1", "dev-agentur": "k2"})
    assert db.tables["owner_threads"][0]["last_message_at"]


# --- Faden-Anlage ------------------------------------------------------------


def test_thread_wird_wiederverwendet() -> None:
    db = _DB(_basis())
    assert kern.thread_holen_oder_anlegen(db, T, P) == "faden-1"
    assert len(db.tables["owner_threads"]) == 1


def test_paralleler_erstzugriff_ergibt_einen_faden() -> None:
    """Wurzel 2: der UNIQUE-Index fängt den zweiten Anlauf ab."""
    daten = _basis()
    daten["owner_threads"] = []
    db = _DB(daten)
    db.kollision = True
    assert kern.thread_holen_oder_anlegen(db, T, "prop-neu") == "faden-konkurrent"
    assert len(db.tables["owner_threads"]) == 1


# --- Verlauf -----------------------------------------------------------------


def test_nachricht_ohne_schluessel_wird_gezaehlt_nicht_verschwiegen() -> None:
    """Wurzel 5: eine Lücke, die niemand sieht, ist der schlimmere Fehler."""
    daten = _basis()
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "c1"},
        {"id": "m2", "tenant_id": T, "thread_id": "faden-1", "body": "c2"},
    ]
    daten["owner_message_keys"] = [
        {"message_id": "m1", "device_id": "dev-neu", "wrapped_key": "k1"}
    ]
    db = _DB(daten)
    zeilen, nicht_lesbar = kern.verlauf_lesen(
        db, T, "faden-1", device_id="dev-neu"
    )
    assert len(zeilen) == 2
    assert nicht_lesbar == 1
    assert zeilen[0]["wrapped_key"] == "k1"
    assert zeilen[1]["wrapped_key"] is None


# --- Freigabe ----------------------------------------------------------------


def test_nur_leitung_darf_verlauf_freigeben() -> None:
    """Festlegung vom 09.09.2026 — Einblick ist eine Rechteentscheidung."""
    daten = _basis()
    daten["users"].append(
        {
            "id": "user-staff",
            "tenant_id": T,
            "role": "staff",
            "permissions": None,
        }
    )
    db = _DB(daten)
    with pytest.raises(OwnerChatError) as exc:
        freigabe.schluessel_nachtragen(
            db,
            T,
            "user-staff",
            "faden-1",
            "dev-agentur",
            schluessel={"m1": "k"},
            wrapper_key="FF==",
        )
    assert exc.value.status_code == 403


def test_freigabe_nur_fuer_nachrichten_dieses_fadens() -> None:
    """Wurzel 9: sonst öffnete eine Freigabe ein ANDERES Gespräch mit."""
    daten = _basis()
    daten["owner_threads"].append(
        {"id": "faden-2", "tenant_id": T, "property_id": "prop-2"}
    )
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "c1"},
        {"id": "m2", "tenant_id": T, "thread_id": "faden-2", "body": "c2"},
    ]
    db = _DB(daten)
    anzahl = freigabe.schluessel_nachtragen(
        db,
        T,
        "user-agentur",
        "faden-1",
        "dev-agentur",
        schluessel={"m1": "k1", "m2": "k2"},
        wrapper_key="FF==",
        )
    assert anzahl == 1
    abgelegt = {z["message_id"] for z in db.tables["owner_message_keys"]}
    assert abgelegt == {"m1"}


def test_freigabe_fremder_mandant_wird_abgewiesen() -> None:
    """Wurzel 3: im fremden Mandanten greift schon die Rollenprüfung.

    Erwartet wird 403, nicht 404: Der Nutzer existiert dort nicht, also
    scheitert `_rolle_pruefen` VOR der Faden-Suche. Beides ist dicht — 403
    verrät hier nichts über die Existenz des Fadens, weil es die Aussage
    „dieser Nutzer darf im fremden Mandanten gar nichts" ist.
    """
    db = _DB(_basis())
    with pytest.raises(OwnerChatError) as exc:
        freigabe.schluessel_nachtragen(
            db,
            "tenant-fremd",
            "user-agentur",
            "faden-1",
            "dev-agentur",
            schluessel={"m1": "k"},
            wrapper_key="FF==",
        )
    assert exc.value.status_code == 403
    assert db.tables["owner_message_keys"] == []


# --- Geräte-Registrierung ----------------------------------------------------


def _signieren(aufgabe: str) -> tuple[str, str]:
    """(signing_key, signatur) für eine Aufgabe — beides base64."""
    privat = Ed25519PrivateKey.generate()
    oeffentlich = privat.public_key().public_bytes_raw()
    signatur = privat.sign(aufgabe.encode("utf-8"))
    return (
        base64.b64encode(oeffentlich).decode(),
        base64.b64encode(signatur).decode(),
    )


def test_registrierung_verlangt_gueltige_signatur() -> None:
    """Wurzel 3: ohne Besitznachweis trüge jeder ein Mitlese-Gerät ein."""
    db = _DB(_basis())
    aufgabe = geraete.aufgabe_erzeugen(db, T, "user-owner")
    signing_key, _echte = _signieren(aufgabe)
    falsche = base64.b64encode(b"x" * 64).decode()
    with pytest.raises(OwnerChatError) as exc:
        geraete.geraet_registrieren(
            db,
            T,
            "user-owner",
            seite="owner",
            public_key=base64.b64encode(b"k" * 32).decode(),
            signing_key=signing_key,
            signatur=falsche,
            geraet_name="iPhone",
        )
    assert exc.value.status_code == 403
    assert len(db.tables["owner_chat_devices"]) == 2  # nichts dazugekommen


def test_registrierung_mit_gueltiger_signatur_legt_geraet_an() -> None:
    db = _DB(_basis())
    aufgabe = geraete.aufgabe_erzeugen(db, T, "user-owner")
    signing_key, signatur = _signieren(aufgabe)
    zeile = geraete.geraet_registrieren(
        db,
        T,
        "user-owner",
        seite="owner",
        public_key=base64.b64encode(b"k" * 32).decode(),
        signing_key=signing_key,
        signatur=signatur,
        geraet_name="iPhone von Rene",
    )
    assert zeile["geraet_name"] == "iPhone von Rene"
    assert db.tables["owner_chat_aufgaben"] == []  # verbraucht


def test_dieselbe_signatur_registriert_kein_zweites_geraet() -> None:
    """Wurzel 2: eine abgefangene Signatur darf nicht wiederverwendbar sein."""
    db = _DB(_basis())
    aufgabe = geraete.aufgabe_erzeugen(db, T, "user-owner")
    signing_key, signatur = _signieren(aufgabe)
    args = {
        "seite": "owner",
        "public_key": base64.b64encode(b"k" * 32).decode(),
        "signing_key": signing_key,
        "signatur": signatur,
        "geraet_name": "iPhone",
    }
    geraete.geraet_registrieren(db, T, "user-owner", **args)
    with pytest.raises(OwnerChatError) as exc:
        geraete.geraet_registrieren(db, T, "user-owner", **args)
    assert exc.value.status_code == 409


def test_abgelaufene_aufgabe_wird_abgewiesen() -> None:
    """Fail-closed: eine Aufgabe ohne lesbaren Zeitstempel gilt als alt."""
    db = _DB(_basis())
    geraete.aufgabe_erzeugen(db, T, "user-owner")
    db.tables["owner_chat_aufgaben"][0]["erzeugt_am"] = "2020-01-01T00:00:00Z"
    signing_key, signatur = _signieren(
        db.tables["owner_chat_aufgaben"][0]["aufgabe"]
    )
    with pytest.raises(OwnerChatError) as exc:
        geraete.geraet_registrieren(
            db,
            T,
            "user-owner",
            seite="owner",
            public_key=base64.b64encode(b"k" * 32).decode(),
            signing_key=signing_key,
            signatur=signatur,
            geraet_name="iPhone",
        )
    assert exc.value.status_code == 409


def test_geraet_sperren_nur_das_eigene() -> None:
    """Wurzel 9: sonst sperrte ein Nutzer per ID das Gerät eines Kollegen."""
    db = _DB(_basis())
    with pytest.raises(OwnerChatError) as exc:
        geraete.geraet_sperren(db, T, "user-owner", "dev-agentur")
    assert exc.value.status_code == 404
    assert db.tables["owner_chat_devices"][0]["gesperrt_am"] is None


def test_gesperrtes_geraet_behaelt_seine_alten_schluessel() -> None:
    """Wurzel 1: Sperren nimmt die Zukunft, nicht die Vergangenheit."""
    daten = _basis()
    daten["owner_message_keys"] = [
        {"message_id": "m1", "device_id": "dev-owner", "wrapped_key": "k1"}
    ]
    db = _DB(daten)
    geraete.geraet_sperren(db, T, "user-owner", "dev-owner")
    assert db.tables["owner_message_keys"] == [
        {"message_id": "m1", "device_id": "dev-owner", "wrapped_key": "k1"}
    ]


def test_nachricht_ohne_absenderschluessel_wird_abgewiesen() -> None:
    """Wurzel 5: ohne ihn wäre die Nachricht für JEDEN unlesbar — stumm.

    Der Fehler hat kein Symptom: die Nachricht läge in der Datenbank, erschiene
    in der Liste und ließe sich von niemandem öffnen. Deshalb 422 beim
    Ablegen statt eines leeren Feldes (Wurzel 4).
    """
    db = _DB(_basis())
    with pytest.raises(OwnerChatError) as exc:
        kern.nachricht_ablegen(
            db,
            T,
            "faden-1",
            seite="owner",
            user_id="user-owner",
            sender_name="Rene",
            chiffre="Y2hpZmZyZQ==",
            schluessel={},
            geraete=[],
            bilder=[],
            sender_key="",
        )
    assert exc.value.status_code == 422
    assert db.tables["owner_messages"] == []


def test_absenderschluessel_wird_eingefroren() -> None:
    """Er steht AN der Nachricht, nicht am Gerät — Wurzel 1.

    Wird das sendende Gerät später entfernt, muss der Verlauf lesbar bleiben.
    Läge der Schlüssel nur in `owner_chat_devices`, nähme das Entfernen des
    Geräts jede seiner alten Nachrichten mit.
    """
    db = _DB(_basis())
    _senden(db, {"dev-owner": "k1", "dev-agentur": "k2"})
    assert db.tables["owner_messages"][0]["sender_key"] == "BB=="


# --- Benachrichtigung ---------------------------------------------------------


def test_meldung_geht_an_die_andere_seite_nicht_an_den_absender(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sonst meldet sich das eigene Telefon bei jeder eigenen Nachricht."""
    from src.features.owner_chat import melden

    gesendet: list[dict] = []

    class _Dispatcher:
        def __init__(self, _db: object) -> None:
            pass

        def sende(self, **kw: object) -> None:
            gesendet.append(kw)

    import src.features.notification_settings.dispatcher as disp_modul

    monkeypatch.setattr(
        disp_modul, "NotificationDispatcher", _Dispatcher, raising=True
    )
    db = _DB(_basis())
    melden.neue_nachricht_melden(
        db,
        T,
        property_id=P,
        thread_id="faden-1",
        message_id="m1",
        seite="owner",
        absender_name="Rene",
        absender_user_id="user-owner",
    )
    ziele = {str(k["user_id"]) for k in gesendet}
    assert ziele == {"user-agentur"}
    assert "user-owner" not in ziele


def test_meldung_traegt_niemals_den_nachrichtentext(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """ADR-0029: der Server kennt den Inhalt nicht — er darf ihn nicht melden.

    Der Test hält fest, WAS übergeben wird: Name und Objekt, kein Textfeld aus
    der Nachricht. Ohne ihn wäre ein späterer „kleiner Auszug in der Vorschau"
    eine Änderung, die niemandem auffällt.
    """
    from src.features.owner_chat import melden

    gesendet: list[dict] = []

    class _Dispatcher:
        def __init__(self, _db: object) -> None:
            pass

        def sende(self, **kw: object) -> None:
            gesendet.append(kw)

    import src.features.notification_settings.dispatcher as disp_modul

    monkeypatch.setattr(
        disp_modul, "NotificationDispatcher", _Dispatcher, raising=True
    )
    db = _DB(_basis())
    melden.neue_nachricht_melden(
        db,
        T,
        property_id=P,
        thread_id="faden-1",
        message_id="m1",
        seite="agency",
        absender_name="Jeanine",
        absender_user_id="user-agentur",
    )
    assert gesendet, "Der Eigentümer muss benachrichtigt werden"
    werte = gesendet[0]
    assert werte["text_werte"] == {"name": "Jeanine", "objekt": ""}
    # Der Chiffretext taucht in KEINEM Feld auf.
    assert "Y2hpZmZyZQ==" not in str(werte)


def test_meldung_dedup_je_nachricht_nicht_je_thread() -> None:
    """Ein threadweiter Schlüssel verschluckte ab der zweiten jede Meldung.

    Der Dispatcher überspringt bei gleichem `dedup_key` ALLE Kanäle — der
    Schlüssel muss deshalb die Nachrichten-ID tragen, sonst wäre nur die erste
    Nachricht eines Absenders je gemeldet worden (stiller Ausfall, Wurzel 5).
    """
    from src.features.owner_chat import melden

    quelle = pathlib.Path(melden.__file__).read_text(encoding="utf-8")
    assert 'dedup_key=f"eigchat:{message_id}"' in quelle


# --- Die am 09.09.2026 geschlossenen Sicherheitslücken -------------------------


def test_fremder_absenderschluessel_wird_abgewiesen() -> None:
    """Wurzel 3: Identitätsfälschung im verschlüsselten Chat.

    Der Absender liefert seinen öffentlichen Schlüssel selbst mit, und der
    Empfänger bildet damit das gemeinsame Geheimnis. Wurde er nur auf „nicht
    leer" geprüft, konnte jeder Schreibberechtigte ein Wegwerf-Schlüsselpaar
    erzeugen und unter FREMDEM Namen senden — die Nachricht wäre sauber lesbar
    und kryptografisch nicht von einer echten zu unterscheiden.
    """
    db = _DB(_basis())
    geraete_liste = kern.empfaenger_geraete(db, T, P)
    with pytest.raises(OwnerChatError) as exc:
        kern.nachricht_ablegen(
            db,
            T,
            "faden-1",
            seite="owner",
            user_id="user-owner",
            sender_name="Rene",
            chiffre="Y2hpZmZyZQ==",
            schluessel={"dev-owner": "k1", "dev-agentur": "k2"},
            geraete=geraete_liste,
            bilder=[],
            sender_key="WEGWERFSCHLUESSEL==",
        )
    assert exc.value.status_code == 403
    assert db.tables["owner_messages"] == []


def test_gesperrtes_geraet_darf_nicht_mehr_senden() -> None:
    """Wurzel 1: Die Sperre nimmt die Zukunft, nicht nur den Empfang.

    Wer sein Handy als verloren meldet, soll damit nicht weiterschreiben
    können — sonst wäre die Sperre nur halb.
    """
    daten = _basis()
    daten["owner_chat_devices"][1]["gesperrt_am"] = "2026-09-01T00:00:00Z"
    db = _DB(daten)
    with pytest.raises(OwnerChatError) as exc:
        kern.nachricht_ablegen(
            db,
            T,
            "faden-1",
            seite="owner",
            user_id="user-owner",
            sender_name="Rene",
            chiffre="Y2hpZmZyZQ==",
            schluessel={},
            geraete=[],
            bilder=[],
            sender_key="BB==",
        )
    assert exc.value.status_code == 403


def test_freigabe_lesepfad_verlangt_dieselbe_rolle_wie_der_schreibpfad() -> None:
    """Wurzel 9: Der Lesepfad gab den KOMPLETTEN Chiffretext heraus.

    Bis zum 09.09.2026 hing `offene_nachrichten` nur an `get_current_user`:
    jede Rolle im Mandanten — auch eine Reinigungskraft — konnte mit einer
    geratenen Thread-ID den ganzen Verlauf jedes Eigentümer-Gesprächs abziehen.
    Der Schreibpfad direkt daneben prüfte korrekt.
    """
    daten = _basis()
    daten["users"].append(
        {"id": "user-staff", "tenant_id": T, "role": "staff", "permissions": None}
    )
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "geheim"}
    ]
    db = _DB(daten)
    with pytest.raises(OwnerChatError) as exc:
        freigabe.offene_nachrichten(db, T, "user-staff", "faden-1", "dev-agentur")
    assert exc.value.status_code == 403


def test_freigabe_nur_fuer_geraete_dieses_gespraechs() -> None:
    """Wurzel 9: Die Rollenprüfung sagt WER freigibt, nicht FÜR WEN.

    Ohne diesen Schutz konnte ein Admin das Gerät eines fremden Eigentümers
    für ein Gespräch freischalten, mit dem dieser nichts zu tun hat.
    """
    daten = _basis()
    daten["users"].append(
        {"id": "user-fremd", "tenant_id": T, "role": "owner", "permissions": None}
    )
    daten["owner_chat_devices"].append(
        {
            "id": "dev-fremd",
            "tenant_id": T,
            "user_id": "user-fremd",
            "seite": "owner",
            "public_key": "ZZ==",
            "gesperrt_am": None,
        }
    )
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "c1"}
    ]
    db = _DB(daten)
    with pytest.raises(OwnerChatError) as exc:
        freigabe.schluessel_nachtragen(
            db,
            T,
            "user-agentur",
            "faden-1",
            "dev-fremd",
            schluessel={"m1": "k"},
            wrapper_key="FF==",
        )
    assert exc.value.status_code == 403
    assert db.tables["owner_message_keys"] == []


def test_zu_viele_empfaenger_werfen_statt_abzuschneiden() -> None:
    """Wurzel 5/8: Ein stilles `.limit()` wäre der schlimmere Fehler.

    Abgeschnitten bekämen die Geräte jenseits der Grenze nie einen Schlüssel —
    sie könnten die Nachricht dauerhaft nicht öffnen, ohne dass irgendwo etwas
    fehlschlägt.
    """
    daten = _basis()
    for i in range(kern.MAX_EMPFAENGER + 1):
        daten["users"].append(
            {
                "id": f"user-{i}",
                "tenant_id": T,
                "role": "admin",
                "permissions": None,
            }
        )
        daten["owner_chat_devices"].append(
            {
                "id": f"dev-{i}",
                "tenant_id": T,
                "user_id": f"user-{i}",
                "seite": "agency",
                "public_key": f"K{i}==",
                "gesperrt_am": None,
            }
        )
    db = _DB(daten)
    with pytest.raises(OwnerChatError) as exc:
        kern.empfaenger_geraete(db, T, P)
    assert exc.value.status_code == 409


def test_empfaengerkreis_folgt_der_zuweisung_nicht_dem_eigentum() -> None:
    """Der Verwalter-Fall: Zugriff ohne Eintrag in `owner_properties`.

    Live gemessen am 09.09.2026: 8 von 30 Zuweisungen stehen NUR in
    `owner_property_assignments`. Diese Nutzer durften senden und lesen,
    standen aber nicht im Empfängerkreis — für sie wurde nie ein Schlüssel
    verpackt, und sie sahen dauerhaft „nicht lesbar" (stumm, Wurzel 5).
    """
    daten = _basis()
    daten["owner_properties"] = []  # kein Eigentum, nur Zuweisung
    db = _DB(daten)
    assert kern.eigentuemer_nutzer(db, T, P) == ["user-owner"]


# --- Die am 09.09.2026 in der ZWEITEN Prüfrunde geschlossenen Lücken -----------


def test_bildpfad_traversal_wird_abgewiesen() -> None:
    """Wurzel 3/8: `".." in pfad` war umgehbar.

    `<tenant>/%2e%2e/<fremd>/…` passierte die alte Zeichenkettenprüfung, und
    die Storage-Bibliothek dekodierte ein zweites Mal und normalisierte das
    `..` weg — der Mandantenpräfix verschwand, bevor die Anfrage rausging.
    Geprüft wird deshalb die FORM, nicht ein Teilstring.
    """
    from src.features.owner_chat import bilder

    eigen = "11111111-1111-1111-1111-111111111111"
    fremd = "22222222-2222-2222-2222-222222222222"
    bilder.pfad_pruefen(f"{eigen}/{fremd}/abcDEF_-123.bin", eigen)  # gültig

    for boese in (
        f"{eigen}/%2e%2e/{fremd}/u/x.bin",
        f"{eigen}/../{fremd}/x.bin",
        f"{fremd}/{fremd}/x.bin",
        f"{eigen}/{fremd}/x.jpg",
        f"{eigen}/{fremd}/../x.bin",
    ):
        with pytest.raises(OwnerChatError) as exc:
            bilder.pfad_pruefen(boese, eigen)
        assert exc.value.status_code == 404


def test_fremder_bildpfad_kommt_nicht_an_die_nachricht() -> None:
    """Wurzel 3: sonst hinge ein fremdes Bild dauerhaft an der Nachricht.

    Der Pfad ginge an alle Teilnehmer und würde vom Adress-Endpunkt signiert.
    """
    db = _DB(_basis())
    with pytest.raises(OwnerChatError) as exc:
        kern.nachricht_ablegen(
            db,
            T,
            "faden-1",
            seite="owner",
            user_id="user-owner",
            sender_name="Rene",
            chiffre="",
            schluessel={},
            geraete=[],
            bilder=["fremder-mandant/user/x.bin"],
            sender_key="BB==",
        )
    assert exc.value.status_code == 404
    assert db.tables["owner_messages"] == []


def test_fremde_geraete_id_liefert_keine_schluessel() -> None:
    """Wurzel 9: `device_id` kam als freier Parameter.

    Ohne die Bindung an den Anrufer konnte ein Nutzer die verpackten Schlüssel
    eines FREMDEN Geräts abrufen — ohne dessen privaten Schlüssel nutzlos, aber
    es ist Krypto-Material, und wer es sammelt, spart sich die Zuordnung, sobald
    ein Gerät kompromittiert ist.
    """
    db = _DB(_basis())
    # Das eigene Gerät wird durchgereicht …
    assert kern.eigenes_geraet(db, T, "user-owner", "dev-owner") == "dev-owner"
    # … ein fremdes nicht.
    assert kern.eigenes_geraet(db, T, "user-owner", "dev-agentur") is None
    # … und ein erfundenes auch nicht.
    assert kern.eigenes_geraet(db, T, "user-owner", "dev-erfunden") is None


def test_freigabe_ohne_wrapper_key_wird_abgewiesen() -> None:
    """Der Fehler, der die Freigabe bis zum 09.09.2026 unmöglich machte.

    Ohne den Schlüssel des VERPACKENDEN Geräts bildet der Empfänger das
    Geheimnis gegen den ursprünglichen Absender — der GCM-Tag schlägt fehl, die
    Nachricht bleibt unlesbar. Und zwar STUMM: die Zeile existiert danach, also
    zählt sie nicht mehr als „nicht lesbar", der Hinweis verschwindet, und der
    Nutzer sieht „freigegeben" bei leerer Blase (Wurzel 5).
    """
    daten = _basis()
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "c1"}
    ]
    db = _DB(daten)
    with pytest.raises(OwnerChatError) as exc:
        freigabe.schluessel_nachtragen(
            db,
            T,
            "user-agentur",
            "faden-1",
            "dev-agentur",
            schluessel={"m1": "k"},
            wrapper_key="",
        )
    assert exc.value.status_code == 422
    assert db.tables["owner_message_keys"] == []


def test_freigabe_haelt_fest_wer_verpackt_hat() -> None:
    """`wrapper_key` an der Zeile ist der Weg, wie der Empfänger sie öffnet."""
    daten = _basis()
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "c1"}
    ]
    db = _DB(daten)
    anzahl = freigabe.schluessel_nachtragen(
        db,
        T,
        "user-agentur",
        "faden-1",
        "dev-agentur",
        schluessel={"m1": "k"},
        wrapper_key="FREIGEBER==",
    )
    assert anzahl == 1
    assert db.tables["owner_message_keys"][0]["wrapper_key"] == "FREIGEBER=="


def test_zuletzt_aktiv_wird_beim_lesen_nachgezogen() -> None:
    """Wurzel 5b: Das Feld hieß „zuletzt aktiv" und trug das Anlagedatum.

    In der Geräteliste — dem einzigen Schutz gegen einen untergeschobenen
    Mitleser — stand damit ein Zeitpunkt unter einer Überschrift, die etwas
    anderes verspricht.
    """
    daten = _basis()
    daten["owner_chat_devices"][1]["zuletzt_aktiv"] = "2020-01-01T00:00:00Z"
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "c1"}
    ]
    db = _DB(daten)
    kern.verlauf_lesen(db, T, "faden-1", device_id="dev-owner")
    geraet = next(
        g for g in db.tables["owner_chat_devices"] if g["id"] == "dev-owner"
    )
    assert geraet["zuletzt_aktiv"] != "2020-01-01T00:00:00Z"


def test_lesepfad_prueft_dasselbe_wie_der_schreibpfad() -> None:
    """Wurzel 9: Die beiden Pfade liefen auseinander.

    Runde 2 hatte den Lesepfad autorisiert — aber gegen ANDERE Bedingungen als
    den Schreibpfad daneben. Drei Angriffe, alle am 09.09.2026 nachgestellt:

      1. gesperrtes Gerät als Vorwand → Schreibpfad 404, Lesepfad lieferte den
         vollständigen Chiffretext
      2. fremdes Gerät aus einem anderen Objekt → Schreibpfad 403, Lesepfad gab
         den Verlauf heraus
      3. admin ohne Postfachrecht → nicht im Empfängerkreis, zog trotzdem alles

    Beide Pfade rufen jetzt DIESELBE Funktion. Zwei getrennte Prüfblöcke waren
    die Ursache, nicht die Lösung.
    """
    # 1. Gesperrtes Gerät
    daten = _basis()
    daten["owner_chat_devices"][0]["gesperrt_am"] = "2026-09-01T00:00:00Z"
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "GEHEIM"}
    ]
    db = _DB(daten)
    with pytest.raises(OwnerChatError) as exc:
        freigabe.offene_nachrichten(db, T, "user-agentur", "faden-1", "dev-agentur")
    assert exc.value.status_code == 404

    # 2. Fremdes Gerät, das nicht zum Gespräch gehört
    daten = _basis()
    daten["users"].append(
        {"id": "user-fremd", "tenant_id": T, "role": "owner", "permissions": None}
    )
    daten["owner_chat_devices"].append(
        {
            "id": "dev-fremd",
            "tenant_id": T,
            "user_id": "user-fremd",
            "seite": "owner",
            "public_key": "ZZ==",
            "gesperrt_am": None,
        }
    )
    daten["owner_messages"] = [
        {"id": "m1", "tenant_id": T, "thread_id": "faden-1", "body": "GEHEIM"}
    ]
    db = _DB(daten)
    with pytest.raises(OwnerChatError) as exc:
        freigabe.offene_nachrichten(db, T, "user-agentur", "faden-1", "dev-fremd")
    assert exc.value.status_code == 403


def test_gesperrtes_geraet_bekommt_keine_schluessel_mehr() -> None:
    """Wurzel 1: Sperren nimmt die Zukunft — auch beim LESEN.

    Die alten verpackten Schlüssel bleiben stehen (sonst rissen Lücken bei den
    übrigen Geräten). Sie über die API aktiv NACHZULIEFERN ist aber etwas
    anderes: Wer sein Handy als verloren meldet, erwartet, dass der Dieb ab
    jetzt nichts Neues mehr abholt.
    """
    daten = _basis()
    daten["owner_chat_devices"][1]["gesperrt_am"] = "2026-09-01T00:00:00Z"
    db = _DB(daten)
    assert kern.eigenes_geraet(db, T, "user-owner", "dev-owner") is None


# --- Melden und Ausstieg (Google UGC-Policy, 0615) ---------------------------
# Was hier schiefgehen kann, sieht man einer Chat-Oberfläche nicht an:
#   * „Beendet" ohne Riegel — man kann weiterschreiben, die Anzeige lügt.
#   * Zwei Meldungen aus einem Doppeldruck (Wurzel 2).
#   * Eine Meldung auf eine Nachricht aus einem FREMDEN Faden über eine
#     geratene ID (Wurzel 9).
#   * Kein Weg zurück — ein Streit wäre für immer (Wurzel 1).


def _mod_basis() -> dict[str, list[dict]]:
    tabellen = _basis()
    tabellen["owner_chat_meldungen"] = []
    tabellen["owner_chat_stopps"] = []
    tabellen["owner_messages"] = [
        {"id": "msg-1", "tenant_id": T, "thread_id": "faden-1"},
        {"id": "msg-fremd", "tenant_id": T, "thread_id": "faden-2"},
    ]
    return tabellen


def test_meldung_wird_abgelegt_und_nicht_verdoppelt() -> None:
    """Zweimal auf „Melden" tippen ist eine Meldung, nicht zwei."""
    db = _DB(_mod_basis())
    erste = moderation.melden(
        db,
        tenant_id=T,
        user_id="user-owner",
        seite="owner",
        thread_id="faden-1",
        message_id="msg-1",
        grund="beleidigung",
        freitext="Unangemessener Ton",
    )
    zweite = moderation.melden(
        db,
        tenant_id=T,
        user_id="user-owner",
        seite="owner",
        thread_id="faden-1",
        message_id="msg-1",
        grund="beleidigung",
        freitext=None,
    )

    assert erste["id"] == zweite["id"]
    assert len(db.tables["owner_chat_meldungen"]) == 1


def test_meldung_auf_fremde_nachricht_wird_abgewiesen() -> None:
    """Die gemeldete Nachricht muss IN diesem Faden liegen — sonst zöge jemand
    über eine geratene ID eine fremde Nachricht in sein eigenes Gespräch."""
    db = _DB(_mod_basis())
    with pytest.raises(OwnerChatError) as exc:
        moderation.melden(
            db,
            tenant_id=T,
            user_id="user-owner",
            seite="owner",
            thread_id="faden-1",
            message_id="msg-fremd",
            grund="anderes",
            freitext=None,
        )
    assert exc.value.status_code == 404
    assert db.tables["owner_chat_meldungen"] == []


def test_meldung_ohne_nachricht_gilt_dem_gespraech() -> None:
    """Google verlangt „report content AND users" — die Meldung ohne
    `message_id` ist die zweite Hälfte davon."""
    db = _DB(_mod_basis())
    zeile = moderation.melden(
        db,
        tenant_id=T,
        user_id="user-owner",
        seite="owner",
        thread_id="faden-1",
        message_id=None,
        grund="unerwuenscht",
        freitext=None,
    )
    assert zeile["message_id"] is None


def test_unbekannter_grund_wird_abgewiesen() -> None:
    """Ein freier Grund wäre nicht auswertbar — und die DB wirft sonst ein
    CHECK-Constraint, dessen Meldung niemand versteht."""
    db = _DB(_mod_basis())
    with pytest.raises(OwnerChatError) as exc:
        moderation.melden(
            db,
            tenant_id=T,
            user_id="user-owner",
            seite="owner",
            thread_id="faden-1",
            message_id=None,
            grund="weil-ich-kann",
            freitext=None,
        )
    assert exc.value.status_code == 422


def test_meldung_traegt_keinen_nachrichtentext() -> None:
    """Der Server KANN ihn nicht kennen (E2E). Wer hier je ein Feld ergänzt,
    hat vorher die Verschlüsselung aufgehoben."""
    db = _DB(_mod_basis())
    zeile = moderation.melden(
        db,
        tenant_id=T,
        user_id="user-owner",
        seite="owner",
        thread_id="faden-1",
        message_id="msg-1",
        grund="anderes",
        freitext="siehe Nachricht",
    )
    assert "body" not in zeile
    assert "chiffre" not in zeile


def test_stopp_ist_umkehrbar() -> None:
    """Der Gegenzustand (Wurzel 1): ohne ihn wäre ein Streit für immer."""
    db = _DB(_mod_basis())
    moderation.stopp_setzen(
        db, tenant_id=T, user_id="user-owner", thread_id="faden-1", grund=None
    )
    assert moderation.ist_gestoppt(db, thread_id="faden-1", user_id="user-owner")

    moderation.stopp_aufheben(db, tenant_id=T, user_id="user-owner", thread_id="faden-1")
    assert not moderation.ist_gestoppt(db, thread_id="faden-1", user_id="user-owner")


def test_stopp_gilt_nur_fuer_den_der_ihn_gesetzt_hat() -> None:
    """An einem Objekt hängen seit 0389 auch Familienzugänge. Beendet die
    Tochter das Gespräch, darf der Vater nicht abgeschnitten sein."""
    db = _DB(_mod_basis())
    moderation.stopp_setzen(
        db, tenant_id=T, user_id="user-owner", thread_id="faden-1", grund=None
    )
    assert not moderation.ist_gestoppt(db, thread_id="faden-1", user_id="user-familie")


def test_zweimal_stoppen_ist_ein_stopp() -> None:
    """Wurzel 2: der zweite Druck darf kein 23505 werfen."""
    db = _DB(_mod_basis())
    for _ in range(2):
        moderation.stopp_setzen(
            db, tenant_id=T, user_id="user-owner", thread_id="faden-1", grund=None
        )
    assert len(db.tables["owner_chat_stopps"]) == 1
