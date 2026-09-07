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


def _service(reservations=(), availability=(), properties=(), stop_sell=(), **weitere):
    return AuswertungService(
        _DB(
            {
                "reservations": list(reservations),
                "availability": list(availability),
                "properties": list(properties),
                "stop_sell": list(stop_sell),
                # z. B. reservation_addons=[…], owner_expenses=[…]
                **{name: list(rows) for name, rows in weitere.items()},
            }
        )
    )


_OBJ = [{"id": "p1", "title": "Feriehus Line"}]


def _tage(status, anzahl, ab=1, monat="2026-08", pid="p1"):
    """`anzahl` Kalenderzeilen mit fortlaufendem Datum.

    Seit dem Ausbau 05.09.2026 führt der Service die Kalendertage als MENGEN
    (Monats- und Wochentagsberichte schneiden dieselben Tage) — zwei Zeilen
    mit demselben Datum sind EIN Tag. Testzeilen brauchen deshalb ein Datum.
    """
    return [
        {"property_id": pid, "date": f"{monat}-{ab + i:02d}", "status": status}
        for i in range(anzahl)
    ]


def test_gesperrte_tage_fallen_aus_dem_nenner():
    """31 Tage, 10 gesperrt → Nenner 21; davon 7 belegt → 33,33 %.

    Nur `blocked` fällt heraus: dort ist das Objekt NICHT im Verkauf (live
    ausschließlich `contract_end`, also gekündigte Objekte). Freie Tage zählen
    mit, auch die ohne Kalenderzeile — sonst bestrafte eine Lücke in der
    Pflege die Kennzahl in die andere Richtung.
    """
    verf = _tage("blocked", 10, ab=1) + _tage("booked", 7, ab=11) + _tage("open", 14, ab=18)
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
    verf = _tage("booked", 10, ab=1)
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


# ----------------------------------------------------------------------
# Ausbau 05.09.2026 — Finanzfelder, Monat, Wochentag, Muster, Stornos,
# Ausgaben, Pace, Ansichten
# ----------------------------------------------------------------------


def _service_voll(**tabellen):
    """Attrappe mit allen Tabellen, die der ausgebaute Service liest."""
    basis = {
        "reservations": [],
        "availability": [],
        "properties": _OBJ,
        "stop_sell": [],
        "reservation_portal_finanzen": [],
        "reservation_portal_gebuehren": [],
        "reservation_addons": [],
        "owner_expenses": [],
    }
    basis.update(tabellen)
    return AuswertungService(_DB(basis))


def test_finanzfelder_kommen_aus_der_zerlegung_nicht_aus_dem_gesamtpreis():
    """Ohne Zerlegung bleiben die Felder leer — keine Rückrechnung (Wurzel 4)."""
    res = _service_voll(
        reservations=[_buchung(id="r1", total_amount=5000), _buchung(id="r2", total_amount=3000)],
        reservation_portal_finanzen=[
            {
                "reservation_id": "r1", "uebernachtung": 4000, "brutto": 5000,
                "provision": 750, "provision_gemeldet": True, "zahlungsgebuehr": 50,
                "quelle": "ota", "currency": "DKK",
            }
        ],
        reservation_portal_gebuehren=[
            {"reservation_id": "r1", "art": "cleaning_fee", "betrag": 800},
            {"reservation_id": "r1", "art": "linens_bed", "betrag": 200},
        ],
        reservation_addons=[
            # `id` wie in der DB (Primaerschluessel): der Ausgaben-Reiter fuehrt
            # jede Zusatzleistung als eigenen Posten mit ihrer Zeilen-ID.
            {"id": "ad1", "reservation_id": "r1", "price": 100, "qty": 2, "cancelled_at": None},
            {"id": "ad2", "reservation_id": "r1", "price": 999, "qty": 1,
             "cancelled_at": "2026-08-01T10:00:00Z"},
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    z = {b.id: b for b in res.buchungen}
    assert z["r1"].uebernachtung == 4000
    assert z["r1"].reinigung == 800
    assert z["r1"].sonstige_gebuehren == 200
    assert z["r1"].zusatzleistungen == 200, "stornierte Zusatzleistung zählt nicht"
    assert z["r1"].brutto == 5000
    assert z["r1"].provision == 750 and z["r1"].provision_gemeldet is True
    assert z["r1"].netto == 4200  # 5000 − 750 − 50
    assert z["r1"].finanz_quelle == "ota"
    # r2 ohne Zerlegung: NICHTS erfunden.
    assert z["r2"].uebernachtung is None and z["r2"].brutto is None
    assert z["r2"].netto is None and z["r2"].umsatz == 3000
    # Je Objekt: Summe nur aus r1, r2 als fehlend gezählt.
    o = res.objekte_finanzen[0]
    assert o.buchungen == 2 and o.ohne_zerlegung == 1
    assert o.brutto == 5000 and o.netto == 4200


def test_provision_der_buchung_schlaegt_die_rekonstruierte():
    """`ota_commission` (gemeldet) hat Vorrang vor der errechneten Provision."""
    res = _service_voll(
        reservations=[_buchung(id="r1", ota_commission=600)],
        reservation_portal_finanzen=[
            {
                "reservation_id": "r1", "uebernachtung": 4000, "brutto": 4000,
                "provision": 720, "provision_gemeldet": False, "zahlungsgebuehr": 0,
                "quelle": "stammdaten", "currency": "DKK",
            }
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.buchungen[0].provision == 600
    assert res.buchungen[0].netto == 3400


def test_monatszeilen_summieren_sich_zur_objektzeile():
    """Hostaway „By month": dieselben Tage, nur nach Monat geschnitten."""
    verf = _tage("booked", 5, ab=1, monat="2026-08") + _tage("booked", 3, ab=1, monat="2026-09")
    res = _service_voll(
        reservations=[
            _buchung(id="a", check_in="2026-08-01", check_out="2026-08-06", total_amount=5000),
            _buchung(id="b", check_in="2026-09-01", check_out="2026-09-04", total_amount=3000),
        ],
        availability=verf,
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 9, 30))
    monate = {m.monat: m for m in res.objekte_monatlich}
    assert set(monate) == {"2026-08", "2026-09"}
    assert monate["2026-08"].naechte_buchbar == 31 and monate["2026-09"].naechte_buchbar == 30
    assert monate["2026-08"].naechte_gebucht == 5 and monate["2026-09"].naechte_gebucht == 3
    assert monate["2026-08"].umsatz == 5000 and monate["2026-09"].umsatz == 3000
    obj = res.objekte[0]
    assert obj.naechte_gebucht == sum(m.naechte_gebucht for m in res.objekte_monatlich)
    assert obj.umsatz == sum(m.umsatz for m in res.objekte_monatlich)


def test_eigennutzungsnaechte_stehen_als_eigene_spalte():
    res = _service_voll(
        reservations=[
            _buchung(id="e", check_in="2026-08-01", check_out="2026-08-08",
                     total_amount=0, is_owner_stay=True),
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.objekte[0].naechte_eigennutzung == 7
    assert res.objekte_monatlich[0].naechte_eigennutzung == 7


def test_wochentage_verteilen_den_umsatz_auf_die_naechte():
    """Fr 07.08. bis So 09.08.2026: zwei Nächte (Fr, Sa) à 1000."""
    res = _service_voll(
        reservations=[
            _buchung(id="w", check_in="2026-08-07", check_out="2026-08-09", total_amount=2000)
        ],
        availability=[
            {"property_id": "p1", "date": "2026-08-07", "status": "booked"},
            {"property_id": "p1", "date": "2026-08-08", "status": "booked"},
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    wt = {z.wochentag: z for z in res.wochentage}
    assert wt[4].umsatz == 1000 and wt[5].umsatz == 1000   # Fr, Sa
    assert wt[4].adr == 1000 and wt[6].adr is None          # So: keine Nacht
    assert wt[4].anreisen == 1
    # August 2026 hat 4 Freitage → 4 buchbare, 1 gebuchte.
    assert wt[4].naechte_buchbar == 4 and wt[4].naechte_gebucht == 1
    assert wt[4].auslastung_pct == 25.0


def test_buchungsfenster_nur_mit_echtem_buchungszeitpunkt():
    """Ohne `booked_at` kein Eimer — statt eines erfundenen Vorlaufs (Wurzel 5b)."""
    res = _service_voll(
        reservations=[
            _buchung(id="a", check_in="2026-08-10", booked_at="2026-08-08T12:00:00Z"),  # 2 Tage
            _buchung(id="b", check_in="2026-08-10", booked_at="2026-06-01T12:00:00Z"),  # 70 Tage
            _buchung(id="c", check_in="2026-08-10", booked_at=None),
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    eimer = {z.schluessel: z for z in res.buchungsfenster}
    assert eimer["0-3"].buchungen == 1
    assert eimer["61-90"].buchungen == 1
    assert sum(z.buchungen for z in res.buchungsfenster) == 2
    assert eimer["0-3"].anteil_pct == 50.0


def test_aufenthaltsdauer_eimer():
    res = _service_voll(
        reservations=[
            _buchung(id="a", check_in="2026-08-01", check_out="2026-08-02"),   # 1
            _buchung(id="b", check_in="2026-08-01", check_out="2026-08-08"),   # 7
            _buchung(id="c", check_in="2026-08-01", check_out="2026-08-20"),   # 19
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    eimer = {z.schluessel: z.buchungen for z in res.aufenthaltsdauer}
    assert eimer["1"] == 1 and eimer["7"] == 1 and eimer["14+"] == 1


def test_stornobericht_kanal_grund_vorlauf():
    res = _service_voll(
        reservations=[
            _buchung(id="ok"),
            _buchung(id="s1", status="cancelled", channel="airbnb", total_amount=2000,
                     check_in="2026-08-20", cancelled_at="2026-08-15T09:00:00Z",
                     cancel_reason="guest_request"),
            _buchung(id="s2", status="cancelled", channel="airbnb", total_amount=1000,
                     check_in="2026-08-20", cancelled_at=None, cancel_reason=None),
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    s = res.stornos
    assert s.stornos == 2 and s.umsatz_entgangen == 3000
    assert s.stornoquote_pct == 66.67   # 2 von 3
    assert s.mit_zeitpunkt == 1 and s.vorlauf_tage == 5.0
    assert s.kanaele[0].channel == "airbnb" and s.kanaele[0].stornos == 2
    gruende = {g.grund: g.anzahl for g in s.gruende}
    assert gruende == {"guest_request": 1, None: 1}
    vorlauf = {z.schluessel: z.buchungen for z in s.vorlauf}
    assert vorlauf["2-7"] == 1 and sum(vorlauf.values()) == 1


def test_ausgaben_und_extras_nach_richtung_getrennt():
    """Hostaway: Ausgaben = zulasten (`from_owner`), Extras = zugunsten."""
    res = _service_voll(
        owner_expenses=[
            {"id": "x1", "date": "2026-08-03", "concept": "Reinigung", "category": "cleaning",
             "listing_id": "p1", "direction": "from_owner", "amount": 500, "currency": "DKK",
             "storage_path": "belege/x1.pdf"},
            {"id": "x2", "date": "2026-08-05", "concept": "Kaffee", "category": "extras",
             "listing_id": "p1", "direction": "to_owner", "amount": 50, "currency": "DKK"},
            {"id": "x3", "date": "2026-08-09", "concept": "Konto-Gebühr", "category": None,
             "listing_id": None, "direction": "from_owner", "amount": 20, "currency": "DKK"},
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    a = res.ausgaben
    assert a.anzahl == 3 and a.currency == "DKK"
    assert a.ausgaben == 520 and a.extras == 50 and a.saldo == -470
    kat = {k.schluessel: k for k in a.kategorien}
    assert kat["cleaning"].ausgaben == 500 and kat["extras"].extras == 50
    assert kat[None].anzahl == 1, "Posten ohne Kategorie bleibt sichtbar"
    assert a.posten[0].date == "2026-08-09", "neueste zuerst"
    assert {p.id: p.hat_beleg for p in a.posten}["x1"] is True


def test_ausgaben_mehrere_waehrungen_werden_nicht_addiert():
    res = _service_voll(
        owner_expenses=[
            {"id": "x1", "date": "2026-08-03", "concept": "A", "direction": "from_owner",
             "amount": 500, "currency": "DKK"},
            {"id": "x2", "date": "2026-08-03", "concept": "B", "direction": "from_owner",
             "amount": 500, "currency": "EUR"},
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert res.ausgaben.currency is None
    assert res.ausgaben.waehrungen == ["DKK", "EUR"]


def test_verlauf_je_kanal_summiert_sich_zum_gesamtverlauf():
    res = _service_voll(
        reservations=[
            _buchung(id="a", channel="airbnb", total_amount=1000),
            _buchung(id="b", channel="booking", total_amount=3000),
        ],
    ).auswerten(_Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31))
    assert set(res.verlauf_je_kanal) == {"airbnb", "booking"}
    gesamt = sum(p.umsatz for p in res.verlauf)
    je_kanal = sum(p.umsatz for reihe in res.verlauf_je_kanal.values() for p in reihe)
    assert gesamt == je_kanal == 4000
    assert "p1" in res.verlauf_je_objekt


def test_status_filter_wird_durchgereicht():
    """Die Attrappe filtert nicht — geprüft wird, dass der Filter ankommt."""
    gesehen = {}

    class _Q2(_Query):
        def in_(self, feld, werte):
            gesehen[feld] = list(werte)
            return self

    class _DB2(_DB):
        def table(self, name):
            return _Q2(self._tabellen.get(name, []))

    AuswertungService(_DB2({"properties": _OBJ})).auswerten(
        _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31), status=["cancelled"]
    )
    assert gesehen.get("status") == ["cancelled"]


def test_vorzeitraum_ist_schlank_aber_traegt_die_muster():
    res = _service_voll(
        reservations=[_buchung(id="a", check_in="2026-08-10", check_out="2026-08-12")],
    ).auswerten(
        _Ctx(), von=date(2026, 8, 1), bis=date(2026, 8, 31), vergleich=Vergleich.JAHR_1
    )
    assert res.vorher is not None
    assert len(res.vorher.wochentage) == 7
    assert len(res.vorher.aufenthaltsdauer) == 7


# --- Pace -----------------------------------------------------------------


def _db_pace(jetzt, vorjahr):
    """Attrappe, die nach angefragtem Jahr unterscheidet — wie `_db_je_zeitraum`."""

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
            if self._tabelle == "reservations" and feld == "check_in":
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
                rows = rows.get(self._jahr, [])

            class _R:
                data = rows

            return _R()

    class _D:
        def table(self, name):
            return _Q(name, {"properties": _OBJ, "reservations": {2026: jetzt, 2025: vorjahr}})

    return _D()


def test_pace_vergleicht_mit_dem_stichtag_des_vorjahres():
    """Heute 05.09.2026. Für Oktober 2026 sind 4 Nächte gebucht. Im Vorjahr
    waren am 05.09.2025 für Oktober 2025 zwei Nächte gebucht (eine weitere kam
    erst am 20.09.), am Ende wurden es 5."""
    heute = date(2026, 9, 5)
    jetzt = [_buchung(id="j", check_in="2026-10-10", check_out="2026-10-14", total_amount=4000)]
    vorjahr = [
        _buchung(id="v1", check_in="2025-10-03", check_out="2025-10-05", total_amount=2000,
                 booked_at="2025-08-01T10:00:00Z"),
        _buchung(id="v2", check_in="2025-10-20", check_out="2025-10-23", total_amount=3000,
                 booked_at="2025-09-20T10:00:00Z"),
    ]
    res = AuswertungService(_db_pace(jetzt, vorjahr)).pace(_Ctx(), heute=heute)
    assert res.stichtag == "2026-09-05"
    assert len(res.monate) == 12 and res.monate[0].monat == "2026-09"
    okt = next(m for m in res.monate if m.monat == "2026-10")
    assert okt.jetzt_naechte == 4 and okt.jetzt_umsatz == 4000
    assert okt.vorjahr_stichtag_naechte == 2 and okt.vorjahr_stichtag_umsatz == 2000
    assert okt.vorjahr_ende_naechte == 5 and okt.vorjahr_ende_umsatz == 5000
    assert okt.delta_naechte_pct == 100.0
    assert res.vorjahr_ohne_zeitstempel == 0


def test_pace_zaehlt_vorjahresbuchungen_ohne_zeitstempel():
    """Ohne `booked_at` kein Stichtagswert — aber gezählt, nicht verschwiegen."""
    heute = date(2026, 9, 5)
    vorjahr = [_buchung(id="v", check_in="2025-10-03", check_out="2025-10-05", booked_at=None)]
    res = AuswertungService(_db_pace([], vorjahr)).pace(_Ctx(), heute=heute)
    okt = next(m for m in res.monate if m.monat == "2026-10")
    assert okt.vorjahr_stichtag_naechte == 0
    assert okt.vorjahr_ende_naechte == 2
    assert okt.delta_naechte_pct is None
    assert res.vorjahr_ohne_zeitstempel == 1


# --- Ansichten --------------------------------------------------------------


class _AnsichtenDB:
    """Attrappe mit Schreibpfad für `auswertung_ansichten`."""

    def __init__(self):
        self.rows = []
        self.geloescht = []

    def table(self, name):
        assert name == "auswertung_ansichten"
        db = self

        class _Q:
            def __init__(self):
                self._payload = None
                self._modus = "select"
                self._filter = {}

            def select(self, *_a, **_k):
                return self

            def eq(self, feld, wert):
                self._filter[feld] = wert
                return self

            def order(self, *_a, **_k):
                return self

            def range(self, *_a):
                return self

            def insert(self, payload):
                self._modus = "insert"
                self._payload = payload
                return self

            def update(self, payload):
                self._modus = "update"
                self._payload = payload
                return self

            def delete(self):
                self._modus = "delete"
                return self

            def execute(self):
                class _R:
                    data = []

                if self._modus == "insert":
                    row = {
                        "id": f"a{len(db.rows) + 1}",
                        "created_at": "2026-09-05T10:00:00Z",
                        **self._payload,
                    }
                    db.rows.append(row)
                    _R.data = [row]
                elif self._modus == "update":
                    for r in db.rows:
                        if r["id"] == self._filter.get("id"):
                            r.update(self._payload)
                            _R.data = [r]
                elif self._modus == "delete":
                    db.geloescht.append(self._filter)
                    db.rows = [r for r in db.rows if r["id"] != self._filter.get("id")]
                else:
                    _R.data = [
                        r for r in db.rows
                        if all(r.get(k) == v for k, v in self._filter.items())
                    ]
                return _R()

        return _Q()


class _CtxUser:
    tenant_id = "t1"
    user_id = "u1"


def test_ansicht_anlegen_ist_idempotent_und_scopet_auf_den_nutzer():
    from src.features.auswertung.schemas import AnsichtAnlegen

    db = _AnsichtenDB()
    svc = AuswertungService(db)
    a1 = svc.ansicht_anlegen(
        _CtxUser(), AnsichtAnlegen(name="Letzter Monat", reiter="buchungen",
                                   filter={"schnell": "vormonat"}, spalten=["property"])
    )
    a2 = svc.ansicht_anlegen(
        _CtxUser(), AnsichtAnlegen(name="Letzter Monat", reiter="buchungen",
                                   filter={"schnell": "vormonat"}, spalten=["property", "revenue"])
    )
    assert a1.id == a2.id, "gleicher Name im selben Reiter ersetzt statt doppelt"
    assert a2.spalten == ["property", "revenue"]
    assert db.rows[0]["user_id"] == "u1" and db.rows[0]["tenant_id"] == "t1"
    assert len(svc.ansichten(_CtxUser(), "buchungen")) == 1
    svc.ansicht_loeschen(_CtxUser(), a1.id)
    assert db.geloescht[0]["user_id"] == "u1", "Löschen nur im eigenen Scope"
    assert svc.ansichten(_CtxUser()) == []


def test_zusatzleistungen_erscheinen_als_extras():
    """Gebuchte Zusatzleistungen sind Hostaways „Extras" (07.09.2026).

    Bis dahin las der Reiter nur `owner_expenses` — bei AirSmil fehlten drei
    bezahlte Wäschepakete (1.050 DKK) an September-Anreisen, der Reiter stand
    auf „Keine Posten". Währung und Datum kommen von der BUCHUNG (die
    Addon-Zeile trägt keine Währung, Wurzel 4); stornierte Zusatzleistungen
    (0397) sind kein Umsatz.
    """
    res = _service(
        reservations=[
            _buchung(id="a", check_in="2026-09-05", check_out="2026-09-09", currency="DKK"),
            _buchung(id="b", check_in="2026-09-12", check_out="2026-09-14", currency="DKK"),
            _buchung(id="s", check_in="2026-09-20", check_out="2026-09-22", status="cancelled"),
        ],
        properties=_OBJ,
        reservation_addons=[
            {"id": "x1", "reservation_id": "a", "name": {"de": "Wäschepaket", "en": "Linen"},
             "total": "300.00", "cancelled_at": None},
            {"id": "x2", "reservation_id": "b", "name": {"de": "Wäschepaket", "en": "Linen"},
             "total": "150.00", "cancelled_at": None},
            # Storniert → kein Umsatz.
            {"id": "x3", "reservation_id": "b", "name": {"de": "Frühstück"},
             "total": "999.00", "cancelled_at": "2026-09-01T10:00:00+00:00"},
            # Hängt an einer stornierten Buchung → die Buchung ist nicht gültig.
            {"id": "x4", "reservation_id": "s", "name": {"de": "Frühstück"},
             "total": "888.00", "cancelled_at": None},
        ],
    ).auswerten(_Ctx(), von=date(2026, 9, 1), bis=date(2026, 9, 30))
    x = res.ausgaben
    assert x.anzahl == 2
    assert x.extras == 450.0
    assert x.ausgaben == 0.0
    assert x.saldo == 450.0
    assert x.currency == "DKK"
    ids = {p.id: p for p in x.posten}
    assert set(ids) == {"x1", "x2"}
    assert ids["x1"].art == "extra"
    assert ids["x1"].kategorie == "addon"
    assert ids["x1"].currency == "DKK"
    # Datum ist der Bezug der Buchung (Anreise), nicht unsere Uhr (Wurzel 5b).
    assert ids["x1"].date == "2026-09-05"
    assert ids["x1"].property_title == "Feriehus Line"
    assert ids["x1"].name == "Linen"
    assert ids["x1"].name_i18n == {"de": "Wäschepaket", "en": "Linen"}
    # Gruppen führen die Zusatzleistungen unter ihrem Kategorie-Schlüssel.
    assert [g.schluessel for g in x.kategorien] == ["addon"]
    assert x.kategorien[0].extras == 450.0


def test_zusatzleistungen_und_verrechnungsposten_zusammen():
    """Beide Quellen in EINEM Bericht: Ausgabe zulasten, Extra zugunsten."""
    res = _service(
        reservations=[_buchung(id="a", check_in="2026-09-05", currency="DKK")],
        properties=_OBJ,
        owner_expenses=[
            {"id": "e1", "date": "2026-09-03", "concept": "Indflytning-gebyr",
             "category": "Goods", "listing_id": "p1", "reservation_id": None,
             "direction": "from_owner", "amount": "50.00", "currency": "DKK",
             "storage_path": None},
        ],
        reservation_addons=[
            {"id": "x1", "reservation_id": "a", "name": {"en": "Linen"},
             "total": "300.00", "cancelled_at": None},
        ],
    ).auswerten(_Ctx(), von=date(2026, 9, 1), bis=date(2026, 9, 30))
    x = res.ausgaben
    assert x.anzahl == 2
    assert x.ausgaben == 50.0
    assert x.extras == 300.0
    assert x.saldo == 250.0
    # Neueste zuerst — die Anreise (05.) vor dem Posten (03.).
    assert [p.id for p in x.posten] == ["x1", "e1"]
