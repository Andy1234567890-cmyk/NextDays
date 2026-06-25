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

    # Die ECHTE Engine-Logik nachbilden (engine._combine_factors): Aufschläge
    # stapeln multiplikativ, von den Rabatten zählt NUR der stärkste — schwächere
    # Rabatte werden verworfen. Eine simple Auflistung aller Prozente wäre
    # irreführend (sie suggeriert eine Addition, die nicht stattfindet, und nennt
    # verworfene Rabatte als wirksam). Wir formulieren stattdessen eine
    # nachvollziehbare Schrittfolge mit konkreten Euro-Beträgen.
    def cur_str(v: float) -> str:
        return f"{round(v):d} {currency}"

    ups: list[tuple[float, str, float]] = []   # (betrag-pct, label, mult)
    downs: list[tuple[float, str, float]] = []
    for key, mult in factors.items():
        if abs(mult - 1.0) < 0.005:
            continue
        pct = round((mult - 1.0) * 100, 1)
        label = _FACTOR_LABELS.get(key, key)
        (ups if pct > 0 else downs).append((abs(pct), label, mult))
    ups.sort(reverse=True)
    downs.sort(reverse=True)

    # Schrittfolge wie die Engine: Basis → alle Aufschläge → stärkster Rabatt.
    steps: list[str] = [f"Start: Grundpreis {cur_str(base_price)}."]
    running = base_price
    for pct, label, mult in ups:
        running *= mult
        steps.append(
            f"{label} erhöht um {str(round(pct,1)).replace('.', ',')} % "
            f"→ {cur_str(running)}."
        )
    if downs:
        strongest = min(downs, key=lambda x: x[2])  # kleinster Multiplikator
        spct, slabel, smult = strongest
        running *= smult
        steps.append(
            f"Stärkster Rabatt — {slabel} — senkt um "
            f"{str(round(spct,1)).replace('.', ',')} % → {cur_str(running)}."
        )
        ignored = [d for d in downs if d is not strongest]
        if ignored:
            names = ", ".join(d[1] for d in ignored)
            steps.append(
                f"Weitere Rabatte ({names}) werden NICHT zusätzlich abgezogen — "
                "es zählt immer nur der größte Rabatt, damit der Preis nicht zu "
                "tief fällt."
            )
    facts_block = "\n".join(f"{i+1}. {s}" for i, s in enumerate(steps))

    final_str = f"{final_price:.0f} {currency}"
    day_line = f" für den {day}" if day else ""

    system = (
        "Du erklärst Gastgebern in einfacher Sprache, wie ein automatischer "
        "Übernachtungspreis SCHRITT FÜR SCHRITT zustande kommt. Du bekommst die "
        "fertigen Rechenschritte (jeder mit Euro-Zwischenergebnis) und musst sie "
        "in eine klare, verständliche Begründung umschreiben.\n"
        "REGELN: Übernimm ALLE Zahlen, Prozentwerte und Euro-Beträge EXAKT wie "
        "geliefert — rechne NICHTS selbst nach und erfinde nichts. Folge der "
        "Reihenfolge der Schritte. Mach klar, dass die Aufschläge nacheinander "
        "draufkommen und dass von mehreren Rabatten nur der größte zählt (falls "
        "im Text erwähnt). Schreibe 2–4 kurze, flüssige deutsche Sätze ohne "
        "Aufzählungszeichen, sodass ein Laie die Rechnung nachvollziehen kann."
    )
    user = (
        f"Endpreis{day_line}: {final_str}\n"
        f"Rechenschritte (exakt übernehmen, in dieser Reihenfolge):\n{facts_block}\n\n"
        "Schreibe die nachvollziehbare Begründung."
    )

    try:
        return client.chat(system=system, user=user, temperature=0.2, max_tokens=240)
    except GroqError as exc:
        log.warning("price_explain_failed", error=exc.message)
        raise PriceExplainError(exc.message, status_code=exc.status_code) from exc
