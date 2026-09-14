"""Jede Route des Bereichs trägt den Finanz-Rollen-Guard UND das Modul-
Entitlement — geprüft über den echten Dependency-Graphen, isoliert am
Bereichs-Router (der Sammel-Router zieht dreizehn parallel entstehende
Nachbarn mit)."""

from ..router import router


def _kette(route) -> set[str]:  # noqa: ANN001
    namen: set[str] = set()

    def _lauf(dep) -> None:  # noqa: ANN001
        for sub in dep.dependencies:
            namen.add(getattr(sub.call, "__name__", str(sub.call)))
            _lauf(sub)

    _lauf(route.dependant)
    return namen


def test_alle_routen_gegated() -> None:
    offen = []
    for route in router.routes:
        kette = _kette(route)
        if (
            not {
                "_require_agency_finance_with_modul",
                "_require_agency_finance",
                "get_current_user",
            }
            <= kette
        ):
            offen.append((route.path, sorted(route.methods)))
    assert not offen, offen
    assert len(router.routes) >= 20


def test_schreibrouten_haben_keine_eigenen_guards() -> None:
    """Kein selbstgebauter Guard — nur die aus ../../guards (Regel: NIE eigene)."""
    for route in router.routes:
        eigene = {
            n
            for n in _kette(route)
            if n.startswith("_require_")
            and "agency_finance" not in n
            and n != "_require_buchhaltung_modul"
        }
        assert not eigene, (route.path, eigene)
