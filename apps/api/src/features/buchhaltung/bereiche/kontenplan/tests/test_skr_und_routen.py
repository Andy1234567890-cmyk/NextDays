"""SKR-Datenmodul konsistent; jede Route trägt den Buchhaltungs-Guard."""

from src.features.buchhaltung.bereiche.kontenplan.router import router
from src.features.buchhaltung.bereiche.kontenplan.schemas import ACCOUNT_TYPES
from src.features.buchhaltung.bereiche.kontenplan.skr import STANDARDKONTEN, standardkonten


def test_skr_nummern_eindeutig_und_typen_gueltig() -> None:
    for rahmen, attr in (("SKR03", "skr03"), ("SKR04", "skr04")):
        nummern = [getattr(k, attr) for k in STANDARDKONTEN]
        assert len(nummern) == len(set(nummern)), rahmen
        assert all(n.isdigit() and 1 <= len(n) <= 10 for n in nummern), rahmen
    assert all(k.type in ACCOUNT_TYPES for k in STANDARDKONTEN)


def test_skr_steuersatz_nur_wo_im_namen() -> None:
    """Wurzel 4: ein Satz steht nur an Konten, deren Name ihn festlegt."""
    for k in STANDARDKONTEN:
        if k.tax_rate is not None:
            assert f"{k.tax_rate} %" in k.name, k
        else:
            assert " % " not in k.name or "%" not in k.name.split("%")[0][-3:], k


def test_standardkonten_referenz_kreuzt() -> None:
    skr03 = {k["number"]: k for k in standardkonten("SKR03")}
    skr04 = {k["number"]: k for k in standardkonten("SKR04")}
    assert skr03["8400"]["skr_reference"] == "4400"
    assert skr04["4400"]["skr_reference"] == "8400"
    assert all(k["is_system"] for k in skr03.values())
    assert skr03["8400"]["tax_rate"] == "19"
    assert skr03["1200"]["tax_rate"] is None


def _guards(route) -> set[str]:  # noqa: ANN001
    namen: set[str] = set()

    def lauf(dep) -> None:  # noqa: ANN001
        for sub in dep.dependencies:
            namen.add(getattr(sub.call, "__name__", ""))
            lauf(sub)

    lauf(route.dependant)
    return namen


def test_jede_route_gegated() -> None:
    routen = [r for r in router.routes if hasattr(r, "dependant")]
    assert routen
    for r in routen:
        assert "_require_agency_finance_with_modul" in _guards(r), r.path


def test_kein_next_endpunkt() -> None:
    """GoBD: Nummern zieht nur der Server beim Speichern eines Belegs."""
    pfade = {r.path for r in router.routes}
    assert not any(p.endswith("/next") for p in pfade)
