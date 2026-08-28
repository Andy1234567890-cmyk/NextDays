"""Tests der Abschnitts-Inhalte, die mit 0450 ff. dazugekommen sind.

Eigene Datei und nicht `test_site_config.py`: dort liegen die Slice-Tests
(Mandanten-Trennung, Domains, Seiten). Hier geht es ausschließlich um die
``content``-Schemas der Abschnitte — was sie ANNEHMEN und, wichtiger, was sie
ABLEHNEN.

Der Schwerpunkt liegt auf dem Ablehnen, weil das die Stelle ist, an der Wurzel 8
(kein unbegrenzter Bereich) und Wurzel 4 (kein erfundener Ersatzwert) wirklich
greifen müssen. Ein Test, der nur prüft, dass ein gültiger Abschnitt durchgeht,
belegt nichts: das täte auch ein Modell ohne jede Prüfung.
"""
from __future__ import annotations

import pytest

from src.features.site_config.block_inhalte import validate_block_content
from src.features.site_config.schemas import BlockType


def _de(text: str) -> dict[str, str]:
    return {"de": text}


# =========================================================================
# Accordion
# =========================================================================


def test_accordion_saeubert_html() -> None:
    """Der Inhalt eines Klapp-Eintrags ist Rich-Text — und Rich-Text geht durch
    dieselbe Allowlist wie überall im Slice. Ein `<script>` darf nicht in der
    Datenbank landen, denn von dort ginge es ungeprüft auf die Gästeseite."""
    out = validate_block_content(
        BlockType.accordion,
        {
            "items": [
                {
                    "title": _de("Anreise"),
                    "text": _de('<p>Ab 15 Uhr</p><script>alert(1)</script>'),
                }
            ]
        },
    )
    html = out["items"][0]["text"]["de"]
    assert "<script>" not in html
    assert "Ab 15 Uhr" in html


def test_accordion_deckel() -> None:
    zu_viele = [{"title": _de(f"F{i}")} for i in range(31)]
    with pytest.raises(ValueError):
        validate_block_content(BlockType.accordion, {"items": zu_viele})


# =========================================================================
# Tabs
# =========================================================================


def test_tabs_bild_nur_mit_erlaubtem_schema() -> None:
    """Ein `javascript:`-Bild ist im <img>-Kontext zwar nicht ausführbar, aber
    die Adresse landet trotzdem im Markup der Gästeseite. Fail-closed."""
    with pytest.raises(ValueError):
        validate_block_content(
            BlockType.tabs,
            {"items": [{"label": _de("A"), "image_url": "javascript:alert(1)"}]},
        )


def test_tabs_deckel() -> None:
    with pytest.raises(ValueError):
        validate_block_content(
            BlockType.tabs,
            {"items": [{"label": _de(str(i))} for i in range(13)]},
        )


# =========================================================================
# Countdown
# =========================================================================


def test_countdown_rechnet_auf_utc_um() -> None:
    out = validate_block_content(
        BlockType.countdown, {"target": "2027-01-01T00:00:00+01:00"}
    )
    assert out["target"] == "2026-12-31T23:00:00+00:00"


def test_countdown_ohne_zeitzone_abgelehnt() -> None:
    """Ohne Zone liefe der Countdown je nach Land unterschiedlich. Kein stilles
    Ergänzen von UTC (Wurzel 4) — das wäre in Kopenhagen eine Stunde daneben,
    ohne dass es jemandem auffiele."""
    with pytest.raises(ValueError):
        validate_block_content(
            BlockType.countdown, {"target": "2027-01-01T00:00:00"}
        )


def test_countdown_unlesbares_datum_abgelehnt() -> None:
    with pytest.raises(ValueError):
        validate_block_content(BlockType.countdown, {"target": "irgendwann"})


def test_countdown_leerer_zielzeitpunkt_ist_kein_fehler() -> None:
    """„Noch nicht gesetzt" ist ein gültiger Zwischenstand — der Renderer zeigt
    dann im Entwurf den Grund an, live nichts."""
    out = validate_block_content(BlockType.countdown, {"target": "  "})
    assert out["target"] is None


def test_countdown_unbekannter_ablaufmodus_abgelehnt() -> None:
    with pytest.raises(ValueError):
        validate_block_content(BlockType.countdown, {"on_expired": "blinken"})


# =========================================================================
# Tabelle
# =========================================================================


def test_tabelle_nimmt_zeilen_an() -> None:
    out = validate_block_content(
        BlockType.table,
        {
            "header": [{"title": _de("Nächte")}, {"title": _de("Preis")}],
            "rows": [["2", "890"], ["7", "2.450"]],
        },
    )
    assert out["rows"][1] == ["7", "2.450"]


def test_tabelle_zu_viele_zeilen() -> None:
    with pytest.raises(ValueError):
        validate_block_content(
            BlockType.table, {"rows": [["x"] for _ in range(151)]}
        )


def test_tabelle_zu_viele_spalten_wird_abgelehnt_nicht_gekuerzt() -> None:
    """Stillschweigend Spalten zu verlieren wäre Datenverlust, den niemand
    bemerkt, bis die Tabelle live steht (Wurzel 4/5)."""
    with pytest.raises(ValueError):
        validate_block_content(BlockType.table, {"rows": [["x"] * 31]})


def test_tabelle_zu_lange_zelle() -> None:
    with pytest.raises(ValueError):
        validate_block_content(BlockType.table, {"rows": [["y" * 501]]})


# =========================================================================
# Liste, Dateien, Copyright, Brotkrumen
# =========================================================================


def test_liste_unbekanntes_layout_abgelehnt() -> None:
    with pytest.raises(ValueError):
        validate_block_content(BlockType.list, {"layout": "karussell"})


def test_liste_link_schema_geprueft() -> None:
    with pytest.raises(ValueError):
        validate_block_content(
            BlockType.list,
            {"items": [{"title": _de("A"), "link_href": "javascript:1"}]},
        )


def test_liste_relativer_link_erlaubt() -> None:
    out = validate_block_content(
        BlockType.list, {"items": [{"link_href": "/kontakt"}]}
    )
    assert out["items"][0]["link_href"] == "/kontakt"


def test_dateien_deckel_und_schema() -> None:
    with pytest.raises(ValueError):
        validate_block_content(
            BlockType.file,
            {"items": [{"url": "https://x.example/a.pdf"} for _ in range(11)]},
        )
    with pytest.raises(ValueError):
        validate_block_content(
            BlockType.file, {"items": [{"url": "javascript:alert(1)"}]}
        )


def test_copyright_hat_kein_jahr_im_inhalt() -> None:
    """Das Jahr kommt beim Rendern aus der Uhr — es steht bewusst NICHT in den
    Daten. Stünde es dort, wäre die Zeile beim nächsten Jahreswechsel falsch,
    und genau das ist der Zweck des Abschnitts."""
    out = validate_block_content(BlockType.copyright, {"text": _de("Nordlicht")})
    assert set(out) == {"text", "reverse"}


def test_brotkrumen_kennen_ihren_pfad_nicht() -> None:
    """Der Pfad kommt aus der Seitenhierarchie (`page.trail`), nicht aus dem
    `content`. Ein eingetippter Pfad wäre eine zweite Wahrheit über die
    Seitenstruktur und beim ersten Verschieben falsch."""
    out = validate_block_content(BlockType.breadcrumbs, {})
    assert set(out) == {"show_home", "show_current", "hide_without_parent"}
    assert out["show_home"] is True
