"""Tests für den property_dossier-Slice (8-stufige Objektkartei).

Kernpunkte: tenant-Scope (fremdes Objekt → 404, Wurzel 3), verknüpfter Eigentümer
read-only aus owners, 1:n-Kind-Scope. Chain-Stub statt echter DB (Unit-Fake).
"""

from types import SimpleNamespace

import pytest

from src.features.property_dossier.schemas import ServiceAgreementBase
from src.features.property_dossier.service import (
    DossierError,
    PropertyDossierService,
)

TID = "t1"
PID = "11111111-1111-4111-8111-111111111111"
IID = "22222222-2222-4222-8222-222222222222"
OID = "33333333-3333-4333-8333-333333333333"


class _Chain:
    def __init__(self, data: object) -> None:
        self._data = data

    def __getattr__(self, _name: str) -> "_Chain":
        return self

    def __call__(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._data)


class _DB:
    def __init__(self, tables: dict[str, object]) -> None:
        self._tables = tables

    def table(self, name: str) -> _Chain:
        return _Chain(self._tables.get(name, []))


def _svc(tables: dict[str, object] | None = None, *, owns: bool = True) -> PropertyDossierService:
    base = {"properties": [{"id": PID}] if owns else []}
    base.update(tables or {})
    return PropertyDossierService(client=_DB(base))  # type: ignore[arg-type]


# --- tenant-Scope -----------------------------------------------------------
def test_foreign_property_is_404() -> None:
    with pytest.raises(DossierError) as exc:
        _svc(owns=False).get_process(TID, PID)
    assert exc.value.status_code == 404


def test_missing_tenant_is_400() -> None:
    with pytest.raises(DossierError) as exc:
        _svc().get_process(None, PID)
    assert exc.value.status_code == 400


def test_invalid_property_id_is_404() -> None:
    with pytest.raises(DossierError) as exc:
        _svc().get_process(TID, "not-a-uuid")
    assert exc.value.status_code == 404


# --- Stufe 1: verknüpfter Eigentümer read-only ------------------------------
def test_owner_none_when_no_link() -> None:
    out = _svc({"owner_properties": []}).get_owner(TID, PID)
    assert out is None


def test_owner_read_only_from_owners() -> None:
    svc = _svc(
        {
            "owner_properties": [{"owner_id": OID, "ownership_share": 100}],
            "owners": [{"id": OID, "name": "Bea", "iban": "DK123", "cpr_number": "010280-1234"}],
        }
    )
    out = svc.get_owner(TID, PID)
    assert out is not None
    assert out.name == "Bea"
    assert out.iban == "DK123"
    assert out.cpr_number == "010280-1234"
    assert out.ownership_share == 100


# --- 1:1-Upsert-Rückgabe ----------------------------------------------------
def test_put_process_returns_input() -> None:
    from src.features.property_dossier.schemas import ProcessData

    svc = _svc({"property_process": []})
    out = svc.put_process(TID, PID, ProcessData(contract_signed_at=None))
    assert isinstance(out, ProcessData)


def test_get_housebook_empty_default() -> None:
    out = _svc({"property_housebook": []}).get_housebook(TID, PID)
    assert out.physical_folder_placed is False


# --- 1:n-Kind-Scope ---------------------------------------------------------
def test_update_service_agreement_foreign_child_is_404() -> None:
    svc = _svc({"property_service_agreements": []})
    with pytest.raises(DossierError) as exc:
        svc.update_service_agreement(TID, PID, IID, ServiceAgreementBase(service_type="caretaker"))
    assert exc.value.status_code == 404


def test_delete_service_agreement_invalid_child_id_is_404() -> None:
    svc = _svc({"property_service_agreements": [{"id": IID}]})
    with pytest.raises(DossierError) as exc:
        svc.delete_service_agreement(TID, PID, "not-a-uuid")
    assert exc.value.status_code == 404
