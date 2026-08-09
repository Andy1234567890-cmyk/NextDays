"""Tests des announcements-Slice.

Vier Dinge entscheiden hier über Sicherheit und Korrektheit — sie sind
entsprechend dicht abgedeckt:

  1. **Bild-Quellen** (Wurzel 8): ein `<img>` auf einen fremden Server würde
     beim Rendern die IP jedes Betrachters leaken — und eine Ankündigung sehen
     ALLE Kunden. nh3 allein reicht dagegen nicht, weil `https://` ein gültiges
     Schema ist.
  2. **Zielgruppe** (Wurzel 9): `owner`/`staff`/`cleaner` dürfen nichts sehen,
     geprüft gegen die FRISCHE Rolle aus der DB, nicht gegen das Token.
  3. **Idempotenz** (Wurzel 2): zweimal quittieren ist kein Fehler, meldet aber
     `neu: false`.
  4. **Entwürfe** sind über den Kundenpfad unsichtbar — auch bei geratener ID.
"""
from unittest.mock import MagicMock

import pytest

from src.core.security import AuthContext
from src.core.supabase import public_storage_url
from src.features.announcements.schemas import (
    BILD_BUCKET,
    AnnouncementCreate,
    AnnouncementUpdate,
    UebersetzungUpdate,
    normalisiere_gueltig_bis,
    sanitize_inhalt,
)
from src.features.announcements.service import (
    AnnouncementError,
    AnnouncementService,
)
from src.features.announcements.uebersetzung import (
    MAX_ZEICHEN,
    UebersetzungError,
    quelle_hash,
)

EIGENE_BASIS = public_storage_url(BILD_BUCKET, "")


def _ctx(role: str = "admin") -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="t1", role=role)


class _Result:
    def __init__(self, data: list[dict] | None) -> None:
        self.data = data


class _Query:
    """Minimaler PostgREST-Doppelgänger.

    Sammelt Filter und liefert die passenden Zeilen aus dem `_DB`-Bestand.
    Bewusst ein eigenes Doppel statt MagicMock-Ketten: die Tests prüfen, WELCHE
    Zeilen ein Aufruf liefert, nicht in welcher Reihenfolge Methoden liefen.
    """

    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._eq: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gte: list[tuple[str, str]] = []

    def select(self, *_a: object, **_k: object) -> "_Query":
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._eq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, list(vals))
        return self

    def gte(self, col: str, val: str) -> "_Query":
        self._gte.append((col, val))
        return self

    def or_(self, _expr: str) -> "_Query":
        # Die einzige or_-Nutzung ist `gueltig_bis is null or >= jetzt`. Die
        # Testdaten setzen gueltig_bis nicht, der Zweig ist damit immer wahr.
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def range(self, *_a: int) -> "_Query":
        return self

    def _passt(self, row: dict) -> bool:
        if not all(str(row.get(c)) == str(v) for c, v in self._eq):
            return False
        if self._in and str(row.get(self._in[0])) not in {
            str(v) for v in self._in[1]
        }:
            return False
        return all(str(row.get(c) or "") >= v for c, v in self._gte)

    def execute(self) -> _Result:
        rows = [r for r in self._db.tables.get(self._table, []) if self._passt(r)]
        return _Result(rows)

    # -- Schreibpfade ------------------------------------------------------
    def insert(self, payload: dict) -> "_Write":
        return _Write(self._db, self._table, "insert", payload)

    def update(self, payload: dict) -> "_Write":
        return _Write(self._db, self._table, "update", payload)

    def delete(self) -> "_Write":
        return _Write(self._db, self._table, "delete", {})

    def upsert(self, payload: dict, **kwargs: object) -> "_Write":
        return _Write(self._db, self._table, "upsert", payload, **kwargs)


class _Write:
    def __init__(
        self, db: "_DB", table: str, art: str, payload: dict, **kwargs: object
    ) -> None:
        self._db = db
        self._table = table
        self._art = art
        self._payload = payload
        self._kwargs = kwargs
        self._eq: list[tuple[str, object]] = []

    def eq(self, col: str, val: object) -> "_Write":
        self._eq.append((col, val))
        return self

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._art in ("insert", "upsert"):
            if self._art == "upsert" and self._kwargs.get("ignore_duplicates"):
                # Der UNIQUE-Index aus 0337, nachgebaut: eine vorhandene
                # Kombination wird NICHT überschrieben — der ursprüngliche
                # Zeitpunkt bleibt stehen.
                schluessel = ("announcement_id", "user_id")
                vorhanden = any(
                    all(r.get(k) == self._payload.get(k) for k in schluessel)
                    for r in rows
                )
                if vorhanden:
                    self._db.ignorierte_upserts += 1
                    return _Result([])
            if self._art == "upsert" and self._kwargs.get("on_conflict"):
                # `on_conflict="a,b"` — eine vorhandene Zeile mit denselben
                # Konfliktspalten wird AKTUALISIERT statt verdoppelt. Ohne das
                # entstünden im Doppel zwei Zeilen je Sprache, und der UNIQUE-
                # Index aus 0347 wäre im Test nicht abgebildet.
                schluessel = [
                    s.strip()
                    for s in str(self._kwargs["on_conflict"]).split(",")
                ]
                for r in rows:
                    if all(
                        r.get(k) == self._payload.get(k) for k in schluessel
                    ):
                        r.update(self._payload)
                        return _Result([r])
            neu = {"id": f"row{len(rows) + 1}", **self._payload}
            rows.append(neu)
            return _Result([neu])
        treffer = [
            r
            for r in rows
            if all(str(r.get(c)) == str(v) for c, v in self._eq)
        ]
        if self._art == "delete":
            for r in treffer:
                rows.remove(r)
            return _Result(treffer)
        for r in treffer:
            r.update(self._payload)
        return _Result(treffer)


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.ignorierte_upserts = 0
        self.storage = MagicMock(name="storage")

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _db(**tables: list[dict]) -> _DB:
    basis: dict[str, list[dict]] = {
        "users": [{"id": "u1", "tenant_id": "t1", "role": "admin"}],
        "tenants": [{"id": "t1", "created_at": "2020-01-01T00:00:00+00:00"}],
        "announcements": [],
        "announcement_reads": [],
        "announcement_translations": [],
    }
    basis.update(tables)
    return _DB(basis)


def _ankuendigung(**over: object) -> dict:
    zeile = {
        "id": "a1",
        "titel": "Neue Funktion",
        "inhalt_html": "<p>Hallo</p>",
        "kurztext": "kurz",
        "status": "veroeffentlicht",
        "kategorie": "neuerung",
        "veroeffentlicht_am": "2026-01-01T00:00:00+00:00",
        "gueltig_bis": None,
        "als_popup": True,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    zeile.update(over)
    return zeile


# === Sanitizer: Bild-Quellen (Wurzel 8) =====================================
def test_fremdes_bild_wird_entfernt_resttext_bleibt() -> None:
    """Der Kern des Slice: `https://angreifer/?c=1` ist ein GÜLTIGES Schema und
    überlebt nh3. Es muss trotzdem raus — sonst meldet jedes Kundendashboard
    beim Rendern IP und Zeitpunkt an einen fremden Server.

    Entfernt wird nur das Bild, nicht die Ankündigung: der Redakteur darf seinen
    Text nicht dadurch verlieren, dass er ein Fremdbild einfügt.
    """
    roh = '<p>Wichtiger Text</p><img src="https://angreifer.example/?c=1"><p>Ende</p>'
    sauber = sanitize_inhalt(roh)

    assert "angreifer.example" not in sauber
    assert "<img" not in sauber
    assert "Wichtiger Text" in sauber
    assert "Ende" in sauber


def test_data_uri_bild_wird_entfernt() -> None:
    """nh3 wirft den `data:`-src über url_schemes weg — zurück bleibt ein
    nacktes <img> ohne Quelle, das ebenfalls verschwinden muss."""
    sauber = sanitize_inhalt(
        '<p>Text</p><img src="data:image/png;base64,iVBORw0KGgo=">'
    )

    assert "data:" not in sauber
    assert "<img" not in sauber
    assert "Text" in sauber


def test_eigene_storage_url_ueberlebt() -> None:
    """Ein Screenshot aus unserem eigenen Bucket ist der legitime Fall und darf
    nicht mit weggeräumt werden."""
    url = f"{EIGENE_BASIS}a1/deadbeef.png"
    sauber = sanitize_inhalt(f'<p>Vorher</p><img src="{url}" alt="Screenshot">')

    assert url in sauber
    assert "<img" in sauber
    assert 'alt="Screenshot"' in sauber


def test_bild_mit_gleichem_praefix_fremder_host_raus() -> None:
    """Ein Angreifer könnte den Bucket-Namen in seine eigene URL schreiben.
    Geprüft wird gegen die volle Basis inkl. Host, nicht gegen den Bucketnamen."""
    sauber = sanitize_inhalt(
        '<img src="https://boese.example/storage/v1/object/public/'
        'announcement-images/x.png">'
    )

    assert "<img" not in sauber


def test_script_und_javascript_href_fliegen_raus() -> None:
    sauber = sanitize_inhalt(
        '<script>alert(1)</script><p>Rest</p>'
        '<a href="javascript:alert(1)">Klick</a>'
    )

    assert "<script" not in sauber
    assert "javascript:" not in sauber
    assert "Rest" in sauber


def test_validator_greift_in_create_und_update() -> None:
    """PATCH ohne Validator wäre das Loch, durch das rohes HTML einläuft —
    beide Wege müssen säubern."""
    roh = '<p>ok</p><script>alert(1)</script><img src="https://boese/?c=1">'

    erstellt = AnnouncementCreate(titel="T", inhalt_html=roh)
    geaendert = AnnouncementUpdate(inhalt_html=roh)

    for wert in (erstellt.inhalt_html, geaendert.inhalt_html):
        assert "<script" not in (wert or "")
        assert "<img" not in (wert or "")
        assert "ok" in (wert or "")


def test_update_ohne_inhalt_laesst_feld_unberuehrt() -> None:
    """None = nicht mitgeschickt. Der Validator darf daraus keinen leeren
    String machen, sonst leert ein Titel-PATCH den Inhalt."""
    assert AnnouncementUpdate(titel="Nur Titel").inhalt_html is None


# === Zielgruppe (Wurzel 3 + 9) ==============================================
@pytest.mark.parametrize("rolle", ["staff", "cleaner", "owner"])
def test_fremde_rollen_bekommen_403(rolle: str) -> None:
    """Die Rolle wird FRISCH aus public.users gelesen. Das Token behauptet hier
    `admin` — trotzdem 403, weil die DB die Wahrheit ist."""
    db = _db(users=[{"id": "u1", "tenant_id": "t1", "role": rolle}])
    service = AnnouncementService(db=db)

    for aufruf in (service.liste, service.popup):
        with pytest.raises(AnnouncementError) as exc:
            aufruf(_ctx("admin"))
        assert exc.value.status_code == 403


def test_quittieren_prueft_rolle_ebenfalls() -> None:
    """Wurzel 9: der Schreibpfad muss denselben Scope prüfen wie der Lesepfad."""
    db = _db(
        users=[{"id": "u1", "tenant_id": "t1", "role": "cleaner"}],
        announcements=[_ankuendigung()],
    )
    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=db).quittieren(_ctx("admin"), "a1")
    assert exc.value.status_code == 403


def test_nutzer_aus_fremdem_mandanten_bekommt_403() -> None:
    """Wurzel 3: der Lookup ist auf id UND tenant_id gescopet. Ein Token mit
    fremder tenant_id findet keine Zeile → fail-closed."""
    db = _db()
    ctx = AuthContext(user_id="u1", tenant_id="t999", role="admin")

    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=db).liste(ctx)
    assert exc.value.status_code == 403


def test_ohne_mandant_im_token_403() -> None:
    ctx = AuthContext(user_id="u1", tenant_id=None, role="admin")
    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=_db()).liste(ctx)
    assert exc.value.status_code == 403


# === Entwürfe sind unsichtbar ===============================================
def test_entwurf_taucht_in_liste_und_popup_nicht_auf() -> None:
    db = _db(announcements=[_ankuendigung(id="a2", status="entwurf")])
    service = AnnouncementService(db=db)

    assert service.liste(_ctx()).items == []
    assert service.popup(_ctx()).item is None


def test_entwurf_ist_nicht_quittierbar() -> None:
    """Sonst ließe sich per geratener UUID belegen, dass ein Entwurf existiert."""
    db = _db(announcements=[_ankuendigung(id="a2", status="entwurf")])

    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=db).quittieren(_ctx(), "a2")
    assert exc.value.status_code == 404


def test_archivierte_erscheinen_nicht_mehr() -> None:
    db = _db(announcements=[_ankuendigung(status="archiviert")])
    assert AnnouncementService(db=db).popup(_ctx()).item is None


# === Idempotenz (Wurzel 2) ==================================================
def test_quittieren_zweimal_meldet_beim_zweiten_mal_nicht_neu() -> None:
    db = _db(announcements=[_ankuendigung()])
    service = AnnouncementService(db=db)

    assert service.quittieren(_ctx(), "a1").neu is True
    assert service.quittieren(_ctx(), "a1").neu is False
    # Der UNIQUE-Index hat den zweiten Schreibversuch geschluckt, statt den
    # ursprünglichen Zeitpunkt nach vorn zu schieben.
    assert db.ignorierte_upserts == 1
    assert len(db.tables["announcement_reads"]) == 1


def test_quittiertes_popup_kommt_nicht_wieder() -> None:
    db = _db(announcements=[_ankuendigung()])
    service = AnnouncementService(db=db)

    assert service.popup(_ctx()).item is not None
    service.quittieren(_ctx(), "a1")
    assert service.popup(_ctx()).item is None


def test_quittierung_eines_anderen_nutzers_zaehlt_nicht() -> None:
    db = _db(
        announcements=[_ankuendigung()],
        announcement_reads=[
            {"announcement_id": "a1", "user_id": "u2", "tenant_id": "t1"}
        ],
    )
    assert AnnouncementService(db=db).popup(_ctx()).item is not None


# === Reihenfolge + Neukunden-Filter =========================================
def test_popup_liefert_die_aelteste_offene_zuerst() -> None:
    """Aufsteigend: wer zwei Wochen weg war, liest in Erscheinungsreihenfolge."""
    db = _db(
        announcements=[
            _ankuendigung(id="alt", veroeffentlicht_am="2026-01-01T00:00:00+00:00"),
            _ankuendigung(id="neu", veroeffentlicht_am="2026-05-01T00:00:00+00:00"),
        ]
    )
    antwort = AnnouncementService(db=db).popup(_ctx())

    assert antwort.item is not None
    assert antwort.item.id == "alt"
    assert antwort.offen == 2


def test_neukunde_bekommt_keine_historie_als_popup() -> None:
    """Ohne diesen Filter wäre der erste Login eines frisch registrierten
    Betriebs eine Klickstrecke durch die halbe Produkthistorie."""
    db = _db(
        tenants=[{"id": "t1", "created_at": "2026-06-01T00:00:00+00:00"}],
        announcements=[
            _ankuendigung(id="alt", veroeffentlicht_am="2026-01-01T00:00:00+00:00"),
        ],
    )
    assert AnnouncementService(db=db).popup(_ctx()).item is None


def test_neukunde_sieht_die_historie_trotzdem_in_der_liste() -> None:
    """Sie unterbricht nur nicht — nachlesbar bleibt sie."""
    db = _db(
        tenants=[{"id": "t1", "created_at": "2026-06-01T00:00:00+00:00"}],
        announcements=[
            _ankuendigung(id="alt", veroeffentlicht_am="2026-01-01T00:00:00+00:00"),
        ],
    )
    antwort = AnnouncementService(db=db).liste(_ctx())

    assert len(antwort.items) == 1
    # Als ungelesen zählt sie aber nicht — sonst stünde ein Badge da, das sich
    # über das Popup nie abbauen ließe.
    assert antwort.ungelesen == 0


def test_ungelesen_zaehlt_ueber_schreibweisen_hinweg() -> None:
    """`...Z` und `...+00:00` bezeichnen denselben Moment, sortieren als TEXT
    aber verschieden. Ein lexikalischer Vergleich zählte die Ankündigung hier
    fälschlich als zu alt und das Badge bliebe leer — deshalb wird geparst.
    """
    db = _db(
        tenants=[{"id": "t1", "created_at": "2026-01-01T00:00:00Z"}],
        announcements=[
            _ankuendigung(id="a1", veroeffentlicht_am="2026-06-01T00:00:00+00:00"),
        ],
    )
    assert AnnouncementService(db=db).liste(_ctx()).ungelesen == 1


def test_liste_meldet_quittierung_je_zeile() -> None:
    """Die Liste muss je Eintrag sagen, ob DIESER Nutzer ihn quittiert hat.

    Ohne das Feld konnte das Dashboard den „neu"-Punkt nur raten und zeigte ihn
    an jeder Zeile — auch an längst gelesenen. Der Wert ist nutzerbezogen: die
    Quittierung von `u2` darf `u1` nicht als gelesen erscheinen lassen.
    """
    db = _db(
        announcements=[
            _ankuendigung(id="a1"),
            _ankuendigung(id="a2"),
        ],
        announcement_reads=[
            {"announcement_id": "a1", "user_id": "u1", "tenant_id": "t1"},
            {"announcement_id": "a2", "user_id": "u2", "tenant_id": "t1"},
        ],
    )
    items = {i.id: i for i in AnnouncementService(db=db).liste(_ctx()).items}

    assert items["a1"].quittiert is True
    # Von einem ANDEREN Nutzer quittiert — für u1 weiterhin ungelesen.
    assert items["a2"].quittiert is False


def test_unlesbarer_zeitstempel_kippt_die_liste_nicht() -> None:
    """Wurzel 5: kaputte Daten dürfen keinen 500 auslösen. Der Filter
    unterdrückt nur Anzeigen, er gewährt keinen Zugriff — der Rollen-Riegel
    steht davor."""
    db = _db(
        tenants=[{"id": "t1", "created_at": "kaputt"}],
        announcements=[_ankuendigung()],
    )
    assert AnnouncementService(db=db).liste(_ctx()).ungelesen == 1


def test_ohne_popup_flag_keine_unterbrechung() -> None:
    db = _db(announcements=[_ankuendigung(als_popup=False)])
    service = AnnouncementService(db=db)

    assert service.popup(_ctx()).item is None
    assert len(service.liste(_ctx()).items) == 1


# === Bild-Upload: Magic-Bytes (Wurzel 8) ====================================
_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
_WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 32


def test_upload_akzeptiert_png_und_webp() -> None:
    db = _db(announcements=[_ankuendigung(status="entwurf")])
    service = AnnouncementService(db=db)

    for inhalt, endung in ((_PNG, ".png"), (_WEBP, ".webp")):
        url = service.bild_hochladen("a1", content=inhalt)
        assert url.startswith(EIGENE_BASIS)
        assert url.endswith(endung)


def test_upload_lehnt_falsche_magic_bytes_ab_ohne_500() -> None:
    """Eine als PNG deklarierte HTML-Datei bleibt HTML — im public Bucket wäre
    das Stored-XSS auf unserer eigenen Storage-Domain. Der Client-content_type
    wird deshalb gar nicht erst gelesen; entschieden wird nach den Bytes.

    Wichtig: 4xx, kein 500 — angreiferkontrollierter Input darf keinen
    unbehandelten Fehler auslösen (Wurzel 5).
    """
    db = _db(announcements=[_ankuendigung(status="entwurf")])

    for inhalt in (b"<html><script>alert(1)</script>", b"\xff\xd8\xff-jpeg", b"GIF89a"):
        with pytest.raises(AnnouncementError) as exc:
            AnnouncementService(db=db).bild_hochladen("a1", content=inhalt)
        assert 400 <= exc.value.status_code < 500

    db.storage.from_.return_value.upload.assert_not_called()


def test_upload_lehnt_leere_datei_ab() -> None:
    db = _db(announcements=[_ankuendigung()])
    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=db).bild_hochladen("a1", content=b"")
    assert exc.value.status_code == 422


def test_upload_auf_unbekannte_ankuendigung_ist_404() -> None:
    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=_db()).bild_hochladen("gibtsnicht", content=_PNG)
    assert exc.value.status_code == 404


def test_hochgeladenes_bild_ueberlebt_den_sanitizer() -> None:
    """Der Kreis muss sich schließen: was der Upload zurückgibt, darf der
    Validator nicht wieder wegwerfen."""
    db = _db(announcements=[_ankuendigung(status="entwurf")])
    url = AnnouncementService(db=db).bild_hochladen("a1", content=_PNG)

    assert url in sanitize_inhalt(f'<p>x</p><img src="{url}">')


# === Backoffice =============================================================
def test_erstellen_legt_immer_einen_entwurf_an() -> None:
    """Anlegen und an alle Kunden ausspielen dürfen nicht derselbe Knopf sein."""
    db = _db()
    item = AnnouncementService(db=db).erstellen(
        AnnouncementCreate(titel="Titel", inhalt_html="<p>x</p>"),
        erstellt_von="p1",
    )

    assert item.status == "entwurf"
    assert item.veroeffentlicht_am is None


def test_veroeffentlichen_setzt_den_zeitpunkt_einmalig() -> None:
    """Wurzel 2: ein zweiter Klick darf die Mitteilung nicht in der Historie
    nach vorn schieben und nicht bei allen erneut als ungelesen erscheinen."""
    db = _db(announcements=[_ankuendigung(id="a1", status="entwurf",
                                          veroeffentlicht_am=None)])
    service = AnnouncementService(db=db)

    erst = service.veroeffentlichen("a1")
    zweit = service.veroeffentlichen("a1")

    assert erst.status == "veroeffentlicht"
    assert erst.veroeffentlicht_am is not None
    assert zweit.veroeffentlicht_am == erst.veroeffentlicht_am


def test_veroeffentlichen_ohne_titel_ist_422() -> None:
    db = _db(announcements=[_ankuendigung(titel="   ", status="entwurf")])
    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=db).veroeffentlichen("a1")
    assert exc.value.status_code == 422


def test_zurueckziehen_archiviert_und_laesst_quittierungen_stehen() -> None:
    db = _db(
        announcements=[_ankuendigung()],
        announcement_reads=[
            {"announcement_id": "a1", "user_id": "u1", "tenant_id": "t1"}
        ],
    )
    item = AnnouncementService(db=db).zurueckziehen("a1")

    assert item.status == "archiviert"
    assert len(db.tables["announcement_reads"]) == 1


def test_loeschen_nur_fuer_entwuerfe() -> None:
    """Eine veröffentlichte Ankündigung wird zurückgezogen, nicht gelöscht —
    ihre Quittierungen sind Teil der Historie."""
    db = _db(announcements=[_ankuendigung(status="veroeffentlicht")])

    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=db).loeschen("a1")
    assert exc.value.status_code == 409
    assert db.tables["announcements"]


def test_loeschen_raeumt_die_bilder_mit_weg() -> None:
    """Sonst bleiben Waisen liegen: der Pfad heißt nach der ID, und die ist
    nach dem Löschen weg."""
    db = _db(announcements=[_ankuendigung(status="entwurf")])
    db.storage.from_.return_value.list.return_value = [{"name": "x.png"}]

    AnnouncementService(db=db).loeschen("a1")

    db.storage.from_.return_value.remove.assert_called_once_with(["a1/x.png"])
    assert db.tables["announcements"] == []


def test_storage_stoerung_kippt_das_loeschen_nicht() -> None:
    """Wurzel 5, best-effort: das Entfernen der Zeile ist der Hauptpfad."""
    db = _db(announcements=[_ankuendigung(status="entwurf")])
    db.storage.from_.return_value.list.side_effect = RuntimeError("storage weg")

    AnnouncementService(db=db).loeschen("a1")

    assert db.tables["announcements"] == []


def test_backoffice_sieht_entwuerfe() -> None:
    db = _db(announcements=[_ankuendigung(status="entwurf")])
    assert len(AnnouncementService(db=db).backoffice_liste().items) == 1


def test_aktualisieren_leert_kurztext_wenn_explizit_null() -> None:
    """`exclude_unset` statt `exclude_none`: sonst ließe sich ein Feld nie
    wieder leeren."""
    db = _db(announcements=[_ankuendigung()])
    AnnouncementService(db=db).aktualisieren(
        "a1", AnnouncementUpdate(kurztext=None)
    )

    assert db.tables["announcements"][0]["kurztext"] is None


def test_aktualisieren_unbekannte_id_ist_404() -> None:
    with pytest.raises(AnnouncementError) as exc:
        AnnouncementService(db=_db()).aktualisieren(
            "gibtsnicht", AnnouncementUpdate(titel="x")
        )
    assert exc.value.status_code == 404


# === „Popup nur bis": reines Datum meint den GANZEN Tag ======================
# Live-Befund vom 09.08.2026: Das Backoffice-Formular ist ein
# `<input type="date">` und schickte `2026-08-09`. Postgres castet das zu
# MITTERNACHT — dem ANFANG des Tages. Die erste echte Ankündigung war damit
# beim Speichern (09:52) bereits ~10 Stunden abgelaufen, das Popup erschien
# nie. Genau diese Rückwärts-Bedeutung fangen die folgenden Tests ab.
def test_gueltig_bis_reines_datum_wird_tagesende() -> None:
    """Der gewählte Tag zählt VOLLSTÄNDIG mit, nicht bis Mitternacht davor."""
    assert normalisiere_gueltig_bis("2026-08-09") == (
        "2026-08-09T23:59:59.999999+00:00"
    )


def test_gueltig_bis_mit_uhrzeit_bleibt_unveraendert() -> None:
    """Wer eine Uhrzeit angibt, meint sie auch — kein Hochschieben."""
    assert normalisiere_gueltig_bis("2026-08-20T10:00:00Z") == (
        "2026-08-20T10:00:00+00:00"
    )


def test_gueltig_bis_leer_ist_unbegrenzt() -> None:
    """Leeres Feld = keine Grenze (None), nicht ein erfundenes Datum."""
    assert normalisiere_gueltig_bis(None) is None
    assert normalisiere_gueltig_bis("   ") is None


def test_gueltig_bis_unlesbar_wird_abgelehnt() -> None:
    """Kein stiller Ersatzwert (Wurzel 4/5): ein still verworfenes Ablaufdatum
    hieße, das Popup läuft unbegrenzt weiter."""
    with pytest.raises(ValueError, match="Kein gültiger Zeitpunkt"):
        normalisiere_gueltig_bis("morgen")


def test_create_normalisiert_gueltig_bis() -> None:
    """Der Validator hängt am POST …"""
    req = AnnouncementCreate(titel="t", gueltig_bis="2026-08-09")
    assert req.gueltig_bis == "2026-08-09T23:59:59.999999+00:00"


def test_update_normalisiert_gueltig_bis() -> None:
    """… UND am PATCH — sonst käme über das Ändern wieder ein
    Mitternachts-Wert herein (dieselbe Lücke wie bei `inhalt_html`)."""
    req = AnnouncementUpdate(gueltig_bis="2026-08-09")
    assert req.gueltig_bis == "2026-08-09T23:59:59.999999+00:00"


# === Übersetzungen (0347) ===================================================
# Die EINE Zusage dieses Abschnitts: eine geprüfte Fassung wird von keinem
# automatischen Lauf verändert. Der Text trägt rechtliche Aussagen und
# Geldbeträge — ein überschriebener korrigierter Betrag wäre der teuerste
# denkbare Fehler dieses Slice. Entsprechend liegt der Schwerpunkt hier.


def _fassung(**over: object) -> dict:
    zeile = {
        "announcement_id": "a1",
        "sprache": "sv",
        "titel": "Ny funktion",
        "kurztext": "kort",
        "inhalt_html": "<p>Hej</p>",
        "geprueft": False,
        "geprueft_am": None,
        "quelle_hash": "alt",
    }
    zeile.update(over)
    return zeile


def test_geprueft_ueberlebt_neuen_lauf(monkeypatch: pytest.MonkeyPatch) -> None:
    """DER KERN: eine von Hand korrigierte Fassung wird NICHT überschrieben.

    Aufbau: das Original hat sich geändert (der Hash passt nicht mehr), die
    schwedische Fassung ist aber geprüft. Ein Übersetzungslauf muss sie in Ruhe
    lassen — obwohl sie nach Hash-Vergleich „veraltet" ist. Genau hier lag die
    Gefahr: „veraltet" verführt dazu, neu zu übersetzen.
    """
    db = _db(
        announcements=[_ankuendigung()],
        announcement_translations=[
            _fassung(
                sprache="sv",
                titel="VON HAND KORRIGIERT",
                geprueft=True,
                quelle_hash="veralteter-hash",
            )
        ],
    )
    gerufen: list[str] = []

    def _fake(*, titel: str, kurztext: object, inhalt_html: str, ziel: str):
        gerufen.append(ziel)
        return (f"T-{ziel}", f"K-{ziel}", f"<p>I-{ziel}</p>")

    monkeypatch.setattr(
        "src.features.announcements.service.fassung_erzeugen", _fake
    )
    AnnouncementService(db).uebersetzen("a1", nur_sprache="sv")

    # Kein API-Aufruf für die geprüfte Sprache — sie ist unerreichbar.
    assert "sv" not in gerufen
    sv = [
        r
        for r in db.tables["announcement_translations"]
        if r["sprache"] == "sv"
    ]
    assert len(sv) == 1
    assert sv[0]["titel"] == "VON HAND KORRIGIERT"
    assert sv[0]["geprueft"] is True


def test_maschinelle_fassung_wird_bei_textaenderung_ersetzt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Die Gegenprobe: NICHT geprüft + Original geändert → neu übersetzt.

    Ohne diesen Fall wäre der Schutz oben wertlos, weil er auch alles andere
    einfrieren könnte."""
    db = _db(
        announcements=[_ankuendigung()],
        announcement_translations=[
            _fassung(sprache="sv", geprueft=False, quelle_hash="veraltet")
        ],
    )
    monkeypatch.setattr(
        "src.features.announcements.service.fassung_erzeugen",
        lambda **k: (f"T-{k['ziel']}", None, "<p>neu</p>"),
    )
    AnnouncementService(db).uebersetzen("a1", nur_sprache="sv")
    sv = [
        r
        for r in db.tables["announcement_translations"]
        if r["sprache"] == "sv"
    ][0]
    assert sv["titel"] == "T-sv"
    assert sv["geprueft"] is False


def test_zweiter_lauf_ohne_textaenderung_ruft_nichts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Wurzel 2: Doppelklick/Retry darf keinen zweiten bezahlten Lauf auslösen.

    Der Quelltext ist unverändert, also passt der Hash — es gibt nichts zu tun.
    """
    db = _db(announcements=[_ankuendigung()])
    aufrufe: list[str] = []

    def _fake(**k: object):
        aufrufe.append(str(k["ziel"]))
        return ("t", None, "<p>i</p>")

    monkeypatch.setattr(
        "src.features.announcements.service.fassung_erzeugen", _fake
    )
    service = AnnouncementService(db)
    service.uebersetzen("a1")
    erste_runde = len(aufrufe)
    assert erste_runde == 23  # 24 Sprachen minus die Quellsprache

    service.uebersetzen("a1")
    assert len(aufrufe) == erste_runde, "zweiter Lauf hat erneut übersetzt"
    # Und keine doppelten Zeilen (UNIQUE-Backstop im Doppel abgebildet).
    sprachen = [r["sprache"] for r in db.tables["announcement_translations"]]
    assert len(sprachen) == len(set(sprachen)) == 24


def test_dienstausfall_schreibt_keine_zeile(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Wurzel 5/4: Fällt der Dienst aus, gibt es KEINE Fassung — und schon gar
    nicht den deutschen Ausgangstext unter `sv`."""

    def _kaputt(**_k: object):
        raise UebersetzungError("Dienst weg.")

    monkeypatch.setattr(
        "src.features.announcements.service.fassung_erzeugen", _kaputt
    )
    db = _db(announcements=[_ankuendigung()])
    with pytest.raises(UebersetzungError):
        AnnouncementService(db).uebersetzen("a1", nur_sprache="sv")

    fremd = [
        r
        for r in db.tables["announcement_translations"]
        if r["sprache"] != "de"
    ]
    assert fremd == [], "es wurde eine Fassung ohne Übersetzung abgelegt"


def test_korrigieren_setzt_geprueft_und_schuetzt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Eine Korrektur macht die Fassung geprüft — und damit unantastbar."""
    db = _db(
        announcements=[_ankuendigung()],
        announcement_translations=[_fassung(sprache="da", geprueft=False)],
    )
    service = AnnouncementService(db)
    service.fassung_korrigieren(
        "a1",
        "da",
        UebersetzungUpdate(
            titel="Rettet af et menneske",
            kurztext=None,
            inhalt_html="<p>Rettet</p>",
        ),
        geprueft_von="admin1",
    )
    da = [
        r
        for r in db.tables["announcement_translations"]
        if r["sprache"] == "da"
    ][0]
    assert da["geprueft"] is True
    assert da["geprueft_von"] == "admin1"

    # Ein anschließender Lauf lässt sie stehen.
    monkeypatch.setattr(
        "src.features.announcements.service.fassung_erzeugen",
        lambda **k: ("MASCHINE", None, "<p>x</p>"),
    )
    service.uebersetzen("a1", nur_sprache="da")
    da2 = [
        r
        for r in db.tables["announcement_translations"]
        if r["sprache"] == "da"
    ][0]
    assert da2["titel"] == "Rettet af et menneske"


def test_leser_ohne_fassung_bekommt_das_original() -> None:
    """Kein Fallback-Verstoß: fehlt die Fassung, kommt der ORIGINALTEXT — der
    einzige real existierende Text. Nicht eine leere oder erfundene Zeile."""
    db = _db(announcements=[_ankuendigung(titel="Deutsches Original")])
    liste = AnnouncementService(db).liste(_ctx(), sprache="lv")
    assert liste.items[0].titel == "Deutsches Original"


def test_leser_bekommt_seine_sprache() -> None:
    """Und liegt sie vor, gewinnt sie."""
    db = _db(
        announcements=[_ankuendigung(titel="Deutsches Original")],
        announcement_translations=[
            _fassung(sprache="sv", titel="Svensk version")
        ],
    )
    liste = AnnouncementService(db).liste(_ctx(), sprache="sv")
    assert liste.items[0].titel == "Svensk version"


def test_zu_langer_text_wird_abgelehnt() -> None:
    """Wurzel 8: harte Obergrenze VOR dem ersten API-Aufruf → 422."""
    db = _db(announcements=[_ankuendigung(inhalt_html="x" * (MAX_ZEICHEN + 1))])
    with pytest.raises(UebersetzungError) as exc:
        AnnouncementService(db).uebersetzen("a1")
    assert exc.value.status_code == 422


def test_hash_ignoriert_nicht_uebersetzbare_felder() -> None:
    """`als_popup` umzuschalten ist keine Textänderung und darf keinen
    (kostenpflichtigen) Neu-Lauf auslösen."""
    a = quelle_hash("t", "k", "<p>i</p>")
    b = quelle_hash("t", "k", "<p>i</p>")
    assert a == b
    assert quelle_hash("t", "k", "<p>anders</p>") != a


def test_hash_trennt_die_felder() -> None:
    """Ohne Trennzeichen ergäben Titel „AB"/Kurztext „C" und „A"/„BC" denselben
    Hash — eine Änderung bliebe unbemerkt und die Übersetzung veraltete still."""
    assert quelle_hash("AB", "C", "") != quelle_hash("A", "BC", "")
