"""Tests der Bewertungs-KI: Katalog, Notenauswahl, Zustell-Rangfolge.

Was hier geprüft wird, ist das, was ohne Test still danebenginge und erst
auffiele, wenn ein falscher Text dauerhaft öffentlich unter einem Inserat
steht:

* **Die Notenauswahl.** Bekäme das Modell bei fünf Sternen auch die Haltung zu
  1-Stern-Bewertungen mit, hätte es zwei widersprüchliche Anweisungen und
  löste den Konflikt selbst auf — der Katalog wäre wirkungslos, ohne dass es
  jemand sähe.
* **Die Zustell-Rangfolge.** Jede Stufe darf nur STRENGER werden. Eine
  Reihenfolge, in der 'automatisch' die Bitte um menschliche Prüfung
  überstimmt, schickt genau die Antwort raus, die niemand ungelesen wollte.
* **Die Markierungszeile wird entfernt.** „[MENSCH PRÜFEN: …]" unter einem
  Portal-Inserat wäre der peinlichste denkbare Ausgang.
* **Die Skalenumrechnung.** Channex liefert 0..10 (Booking) ODER 1..5
  (Airbnb). Wer das verwechselt, beantwortet eine 8/10-Bewertung mit der
  Haltung zu 1-2 Sternen — also eine gute Bewertung mit einer Entschuldigung.
"""
from __future__ import annotations

import pytest

from src.features.reviews.ki_katalog import (
    KATALOG,
    NACH_SCHLUESSEL,
    fragen_fuer,
    ist_lob,
)
from src.features.reviews.ki_lauf import _note_auf_fuenf
from src.features.reviews.ki_store import KiStore
from src.features.reviews.ki_text import (
    FUNKTIONEN,
    Bewertungslage,
    _katalogblock,
    katalog_gepflegt,
    mensch_trennen,
    offene_fragen,
)
from src.features.reviews.schemas import KiRichtung, KiSettings, KiZustellart


# --------------------------------------------------------------- Katalog
def test_katalog_hat_zehn_fragen_mit_eindeutigen_schluesseln() -> None:
    """Zehn Fragen, jede genau einmal.

    Ein doppelter Schlüssel wäre kein Syntaxfehler: die zweite Antwort
    überschriebe still die erste, weil `NACH_SCHLUESSEL` ein dict ist — und
    eine der beiden Haltungen wäre für immer unerreichbar.
    """
    assert len(KATALOG) == 10
    assert len(NACH_SCHLUESSEL) == 10


def test_jede_frage_gilt_fuer_mindestens_eine_richtung() -> None:
    """Eine Frage ohne Richtung stünde im Formular und in keinem Prompt."""
    for frage in KATALOG:
        assert frage.richtungen, frage.schluessel


def test_notenauswahl_trennt_lob_von_kritik() -> None:
    """Bei fünf Sternen darf die Haltung zu 1-2 Sternen NICHT mitgehen.

    Das ist der Kern des Katalogs. Beides zugleich gäbe dem Modell „kurz und
    dankbar" neben „ruhig bleiben, nie zurückschiessen" — und es wählt dann
    selbst, womit die ganze Pflege des Katalogs folgenlos bliebe.
    """
    bei_fuenf = {f.schluessel for f in fragen_fuer("antwort", 5)}
    bei_eins = {f.schluessel for f in fragen_fuer("antwort", 1)}

    assert "lob_5_sterne" in bei_fuenf
    assert "kritik_1_2_sterne" not in bei_fuenf
    assert "kritik_1_2_sterne" in bei_eins
    assert "lob_5_sterne" not in bei_eins


def test_grundhaltung_gilt_bei_jeder_note() -> None:
    """Anrede, Länge, Unterschrift und die Nie-Liste hängen an keiner Note."""
    for note in (1, 2, 3, 4, 5):
        schluessel = {f.schluessel for f in fragen_fuer("antwort", note)}
        assert {"anrede", "laenge_ton", "unterschrift_rolle", "niemals"} <= schluessel


def test_richtung_filtert_fragen() -> None:
    """„Wie geht ihr mit unwahrer Kritik um?" hat beim Bewerten des Gastes
    keinen Adressaten — und umgekehrt."""
    antwort = {f.schluessel for f in fragen_fuer("antwort", None)}
    gast = {f.schluessel for f in fragen_fuer("gast_bewerten", None)}

    assert "unwahre_kritik" in antwort
    assert "unwahre_kritik" not in gast
    assert "gast_bewerten_haltung" in gast
    assert "gast_bewerten_haltung" not in antwort


def test_ohne_note_kommen_alle_fragen_der_richtung() -> None:
    """Das Formular zeigt den ganzen Katalog, nicht eine Notenauswahl."""
    assert len(fragen_fuer("antwort", None)) == len(
        [f for f in KATALOG if "antwort" in f.richtungen]
    )


@pytest.mark.parametrize(("note", "lob"), [(5, True), (4, True), (3, False), (1, False)])
def test_lob_grenze_liegt_bei_vier(note: int, lob: bool) -> None:
    assert ist_lob(note) is lob


def test_ohne_note_kein_lob() -> None:
    """Kein Rateschluss auf einen guten Aufenthalt (Wurzel 4)."""
    assert ist_lob(None) is False


# ----------------------------------------------------------- Katalogblock
def test_katalogblock_laesst_unbeantwortete_fragen_weg() -> None:
    """Eine leere Anweisung ist keine Anweisung.

    Sie als „(keine Angabe)" mitzuschicken machte den Prompt länger und lenkte
    das Modell auf die Lücke statt auf die Haltung.
    """
    block, verwendet = _katalogblock(
        {"anrede": "Wir siezen.", "lob_5_sterne": ""}, "antwort", 5
    )
    assert "Wir siezen." in block
    assert verwendet == ["anrede"]


def test_katalogblock_leer_wenn_nichts_gepflegt() -> None:
    block, verwendet = _katalogblock({}, "antwort", 5)
    assert block == ""
    assert verwendet == []


def test_katalog_gepflegt_ignoriert_leere_antworten() -> None:
    """Ein Katalog aus lauter leeren Strings ist nicht gepflegt — sonst liefe
    die KI an und schriebe beliebigen Text (Wurzel 4)."""
    assert katalog_gepflegt({"anrede": "   "}) is False
    assert katalog_gepflegt({"anrede": "Wir duzen."}) is True


def test_offene_fragen_nennt_die_unbeantworteten() -> None:
    offen = offene_fragen({"anrede": "Wir siezen."})
    assert "anrede" not in offen
    assert "niemals" in offen


# ------------------------------------------------------ Markierungszeile
def test_mensch_pruefen_wird_aus_dem_text_entfernt() -> None:
    """Die Markierung darf NIE im öffentlichen Text landen."""
    text, grund = mensch_trennen(
        "[MENSCH PRÜFEN: Vorwurf des Diebstahls]\nVielen Dank für Ihre Rückmeldung."
    )
    assert text == "Vielen Dank für Ihre Rückmeldung."
    assert grund == "Vorwurf des Diebstahls"


def test_text_ohne_markierung_bleibt_unveraendert() -> None:
    text, grund = mensch_trennen("  Danke für die schöne Bewertung.  ")
    assert text == "Danke für die schöne Bewertung."
    assert grund is None


# --------------------------------------------------- Zustell-Rangfolge
def _settings(**kwargs: object) -> KiSettings:
    basis: dict = {
        "ki_aktiv": True,
        "zustellart_antwort": KiZustellart.automatisch,
        "zustellart_gast_bewerten": KiZustellart.automatisch,
    }
    basis.update(kwargs)
    return KiSettings(**basis)  # type: ignore[arg-type]


def test_grosser_schalter_aus_schlaegt_alles() -> None:
    art, grund = KiStore.zustellart_entscheiden(
        _settings(ki_aktiv=False), "antwort", 5, None
    )
    assert art is KiZustellart.entwurf
    assert grund


def test_bitte_um_menschliche_pruefung_schlaegt_automatisch() -> None:
    """Die wichtigste Stufe: 'automatisch' darf sie NICHT überstimmen.

    Sonst geht genau die Antwort raus, bei der das Modell selbst gesagt hat,
    dass ein Mensch sie lesen sollte.
    """
    art, grund = KiStore.zustellart_entscheiden(
        _settings(), "antwort", 5, "Vorwurf der Körperverletzung"
    )
    assert art is KiZustellart.entwurf
    assert "Körperverletzung" in (grund or "")


def test_schwelle_haelt_schlechte_bewertungen_zurueck() -> None:
    """Unter der Schwelle bleibt die ANTWORT Entwurf, auch bei 'automatisch'."""
    art, grund = KiStore.zustellart_entscheiden(
        _settings(antwort_mensch_ab_note=4), "antwort", 2, None
    )
    assert art is KiZustellart.entwurf
    assert "2" in (grund or "")


def test_ueber_der_schwelle_geht_es_raus() -> None:
    art, grund = KiStore.zustellart_entscheiden(
        _settings(antwort_mensch_ab_note=4), "antwort", 5, None
    )
    assert art is KiZustellart.automatisch
    assert grund is None


def test_schwelle_gilt_nur_fuer_die_antwort_richtung() -> None:
    """Die Schwelle schützt vor einer öffentlichen Antwort auf schlechte
    Kritik. Auf die Bewertung DES GASTES hat sie keinen Bezug — sie dort
    anzuwenden hiesse, einen Gast wegen seiner eigenen schlechten Note nicht
    mehr bewerten zu können."""
    art, _ = KiStore.zustellart_entscheiden(
        _settings(antwort_mensch_ab_note=4), "gast_bewerten", 2, None
    )
    assert art is KiZustellart.automatisch


def test_zustellart_je_richtung_ist_getrennt() -> None:
    """Der Betrieb darf Gastbewertungen laufen lassen und Antworten gegenlesen."""
    s = _settings(
        zustellart_antwort=KiZustellart.entwurf,
        zustellart_gast_bewerten=KiZustellart.automatisch,
    )
    assert (
        KiStore.zustellart_entscheiden(s, "antwort", 5, None)[0]
        is KiZustellart.entwurf
    )
    assert (
        KiStore.zustellart_entscheiden(s, "gast_bewerten", 5, None)[0]
        is KiZustellart.automatisch
    )


def test_vorgabe_ist_entwurf() -> None:
    """Nichts geht ungefragt raus (Wurzel 4)."""
    art, _ = KiStore.zustellart_entscheiden(KiSettings(), "antwort", 5, None)
    assert art is KiZustellart.entwurf


# ------------------------------------------------------ Skalenumrechnung
@pytest.mark.parametrize(
    ("roh", "erwartet"),
    [
        (5, 5),      # Airbnb, 1..5
        (1, 1),
        (10, 5),     # Booking, 0..10
        (8, 4),
        (6, 3),
        (7, 4),      # 3.5 → kaufmännisch auf 4
        (0, None),   # keine Note vergeben
        (None, None),
        ("", None),
        ("abc", None),
    ],
)
def test_note_auf_fuenf(roh: object, erwartet: int | None) -> None:
    """Ein Wert über 5 kann nur die Zehnerskala sein; darunter ist die
    Zuordnung eindeutig. Fehlt der Wert, gibt es KEINE Note — kein geratener
    Skalenfaktor (Wurzel 4)."""
    assert _note_auf_fuenf(roh) == erwartet


# ------------------------------------------------------------- Abrechnung
def test_beide_richtungen_haben_eigene_funktionsnamen() -> None:
    """Getrennte Namen, sonst liesse sich nicht sagen, welche Richtung den
    Tagesdeckel gesprengt hat. Sie MÜSSEN im DB-CHECK (0549) und in
    `site_config.ki_nutzung.FUNKTIONEN` stehen — fehlt einer, steigt das
    Buchen still aus und der Deckel wird zur Attrappe."""
    from src.features.site_config.ki_nutzung import FUNKTIONEN as ERLAUBT

    assert FUNKTIONEN[KiRichtung.antwort.value] != FUNKTIONEN[
        KiRichtung.gast_bewerten.value
    ]
    for name in FUNKTIONEN.values():
        assert name in ERLAUBT, name


def test_lage_traegt_die_richtung() -> None:
    lage = Bewertungslage(richtung=KiRichtung.antwort.value, note=5)
    assert lage.richtung == "antwort"
    assert lage.gast_text is None


# ------------------------------------------------------- Routen-Reihenfolge
def test_feste_pfade_stehen_vor_den_platzhaltern() -> None:
    """`/{source}/{review_id}` darf `/ki/…` NICHT abfangen.

    FastAPI nimmt die ERSTE passende Route. Stünde `/{source}/{review_id}`
    vorher, passte sie auch auf `/ki/katalog`: „ki" landet als `source`, das
    Enum lehnt es ab, und der Aufruf endet als 422 statt beim richtigen
    Endpunkt.

    Live passiert (04.09.2026): die ganze KI-Seite bekam nur
    `validation_error felder=['path.source']` — der Fehler zeigt dabei auf ein
    Feld, das der Aufrufer nie gesendet hat, und sieht deshalb wie ein
    Client-Fehler aus. Ohne diesen Test kehrt er beim nächsten festen Pfad
    unter /reviews wieder.
    """
    from src.features.reviews.router import router

    pfade = [getattr(r, "path", "") for r in router.routes]
    platzhalter = min(
        (i for i, p in enumerate(pfade) if p.startswith("/reviews/{source}")),
        default=len(pfade),
    )
    zu_spaet = [
        p
        for i, p in enumerate(pfade)
        if i > platzhalter and "{" not in p.removeprefix("/reviews/").split("/")[0]
    ]
    assert not zu_spaet, (
        "Diese festen Pfade stehen HINTER /{source}/… und werden von ihr "
        f"abgefangen: {zu_spaet}"
    )
