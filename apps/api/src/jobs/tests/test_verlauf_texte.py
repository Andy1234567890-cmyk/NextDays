"""Der Verlauf muss sagen, WAS gesendet wurde (0381).

DER LIVE-BEFUND (12.08.2026): Die Verlaufszeile unter /worker lautete
`taxes · POST · ok · 214 ms`. Damit war die Frage „sendet er die
Reinigungsgebühr an die Portale?" nicht beantwortbar, obwohl der vollständige
Request-Body in `channex_debug_log` lag.

Die Nutzlasten hier sind WÖRTLICH die live gesendeten (aus channex_debug_log,
Feriehus Britt / Feriehus Dora). Erfundene Beispiel-Bodies wären hier wertlos:
der Test soll genau die Form absichern, die Channex wirklich bekommt.
"""

from src.jobs import verlauf_jobs, verlauf_texte

# --------------------------------------------------------------------------
# Abgaben und Gebühren — die Frage, aus der der Auftrag kam
# --------------------------------------------------------------------------


def test_reinigungsgebuehr_steht_mit_betrag_und_logik_in_der_zeile() -> None:
    """Wörtlich der live gesendete Body (12.08.2026, 08:19:49).

    Betrag UND Logik müssen dastehen: „Reinigungsgebühr" allein sagt nicht, ob
    795 DKK pro Buchung oder pro Nacht rausgingen — das ist der Unterschied
    zwischen 795 und 5.565 DKK bei einer Woche.
    """
    text = verlauf_texte.beschreiben(
        "taxes/2e31e04e-8b85-4c1e-9143-cccd20f0ed7c",
        {
            "tax": {
                "rate": "795.0",
                "type": "fee",
                "logic": "per_booking",
                "title": "Reinigungsgebühr",
                "currency": "DKK",
                "property_id": "ca392991-f1e5-4b13-b771-d3b444cc1301",
                "is_inclusive": False,
            }
        },
    )
    assert text == "Reinigungsgebühr · 795,00 DKK · pro Buchung · exklusiv"


def test_pro_nacht_wird_nicht_mit_pro_buchung_verwechselt() -> None:
    """Resort-Gebühr, live: 25 DKK PRO NACHT (nicht pro Buchung)."""
    text = verlauf_texte.beschreiben(
        "taxes/d02ed077-eff8-491a-ae79-25c373dee570",
        {
            "tax": {
                "rate": "25.0",
                "logic": "per_night",
                "title": "Resort",
                "currency": "DKK",
                "is_inclusive": False,
            }
        },
    )
    assert "pro Nacht" in text
    assert "pro Buchung" not in text


def test_inklusiv_und_exklusiv_werden_unterschieden() -> None:
    """`is_inclusive` ist im Body ein blankes true/false — und entscheidet, ob
    die Gebühr den Portalpreis erhöht oder darin steckt. Die häufigste
    Verwechslung, deshalb ausgeschrieben."""
    inklusiv = verlauf_texte.beschreiben(
        "taxes/x",
        {"tax": {"title": "USt.", "rate": "25.0", "currency": "DKK",
                 "is_inclusive": True}},
    )
    assert "inklusiv" in inklusiv
    assert "exklusiv" not in inklusiv


def test_fehlende_waehrung_erfindet_keine() -> None:
    """Ohne `currency` im Body steht der Betrag OHNE Symbol da.

    Ein ergänztes „EUR" wäre bei einem dänischen Betrieb schlicht falsch und
    würde als plausible Zahl niemandem auffallen (Wurzel 4).
    """
    text = verlauf_texte.beschreiben(
        "taxes/x", {"tax": {"title": "Kurtaxe", "rate": "12.0"}}
    )
    assert text is not None
    assert "12,00" in text
    assert "EUR" not in text and "DKK" not in text


def test_unbekannte_logik_wird_rohgezeigt_nicht_geraten() -> None:
    """Ein `logic`, das wir nicht kennen, erscheint unverändert.

    Es als „pro Buchung" auszugeben wäre eine Falschaussage; der Rohwert ist
    der Befund und zeigt, dass die Übersetzung ergänzt werden muss.
    """
    text = verlauf_texte.beschreiben(
        "taxes/x",
        {"tax": {"title": "Neu", "rate": "1.0", "currency": "DKK",
                 "logic": "per_room_per_week"}},
    )
    assert "per_room_per_week" in text


# --------------------------------------------------------------------------
# ARI und Stammdaten
# --------------------------------------------------------------------------


def test_ari_push_nennt_die_gesendeten_werte() -> None:
    """Bei Restriktionen zählt, WELCHE Werte rausgingen — Rate und Min-Stay
    stehen in der Zeile, nicht nur „1 Eintrag"."""
    text = verlauf_texte.beschreiben(
        "restrictions",
        {"values": [{"date_from": "2026-08-13", "date_to": "2026-08-20",
                     "rate": "115000", "min_stay_arrival": 3}]},
    )
    assert "rate=115000" in text
    assert "min_stay_arrival=3" in text


def test_stammdaten_nennen_titel_und_geaenderte_felder() -> None:
    """Bei einem Objekt-Push ist die Frage: welche Felder gingen mit?"""
    text = verlauf_texte.beschreiben(
        "properties/e1a40932",
        {"property": {"title": "Feriehus Dora", "currency": "DKK",
                      "address": "Vejen 1", "zip_code": "9990"}},
    )
    assert text.startswith("Feriehus Dora")
    assert "currency" in text


def test_ohne_erkennbaren_inhalt_bleibt_die_spalte_leer() -> None:
    """Ein GET ohne Body bekommt KEINEN Text.

    Methode und Pfad stehen schon in eigenen Spalten — sie hier zu wiederholen
    füllte die Ansicht mit Rauschen.
    """
    assert verlauf_texte.beschreiben("channels/list", None) is None
    assert verlauf_texte.beschreiben(None, {"tax": {"title": "x"}}) is None


# --------------------------------------------------------------------------
# Job-Ergebnisse
# --------------------------------------------------------------------------


def test_feed_lauf_nennt_seine_zahlen() -> None:
    """Live gemessen lief `sync_bookings_feed` 92 Sekunden — und die Zeile sagte
    nicht, ob dabei etwas ankam."""
    satz, zahlen = verlauf_jobs.beschreiben(
        {"fetched": 12, "saved": 3, "acknowledged": 12, "skipped": 9,
         "errors": []}
    )
    assert satz == "12 geholt · 3 gespeichert · 12 bestätigt · 9 fremder Mandant"
    assert zahlen == {"fetched": 12, "saved": 3, "acknowledged": 12,
                      "skipped": 9}


def test_teilfehler_erscheint_im_satz_nicht_als_glatter_durchlauf() -> None:
    """`sync_bookings_all` isoliert Revisionsfehler in `errors[]`, der Job gilt
    trotzdem als `done`. Ohne den Hinweis sähe die Zeile wie ein Erfolg aus,
    während Revisionen un-acked im 30-Minuten-Fenster hängen (Wurzel 5)."""
    satz, zahlen = verlauf_jobs.beschreiben(
        {"fetched": 5, "saved": 3, "acknowledged": 3, "skipped": 0,
         "errors": ["Revision abc: unmapped rate plan", "Revision def: kaputt"]}
    )
    assert "2 Revision(en) mit Fehler" in satz
    assert "unmapped rate plan" in satz
    assert zahlen["errors"] == 2


def test_nichts_gefunden_wird_ausgeschrieben() -> None:
    """Ein Lauf ohne Treffer ist eine AUSSAGE („gemessen, nichts da") — ein
    leeres Feld liesse offen, ob überhaupt gemessen wurde."""
    satz, _ = verlauf_jobs.beschreiben(
        {"fetched": 0, "saved": 0, "acknowledged": 0, "skipped": 0, "errors": []}
    )
    assert satz == "nichts zu tun"


def test_skipped_heisst_je_dienst_etwas_anderes() -> None:
    """Im Feed sind es Revisionen FREMDER Mandanten (Mandantentrennung), beim
    Reconcile unveränderte Objekte. Ein pauschales Wort wäre an einer der
    beiden Stellen falsch."""
    feed, _ = verlauf_jobs.beschreiben(
        {"fetched": 1, "acknowledged": 1, "skipped": 9, "errors": []}
    )
    reconcile, _ = verlauf_jobs.beschreiben(
        {"created": 0, "updated": 1, "soft_deleted": 0, "skipped": 5}
    )
    assert "fremder Mandant" in feed
    assert "unverändert" in reconcile


def test_ari_push_ohne_zaehler_nennt_art_und_zeitraum() -> None:
    """`push_ari` zählt nichts — es pusht. Die Zeile muss trotzdem sagen, WAS
    über welchen Zeitraum rausging."""
    satz, _ = verlauf_jobs.beschreiben(
        {"art": "availability", "von": "2026-08-13", "bis": "2027-08-12"}
    )
    assert satz == "availability · 13.08.2026–12.08.2027"


def test_handler_ohne_rueckgabe_behauptet_keine_taetigkeit() -> None:
    """Ein Handler, der nichts zurückgibt, lässt die Spalte leer — statt eine
    Tätigkeit zu erfinden (Wurzel 4)."""
    assert verlauf_jobs.beschreiben(None) == (None, None)
    assert verlauf_jobs.beschreiben({}) == (None, None)


def test_pydantic_antwort_wird_wie_ein_dict_gelesen() -> None:
    """`sync_bookings_all` liefert ein `BookingSyncResponse`, kein dict."""
    from src.features.channel_manager.schemas import BookingSyncResponse

    satz, _ = verlauf_jobs.beschreiben(
        BookingSyncResponse(fetched=4, saved=4, acknowledged=4)
    )
    assert satz is not None
    assert "4 geholt" in satz
