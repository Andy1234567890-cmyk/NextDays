"""Tests fuer die Inventarliste: Bestand, Schaeden, Abrechnung.

Der Kern, den diese Datei festhaelt:

* OHNE FOTO KEINE MELDUNG. Die Pflicht steht im Service, nicht in der DB —
  ein Test ist der einzige Ort, an dem sie festgenagelt ist.
* Der Abrechnungsposten entsteht ERST nach Bestaetigung. Die meldende Person
  kennt den Preis nicht; ein Posten ueber 0,00 waere eine Falschaussage.
* Die RICHTUNG haengt am Traeger: Eigentuemer zahlt = `from_owner`, Gast
  zahlt = `to_owner` (Gutschrift), Betrieb zahlt = GAR KEIN Posten.
* Keine Waehrung am Objekt = 422, kein stilles „EUR" (Wurzel 4).
* Ein Doppelklick belastet niemanden zweimal (Wurzel 2).
"""

from types import SimpleNamespace
from typing import Any

import pytest

from src.features.property_dossier.service import (
    DossierError,
    PropertyDossierService,
)

TID = "t1"
PID = "11111111-1111-4111-8111-111111111111"
IID = "55555555-5555-4555-8555-555555555555"
SID = "22222222-2222-4222-8222-222222222222"

JPG = b"\xff\xd8\xff" + b"x" * 100
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 100


class _Kette:
    def __init__(self, tabelle: str, daten: Any, protokoll: list[tuple]) -> None:
        self._tabelle = tabelle
        self._daten = daten
        self._protokoll = protokoll

    def select(self, *_a: object, **_k: object) -> "_Kette":
        return self

    def insert(self, werte: Any) -> "_Kette":
        self._protokoll.append(("insert", self._tabelle, werte))
        if isinstance(werte, dict):
            self._daten = [{**werte, "id": SID}]
        elif isinstance(werte, list):
            self._daten = [{**w, "id": SID} for w in werte]
        return self

    def update(self, werte: Any) -> "_Kette":
        self._protokoll.append(("update", self._tabelle, werte))
        vorher = self._daten[0] if isinstance(self._daten, list) and self._daten else {}
        self._daten = [{**vorher, **werte, "id": SID}]
        return self

    def delete(self) -> "_Kette":
        self._protokoll.append(("delete", self._tabelle, None))
        return self

    def __getattr__(self, _name: str) -> "_Kette":
        return self

    def __call__(self, *_a: object, **_k: object) -> "_Kette":
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._daten, count=0)


class _Speicher:
    def __init__(self, protokoll: list[tuple]) -> None:
        self._protokoll = protokoll

    def upload(self, pfad: str, _inhalt: bytes, _kopf: dict) -> None:
        self._protokoll.append(("upload", pfad, None))

    def create_signed_url(self, pfad: str, _ttl: int) -> dict:
        return {"signedURL": f"https://example.test/{pfad}?sig=x"}


class _DB:
    def __init__(self, tabellen: dict[str, Any], protokoll: list[tuple]) -> None:
        self._tabellen = tabellen
        self._protokoll = protokoll
        self.storage = SimpleNamespace(from_=lambda _b: _Speicher(protokoll))

    def table(self, name: str) -> _Kette:
        return _Kette(name, self._tabellen.get(name, []), self._protokoll)


def _schadenzeile(**felder: Any) -> dict:
    return {
        "id": SID,
        "tenant_id": TID,
        "property_id": PID,
        "item_id": None,
        "item_name": "Stehlampe",
        "art": "beschaedigt",
        "beschreibung": None,
        "menge": 1,
        "traeger": "offen",
        "status": "gemeldet",
        "betrag": None,
        "currency": None,
        "gemeldet_am": "2026-09-09T10:00:00+00:00",
        "bestaetigt_am": None,
        "owner_expense_id": None,
        "task_id": None,
        "reservation_id": None,
        **felder,
    }


def _gegenstandzeile(**felder):
    """Eine Inventarzeile, wie die DB sie liefert."""
    return {
        "id": IID,
        "tenant_id": TID,
        "property_id": PID,
        "name": "Sofa",
        "quantity": 1,
        "soll_menge": 1,
        "room_id": None,
        "beschreibung": None,
        "quelle": "manuell",
        "geprueft_am": None,
        "art": "bestand",
        "meldebestand": None,
        "zaehl_rhythmus": "jaehrlich",
        "zuletzt_gezaehlt_am": None,
        "zustand": "gut",
        "zustand_notiz": None,
        "referenz_foto_pfad": "t1/p/referenz/alt.jpg",
        "angeschafft_am": None,
        "anschaffungswert": None,
        "anschaffung_currency": None,
        **felder,
    }


def _svc(
    tabellen: dict[str, Any] | None = None, *, owns: bool = True, waehrung: str = "DKK"
) -> tuple[PropertyDossierService, list[tuple]]:
    p: list[tuple] = []
    basis: dict[str, Any] = {
        "properties": [{"id": PID, "currency": waehrung}] if owns else [],
        "tenants": [{"currency": waehrung}],
        "inventory_items": [],
        "inventory_room": [],
        "inventory_damage": [],
        "inventory_damage_photo": [],
        "tasks": [],
        "owner_expenses": [],
    }
    basis.update(tabellen or {})
    return PropertyDossierService(client=_DB(basis, p)), p  # type: ignore[arg-type]


# --- Foto-Pflicht ------------------------------------------------------------
def test_ohne_foto_keine_meldung() -> None:
    """Der Kern: eine Meldung ohne Bild wird abgewiesen, und es entsteht
    KEINE Zeile — die Pruefung sitzt vor dem Anlegen."""
    svc, prot = _svc()
    with pytest.raises(DossierError) as exc:
        svc.schaden_melden(
            TID, PID, item_id=None, item_name="Stehlampe", art="beschaedigt",
            beschreibung=None, menge=1, traeger="offen", reservation_id=None,
            fotos=[], user_id="u1",
        )
    assert exc.value.status_code == 422
    assert "Foto" in exc.value.message
    assert not [e for e in prot if e[0] == "insert"], "keine Zeile ohne Bild"


def test_fremder_dateityp_wird_abgewiesen() -> None:
    """Magic-Bytes, nicht der content_type: eine als Bild deklarierte
    HTML-Datei bleibt eine HTML-Datei (Wurzel 8)."""
    svc, prot = _svc()
    with pytest.raises(DossierError) as exc:
        svc.schaden_melden(
            TID, PID, item_id=None, item_name="Lampe", art="beschaedigt",
            beschreibung=None, menge=1, traeger="gast", reservation_id=None,
            fotos=[b"<html>kein Bild</html>"], user_id="u1",
        )
    assert exc.value.status_code == 415
    assert not [e for e in prot if e[0] == "upload"]


def test_meldung_mit_foto_legt_zeile_und_bild_an() -> None:
    svc, prot = _svc()
    out = svc.schaden_melden(
        TID, PID, item_id=None, item_name="Stehlampe", art="beschaedigt",
        beschreibung="Schirm gerissen", menge=1, traeger="gast",
        reservation_id=None, fotos=[JPG, PNG], user_id="u1",
    )
    assert out.item_name == "Stehlampe"
    assert out.traeger == "gast"
    assert out.status == "gemeldet"
    # Kein Betrag beim Melden: die meldende Person kennt ihn nicht.
    assert out.betrag is None
    assert len([e for e in prot if e[0] == "upload"]) == 2


def test_unbekannte_art_und_traeger_sind_422() -> None:
    svc, _ = _svc()
    for feld, wert in (("art", "zerdeppert"), ("traeger", "nachbar")):
        with pytest.raises(DossierError) as exc:
            svc.schaden_melden(
                TID, PID, item_id=None, item_name="X",
                art=wert if feld == "art" else "beschaedigt",
                beschreibung=None, menge=1,
                traeger=wert if feld == "traeger" else "offen",
                reservation_id=None, fotos=[JPG], user_id="u1",
            )
        assert exc.value.status_code == 422, feld


# --- Bestaetigen: Aufgabe, Posten, Richtung ----------------------------------
def test_eigentuemer_traegt_ergibt_from_owner() -> None:
    """Der Eigentuemer zahlt: Belastung in SEINER Abrechnung."""
    svc, prot = _svc({"inventory_damage": [_schadenzeile()]})
    out = svc.schaden_bestaetigen(
        TID, PID, SID, betrag=249.9, traeger="eigentuemer", user_id="u1"
    )
    posten = [e for e in prot if e[0] == "insert" and e[1] == "owner_expenses"]
    assert posten, "ein Posten muss entstehen"
    assert posten[0][2]["direction"] == "from_owner"
    assert posten[0][2]["amount"] == 249.9
    assert posten[0][2]["currency"] == "DKK"
    assert out.status == "abgerechnet"


def test_gast_traegt_ergibt_to_owner() -> None:
    """Der Gast zahlt: der Betrieb holt das Geld und reicht es weiter — fuer
    den Eigentuemer eine GUTSCHRIFT, keine Belastung. Die vorhandene
    Dienstleistungs-Automatik kennt nur `from_owner`; das waere hier falsch."""
    svc, prot = _svc({"inventory_damage": [_schadenzeile(traeger="gast")]})
    svc.schaden_bestaetigen(TID, PID, SID, betrag=80, traeger="gast", user_id="u1")
    posten = [e for e in prot if e[0] == "insert" and e[1] == "owner_expenses"]
    assert posten[0][2]["direction"] == "to_owner"


def test_betrieb_traegt_ergibt_KEINEN_posten() -> None:
    """Traegt der Betrieb die Kosten, gehoert nichts in die
    Eigentuemer-Abrechnung — das waere eine Belastung ohne Anlass."""
    svc, prot = _svc({"inventory_damage": [_schadenzeile()]})
    out = svc.schaden_bestaetigen(
        TID, PID, SID, betrag=45, traeger="betrieb", user_id="u1"
    )
    assert not [e for e in prot if e[0] == "insert" and e[1] == "owner_expenses"]
    assert out.status == "bestaetigt"
    assert out.betrag == 45.0


def test_ohne_waehrung_am_objekt_ist_422() -> None:
    """Kein stilles „EUR": in 27 Laendern waere das eine falsche Zahl in
    einer Abrechnung (Wurzel 4)."""
    svc, prot = _svc({"inventory_damage": [_schadenzeile()]}, waehrung="")
    with pytest.raises(DossierError) as exc:
        svc.schaden_bestaetigen(
            TID, PID, SID, betrag=10, traeger="eigentuemer", user_id="u1"
        )
    assert exc.value.status_code == 422
    assert not [e for e in prot if e[0] == "insert" and e[1] == "owner_expenses"]


def test_traeger_offen_ist_422() -> None:
    """Ohne Entscheidung kein Posten — `offen` ist keine Wahl."""
    svc, _ = _svc({"inventory_damage": [_schadenzeile()]})
    with pytest.raises(DossierError) as exc:
        svc.schaden_bestaetigen(
            TID, PID, SID, betrag=10, traeger="offen", user_id="u1"
        )
    assert exc.value.status_code == 422


def test_aufgabe_entsteht_beim_bestaetigen() -> None:
    svc, prot = _svc({"inventory_damage": [_schadenzeile()]})
    svc.schaden_bestaetigen(
        TID, PID, SID, betrag=99, traeger="eigentuemer", user_id="u1"
    )
    aufgaben = [e for e in prot if e[0] == "insert" and e[1] == "tasks"]
    assert aufgaben, "eine Aufgabe muss entstehen"
    assert "Stehlampe" in aufgaben[0][2]["title"]


def test_entsorgt_erzeugt_keine_aufgabe() -> None:
    """Bei `entsorgt` gibt es nichts zu reparieren."""
    svc, prot = _svc({"inventory_damage": [_schadenzeile(art="entsorgt")]})
    svc.schaden_bestaetigen(
        TID, PID, SID, betrag=30, traeger="eigentuemer", user_id="u1"
    )
    assert not [e for e in prot if e[0] == "insert" and e[1] == "tasks"]


def test_zweiter_klick_belastet_nicht_doppelt() -> None:
    """Wurzel 2: die Anker stehen an der Zeile und werden vorher geprueft.
    Ein Doppelklick darf einen Eigentuemer nicht zweimal belasten."""
    svc, prot = _svc(
        {
            "inventory_damage": [
                _schadenzeile(
                    status="abgerechnet",
                    owner_expense_id="be1",
                    task_id="ta1",
                    betrag=99,
                    currency="DKK",
                    traeger="eigentuemer",
                )
            ]
        }
    )
    svc.schaden_bestaetigen(
        TID, PID, SID, betrag=99, traeger="eigentuemer", user_id="u1"
    )
    assert not [e for e in prot if e[0] == "insert" and e[1] == "owner_expenses"]
    assert not [e for e in prot if e[0] == "insert" and e[1] == "tasks"]


def test_verworfener_schaden_laesst_sich_nicht_bestaetigen() -> None:
    svc, _ = _svc({"inventory_damage": [_schadenzeile(status="verworfen")]})
    with pytest.raises(DossierError) as exc:
        svc.schaden_bestaetigen(
            TID, PID, SID, betrag=10, traeger="gast", user_id="u1"
        )
    assert exc.value.status_code == 409


def test_abgerechneter_schaden_laesst_sich_nicht_verwerfen() -> None:
    """Ein stiller Rueckzieher waere eine Abrechnungsdifferenz ohne Spur."""
    svc, _ = _svc({"inventory_damage": [_schadenzeile(owner_expense_id="be1")]})
    with pytest.raises(DossierError) as exc:
        svc.schaden_verwerfen(TID, PID, SID)
    assert exc.value.status_code == 409


def test_fremdes_objekt_ist_404() -> None:
    svc, _ = _svc(owns=False)
    with pytest.raises(DossierError) as exc:
        svc.inventar_liste(TID, PID)
    assert exc.value.status_code == 404


# --- Bestand -----------------------------------------------------------------
def test_anlegen_ohne_ist_menge_nimmt_das_soll() -> None:
    """Beim Anlegen aus einer Liste ist alles da — sonst stuende die frische
    Zeile sofort als Fehlbestand da (Wurzel 4)."""
    svc, prot = _svc()
    svc.inventar_anlegen(
        TID, PID,
        eintraege=[{"name": "Weinglas", "soll_menge": 6}],
        user_id="u1",
    )
    zeilen = [e for e in prot if e[0] == "insert" and e[1] == "inventory_items"]
    assert zeilen[0][2][0]["quantity"] == 6
    assert zeilen[0][2][0]["soll_menge"] == 6


def test_anlegen_mit_abweichender_ist_menge() -> None:
    svc, prot = _svc()
    svc.inventar_anlegen(
        TID, PID,
        eintraege=[{"name": "Weinglas", "soll_menge": 6, "ist_menge": 4}],
        user_id="u1",
    )
    zeile = [e for e in prot if e[1] == "inventory_items"][0][2][0]
    assert zeile["quantity"] == 4
    assert zeile["soll_menge"] == 6


def test_aendern_setzt_nur_gesendete_felder() -> None:
    """Ein weggelassenes Feld bleibt, wie es ist (Wurzel 1)."""
    svc, prot = _svc({"inventory_items": [{"id": "i1", "name": "Alt", "quantity": 2}]})
    svc.inventar_aendern(
        TID, PID, "i1", felder={"ist_menge": 3}, user_id="u1"
    )
    werte = [e for e in prot if e[0] == "update"][0][2]
    assert werte["quantity"] == 3
    assert "name" not in werte
    assert "soll_menge" not in werte


def test_geprueft_setzt_zeitstempel() -> None:
    svc, prot = _svc({"inventory_items": [{"id": "i1", "name": "X", "quantity": 1}]})
    svc.inventar_aendern(TID, PID, "i1", felder={"geprueft": True}, user_id="u1")
    werte = [e for e in prot if e[0] == "update"][0][2]
    assert werte["geprueft_am"]
    assert werte["geprueft_von"] == "u1"


# --- PDF-Import --------------------------------------------------------------
class _KiStub:
    def __init__(self, text: str) -> None:
        self._text = text

    def erzeuge_multimodal(self, **_kw: object) -> Any:
        from src.core.ki import KiAntwort

        return KiAntwort(
            text=self._text, modell="test", region="test", dauer_ms=1,
            tokens_ein=1, tokens_aus=1, abschlussgrund="STOP",
        )


PDF = b"%PDF-1.7\nrumpf"


def test_pdf_import_schlaegt_vor_und_speichert_nichts() -> None:
    """Der Kern: nach dem Lesen steht KEINE Zeile in der Liste."""
    svc, prot = _svc()
    zeilen = svc.inventar_pdf_lesen(
        TID, PID, inhalt=PDF, dateiname="Inventar.pdf", user_id="u1",
        client=_KiStub(
            '[{"name":"Weinglas","menge":6,"raum":"Küche"},'
            '{"name":"Handtuch","menge":4,"raum":"Bad"}]'
        ),
    )
    assert [z["name"] for z in zeilen] == ["Weinglas", "Handtuch"]
    assert zeilen[0]["soll_menge"] == 6
    assert zeilen[0]["raum"] == "Küche"
    assert not [e for e in prot if e[0] == "insert" and e[1] == "inventory_items"]


def test_fehlende_menge_bleibt_offen() -> None:
    """Keine erfundene 1: eine geratene Menge waere in einer Inventur eine
    Falschaussage (Wurzel 4)."""
    svc, _ = _svc()
    zeilen = svc.inventar_pdf_lesen(
        TID, PID, inhalt=PDF, dateiname="x.pdf", user_id="u1",
        client=_KiStub('[{"name":"Bettwäsche"}]'),
    )
    assert zeilen[0]["soll_menge"] is None


def test_nicht_pdf_wird_abgewiesen() -> None:
    svc, _ = _svc()
    with pytest.raises(DossierError) as exc:
        svc.inventar_pdf_lesen(
            TID, PID, inhalt=b"<html>", dateiname="tarnung.pdf", user_id="u1",
            client=_KiStub("[]"),
        )
    assert exc.value.status_code == 422


def test_markdown_zaun_kippt_den_import_nicht() -> None:
    svc, _ = _svc()
    zeilen = svc.inventar_pdf_lesen(
        TID, PID, inhalt=PDF, dateiname="x.pdf", user_id="u1",
        client=_KiStub('```json\n[{"name":"Stuhl","menge":4}]\n```'),
    )
    assert zeilen[0]["name"] == "Stuhl"


def test_kaputte_antwort_wirft_laut() -> None:
    """Ein unlesbares Ergebnis kippt den Lauf — kein stilles „nichts gefunden"."""
    svc, _ = _svc()
    with pytest.raises(DossierError) as exc:
        svc.inventar_pdf_lesen(
            TID, PID, inhalt=PDF, dateiname="x.pdf", user_id="u1",
            client=_KiStub("Ich habe kein JSON dabei."),
        )
    # 422, NICHT 502: unser Dienst ist nicht ausgefallen — diese eine
    # Modellantwort war unbrauchbar. Ein 502 schickte den Nutzer zum Support
    # und sah in der Ueberwachung aus wie ein Ausfall (geaendert 10.09.2026,
    # nachdem ein zu kleines Token-Budget live als 502 erschien).
    assert exc.value.status_code == 422


# --- 0623: was eine Inventur ausmacht ----------------------------------------
def test_neue_zeile_traegt_rhythmus_und_meldebestand() -> None:
    """Ohne Rhythmus laege alles auf der Jahresliste; ohne Meldebestand gaebe
    es nie eine Nachfuell-Aufgabe."""
    svc, prot = _svc()
    svc.inventar_anlegen(
        TID,
        PID,
        eintraege=[
            {
                "name": "Handtuch",
                "soll_menge": 12,
                "art": "verbrauch",
                "meldebestand": 4,
                "zaehl_rhythmus": "jede_abreise",
                "zustand": "neu",
            }
        ],
        user_id="u1",
    )
    ins = [e for e in prot if e[0] == "insert" and e[1] == "inventory_items"]
    assert ins
    zeile = ins[0][2][0]
    assert zeile["art"] == "verbrauch"
    assert zeile["meldebestand"] == 4
    assert zeile["zaehl_rhythmus"] == "jede_abreise"
    assert zeile["zustand"] == "neu"


def test_weggelassene_felder_werden_nicht_erfunden() -> None:
    """Ein nicht mitgegebenes Feld faellt auf die Spalten-Vorgabe zurueck,
    statt hier geraten zu werden (Wurzel 4)."""
    svc, prot = _svc()
    svc.inventar_anlegen(
        TID, PID, eintraege=[{"name": "Sofa"}], user_id="u1"
    )
    zeile = [e for e in prot if e[0] == "insert"][0][2][0]
    assert "art" not in zeile
    assert "meldebestand" not in zeile
    assert "zaehl_rhythmus" not in zeile


def test_zustand_wird_geaendert() -> None:
    svc, prot = _svc({"inventory_items": [_gegenstandzeile()]})
    svc.inventar_aendern(
        TID,
        PID,
        IID,
        felder={"zustand": "ersatz_faellig", "zustand_notiz": "durchgesessen"},
        user_id="u1",
    )
    upd = [e for e in prot if e[0] == "update" and e[1] == "inventory_items"]
    assert upd[0][2]["zustand"] == "ersatz_faellig"
    assert upd[0][2]["zustand_notiz"] == "durchgesessen"


def test_anschaffungswert_ohne_objektwaehrung_ist_422() -> None:
    """Wurzel 4: kein stilles „EUR" — in 27 Laendern eine falsche Zahl."""
    svc, _ = _svc(
        {
            "inventory_items": [_gegenstandzeile()],
            "properties": [{"id": PID, "currency": None}],
            "tenants": [{"currency": None}],
        }
    )
    with pytest.raises(DossierError) as exc:
        svc.inventar_aendern(
            TID, PID, IID, felder={"anschaffungswert": 249.90}, user_id="u1"
        )
    assert exc.value.status_code == 422


def test_referenzfoto_verlangt_ein_bild_kein_pdf() -> None:
    """Ein PDF waere hier kein Nachweis, sondern eine Datei, die niemand als
    Vergleich ansieht."""
    svc, _ = _svc({"inventory_items": [_gegenstandzeile()]})
    with pytest.raises(DossierError) as exc:
        svc.referenz_foto_setzen(
            TID, PID, IID, inhalt=b"%PDF-1.7\nx", user_id="u1"
        )
    assert exc.value.status_code == 415


def test_referenzfoto_wird_abgelegt_und_vermerkt() -> None:
    svc, prot = _svc({"inventory_items": [_gegenstandzeile()]})
    pfad = svc.referenz_foto_setzen(
        TID, PID, IID, inhalt=b"\xff\xd8\xffbild", user_id="u1"
    )
    assert "referenz" in pfad
    upd = [e for e in prot if e[0] == "update" and e[1] == "inventory_items"]
    assert upd[0][2]["referenz_foto_pfad"] == pfad


def test_kein_referenzfoto_ist_404_kein_leerer_link() -> None:
    svc, _ = _svc({"inventory_items": [_gegenstandzeile(referenz_foto_pfad=None)]})
    with pytest.raises(DossierError) as exc:
        svc.referenz_foto_url(TID, PID, IID)
    assert exc.value.status_code == 404


def test_buchung_kommt_aus_der_aufgabe() -> None:
    """Der Kautionsfall: die Reinigungsaufgabe traegt die Buchung, deren Gast
    betroffen ist. Aus dem Datum zu raten waere die falsche Person."""
    svc, _ = _svc({"tasks": [{"reservation_id": "res-7"}]})
    assert svc.buchung_zum_zeitpunkt(TID, PID, task_id="task-1") == "res-7"


def test_ohne_aufgabe_keine_geratene_buchung() -> None:
    svc, _ = _svc()
    assert svc.buchung_zum_zeitpunkt(TID, PID, task_id=None) is None


# --- DB-Fehler: Eingabefehler sind kein Ausfall ----------------------------
# DER ANLASS (10.09.2026): eine krumme UUID in der Adresszeile
# (`/inventar/raeume/abc`) erzeugte PostgreSQL 22P02, und der Slice machte
# daraus 502 „Das Inventar ist gerade nicht abrufbar." Das ist eine
# Falschaussage ueber den eigenen Dienst: nichts war ausgefallen, die Eingabe
# war ungueltig. Ein 5xx auf angreiferkontrollierten Input ist zudem genau das,
# was Wurzel 5 verbietet — und er verdeckt in der Ueberwachung die echten
# Ausfaelle, weil beide gleich aussehen.

class _FakeApiError(Exception):
    """APIError-Ersatz: der Slice liest nur `.code` und `str(exc)`."""

    def __init__(self, code: str) -> None:
        super().__init__(f"db sagt {code}")
        self.code = code


@pytest.mark.parametrize(
    "code",
    ["22P02", "22003", "23503", "23505", "23514"],
)
def test_eingabefehler_wird_422_nicht_502(code: str) -> None:
    from src.features.property_dossier.inventar import _db_fehler

    fehler = _db_fehler(_FakeApiError(code), "raum_loeschen")
    assert fehler.status_code == 422
    # Die Meldung darf NICHT nach Serverausfall klingen.
    assert "nicht abrufbar" not in fehler.message


def test_echter_ausfall_bleibt_502() -> None:
    """Ein Verbindungs-/Serverfehler ist weiterhin ein Ausfall — sonst haette
    die Trennung nichts gewonnen, sondern nur alles auf 422 gedreht."""
    from src.features.property_dossier.inventar import _db_fehler

    fehler = _db_fehler(_FakeApiError("08006"), "liste")
    assert fehler.status_code == 502


def test_fehlende_tabelle_bleibt_503_mit_migrationshinweis() -> None:
    """Der Bestandsfall aus 0620 darf durch die neue Verzweigung nicht
    verloren gehen."""
    from src.features.property_dossier.inventar import _db_fehler

    fehler = _db_fehler(_FakeApiError("PGRST205"), "liste")
    assert fehler.status_code == 503
    assert "0620" in fehler.message


# --- Raum-Zugehoerigkeit (Wurzel 3/9) ---------------------------------------
# Die `room_id` kommt aus der Anfrage. Ohne Pruefung liesse sich eine Zeile
# dem Raum eines FREMDEN Objekts zuordnen — der Fremdschluessel prueft nur,
# dass die Zeile existiert, nicht wem sie gehoert. Seit die Zuweisung per
# Ziehen der Hauptweg ist, laeuft jede Bedienung durch diesen Pfad.
#
# Die FakeDb filtert `.eq()` nicht, deshalb steuern diese Tests ueber den
# Tabelleninhalt: leere `inventory_room` = die gescopte Abfrage findet nichts,
# also ist der Raum fremd.
def test_anlegen_mit_fremdem_raum_wird_abgewiesen() -> None:
    svc, prot = _svc({"inventory_room": []})
    with pytest.raises(DossierError) as exc:
        svc.inventar_anlegen(
            TID, PID,
            eintraege=[{"name": "Weinglas", "room_id": "fremd-1"}],
            user_id="u1",
        )
    assert exc.value.status_code == 422
    # Entscheidend: es entsteht KEINE Zeile.
    assert not [e for e in prot if e[0] == "insert" and e[1] == "inventory_items"]


def test_aendern_auf_fremden_raum_wird_abgewiesen() -> None:
    svc, prot = _svc({
        "inventory_items": [_gegenstandzeile()],
        "inventory_room": [],
    })
    with pytest.raises(DossierError) as exc:
        svc.inventar_aendern(
            TID, PID, IID, felder={"room_id": "fremd-1"}, user_id="u1",
        )
    assert exc.value.status_code == 422
    assert not [e for e in prot if e[0] == "update" and e[1] == "inventory_items"]


def test_eigener_raum_wird_zugewiesen() -> None:
    """Der Normalfall des Ziehens: Raum gehoert zum Objekt, Zuweisung laeuft."""
    svc, prot = _svc({
        "inventory_items": [_gegenstandzeile()],
        "inventory_room": [
            {"id": "r1", "tenant_id": TID, "property_id": PID,
             "name": "Kueche", "sortierung": 0},
        ],
    })
    svc.inventar_aendern(TID, PID, IID, felder={"room_id": "r1"}, user_id="u1")
    aend = [e for e in prot if e[0] == "update" and e[1] == "inventory_items"]
    assert aend[0][2]["room_id"] == "r1"


def test_raum_entfernen_bleibt_erlaubt() -> None:
    """`null` ist kein Raum und braucht keine Pruefung — sonst liesse sich eine
    Zeile nicht mehr aus einem Raum herausziehen."""
    svc, prot = _svc({
        "inventory_items": [_gegenstandzeile(room_id="r1")],
        "inventory_room": [],
    })
    svc.inventar_aendern(TID, PID, IID, felder={"room_id": None}, user_id="u1")
    aend = [e for e in prot if e[0] == "update" and e[1] == "inventory_items"]
    assert aend[0][2]["room_id"] is None


# --- Pruefung ist umschaltbar ------------------------------------------------
def test_pruefung_setzen() -> None:
    svc, prot = _svc({"inventory_items": [_gegenstandzeile()]})
    svc.inventar_aendern(TID, PID, IID, felder={"geprueft": True}, user_id="u1")
    werte = [e for e in prot if e[0] == "update"][0][2]
    assert werte["geprueft_am"] is not None
    assert werte["geprueft_von"] == "u1"


def test_pruefung_zuruecknehmen() -> None:
    """Ein Fehlklick stand vorher FUER IMMER als geprueft in der Inventur:
    `false` fiel stumm durch, es gab keinen Rueckweg. Die Sichtpruefung ist
    eine Beobachtung, kein Beleg — sie darf zurueckgenommen werden."""
    svc, prot = _svc({
        "inventory_items": [
            _gegenstandzeile(geprueft_am="2026-09-01T10:00:00+00:00"),
        ],
    })
    svc.inventar_aendern(TID, PID, IID, felder={"geprueft": False}, user_id="u1")
    werte = [e for e in prot if e[0] == "update"][0][2]
    assert werte["geprueft_am"] is None
    assert werte["geprueft_von"] is None


def test_ohne_feld_bleibt_die_pruefung_stehen() -> None:
    """Umbenennen darf den Pruefstand NICHT anfassen — das waere eine
    Falschaussage darueber, wann zuletzt jemand hingesehen hat."""
    svc, prot = _svc({"inventory_items": [_gegenstandzeile()]})
    svc.inventar_aendern(TID, PID, IID, felder={"name": "Neu"}, user_id="u1")
    werte = [e for e in prot if e[0] == "update"][0][2]
    assert "geprueft_am" not in werte
    assert "geprueft_von" not in werte
