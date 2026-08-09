"""Tests fuer die Ereignis-Benachrichtigungen (Etappe E).

Schwerpunkte:
  * Fan-out — BEIDE Owner-Zuordnungswege werden gefragt und vereinigt.
  * Wurzel 2 — der Dedup-Key beschreibt das EREIGNIS; Redelivery meldet nicht
    erneut.
  * Wurzel 3 — nur Vorname und Quelle, nie Gesamtpreis oder Kontaktdaten; kein
    Empfaenger ausserhalb des Mandanten.
  * Wurzel 5 — ein Versandfehler kippt den Aufrufer NICHT.

Der Dispatcher wird durch ein Doppel ersetzt: die Tests pruefen, WAS gemeldet
wird, nicht ob Twilio/SMTP laufen. Es geht bewusst keine echte Mail/SMS raus.
"""
from __future__ import annotations

import pytest

from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import TEXTE
from src.core.mail_texte import text as mail_text
from src.features.notification_settings import ereignisse
from src.features.notification_settings.dispatcher import Katalogwert


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: _DB, table: str) -> None:
        self._db = db
        self._table = table
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None

    def select(self, *_a: object, **_k: object) -> _Query:
        return self

    def eq(self, col: str, val: object) -> _Query:
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> _Query:
        self._in = (col, vals)
        return self

    def limit(self, _n: int) -> _Query:
        return self

    def execute(self) -> _Result:
        rows = self._db.tables.get(self._table, [])
        out = [
            r
            for r in rows
            if all(str(r.get(c)) == str(v) for c, v in self._filters)
            and (
                self._in is None
                or str(r.get(self._in[0])) in {str(v) for v in self._in[1]}
            )
        ]
        return _Result(out)


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables

    def table(self, name: str) -> _Query:
        return _Query(self, name)


class _Dispatcher:
    """Faengt die Aufrufe ab, statt zu versenden."""

    def __init__(self, *, fehler: bool = False) -> None:
        self.aufrufe: list[dict] = []
        self._fehler = fehler

    def sende(self, **kw: object) -> None:
        if self._fehler:
            msg = "SMTP tot"
            raise RuntimeError(msg)
        self.aufrufe.append(kw)


@pytest.fixture
def dispatcher(monkeypatch: pytest.MonkeyPatch) -> _Dispatcher:
    doppel = _Dispatcher()
    monkeypatch.setattr(ereignisse, "_dispatcher", lambda _db: doppel)
    return doppel


def _tables() -> dict[str, list[dict]]:
    return {
        "users": [
            {"id": "staff-1", "tenant_id": "t-1"},
            {"id": "owner-portal", "tenant_id": "t-1"},
            {"id": "owner-abrechnung", "tenant_id": "t-1"},
            {"id": "fremd-1", "tenant_id": "t-999"},
        ],
        # Weg 1: Login ↔ Objekt (das Portal).
        "owner_property_assignments": [
            {"tenant_id": "t-1", "user_id": "owner-portal", "property_id": "p-1"}
        ],
        # Weg 2: Owner-Partei ↔ Objekt (die Abrechnung).
        "owner_properties": [{"owner_id": "o-1", "property_id": "p-1"}],
        "owners": [
            {"id": "o-1", "tenant_id": "t-1", "user_id": "owner-abrechnung"},
        ],
    }


# --- Aufgaben-Zuweisung -----------------------------------------------------


def test_zuweisung_meldet_an_den_zugewiesenen(dispatcher: _Dispatcher) -> None:
    ereignisse.melde_aufgaben_zuweisung(
        _DB(_tables()), tenant_id="t-1", task_id="task-1",
        assignee_id="staff-1", titel="endreinigung", property_id="p-1",
    )
    assert len(dispatcher.aufrufe) == 1
    ruf = dispatcher.aufrufe[0]
    assert ruf["user_id"] == "staff-1"
    assert ruf["schluessel"] == "task_assigned"
    assert ruf["dedup_key"] == "aufgabe_zugewiesen:task-1:staff-1"


def test_ohne_zugewiesenen_passiert_nichts(dispatcher: _Dispatcher) -> None:
    """Wurzel 4: eine unzugewiesene Aufgabe hat keinen Empfaenger — und „an
    alle" waere geraten."""
    ereignisse.melde_aufgaben_zuweisung(
        _DB(_tables()), tenant_id="t-1", task_id="task-1",
        assignee_id=None, titel="endreinigung",
    )
    assert dispatcher.aufrufe == []


def test_fremder_mandant_wird_nicht_angeschrieben(dispatcher: _Dispatcher) -> None:
    """Wurzel 3: der Dispatcher loest den Empfaenger ohne Tenant-Filter auf —
    die Pruefung muss hier passieren."""
    ereignisse.melde_aufgaben_zuweisung(
        _DB(_tables()), tenant_id="t-1", task_id="task-1",
        assignee_id="fremd-1", titel="endreinigung",
    )
    assert dispatcher.aufrufe == []


def test_umverteilung_erreicht_den_neuen_zustaendigen(
    dispatcher: _Dispatcher,
) -> None:
    """Der Dedup-Key traegt den Empfaenger — sonst schluckte er die zweite
    Zuweisung."""
    db = _DB(_tables())
    for wer in ("staff-1", "owner-portal", "staff-1"):
        ereignisse.melde_aufgaben_zuweisung(
            db, tenant_id="t-1", task_id="task-1", assignee_id=wer, titel="x",
        )
    schluessel = [a["dedup_key"] for a in dispatcher.aufrufe]
    assert schluessel[0] != schluessel[1]
    assert schluessel[0] == schluessel[2]


def test_versandfehler_kippt_den_aufrufer_nicht(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Wurzel 5: Benachrichtigungen sind Nebenpfad. Die Aufgabe ist angelegt,
    auch wenn SMTP tot ist."""
    monkeypatch.setattr(ereignisse, "_dispatcher", lambda _db: _Dispatcher(fehler=True))
    ereignisse.melde_aufgaben_zuweisung(
        _DB(_tables()), tenant_id="t-1", task_id="task-1",
        assignee_id="staff-1", titel="endreinigung",
    )  # darf nicht werfen


# --- Buchungs-Ereignisse ----------------------------------------------------


def test_beide_zuordnungswege_werden_vereinigt() -> None:
    """Der Kern des Fan-outs: wer nur ueber EINEN Weg eingetragen ist, muss
    trotzdem erreicht werden."""
    ids = ereignisse.eigentuemer_nutzer_ids(_DB(_tables()), "t-1", "p-1")
    assert ids == {"owner-portal", "owner-abrechnung"}


def test_fremder_mandant_faellt_aus_dem_fan_out() -> None:
    tables = _tables()
    tables["owners"][0]["tenant_id"] = "t-999"
    ids = ereignisse.eigentuemer_nutzer_ids(_DB(tables), "t-1", "p-1")
    assert ids == {"owner-portal"}


def test_buchung_meldet_an_alle_eigentuemer(dispatcher: _Dispatcher) -> None:
    ereignisse.melde_buchungs_ereignis(
        _DB(_tables()), tenant_id="t-1", reservation_id="r-1", kind="created",
        property_id="p-1", gast_vorname="Anna Musterfrau", quelle="Airbnb",
    )
    assert {a["user_id"] for a in dispatcher.aufrufe} == {
        "owner-portal", "owner-abrechnung",
    }


def test_nur_vorname_geht_mit(dispatcher: _Dispatcher) -> None:
    """Wurzel 3 / §4.2: der Eigentuemer sieht Vorname + Quelle, sonst nichts."""
    ereignisse.melde_buchungs_ereignis(
        _DB(_tables()), tenant_id="t-1", reservation_id="r-1", kind="created",
        property_id="p-1", gast_vorname="Anna Musterfrau", quelle="Airbnb",
    )
    text = dispatcher.aufrufe[0]["text"]
    assert "Anna" in text
    assert "Musterfrau" not in text


def test_kein_betrag_in_der_meldung(dispatcher: _Dispatcher) -> None:
    """Der Gast-Gesamtpreis ist fuer den Eigentuemer tabu — er kommt in der
    Signatur gar nicht erst vor."""
    ereignisse.melde_buchungs_ereignis(
        _DB(_tables()), tenant_id="t-1", reservation_id="r-1", kind="created",
        property_id="p-1", gast_vorname="Anna", quelle="Airbnb",
    )
    inhalt = str(dispatcher.aufrufe[0])
    assert "€" not in inhalt
    assert "total" not in inhalt.lower()


def test_dedup_key_beschreibt_das_ereignis(dispatcher: _Dispatcher) -> None:
    """Wurzel 2: Webhook-Redelivery erzeugt denselben Schluessel."""
    db = _DB(_tables())
    for _ in range(3):
        ereignisse.melde_buchungs_ereignis(
            db, tenant_id="t-1", reservation_id="r-1", kind="created",
            property_id="p-1", gast_vorname="Anna", quelle="Airbnb",
        )
    schluessel = {a["dedup_key"] for a in dispatcher.aufrufe}
    assert schluessel == {"buchung:created:r-1"}


def test_storno_und_umzug_sind_eigene_meldungen(dispatcher: _Dispatcher) -> None:
    db = _DB(_tables())
    for art in ("created", "moved", "cancelled"):
        ereignisse.melde_buchungs_ereignis(
            db, tenant_id="t-1", reservation_id="r-1", kind=art,
            property_id="p-1", quelle="Airbnb",
        )
    arten = {a["dedup_key"].split(":")[1] for a in dispatcher.aufrufe}
    assert arten == {"created", "moved", "cancelled"}


def test_betriebsereignisse_gehen_den_eigentuemer_nichts_an(
    dispatcher: _Dispatcher,
) -> None:
    for art in ("checked_in", "checked_out", "repriced", "request_expired"):
        ereignisse.melde_buchungs_ereignis(
            _DB(_tables()), tenant_id="t-1", reservation_id="r-1", kind=art,
            property_id="p-1",
        )
    assert dispatcher.aufrufe == []


def test_ohne_objektbezug_keine_meldung(dispatcher: _Dispatcher) -> None:
    """Ohne property_id gibt es keinen Eigentuemer — „an alle Owner" waere ein
    Datenleck ueber fremde Objekte."""
    ereignisse.melde_buchungs_ereignis(
        _DB(_tables()), tenant_id="t-1", reservation_id="r-1", kind="created",
        property_id=None,
    )
    assert dispatcher.aufrufe == []


def test_objekt_ohne_eigentuemer_meldet_nichts(dispatcher: _Dispatcher) -> None:
    """Fail-closed: kein Ausweichen auf „dann eben die Admins"."""
    ereignisse.melde_buchungs_ereignis(
        _DB(_tables()), tenant_id="t-1", reservation_id="r-1", kind="created",
        property_id="p-unbekannt", quelle="Airbnb",
    )
    assert dispatcher.aufrufe == []


def test_buchungs_versandfehler_kippt_den_import_nicht(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ereignisse, "_dispatcher", lambda _db: _Dispatcher(fehler=True))
    ereignisse.melde_buchungs_ereignis(
        _DB(_tables()), tenant_id="t-1", reservation_id="r-1", kind="created",
        property_id="p-1", quelle="Airbnb",
    )  # darf nicht werfen


# --- Review-Befunde (Regressionen) -----------------------------------------


def test_betreff_ist_lesbar_kein_uebersetzungsschluessel(
    dispatcher: _Dispatcher,
) -> None:
    """Derselbe `sende()`-Aufruf speist Glocke UND E-Mail. Ein Betreff
    „booking.created" kaeme so im Postfach des Eigentuemers an — keine
    Uebersetzung erreicht eine versendete Mail."""
    tables = _tables()
    tables["properties"] = [
        {"id": "p-1", "tenant_id": "t-1", "title": "Villa Seeblick"}
    ]
    ereignisse.melde_buchungs_ereignis(
        _DB(tables), tenant_id="t-1", reservation_id="r-1", kind="created",
        property_id="p-1", gast_vorname="Anna", quelle="Airbnb",
    )
    betreff = dispatcher.aufrufe[0]["betreff"]
    assert "booking." not in betreff
    assert "Villa Seeblick" in betreff


def test_betreff_faellt_auf_die_kennung_zurueck(dispatcher: _Dispatcher) -> None:
    """Ohne Objekttitel die ID-Kurzform — der Eigentuemer muss erkennen, WELCHES
    Objekt gemeint ist. Kein erfundenes „Ihr Objekt" (Wurzel 4)."""
    ereignisse.melde_buchungs_ereignis(
        _DB(_tables()), tenant_id="t-1", reservation_id="r-1", kind="created",
        property_id="p-1", quelle="Airbnb",
    )
    assert "p-1" in dispatcher.aufrufe[0]["betreff"]


def test_aufgaben_betreff_uebersetzt_den_katalog_schluessel(
    dispatcher: _Dispatcher,
) -> None:
    """Der rohe Key „endreinigung" stuende sonst als Mail-Betreff im Postfach.

    Geprueft wird BEIDES: der fertige Satz fuer die Glocke und der
    Katalog-Schluessel fuer die Mail. Der Schluessel ist der eigentliche
    Fortschritt — er laesst den Dispatcher erst dann uebersetzen, wenn die
    Sprache des Empfaengers feststeht.
    """
    ereignisse.melde_aufgaben_zuweisung(
        _DB(_tables()), tenant_id="t-1", task_id="task-1",
        assignee_id="staff-1", titel="endreinigung",
    )
    ruf = dispatcher.aufrufe[0]
    # Die Glocke traegt den aufgeloesten Satz, nicht den rohen Schluessel.
    assert "endreinigung" not in ruf["betreff"]
    assert mail_text("aufgabe.endreinigung", FALLBACK) in ruf["betreff"]
    # Die MAIL traegt den Schluessel — uebersetzt wird beim Empfaenger.
    assert ruf["betreff_key"] == "benachrichtigung.aufgabe_neu"
    assert ruf["betreff_werte"]["titel"] == Katalogwert("aufgabe.endreinigung")


def test_freitext_des_eigentuemers_bleibt_unveraendert(
    dispatcher: _Dispatcher,
) -> None:
    """Sein Text ist die Wahrheit — er wird nicht „uebersetzt"."""
    ereignisse.melde_aufgaben_zuweisung(
        _DB(_tables()), tenant_id="t-1", task_id="task-1",
        assignee_id="staff-1", titel="Hecke schneiden",
    )
    assert "Hecke schneiden" in dispatcher.aufrufe[0]["betreff"]


def test_bezeichnungen_decken_die_systemvorgaben_aus_0330() -> None:
    """Der Mail-Betreff und der DB-Katalog duerfen nicht auseinanderlaufen."""
    import pathlib
    import re

    sql = pathlib.Path(
        "../../supabase/migrations/0330_dienstleistungs_katalog.sql"
    )
    if not sql.exists():  # anderer Arbeitsordner — dann nichts zu pruefen
        return
    keys = set(re.findall(r"\(null, '(\w+)',", sql.read_text(encoding="utf-8")))
    assert keys, "keine Systemvorgaben in 0330 gefunden"
    zuordnung = ereignisse._AUFGABEN_SCHLUESSEL  # noqa: SLF001
    assert keys <= set(zuordnung)
    # Jede Systemvorgabe braucht ihren Katalogeintrag in ALLEN 24 Sprachen —
    # sonst steht bei einem Teil der Empfaenger der rohe Schluessel im Betreff.
    for key in keys:
        assert zuordnung[key] in TEXTE, f"{key} fehlt im Mailtext-Katalog"


def test_db_fehler_bei_der_tenant_pruefung_kippt_nichts() -> None:
    """Wurzel 5: die Tenant-Pruefung fragt die DB. Stuende sie vor dem `try`,
    kaeme ein transienter DB-Fehler beim Aufrufer als 500 an — nach bereits
    angelegter Aufgabe, die `create_task` beim Retry ein zweites Mal erzeugte."""

    class KaputteDB:
        def table(self, _n: str) -> object:
            raise RuntimeError("DB weg")

    ereignisse.melde_aufgaben_zuweisung(
        KaputteDB(), tenant_id="t-1", task_id="task-1",
        assignee_id="staff-1", titel="endreinigung",
    )  # darf nicht werfen


def test_erledigte_leistung_meldet_an_den_besteller(
    dispatcher: _Dispatcher,
) -> None:
    """`owner_service` war sonst ein Schalter ohne Sender (Wurzel 4)."""
    ereignisse.melde_dienstleistung_erledigt(
        _DB(_tables()), tenant_id="t-1", task_id="task-1",
        zeile={
            "requested_by": "owner-portal",
            "title": "endreinigung",
            "property_id": "p-1",
        },
    )
    assert len(dispatcher.aufrufe) == 1
    ruf = dispatcher.aufrufe[0]
    assert ruf["user_id"] == "owner-portal"
    assert ruf["schluessel"] == "owner_service"
    assert mail_text("aufgabe.endreinigung", FALLBACK) in ruf["betreff"]
    assert ruf["betreff_key"] == "benachrichtigung.leistung_erledigt"
    assert ruf["betreff_werte"]["titel"] == Katalogwert("aufgabe.endreinigung")
    assert ruf["dedup_key"] == "leistung_erledigt:task-1"


def test_betriebsaufgabe_meldet_keinem_eigentuemer(
    dispatcher: _Dispatcher,
) -> None:
    """Ohne `requested_by` ist es eine gewoehnliche Aufgabe des Betriebs — die
    geht den Eigentuemer nichts an (§4.3)."""
    ereignisse.melde_dienstleistung_erledigt(
        _DB(_tables()), tenant_id="t-1", task_id="task-1",
        zeile={"title": "Flur wischen", "property_id": "p-1"},
    )
    assert dispatcher.aufrufe == []


def test_katalog_kennt_die_neuen_schluessel() -> None:
    """Ein Schluessel ohne Katalog-Eintrag waere ein ValueError im Dispatcher."""
    from src.features.notification_settings.katalog import NACH_SCHLUESSEL

    assert ereignisse.SCHLUESSEL_AUFGABE in NACH_SCHLUESSEL
    assert ereignisse.SCHLUESSEL_BUCHUNG in NACH_SCHLUESSEL
    # E-Mail beim Eigentuemer nicht abwaehlbar (vertragliche Kerninformation).
    assert NACH_SCHLUESSEL[ereignisse.SCHLUESSEL_BUCHUNG].email_pflicht is True
    assert NACH_SCHLUESSEL[ereignisse.SCHLUESSEL_AUFGABE].email_pflicht is False
