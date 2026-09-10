"""Der Probelauf darf NICHTS ablegen.

Das ist die ganze Zusage dieser Funktion: rechnen, prüfen, zeigen — und den
Datenbestand unangetastet lassen. Ein Probelauf, der doch etwas schreibt,
wäre schlimmer als keiner, weil niemand ihn mehr nachprüft.

Geprüft wird mit einem Doppel, das jeden Schreibzugriff meldet: Ein echter
Schreibversuch fällt dadurch auf, statt in einer Testdatenbank zu
verschwinden.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.taxpayer.dac7.kanaele import Meldungsart
from src.features.taxpayer.dac7.service import Dac7Error, Dac7Service

# Ein Bestand, aus dem eine VOLLSTÄNDIGE Meldung entsteht. Nur so wird der
# Ablege-Pfad überhaupt erreicht — mit leeren Tabellen bricht der Aufbau
# vorher ab, und der Test prüfte nichts (genau das ist beim Bau
# passiert und nur durch die Gegenprobe aufgefallen).
_BESTAND: dict[str, list[dict[str, Any]]] = {
    "tenants": [{"id": "t1", "name": "Testbetrieb", "country": "DK"}],
    "taxpayer_info": [
        {
            "country": "DK",
            "kind": "entity",
            "tin": "44179377",
            "legal_name": "Testbetrieb",
            "address_line1": "Testvej 1",
            "postal_code": "9881",
            "city": "Testby",
            "nexus": None,
        }
    ],
    "properties": [
        {
            "id": "p1",
            "title": "Testhaus",
            "street": "Teststraede",
            "postal_code": "9881",
            "city": "Testby",
            "country": "DK",
            "property_type": "ferienhaus",
            "land_registration_number": "1234",
            "land_registration_unavailable": False,
            "bfe_number": "3155601",
        }
    ],
    "owner_properties": [
        {
            "id": "op1",
            "property_id": "p1",
            "owner_id": "o1",
            "ist_haupteigentuemer": True,
        }
    ],
    "owners": [
        {
            "id": "o1",
            "name": "Anna Testperson",
            "company": None,
            "street": "Testgade",
            "house_number": "8",
            "postal_code": "8270",
            "city": "Testby2",
            "country": "DK",
            "tax_id": None,
            "cpr_number": "010190-1234",
            # Die Anleitung fuehrt RS_BIRTH_DATE als Pflicht (1..1).
            "date_of_birth": "1979-11-11",
            "iban": None,
            "bank_reg_nr": None,
            "bank_konto_nr": None,
            "account_holder": None,
        }
    ],
    "reservations": [
        {
            "id": "r1",
            "property_id": "p1",
            "status": "completed",
            "channel": "website",
            "check_in": "2025-06-10",
            "check_out": "2025-06-17",
            "booked_at": "2025-03-05T10:00:00+00:00",
            "total_amount": "5000.00",
            "paid_amount": "5000.00",
            "currency": "DKK",
            "ota_commission": None,
            "channel_fee": None,
        }
    ],
    "payments": [],
}


class _Abfrage:
    """Liest aus `_BESTAND` und meldet jeden Schreibversuch."""

    def __init__(self, tabelle: str, protokoll: list[str]) -> None:
        self._tabelle = tabelle
        self._protokoll = protokoll
        self._eingefuegt = False

    # Lesen: liefert den hinterlegten Bestand.
    def select(self, *_args: Any, **_kwargs: Any) -> _Abfrage:
        return self

    def eq(self, *_args: Any) -> _Abfrage:
        return self

    def neq(self, *_args: Any) -> _Abfrage:
        return self

    def in_(self, *_args: Any) -> _Abfrage:
        return self

    def gte(self, *_args: Any) -> _Abfrage:
        return self

    def lte(self, *_args: Any) -> _Abfrage:
        return self

    def lt(self, *_args: Any) -> _Abfrage:
        return self

    def order(self, *_args: Any, **_kwargs: Any) -> _Abfrage:
        return self

    def limit(self, *_args: Any) -> _Abfrage:
        return self

    def range(self, *_args: Any) -> _Abfrage:
        return self

    def execute(self) -> Any:
        # Die Filter werden bewusst ignoriert: Der Bestand ist so klein,
        # dass jede Tabelle genau die passenden Zeilen enthält. Was hier
        # geprüft wird, ist der SCHREIB-Pfad, nicht die Filterlogik.
        if self._eingefuegt:
            # Ein Insert gibt die angelegte Zeile zurück; der Service liest
            # daraus die Kennung.
            return type("Antwort", (), {"data": [{"id": "neu"}], "count": 1})()
        zeilen = _BESTAND.get(self._tabelle, [])
        return type(
            "Antwort", (), {"data": list(zeilen), "count": len(zeilen)}
        )()

    # Schreiben: wird protokolliert, nicht ausgeführt.
    def insert(self, *_args: Any, **_kwargs: Any) -> _Abfrage:
        self._protokoll.append(f"insert {self._tabelle}")
        self._eingefuegt = True
        return self

    def update(self, *_args: Any, **_kwargs: Any) -> _Abfrage:
        self._protokoll.append(f"update {self._tabelle}")
        return self

    def delete(self, *_args: Any, **_kwargs: Any) -> _Abfrage:
        self._protokoll.append(f"delete {self._tabelle}")
        return self

    def upsert(self, *_args: Any, **_kwargs: Any) -> _Abfrage:
        self._protokoll.append(f"upsert {self._tabelle}")
        return self


class _Datenbank:
    def __init__(self) -> None:
        self.schreibzugriffe: list[str] = []

    def table(self, name: str) -> _Abfrage:
        return _Abfrage(name, self.schreibzugriffe)


@pytest.fixture
def ctx() -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="t1", role="admin")


class TestProbelaufSchreibtNicht:
    def test_kein_schreibzugriff_beim_probelauf(
        self, ctx: AuthContext
    ) -> None:
        """Die Kernzusage: der Bestand bleibt unangetastet."""
        db = _Datenbank()
        service = Dac7Service(db)  # type: ignore[arg-type]

        service.erzeugen(
            ctx, jahr=2025, art=Meldungsart.BETRIEB, speichern=False
        )

        assert db.schreibzugriffe == []

    def test_probelauf_liefert_keine_lauf_id(self, ctx: AuthContext) -> None:
        """Ohne Ablage gibt es nichts, worauf sich verweisen ließe."""
        service = Dac7Service(_Datenbank())  # type: ignore[arg-type]
        ergebnis = service.erzeugen(
            ctx, jahr=2025, art=Meldungsart.BETRIEB, speichern=False
        )
        assert ergebnis.lauf_id is None

    def test_probelauf_erzeugt_trotzdem_die_datei(
        self, ctx: AuthContext
    ) -> None:
        """Ohne Ablage, aber mit Ergebnis — sonst wäre der Lauf sinnlos."""
        service = Dac7Service(_Datenbank())  # type: ignore[arg-type]
        ergebnis = service.erzeugen(
            ctx, jahr=2025, art=Meldungsart.BETRIEB, speichern=False
        )
        assert ergebnis.erfolgreich, [f.grund for f in ergebnis.bericht.fehler]
        assert ergebnis.datei is not None
        assert ergebnis.lauf_id is None

    def test_echter_lauf_legt_dagegen_ab(self, ctx: AuthContext) -> None:
        """Die Gegenprobe: Ohne sie wäre nicht belegt, dass der Test greift.

        Beim Bau war genau das der Fehler — die Prüfung lief gegen einen
        leeren Bestand, erreichte den Ablege-Pfad nie und blieb auch dann
        grün, als der Probelauf absichtlich schrieb.
        """
        db = _Datenbank()
        service = Dac7Service(db)  # type: ignore[arg-type]
        service.erzeugen(
            ctx, jahr=2025, art=Meldungsart.BETRIEB, speichern=True
        )
        assert any(
            zugriff.startswith("insert dac7_meldelaeufe")
            for zugriff in db.schreibzugriffe
        ), db.schreibzugriffe


class TestJahresgrenzen:
    def test_zu_frueh_wird_abgewiesen(self, ctx: AuthContext) -> None:
        """DAC7 gilt ab dem Meldezeitraum 2023."""
        service = Dac7Service(_Datenbank())  # type: ignore[arg-type]
        with pytest.raises(Dac7Error) as fehler:
            service.erzeugen(ctx, jahr=2022, speichern=False)
        assert fehler.value.status_code == 422

    def test_zukunft_wird_abgewiesen(self, ctx: AuthContext) -> None:
        """Ein künftiges Jahr ist kein Meldezeitraum."""
        service = Dac7Service(_Datenbank())  # type: ignore[arg-type]
        with pytest.raises(Dac7Error) as fehler:
            service.erzeugen(ctx, jahr=2999, speichern=False)
        assert fehler.value.status_code == 422


class TestScope:
    def test_ohne_betrieb_kein_lauf(self) -> None:
        """Ein Kontext ohne Betrieb darf keine Meldung erzeugen."""
        service = Dac7Service(_Datenbank())  # type: ignore[arg-type]
        ohne = AuthContext(user_id="u1", tenant_id=None, role="admin")
        with pytest.raises(Dac7Error) as fehler:
            service.erzeugen(ohne, jahr=2025, speichern=False)
        assert fehler.value.status_code == 403


class _DatenbankOhneSelbstauskunft(_Datenbank):
    """Der reale Zustand: keine `taxpayer_info`, aber eine USt-IdNr.

    So sieht der Bestand bei einem daenischen Betrieb aus, der seine
    Rechnungsdaten gepflegt hat. Er hat KEINE zweite Steuernummer, die er
    zusaetzlich erfassen koennte — in Daenemark ist die CVR-Nummer die
    einzige, und sie steht als USt-IdNr. `DK44179377` bereits im
    Rechnungsprofil.
    """

    def table(self, name: str) -> _Abfrage:
        if name == "taxpayer_info":
            return _Abfrage("__leer__", self.schreibzugriffe)
        if name == "tenant_billing_profile":
            return _Abfrage("__rechnungsprofil__", self.schreibzugriffe)
        return super().table(name)


_BESTAND["__leer__"] = []
_BESTAND["__rechnungsprofil__"] = [
    {
        "vat_id": "DK44179377",
        "legal_name": "AirSmil",
        "company_street": "Hirtshalsvej",
        "company_house_number": "21",
        "company_postal_code": "9881",
        "company_city": "Bindslev",
        "company_country": "DK",
    }
]


class TestCvrAusDemRechnungsprofil:
    """In Daenemark reicht EINE Nummer — die CVR aus der USt-IdNr."""

    def test_meldung_entsteht_ohne_taxpayer_info(
        self, ctx: AuthContext
    ) -> None:
        """Ohne diese Ableitung bricht der Lauf ab, obwohl alles da ist."""
        service = Dac7Service(  # type: ignore[arg-type]
            _DatenbankOhneSelbstauskunft()
        )
        ergebnis = service.erzeugen(
            ctx, jahr=2025, art=Meldungsart.BETRIEB, speichern=False
        )
        assert ergebnis.erfolgreich, [f.grund for f in ergebnis.bericht.fehler]
        assert ergebnis.datei is not None

    def test_die_cvr_steht_ohne_praefix_in_der_datei(
        self, ctx: AuthContext
    ) -> None:
        """`TIN = 44179377`, nicht `DK44179377`.

        So steht es in der echten Meldung im Blatt `Indberetning` der
        amtlichen Vorlage: Das Laenderkuerzel gehoert in
        `TIN_ISSUED_BY`, nicht in die Nummer.
        """
        service = Dac7Service(  # type: ignore[arg-type]
            _DatenbankOhneSelbstauskunft()
        )
        ergebnis = service.erzeugen(
            ctx, jahr=2025, art=Meldungsart.BETRIEB, speichern=False
        )
        assert ergebnis.datei is not None
        assert ";44179377;" in ergebnis.datei
        assert "DK44179377;" not in ergebnis.datei

    def test_cpr_steht_mit_bindestrich_in_der_datei(
        self, ctx: AuthContext
    ) -> None:
        """Alle 18 Personennummern der echten Meldung tragen ihn."""
        service = Dac7Service(  # type: ignore[arg-type]
            _DatenbankOhneSelbstauskunft()
        )
        ergebnis = service.erzeugen(
            ctx, jahr=2025, art=Meldungsart.BETRIEB, speichern=False
        )
        assert ergebnis.datei is not None
        assert "010190-1234" in ergebnis.datei
