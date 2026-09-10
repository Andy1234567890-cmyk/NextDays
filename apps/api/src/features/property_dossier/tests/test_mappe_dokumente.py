"""Tests fuer die digitale Mappe: PDF hochladen, lesen lassen, uebernehmen.

Der Kern, den diese Datei festhaelt:

* Es wird NICHTS geschrieben, was ein Mensch nicht bestaetigt hat. OCR liest
  falsch, und ein falscher Tuercode faellt dem GAST auf, nicht dem Betrieb.
* Ein GEPFLEGTES Feld wird nicht ueberschrieben. Ein alter Scan darf die
  Wahrheit des Betriebs nicht ersetzen (Wurzel 1).
* Eine Angabe geht in BEIDE Heimaten. Am 11.08.2026 gingen sechs Anreise-Mails
  nicht hinaus, weil die Vorlage `{{wifi_ssid}}` benutzte, gepflegt war aber
  nur `{{WifiInformation}}` — ein Vorschlag, der nur eine Seite fuellt, baut
  diesen Fehler nach.
* Was das Modell liefert, ist Client-Input zweiter Ordnung: HTML wird
  sanitisiert, bevor es in `type_attributes` geht (Wurzel 8).
"""

from types import SimpleNamespace
from typing import Any

import pytest

from src.core.ki import KiAntwort, KiError
from src.features.property_dossier.mappe_dokumente import MAX_DOKUMENTE_JE_MAPPE
from src.features.property_dossier.schemas import MappeVorschlag
from src.features.property_dossier.service import (
    DossierError,
    PropertyDossierService,
)

TID = "t1"
PID = "11111111-1111-4111-8111-111111111111"
DID = "22222222-2222-4222-8222-222222222222"
FREMD_PID = "44444444-4444-4444-8444-444444444444"

PDF = b"%PDF-1.7\nnur ein Testrumpf"


class _Kette:
    """Ein Abfrage-Stub, der Schreibvorgaenge mitschreibt.

    Anders als der Stub in `test_property_dossier.py` merkt sich dieser, WAS
    geschrieben wurde — ohne das liesse sich der Kern dieser Datei (was landet
    wirklich im Feld?) nicht pruefen.
    """

    def __init__(self, tabelle: str, daten: Any, protokoll: list[tuple]) -> None:
        self._tabelle = tabelle
        self._daten = daten
        self._protokoll = protokoll
        self._count = len(daten) if isinstance(daten, list) else 0

    def select(self, *_a: object, **kw: object) -> "_Kette":
        return self

    def insert(self, werte: Any) -> "_Kette":
        self._protokoll.append(("insert", self._tabelle, werte))
        # Eine eingefuegte Zeile bekommt eine ID, wie es die DB taete.
        self._daten = [{**werte, "id": DID}] if isinstance(werte, dict) else werte
        return self

    def update(self, werte: Any) -> "_Kette":
        self._protokoll.append(("update", self._tabelle, werte))
        return self

    def upsert(self, werte: Any, **_kw: object) -> "_Kette":
        self._protokoll.append(("upsert", self._tabelle, werte))
        return self

    def delete(self) -> "_Kette":
        self._protokoll.append(("delete", self._tabelle, None))
        return self

    def __getattr__(self, _name: str) -> "_Kette":
        return self

    def __call__(self, *_a: object, **_k: object) -> "_Kette":
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._daten, count=self._count)


class _Speicher:
    def __init__(self, protokoll: list[tuple]) -> None:
        self._protokoll = protokoll

    def upload(self, pfad: str, _inhalt: bytes, _kopf: dict) -> None:
        self._protokoll.append(("upload", pfad, None))

    def remove(self, pfade: list[str]) -> None:
        self._protokoll.append(("remove", pfade, None))

    def create_signed_url(self, pfad: str, _ttl: int) -> dict:
        return {"signedURL": f"https://example.test/{pfad}?sig=x"}


class _DB:
    def __init__(self, tabellen: dict[str, Any], protokoll: list[tuple]) -> None:
        self._tabellen = tabellen
        self._protokoll = protokoll
        self.storage = SimpleNamespace(from_=lambda _b: _Speicher(protokoll))

    def table(self, name: str) -> _Kette:
        return _Kette(name, self._tabellen.get(name, []), self._protokoll)


class _KiStub:
    """Ein Vertex-Ersatz, der eine feste Antwort liefert."""

    def __init__(self, text: str) -> None:
        self._text = text

    def erzeuge_multimodal(self, **_kw: object) -> KiAntwort:
        return KiAntwort(
            text=self._text,
            modell="test",
            region="test",
            dauer_ms=1,
            tokens_ein=1,
            tokens_aus=1,
            abschlussgrund="STOP",
        )


def _svc(
    tabellen: dict[str, Any] | None = None,
    *,
    owns: bool = True,
    protokoll: list[tuple] | None = None,
) -> tuple[PropertyDossierService, list[tuple]]:
    p = protokoll if protokoll is not None else []
    basis: dict[str, Any] = {
        "properties": [{"id": PID, "type_attributes": {}}] if owns else [],
        "mappe_dokument": [],
        "property_guest_portal": [],
        "site_ai_usage": [],
    }
    basis.update(tabellen or {})
    return PropertyDossierService(client=_DB(basis, p)), p  # type: ignore[arg-type]


def _dokumentzeile(**felder: Any) -> dict:
    return {
        "id": DID,
        "tenant_id": TID,
        "property_id": PID,
        "mappe": "gast",
        "datei_name": "Hausordnung.pdf",
        "datei_pfad": f"{TID}/{PID}/abc.pdf",
        "datei_groesse_bytes": 1234,
        "seiten": 2,
        "auswertung": "gelesen",
        "auswertung_hinweis": None,
        "ausgewertet_am": None,
        "created_at": "2026-09-09T10:00:00+00:00",
        **felder,
    }


# --- Scope (Wurzel 3/9) ------------------------------------------------------
def test_fremdes_objekt_ist_404() -> None:
    svc, _ = _svc(owns=False)
    with pytest.raises(DossierError) as exc:
        svc.mappe_dokumente(TID, PID, "gast")
    assert exc.value.status_code == 404


def test_dokument_eines_fremden_objekts_ist_404() -> None:
    """Der Einzelzugriff prueft denselben Scope wie die Liste.

    Ohne diese Pruefung liesse sich mit einer fremden `dokument_id` die
    Hausordnung eines anderen Objekts oeffnen — samt Tuercode (Wurzel 9).
    """
    svc, _ = _svc({"mappe_dokument": []})
    with pytest.raises(DossierError) as exc:
        svc.mappe_dokument_url(TID, PID, DID)
    assert exc.value.status_code == 404


def test_unbekannte_mappe_ist_422() -> None:
    svc, _ = _svc()
    with pytest.raises(DossierError) as exc:
        svc.mappe_dokumente(TID, PID, "keller")
    assert exc.value.status_code == 422


# --- Upload-Pruefungen (Wurzel 8) -------------------------------------------
def test_nicht_pdf_wird_abgewiesen() -> None:
    """Magic-Bytes, nicht der content_type des Clients."""
    svc, prot = _svc()
    with pytest.raises(DossierError) as exc:
        svc.mappe_dokument_lesen(
            TID,
            property_id=PID,
            mappe="gast",
            inhalt=b"<html>kein PDF</html>",
            dateiname="tarnung.pdf",
            user_id="u1",
        )
    assert exc.value.status_code == 422
    assert not [e for e in prot if e[0] == "upload"], "nichts darf abgelegt werden"


def test_zu_grosse_datei_wird_abgewiesen() -> None:
    svc, _ = _svc()
    with pytest.raises(DossierError) as exc:
        svc.mappe_dokument_lesen(
            TID,
            property_id=PID,
            mappe="gast",
            inhalt=PDF + b"x" * (21 * 1024 * 1024),
            dateiname="riesig.pdf",
            user_id="u1",
        )
    assert exc.value.status_code == 422


def test_volle_mappe_wird_abgewiesen() -> None:
    """Wurzel 8: auch die Zahl der Dokumente ist ein unbegrenzter Bereich."""
    svc, _ = _svc(
        {"mappe_dokument": [_dokumentzeile() for _ in range(MAX_DOKUMENTE_JE_MAPPE)]}
    )
    with pytest.raises(DossierError) as exc:
        svc.mappe_dokument_lesen(
            TID,
            property_id=PID,
            mappe="gast",
            inhalt=PDF,
            dateiname="eins-zuviel.pdf",
            user_id="u1",
        )
    assert exc.value.status_code == 422


def test_ki_fehler_markiert_das_dokument_und_wirft() -> None:
    """Die Datei bleibt liegen, der Grund steht an der Zeile (Wurzel 5).

    Ein stilles „nichts gefunden" waere hier die Falschaussage: gefunden wurde
    nichts, weil das Lesen scheiterte, nicht weil das Dokument leer ist.
    """
    svc, prot = _svc({"mappe_dokument": [_dokumentzeile()]})

    class _Kaputt:
        def erzeuge_multimodal(self, **_kw: object) -> KiAntwort:
            raise KiError("Der KI-Assistent ist nicht eingerichtet.", status_code=503)

    with pytest.raises(DossierError) as exc:
        svc.mappe_dokument_lesen(
            TID,
            property_id=PID,
            mappe="gast",
            inhalt=PDF,
            dateiname="x.pdf",
            user_id="u1",
            client=_Kaputt(),  # type: ignore[arg-type]
        )
    assert exc.value.status_code == 503
    stand = [e for e in prot if e[0] == "update" and e[1] == "mappe_dokument"]
    assert stand, "der Fehlschlag muss an der Zeile stehen"
    assert stand[-1][2]["auswertung"] == "fehler"
    assert stand[-1][2]["auswertung_hinweis"]


# --- Lesen: was das Modell liefert, wird geprueft ---------------------------
def test_erkannte_felder_werden_vorgeschlagen_nicht_geschrieben() -> None:
    """Der Kern: nach dem Lesen steht NICHTS in der Mappe."""
    svc, prot = _svc({"mappe_dokument": [_dokumentzeile()]})
    antwort = (
        '{"sprache": "de", "seiten": 2, "felder": ['
        '{"key": "wifi_password", "wert": "Sommer2026", "sicher": "hoch"},'
        '{"key": "checkInTime", "wert": "16:00", "sicher": "hoch"}]}'
    )
    vorschau = svc.mappe_dokument_lesen(
        TID,
        property_id=PID,
        mappe="gast",
        inhalt=PDF,
        dateiname="Hausordnung.pdf",
        user_id="u1",
        client=_KiStub(antwort),  # type: ignore[arg-type]
    )
    assert {i.key for i in vorschau.items} == {"wifi_password", "checkInTime"}
    assert vorschau.sprache == "de"
    # Kein Schreibzugriff auf properties oder das Gastportal.
    geschrieben = {e[1] for e in prot if e[0] in ("update", "upsert")}
    assert "properties" not in geschrieben
    assert "property_guest_portal" not in geschrieben


def test_unbekannter_feldname_wird_verworfen() -> None:
    """Das Modell darf sich keine Felder ausdenken."""
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    vorschau = svc.mappe_dokument_lesen(
        TID,
        property_id=PID,
        mappe="gast",
        inhalt=PDF,
        dateiname="x.pdf",
        user_id="u1",
        client=_KiStub('{"felder": [{"key": "alarmcode", "wert": "1234"}]}'),  # type: ignore[arg-type]
    )
    assert vorschau.items == []


def test_uhrzeit_die_keine_ist_wird_verworfen() -> None:
    """„nachmittags" gehoert nicht in ein Zeitfeld (Wurzel 4)."""
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    vorschau = svc.mappe_dokument_lesen(
        TID,
        property_id=PID,
        mappe="gast",
        inhalt=PDF,
        dateiname="x.pdf",
        user_id="u1",
        client=_KiStub(
            '{"felder": [{"key": "checkInTime", "wert": "nachmittags"}]}'
        ),  # type: ignore[arg-type]
    )
    assert vorschau.items == []


def test_kaputte_antwort_wirft_laut() -> None:
    """Ein unlesbares Ergebnis kippt den Lauf — kein stilles „nichts gefunden"."""
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    with pytest.raises(DossierError) as exc:
        svc.mappe_dokument_lesen(
            TID,
            property_id=PID,
            mappe="gast",
            inhalt=PDF,
            dateiname="x.pdf",
            user_id="u1",
            client=_KiStub("Ich habe leider kein JSON dabei."),  # type: ignore[arg-type]
        )
    # 422, NICHT 502: unser Dienst ist nicht ausgefallen — diese eine
    # Modellantwort war unbrauchbar. Ein 502 schickte den Nutzer zum Support
    # und sah in der Ueberwachung aus wie ein Ausfall (geaendert 10.09.2026,
    # nachdem ein zu kleines Token-Budget live als 502 erschien).
    assert exc.value.status_code == 422


def test_markdown_zaun_kippt_den_lauf_nicht() -> None:
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    vorschau = svc.mappe_dokument_lesen(
        TID,
        property_id=PID,
        mappe="gast",
        inhalt=PDF,
        dateiname="x.pdf",
        user_id="u1",
        client=_KiStub(
            '```json\n{"felder": [{"key": "door_code", "wert": "4711"}]}\n```'
        ),  # type: ignore[arg-type]
    )
    assert [i.key for i in vorschau.items] == ["door_code"]


def test_heikles_feld_ist_als_solches_markiert() -> None:
    """Tuercode und WLAN-Passwort sind in der Liste vorab nicht angehakt."""
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    vorschau = svc.mappe_dokument_lesen(
        TID,
        property_id=PID,
        mappe="gast",
        inhalt=PDF,
        dateiname="x.pdf",
        user_id="u1",
        client=_KiStub(
            '{"felder": [{"key": "door_code", "wert": "4711"},'
            '{"key": "directions", "wert": "Ab Autobahn rechts."}]}'
        ),  # type: ignore[arg-type]
    )
    nach_key = {i.key: i for i in vorschau.items}
    assert nach_key["door_code"].heikel is True
    assert nach_key["directions"].heikel is False


def test_html_aus_dem_modell_wird_sanitisiert() -> None:
    """Wurzel 8: Modell-Ausgabe ist Client-Input zweiter Ordnung.

    `type_attributes` wird ohne Sanitisierung gespeichert und spaeter
    gerendert. Ein `<script>` aus einem praeparierten PDF darf dort nicht
    ankommen.
    """
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    vorschau = svc.mappe_dokument_lesen(
        TID,
        property_id=PID,
        mappe="gast",
        inhalt=PDF,
        dateiname="x.pdf",
        user_id="u1",
        client=_KiStub(
            '{"felder": [{"key": "rules", "wert": '
            '"<p>Ruhe ab 22 Uhr</p><script>fetch(1)</script>"}]}'
        ),  # type: ignore[arg-type]
    )
    wert = vorschau.items[0].wert
    assert "<script>" not in wert
    assert "Ruhe ab 22 Uhr" in wert


def test_kurzes_feld_bleibt_plaintext() -> None:
    """In einem Tuercode hat kein Tag etwas zu suchen."""
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    vorschau = svc.mappe_dokument_lesen(
        TID,
        property_id=PID,
        mappe="gast",
        inhalt=PDF,
        dateiname="x.pdf",
        user_id="u1",
        client=_KiStub(
            '{"felder": [{"key": "door_code", "wert": "<b>4711</b>"}]}'
        ),  # type: ignore[arg-type]
    )
    assert vorschau.items[0].wert == "4711"


# --- Uebernahme: der Kern ----------------------------------------------------
def _uebernehmen(
    svc: PropertyDossierService, keys_werte: dict[str, str], **kw: Any
) -> Any:
    return svc.mappe_dokument_uebernehmen(
        TID,
        property_id=PID,
        dokument_id=DID,
        items=[MappeVorschlag(key=k, wert=v) for k, v in keys_werte.items()],
        sprache=kw.pop("sprache", "de"),
        **kw,
    )


def test_leeres_feld_wird_gefuellt() -> None:
    svc, prot = _svc({"mappe_dokument": [_dokumentzeile()]})
    out = _uebernehmen(svc, {"door_code": "4711"})
    assert out.gesetzt == ["Türcode"]
    portal = [e for e in prot if e[0] == "upsert" and e[1] == "property_guest_portal"]
    assert portal and portal[0][2]["door_code"] == "4711"


def test_gepflegtes_feld_wird_nicht_ueberschrieben() -> None:
    """Wurzel 1: ein alter Scan darf die Wahrheit des Betriebs nicht ersetzen."""
    svc, prot = _svc(
        {
            "mappe_dokument": [_dokumentzeile()],
            "property_guest_portal": [{"property_id": PID, "door_code": "9999"}],
        }
    )
    out = _uebernehmen(svc, {"door_code": "4711"})
    assert out.gesetzt == []
    assert out.uebersprungen == ["Türcode"]
    assert not [e for e in prot if e[0] == "upsert"], "nichts darf geschrieben werden"


def test_ueberschreiben_nur_auf_ausdrueckliche_ansage() -> None:
    svc, prot = _svc(
        {
            "mappe_dokument": [_dokumentzeile()],
            "property_guest_portal": [{"property_id": PID, "door_code": "9999"}],
        }
    )
    out = _uebernehmen(svc, {"door_code": "4711"}, ueberschreiben=True)
    assert out.gesetzt == ["Türcode"]
    assert out.ueberschrieben is True
    portal = [e for e in prot if e[0] == "upsert" and e[1] == "property_guest_portal"]
    assert portal[0][2]["door_code"] == "4711"


def test_eine_angabe_fuellt_BEIDE_heimaten() -> None:
    """Der Fehler vom 11.08.2026 darf sich nicht wiederholen.

    `wifi` speist den Platzhalter `{{WifiInformation}}`; wer ihn nicht fuellt,
    verschickt Mails mit leerer Zeile.

    KORRIGIERT AM 10.09.2026: Dieser Test verlangte frueher zusaetzlich eine
    Spalte `property_guest_portal.wifi_text`. Die gibt es NICHT — und zwar
    absichtlich: 0121 haelt fest, dass die mehrsprachigen TEXTE in
    `messaging` liegen und die Portal-Tabelle nur strukturierte Werte traegt
    (SSID, Passwort, Tuercode). `wifi_text` ist ein PLATZHALTER-Name aus
    `inbox/feld_kontext.MESSAGING_FELDER`, kein Spaltenname; der Aufloeser
    `felder.py` fuellt ihn genau aus diesem messaging-Block.
    Der Katalog schrieb den Namen als Spalte — PostgREST antwortete mit
    PGRST204 und das Uebernehmen starb mit 500. Die zweite Heimat bleibt
    damit gefuellt, sie ist nur `messaging`, keine Tabelle.
    """
    svc, prot = _svc({"mappe_dokument": [_dokumentzeile()]})
    out = _uebernehmen(svc, {"wifi": "Netz Ferienhaus, Passwort am Kuehlschrank."})
    assert out.gesetzt == ["WLAN-Hinweise (Text)"]

    props = [e for e in prot if e[0] == "update" and e[1] == "properties"]
    assert props, "die Gaestemappe muss geschrieben werden"
    assert "Netz Ferienhaus" in props[0][2]["type_attributes"]["messaging"]["wifi"]["de"]


def test_sprachfassung_wird_beachtet() -> None:
    """Geschrieben wird in die gewaehlte Fassung — uebersetzt wird NICHT."""
    svc, prot = _svc({"mappe_dokument": [_dokumentzeile()]})
    _uebernehmen(svc, {"rules": "Quiet after 10pm."}, sprache="en")
    props = [e for e in prot if e[0] == "update" and e[1] == "properties"]
    block = props[0][2]["type_attributes"]["messaging"]["rules"]
    assert "Quiet after 10pm." in block["en"]
    assert "de" not in block, "keine nebenbei erzeugte zweite Fassung"


def test_unbekannte_sprache_ist_422() -> None:
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    with pytest.raises(DossierError) as exc:
        _uebernehmen(svc, {"rules": "x"}, sprache="kl")
    assert exc.value.status_code == 422


def test_uebernahme_fremdes_dokument_ist_404() -> None:
    """Wurzel 3: eine untergeschobene `dokument_id` darf nichts bewirken."""
    svc, prot = _svc({"mappe_dokument": []})
    with pytest.raises(DossierError) as exc:
        _uebernehmen(svc, {"door_code": "4711"})
    assert exc.value.status_code == 404
    assert not [e for e in prot if e[0] in ("update", "upsert")]


def test_leere_uebernahme_meldet_keinen_erfolg() -> None:
    """Nichts geschrieben heisst nichts geschrieben (Wurzel 5)."""
    svc, prot = _svc({"mappe_dokument": [_dokumentzeile()]})
    out = svc.mappe_dokument_uebernehmen(
        TID, property_id=PID, dokument_id=DID, items=[], sprache="de"
    )
    assert out.gesetzt == []
    assert not [e for e in prot if e[0] in ("update", "upsert")]


def test_herkunft_wird_vermerkt() -> None:
    """Ohne die Spur ist ein uebernommener Tuercode nicht von einem getippten
    zu unterscheiden — und niemand kann sagen, wie alt er ist."""
    svc, prot = _svc({"mappe_dokument": [_dokumentzeile()]})
    _uebernehmen(svc, {"door_code": "4711"})
    spur = [
        e for e in prot if e[0] == "upsert" and e[1] == "mappe_dokument_uebernahme"
    ]
    assert spur, "die Herkunft muss festgehalten werden"
    eintrag = spur[0][2][0]
    assert eintrag["dokument_id"] == DID
    assert eintrag["ziel"] == "guest_portal"
    assert eintrag["feld"] == "door_code"


def test_loeschen_nimmt_datei_und_zeile() -> None:
    svc, prot = _svc({"mappe_dokument": [_dokumentzeile()]})
    svc.mappe_dokument_loeschen(TID, PID, DID)
    assert [e for e in prot if e[0] == "remove"], "die Datei muss weg"
    assert [e for e in prot if e[0] == "delete"], "die Zeile muss weg"


def test_signierte_url_wird_geliefert() -> None:
    svc, _ = _svc({"mappe_dokument": [_dokumentzeile()]})
    url = svc.mappe_dokument_url(TID, PID, DID)
    assert url.startswith("https://")
    assert "sig=" in url


# --- Der Feldkatalog muss zur echten Tabelle passen -------------------------
# DER ANLASS (10.09.2026, live): Der Katalog wollte in SIEBEN Spalten von
# `property_guest_portal` schreiben, die es nie gab — `checkout_instructions`,
# `door_instructions`, `house_rules`, `directions`, `local_guide`,
# `checkin_instructions`, `wifi_text`. Beim Uebernehmen aus dem PDF warf
# PostgREST `PGRST204` und der Nutzer bekam einen rohen 500.
#
# Die Spalten fehlten nicht aus Versehen: 0121 haelt woertlich fest, dass die
# TEXTE mehrsprachig in `messaging` liegen und diese Tabelle nur strukturierte
# Schalter traegt. Der Katalog widersprach also einer dokumentierten
# Entscheidung — und kein Test sah es, weil die Fake-DB jede Spalte annimmt.
#
# Dieser Test prueft nicht gegen die DB (das tut
# `scripts/diagnose/db-spalten-pruefen.py` gegen die LIVE-Datenbank), sondern
# haelt die Liste der erlaubten Ziele fest. Wer ein neues `guest_portal`-Ziel
# ergaenzt, muss hier vorbeikommen — und dabei nachsehen, ob die Spalte
# wirklich existiert.
def test_guest_portal_ziele_sind_nur_strukturierte_spalten() -> None:
    from src.features.property_dossier.mappe_felder import KATALOG

    ziele = {
        z.feld
        for f in KATALOG
        for z in f.ziele
        if z.art == "guest_portal"
    }
    # Genau die Spalten, die `property_guest_portal` laut 0121 hat und die
    # ein strukturierter Wert sind (kein mehrsprachiger Text).
    assert ziele == {
        "wifi_ssid",
        "wifi_password",
        "door_code",
        "contact_phone",
        "maintenance_phone",
    }


def test_jeder_text_hat_ein_messaging_ziel() -> None:
    """Kein Feld darf durch das Entfernen der Portal-Ziele heimatlos werden.

    Die sieben gestrichenen Ziele waren Dopplungen — der Text ging ohnehin
    nach `messaging`. Faellt bei einem Feld beides weg, verschwaende das
    Uebernehmen den Wert stillschweigend.
    """
    from src.features.property_dossier.mappe_felder import KATALOG

    ohne_ziel = [f.key for f in KATALOG if not f.ziele]
    assert not ohne_ziel, f"Felder ohne jedes Ziel: {ohne_ziel}"
