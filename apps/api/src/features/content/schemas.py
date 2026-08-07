"""Pydantic-Schemas für den content-Slice (inkl. Übersetzung)."""
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Ein BCP-47-Sprachcode: „no", „pt-BR", „zh-Hant". Bewusst KEINE feste Liste.
#
# Bis zum 07.08.2026 stand hier ein Enum mit `da`/`en`/`de` — passend, solange
# nur Objekttexte übersetzt wurden. Für den Gäste-Chat ist es falsch: Gäste
# schreiben aus aller Welt, und die erste Nachricht, an der es auffiel, war
# Norwegisch („Hei, tusen takk for et veldig fint opphold") — ein Code, den das
# Enum nicht kannte, also 422 statt Übersetzung. Eine Liste, die jede Sprache
# der Welt aufzählen müsste, ist keine Prüfung mehr, sondern eine Wartungslast,
# die beim nächsten Gast wieder zu kurz ist.
#
# Geprüft wird deshalb die FORM statt der Mitgliedschaft: 2–3 Buchstaben,
# optional Untertags. Das hält Unfug fern (kein freier String, der ungeprüft an
# Google geht), ohne einen echten Gast auszusperren. Eine Sprache, die Google
# nicht kennt, beantwortet Google selbst mit einem Fehler — das ist die
# richtige Stelle dafür, nicht unsere geratene Liste (Wurzel 4).
_SPRACHCODE = re.compile(r"^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$")

# Google kennt nur Kleinschreibung beim Primärtag; Skript-/Regionstags sind
# ihm egal. Wir normalisieren den Primärtag und lassen den Rest, wie er kam.


def _sprachcode_pruefen(wert: str | None) -> str | None:
    if wert is None:
        return None
    code = wert.strip()
    if not _SPRACHCODE.match(code):
        raise ValueError(
            "Kein gültiger Sprachcode (erwartet z. B. de, en, pt-BR)."
        )
    teile = code.split("-")
    return "-".join([teile[0].lower(), *teile[1:]])


class TranslateRequest(BaseModel):
    # max_length deckelt die nach Zeichen abgerechnete (kostenpflichtige) Google-
    # Translate-API: ohne Obergrenze könnte ein eingeloggter Nutzer/kompromittiertes
    # Token beliebig große Payloads schicken (Kostenmissbrauch). 50 000 Zeichen
    # decken einen langen Mietvertragstext bequem ab.
    text: str = Field(min_length=1, max_length=50_000)
    target: str = Field(min_length=2, max_length=35)
    # None = automatische Erkennung. Der Normalfall im Chat: welche Sprache der
    # Gast schreibt, weiß nur er selbst.
    source: str | None = Field(default=None, max_length=35)
    # Format-Whitelist (nicht freier String, der ungeprüft an Google geht).
    # HTML, weil der Rich-Text-Editor Markup liefert (B/I/U/Links); text = plain.
    fmt: Literal["html", "text"] = "html"

    @field_validator("target", "source")
    @classmethod
    def _codes_pruefen(cls, wert: str | None) -> str | None:
        return _sprachcode_pruefen(wert)


class TranslateResponse(BaseModel):
    text: str
    detected_source: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
