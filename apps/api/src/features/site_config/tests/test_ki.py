"""Tests für den KI-Assistenten des Website-Baukastens (0463–0465).

Was hier NICHT getestet wird: dass Gemini gute Texte schreibt. Das ist keine
Eigenschaft, die ein Test feststellen kann, und ein Test, der es behauptet,
wäre schlimmer als keiner. Der echte Aufruf wird end-to-end geprüft
(`scripts/diagnose/ki-vertex-pruefen.py --aufruf`).

Was hier getestet wird, ist alles, was UNSER Code entscheidet:

* Fehlt die Konfiguration, meldet der Client das — er wirft nicht.
* Der Prompt enthält NUR erfasste Daten (Wurzel 4).
* Ein fremdes Objekt kommt nicht in den Kontext (Wurzel 3).
* Neu erzeugter Text löscht eine frühere Freigabe (Wurzel 1).
* Ohne Freigabe geht nichts live (EU AI Act Art. 50 Abs. 4).
* Der Tagesdeckel greift VOR dem Aufruf und meldet LAUT (Wurzel 5).
* Eine unbekannte Sprache ist ein Fehler, kein stiller Rückfall auf Deutsch.
"""
from __future__ import annotations

import pytest
from pydantic import SecretStr

from src.core.ki import KiAntwort, KiError, VertexClient
from src.features.site_config import ki_herkunft, ki_nutzung, ki_profil, ki_texte
from src.features.site_config.fehler import SiteConfigError

from .test_site_config import _DB  # Fake-DB-Mock des Slice

TENANT = "tenant-a"
FREMD = "tenant-b"


def _antwort(text: str = "fertig", abschluss: str = "STOP") -> KiAntwort:
    return KiAntwort(
        text=text,
        modell="gemini-2.5-flash",
        region="europe-west4",
        dauer_ms=42,
        tokens_ein=100,
        tokens_aus=20,
        abschlussgrund=abschluss,
    )


class _FakeClient:
    """Ein Vertex-Client, der nicht ins Netz geht.

    Er merkt sich den letzten Prompt — das ist der eigentliche Prüfgegenstand
    mehrerer Tests: WAS an das Modell geschickt worden wäre.
    """

    def __init__(self, antwort: KiAntwort | None = None) -> None:
        self.antwort = antwort or _antwort()
        self.letzter_system = ""
        self.letzter_user = ""
        self.aufrufe = 0

    is_configured = True
    modell = "gemini-2.5-flash"
    region = "europe-west4"

    def erzeuge(
        self, *, system: str, user: str, temperature: float = 0.3, max_tokens: int = 800
    ) -> KiAntwort:
        del temperature, max_tokens
        self.aufrufe += 1
        self.letzter_system = system
        self.letzter_user = user
        return self.antwort


@pytest.fixture
def db() -> _DB:
    d = _DB({})
    d.tables["tenants"] = [{"id": TENANT, "name": "Nordlicht Ferien"}]
    d.tables["tenant_billing_profile"] = [
        {
            "tenant_id": TENANT,
            "legal_name": "Nordlicht Ferien ApS",
            "company_city": "Bindslev",
            "company_country": "DK",
            "company_street": "Hovedgaden",
            "company_house_number": "12",
            "company_postal_code": "9881",
            "email": "post@example.test",
            "phone_number": "+45 00 00 00 00",
        }
    ]
    d.tables["properties"] = [
        {
            "id": "obj-1",
            "tenant_id": TENANT,
            "title": "Feriehus Kornblomst",
            "description": "Holzhaus am Deich.",
            "property_type": "house",
            "city": "Bindslev",
            "country": "DK",
            "max_guests": 6,
            "amenities": ["wifi", "sauna"],
            "type_attributes": {"schlafzimmer": 3, "betten": 4},
            "status": "active",
            "archived_at": None,
        },
        {
            "id": "obj-fremd",
            "tenant_id": FREMD,
            "title": "Villa Geheim",
            "description": "Gehoert einem anderen Betrieb.",
            "property_type": "house",
            "city": "Kopenhagen",
            "country": "DK",
            "max_guests": 2,
            "amenities": ["pool"],
            "type_attributes": {},
            "status": "active",
            "archived_at": None,
        },
    ]
    d.tables["site_pages"] = []
    d.tables["site_blocks"] = []
    d.tables["site_ai_profile"] = []
    d.tables["site_ai_usage"] = []
    return d


# === Konfiguration ==========================================================


def test_ohne_schluessel_meldet_der_client_statt_zu_werfen(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fehlt die Umgebungsvariable, ist die Funktion NICHT VERFÜGBAR — sie
    stürzt nicht ab. Genau daran hängt, dass die UI den Knopf gar nicht erst
    zeigt."""
    from src.core.config import get_settings
    from src.core.ki import client as ki_client

    # Die EINSTELLUNGEN werden ersetzt, nicht die Umgebungsvariablen.
    #
    # `monkeypatch.setenv(…, "")` reichte, solange niemand eine `.env` mit
    # echten Werten hatte. Seit die Vertex-Anbindung eingerichtet ist
    # (25.08.2026), liest `get_settings()` sie von dort — und der Test prüfte
    # den Zustand „eingerichtet" gegen die Erwartung „nicht eingerichtet".
    #
    # Ein Test, dessen Ergebnis davon abhängt, ob auf dem Rechner eine Datei
    # liegt, prüft nicht die Sache, sondern die Umgebung (dieselbe Klasse wie
    # ein zeitzonenabhängiger Test).
    echte = get_settings()
    ohne = echte.model_copy(
        update={
            "vertex_service_account_b64": SecretStr(""),
            "vertex_project_id": "",
        }
    )
    monkeypatch.setattr(ki_client, "get_settings", lambda: ohne)
    ki_client._credentials.cache_clear()  # noqa: SLF001
    try:
        assert VertexClient().is_configured is False
    finally:
        ki_client._credentials.cache_clear()  # noqa: SLF001


def test_unlesbarer_schluessel_ist_nicht_konfiguriert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ein gesetzter, aber kaputter Schlüssel darf keinen 500 werfen — er ist
    eine Fehlkonfiguration und wird als „nicht eingerichtet" behandelt (LAUT
    geloggt, siehe ki_client)."""
    from src.core.config import get_settings
    from src.core.ki import client as ki_client

    monkeypatch.setenv("VERTEX_SERVICE_ACCOUNT_B64", "das-ist-kein-base64!!!")
    monkeypatch.setenv("VERTEX_PROJECT_ID", "projekt")
    get_settings.cache_clear()
    ki_client._credentials.cache_clear()  # noqa: SLF001
    try:
        assert VertexClient().is_configured is False
    finally:
        get_settings.cache_clear()
        ki_client._credentials.cache_clear()  # noqa: SLF001


# === Wurzel 4: nichts erfinden ==============================================


def test_kontext_enthaelt_nur_erfasste_angaben(db: _DB) -> None:
    """Was nicht in der Zeile steht, steht nicht im Prompt.

    Das Objekt hat keine Badezimmerzahl und keine Größe — beides darf im
    Kontext nicht auftauchen, auch nicht als „unbekannt" oder „k. A.". Ein
    Sprachmodell füllt genau solche Lücken auf.
    """
    abgeleitet = ki_profil.abgeleitetes_profil(db, TENANT)
    text = ki_profil.kontext_text(abgeleitet, ki_profil.KiProfil())
    assert "Feriehus Kornblomst" in text
    assert "Schlafzimmer: 3" in text
    assert "Badezimmer" not in text
    assert "Größe" not in text


def test_fremdes_objekt_kommt_nicht_in_den_kontext(db: _DB) -> None:
    """Wurzel 3: der Kontext ist tenant-gescoped. Sonst wäre der KI-Knopf ein
    Weg, sich die Objekte des Wettbewerbers vorlesen zu lassen."""
    abgeleitet = ki_profil.abgeleitetes_profil(db, TENANT)
    text = ki_profil.kontext_text(abgeleitet, ki_profil.KiProfil())
    assert "Villa Geheim" not in text
    assert abgeleitet.objekte_gesamt == 1


def test_fremde_objekt_id_wird_abgewiesen(db: _DB) -> None:
    """Fail-closed statt stillem Übergehen: eine fremde ID darf nicht dazu
    führen, dass ein Text über den falschen Betrieb entsteht."""
    with pytest.raises(SiteConfigError) as exc:
        ki_profil.abgeleitetes_profil(db, TENANT, property_id="obj-fremd")
    assert exc.value.status_code == 404


def test_systemanweisung_verbietet_erfinden_ausdruecklich(db: _DB) -> None:
    """Das Verbot muss im Prompt STEHEN, nicht nur in unserem Kopf."""
    client = _FakeClient(_antwort("Ein Absatz."))
    ki_texte.abschnitt_erzeugen(
        client,
        db,
        TENANT,
        ki_texte.AbschnittRequest(
            sprache="de", auftrag="Absatz über die Lage", woerter=80
        ),
        ki_profil.KiProfil(),
    )
    assert "NICHTS ERFINDEN" in client.letzter_system
    assert "Feriehus Kornblomst" in client.letzter_user


# === Mehrsprachigkeit =======================================================


def test_erzeugt_in_der_sprache_der_seitenfassung(db: _DB) -> None:
    """Die Zielsprache steht ausdrücklich in der Anweisung — sie wird nicht aus
    dem Kontext geraten."""
    client = _FakeClient()
    ki_texte.abschnitt_erzeugen(
        client,
        db,
        TENANT,
        ki_texte.AbschnittRequest(sprache="da", auftrag="Om stedet", woerter=60),
        ki_profil.KiProfil(),
    )
    assert "ausschließlich auf Dänisch" in client.letzter_system


def test_unbekannte_sprache_faellt_nicht_auf_deutsch_zurueck(db: _DB) -> None:
    """Kein erfundener Ersatzwert (Wurzel 4): ein Text in der falschen Sprache
    sieht richtig aus und ist falsch."""
    with pytest.raises(SiteConfigError) as exc:
        ki_texte.abschnitt_erzeugen(
            _FakeClient(),
            db,
            TENANT,
            ki_texte.AbschnittRequest(sprache="xx", auftrag="Test", woerter=50),
            ki_profil.KiProfil(),
        )
    assert exc.value.status_code == 422


# === Umschreiben ============================================================


def test_ton_ohne_tonangabe_wird_abgewiesen() -> None:
    """„Ton ändern" ohne Ton könnte man mit „freundlicher" füllen — genau das
    verbietet Wurzel 4."""
    with pytest.raises(ValueError, match="Tonfall"):
        ki_texte.UmschreibenRequest(text="Hallo", art="ton", sprache="de")


def test_uebersetzen_ohne_zielsprache_wird_abgewiesen() -> None:
    with pytest.raises(ValueError, match="Zielsprache"):
        ki_texte.UmschreibenRequest(text="Hallo", art="uebersetzen", sprache="de")


def test_umschreiben_meldet_abgeschnittenen_text(db: _DB) -> None:
    """MAX_TOKENS heißt: der Text endet mitten im Satz und SIEHT fertig aus.
    Wurzel 5 — nicht still kürzen, sondern sagen."""
    del db
    client = _FakeClient(_antwort("Halber Satz", abschluss="MAX_TOKENS"))
    _text, _antw, warnungen = ki_texte.umschreiben(
        client,
        ki_texte.UmschreibenRequest(text="Ein langer Text.", art="kuerzen", sprache="de"),
        ki_profil.KiProfil(),
    )
    assert any("abgeschnitten" in w for w in warnungen)


def test_verbotene_woerter_werden_nach_der_erzeugung_gemeldet(db: _DB) -> None:
    """Ein Sprachmodell hält sich an Verbote ungefähr. Die mechanische Prüfung
    danach ist der Unterschied zwischen „gebeten" und „geprüft"."""
    del db
    client = _FakeClient(_antwort("Dieses einzigartige Juwel am Meer."))
    profil = ki_profil.KiProfil(verbotene_woerter=["einzigartig", "Juwel"])
    _text, _antw, warnungen = ki_texte.umschreiben(
        client,
        ki_texte.UmschreibenRequest(text="Text", art="verlaengern", sprache="de"),
        profil,
    )
    assert any("einzigartig" in w and "Juwel" in w for w in warnungen)


def test_antwort_ohne_umrandung(db: _DB) -> None:
    """Das Modell setzt gern Anführungszeichen um seine Antwort, obwohl die
    Anweisung es verbietet. Die Verpackung wegzunehmen ist keine Erfindung."""
    del db
    client = _FakeClient(_antwort('"Der fertige Satz."'))
    text, _antw, _w = ki_texte.umschreiben(
        client,
        ki_texte.UmschreibenRequest(text="x", art="rechtschreibung", sprache="de"),
        ki_profil.KiProfil(),
    )
    assert text == "Der fertige Satz."


# === SEO ====================================================================


def test_seo_ohne_seiteninhalt_wird_abgewiesen(db: _DB) -> None:
    """Ohne Text gäbe es nur eine erfundene Beschreibung. Fail-closed statt
    „dann eben aus dem Titel"."""
    db.tables["site_pages"].append(
        {"id": "s1", "tenant_id": TENANT, "title": "Leer", "slug": "leer"}
    )
    with pytest.raises(SiteConfigError) as exc:
        ki_texte.seo_erzeugen(
            _FakeClient(),
            db,
            TENANT,
            ki_texte.SeoRequest(page_id="s1", sprache="de"),
            ki_profil.KiProfil(),
        )
    assert exc.value.status_code == 422


def test_seo_fremde_seite_ist_404(db: _DB) -> None:
    """Wurzel 9: derselbe Scope wie der Listenpfad."""
    db.tables["site_pages"].append(
        {"id": "s-fremd", "tenant_id": FREMD, "title": "Fremd", "slug": "f"}
    )
    with pytest.raises(SiteConfigError) as exc:
        ki_texte.seo_erzeugen(
            _FakeClient(),
            db,
            TENANT,
            ki_texte.SeoRequest(page_id="s-fremd", sprache="de"),
            ki_profil.KiProfil(),
        )
    assert exc.value.status_code == 404


def test_seo_meldet_zu_langen_titel(db: _DB) -> None:
    """Melden, nicht kappen: ein bei 60 Zeichen abgeschnittener Titel endet
    mitten im Wort."""
    db.tables["site_pages"].append(
        {"id": "s2", "tenant_id": TENANT, "title": "Haus", "slug": "haus"}
    )
    db.tables["site_blocks"].append(
        {
            "id": "b1",
            "tenant_id": TENANT,
            "page_id": "s2",
            "type": "text",
            "position": 0,
            "content": {"body": {"de": "Ein Haus am Deich mit drei Schlafzimmern."}},
        }
    )
    langer_titel = "T" * 80
    client = _FakeClient(_antwort(f"{langer_titel}\nEine Beschreibung."))
    _t, _b, _a, warnungen = ki_texte.seo_erzeugen(
        client,
        db,
        TENANT,
        ki_texte.SeoRequest(page_id="s2", sprache="de"),
        ki_profil.KiProfil(),
    )
    assert any("Titel" in w and "60" in w for w in warnungen)


def test_seo_nimmt_die_richtige_sprachfassung(db: _DB) -> None:
    """Fehlt die angeforderte Fassung, wird der Abschnitt übersprungen — NICHT
    die deutsche ersatzweise genommen. Eine englische Meta-Beschreibung aus
    deutschem Text passt zur Seite nicht."""
    db.tables["site_pages"].append(
        {"id": "s3", "tenant_id": TENANT, "title": "Haus", "slug": "haus"}
    )
    db.tables["site_blocks"].extend(
        [
            {
                "id": "b-de",
                "tenant_id": TENANT,
                "page_id": "s3",
                "type": "text",
                "position": 0,
                "content": {"body": {"de": "NUR-DEUTSCH"}},
            },
            {
                "id": "b-en",
                "tenant_id": TENANT,
                "page_id": "s3",
                "type": "text",
                "position": 1,
                "content": {"body": {"en": "ONLY-ENGLISH"}},
            },
        ]
    )
    client = _FakeClient(_antwort("Titel\nBeschreibung"))
    ki_texte.seo_erzeugen(
        client,
        db,
        TENANT,
        ki_texte.SeoRequest(page_id="s3", sprache="en"),
        ki_profil.KiProfil(),
    )
    assert "ONLY-ENGLISH" in client.letzter_user
    assert "NUR-DEUTSCH" not in client.letzter_user


# === Herkunft und Freigabe (EU AI Act) ======================================


def test_neu_erzeugter_text_loescht_fruehere_freigabe(db: _DB) -> None:
    """Wurzel 1 — der Gegenzustand. Ein freigegebener Haken über einem Text,
    den nie jemand gelesen hat, wäre der gefährlichste Zustand des Moduls."""
    db.tables["site_blocks"].append(
        {
            "id": "b9",
            "tenant_id": TENANT,
            "page_id": "s9",
            "content_origin": "ai_generated",
            "ai_reviewed_at": "2026-08-01T00:00:00Z",
            "ai_reviewed_by": "user-1",
        }
    )
    ki_herkunft.herkunft_setzen(
        db,
        TENANT,
        tabelle="site_blocks",
        zeilen_id="b9",
        herkunft=ki_herkunft.Herkunft.ai_generated,
        modell="gemini-2.5-flash",
    )
    zeile = db.tables["site_blocks"][0]
    assert zeile["content_origin"] == "ai_generated"
    assert zeile["ai_reviewed_at"] is None
    assert zeile["ai_reviewed_by"] is None
    assert zeile["ai_model"] == "gemini-2.5-flash"


def test_human_raeumt_die_ki_felder_ab(db: _DB) -> None:
    db.tables["site_blocks"].append(
        {
            "id": "b8",
            "tenant_id": TENANT,
            "page_id": "s8",
            "content_origin": "ai_generated",
            "ai_model": "gemini-2.5-flash",
            "ai_generated_at": "2026-08-01T00:00:00Z",
        }
    )
    ki_herkunft.herkunft_setzen(
        db,
        TENANT,
        tabelle="site_blocks",
        zeilen_id="b8",
        herkunft=ki_herkunft.Herkunft.human,
    )
    zeile = db.tables["site_blocks"][0]
    assert zeile["content_origin"] == "human"
    assert zeile["ai_model"] is None
    assert zeile["ai_generated_at"] is None


def test_freigabe_nur_auf_erzeugtem_text(db: _DB) -> None:
    """Sonst füllt sich das Feld mit bedeutungslosen Haken, und die Frage „was
    ist hier tatsächlich geprüft worden?" ist nicht mehr beantwortbar."""
    db.tables["site_blocks"].append(
        {"id": "b7", "tenant_id": TENANT, "page_id": "s7", "content_origin": "human"}
    )
    with pytest.raises(SiteConfigError) as exc:
        ki_herkunft.freigeben(
            db, TENANT, tabelle="site_blocks", zeilen_id="b7", user_id="user-1"
        )
    assert exc.value.status_code == 422


def test_freigabe_speichert_person_und_zeitpunkt(db: _DB) -> None:
    """Ohne Person trägt niemand die redaktionelle Verantwortung, und die
    Ausnahme aus Art. 50 Abs. 4 greift nicht."""
    db.tables["site_blocks"].append(
        {
            "id": "b6",
            "tenant_id": TENANT,
            "page_id": "s6",
            "content_origin": "ai_generated",
        }
    )
    ki_herkunft.freigeben(
        db, TENANT, tabelle="site_blocks", zeilen_id="b6", user_id="user-42"
    )
    zeile = db.tables["site_blocks"][0]
    assert zeile["ai_reviewed_by"] == "user-42"
    assert zeile["ai_reviewed_at"]


def test_freigabe_fremder_zeile_ist_404(db: _DB) -> None:
    db.tables["site_blocks"].append(
        {
            "id": "b-fremd",
            "tenant_id": FREMD,
            "page_id": "sx",
            "content_origin": "ai_generated",
        }
    )
    with pytest.raises(SiteConfigError) as exc:
        ki_herkunft.freigeben(
            db, TENANT, tabelle="site_blocks", zeilen_id="b-fremd", user_id="u"
        )
    assert exc.value.status_code == 404


def test_veroeffentlichung_ohne_freigabe_blockiert(db: _DB) -> None:
    """Der Zahn. Ohne ihn wäre die Freigabe Kosmetik."""
    db.tables["site_pages"].append(
        {"id": "s5", "tenant_id": TENANT, "content_origin": "human"}
    )
    db.tables["site_blocks"].extend(
        [
            {
                "id": "b5a",
                "tenant_id": TENANT,
                "page_id": "s5",
                "content_origin": "ai_generated",
                "ai_reviewed_at": None,
            },
            {
                "id": "b5b",
                "tenant_id": TENANT,
                "page_id": "s5",
                "content_origin": "ai_generated",
                "ai_reviewed_at": None,
            },
        ]
    )
    with pytest.raises(SiteConfigError) as exc:
        ki_herkunft.veroeffentlichung_pruefen(db, TENANT, "s5")
    assert exc.value.status_code == 422
    # Die ZAHL steht in der Meldung — „es fehlt noch eine Freigabe" schickt den
    # Betrieb auf die Suche.
    assert "2" in exc.value.message


def test_veroeffentlichung_nach_freigabe_geht_durch(db: _DB) -> None:
    db.tables["site_pages"].append(
        {"id": "s4", "tenant_id": TENANT, "content_origin": "human"}
    )
    db.tables["site_blocks"].append(
        {
            "id": "b4",
            "tenant_id": TENANT,
            "page_id": "s4",
            "content_origin": "ai_generated",
            "ai_reviewed_at": "2026-08-25T10:00:00Z",
        }
    )
    ki_herkunft.veroeffentlichung_pruefen(db, TENANT, "s4")  # wirft nicht


def test_umgeschriebener_text_blockiert_nicht(db: _DB) -> None:
    """Assistierende Bearbeitung braucht keine Freigabe — sonst bräuchte eine
    24-sprachige Website 23 Freigaben je Absatz."""
    db.tables["site_pages"].append(
        {"id": "s3b", "tenant_id": TENANT, "content_origin": "ai_rewritten"}
    )
    db.tables["site_blocks"].append(
        {
            "id": "b3b",
            "tenant_id": TENANT,
            "page_id": "s3b",
            "content_origin": "ai_rewritten",
        }
    )
    ki_herkunft.veroeffentlichung_pruefen(db, TENANT, "s3b")


# === Kennzeichnung im Renderer ==============================================


def test_kennzeichnung_ohne_erzeugten_text_ist_none() -> None:
    """Der Normalfall darf nichts kosten und nichts in die Seite schreiben."""
    assert (
        ki_herkunft.kennzeichnung_fuer_renderer(
            {"content_origin": "human", "page_type": "normal"},
            [{"content_origin": "ai_rewritten"}],
        )
        is None
    )


def test_kennzeichnung_bei_objektseite_ohne_fusshinweis() -> None:
    """Eine normale Seite ist Werbung — Meta-Tag ja, Gast-Banner nein."""
    kz = ki_herkunft.kennzeichnung_fuer_renderer(
        {"content_origin": "human", "page_type": "normal"},
        [{"content_origin": "ai_generated", "ai_model": "gemini-2.5-flash"}],
    )
    assert kz == {
        "erzeugt": True,
        "modell": "gemini-2.5-flash",
        "fusshinweis": False,
    }


def test_kennzeichnung_bei_blogbeitrag_mit_fusshinweis() -> None:
    """Ein Beitrag kann die Grenze zum öffentlichen Interesse reißen, und man
    sieht es ihm beim Schreiben nicht an."""
    kz = ki_herkunft.kennzeichnung_fuer_renderer(
        {
            "content_origin": "ai_generated",
            "page_type": "post",
            "ai_model": "gemini-2.5-flash",
        },
        [],
    )
    assert kz is not None
    assert kz["fusshinweis"] is True


# === Tagesdeckel und Zählung ================================================


def test_deckel_greift_vor_dem_aufruf(db: _DB, monkeypatch: pytest.MonkeyPatch) -> None:
    """VOR dem Aufruf: der Deckel soll den bezahlten Aufruf verhindern, nicht
    ihn nachträglich beklagen."""
    from src.core.config import get_settings

    monkeypatch.setenv("KI_TAGESLIMIT_JE_TENANT", "2")
    get_settings.cache_clear()
    try:
        heute = ki_nutzung._heute()  # noqa: SLF001
        db.tables["site_ai_usage"].extend(
            [
                {"id": f"u{i}", "tenant_id": TENANT, "tag": heute, "erfolg": True}
                for i in range(2)
            ]
        )
        with pytest.raises(KiError) as exc:
            ki_nutzung.deckel_pruefen(db, TENANT)
        assert exc.value.status_code == 429
        # LAUT melden heißt: mit Zahlen. „Limit erreicht" ohne Stand ist eine
        # Sackgasse.
        assert "2" in exc.value.message
    finally:
        get_settings.cache_clear()


def test_fehlgeschlagene_aufrufe_zaehlen_nicht_gegen_den_deckel(db: _DB) -> None:
    """Ein Netzwerkfehler ist nicht das Verschulden des Betriebs und kostet
    nichts."""
    heute = ki_nutzung._heute()  # noqa: SLF001
    db.tables["site_ai_usage"].extend(
        [
            {"id": "u1", "tenant_id": TENANT, "tag": heute, "erfolg": False},
            {"id": "u2", "tenant_id": TENANT, "tag": heute, "erfolg": True},
        ]
    )
    assert ki_nutzung.verbrauch_heute(db, TENANT) == 1


def test_verbrauch_ist_pro_betrieb(db: _DB) -> None:
    heute = ki_nutzung._heute()  # noqa: SLF001
    db.tables["site_ai_usage"].extend(
        [
            {"id": "u1", "tenant_id": TENANT, "tag": heute, "erfolg": True},
            {"id": "u2", "tenant_id": FREMD, "tag": heute, "erfolg": True},
        ]
    )
    assert ki_nutzung.verbrauch_heute(db, TENANT) == 1


def test_buchung_haelt_modell_und_region_fest(db: _DB) -> None:
    """Die Frage „wurde das in der EU verarbeitet?" ist eine Frage an die
    Daten, nicht an eine Logzeile, die nach 14 Tagen rotiert ist."""
    ki_nutzung.buchen(
        db, TENANT, user_id="u1", funktion="abschnitt", antwort=_antwort()
    )
    zeile = db.tables["site_ai_usage"][0]
    assert zeile["region"] == "europe-west4"
    assert zeile["modell"] == "gemini-2.5-flash"
    assert zeile["tokens_ein"] == 100
    assert zeile["erfolg"] is True


def test_unbekannte_funktion_wird_nicht_gebucht(db: _DB) -> None:
    """Der check-Constraint der Tabelle würde es ohnehin ablehnen — dann stünde
    aber ein 23514 im Log statt der Aussage, dass jemand einen Funktionsnamen
    erfunden hat."""
    ki_nutzung.fehler_buchen(
        db,
        TENANT,
        user_id="u1",
        funktion="gibtsnicht",
        modell="m",
        region="r",
        grund="x",
    )
    assert db.tables["site_ai_usage"] == []


# === Geschäftsprofil ========================================================


def test_profil_ist_leer_ohne_zeile(db: _DB) -> None:
    """Der Normalfall vor dem ersten Speichern — kein Fehler, kein Assistent,
    der sich vor die Funktion stellt."""
    profil = ki_profil.profil_lesen(db, TENANT)
    assert profil.ton is None
    assert profil.verbotene_woerter == []


def test_profil_speichern_und_lesen(db: _DB) -> None:
    ki_profil.profil_speichern(
        db,
        TENANT,
        ki_profil.KiProfil(
            ton="  ruhig und sachlich  ",
            verbotene_woerter=["Oase", " oase ", "", "Juwel"],
        ),
    )
    profil = ki_profil.profil_lesen(db, TENANT)
    assert profil.ton == "ruhig und sachlich"
    # Getrimmt, ohne Leereintrag, ohne Dublette (auch bei anderer Schreibweise).
    assert profil.verbotene_woerter == ["Oase", "Juwel"]


def test_profil_leerer_string_wird_none(db: _DB) -> None:
    """Einen leeren String zu speichern hieße, eine leere Zeile in jeden Prompt
    zu schreiben."""
    del db
    assert ki_profil.KiProfil(zielgruppe="   ").zielgruppe is None


def test_profil_vorschlag_braucht_objekte(db: _DB) -> None:
    """Ohne erfasste Daten gäbe es nur einen erfundenen Vorschlag."""
    db.tables["properties"] = []
    with pytest.raises(SiteConfigError) as exc:
        ki_texte.profil_vorschlagen(_FakeClient(), db, TENANT)
    assert exc.value.status_code == 422


def test_profil_vorschlag_liest_die_drei_zeilen(db: _DB) -> None:
    client = _FakeClient(
        _antwort(
            "TON: ruhig und sachlich\n"
            "ZIELGRUPPE: Familien mit Kindern\n"
            "ALLEINSTELLUNG: "
        )
    )
    vorschlag, _antw = ki_texte.profil_vorschlagen(client, db, TENANT)
    assert vorschlag["ton"] == "ruhig und sachlich"
    assert vorschlag["zielgruppe"] == "Familien mit Kindern"
    # Nicht belegbar → leer, kein erfundener Satz.
    assert vorschlag["alleinstellung"] is None
