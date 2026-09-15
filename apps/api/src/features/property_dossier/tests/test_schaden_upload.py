"""Der Multipart-Pfad der Schadensmeldung — durch die echte HTTP-Schicht.

Die Foto-Pflicht ist in `test_inventar.py` festgenagelt, aber DORT wird der
Service direkt gerufen. Genau in der Lücke dazwischen saß der Fehler: der
Router las das Formular und prüfte `isinstance(teil, fastapi.UploadFile)` —
Starlettes Parser erzeugt aber `starlette.datastructures.UploadFile`, und
FastAPIs Klasse ist deren UNTERKLASSE. Die Prüfung war damit immer False, die
Bilderliste blieb leer, und der Service wies JEDE Meldung mit „Ohne Foto keine
Schadensmeldung" ab — auch die mit Foto.

Ein Test, der den Service direkt ruft, kann das nie sehen: er reicht die Bytes
selbst herein. Deshalb steht dieser hier und geht über den echten Parser.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.property_dossier import router as dossier_router
from src.features.property_dossier.dependencies import get_dossier_service
from src.features.property_dossier.schemas import InventarSchaden
from src.main import create_app

TID = "t1"
PID = "11111111-1111-4111-8111-111111111111"
PFAD = f"/api/v1/property-dossier/{PID}/inventar/schaeden"

JPG = b"\xff\xd8\xff" + b"x" * 100
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 100


class _FakeService:
    """Nimmt entgegen, was der Router durchreicht — geprüft wird genau das."""

    def __init__(self) -> None:
        self.fotos: list[bytes] | None = None
        self.felder: dict[str, Any] = {}

    def schaden_scope_pruefen(self, _ctx: object, _property_id: str) -> str:
        return TID

    def schaden_melden(
        self, _tenant_id: str, _property_id: str, **kwargs: Any
    ) -> InventarSchaden:
        self.fotos = kwargs["fotos"]
        self.felder = kwargs
        return InventarSchaden(
            id="s-1",
            item_name=kwargs["item_name"],
            art=kwargs["art"],
            menge=kwargs["menge"],
            traeger=kwargs["traeger"],
            gemeldet_am=datetime.now(UTC),
        )


# EINMAL pro Modul: `create_app()` montiert 79 Slices.
_APP = create_app()
_APP.dependency_overrides[dossier_router._inventar] = lambda: AuthContext(  # noqa: SLF001
    user_id="u-1", tenant_id=TID, role="cleaner"
)


def _client() -> tuple[TestClient, _FakeService]:
    svc = _FakeService()
    _APP.dependency_overrides[get_dossier_service] = lambda: svc
    return TestClient(_APP), svc


def _felder(**extra: str) -> dict[str, str]:
    return {"item_name": "Wasserkocher", "art": "beschaedigt", "traeger": "gast", **extra}


def test_ein_angehaengtes_foto_kommt_im_service_an() -> None:
    """Der Kern. Vor dem Fix war `fotos` hier leer und die Antwort ein 422."""
    client, svc = _client()
    res = client.post(
        PFAD,
        files={"foto": ("schaden.jpg", JPG, "image/jpeg")},
        data=_felder(),
    )
    assert res.status_code == 201, res.text
    assert svc.fotos == [JPG]


def test_mehrere_fotos_kommen_alle_an_und_in_der_reihenfolge() -> None:
    client, svc = _client()
    res = client.post(
        PFAD,
        files=[
            ("foto", ("eins.jpg", JPG, "image/jpeg")),
            ("foto", ("zwei.png", PNG, "image/png")),
        ],
        data=_felder(),
    )
    assert res.status_code == 201, res.text
    assert svc.fotos == [JPG, PNG]


def test_die_textfelder_kommen_neben_den_fotos_durch() -> None:
    """Sie dürfen nicht mit im Bilder-Eimer landen und die Bilder nicht bei ihnen."""
    client, svc = _client()
    res = client.post(
        PFAD,
        files={"foto": ("schaden.jpg", JPG, "image/jpeg")},
        data=_felder(beschreibung="Griff abgebrochen", menge="2"),
    )
    assert res.status_code == 201, res.text
    assert svc.felder["item_name"] == "Wasserkocher"
    assert svc.felder["beschreibung"] == "Griff abgebrochen"
    assert svc.felder["menge"] == 2


def test_unsinnige_menge_wirft_keinen_500() -> None:
    """Angreiferkontrollierter Text darf nicht im `int()` abstürzen (Wurzel 5)."""
    client, svc = _client()
    res = client.post(
        PFAD,
        files={"foto": ("schaden.jpg", JPG, "image/jpeg")},
        data=_felder(menge="viele"),
    )
    assert res.status_code == 201, res.text
    assert svc.felder["menge"] == 1


def test_ohne_foto_bleibt_die_liste_leer() -> None:
    """Die Pflicht selbst setzt der Service durch — der Router liefert ihm nur
    ehrlich eine leere Liste, statt sie immer leer zu lassen."""
    client, svc = _client()
    res = client.post(PFAD, data=_felder())
    assert res.status_code == 201, res.text
    assert svc.fotos == []
