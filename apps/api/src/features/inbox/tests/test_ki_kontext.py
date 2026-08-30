"""Tests des Kontext-Sammlers.

Der Sammler ist die Stelle, an der entschieden wird, WAS die KI über einen Gast
und seine Unterkunft erfährt. Zwei Klassen von Fehlern sind hier teuer und
beide unsichtbar, wenn niemand sie prüft:

* **Zu wenig** — ein Abschnitt fällt still weg, die Antwort wird unvollständig,
  und es sieht aus wie ein Modellfehler.
* **Zu viel** — ein Türcode geht an jemanden, der nicht gebucht hat.

Die Tests decken beide ab, dazu die Formvielfalt der echten Daten (18 Objekte
mehrsprachig, eines mit blankem String) und den Zeichendeckel.
"""

from __future__ import annotations

from datetime import date

import pytest

from src.features.inbox.ki_kontext import (
    MAX_KONTEXT_ZEICHEN,
    _abschnitte_waehlen,
    _mehrsprachig_lesen,
    kontext_bauen,
)


class _Res:
    def __init__(self, data: list) -> None:
        self.data = data


class _Query:
    """Kettbare Abfrage, die am Ende die vorgegebenen Zeilen liefert.

    Kennt dieselben Methoden wie PostgREST — insbesondere `gte`/`lte`, die
    `einheiten_verfuegbar` benutzt. Ein Double, das die fehlen lässt, wirft
    einen `AttributeError`, den der Sammler seit dem engen `except` NICHT mehr
    fängt (mit Absicht) — die Tests liefen dann grün, ohne den
    Verfügbarkeitspfad je auszuführen.
    """

    def __init__(self, rows: list) -> None:
        self._rows = rows

    def select(self, *_a, **_k) -> _Query:
        return self

    def eq(self, *_a, **_k) -> _Query:
        return self

    def is_(self, *_a, **_k) -> _Query:
        return self

    def or_(self, *_a, **_k) -> _Query:
        return self

    def gte(self, *_a, **_k) -> _Query:
        return self

    def lte(self, *_a, **_k) -> _Query:
        return self

    def in_(self, *_a, **_k) -> _Query:
        return self

    def order(self, *_a, **_k) -> _Query:
        return self

    def limit(self, *_a, **_k) -> _Query:
        return self

    def execute(self) -> _Res:
        return _Res(self._rows)


class _FakeDb:
    """Nur so viel DB, wie der Sammler anfasst: Fakten, Einheiten, Kalender."""

    def __init__(
        self,
        fakten: list | None = None,
        einheiten: list | None = None,
        belegt: list | None = None,
    ) -> None:
        self._tabellen = {
            "inbox_knowledge_fact": fakten or [],
            # Eine Einheit, wie es bei einer FeWo der Normalfall ist.
            "property_units": einheiten
            if einheiten is not None
            else [{"id": "u1", "position": 0}],
            "availability": belegt or [],
            "property_sales_pause": [],
        }
        self.gefragt: list[str] = []

    def table(self, name: str) -> _Query:
        self.gefragt.append(name)
        return _Query(self._tabellen.get(name, []))


def _objekt(**messaging: object) -> dict:
    return {
        "id": "11111111-1111-1111-1111-111111111111",
        "title": "Feriehus Kornblomst",
        "city": "Hirtshals",
        "country": "DK",
        "description": "Ein Haus am Meer.",
        "type_attributes": {
            "messaging": messaging,
            "policies": {
                "checkInTime": "15:00",
                "haustiereErlaubt": True,
                "rauchenErlaubt": False,
                "cancellation": {"de": "Kostenlos bis 14 Tage vorher."},
            },
        },
    }


# --- Mehrsprachigkeit -------------------------------------------------------
def test_mehrsprachig_waehlt_die_gastsprache() -> None:
    wert = {"de": "Deutscher Text", "en": "English text", "da": "Dansk tekst"}
    assert _mehrsprachig_lesen(wert, "da") == "Dansk tekst"
    assert _mehrsprachig_lesen(wert, "de") == "Deutscher Text"


def test_mehrsprachig_faellt_auf_englisch_dann_deutsch() -> None:
    """Ein italienischer Gast liest lieber Englisch als gar nichts."""
    wert = {"de": "Deutscher Text", "en": "English text"}
    assert _mehrsprachig_lesen(wert, "it") == "English text"
    assert _mehrsprachig_lesen({"de": "Nur Deutsch"}, "it") == "Nur Deutsch"


def test_mehrsprachig_liest_auch_den_blanken_string() -> None:
    """Live-Form, die der bestehende Leser `messaging_texte` still verwirft.

    „Fewo-Mosbjerg-Sindal" hat `checkIn` als blanken String statt als
    Sprachobjekt. `feld_kontext.messaging_texte` überspringt das
    (`if not isinstance(werte, dict): continue`) — der Text dieses Objekts
    erreicht dort niemanden. Hier muss er ankommen.
    """
    assert _mehrsprachig_lesen("Anreise ab 15 Uhr", "de") == "Anreise ab 15 Uhr"


def test_mehrsprachig_macht_html_zu_klartext() -> None:
    roh = {"de": "<p><strong>WLAN</strong>: Gast2024</p>"}
    gelesen = _mehrsprachig_lesen(roh, "de")
    assert "<p>" not in gelesen
    assert "WLAN" in gelesen and "Gast2024" in gelesen


# --- Abschnittsauswahl ------------------------------------------------------
def test_frage_zieht_den_passenden_abschnitt_nach_vorn() -> None:
    vorhanden = {"checkIn", "wifi", "rules", "localGuide"}
    assert _abschnitte_waehlen("Wie ist das WLAN-Passwort?", vorhanden)[0] == "wifi"
    assert _abschnitte_waehlen("Wann können wir anreisen?", vorhanden)[0] == "checkIn"
    assert _abschnitte_waehlen("Dürfen Hunde mit?", vorhanden)[0] == "rules"


def test_auswahl_wirkt_auch_auf_englisch_und_daenisch() -> None:
    """Die Frage kommt in der Sprache des Gastes, nicht auf Deutsch."""
    vorhanden = {"checkIn", "wifi", "directions"}
    assert _abschnitte_waehlen("What is the wifi password?", vorhanden)[0] == "wifi"
    assert _abschnitte_waehlen("Hvad er kodeordet til wifi?", vorhanden)[0] == "wifi"


def test_ohne_treffer_kommen_alle_abschnitte() -> None:
    """Eine Frage ohne Stichwort ist keine Frage ohne Antwort.

    „Hallo, kurze Frage" trifft nichts — dann darf nicht NICHTS mitkommen,
    sondern alles in fester Reihenfolge; der Deckel schneidet hinten ab.
    """
    vorhanden = {"checkIn", "wifi", "rules"}
    assert set(_abschnitte_waehlen("Hallo, kurze Frage", vorhanden)) == vorhanden


def test_auswahl_liefert_nie_einen_nicht_gepflegten_abschnitt() -> None:
    assert _abschnitte_waehlen("Wie ist das WLAN?", {"checkIn"}) == ["checkIn"]


# --- Die Zugangssperre ------------------------------------------------------
@pytest.mark.parametrize("status", ["confirmed", "checked_in", "checked_out"])
def test_bestaetigte_buchung_bekommt_wlan_und_tuercode(status: str) -> None:
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(
            wifi={"de": "WLAN: Gast2024"},
            doorInstructions={"de": "Schlüsselbox-Code 4711"},
        ),
        frage="Wie komme ich rein und wie ist das WLAN?",
        sprache="de",
        status=status,
        heute=date(2026, 8, 29),
    )
    assert "Gast2024" in kontext.text
    assert "4711" in kontext.text
    assert kontext.zugang_gesperrt is False


@pytest.mark.parametrize("status", ["inquiry", "cancelled", "expired", None, ""])
def test_ohne_bestaetigte_buchung_kein_zugang(status: str | None) -> None:
    """Eine Anfrage ist keine Buchung — wer nur fragt, bekommt keinen Code.

    Fail-closed: auch ein unbekannter oder fehlender Status sperrt. Der Fehler
    „Gast bekommt den Code nicht, obwohl er gebucht hat" ist eine Rückfrage;
    „Fremder bekommt den Code" ist ein Einbruch.
    """
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(
            wifi={"de": "WLAN: Gast2024"},
            doorInstructions={"de": "Schlüsselbox-Code 4711"},
        ),
        frage="Wie komme ich rein und wie ist das WLAN?",
        sprache="de",
        status=status,
        heute=date(2026, 8, 29),
    )
    assert "Gast2024" not in kontext.text
    assert "4711" not in kontext.text
    assert kontext.zugang_gesperrt is True


def test_gesperrter_abschnitt_wird_benannt_nicht_verschwiegen() -> None:
    """Das Kontext-Panel muss zeigen, dass hier absichtlich etwas fehlt.

    Sonst sucht jemand den Fehler in der Gästemappe, wo er nicht ist.
    """
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(wifi={"de": "WLAN: Gast2024"}),
        frage="Wie ist das WLAN?",
        sprache="de",
        status="inquiry",
        heute=date(2026, 8, 29),
    )
    assert any("gesperrt" in w for w in kontext.weggelassen)


def test_hausordnung_ist_kein_zugangsdatum() -> None:
    """Die Sperre trifft NUR Zugangsdaten — nicht die ganze Gästemappe."""
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(rules={"de": "Keine Partys nach 22 Uhr."}),
        frage="Darf ich feiern?",
        sprache="de",
        status="inquiry",
        heute=date(2026, 8, 29),
    )
    assert "Keine Partys" in kontext.text


# --- Inhalt und Herkunft ----------------------------------------------------
def test_richtlinien_kommen_mit_und_zwar_lesbar() -> None:
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(),
        frage="Sind Hunde erlaubt?",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    assert "Haustiere erlaubt: ja" in kontext.text
    assert "Rauchen erlaubt: nein" in kontext.text
    assert "Kostenlos bis 14 Tage vorher." in kontext.text


def test_fakten_der_wissensdatenbank_kommen_mit() -> None:
    db = _FakeDb(
        fakten=[
            {"fact": "Die Sauna läuft von 17 bis 21 Uhr.", "property_id": "p1"},
            {"fact": "Rechnungen kommen per E-Mail.", "property_id": None},
        ]
    )
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(),
        frage="Gibt es eine Sauna?",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    assert "Sauna" in kontext.text
    assert "Wissensdatenbank" in kontext.quellen


def test_quellen_benennen_den_weg() -> None:
    """`sources` ist die einzige Diagnose einer falschen Antwort."""
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(wifi={"de": "WLAN: Gast2024"}),
        frage="Wie ist das WLAN?",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    assert "Objektdaten" in kontext.quellen
    assert any("WLAN" in q for q in kontext.quellen)


def test_ohne_objekt_gibt_es_trotzdem_einen_kontext() -> None:
    """Eine Konversation ohne zugeordnete Unterkunft ist kein Fehlerfall."""
    db = _FakeDb(fakten=[{"fact": "Wir antworten binnen 24 h.", "property_id": None}])
    kontext = kontext_bauen(
        db,
        "t1",
        prop=None,
        frage="Hallo?",
        sprache="de",
        status=None,
        heute=date(2026, 8, 29),
    )
    assert "24 h" in kontext.text


# --- Der Deckel -------------------------------------------------------------
def test_deckel_haelt_und_meldet_was_wegfiel() -> None:
    """Das größte Live-Objekt hat 39.744 Zeichen Gästemappe gegen 24.000 Limit.

    Der Kontext muss unter dem Deckel bleiben UND sagen, was nicht mitkam —
    ein stilles Abschneiden erzeugt eine halbe Antwort, die wie eine ganze
    aussieht (Wurzel 5).
    """
    lang = "Sehr langer Text. " * 3000  # ~54.000 Zeichen
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(
            checkIn={"de": lang},
            rules={"de": lang},
            localGuide={"de": lang},
            directions={"de": lang},
            emergency={"de": lang},
        ),
        frage="Hallo",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    assert kontext.zeichen <= MAX_KONTEXT_ZEICHEN
    assert kontext.weggelassen


def test_langer_abschnitt_verdraengt_die_anderen_nicht() -> None:
    """`localGuide` ist live regelmäßig über 8.000 Zeichen.

    Ohne Abschnittsdeckel bräche er allein den Platz für die sieben anderen.
    """
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(
            localGuide={"de": "Tipp. " * 4000},
            rules={"de": "Keine Partys nach 22 Uhr."},
        ),
        frage="Hallo",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    assert "Keine Partys" in kontext.text


def test_gekuerzter_text_ist_als_gekuerzt_markiert() -> None:
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(rules={"de": "Regel. " * 2000}),
        frage="Welche Regeln gelten?",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    assert "[… gekürzt]" in kontext.text


# --- Verfügbarkeit ----------------------------------------------------------
def test_verfuegbarkeit_kommt_aus_derselben_rechnung_wie_die_portale() -> None:
    """`freie_einheiten_spannen` — keine zweite Zählung (Wurzel 4).

    Eine eigene Rechnung hier hieße: die KI sagt dem Gast etwas anderes, als
    Booking.com anzeigt.
    """
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(),
        frage="Habt ihr im September noch frei?",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    assert "Kalender" in kontext.quellen
    assert "1 Einheit(en) frei" in kontext.text


def test_belegte_tage_erscheinen_nicht_als_frei() -> None:
    belegt = [
        {"date": "2026-09-01", "unit_id": "u1", "status": "booked"},
        {"date": "2026-09-02", "unit_id": "u1", "status": "booked"},
    ]
    db = _FakeDb(belegt=belegt)
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(),
        frage="Habt ihr Anfang September frei?",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    # Die belegte Spanne taucht nicht als „frei" auf; der Satz über die
    # nicht genannten Zeiträume erklärt dem Modell die Lücke.
    assert "2026-09-01 bis 2026-09-02: 1 Einheit(en) frei" not in kontext.text
    assert "sind belegt" in kontext.text


def test_leeres_sprachobjekt_gilt_nicht_als_gepflegt() -> None:
    """Live-Form: `{"da": "", "de": "", "en": ""}` — wahr, aber ohne Text.

    Beim größten Objekt („FeWo *Stjerneskud*") stehen `directions` und
    `localGuide` genau so da. Zählte der Sammler sie als vorhanden, zöge eine
    Frage nach dem Parken den leeren `directions`-Abschnitt auf sich und
    verdrängte einen, der Inhalt hat.
    """
    db = _FakeDb()
    kontext = kontext_bauen(
        db,
        "t1",
        prop=_objekt(
            directions={"da": "", "de": "", "en": ""},
            rules={"de": "Parken auf dem Hof."},
        ),
        frage="Wo kann ich parken?",
        sprache="de",
        status="confirmed",
        heute=date(2026, 8, 29),
    )
    assert not any("Anfahrt" in q for q in kontext.quellen)
    assert "Parken auf dem Hof." in kontext.text
