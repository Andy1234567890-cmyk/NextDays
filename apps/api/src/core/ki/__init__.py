"""Der gemeinsame KI-Anbieter (Vertex AI / Gemini, regional in der EU).

Liegt in ``core``, weil ihn mehrere Slices nutzen: der Website-Baukasten
(``site_config``) und der Posteingang (``inbox``, ``whatsapp``). Vorher stand
er im Baukasten-Slice; ein zweiter Nutzer hätte dann quer in einen fremden
Slice importieren müssen.
"""

from .client import (
    MAX_ANTWORT_TOKENS,
    MAX_PROMPT_ZEICHEN,
    KiAntwort,
    KiError,
    VertexClient,
)

__all__ = [
    "MAX_ANTWORT_TOKENS",
    "MAX_PROMPT_ZEICHEN",
    "KiAntwort",
    "KiError",
    "VertexClient",
]
