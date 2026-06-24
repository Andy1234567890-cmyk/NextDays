"""KI-Preiserklärung (on-demand) — macht aus der Faktor-Aufschlüsselung Klartext.

Die Engine rechnet deterministisch (engine.py); jeder dynamic_prices-Tag trägt
seine Faktor-Aufschlüsselung (factors: {faktor: multiplikator}). Dieses Modul gibt
diese FERTIGEN Zahlen an das Groq-LLM und lässt sie in eine kurze, verständliche
Begründung übersetzen („Warum dieser Preis?"). Das LLM RECHNET NICHT und erfindet
keine Werte — es formuliert nur die gelieferten Faktoren aus.

On-demand: wird nur aufgerufen, wenn der Nutzer im UI eine Erklärung anfordert —
nicht im täglichen Recompute (Kosten/Geschwindigkeit).

„Keine Fallbacks": ohne Groq-Key oder bei API-Fehler wird ein klarer Fehler
gemeldet (kein erfundener Erklärtext).
"""
from __future__ import annotations

from src.core.logging import get_logger
from src.features.inbox.ai import GroqClient, GroqError

log = get_logger("nextdays.pricing.explain")

# Lesbare Namen der Engine-Faktoren für den LLM-Prompt (Schlüssel = engine.factors).
_FACTOR_LABELS = {
    "season": "Saison",
    "event": "Event/Feiertag",
    "weekend": "Wochenende",
    "occupancy": "Auslastung",
    "pickup": "Buchungsgeschwindigkeit (Pickup)",
    "last_minute": "Last-Minute",
    "orphan": "Lücken-Tag",
    "market": "Markt/Wettbewerb",
    "weather": "Wetter",
    "rate_rules": "Eigene Regel",
}


class PriceExplainError(Exception):
    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def explain_price(
    *,
    base_price: float,
    final_price: float,
    factors: dict[str, float],
    currency: str = "EUR",
    day: str | None = None,
    client: GroqClient | None = None,
) -> str:
    """Klartext-Begründung für einen berechneten Tagespreis.

    base_price = Anker, final_price = berechneter Preis, factors = Multiplikatoren
    aus der Engine. Gibt 2–3 Sätze in einfacher Sprache zurück, die erklären,
    welche Faktoren den Preis wie bewegt haben. Faktoren ~1.0 (neutral) werden
    weggelassen."""
    client = client or GroqClient()
    if not client.is_configured:
        raise PriceExplainError(
            "KI-Erklärung ist nicht konfiguriert (Groq-API-Key fehlt).",
            status_code=503,
        )

    # Nur wirksame Faktoren (deutlich != 1.0) an das LLM geben — als fertige %.
    active: list[str] = []
    for key, mult in factors.items():
        if abs(mult - 1.0) < 0.005:
            continue
        pct = round((mult - 1.0) * 100, 1)
        label = _FACTOR_LABELS.get(key, key)
        sign = "+" if pct >= 0 else ""
        active.append(f"{label}: {sign}{pct} %")
    factor_text = "; ".join(active) or "keine besonderen Faktoren (neutral)"

    system = (
        "Du erklärst Ferienunterkunfts-Gastgebern in einfacher, knapper Sprache, "
        "wie ein automatisch berechneter Tagespreis zustande kommt. Du bekommst "
        "den Basispreis, den Endpreis und die bereits berechneten Einfluss-"
        "Faktoren in Prozent. RECHNE NICHT selbst und erfinde KEINE Zahlen — "
        "nutze nur die gelieferten Werte. Antworte in 2–3 kurzen deutschen Sätzen, "
        "ohne Aufzählungszeichen. Nenne die wichtigsten Treiber zuerst. Spekuliere "
        "NICHT über die Reihenfolge oder die genaue Verrechnung der Faktoren — "
        "nenne nur, welche Faktoren den Preis nach oben bzw. unten bewegen."
    )
    day_line = f" für den {day}" if day else ""
    user = (
        f"Basispreis: {base_price:.0f} {currency}\n"
        f"Endpreis{day_line}: {final_price:.0f} {currency}\n"
        f"Faktoren: {factor_text}\n\n"
        "Erkläre dem Gastgeber, warum dieser Preis so berechnet wurde."
    )

    try:
        return client.chat(system=system, user=user, temperature=0.3, max_tokens=220)
    except GroqError as exc:
        log.warning("price_explain_failed", error=exc.message)
        raise PriceExplainError(exc.message, status_code=exc.status_code) from exc
