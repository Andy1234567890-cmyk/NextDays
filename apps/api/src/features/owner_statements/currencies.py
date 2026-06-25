"""Land → Währung (ISO 4217) für die Owner-Abrechnung.

Der Eigentümer gibt sein Herkunftsland an; daraus leitet sich die Zielwährung
ab, in die seine Auszahlung umgerechnet wird. Eurozone-Länder → EUR, übrige
EU-/Nachbarländer ihre Landeswährung. Quelle der Umrechnung sind ECB-Tageskurse
(siehe fx.py).
"""
from __future__ import annotations

# ISO-3166-1 alpha-2 → ISO-4217. Deckt die 27 EU-Staaten + CH/GB ab (gleiche
# Länderliste wie apps/web/lib/countries.ts).
COUNTRY_CURRENCY: dict[str, str] = {
    # Eurozone
    "AT": "EUR",
    "BE": "EUR",
    "HR": "EUR",
    "CY": "EUR",
    "EE": "EUR",
    "FI": "EUR",
    "FR": "EUR",
    "DE": "EUR",
    "GR": "EUR",
    "IE": "EUR",
    "IT": "EUR",
    "LV": "EUR",
    "LT": "EUR",
    "LU": "EUR",
    "MT": "EUR",
    "NL": "EUR",
    "PT": "EUR",
    "SK": "EUR",
    "SI": "EUR",
    "ES": "EUR",
    # EU, eigene Währung
    "BG": "BGN",
    "CZ": "CZK",
    "DK": "DKK",
    "HU": "HUF",
    "PL": "PLN",
    "RO": "RON",
    "SE": "SEK",
    # Nachbarländer
    "CH": "CHF",
    "GB": "GBP",
}


def currency_for_country(country: str | None) -> str | None:
    """Zielwährung für ein Owner-Land. None, wenn unbekannt/leer — der Aufrufer
    entscheidet dann (kein stiller EUR-Fallback)."""
    if not country:
        return None
    return COUNTRY_CURRENCY.get(country.strip().upper())
