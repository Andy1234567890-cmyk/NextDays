"""Verfügbarkeits-Formular → Portale, in BEIDE Richtungen.

Der Anlass: von acht Einstellungen des Formulars erreichten nur vier die
Portale. Der Rest lag im jsonb und wurde von niemandem gelesen — die Maske
zeigte trotzdem „Booking.com" darunter. Diese Tests halten fest, dass jeder
Wert ankommt UND dass sein Entfernen ankommt (Wurzel 1).
"""

from __future__ import annotations

from datetime import date

from src.features.channel_manager.airbnb_listing_import import (
    VORLAUF_STUNDEN,
    verfuegbarkeit_uebernehmen,
)
from src.features.channel_manager.airbnb_verfuegbarkeit import (
    _VORLAUF_AUS_OPTION,
    VORLAUF_ZU_OPTION,
    airbnb_settings_aus_formular,
    zusammenfuehren,
)
from src.features.channel_manager.ari_push import AriPushMixin
from src.features.channel_manager.verfuegbarkeit_regeln import (
    Wochentagsregel,
    availability_block,
    availability_geaendert,
    ist_gesperrt,
    max_stay_grundwert,
    min_stay_grundwert,
)


def _zeile(av: dict) -> dict:
    return {"type_attributes": {"availability": av}}


def _je_kanal(wert: object) -> dict:
    """Ein `PerChannel`-Feld, wie die Maske es speichert."""
    return {
        "custom": False,
        "global": wert,
        "channels": {k: wert for k in ("direct", "airbnb", "booking", "google")},
    }


# --- Lesen aus dem Formular -------------------------------------------------


def test_block_fehlt_ist_kein_fehler():
    """Ein Objekt ohne gespeicherte Verfügbarkeit hat keine Regeln — und
    bekommt KEINEN erfundenen Standardwert (Wurzel 4)."""
    assert availability_block({}) == {}
    assert availability_block({"type_attributes": None}) == {}
    assert availability_block({"type_attributes": {"availability": 5}}) == {}


def test_min_stay_nur_sinnvolle_werte():
    assert min_stay_grundwert({"minStay": 3}) == 3
    assert min_stay_grundwert({"minStay": 0}) is None
    assert min_stay_grundwert({"minStay": -2}) is None
    assert min_stay_grundwert({}) is None
    # bool ist in Python ein int — darf nicht als 1 Nacht durchgehen.
    assert min_stay_grundwert({"minStay": True}) is None


def test_max_stay_null_bedeutet_keine_obergrenze():
    """0 ist ein echter Wert, kein „fehlt": das Entfernen der Obergrenze muss
    gepusht werden, sonst bleibt sie bei den Portalen stehen."""
    assert max_stay_grundwert({"maxStay": 30}) == 30
    assert max_stay_grundwert({"maxStay": 0}) == 0
    assert max_stay_grundwert({}) == 0


def test_wochentage_werden_als_menge_gelesen():
    regel = Wochentagsregel({
        "unavailableCheckIn": {"mon": True, "sat": True, "sun": False},
        "unavailableCheckOut": {"fri": True},
    })
    assert regel.anreise == frozenset({"mon", "sat"})
    assert regel.abreise == frozenset({"fri"})
    assert regel.hat_wochentagssperren


def test_wochentag_trifft_das_richtige_datum():
    """2026-08-03 ist ein Montag, 2026-08-08 ein Samstag."""
    montag, samstag = date(2026, 8, 3), date(2026, 8, 8)
    assert montag.weekday() == 0
    assert samstag.weekday() == 5
    gesperrt = frozenset({"mon"})
    assert ist_gesperrt(montag, gesperrt)
    assert not ist_gesperrt(samstag, gesperrt)
    # Leere Menge sperrt nichts.
    assert not ist_gesperrt(montag, frozenset())


def test_regel_aus_zeile():
    regel = Wochentagsregel.aus_zeile(_zeile({"minStay": 2, "maxStay": 14}))
    assert regel.min_stay == 2
    assert regel.max_stay == 14
    assert not regel.hat_wochentagssperren


# --- Änderungserkennung -----------------------------------------------------


def test_geaendert_nur_bei_echter_aenderung():
    alt = {"availability": {"minStay": 2}, "pricing": {"x": 1}}
    # Anderer Bereich geändert → kein Airbnb-Aufruf.
    assert not availability_geaendert(
        alt, {"type_attributes": {"availability": {"minStay": 2},
                                  "pricing": {"x": 9}}}
    )
    # Verfügbarkeit geändert → Aufruf.
    assert availability_geaendert(
        alt, {"type_attributes": {"availability": {"minStay": 3}}}
    )
    # type_attributes gar nicht im Update → nichts zu tun.
    assert not availability_geaendert(alt, {"title": "neu"})
    # Alt-Stand unbekannt → konservativ „geändert".
    assert availability_geaendert(None, {"type_attributes": {"availability": {}}})


# --- Übersetzung zu Airbnb --------------------------------------------------


def test_airbnb_felder_aus_globalem_formular():
    felder = airbnb_settings_aus_formular({
        "preparationDays": {"custom": False, "global": 2, "channels": {}},
        "bookingWindowDays": {"custom": False, "global": 90, "channels": {}},
        "advanceNotice": {"custom": False, "global": "12:00", "channels": {}},
        "minStay": 2,
        "maxStay": 30,
    })
    assert felder == {
        "turnover_days": 2,
        "max_days_notice": 90,
        "booking_lead_time": 12,
        "default_min_nights": 2,
        "default_max_nights": 30,
    }


def test_airbnb_nimmt_den_kanalwert_wenn_custom():
    felder = airbnb_settings_aus_formular({
        "preparationDays": {
            "custom": True, "global": 0,
            "channels": {"airbnb": 1, "booking": 2},
        },
    })
    assert felder == {"turnover_days": 1}


def test_airbnb_verwirft_werte_die_es_dort_nicht_gibt():
    """Airbnb kennt nur feste Stufen. Ein Zwischenwert wird NICHT verbogen —
    lieber der alte Stand als ein stillschweigend geänderter (Wurzel 4)."""
    felder = airbnb_settings_aus_formular({
        # 7 Tage Puffer: Airbnb kennt nur 0|1|2. Stand so bis 06.08.2026 in
        # PREPARATION_OPTIONS und wäre stillschweigend verfallen.
        "preparationDays": {"custom": False, "global": 7, "channels": {}},
        # 730 Tage: Airbnb kennt maximal 365. Ebenfalls eine echte Altoption.
        "bookingWindowDays": {"custom": False, "global": 730, "channels": {}},
        # „18:00" gibt es, „19:30" nicht.
        "advanceNotice": {"custom": False, "global": "19:30", "channels": {}},
    })
    assert felder == {}


def test_airbnb_uebersetzt_alle_vorlauf_optionen():
    """Jede Option der Maske muss eine Airbnb-Entsprechung haben — sonst
    verspricht ein Auswahlfeld etwas, das nirgends ankommt."""
    erwartet = {"00:00": 0, "12:00": 12, "18:00": 18, "24h": 24, "48h": 48,
                "72h": 72, "168h": 168}
    assert erwartet == _VORLAUF_AUS_OPTION
    for option, stunden in erwartet.items():
        felder = airbnb_settings_aus_formular({
            "advanceNotice": {"custom": False, "global": option, "channels": {}},
        })
        assert felder == {"booking_lead_time": stunden}, option


def test_vorlauf_tabellen_sind_exakte_umkehrungen():
    """Hin- und Rückrichtung müssen dieselbe Zuordnung sein.

    Zwei getrennt gepflegte Tabellen driften auseinander, und dann verschiebt
    jeder Import-Export-Rundlauf die Einstellung des Betriebs — ein Fehler, den
    niemand als solchen erkennt, weil das Ergebnis plausibel aussieht.
    """
    for option, stunden in _VORLAUF_AUS_OPTION.items():
        assert VORLAUF_ZU_OPTION[stunden] == option
    assert len(VORLAUF_ZU_OPTION) == len(_VORLAUF_AUS_OPTION)


def test_jede_vorlauf_stufe_ist_bei_airbnb_erlaubt():
    """Keine Option der Maske darf ein Wert sein, den Airbnb ablehnt."""
    for stunden in _VORLAUF_AUS_OPTION.values():
        assert stunden in VORLAUF_STUNDEN


def test_rundlauf_airbnb_formular_airbnb():
    """Airbnbs Stand → unser Formular → zurück: derselbe Wert.

    Deckt die Stufen ab, an denen es real geklemmt hat: 168 h Vorlauf gab es
    bei Airbnb, aber nicht in der Maske — der Wert ging beim Import verloren.
    """
    faelle = [
        {"booking_lead_time": 12, "max_days_notice": 365, "turnover_days": 0,
         "default_min_nights": 2, "default_max_nights": 30},
        {"booking_lead_time": 168, "max_days_notice": 30, "turnover_days": 2,
         "default_min_nights": 1, "default_max_nights": 1125},
        {"booking_lead_time": 0, "max_days_notice": 0, "turnover_days": 1,
         "default_min_nights": 7, "default_max_nights": 14},
    ]
    for hin in faelle:
        spiegel = verfuegbarkeit_uebernehmen({"availability_rules": hin})
        formular = {
            "minStay": spiegel["minNaechte"],
            "maxStay": spiegel["maxNaechte"],
            "bookingWindowDays": _je_kanal(spiegel["vorausbuchungTage"]),
            "advanceNotice": _je_kanal(
                VORLAUF_ZU_OPTION[spiegel["vorlaufStunden"]]
            ),
            "preparationDays": _je_kanal(spiegel["wechseltage"]),
        }
        assert airbnb_settings_aus_formular(formular) == hin


# --- Full-Sync: Vorrang der Quellen -----------------------------------------


def _fullsync_vektor(regel: Wochentagsregel, tag: date, over: dict, flags: dict):
    """Die Vorrang-Logik aus `_full_sync_restriction_rows` (cta/ctd/max_stay).

    Nachgebildet statt aufgerufen: die Methode zieht Preise, Rate-Pläne und vier
    Tabellen aus der DB. Geprüft wird hier genau die Entscheidung, die schon
    einmal falsch war.
    """
    cta = over.get("closed_to_arrival")
    if cta is None:
        cta = bool(flags.get("closed_to_arrival")) or regel.cta(tag)
    ctd = over.get("closed_to_departure")
    if ctd is None:
        ctd = bool(flags.get("closed_to_departure")) or regel.ctd(tag)
    roh_max = over.get("max_stay")
    max_stay = max(0, int(roh_max)) if roh_max is not None else regel.max_stay
    return bool(cta), bool(ctd), max_stay


def test_wochentagsregel_greift_trotz_vorhandener_kalenderzeile():
    """Eine `availability`-Zeile mit false darf die Regel NICHT stumm schalten.

    Die Spalten sind NOT NULL DEFAULT false (live geprüft: 6567 Zeilen, alle
    false). Läse man sie als Übersteuerung, bliebe der gesperrte Samstag bei den
    Portalen offen — der Betrieb sperrt, und nichts passiert.
    """
    regel = Wochentagsregel({"unavailableCheckIn": {"sat": True}})
    samstag = date(2026, 8, 8)
    assert samstag.weekday() == 5
    flags = {"closed_to_arrival": False, "closed_to_departure": False}
    cta, _, _ = _fullsync_vektor(regel, samstag, {}, flags)
    assert cta is True


def test_kalendersperre_bleibt_ohne_wochentagsregel():
    """Umgekehrt: eine echte Kalendersperre gilt auch ohne Formularregel."""
    regel = Wochentagsregel({})
    mittwoch = date(2026, 8, 5)
    cta, _, _ = _fullsync_vektor(
        regel, mittwoch, {}, {"closed_to_arrival": True}
    )
    assert cta is True


def test_plan_override_sticht_die_wochentagsregel():
    """Ein tagesgenauer Override ist die bewusste Ausnahme und gewinnt."""
    regel = Wochentagsregel({"unavailableCheckIn": {"sat": True}, "maxStay": 30})
    samstag = date(2026, 8, 8)
    cta, _, max_stay = _fullsync_vektor(
        regel, samstag, {"closed_to_arrival": False, "max_stay": 7}, {}
    )
    assert cta is False
    assert max_stay == 7


def test_max_stay_faellt_ohne_override_auf_den_formularwert():
    """Der Bug, der den Maximalaufenthalt über Nacht aufhob: der Full-Sync
    setzte `max_stay` stur auf 0, sobald kein Override existierte."""
    regel = Wochentagsregel({"maxStay": 30})
    _, _, max_stay = _fullsync_vektor(regel, date(2026, 8, 5), {}, {})
    assert max_stay == 30


# --- Outbox: die Wochentags-Maske muss die Abdeckung einschränken -----------


def test_outbox_zeile_mit_wochentagsmaske_deckt_nur_diese_tage():
    """Eine Zeile, die nur samstags gilt, deckt nur die Samstage ab.

    Der Wochentags-Push schickt PRO Richtung zwei Zeilen (gesperrte Tage=true,
    freie=false) mit gleichem `kind`, gleichem Zeitraum und ohne Rate-Plan.
    Zählte die zweite Zeile als „deckt alle Tage ab", verwürfe der Cron-Retry
    die erste vollständig (`_superseded_restriction_days`) — und hübe damit die
    gerade gesetzte Sperre wieder auf (Wurzel 1).
    """
    zeile = {
        "kind": "cta_ctd",
        "date_from": "2026-08-03",  # Montag
        "date_to": "2026-08-09",  # Sonntag
        "payload": {"closed_to_arrival": True, "days": ["sa"]},
    }
    tage = AriPushMixin._restriction_row_days(zeile)
    assert tage == {"2026-08-08"}  # nur der Samstag dieser Woche


def test_outbox_zeile_ohne_maske_deckt_den_ganzen_zeitraum():
    zeile = {
        "kind": "cta_ctd",
        "date_from": "2026-08-03",
        "date_to": "2026-08-05",
        "payload": {"closed_to_arrival": False},
    }
    tage = AriPushMixin._restriction_row_days(zeile)
    assert tage == {"2026-08-03", "2026-08-04", "2026-08-05"}


def test_gesperrte_und_freie_tage_ueberschneiden_sich_nicht():
    """Die zwei Zeilen einer Richtung teilen die Woche vollständig auf.

    Zusammen decken sie jeden Tag genau einmal ab: keine Lücke (sonst bliebe
    ein Tag bei den Portalen auf dem alten Stand) und keine Überschneidung
    (sonst verdrängen sie sich gegenseitig).
    """
    zeitraum = {"date_from": "2026-08-03", "date_to": "2026-08-16"}  # 2 Wochen
    gesperrt = AriPushMixin._restriction_row_days({
        "kind": "cta_ctd", **zeitraum,
        "payload": {"closed_to_arrival": True, "days": ["mo", "sa"]},
    })
    frei = AriPushMixin._restriction_row_days({
        "kind": "cta_ctd", **zeitraum,
        "payload": {"closed_to_arrival": False,
                    "days": ["tu", "we", "th", "fr", "su"]},
    })
    assert not (gesperrt & frei)
    assert len(gesperrt) == 4  # 2 Montage + 2 Samstage
    assert len(gesperrt | frei) == 14


def test_zusammenfuehren_erhaelt_fremde_felder():
    """Der PUT ersetzt das ganze Objekt: was wir nicht führen, muss aus dem
    Ist-Stand erhalten bleiben (Wurzel 1)."""
    bestand = {
        "booking_lead_time": 12,
        "max_days_notice": 365,
        "turnover_days": 0,
        "day_of_week_min_nights": [-1] * 7,
        "allow_rtb_above_max_nights": False,
        "id": "abc",
        "type": "airbnb_listing_availability_settings",
    }
    nutzlast = zusammenfuehren(bestand, {"turnover_days": 2})
    assert nutzlast is not None
    assert nutzlast["turnover_days"] == 2
    assert nutzlast["day_of_week_min_nights"] == [-1] * 7
    assert nutzlast["allow_rtb_above_max_nights"] is False
    # Antwort-Metadaten gehören nicht in den Payload.
    assert "id" not in nutzlast
    assert "type" not in nutzlast


def test_zusammenfuehren_schreibt_nicht_ohne_aenderung():
    """Kein Aufruf gegen ein Live-Konto ohne Anlass."""
    bestand = {"turnover_days": 2, "booking_lead_time": 12}
    assert zusammenfuehren(bestand, {"turnover_days": 2}) is None
    assert zusammenfuehren(bestand, {}) is None
