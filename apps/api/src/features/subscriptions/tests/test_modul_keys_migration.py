"""MODULE_KEYS im Code == CHECK-Constraint in der DB — reine Datenprüfung.

WARUM: `tenant_module_entitlement.module_key` trägt einen CHECK, der die Module
namentlich aufzählt (0117, danach 0254/0256/0278). Ein neuer Schlüssel im Code
ohne Migration ist live ein 23514 beim Upsert — der Kunde klickt „Aktivieren"
und bekommt einen 500, während alle Unit-Tests grün bleiben: der DB-Fake kennt
keine CHECKs. Genau so blieb `dynamische_preise` unbuchbar, bis 0278 kam.

Deshalb prüft dieser Test die Wurzel statt des Einzelfalls (Wurzel 1: zur
Code-Änderung gehört der DB-Gegenzustand) — er vergleicht `MODULE_KEYS` mit der
JÜNGSTEN Constraint-Definition in supabase/migrations.
"""
from __future__ import annotations

import re
from pathlib import Path

from src.features.subscriptions.schemas import MODULE_KEYS

# tests/ → subscriptions/ → features/ → src/ → api/ → apps/ → Repo-Wurzel
MIGRATIONS = Path(__file__).resolve().parents[6] / "supabase" / "migrations"

CONSTRAINT = re.compile(
    r"add\s+constraint\s+tenant_module_entitlement_module_key_check\s+"
    r"check\s*\(\s*module_key\s+in\s*\((?P<werte>[^)]*)\)",
    flags=re.IGNORECASE,
)


def _erlaubte_keys() -> set[str]:
    """Die Schlüssel aus der zuletzt angewendeten Constraint-Definition.

    Migrationen laufen in Dateinamen-Reihenfolge (supabase/apply-migrations.sh),
    also gewinnt der letzte Treffer — auch wenn eine Datei mehrere `add
    constraint` enthält (0256 nimmt 0254 zurück).
    """
    letzte: str | None = None
    for datei in sorted(MIGRATIONS.glob("*.sql")):
        for treffer in CONSTRAINT.finditer(datei.read_text(encoding="utf-8")):
            letzte = treffer.group("werte")
    assert letzte is not None, "Kein CHECK auf module_key in den Migrationen gefunden."
    return set(re.findall(r"'([a-z0-9_]+)'", letzte))


def test_module_keys_deckt_den_db_check_exakt_ab() -> None:
    """Jeder buchbare Schlüssel ist in der DB erlaubt — und kein Rest bleibt übrig.

    Fällt dieser Test, fehlt entweder die Migration zum neuen Modul (live 23514)
    oder in der DB steht ein Schlüssel, den der Code nicht mehr kennt.
    """
    assert set(MODULE_KEYS) == _erlaubte_keys()
