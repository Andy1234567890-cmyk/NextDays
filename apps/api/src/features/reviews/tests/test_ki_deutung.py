"""Tests der KI-Auswertung: Deutung, Themenzählung, Gegenzustand.

Was hier geprüft wird, ist das, was ohne Test still danebenginge:

* **Der geschlossene Katalog hält.** Ein erfundenes Thema darf nicht
  durchrutschen — sonst steht es Wochen später als Zeile in einer Rangliste,
  die niemand erklären kann.
* **Die Antwort des Modells ist nicht vertrauenswürdig.** Code-Zaun, Vorrede,
  kaputtes JSON, unbekannte Stimmung: jeder Fall muss LAUT scheitern und nicht
  eine leere Deutung erfinden (Wurzel 4/5).
* **Der Gegenzustand der Warteschlange.** Wer von Hand bewertet, macht den
  geplanten Eintrag gegenstandslos. Ohne diesen Test kehrt der Fehler zurück,
  bei dem der Betrieb Tage später eine rote Fehlermeldung für etwas bekommt,
  das er richtig gemacht hat (Wurzel 1).
* **Ein Fehler an EINER Bewertung stoppt den Lauf nicht, ein toter Dienst
  schon.** Die Unterscheidung ist der ganze Sinn der zwei Fehlertypen.
"""
from __future__ import annotations

import pytest

from src.core.ki import KiAntwort, KiError
from src.features.reviews.ki_auswertung import _themen_zaehlen, _verlauf
from src.features.reviews.ki_deutung import (
    THEMEN,
    KiDeutungFehler,
    _json_aus_antwort,
    _note_normalisieren,
    _themen_saeubern,
    deuten,
    offene_deuten,
)
from src.features.reviews.queue import ReviewQueue
from src.features.reviews.schemas import AiSentiment, AiThemeKey
from src.features.reviews.service import _to_ai

from .fake_db import FakeDB

TENANT = "t-1"
PROP_A = "p-a"


def _antwort(text: str) -> KiAntwort:
    return KiAntwort(
        text=text,
        modell="gemini-2.5-flash",
        region="europe-west4",
        dauer_ms=120,
        tokens_ein=100,
        tokens_aus=40,
        abschlussgrund="STOP",
    )


class FakeKi:
    """Ein Vertex-Client, der vorgegebene Antworten liefert.

    Absichtlich kein Mock-Framework: die Aufrufliste wird mitgeschrieben,
    damit ein Test auch prüfen kann, wie OFT gerufen wurde — genau das
    unterscheidet „Lauf abgebrochen" von „Lauf durchgelaufen".
    """

    def __init__(self, *antworten: str | Exception) -> None:
        self._antworten = list(antworten)
        self.aufrufe: list[dict] = []

    def erzeuge(self, **kwargs: object) -> KiAntwort:
        self.aufrufe.append(kwargs)
        naechste = (
            self._antworten.pop(0) if self._antworten else '{"stimmung":"neutral"}'
        )
        if isinstance(naechste, Exception):
            raise naechste
        return _antwort(naechste)


# ---------------------------------------------------------------- JSON lesen
def test_json_mit_code_zaun_wird_gelesen() -> None:
    """Modelle legen trotz klarer Ansage einen Zaun darum. Das ist kein Grund,
    die Auswertung wegzuwerfen."""
    daten = _json_aus_antwort('```json\n{"stimmung": "positiv"}\n```')
    assert daten == {"stimmung": "positiv"}


def test_json_mit_vorrede_wird_gelesen() -> None:
    daten = _json_aus_antwort('Hier das Ergebnis:\n{"stimmung": "negativ"}')
    assert daten == {"stimmung": "negativ"}


def test_kein_json_wirft_statt_leer_zurueckzugeben() -> None:
    """Wurzel 5: laut scheitern. Eine leere Deutung wäre ein erfundener Wert,
    der in jeder Rangliste als 'neutral' mitzählt."""
    with pytest.raises(KiDeutungFehler, match="kein JSON"):
        _json_aus_antwort("Ich kann das nicht auswerten.")


def test_kaputtes_json_wirft() -> None:
    with pytest.raises(KiDeutungFehler, match="gültiges JSON"):
        _json_aus_antwort('{"stimmung": "positiv",}')


# ------------------------------------------------------------- Themenkatalog
def test_erfundenes_thema_wird_verworfen() -> None:
    """Der Katalog ist geschlossen. Ein Thema, das nicht darin steht, würde die
    Datenbank ohnehin ablehnen (CHECK aus 0501) — aber dann wäre die GANZE
    Deutung verloren statt nur dieser eine Eintrag."""
    sauber = _themen_saeubern(
        [
            {"thema": "sauberkeit", "richtung": "negativ"},
            {"thema": "kueche", "richtung": "positiv"},
        ]
    )
    assert sauber == [{"thema": "sauberkeit", "richtung": "negativ"}]


def test_thema_nur_einmal() -> None:
    sauber = _themen_saeubern(
        [
            {"thema": "lage", "richtung": "positiv"},
            {"thema": "lage", "richtung": "negativ"},
        ]
    )
    assert sauber == [{"thema": "lage", "richtung": "positiv"}]


def test_unbekannte_richtung_wird_neutral() -> None:
    """Eine kaputte Richtung verwirft nicht das Thema — das Thema kam ja vor."""
    sauber = _themen_saeubern([{"thema": "preis", "richtung": "furchtbar"}])
    assert sauber == [{"thema": "preis", "richtung": "neutral"}]


def test_katalog_deckt_sich_mit_dem_schema() -> None:
    """Der Katalog steht an drei Stellen: hier, im Schema und in 0501. Zwei
    davon lassen sich im Test vergleichen — die dritte fällt sonst erst in der
    Datenbank auf, dann aber als 23514 mitten im Tick."""
    assert set(THEMEN) == {e.value for e in AiThemeKey}


# ------------------------------------------------------------------- deuten
def test_deuten_liefert_stimmung_und_themen() -> None:
    ki = FakeKi(
        '{"stimmung": "negativ", '
        '"themen": [{"thema": "laerm", "richtung": "negativ"}], '
        '"kernaussage": "Die Straße war laut."}'
    )
    ergebnis = deuten(text="Sehr laut an der Straße.", client=ki)
    assert ergebnis.stimmung == "negativ"
    assert ergebnis.themen == [{"thema": "laerm", "richtung": "negativ"}]
    assert ergebnis.kernaussage == "Die Straße war laut."


def test_deuten_ohne_text_wirft() -> None:
    with pytest.raises(KiDeutungFehler, match="Kein auswertbarer Text"):
        deuten(text="   ", client=FakeKi())


def test_deuten_unbekannte_stimmung_wirft() -> None:
    """Statt sie still auf 'neutral' zu ziehen: eine geratene Stimmung zählt in
    der Verteilung mit, ohne dass jemand sie als Rateergebnis erkennt."""
    with pytest.raises(KiDeutungFehler, match="Unbekannte Stimmung"):
        deuten(text="Schön war es.", client=FakeKi('{"stimmung": "toll"}'))


def test_deuten_kuerzt_zu_langen_text() -> None:
    """Kein Abweisen: eine echte lange Bewertung soll die Auswertung des
    Objekts nicht kippen. Aber auch kein unbegrenzter Prompt (Wurzel 8)."""
    ki = FakeKi('{"stimmung": "neutral"}')
    deuten(text="x" * 9_000, client=ki)
    assert len(ki.aufrufe[0]["user"]) < 9_000


def test_note_steht_als_nebeninformation_im_prompt() -> None:
    """Ohne den ausdrücklichen Hinweis übernimmt das Modell die Note als
    Stimmung — und der ganze Zweck (den Widerspruch zwischen Zahl und Text zu
    finden) entfällt."""
    ki = FakeKi('{"stimmung": "negativ"}')
    deuten(text="War okay.", note=5.0, client=ki)
    assert "deute den TEXT, nicht die Zahl" in ki.aufrufe[0]["user"]


def test_portalnote_wird_auf_fuenf_gebracht() -> None:
    """Die Skala gehört zum Kanal (Wurzel 4). Eine 8/10 ist keine schlechte
    Note — das Modell würde sie ohne Umrechnung als eine lesen."""
    assert _note_normalisieren(8, "10") == 4.0
    assert _note_normalisieren(4, "5") == 4.0
    assert _note_normalisieren(None, "10") is None


# ------------------------------------------------------------------ Nachlauf
def _db_mit(**extra: list[dict]) -> FakeDB:
    tables: dict[str, list[dict]] = {
        "properties": [{"id": PROP_A, "tenant_id": TENANT, "title": "Haus A"}],
        "reviews": [],
        "channex_review": [],
        "guest_reviews_by_host": [],
        "guest_review_queue": [],
        "reservations": [],
        "portal_guests": [],
        "site_ai_usage": [],
        "review_automation": [],
        "review_automation_log": [],
    }
    tables.update(extra)
    return FakeDB(tables, defaults={"channex_review": {"is_archived": False}})


def test_nachlauf_deutet_und_schreibt_zurueck() -> None:
    db = _db_mit(
        channex_review=[
            {
                "id": "r-1",
                "tenant_id": TENANT,
                "content": "Sehr sauber, tolle Lage.",
                "overall_score": 9.0,
                "ota": "AirBNB",
                "received_at": "2026-08-01T10:00:00Z",
                "ki_bewertet_at": None,
            }
        ]
    )
    ki = FakeKi(
        '{"stimmung": "positiv", '
        '"themen": [{"thema": "sauberkeit", "richtung": "positiv"}]}'
    )
    gedeutet, fehler = offene_deuten(
        db, tabelle="channex_review", tenant_id=TENANT, client=ki
    )
    assert (gedeutet, fehler) == (1, 0)
    zeile = db.tables["channex_review"][0]
    assert zeile["ki_stimmung"] == "positiv"
    assert zeile["ki_bewertet_at"] is not None


def test_nachlauf_ueberspringt_kaputte_antwort_und_macht_weiter() -> None:
    """Eine unbrauchbare Antwort betrifft EINE Bewertung. Die nächste ist davon
    unabhängig — sie wegzuwerfen wäre die teuerste Art, einen Fehler zu
    behandeln."""
    db = _db_mit(
        channex_review=[
            {
                "id": f"r-{i}",
                "tenant_id": TENANT,
                "content": f"Text {i}",
                "overall_score": 8.0,
                "ota": "AirBNB",
                "received_at": f"2026-08-0{i}T10:00:00Z",
                "ki_bewertet_at": None,
            }
            for i in (1, 2)
        ]
    )
    ki = FakeKi("kein json", '{"stimmung": "neutral"}')
    gedeutet, fehler = offene_deuten(
        db, tabelle="channex_review", tenant_id=TENANT, client=ki
    )
    assert (gedeutet, fehler) == (1, 1)
    assert len(ki.aufrufe) == 2


def test_nachlauf_bricht_bei_totem_dienst_ab() -> None:
    """Ein nicht erreichbarer Dienst trifft jede weitere Bewertung genauso.
    Weiterzumachen hieße, `limit`-mal in dieselbe Wand zu laufen."""
    db = _db_mit(
        channex_review=[
            {
                "id": f"r-{i}",
                "tenant_id": TENANT,
                "content": f"Text {i}",
                "overall_score": 8.0,
                "ota": "AirBNB",
                "received_at": f"2026-08-0{i}T10:00:00Z",
                "ki_bewertet_at": None,
            }
            for i in (1, 2, 3)
        ]
    )
    ki = FakeKi(KiError("Vertex nicht erreichbar", status_code=502))
    gedeutet, _ = offene_deuten(
        db, tabelle="channex_review", tenant_id=TENANT, client=ki
    )
    assert gedeutet == 0
    assert len(ki.aufrufe) == 1  # nach dem ersten Fehler ist Schluss


def test_nachlauf_fasst_bereits_gedeutete_nicht_an() -> None:
    db = _db_mit(
        channex_review=[
            {
                "id": "r-1",
                "tenant_id": TENANT,
                "content": "Schon gedeutet.",
                "overall_score": 8.0,
                "ota": "AirBNB",
                "received_at": "2026-08-01T10:00:00Z",
                "ki_bewertet_at": "2026-08-02T10:00:00Z",
                "ki_stimmung": "positiv",
            }
        ]
    )
    ki = FakeKi()
    gedeutet, _ = offene_deuten(
        db, tabelle="channex_review", tenant_id=TENANT, client=ki
    )
    assert gedeutet == 0
    assert ki.aufrufe == []


def test_unbekannte_tabelle_wirft() -> None:
    with pytest.raises(ValueError, match="Unbekannte Bewertungstabelle"):
        offene_deuten(_db_mit(), tabelle="reservations")


# --------------------------------------------------------------- Verdichtung
def test_themen_nach_richtung_getrennt() -> None:
    """'Lage: 40-mal genannt' sagt nichts. '38 positiv, 2 negativ' ist ein
    Befund."""
    zeilen = [
        {"themen": [{"thema": "lage", "richtung": "positiv"}]},
        {"themen": [{"thema": "lage", "richtung": "positiv"}]},
        {"themen": [{"thema": "lage", "richtung": "negativ"}]},
        {"themen": [{"thema": "laerm", "richtung": "negativ"}]},
    ]
    themen = _themen_zaehlen(zeilen)
    assert themen[0].thema == AiThemeKey.lage
    assert (themen[0].positiv, themen[0].negativ) == (2, 1)
    assert themen[1].thema == AiThemeKey.laerm


def test_verlauf_laesst_tage_ohne_bewertung_weg() -> None:
    """Wurzel 4: eine 0 an einem Tag ohne Bewertung wäre ein Einbruch, den es
    nicht gab."""
    from datetime import date

    punkte = _verlauf(
        [
            {"tag": "2026-08-01", "stimmung": "positiv"},
            {"tag": "2026-08-03", "stimmung": "negativ"},
        ],
        date(2026, 8, 1),
        date(2026, 8, 5),
    )
    assert [p.date.day for p in punkte] == [1, 3]


# ------------------------------------------------------------------- Mapping
def test_to_ai_unterscheidet_nicht_ausgewertet_von_ohne_befund() -> None:
    """None heißt 'noch nicht ausgewertet'. Ohne diese Unterscheidung sähe eine
    Bewertung, die der Nachlauf nicht erreicht hat, aus wie eine ohne Aussage —
    und niemand käme auf die Idee, den Nachlauf zu prüfen."""
    assert _to_ai({"ki_stimmung": None, "ki_bewertet_at": None}) is None
    assert (
        _to_ai({"ki_stimmung": "neutral", "ki_bewertet_at": None}) is None
    )
    gedeutet = _to_ai(
        {
            "ki_stimmung": "neutral",
            "ki_themen": [],
            "ki_bewertet_at": "2026-08-02T10:00:00Z",
        }
    )
    assert gedeutet is not None
    assert gedeutet.stimmung == AiSentiment.neutral
    assert gedeutet.themen == []


def test_to_ai_ueberspringt_thema_ausserhalb_des_katalogs() -> None:
    """Kann nur aus einer Zeile stammen, die vor einer Katalog-Änderung
    geschrieben wurde. Die ganze Bewertung deswegen zu verlieren wäre
    unverhältnismäßig."""
    gedeutet = _to_ai(
        {
            "ki_stimmung": "positiv",
            "ki_themen": [
                {"thema": "kueche", "richtung": "positiv"},
                {"thema": "lage", "richtung": "positiv"},
            ],
            "ki_bewertet_at": "2026-08-02T10:00:00Z",
        }
    )
    assert gedeutet is not None
    assert [t.thema for t in gedeutet.themen] == [AiThemeKey.lage]


# ------------------------------------------- Gegenzustand der Warteschlange
def test_handbewertung_raeumt_geplanten_eintrag_ab() -> None:
    """Wurzel 1. Ohne das findet der Betrieb Tage später einen roten Eintrag
    für etwas, das er richtig gemacht hat."""
    db = _db_mit(
        guest_review_queue=[
            {
                "id": "q-1",
                "tenant_id": TENANT,
                "source": "ota",
                "review_id": "r-1",
                "reservation_id": None,
                "status": "geplant",
                "richtung": "gast_bewerten",
                "error": None,
            }
        ]
    )
    betroffen = ReviewQueue(db).erledigt_durch_handarbeit(TENANT, review_id="r-1")
    assert betroffen == 1
    eintrag = db.tables["guest_review_queue"][0]
    assert eintrag["status"] == "uebersprungen"
    assert "Von Hand bewertet" in eintrag["error"]


def test_handbewertung_fasst_gesendeten_eintrag_nicht_an() -> None:
    """Ein bereits gesendeter Eintrag ist Geschichte — ihn umzuschreiben würde
    den Beweis vernichten, dass etwas rausging."""
    db = _db_mit(
        guest_review_queue=[
            {
                "id": "q-1",
                "tenant_id": TENANT,
                "source": "ota",
                "review_id": "r-1",
                "reservation_id": None,
                "status": "gesendet",
                "error": None,
            }
        ]
    )
    assert ReviewQueue(db).erledigt_durch_handarbeit(TENANT, review_id="r-1") == 0
    assert db.tables["guest_review_queue"][0]["status"] == "gesendet"


def test_handbewertung_ohne_bezug_macht_nichts() -> None:
    """Ohne reservation_id UND ohne review_id würde ein ungefiltertes update
    die ganze Warteschlange des Betriebs abräumen."""
    db = _db_mit(
        guest_review_queue=[
            {
                "id": "q-1",
                "tenant_id": TENANT,
                "source": "ota",
                "review_id": "r-1",
                "reservation_id": None,
                "status": "geplant",
                "error": None,
            }
        ]
    )
    assert ReviewQueue(db).erledigt_durch_handarbeit(TENANT) == 0
    assert db.tables["guest_review_queue"][0]["status"] == "geplant"


# ------------------------------------------ Kanal-Herkunft an den Kategorien
def test_kategorie_traegt_ihre_kanaele() -> None:
    """Hostaways beste Idee, nachgebaut: „comfort" gibt es nur bei Booking,
    „accuracy" nur bei Airbnb. Ein Durchschnitt über verschiedene
    Grundgesamtheiten ohne diesen Hinweis ist irreführend — und genau das
    haben wir bis 0501 gezeigt."""
    from src.features.reviews.service import ReviewsService

    kategorien = ReviewsService._quality_categories(  # noqa: SLF001 — Testziel
        [
            {"kanal": "Booking.com", "categories": [("comfort", 4.0)]},
            {"kanal": "Booking.com", "categories": [("comfort", 5.0)]},
            {"kanal": "AirBNB", "categories": [("accuracy", 4.5)]},
            {"kanal": "myBestDays", "categories": [("cleanliness", 5.0)]},
            {"kanal": "AirBNB", "categories": [("cleanliness", 4.0)]},
        ]
    )
    nach_key = {k.key: k for k in kategorien}
    assert nach_key["comfort"].channels == ["Booking.com"]
    assert nach_key["accuracy"].channels == ["AirBNB"]
    # Eine Kategorie, die es bei beiden gibt, trägt beide.
    assert nach_key["cleanliness"].channels == ["AirBNB", "myBestDays"]
    assert nach_key["comfort"].score == 4.5


# ------------------------------------------------------- Deckel der Bilanz
def test_bilanz_deckelt_zeichen_nicht_nur_anzahl() -> None:
    """60 Bewertungen à 4 000 Zeichen wären 240 000 gegen den Prompt-Deckel des
    Clients von 24 000. Der würde laut scheitern — aber mit „Kontext zu groß",
    und der Betrieb stünde vor einer Funktion, die bei seinem BESTEN Objekt
    nicht geht, ohne zu erfahren, warum."""
    from src.features.reviews.ki_deutung import MAX_BILANZ_ZEICHEN, bilanz_ziehen

    ki = FakeKi('{"staerken": [], "schwaechen": [], "empfehlungen": [], '
                '"zusammenfassung": "x"}')
    ergebnis = bilanz_ziehen(
        bewertungen=[{"text": "y" * 3_000, "rating": 5} for _ in range(60)],
        client=ki,
    )
    # Weniger als alle 60 — der Zeichen-Deckel hat vor dem Anzahl-Deckel
    # gegriffen.
    assert 0 < ergebnis.grundlage < 60
    assert len(ki.aufrufe[0]["user"]) <= MAX_BILANZ_ZEICHEN + 500


def test_bilanz_nutzt_alle_wenn_sie_passen() -> None:
    """Der Deckel darf nicht immer greifen — kurze Bewertungen gehen komplett
    ein, sonst würde die Bilanz grundlos auf einem Ausschnitt beruhen."""
    from src.features.reviews.ki_deutung import bilanz_ziehen

    ki = FakeKi('{"staerken": [], "schwaechen": [], "empfehlungen": [], '
                '"zusammenfassung": "x"}')
    ergebnis = bilanz_ziehen(
        bewertungen=[{"text": "Kurz und gut.", "rating": 5} for _ in range(20)],
        client=ki,
    )
    assert ergebnis.grundlage == 20


# ------------------------------------------------------------------- Export
def test_export_laesst_fehlende_note_leer() -> None:
    """Eine 0 in der Notenspalte wäre eine Bewertung mit null Sternen — und
    genau das steht bei einer verdeckten Airbnb-Bewertung nicht fest. In einer
    Tabellenkalkulation ist die leere Zelle das einzige, was „unbekannt"
    heißt (Wurzel 4)."""
    from src.features.reviews.export import als_csv
    from src.features.reviews.schemas import ReviewScale, ReviewSource, UnifiedReview

    csv_text = als_csv(
        [
            UnifiedReview(
                source=ReviewSource.ota,
                id="r-1",
                channel_code="AirBNB",
                author="Manon",
                score=None,
                scale=ReviewScale.ten,
                score_5=None,
                is_hidden=True,
            )
        ],
        ["author", "score_5", "hidden"],
    )
    zeilen = csv_text.lstrip("﻿").strip().split("\r\n")
    assert zeilen[0] == "Gast;Note (5er);Verdeckt"
    assert zeilen[1] == "Manon;;ja"


def test_export_haelt_die_spaltenreihenfolge() -> None:
    """Die Oberfläche darf Spalten ABWÄHLEN, nicht umsortieren: eine CSV,
    deren Spaltenfolge je Nutzer wechselt, bricht jede Excel-Vorlage."""
    from src.features.reviews.export import als_csv

    kopf = als_csv([], ["score_5", "author", "channel"]).lstrip("﻿").strip()
    assert kopf == "Kanal;Gast;Note (5er)"


def test_export_faellt_auf_standard_zurueck() -> None:
    """Eine Auswahl aus lauter unbekannten Namen darf keine leere Datei
    ergeben — sonst lädt der Nutzer eine 0-Byte-CSV und sucht den Fehler bei
    seinen Daten."""
    from src.features.reviews.export import STANDARD, als_csv

    kopf = als_csv([], ["gibtesnicht"]).lstrip("﻿").strip()
    assert kopf.count(";") == len(STANDARD) - 1


def test_export_deckel_ist_hoeher_als_die_seite() -> None:
    """Ohne den `fuer_export`-Schalter bekäme die CSV STILL nur 100 Zeilen
    (MAX_PAGE_SIZE) und sähe vollständig aus. Niemand zählt eine CSV nach."""
    from src.features.reviews.schemas import MAX_PAGE_SIZE
    from src.features.reviews.service import MAX_EXPORT_ROWS

    assert MAX_EXPORT_ROWS > MAX_PAGE_SIZE


# ------------------------------------------------ Portal-Rohtext im Export
def test_export_zerlegt_booking_rohtext() -> None:
    """Booking liefert drei benannte Teile in EINEM Feld. Ungeprüft stand
    „Headline:" und ein LEERES „Negative:" in der CSV-Zelle — und damit etwas
    anderes als auf dem Bildschirm, wo die Oberfläche zerlegt."""
    from src.features.reviews.export import _lesbarer_text

    assert (
        _lesbarer_text("Headline: Super\r\n\r\nPositive: Schön.\r\n\r\nNegative: Laut.")
        == "Super | Positiv: Schön. | Negativ: Laut."
    )


def test_export_laesst_leeren_abschnitt_weg() -> None:
    """Ein „Negative:" ohne Inhalt heißt „der Gast hat nichts Negatives
    geschrieben" — nicht „hier fehlt etwas"."""
    from src.features.reviews.export import _lesbarer_text

    assert _lesbarer_text("Headline: \r\n\r\nPositive: Schön.\r\n\r\nNegative: ") == (
        "Positiv: Schön."
    )


def test_export_laesst_fliesstext_unangetastet() -> None:
    """Airbnb liefert keine Marker. Der Text darf nicht zerschnitten werden."""
    from src.features.reviews.export import _lesbarer_text

    assert _lesbarer_text("We had a lovely stay.") == "We had a lovely stay."


def test_verdeckte_bewertung_ohne_note() -> None:
    """Channex schickt bei verdeckten Bewertungen `overall_score: 0`. Das ist
    keine Null-Bewertung, sondern „steht noch nicht fest" — und sie ging in
    JEDEN Durchschnitt ein (Wurzel 4)."""
    from src.features.channel_manager.reviews_sync import _note

    assert _note({"overall_score": 0, "is_hidden": True}) is None
    # Sichtbare 0 bliebe eine echte Aussage — nicht anfassen.
    assert _note({"overall_score": 0, "is_hidden": False}) == 0.0
    assert _note({"overall_score": 8.4, "is_hidden": True}) == 8.4


# ------------------------------------------- Auto-Bewertungs-Vorlagen (0503)
def test_versand_zieht_zufaellig_einen_text() -> None:
    """Der ganze Grund für die Mehrzahl. Hostaway in seiner eigenen Doku:
    „Airbnb may penalize this practice, and it may affect the SEO." Wer
    500-mal denselben Satz schickt, sieht für das Portal aus wie ein Bot."""
    from src.features.reviews.queue import ReviewQueue

    texte = ["Erster Text.", "Zweiter Text.", "Dritter Text."]
    gezogen = {ReviewQueue._text_waehlen(texte) for _ in range(60)}  # noqa: SLF001
    assert gezogen <= set(texte)
    # Bei 60 Ziehungen aus drei Texten wäre EIN Ergebnis ein kaputter Zufall
    # (Wahrscheinlichkeit ~2·10⁻²⁸).
    assert len(gezogen) > 1


def test_leerer_text_wird_nie_gezogen() -> None:
    """Ein leerer Text erzeugte beim Versand eine leere öffentliche
    Bewertung — beim Portal, unwiderruflich."""
    from src.features.reviews.queue import ReviewQueue

    assert ReviewQueue._text_waehlen(["", "  ", "Echt."]) == "Echt."  # noqa: SLF001
    assert ReviewQueue._text_waehlen([]) is None  # noqa: SLF001
    assert ReviewQueue._text_waehlen(None) is None  # noqa: SLF001


def test_vorlage_schlaegt_betriebs_konfiguration() -> None:
    """Das Objekt entscheidet, nicht der Betrieb — sonst wäre die Vorlage
    eine Attrappe."""
    from src.features.reviews.queue import ReviewQueue

    q = ReviewQueue(_db_mit())
    cfg = {
        "auto_review_rating": 5,
        "auto_review_public": "Alter Betriebstext",
        "auto_review_private": None,
    }
    vorlagen = {
        PROP_A: {
            "note": 4,
            "texte": ["Text aus der Vorlage."],
            "privater_text": "Privat",
            "nach_tagen": 7,
            "min_gastnote": None,
        }
    }
    aus_vorlage = q._inhalt(cfg, vorlagen, PROP_A)  # noqa: SLF001
    assert aus_vorlage["text"] == "Text aus der Vorlage."
    assert aus_vorlage["rating"] == 4
    assert aus_vorlage["recommended"] is True


def test_ohne_vorlage_greift_die_alte_konfiguration() -> None:
    """Rückfall (Wurzel 1): sie zu streichen hätte jede bestehende Automatik
    still abgeschaltet, und niemand hätte es bemerkt."""
    from src.features.reviews.queue import ReviewQueue

    q = ReviewQueue(_db_mit())
    cfg = {
        "auto_review_rating": 5,
        "auto_review_public": "Alter Betriebstext",
        "auto_review_private": None,
    }
    ohne = q._inhalt(cfg, {}, "fremdes-objekt")  # noqa: SLF001
    assert ohne["text"] == "Alter Betriebstext"
    assert ohne["rating"] == 5


def test_vorlauf_kommt_aus_der_vorlage() -> None:
    """Zwei Objekte dürfen verschieden schnell bewerten — sonst wäre
    `nach_tagen` an der Vorlage eine Attrappe."""
    from src.features.reviews.queue import ReviewQueue

    vorlagen = {PROP_A: {"nach_tagen": 7}}
    assert ReviewQueue._vorlauf(3, vorlagen, PROP_A) == 7  # noqa: SLF001
    assert ReviewQueue._vorlauf(3, vorlagen, "anderes") == 3  # noqa: SLF001


def test_schwelle_je_objekt() -> None:
    """„Nur ab 4 Sternen" gilt je Vorlage. Ohne Gast-Bewertung greift die
    Regel NICHT — kein Rateschluss auf einen guten Aufenthalt."""
    from src.features.reviews.queue import ReviewQueue

    cfg = {"auto_review_min_rating": None}
    vorlagen = {PROP_A: {"min_gastnote": 4}}
    erfuellt = ReviewQueue._schwelle_erfuellt  # noqa: SLF001
    assert erfuellt(cfg, vorlagen, PROP_A, 5) is True
    assert erfuellt(cfg, vorlagen, PROP_A, 3) is False
    # Keine Gast-Bewertung → nicht bewerten, wenn eine Schwelle gesetzt ist.
    assert erfuellt(cfg, vorlagen, PROP_A, None) is False
    # Ohne Schwelle immer.
    assert erfuellt(cfg, {}, PROP_A, None) is True


def test_schwelle_faellt_auf_betriebswert_zurueck() -> None:
    from src.features.reviews.queue import ReviewQueue

    cfg = {"auto_review_min_rating": 4}
    erfuellt = ReviewQueue._schwelle_erfuellt  # noqa: SLF001
    assert erfuellt(cfg, {}, PROP_A, 5) is True
    assert erfuellt(cfg, {}, PROP_A, 2) is False


def test_kein_eintrag_ohne_text() -> None:
    """Seit den Vorlagen (0503) der Normalfall, nicht der Sonderfall: ein
    Betrieb, der nur mit Vorlagen arbeitet, hat für Objekte OHNE Vorlage
    bewusst keinen Text. Ein leerer Eintrag würde entweder eine leere
    öffentliche Bewertung erzeugen oder Tage später als Fehler auflaufen."""
    from src.features.reviews.queue import ReviewQueue

    db = _db_mit()
    q = ReviewQueue(db)
    assert q._anlegen({"tenant_id": TENANT, "text": None}) is False  # noqa: SLF001
    assert q._anlegen({"tenant_id": TENANT, "text": "   "}) is False  # noqa: SLF001
    assert db.tables["guest_review_queue"] == []
    # Mit Text geht es durch.
    assert q._anlegen(  # noqa: SLF001
        {
            "tenant_id": TENANT,
            "source": "ota",
            "review_id": "r-1",
            "reservation_id": None,
            "text": "Danke!",
            "rating": 5,
        }
    ) is True
    assert len(db.tables["guest_review_queue"]) == 1


def test_datenbankfehler_wird_uebersetzt() -> None:
    """Der Trigger aus 0503 wirft `unique_violation`. Ungefiltert käme beim
    Nutzer ein 500 an — für eine Bedingung, die er selbst auflösen kann.

    Der zweite Fall deckt einen Fehler ab, den pylint fand und den kein Test
    ausgelöst hätte: `status_code` ist keyword-only, ein positionales
    Argument hätte hier zur Laufzeit geworfen — im FEHLERPFAD, also genau
    dort, wo niemand hinschaut."""
    from postgrest.exceptions import APIError

    from src.features.reviews.vorlagen import VorlagenStore

    schon_aktiv = VorlagenStore._uebersetzt(  # noqa: SLF001
        APIError({"code": "23505", "message": "…"})
    )
    assert schon_aktiv.status_code == 409
    assert "bereits eine" in schon_aktiv.message

    anderer = VorlagenStore._uebersetzt(  # noqa: SLF001
        APIError({"code": "23502", "message": "null value"})
    )
    assert anderer.status_code == 400
