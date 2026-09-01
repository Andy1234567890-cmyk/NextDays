"""Tests für die Sicherheitseinlage (0473).

WOFÜR SIE DA IST: Am 25.08.2026 wurde Buchung 6179a5d0 storniert, während die
150,00 DKK des Gastes für das „Wäschepaket" längst ausgezahlt waren
(``available`` 0 DKK, Rhythmus `daily`). Es gab keine Deckung für die
Erstattung — und weil ``controller.losses.payments = application`` gilt, wäre
das Minus unser Verlust gewesen.

Die Einlage hält genau das noch erstattbare Volumen im Saldo zurück. Diese Tests
halten die vier Entscheidungen fest, an denen sie sonst still versagt:
Storniertes ohne Frist, abgelaufene Karenz, Währungstrennung, fehlende Daten.
"""
from __future__ import annotations

from datetime import date

from src.features.payouts import sicherheitseinlage as se
from src.features.payouts.stripe_saldo import _ist_faellig

from .test_stripe_saldo import _DB

HEUTE = date(2026, 8, 25)


def _db(**over: list[dict]) -> _DB:
    tabellen: dict[str, list[dict]] = {
        "payout_settings": [{"tenant_id": "t1", "karenz_tage": 3,
                             "einlage_aktiv": True}],
        "addon_payment_links": [],
        "reservation_charge_links": [],
        "reservations": [],
    }
    tabellen.update(over)
    db = _DB([])
    db.tables = tabellen
    return db


def _link(**over: object) -> dict:
    zeile = {
        "id": "link-1",
        "tenant_id": "t1",
        "reservation_id": "res-1",
        "currency": "DKK",
        "amount_cents": 15000,
        "refunded_cents": 0,
        "status": "paid",
    }
    zeile.update(over)
    return zeile


def _res(**over: object) -> dict:
    zeile = {
        "id": "res-1",
        "tenant_id": "t1",
        "status": "confirmed",
        "check_out": "2026-08-28",
    }
    zeile.update(over)
    return zeile


# --- Was zurückgehalten wird -------------------------------------------------

def test_stornierte_buchung_bleibt_unbefristet_gedeckt() -> None:
    """Der Live-Fall: storniert, nicht erstattet → Deckung, ohne Frist.

    Die Abreise lag nur drei Tage in der Zukunft. Eine reine Karenzregel hätte
    die Deckung wenige Tage später freigegeben — in genau dem Fall, für den sie
    gebaut wurde.
    """
    db = _db(
        addon_payment_links=[_link()],
        reservations=[_res(status="cancelled", check_out="2020-01-05")],
    )
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 15000}


def test_laufender_aufenthalt_ist_gedeckt() -> None:
    db = _db(addon_payment_links=[_link()], reservations=[_res()])
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 15000}


def test_abgereist_plus_karenz_wird_frei() -> None:
    """Abreise 21.08. + 3 Tage Karenz → am 25.08. nicht mehr gedeckt."""
    db = _db(
        addon_payment_links=[_link()],
        reservations=[_res(check_out="2026-08-21")],
    )
    assert se.berechne(db, "t1", heute=HEUTE) == {}


def test_abreise_genau_auf_der_frist_bleibt_gedeckt() -> None:
    """Grenzfall: `check_out == heute − karenz` zählt noch (>=, nicht >)."""
    db = _db(
        addon_payment_links=[_link()],
        reservations=[_res(check_out="2026-08-22")],
    )
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 15000}


def test_erstatteter_anteil_zaehlt_nicht_mehr() -> None:
    db = _db(
        addon_payment_links=[
            _link(refunded_cents=5000, status="partially_refunded")
        ],
        reservations=[_res()],
    )
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 10000}


def test_nachberechnung_zaehlt_mit() -> None:
    """Dieselbe Lücke, derselbe Schutz — Zusatzleistung UND Nachberechnung."""
    db = _db(
        addon_payment_links=[_link()],
        reservation_charge_links=[_link(id="cl-1", amount_cents=20000)],
        reservations=[_res()],
    )
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 35000}


def test_waehrungen_bleiben_getrennt() -> None:
    """Eine Summe über zwei Währungen würde die falsche Auszahlung kürzen."""
    db = _db(
        addon_payment_links=[
            _link(),
            _link(id="link-2", reservation_id="res-2", currency="EUR",
                  amount_cents=4000),
        ],
        reservations=[_res(), _res(id="res-2")],
    )
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 15000, "eur": 4000}


def test_waehrung_wird_kleingeschrieben() -> None:
    """Stripe führt Währungen klein — ohne Normalisierung träfe kein Vergleich."""
    db = _db(
        addon_payment_links=[_link(currency="DKK")], reservations=[_res()]
    )
    assert list(se.berechne(db, "t1", heute=HEUTE)) == ["dkk"]


def test_offener_link_zaehlt_nicht_es_ist_kein_geld_da() -> None:
    db = _db(addon_payment_links=[_link(status="open")], reservations=[_res()])
    assert se.berechne(db, "t1", heute=HEUTE) == {}


# --- Fail-closed -------------------------------------------------------------

def test_fehlendes_abreisedatum_haelt_zurueck() -> None:
    """Wurzel 4: Ohne Datum wird kein Fristablauf geraten."""
    db = _db(
        addon_payment_links=[_link()], reservations=[_res(check_out=None)]
    )
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 15000}


def test_unauffindbare_buchung_haelt_zurueck() -> None:
    """Kein Zugriff auf die Buchung → Geld bleibt gebunden, nicht freigegeben."""
    db = _db(addon_payment_links=[_link()], reservations=[])
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 15000}


def test_fehlende_einstellung_bedeutet_schutz_an() -> None:
    db = _db(payout_settings=[], addon_payment_links=[_link()],
             reservations=[_res()])
    assert se.ist_aktiv(db, "t1") is True
    assert se.berechne(db, "t1", heute=HEUTE) == {"dkk": 15000}


def test_abgeschaltet_haelt_nichts_zurueck() -> None:
    db = _db(
        payout_settings=[
            {"tenant_id": "t1", "karenz_tage": 3, "einlage_aktiv": False}
        ],
        addon_payment_links=[_link()],
        reservations=[_res()],
    )
    assert se.berechne(db, "t1", heute=HEUTE) == {}


# --- Auszahlbar --------------------------------------------------------------

def test_auszahlbar_ist_saldo_minus_einlage() -> None:
    """`heute=HEUTE` ist hier PFLICHT, nicht Kosmetik.

    Bis zum 01.09.2026 stand hier kein Stichtag — und `auszahlbar` nahm auch
    keinen an, obwohl `berechne` ihn längst kennt. Der Test lief damit gegen
    das ECHTE Datum und war grün, solange dieses vor dem Ende der Karenz lag
    (Abreise 28.08. + 3 Tage, also bis zum 30.08.2026). Am 31.08. wurde er
    rot, ohne dass jemand etwas geändert hatte — die CI meldete einen Fehler
    in der Auszahlungslogik, die in Wahrheit korrekt war.
    """
    db = _db(addon_payment_links=[_link()], reservations=[_res()])
    assert se.auszahlbar(
        db, "t1", verfuegbar={"dkk": 50000}, heute=HEUTE
    ) == {"dkk": 35000}


def test_auszahlbar_wird_nie_negativ() -> None:
    """Unterdeckung (Auszahlung lief vor Einführung der Einlage) → 0, nicht < 0."""
    db = _db(addon_payment_links=[_link()], reservations=[_res()])
    assert se.auszahlbar(
        db, "t1", verfuegbar={"dkk": 5000}, heute=HEUTE
    ) == {"dkk": 0}


def test_auszahlbar_reicht_den_stichtag_wirklich_durch() -> None:
    """Der Wächter gegen die Rückkehr.

    Ohne Durchreichen liefert `auszahlbar` mit JEDEM Stichtag dasselbe — der
    Parameter wäre eine Attrappe, und die Zeitbombe käme mit dem nächsten
    Datum zurück. Zwei Stichtage, zwei Ergebnisse: vor Ablauf der Karenz wird
    zurückgehalten, danach nicht mehr.
    """
    db = _db(addon_payment_links=[_link()], reservations=[_res()])
    # 25.08.: Abreise (28.08.) noch nicht einmal erreicht → volle Einlage.
    vorher = se.auszahlbar(db, "t1", verfuegbar={"dkk": 50000}, heute=HEUTE)
    # 05.09.: Abreise + 3 Tage Karenz längst vorbei → nichts zurückgehalten.
    nachher = se.auszahlbar(
        db, "t1", verfuegbar={"dkk": 50000}, heute=date(2026, 9, 5)
    )
    assert vorher == {"dkk": 35000}
    assert nachher == {"dkk": 50000}
    assert vorher != nachher


# --- Freigabedatum -----------------------------------------------------------

def test_freigabe_ist_abreise_plus_karenz_plus_eins() -> None:
    db = _db(addon_payment_links=[_link()], reservations=[_res()])
    assert se.naechste_freigabe(db, "t1", heute=HEUTE) == "2026-09-01"


def test_storniertes_hat_kein_freigabedatum() -> None:
    """Es wird nicht von selbst frei — es muss erstattet werden."""
    db = _db(
        addon_payment_links=[_link()],
        reservations=[_res(status="cancelled")],
    )
    assert se.naechste_freigabe(db, "t1", heute=HEUTE) is None


# --- Fälligkeit des Auszahlungslaufs -----------------------------------------

def test_taeglich_ist_immer_faellig() -> None:
    assert _ist_faellig("daily", None, None, HEUTE) is True


def test_woechentlich_nur_am_anker() -> None:
    # 25.08.2026 ist ein Dienstag.
    assert _ist_faellig("weekly", "tuesday", None, HEUTE) is True
    assert _ist_faellig("weekly", "thursday", None, HEUTE) is False


def test_woechentlich_ohne_anker_zahlt_nicht_aus() -> None:
    """Wurzel 4: kein geratener Wochentag für eine Geldbewegung."""
    assert _ist_faellig("weekly", None, None, HEUTE) is False


def test_monatlich_am_gewaehlten_tag() -> None:
    assert _ist_faellig("monthly", None, 25, HEUTE) is True
    assert _ist_faellig("monthly", None, 15, HEUTE) is False


def test_monatlich_31_faellt_im_kurzen_monat_auf_den_letzten() -> None:
    """Sonst fiele die Auszahlung in kurzen Monaten ersatzlos aus."""
    assert _ist_faellig("monthly", None, 31, date(2026, 2, 28)) is True
    assert _ist_faellig("monthly", None, 31, date(2026, 2, 27)) is False


def test_manual_ist_nie_faellig() -> None:
    assert _ist_faellig("manual", None, None, HEUTE) is False


# --- Offene Forderungen: Abgleich mit Stripe (0473) ---------------------------
#
# Live am 25.08.2026 zeigte /konto/abrechnung „Wäschepaket · 20.8.2026 · Offen ·
# 150,00 DKK", während der Gast diesen Link am 20.08. um 15:54 bezahlt hatte.
# Die Liste las nur unsere DB — und die wusste nichts, weil der Connect-Webhook
# `checkout.session.completed` nie abonniert war.

def test_bezahlter_link_verschwindet_aus_den_offenen_forderungen() -> None:
    import pytest as _pytest

    from src.features.addons import zahlung as z
    from src.features.payouts.stripe_saldo import StripeSaldoService

    db = _DB([{"tenant_id": "t1", "stripe_account_id": "acct_1"}])
    db.tables.update(
        {
            "addon_payment_links": [
                {
                    "id": "link-1",
                    "tenant_id": "t1",
                    "reservation_id": "res-1",
                    "stripe_account_id": "acct_1",
                    "stripe_payment_link_id": "plink_1",
                    "currency": "DKK",
                    "amount_cents": 15000,
                    "url": "https://buy.stripe.com/x",
                    "status": "open",
                    "created_at": "2026-08-20T15:03:29+00:00",
                    "refunded_cents": 0,
                },
                {
                    "id": "link-2",
                    "tenant_id": "t1",
                    "reservation_id": "res-2",
                    "stripe_account_id": "acct_1",
                    "stripe_payment_link_id": "plink_2",
                    "currency": "DKK",
                    "amount_cents": 45000,
                    "url": "https://buy.stripe.com/y",
                    "status": "open",
                    "created_at": "2026-08-24T06:56:47+00:00",
                    "refunded_cents": 0,
                },
            ],
            "addon_payment_link_items": [],
            "reservation_addons": [],
            "payments": [],
        }
    )
    with _pytest.MonkeyPatch.context() as mp:
        # plink_1 ist bezahlt, plink_2 nicht — genau der Live-Stand.
        mp.setattr(
            z.sc,
            "find_paid_session",
            lambda lid, **_k: (
                {
                    "id": "cs_1",
                    "payment_intent": "pi_1",
                    "amount_total": 15000,
                    "created": 1787241299,
                }
                if lid == "plink_1"
                else None
            ),
        )
        offen = StripeSaldoService(db)._offene_posten("t1")
    assert [p.id for p in offen] == ["link-2"]
    # Und der bezahlte ist jetzt verbucht — mit dem Zeitpunkt aus Stripe.
    link = next(
        z for z in db.tables["addon_payment_links"] if z["id"] == "link-1"
    )
    assert link["status"] == "paid"
    assert link["paid_at"].startswith("2026-08-20T15:54:59")
    assert len(db.tables["payments"]) == 1


def test_stripe_stoerung_laesst_den_posten_offen_stehen() -> None:
    """Kein 502 auf der ganzen Seite: der Betrieb muss sein Guthaben sehen."""
    import pytest as _pytest

    from src.features.addons import zahlung as z
    from src.features.payouts.stripe_saldo import StripeSaldoService

    db = _DB([{"tenant_id": "t1", "stripe_account_id": "acct_1"}])
    db.tables.update(
        {
            "addon_payment_links": [
                {
                    "id": "link-1",
                    "tenant_id": "t1",
                    "reservation_id": "res-1",
                    "stripe_account_id": "acct_1",
                    "stripe_payment_link_id": "plink_1",
                    "currency": "DKK",
                    "amount_cents": 15000,
                    "url": "https://buy.stripe.com/x",
                    "status": "open",
                    "created_at": "2026-08-20T15:03:29+00:00",
                    "refunded_cents": 0,
                }
            ],
            "addon_payment_link_items": [],
        }
    )

    def _kaputt(*_a: object, **_k: object) -> None:
        raise RuntimeError("Stripe weg")

    with _pytest.MonkeyPatch.context() as mp:
        mp.setattr(z.sc, "find_paid_session", _kaputt)
        offen = StripeSaldoService(db)._offene_posten("t1")
    assert [p.id for p in offen] == ["link-1"]
