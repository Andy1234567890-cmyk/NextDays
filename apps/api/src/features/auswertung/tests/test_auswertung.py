"""Tests der Auswertung — die Rechenwege, nicht die Attrappe.

Geprüft wird, was fachlich schiefgehen KANN und keine DB erzwingt:

* der Nenner der Auslastung (buchbar, nicht alle Tage) — die Entscheidung
  gegen Hostaway und für Guesty,
* dass ein fehlender Nenner `None` ergibt und nicht 0.0 (Wurzel 4),
* dass Provision nur erscheint, wo das Portal sie liefert — keine Schätzung,
* dass `booked_at` fehlen darf, ohne den Vorlauf zu verfälschen (Wurzel 5b),
* dass gemischte Währungen NICHT addiert werden (Wurzel 4),
* dass Stornos aus Umsatz und Nächten fallen, aber die Quote tragen,
* und die vier Bezugszeitpunkte.
"""
from datetime import date

from src.core.zeitraum import jahre_datumsgleich
from src.features.auswertung.schemas import Bezug, Vergleich
from src.features.auswertung.service import (
    AuswertungService,
    _naechte,
    _quote,
    _teil,
)

# ----------------------------------------------------------------------
# Reine Rechenhelfer
# ----------------------------------------------------------------------


def test_naechte_zaehlt_uebernachtungen_nicht_tage():
    # 1.–3. sind ZWEI Nächte, nicht drei Tage.
    assert _naechte("2026-08-01", "2026-08-03") == 2


def test_naechte_bei_muell_ist_null_kein_absturz():
    assert _naechte("kein datum", "2026-08-03") == 0
    assert _naechte(None, None) == 0


def test_naechte_negativ_wird_null():
    # Abreise vor Anreise ist ein Datenfehler, aber kein Grund für -3 Nächte.
    assert _naechte("2026-08-10", "2026-08-07") == 0


def test_quote_ohne_nenner_ist_none_nicht_null():
    # DER Wurzel-4-Fall: „keine Grundlage" ist nicht „0 %".
    assert _quote(5, 0) is None
    assert _quote(5, 10) == 50.0


def test_teil_ohne_nenner_ist_none():
    assert _teil(100, 0) is None
    assert _teil(100, 4) == 25.0


# ----------------------------------------------------------------------
# Die Auslastung — der Nenner
# ----------------------------------------------------------------------


class _DB:
    """Nur die Aufrufe, die der Service wirklich macht."""

    def __init__(self, tabellen):
        self._tabellen = tabellen

    def table(self, name):
        return _Query(self._tabellen.get(name, []))


class _Query:
    def __init__(self, rows):
        self._rows = list(rows)

    # Alle Filter geben self zurück: die Attrappe filtert NICHT nach, sondern
    # liefert die vorbereiteten Zeilen. Was PostgREST filtert, ist nicht das,
    # was hier bewiesen werden soll.
    def select(self, *_a, **_k):
        return self

    def eq(self, *_a):
        return self

    def is_(self, *_a):
        return self

    def gte(self, *_a):
        return self

    def lte(self, *_a):
        return self

    def lt(self, *_a):
        return self

    def gt(self, *_a):
        return self

    def in_(self, *_a):
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, *_a):
        return self

    def limit(self, *_a):
        return self

    def execute(self):
        class _R:
            data = self._rows

        return _R()


class _Ctx:
    tenant_id = "t1"


def _service(reservations=(), availability=(), properties=(), stop_sell=()):
    return AuswertungService(
        _DB(
            {
                "reservations": list(reservations),
                "availability": list(availability),
                "properties": list(properties),
                "stop_sell": list(stop_sell),
            }
        )
    )


_OBJ = [{"id": "p1", "title": "Feriehus Line"}]


def test_gesperrte_tage_fallen_aus_dem_nenner():
    """31 Tage, 10 gesperrt → Nenner 21; davon 7 belegt → 33,33 %.

    Nur `blocked` fällt heraus: dort ist das Objekt NICHT im Verkauf (live
    ausschließlich `contract_end`, also gekündigte Objekte). Freie Tage zählen
    mit, auch die ohne Kalenderzeile — sonst bestrafte eine Lücke in der
    Pflege die Kennzahl in die andere Richtung.
    """
    verf = (
        [{"property_id": "p1", "status": "blocked"}] * 10
        + [{"property_id": "p1", "status": "booked"}] * 7
        + [{"property_id": "p1", "status": "open"}] * 14
    )
    res = _service(availability=verf, properties=_OBJ).auswerten(
        _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31)
    )
    assert res.kennzahlen.naechte_buchbar == 21   # 31 − 10 gesperrt
    assert res.kennzahlen.auslastung_pct == 33.33


def test_stop_sell_faellt_aus_dem_nenner():
    """Stop-Sell ist etwas Drittes: weder belegt noch verkaufbar.

    Er steht in einer EIGENEN Tabelle (`stop_sell`, 0145), nicht in
    `availability`. Ihn im Nenner zu lassen bestrafte den Betrieb für eine
    Sperre, die er selbst gesetzt hat.
    """
    res = _service(
        stop_sell=[
            {"property_id": "p1", "date": "2026-08-05", "scope": "all"},
            {"property_id": "p1", "date": "2026-08-06", "scope": "all"},
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.objekte[0].naechte_stop_sell == 2
    assert res.kennzahlen.naechte_buchbar == 29  # 31 − 2


def test_stop_sell_auf_belegtem_tag_zieht_nicht_doppelt_ab():
    """Live liegen 7 von 23 Sperren auf ohnehin belegten Tagen.

    Beide Abzüge angewandt, schrumpfte der Nenner doppelt und die Auslastung
    stiege künstlich — der Tag war ja nur EINMAL nicht frei.
    """
    res = _service(
        availability=[
            {"property_id": "p1", "date": "2026-08-05", "status": "booked"}
        ],
        stop_sell=[{"property_id": "p1", "date": "2026-08-05", "scope": "all"}],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.objekte[0].naechte_stop_sell == 0, "der Tag zählt als belegt"
    assert res.kennzahlen.naechte_buchbar == 31, "kein zweiter Abzug"
    assert res.kennzahlen.auslastung_pct == 3.23  # 1 von 31


def test_stop_sell_fuer_einzelne_kanaele_bleibt_im_nenner():
    """`scope != 'all'` lässt die anderen Verkaufswege offen."""
    res = _service(
        stop_sell=[{"property_id": "p1", "date": "2026-08-05", "scope": "ota"}],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.objekte[0].naechte_stop_sell == 0
    assert res.kennzahlen.naechte_buchbar == 31


def test_eigennutzung_zaehlt_als_belegt():
    """Belegt ist belegt — egal ob OTA, Website oder Eigentümer.

    Der Betreiber am 30.08.2026: „Wenn ein Haus belegt ist, egal ob OTA oder
    Eigentümer … ist es nicht frei." Eigennutzung steht als `booked` im
    Kalender (live `source='direct'`, 74 Tage) und zählt für die Auslastung
    mit — in den GELD-Kennzahlen bleibt sie draußen.
    """
    verf = [{"property_id": "p1", "status": "booked"}] * 10
    res = _service(
        reservations=[
            _buchung(
                check_in="2026-08-01",
                check_out="2026-08-11",
                total_amount=0,
                is_owner_stay=True,
            )
        ],
        availability=verf,
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.kennzahlen.auslastung_pct == 32.26   # 10 von 31
    assert res.kennzahlen.buchungen == 0, "kein Verkauf"
    assert res.kennzahlen.naechte == 0, "keine verkauften Nächte"


def test_ohne_kalenderzeilen_zaehlt_die_spanne_trotzdem():
    """Ein Tag ohne Kalendereintrag ist ein FREIER Tag, kein unbekannter.

    Entscheidung des Betreibers (30.08.2026): frei im Kalender = buchbar.
    Live fehlt für 42 von 558 Objekttagen die Zeile; sie wegzulassen ließe die
    Quote zu hoch aussehen (71,2 % statt 65,7 %).
    """
    res = _service(properties=_OBJ).auswerten(
        _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31)
    )
    assert res.kennzahlen.naechte_buchbar == 31, "ein Objekt × 31 Tage"
    assert res.kennzahlen.auslastung_pct == 0.0, "buchbar, aber nichts belegt"
    # Ohne Umsatz weiterhin kein ADR — dort ist der Nenner die gebuchte Nacht.
    assert res.kennzahlen.adr is None


# ----------------------------------------------------------------------
# Geld
# ----------------------------------------------------------------------


def _buchung(**over):
    basis = {
        "id": "r1",
        "property_id": "p1",
        "guest_id": "g1",
        "channel": "booking",
        "ota_name": None,
        "check_in": "2026-08-10",
        "check_out": "2026-08-14",
        "status": "confirmed",
        "total_amount": 4000,
        "currency": "DKK",
        "num_guests": 2,
        "ota_commission": None,
        "booked_at": None,
        "is_owner_stay": False,
        "guest_country": "DK",
    }
    basis.update(over)
    return basis


def test_gemischte_waehrungen_werden_nicht_addiert():
    """Wurzel 4: zwei Währungen ergeben keine Summe, sondern keine Währung."""
    res = _service(
        reservations=[
            _buchung(id="a", currency="DKK", total_amount=1000),
            _buchung(id="b", currency="EUR", total_amount=1000),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.currency is None
    assert res.waehrungen == ["DKK", "EUR"]
    assert res.kennzahlen.umsatz == 0.0
    assert res.kennzahlen.adr is None


def test_adr_und_revpar_aus_echten_naechten():
    """ADR über gebuchte Nächte, RevPAR über die buchbaren (= Spanne)."""
    res = _service(
        reservations=[_buchung(total_amount=4000)],  # 4 Nächte
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.kennzahlen.naechte == 4
    assert res.kennzahlen.adr == 1000.0            # 4000 / 4 gebuchte Nächte
    assert res.kennzahlen.naechte_buchbar == 31
    assert res.kennzahlen.revpar == 129.03         # 4000 / 31 buchbare


# ----------------------------------------------------------------------
# Kanäle
# ----------------------------------------------------------------------


def test_provision_nur_wo_das_portal_sie_liefert():
    """Keine Schätzung (Wurzel 4).

    Hostaway empfiehlt bei fehlender Booking.com-Provision `Gesamtpreis * 0,15`.
    Ein erfundener Ersatzwert — hier bleibt das Feld leer.
    """
    res = _service(
        reservations=[
            _buchung(id="a", channel="airbnb", ota_commission=300, total_amount=3000),
            _buchung(id="b", channel="booking", ota_commission=None, total_amount=2000),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    kanaele = {k.channel: k for k in res.kanaele}
    assert kanaele["airbnb"].provision == 300.0
    assert kanaele["airbnb"].netto == 2700.0
    assert kanaele["booking"].provision is None
    assert kanaele["booking"].netto is None


def test_gleicher_kanal_verschiedene_schreibweisen_wird_eine_zeile():
    """Airbnb darf nicht zweimal in der Tabelle stehen.

    Live gemessen am 30.08.2026 bei AirSmil: `ota_name` kommt roh aus der
    Quelle und ist NICHT normiert — „Airbnb" 149 ×, „AirBNB" 30 ×,
    „BookingCom" 86 ×, „Booking.com" 18 ×. Nach `ota_name` gruppiert erschien
    derselbe Kanal doppelt, mit geteiltem Umsatz und zwei Prozentanteilen.
    Gruppiert wird deshalb nach `channel` (DB-Enum), der Portalname ist nur
    noch Beschriftung.
    """
    res = _service(
        reservations=[
            _buchung(id="a", channel="airbnb", ota_name="Airbnb", total_amount=1000),
            _buchung(id="b", channel="airbnb", ota_name="AirBNB", total_amount=500),
            _buchung(id="c", channel="airbnb", ota_name="Airbnb", total_amount=500),
            _buchung(id="d", channel="booking", ota_name="BookingCom", total_amount=800),
            _buchung(id="e", channel="booking", ota_name="Booking.com", total_amount=200),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))

    assert len(res.kanaele) == 2, "je Kanal genau eine Zeile"
    nach_kanal = {k.channel: k for k in res.kanaele}
    assert nach_kanal["airbnb"].umsatz == 2000.0
    assert nach_kanal["airbnb"].buchungen == 3
    assert nach_kanal["booking"].umsatz == 1000.0
    # Beschriftung = die HÄUFIGSTE Schreibweise, nicht die erstbeste.
    assert nach_kanal["airbnb"].ota_name == "Airbnb"
    assert nach_kanal["booking"].ota_name == "BookingCom"


def test_kanalanteile_ergeben_hundert_prozent():
    res = _service(
        reservations=[
            _buchung(id="a", channel="airbnb", total_amount=3000),
            _buchung(id="b", channel="booking", total_amount=1000),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert sum(k.anteil_pct for k in res.kanaele) == 100.0
    assert res.kanaele[0].channel == "airbnb"  # nach Umsatz sortiert


# ----------------------------------------------------------------------
# Eigennutzung — kein Vertriebskanal
# ----------------------------------------------------------------------


def test_eigennutzung_ist_eine_eigene_zeile_kein_kanal():
    """„Direkt" und Eigennutzung sind zwei verschiedene Sachverhalte.

    „Direkt" ist eine selbst angelegte Buchung mit echtem Gast und echtem
    Umsatz; Eigennutzung ist der Hauseigentümer im eigenen Objekt. Beide
    tragen `channel='direct'`, dürfen aber nicht in einer Zeile stehen — sonst
    liest sich die Zeile als Kanal, der nichts einbringt.
    """
    res = _service(
        reservations=[
            _buchung(id="a", channel="direct", total_amount=2000),
            _buchung(id="b", channel="direct", total_amount=0, is_owner_stay=True),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))

    nach_kanal = {k.channel: k for k in res.kanaele}
    assert "owner_stay" in nach_kanal, "Eigennutzung braucht eine eigene Zeile"
    assert nach_kanal["direct"].umsatz == 2000.0
    assert nach_kanal["direct"].eigennutzung == 0
    assert nach_kanal["owner_stay"].eigennutzung == 1
    # Kein Verkaufsanteil: die Bezugsgröße sind die echten Kanäle.
    assert nach_kanal["owner_stay"].anteil_pct == 0.0
    assert nach_kanal["direct"].anteil_pct == 100.0
    # Und sie steht zuletzt, nicht oben.
    assert res.kanaele[-1].channel == "owner_stay"


def test_eigennutzung_verdirbt_die_kennzahlen_nicht():
    """0 Umsatz, aber echte Nächte — mitgezählt verdürbe sie ADR und Ø Dauer.

    Live bei AirSmil: 39 Eigennutzungen mit 187 Nächten. Zählte man sie mit,
    fiele der Ø Nachtpreis, weil der Nenner Nächte enthält, für die nie jemand
    gezahlt hat.
    """
    res = _service(
        reservations=[
            # 4 Nächte, 4000 → ADR 1000
            _buchung(id="a", total_amount=4000),
            # 20 Nächte Eigennutzung, 0 DKK
            _buchung(
                id="b",
                check_in="2026-08-01",
                check_out="2026-08-21",
                total_amount=0,
                is_owner_stay=True,
            ),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))

    assert res.kennzahlen.buchungen == 1
    assert res.kennzahlen.naechte == 4, "die 20 Eigennutzungs-Nächte zählen nicht"
    assert res.kennzahlen.adr == 1000.0, "sonst wären es 4000/24 = 166,67"
    assert res.kennzahlen.aufenthalt_schnitt == 4.0


# ----------------------------------------------------------------------
# Stornos
# ----------------------------------------------------------------------


def test_storno_faellt_aus_umsatz_traegt_aber_die_quote():
    res = _service(
        reservations=[
            _buchung(id="a", total_amount=1000),
            _buchung(id="b", total_amount=9999, status="cancelled"),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.kennzahlen.umsatz == 1000.0
    assert res.kennzahlen.buchungen == 1
    assert res.kennzahlen.stornos == 1
    assert res.kennzahlen.stornoquote_pct == 50.0


# ----------------------------------------------------------------------
# Wurzel 5b — fremde Zeitpunkte
# ----------------------------------------------------------------------


def test_vorlauf_ignoriert_buchungen_ohne_echtes_buchungsdatum():
    """`created_at` ist UNSER Eingang, nicht der Buchungszeitpunkt.

    Bei Bestandsimporten liegt er ein Jahr daneben. Eine Buchung ohne echten
    `booked_at` fällt aus dem Mittel, statt es zu verfälschen.
    """
    res = _service(
        reservations=[
            _buchung(id="a", booked_at="2026-08-01T10:00:00+00:00"),  # 9 Tage
            _buchung(id="b", booked_at=None),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.kennzahlen.vorlauf_tage == 9.0


def test_vorlauf_ohne_jedes_buchungsdatum_ist_none():
    res = _service(
        reservations=[_buchung(booked_at=None)], properties=_OBJ
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.kennzahlen.vorlauf_tage is None


def test_buchungszeile_faellt_nicht_auf_unsere_uhr_zurueck():
    res = _service(
        reservations=[_buchung(booked_at=None)], properties=_OBJ
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.buchungen[0].booked_at is None


# ----------------------------------------------------------------------
# Bezugszeitpunkt
# ----------------------------------------------------------------------


def test_alle_vier_bezuege_laufen_durch():
    for bezug in Bezug:
        res = _service(
            reservations=[_buchung(booked_at="2026-08-01T10:00:00+00:00")],
            properties=_OBJ,
        ).auswerten(
            _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31), bezug=bezug
        )
        assert res.bezug is bezug
        assert res.kennzahlen.buchungen == 1


def test_verlauf_gruppiert_ueber_90_tage_nach_monaten():
    """Über 90 Tage Monate, darunter Tage — und die Reihe ist LÜCKENLOS.

    Sie beginnt am Anfang des ZEITRAUMS, nicht beim ersten Buchungstag: eine
    Kategorieachse verteilt ihre Punkte gleich breit, Lücken verzerrten also
    die Zeitachse (siehe `test_verlauf_ist_lueckenlos`).
    """
    res = _service(reservations=[_buchung()], properties=_OBJ).auswerten(
        _Ctx(), von=date(2026, 1, 1), bis=date(2026, 12, 31)
    )
    assert [p.period for p in res.verlauf] == [
        f"2026-{m:02d}" for m in range(1, 13)
    ]
    # Der Umsatz liegt im Monat der Buchung (10.08.), die anderen tragen 0.
    umsaetze = {p.period: p.umsatz for p in res.verlauf}
    assert umsaetze["2026-08"] == 4000
    assert umsaetze["2026-01"] == 0

    res_kurz = _service(reservations=[_buchung()], properties=_OBJ).auswerten(
        _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31)
    )
    assert res_kurz.verlauf[0].period == "2026-08-01"  # Tag, ab Zeitraumbeginn
    assert len(res_kurz.verlauf) == 31


def test_verlauf_ist_lueckenlos():
    """Jeder Tag des Zeitraums bekommt einen Punkt — auch die ohne Buchung.

    DER FEHLER, den das verhindert (gemeldet 03.09.2026, gemessen an der
    Live-DB): Eine Diagramm-Kategorieachse verteilt ihre Punkte GLEICH BREIT.
    Standen nur Tage mit Buchungen darauf, war die Zeitachse verzerrt — im
    Zeitraum 31.08.–29.09.2026 fehlten 12 von 30 Tagen, und der Sprung vom
    20.09. auf den 25.09. (fünf Tage) sah genauso breit aus wie der vom 01.09.
    auf den 02.09. (ein Tag). Die Kurve zeigte einen Verlauf, den es nie gab.
    """
    res = _service(
        reservations=[
            _buchung(id="a", check_in="2026-08-02", check_out="2026-08-04",
                     total_amount=100),
            _buchung(id="b", check_in="2026-08-09", check_out="2026-08-11",
                     total_amount=200),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 10))

    assert [p.period for p in res.verlauf] == [
        f"2026-08-{t:02d}" for t in range(1, 11)
    ]
    werte = {p.period: p.umsatz for p in res.verlauf}
    assert werte["2026-08-02"] == 100
    assert werte["2026-08-09"] == 200
    # Ein Tag ohne Buchung trägt 0.0 — das ist die WAHRE Aussage („an dem Tag
    # kein Umsatz"), keine erfundene.
    assert werte["2026-08-05"] == 0.0
    assert werte["2026-08-05"] == 0


# ----------------------------------------------------------------------
# Gäste
# ----------------------------------------------------------------------


def test_wiederkehrer_ueber_gast_id():
    res = _service(
        reservations=[
            _buchung(id="a", guest_id="g1"),
            _buchung(id="b", guest_id="g1"),
            _buchung(id="c", guest_id="g2"),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.gaeste.wiederkehrer == 1
    assert res.gaeste.wiederkehrer_pct == 50.0  # 1 von 2 Personen


def test_herkunft_ohne_land_faellt_nicht_weg():
    """Ein unbekanntes Land ist eine eigene Zeile, keine stille Lücke."""
    res = _service(
        reservations=[
            _buchung(id="a", guest_country="DK"),
            _buchung(id="b", guest_country=None),
        ],
        properties=_OBJ,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    laender = {h.land for h in res.gaeste.herkunft}
    assert laender == {"DK", None}
    assert sum(h.anteil_pct for h in res.gaeste.herkunft) == 100.0


# ----------------------------------------------------------------------
# Welche Spalten gelesen werden — der Fehler, den die Attrappe NICHT fängt
# ----------------------------------------------------------------------


def test_verfuegbarkeit_filtert_nicht_ueber_tenant_id():
    """`availability` hat KEINE `tenant_id` — sie hängt über `property_id`.

    Live gemessen am 30.08.2026: der erste Wurf filterte `.eq("tenant_id", …)`
    und warf `column availability.tenant_id does not exist` (42703) als HTTP
    500. Die Tests darüber blieben dabei ALLE grün, weil die Attrappe jeden
    Filter durchwinkt — eine Fake-DB nimmt erfundene Spalten an.

    Dieser Test protokolliert deshalb die tatsächlich benutzten Operatoren,
    statt ein Ergebnis zu prüfen: er ist die einzige Stelle, an der ein
    falscher Spaltenname ohne laufende DB auffällt.
    """
    protokoll: list[tuple[str, tuple]] = []

    class _Mitschrift(_Query):
        def eq(self, *a):
            protokoll.append(("eq", a))
            return self

    class _DBMit(_DB):
        def table(self, name):
            protokoll.append(("table", (name,)))
            return _Mitschrift(self._tabellen.get(name, []))

    AuswertungService(_DBMit({"properties": _OBJ})).auswerten(
        _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31)
    )

    nach_availability = False
    for art, args in protokoll:
        if art == "table":
            nach_availability = args[0] == "availability"
        elif nach_availability and art == "eq":
            assert args[0] != "tenant_id", (
                "availability wird über tenant_id gefiltert — diese Spalte "
                "gibt es nicht (42703). Der Scope läuft über property_id."
            )


def test_ohne_objekte_bleibt_der_nenner_null():
    """Ohne erlaubte Objekte gäbe ein leeres `in_` einen tenant-weiten Scan."""
    res = AuswertungService(_DB({})).auswerten(
        _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31)
    )
    assert res.kennzahlen.naechte_buchbar == 0
    assert res.kennzahlen.auslastung_pct is None


# ----------------------------------------------------------------------
# Scope (Wurzel 3)
# ----------------------------------------------------------------------


def test_buchung_eines_fremden_objekts_wird_verworfen():
    """Die Service-Role umgeht RLS — der Objektfilter muss im Code greifen."""
    res = _service(
        reservations=[_buchung(property_id="FREMD")], properties=_OBJ
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.kennzahlen.buchungen == 0
    assert res.buchungen == []


# ----------------------------------------------------------------------
# Vergleich mit dem Vorjahr (1/2/5 Jahre)
# ----------------------------------------------------------------------


def test_jahre_zurueck_ist_datumsgleich():
    """Derselbe Kalendertag, nicht 365 Tage.

    Wie weit 365·n danebenliegt, hängt von den dazwischenliegenden Schaltjahren
    ab (ein bis zwei Tage beim 5-Jahres-Sprung) — gemessen in
    `core/tests/test_zeitraum_jahresvergleich.py`.
    """
    assert jahre_datumsgleich(date(2026, 9, 29), 1) == date(2025, 9, 29)
    assert jahre_datumsgleich(date(2026, 9, 29), 2) == date(2024, 9, 29)
    assert jahre_datumsgleich(date(2026, 9, 29), 5) == date(2021, 9, 29)


def test_jahre_zurueck_schalttag_faellt_auf_28_februar():
    """Den 29.02.2024 gibt es 2023 nicht — er wird der 28.02., nicht der 01.03.

    Der 01.03. läge im nächsten MONAT und damit in einem anderen Balken der
    Zeitreihe; der Vorwert stünde dann im falschen Monatseimer.
    """
    assert jahre_datumsgleich(date(2024, 2, 29), 1) == date(2023, 2, 28)
    assert jahre_datumsgleich(date(2024, 2, 29), 5) == date(2019, 2, 28)
    # Ein Schalttag auf einen anderen Schalttag bleibt der 29.
    assert jahre_datumsgleich(date(2024, 2, 29), 4) == date(2020, 2, 29)


def test_ohne_vergleich_bleibt_vorher_none():
    """`None`, nicht ein leerer Bericht — der behauptete „Vorjahr: alles null"."""
    res = _service(reservations=[_buchung()], properties=_OBJ).auswerten(
        _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31)
    )
    assert res.vorher is None


def _db_je_zeitraum(nach_jahr):
    """Attrappe, die Reservierungen NACH ANGEFRAGTEM ZEITRAUM ausgibt.

    Die übrige Test-Attrappe filtert bewusst nicht — hier ist die Unterscheidung
    aber der Kern: gäbe sie beide Male dieselben Zeilen aus, wäre jeder
    Vergleichstest grün, ohne irgendetwas zu beweisen.
    """

    class _Q:
        def __init__(self, tabelle, tabellen):
            self._tabelle = tabelle
            self._tabellen = tabellen
            self._jahr = None

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a):
            return self

        def is_(self, *_a):
            return self

        def gte(self, feld, wert):
            if self._tabelle == "reservations":
                self._jahr = int(str(wert)[:4])
            return self

        def lte(self, *_a):
            return self

        def lt(self, *_a):
            return self

        def gt(self, *_a):
            return self

        def in_(self, *_a):
            return self

        def order(self, *_a, **_k):
            return self

        def range(self, *_a):
            return self

        def limit(self, *_a):
            return self

        def execute(self):
            rows = self._tabellen.get(self._tabelle, [])
            if self._tabelle == "reservations":
                rows = nach_jahr.get(self._jahr, [])

            class _R:
                data = list(rows)

            return _R()

    class _DBZ:
        def __init__(self, tabellen):
            self._tabellen = tabellen

        def table(self, name):
            return _Q(name, self._tabellen)

    return _DBZ({"properties": _OBJ})


def test_vergleich_rechnet_den_vorzeitraum_getrennt():
    """Der Vorwert stammt aus dem VERSCHOBENEN Zeitraum, nicht aus demselben."""
    db = _db_je_zeitraum(
        {
            2026: [_buchung(id="heute", total_amount=4000)],
            2025: [
                _buchung(id="a", check_in="2025-08-10", check_out="2025-08-14",
                         total_amount=1000),
                _buchung(id="b", check_in="2025-08-20", check_out="2025-08-22",
                         total_amount=500),
            ],
        }
    )
    res = AuswertungService(db).auswerten(
        _Ctx(),
        von=date(2026, 8, 1),
        bis=date(2026, 8, 31),
        vergleich=Vergleich.JAHR_1,
    )
    assert res.kennzahlen.umsatz == 4000
    assert res.kennzahlen.buchungen == 1
    assert res.vorher is not None
    assert res.vorher.von == "2025-08-01"
    assert res.vorher.bis == "2025-08-31"
    assert res.vorher.kennzahlen.umsatz == 1500
    assert res.vorher.kennzahlen.buchungen == 2


def test_vergleich_fuenf_jahre_trifft_das_richtige_jahr():
    db = _db_je_zeitraum(
        {
            2026: [_buchung(total_amount=4000)],
            2021: [
                _buchung(check_in="2021-08-10", check_out="2021-08-12",
                         total_amount=777)
            ],
        }
    )
    res = AuswertungService(db).auswerten(
        _Ctx(),
        von=date(2026, 8, 1),
        bis=date(2026, 8, 31),
        vergleich=Vergleich.JAHR_5,
    )
    assert res.vorher is not None
    assert res.vorher.von == "2021-08-01"
    assert res.vorher.kennzahlen.umsatz == 777


def test_vergleich_ohne_daten_im_vorjahr_ist_nicht_none():
    """Ein Vorjahr OHNE Buchungen ist eine Aussage („damals nichts"), kein Fehler.

    Es darf deshalb nicht mit „kein Vergleich angefordert" zusammenfallen —
    `vorher` steht, die Kennzahlen sind leer, und die Oberfläche kann den
    Unterschied zeigen.
    """
    db = _db_je_zeitraum({2026: [_buchung()], 2024: []})
    res = AuswertungService(db).auswerten(
        _Ctx(),
        von=date(2026, 8, 1),
        bis=date(2026, 8, 31),
        vergleich=Vergleich.JAHR_2,
    )
    assert res.vorher is not None
    assert res.vorher.kennzahlen.buchungen == 0
    assert res.vorher.kennzahlen.umsatz == 0
    # Kein erfundener Nenner: ohne Nächte gibt es keinen Ø Nachtpreis.
    assert res.vorher.kennzahlen.adr is None


def test_vergleich_traegt_keine_buchungsliste():
    """Nur die Summenzeile — die Einzelbuchungen von damals gehören nicht
    in die Tabelle des laufenden Zeitraums."""
    db = _db_je_zeitraum(
        {2026: [_buchung()], 2025: [_buchung(check_in="2025-08-10",
                                             check_out="2025-08-12")]}
    )
    res = AuswertungService(db).auswerten(
        _Ctx(),
        von=date(2026, 8, 1),
        bis=date(2026, 8, 31),
        vergleich=Vergleich.JAHR_1,
    )
    assert res.vorher is not None
    assert res.vorher.buchungen_gesamt == 1
    assert not hasattr(res.vorher, "buchungen")


def test_vergleichsverlauf_traegt_den_partnerschluessel():
    """Jeder Vorjahrespunkt weiß, welchem Punkt der Gegenwart er entspricht.

    DER FEHLER, den das verhindert (gemessen 03.09.2026): `_verlauf` legt nur
    Eimer an, in denen etwas liegt — die beiden Reihen sind also verschieden
    lang. Wer sie über die POSITION verbindet, stellt drei Buchungstage 2026
    zwei Buchungstagen 2025 gegenüber und paart „3. August 2026" mit
    „1. August 2025", „10. August" mit „25. August". Eine Kurve, die plausibel
    aussieht und falsche Tage vergleicht.
    """
    db = _db_je_zeitraum(
        {
            2026: [
                _buchung(id="a", check_in="2026-08-03", check_out="2026-08-05",
                         total_amount=1000),
                _buchung(id="b", check_in="2026-08-10", check_out="2026-08-12",
                         total_amount=2000),
                _buchung(id="c", check_in="2026-08-20", check_out="2026-08-22",
                         total_amount=3000),
            ],
            2025: [
                _buchung(id="x", check_in="2025-08-01", check_out="2025-08-03",
                         total_amount=500),
                _buchung(id="y", check_in="2025-08-25", check_out="2025-08-27",
                         total_amount=900),
            ],
        }
    )
    res = AuswertungService(db).auswerten(
        _Ctx(),
        von=date(2026, 8, 1),
        bis=date(2026, 8, 31),
        vergleich=Vergleich.JAHR_1,
    )
    assert res.vorher is not None
    # Seit die Reihen lückenlos sind, decken sie sich Punkt für Punkt — der
    # Partnerschlüssel bleibt trotzdem nötig: er trägt die Jahresverschiebung
    # („2025-08-01" gehört über „2026-08-01"), und ohne ihn müsste die
    # Oberfläche wieder über die Position paaren.
    assert len(res.verlauf) == 31
    assert len(res.vorher.verlauf) == 31

    paare = {p.period_normal: p.umsatz for p in res.vorher.verlauf}
    assert paare["2026-08-01"] == 500.0
    assert paare["2026-08-25"] == 900.0
    # Ein Tag, an dem im Vorjahr nichts gebucht wurde, trägt 0 — der Punkt
    # existiert, damit die Achse zeitlich stimmt.
    assert paare["2026-08-03"] == 0.0

    # Die Werte der Gegenwart stehen auf ihren EIGENEN Tagen, nicht verschoben.
    jetzt = {p.period: p.umsatz for p in res.verlauf}
    assert jetzt["2026-08-03"] == 1000.0
    assert jetzt["2026-08-10"] == 2000.0
    assert jetzt["2026-08-20"] == 3000.0


def test_vergleichsverlauf_monatsschluessel():
    """Bei Monatsauflösung wird das Jahr im Schlüssel `YYYY-MM` verschoben."""
    db = _db_je_zeitraum(
        {
            2026: [_buchung(check_in="2026-03-10", check_out="2026-03-12")],
            2025: [
                _buchung(id="v", check_in="2025-03-10", check_out="2025-03-12",
                         total_amount=700)
            ],
        }
    )
    res = AuswertungService(db).auswerten(
        _Ctx(),
        # Über 90 Tage → Monatsauflösung.
        von=date(2026, 1, 1),
        bis=date(2026, 12, 31),
        vergleich=Vergleich.JAHR_1,
    )
    assert res.vorher is not None
    # Zwölf Monate, lückenlos — und jeder trägt seinen Partner der Gegenwart.
    assert [p.period for p in res.vorher.verlauf] == [
        f"2025-{m:02d}" for m in range(1, 13)
    ]
    assert [p.period_normal for p in res.vorher.verlauf] == [
        f"2026-{m:02d}" for m in range(1, 13)
    ]
    umsaetze = {p.period_normal: p.umsatz for p in res.vorher.verlauf}
    assert umsaetze["2026-03"] == 700


def test_vergleichsverlauf_teilt_die_aufloesung_des_hauptzeitraums():
    """Beide Reihen tragen dieselbe Einteilung — auch am 90-Tage-Grenzfall.

    01.01.–01.04.2020 sind 91 Tage (monatlich), ein Jahr früher 90 (täglich).
    Ohne Vorgabe bestünde die Vorjahreslinie aus Tageswerten und die Hauptlinie
    aus Monatssummen — auf einer Achse mit derselben Skala.
    """
    db = _db_je_zeitraum(
        {
            2020: [_buchung(check_in="2020-02-10", check_out="2020-02-12")],
            2019: [
                _buchung(id="v", check_in="2019-02-10", check_out="2019-02-12",
                         total_amount=400)
            ],
        }
    )
    res = AuswertungService(db).auswerten(
        _Ctx(),
        von=date(2020, 1, 1),
        bis=date(2020, 4, 1),
        vergleich=Vergleich.JAHR_1,
    )
    assert res.vorher is not None
    # Beide Monatsschlüssel (Länge 7), nicht einer davon ein Tagesschlüssel.
    assert all(len(p.period) == 7 for p in res.verlauf)
    assert all(len(p.period) == 7 for p in res.vorher.verlauf)
