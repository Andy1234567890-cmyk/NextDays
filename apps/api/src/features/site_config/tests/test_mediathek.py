"""Tests der Mediathek: Ordner, Verwendung, Ersetzen, Stock-Fotos (0460/0461).

Eigene Datei und nicht weitere 400 Zeilen in ``test_site_config.py``: die stand
bei 2829 Zeilen. Das Fake-DB-Mock wird von dort importiert — EINE Attrappe für
den Slice, sonst driften zwei Nachbildungen derselben Datenbank auseinander und
eine davon deckt den Fehler zu.
"""
from __future__ import annotations

import pytest

from src.features.site_config import stock
from src.features.site_config.fehler import SiteConfigError
from src.features.site_config.schemas_mediathek import (
    MediaFolderCreate,
    MediaFolderUpdate,
    MediumBulkMove,
    MediumUpdate,
    StockAnbieter,
    StockImportRequest,
)

from .test_site_config import _ctx, _svc

_PNG = b"\x89PNG\r\n\x1a\n" + (13).to_bytes(4, "big") + b"IHDR" + (
    1920
).to_bytes(4, "big") + (1080).to_bytes(4, "big") + b"\x00" * 32


def _mit(tabellen: dict[str, list[dict]] | None = None):
    basis: dict[str, list[dict]] = {
        "site_media": [],
        "site_media_folders": [],
        "site_blocks": [],
        "site_pages": [],
        "tenant_site_config": [],
    }
    basis.update(tabellen or {})
    return _svc(basis), basis


# === Ordner =================================================================

def test_ordner_anlegen_ist_leer_und_bleibt() -> None:
    """Der Grund für die eigene Tabelle: ein leerer Ordner muss existieren
    können. Bei einer Pfad-Spalte wäre er nach dem Neuladen verschwunden."""
    svc, _ = _mit()
    ordner = svc.create_media_folder(_ctx(), MediaFolderCreate(name="Sommer"))
    liste = svc.list_media_folders(_ctx())
    assert [f.id for f in liste.items] == [ordner.id]
    assert liste.items[0].media_count == 0


def test_ordner_name_ist_je_ebene_eindeutig() -> None:
    """Groß-/Kleinschreibung zählt NICHT: „Sommer" und „sommer" nebeneinander
    wären für den Kunden zwei identische Ordner."""
    svc, _ = _mit()
    svc.create_media_folder(_ctx(), MediaFolderCreate(name="Sommer"))
    with pytest.raises(SiteConfigError) as exc:
        svc.create_media_folder(_ctx(), MediaFolderCreate(name="  sommer "))
    assert exc.value.status_code == 409


def test_gleicher_name_in_verschiedenen_ebenen_ist_erlaubt() -> None:
    svc, _ = _mit()
    oben = svc.create_media_folder(_ctx(), MediaFolderCreate(name="Bilder"))
    unten = svc.create_media_folder(
        _ctx(), MediaFolderCreate(name="Bilder", parent_id=oben.id)
    )
    assert unten.parent_id == oben.id


def test_ordnertiefe_ist_gedeckelt() -> None:
    """Wurzel 8: kein unbegrenzter Bereich."""
    svc, _ = _mit()
    a = svc.create_media_folder(_ctx(), MediaFolderCreate(name="A"))
    b = svc.create_media_folder(_ctx(), MediaFolderCreate(name="B", parent_id=a.id))
    c = svc.create_media_folder(_ctx(), MediaFolderCreate(name="C", parent_id=b.id))
    with pytest.raises(SiteConfigError) as exc:
        svc.create_media_folder(_ctx(), MediaFolderCreate(name="D", parent_id=c.id))
    assert exc.value.status_code == 422


def test_ordner_kann_nicht_in_sich_selbst() -> None:
    svc, _ = _mit()
    a = svc.create_media_folder(_ctx(), MediaFolderCreate(name="A"))
    with pytest.raises(SiteConfigError) as exc:
        svc.update_media_folder(_ctx(), a.id, MediaFolderUpdate(parent_id=a.id))
    assert exc.value.status_code == 422


def test_ordner_kann_nicht_unter_seinen_eigenen_unterordner() -> None:
    """Der Zyklus, den Postgres nicht verhindert: der Ast verschwindet aus dem
    Baum und seine Bilder sind für immer unerreichbar."""
    svc, _ = _mit()
    a = svc.create_media_folder(_ctx(), MediaFolderCreate(name="A"))
    b = svc.create_media_folder(_ctx(), MediaFolderCreate(name="B", parent_id=a.id))
    with pytest.raises(SiteConfigError) as exc:
        svc.update_media_folder(_ctx(), a.id, MediaFolderUpdate(parent_id=b.id))
    assert exc.value.status_code == 422


def test_verschieben_rechnet_die_hoehe_des_astes_mit() -> None:
    """A hat ein Kind, ist also zwei Ebenen hoch. Unter C (Ebene 2) ergäbe das
    Ebene 4 — mehr als erlaubt."""
    svc, _ = _mit()
    a = svc.create_media_folder(_ctx(), MediaFolderCreate(name="A"))
    svc.create_media_folder(_ctx(), MediaFolderCreate(name="A1", parent_id=a.id))
    b = svc.create_media_folder(_ctx(), MediaFolderCreate(name="B"))
    c = svc.create_media_folder(_ctx(), MediaFolderCreate(name="C", parent_id=b.id))
    with pytest.raises(SiteConfigError) as exc:
        svc.update_media_folder(_ctx(), a.id, MediaFolderUpdate(parent_id=c.id))
    assert exc.value.status_code == 422


def test_fremder_ordner_ist_ein_404() -> None:
    """Wurzel 3/9: eine fremde ID ist ein 404, kein stiller Treffer."""
    svc, _ = _mit(
        {"site_media_folders": [{"id": "f-fremd", "tenant_id": "t-X", "name": "X"}]}
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.update_media_folder(_ctx(), "f-fremd", MediaFolderUpdate(name="Neu"))
    assert exc.value.status_code == 404


def test_loeschvorschau_nennt_bilder_und_unterordner() -> None:
    """Wurzel 1: der Kunde erfährt VOR dem Löschen, was passiert."""
    svc, _ = _mit()
    a = svc.create_media_folder(_ctx(), MediaFolderCreate(name="A"))
    svc.create_media_folder(_ctx(), MediaFolderCreate(name="A1", parent_id=a.id))
    svc.add_medium(_ctx(), _PNG, filename="x.png", folder_id=a.id)
    vorschau = svc.preview_media_folder_delete(_ctx(), a.id)
    assert vorschau.subfolder_count == 1
    assert vorschau.media_count == 1


def test_bild_in_fremden_ordner_hochladen_ist_ein_404_ohne_waise() -> None:
    """Der Ordner wird VOR dem Upload geprüft — sonst läge die Datei im Bucket
    und die DB-Zeile käme nie (Wurzel 1)."""
    svc, tabellen = _mit(
        {"site_media_folders": [{"id": "f-fremd", "tenant_id": "t-X", "name": "X"}]}
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.add_medium(_ctx(), _PNG, folder_id="f-fremd")
    assert exc.value.status_code == 404
    assert tabellen["site_media"] == []
    assert svc._db.storage.dateien == {}  # noqa: SLF001


# === Bild: Maße, Ändern, Verschieben ========================================

def test_masse_kommen_aus_den_kopfbytes() -> None:
    """Nicht vom Client behauptet — sonst wäre die angezeigte Größe eine
    Behauptung wie der content_type (Wurzel 8)."""
    svc, _ = _mit()
    m = svc.add_medium(_ctx(), _PNG, filename="gross.png")
    assert (m.width, m.height) == (1920, 1080)
    assert m.source.value == "upload"


def test_masse_bleiben_leer_wenn_der_kopf_nichts_hergibt() -> None:
    """Wurzel 4: lieber keine Angabe als eine geratene.

    Beide Dateien hier tragen eine GÜLTIGE Signatur und werden deshalb
    angenommen — die Magic-Byte-Prüfung ist der Sicherheitsriegel, keine
    Gültigkeitsprüfung. Nur die Maße fehlen, und dann bleibt die Spalte leer,
    statt eine plausible Zahl zu erfinden."""
    svc, _ = _mit()
    png_ohne_ihdr = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
    ohne_masse = svc.add_medium(_ctx(), png_ohne_ihdr)
    assert ohne_masse.width is None and ohne_masse.height is None
    jpeg_ohne_sof = b"\xff\xd8\xff\xd9"
    m = svc.add_medium(_ctx(), jpeg_ohne_sof)
    assert m.width is None and m.height is None


def test_alt_text_und_umbenennen() -> None:
    svc, _ = _mit()
    m = svc.add_medium(_ctx(), _PNG, filename="DSC_0001.png")
    geaendert = svc.update_medium(
        _ctx(), m.id, MediumUpdate(filename="Strand", alt_text="  Blick aufs Meer ")
    )
    assert geaendert.filename == "Strand"
    assert geaendert.alt_text == "Blick aufs Meer"


def test_bild_aus_dem_ordner_holen_ist_null_nicht_unveraendert() -> None:
    """Gesendetes `null` muss von „nicht gesendet" unterscheidbar sein — sonst
    lässt sich „raus aus dem Ordner" gar nicht ausdrücken."""
    svc, _ = _mit()
    ordner = svc.create_media_folder(_ctx(), MediaFolderCreate(name="A"))
    m = svc.add_medium(_ctx(), _PNG, folder_id=ordner.id)
    assert m.folder_id == ordner.id
    zurueck = svc.update_medium(_ctx(), m.id, MediumUpdate(folder_id=None))
    assert zurueck.folder_id is None


def test_mehrfach_verschieben_prueft_alle_ids_vorher() -> None:
    """Wurzel 3 + 1: eine fremde ID mittendrin darf nicht dazu führen, dass die
    davor schon verschoben sind."""
    svc, _ = _mit(
        {
            "site_media": [
                {
                    "id": "m-fremd",
                    "tenant_id": "t-X",
                    "path": "t-X/a.png",
                    "url": "u",
                    "mime": "image/png",
                    "bytes": 1,
                }
            ]
        }
    )
    ordner = svc.create_media_folder(_ctx(), MediaFolderCreate(name="A"))
    eigenes = svc.add_medium(_ctx(), _PNG)
    with pytest.raises(SiteConfigError) as exc:
        svc.move_media(
            _ctx(),
            MediumBulkMove(media_ids=[eigenes.id, "m-fremd"], folder_id=ordner.id),
        )
    assert exc.value.status_code == 404
    assert svc.get_medium(_ctx(), eigenes.id).folder_id is None


def test_liste_filtert_nach_ordner_sucht_und_sortiert() -> None:
    svc, _ = _mit()
    ordner = svc.create_media_folder(_ctx(), MediaFolderCreate(name="A"))
    svc.add_medium(_ctx(), _PNG, filename="strand.png", folder_id=ordner.id)
    svc.add_medium(_ctx(), _PNG, filename="berg.png")
    assert svc.list_media(_ctx(), folder_id=ordner.id).total == 1
    assert svc.list_media(_ctx(), nur_wurzel=True).total == 1
    assert svc.list_media(_ctx(), suche="STRA").total == 1
    assert svc.list_media(_ctx(), suche="gibtsnicht").total == 0
    # Ein unbekannter Sortierschlüssel fällt auf „neueste" zurück, statt eine
    # beliebige Spalte des Clients zu sortieren (Wurzel 3).
    assert svc.list_media(_ctx(), sortierung="tenant_id").total == 2


def test_liste_mit_fremdem_ordner_ist_404_und_kein_leerer_ordner() -> None:
    """Wurzel 9: sonst sähe „gibt es nicht" aus wie „ist leer"."""
    svc, _ = _mit(
        {"site_media_folders": [{"id": "f-fremd", "tenant_id": "t-X", "name": "X"}]}
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.list_media(_ctx(), folder_id="f-fremd")
    assert exc.value.status_code == 404


# === Verwendung und Ersetzen ================================================

def _mit_verwendung():
    svc, tabellen = _mit(
        {
            "site_pages": [
                {"id": "p1", "tenant_id": "t-1", "title": "Start",
                 "og_image_url": "ALT", "cover_image_url": None},
            ],
            "site_blocks": [
                {"id": "b1", "tenant_id": "t-1", "page_id": "p1", "type": "hero",
                 "content": {"image_url": "ALT", "title": "Hallo"},
                 "settings": {}},
                {"id": "b2", "tenant_id": "t-1", "page_id": "p1", "type": "gallery",
                 "content": {"images": [{"url": "ALT"}, {"url": "ANDERS"}]},
                 "settings": {"background_image_url": "ALT"}},
                {"id": "b3", "tenant_id": "t-1", "page_id": "p1", "type": "image",
                 "content": {"url": "ANDERS"}, "settings": {}},
                # Fremder Mandant — darf NIE angefasst werden.
                {"id": "bX", "tenant_id": "t-X", "page_id": "pX", "type": "hero",
                 "content": {"image_url": "ALT"}, "settings": {}},
            ],
            "tenant_site_config": [
                {"tenant_id": "t-1", "logo_url": "ALT", "hero_image_url": None,
                 "favicon_url": None, "rss_image_url": None,
                 "head_html": '<img src="ALT">', "custom_js": None,
                 "checkout_js": None, "head_css": None},
            ],
            "site_media": [
                {"id": "m-alt", "tenant_id": "t-1", "path": "t-1/a.png",
                 "url": "ALT", "mime": "image/png", "bytes": 1, "kind": "image"},
                {"id": "m-neu", "tenant_id": "t-1", "path": "t-1/b.png",
                 "url": "NEU", "mime": "image/png", "bytes": 1, "kind": "image"},
            ],
        }
    )
    return svc, tabellen


def test_verwendung_findet_bilder_in_jeder_verschachtelung() -> None:
    """Die Suche läuft über den GANZEN Inhaltsbaum und nicht über eine
    Feldliste — ein neuer Block-Typ ist damit automatisch abgedeckt."""
    svc, _ = _mit_verwendung()
    nutzung = svc.find_media_usage(_ctx(), "m-alt")
    arten = {(f.kind, f.block_id or f.field) for f in nutzung.items}
    assert ("block", "b1") in arten           # content.image_url
    assert ("block", "b2") in arten           # images[].url UND settings
    assert ("page", "og_image_url") in arten
    assert ("branding", "logo_url") in arten
    assert ("code", "head_html") in arten
    assert ("block", "b3") not in arten
    # b2 trägt die Adresse zweimal (Galerie + Hintergrund).
    assert next(f for f in nutzung.items if f.block_id == "b2").count == 2


def test_freies_html_wird_gemeldet_aber_nie_automatisch_geaendert() -> None:
    """Eine Zeichenkettenersetzung in fremdem HTML hat ein Ergebnis, das niemand
    vorhersagen kann. Verschweigen wäre trotzdem schlechter (Wurzel 5)."""
    svc, tabellen = _mit_verwendung()
    ergebnis = svc.replace_medium(_ctx(), "m-alt", "m-neu")
    assert ergebnis.manual == 1
    assert tabellen["tenant_site_config"][0]["head_html"] == '<img src="ALT">'
    assert not next(f for f in ergebnis.items if f.kind == "code").replaceable


def test_ersetzen_tauscht_ueberall_und_nur_beim_eigenen_mandanten() -> None:
    svc, tabellen = _mit_verwendung()
    ergebnis = svc.replace_medium(_ctx(), "m-alt", "m-neu")
    assert ergebnis.replaced == 5  # b1(1) + b2(2) + Seite(1) + Logo(1)
    bloecke = {b["id"]: b for b in tabellen["site_blocks"]}
    assert bloecke["b1"]["content"]["image_url"] == "NEU"
    assert bloecke["b2"]["content"]["images"][0]["url"] == "NEU"
    assert bloecke["b2"]["content"]["images"][1]["url"] == "ANDERS"
    assert bloecke["b2"]["settings"]["background_image_url"] == "NEU"
    assert tabellen["site_pages"][0]["og_image_url"] == "NEU"
    assert tabellen["tenant_site_config"][0]["logo_url"] == "NEU"
    # Der fremde Mandant bleibt unangetastet (Wurzel 3).
    assert bloecke["bX"]["content"]["image_url"] == "ALT"
    # Das alte Bild bleibt in der Mediathek: Tauschen und Löschen sind zwei
    # Entscheidungen, und die zweite ist unumkehrbar.
    assert any(m["id"] == "m-alt" for m in tabellen["site_media"])


def test_ersetzen_durch_sich_selbst_ist_ein_422() -> None:
    svc, _ = _mit_verwendung()
    with pytest.raises(SiteConfigError) as exc:
        svc.replace_medium(_ctx(), "m-alt", "m-alt")
    assert exc.value.status_code == 422


def test_ersetzen_mit_fremdem_ersatz_ist_ein_404() -> None:
    svc, tabellen = _mit_verwendung()
    tabellen["site_media"].append(
        {"id": "m-fremd", "tenant_id": "t-X", "path": "p", "url": "F",
         "mime": "image/png", "bytes": 1, "kind": "image"}
    )
    with pytest.raises(SiteConfigError) as exc:
        svc.replace_medium(_ctx(), "m-alt", "m-fremd")
    assert exc.value.status_code == 404
    # Nichts angefasst.
    assert tabellen["site_pages"][0]["og_image_url"] == "ALT"


# === Stock-Fotos (0461) =====================================================
# Kein Netz: die Anbieteraufrufe werden an EINER Stelle abgefangen
# (`stock._hole`). Damit prüfen diese Tests genau das, was uns gehört — Auswahl
# des Anbieters, Umformung, Kontingent-Auswertung, Nachweis-Pflicht — und nicht
# die Erreichbarkeit fremder Server.

_UNSPLASH_FOTO = {
    "id": "abc123",
    "width": 4000,
    "height": 3000,
    "alt_description": "Strand bei Sonnenuntergang",
    "urls": {
        "small": "https://images.unsplash.com/photo-1?w=400",
        "regular": "https://images.unsplash.com/photo-1?w=1080",
    },
    "user": {"name": "Anna Beispiel", "links": {"html": "https://unsplash.com/@anna"}},
    "links": {"download_location": "https://api.unsplash.com/photos/abc123/download"},
}

_PEXELS_FOTO = {
    "id": 987,
    "width": 3000,
    "height": 2000,
    "alt": "Berge im Nebel",
    "src": {
        "medium": "https://images.pexels.com/photos/987/m.jpg",
        "large2x": "https://images.pexels.com/photos/987/l.jpg",
    },
    "photographer": "Bo Beispiel",
    "photographer_url": "https://www.pexels.com/@bo",
}


@pytest.fixture(name="schluessel")
def _schluessel(monkeypatch: pytest.MonkeyPatch):
    """Beide Anbieter mit Schlüssel — sonst existieren sie gar nicht."""
    from src.core.config import get_settings

    monkeypatch.setenv("PEXELS_API_KEY", "test-pexels-key")
    monkeypatch.setenv("UNSPLASH_ACCESS_KEY", "test-unsplash-key")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_anbieter_ohne_schluessel_erscheint_nicht(monkeypatch: pytest.MonkeyPatch) -> None:
    """Wurzel 4: lieber gar keine Suchmaske als eine, die verlässlich scheitert."""
    from src.core.config import get_settings

    monkeypatch.setenv("PEXELS_API_KEY", "")
    monkeypatch.setenv("UNSPLASH_ACCESS_KEY", "")
    get_settings.cache_clear()
    try:
        assert stock.anbieter_liste().items == []
    finally:
        get_settings.cache_clear()


def test_shutterstock_ist_nie_dabei(schluessel: None) -> None:  # noqa: ARG001
    """Vorbereitet, aber nicht scharf: bezahltes Abo + AGB-Erweiterung nötig.

    Auch MIT gesetzten Schlüsseln taucht er nicht auf — der Riegel ist `aktiv`,
    nicht die Frage, ob zufällig ein Schlüssel da ist."""
    ids = {p.id.value for p in stock.anbieter_liste().items}
    assert ids == {"pexels", "unsplash"}
    assert stock.ANBIETER["shutterstock"].aktiv is False
    assert stock.ANBIETER["shutterstock"].deaktiviert_grund


def test_unsplash_treffer_tragen_den_pflicht_nachweis(
    schluessel: None, monkeypatch: pytest.MonkeyPatch
) -> None:  # noqa: ARG001
    monkeypatch.setattr(
        stock, "_hole", lambda *_a, **_k: {"results": [_UNSPLASH_FOTO]}
    )
    treffer = stock.suche("unsplash", "strand", seite=1, anzahl=10)
    foto = treffer.items[0]
    assert foto.attribution_required is True
    assert foto.credit_name == "Anna Beispiel"
    # utm-Parameter sind Vorschrift, nicht Kosmetik.
    assert "utm_source=mynextdays" in foto.credit_url
    assert "utm_medium=referral" in foto.credit_url
    assert "utm_source=mynextdays" in foto.provider_url
    assert foto.alt_text == "Strand bei Sonnenuntergang"


def test_pexels_treffer_brauchen_keine_attribution(
    schluessel: None, monkeypatch: pytest.MonkeyPatch
) -> None:  # noqa: ARG001
    monkeypatch.setattr(stock, "_hole", lambda *_a, **_k: {"photos": [_PEXELS_FOTO]})
    foto = stock.suche("pexels", "berg", seite=1, anzahl=10).items[0]
    assert foto.attribution_required is False
    assert foto.credit_name == "Bo Beispiel"


def test_fremder_bildhost_wird_abgelehnt(
    schluessel: None, monkeypatch: pytest.MonkeyPatch
) -> None:  # noqa: ARG001
    """Fail-closed: eine Antwort, die auf einen fremden Host zeigt, ist entweder
    kompromittiert oder nicht der Anbieter, für den wir sie halten."""
    boese = {
        **_UNSPLASH_FOTO,
        "urls": {
            "small": "https://boeser-host.example/x.jpg",
            "regular": "https://boeser-host.example/x.jpg",
        },
    }
    monkeypatch.setattr(stock, "_hole", lambda *_a, **_k: {"results": [boese]})
    # Der einzelne Treffer wird verworfen, die Suche kippt nicht.
    assert stock.suche("unsplash", "x", seite=1, anzahl=10).items == []


def test_kontingent_erschoepft_meldet_429_statt_leerer_liste(
    schluessel: None,
) -> None:  # noqa: ARG001
    """Wurzel 5: eine leere Trefferliste sähe aus wie „nichts gefunden"."""
    import httpx

    profil = stock.ANBIETER["pexels"]
    antwort = httpx.Response(200, headers={"x-ratelimit-remaining": "0"})
    with pytest.raises(SiteConfigError) as exc:
        stock._kontingent_pruefen(profil, antwort)  # noqa: SLF001
    assert exc.value.status_code == 429
    # Auch der 429 des Anbieters selbst.
    with pytest.raises(SiteConfigError) as exc2:
        stock._kontingent_pruefen(  # noqa: SLF001
            profil, httpx.Response(429, headers={"retry-after": "60"})
        )
    assert exc2.value.status_code == 429


def test_uebernahme_holt_alles_beim_anbieter_und_meldet_den_download(
    schluessel: None, monkeypatch: pytest.MonkeyPatch
) -> None:  # noqa: ARG001
    """Wurzel 3: die Anfrage trägt nur Anbieter und Kennung.
    Vertragspflicht: `download_location` wird angepingt."""
    gemeldet: list[str] = []
    monkeypatch.setattr(stock, "_hole", lambda *_a, **_k: _UNSPLASH_FOTO)
    monkeypatch.setattr(
        stock, "download_melden", lambda _a, ziel: gemeldet.append(ziel or "")
    )
    svc, tabellen = _mit()
    m = svc.import_stock_photo(
        _ctx(),
        StockImportRequest(provider=StockAnbieter.unsplash, external_id="abc123"),
    )
    assert m.source.value == "unsplash"
    assert m.credit_name == "Anna Beispiel"
    assert m.url == "https://images.unsplash.com/photo-1?w=1080"
    assert (m.width, m.height) == (4000, 3000)
    # HOTLINK: keine Datei im Bucket, kein `path` (Anbietervorgabe).
    assert svc._db.storage.dateien == {}  # noqa: SLF001
    assert tabellen["site_media"][0].get("path") is None
    assert gemeldet == ["https://api.unsplash.com/photos/abc123/download"]


def test_zweite_uebernahme_legt_nichts_doppelt_an(
    schluessel: None, monkeypatch: pytest.MonkeyPatch
) -> None:  # noqa: ARG001
    """Wurzel 2: Doppelklick und Retry kommen real vor."""
    monkeypatch.setattr(stock, "_hole", lambda *_a, **_k: _UNSPLASH_FOTO)
    monkeypatch.setattr(stock, "download_melden", lambda *_a: None)
    svc, tabellen = _mit()
    anfrage = StockImportRequest(
        provider=StockAnbieter.unsplash, external_id="abc123"
    )
    erste = svc.import_stock_photo(_ctx(), anfrage)
    zweite = svc.import_stock_photo(_ctx(), anfrage)
    assert erste.id == zweite.id
    assert len(tabellen["site_media"]) == 1


def test_foto_ohne_nachweis_wird_nicht_uebernommen(
    schluessel: None, monkeypatch: pytest.MonkeyPatch
) -> None:  # noqa: ARG001
    """Ein Bild, das den Anbietervertrag bricht, sobald es auf einer Seite
    steht, ist kein halber Erfolg (fail-closed)."""
    ohne = {**_UNSPLASH_FOTO, "user": {"name": "", "links": {"html": ""}}}
    monkeypatch.setattr(stock, "_hole", lambda *_a, **_k: ohne)
    svc, tabellen = _mit()
    with pytest.raises(SiteConfigError) as exc:
        svc.import_stock_photo(
            _ctx(),
            StockImportRequest(provider=StockAnbieter.unsplash, external_id="abc123"),
        )
    assert exc.value.status_code == 502
    assert tabellen["site_media"] == []


def test_download_meldung_an_fremdes_ziel_wird_nicht_abgerufen(
    schluessel: None, monkeypatch: pytest.MonkeyPatch
) -> None:  # noqa: ARG001
    """Die Adresse kommt aus der Anbieterantwort. Zeigt sie woandershin, wird
    sie nicht abgerufen — sonst wäre sie ein SSRF-Vektor zweiter Ordnung."""
    import httpx

    aufgerufen: list[str] = []

    class _Client:
        def __init__(self, **_k: object) -> None:
            pass

        def __enter__(self) -> _Client:
            return self

        def __exit__(self, *_a: object) -> None:
            return None

        def get(self, url: str, **_k: object) -> httpx.Response:
            aufgerufen.append(url)
            return httpx.Response(200)

    monkeypatch.setattr(httpx, "Client", _Client)
    stock.download_melden("unsplash", "http://169.254.169.254/latest/meta-data/")
    assert aufgerufen == []
    stock.download_melden("unsplash", "https://api.unsplash.com/photos/x/download")
    assert aufgerufen == ["https://api.unsplash.com/photos/x/download"]


def test_bildnachweise_gehen_mit_der_oeffentlichen_antwort_hinaus(
    schluessel: None, monkeypatch: pytest.MonkeyPatch
) -> None:  # noqa: ARG001
    """Unsplash verlangt die Angabe bei jeder ANZEIGE — angezeigt wird das Foto
    auf der veröffentlichten Kundenseite, nicht im Editor."""
    monkeypatch.setattr(stock, "_hole", lambda *_a, **_k: _UNSPLASH_FOTO)
    monkeypatch.setattr(stock, "download_melden", lambda *_a: None)
    svc, _ = _mit()
    svc.add_medium(_ctx(), _PNG, filename="eigenes.png")
    svc.import_stock_photo(
        _ctx(),
        StockImportRequest(provider=StockAnbieter.unsplash, external_id="abc123"),
    )
    nachweise = svc.bildnachweise("t-1")
    # NUR das Stock-Bild — ein selbst hochgeladenes Foto braucht keinen Nachweis.
    assert len(nachweise) == 1
    assert nachweise[0].photographer == "Anna Beispiel"
    assert nachweise[0].provider == "Unsplash"
    assert "utm_source=mynextdays" in nachweise[0].provider_url
    assert nachweise[0].url == "https://images.unsplash.com/photo-1?w=1080"
