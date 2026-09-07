"""Kopf- und Fußzeile als EBENEN: was sich je Teil einstellen lässt (0570).

Kopf- und Fußzeile kommen aus dem Theme, nicht aus Blöcken. Framer zeigt sie
trotzdem als aufklappbare Ebenen mit Kindern (Logo, Navigation, Buchen-Knopf
…), und der Ebenen-Baum des Editors baut das seit 05.09.2026 nach. Die
Einstellungen je Teil — auf welchen Geräten er fehlt, ob er gesperrt ist, in
welcher Reihenfolge die Teile stehen — sind SITE-WEIT und wohnen deshalb im
Branding (`tenant_site_config.header_teile` / `footer_teile`), nicht an einer
Seite.

Die Teile sind ein GESCHLOSSENER Satz: jeder Name hier ist eine Stelle im
Renderer (`builder/components/site-header.tsx`, `site-footer.tsx`). Ein Name
ohne Stelle wäre eine Zeile im Baum, die nichts tut (Wurzel 4).
SCHWESTERWERT: `KOPF_TEILE`/`FUSS_TEILE` in `packages/baukasten-stil`.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

#: SCHWESTERWERT von `BlockGeraet` (schemas.py) — steht hier als Literal,
#: weil `BrandingBase` vor `BlockGeraet` definiert ist.
Geraet = Literal["desktop", "tablet", "mobil"]
_GERAETE: tuple[str, ...] = ("desktop", "tablet", "mobil")

KopfTeil = Literal["logo", "slogan", "navigation", "sprachwaehler", "buchen"]
FussTeil = Literal["navigation", "social", "bildnachweise", "copyright"]


def _geraete_normalisieren(v: list[str]) -> list[str]:
    """Menge, keine Liste: entdoppeln und in fester Reihenfolge — dieselbe
    Eingabe zweimal ergibt denselben Wert (Wurzel 2)."""
    return sorted(set(v), key=_GERAETE.index)


class TeilEinstellung(BaseModel):
    """Ein Teil: auf welchen Geräten er fehlt, ob er im Editor gesperrt ist."""

    model_config = ConfigDict(extra="forbid")

    hidden_on: list[Geraet] = Field(default_factory=list, max_length=16)
    locked: bool = False

    _v_hidden = field_validator("hidden_on")(_geraete_normalisieren)


class _RegionTeile(TeilEinstellung):
    """Die Region selbst (Sichtbarkeit, Sperre) plus ihre Teile.

    `reihenfolge` darf jeden Teil höchstens einmal nennen; fehlende Teile hängt
    der Leser (Paket) in Standardreihenfolge hinten an. Damit ist ein
    Teil-Update („nur Buchen vor Sprachwähler") möglich, ohne alle zu nennen.
    """

    @field_validator("reihenfolge", check_fields=False)
    @classmethod
    def _keine_doppelten(cls, v: list[str] | None) -> list[str] | None:
        if v is not None and len(set(v)) != len(v):
            raise ValueError("Ein Teil steht doppelt in der Reihenfolge.")
        return v


class KopfzeileTeile(_RegionTeile):
    reihenfolge: list[KopfTeil] | None = Field(default=None, max_length=5)
    teile: dict[KopfTeil, TeilEinstellung] = Field(default_factory=dict)


class FusszeileTeile(_RegionTeile):
    reihenfolge: list[FussTeil] | None = Field(default=None, max_length=4)
    teile: dict[FussTeil, TeilEinstellung] = Field(default_factory=dict)
