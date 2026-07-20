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


# Kanon der wählbaren Objekt-/Preiswährungen. Die EU27+CH/GB-Landeswährungen
# (COUNTRY_CURRENCY) plus die beiden international gängigen (USD/GBP) — exakte
# Spiegelung von apps/web/lib/pricing-meta.ts (CURRENCY_OPTIONS), damit Frontend-
# Auswahl und Backend-Validierung EINE Quelle teilen. Kein voller ISO-4217-Satz:
# ein Code außerhalb dieser Liste kann über kein UI entstehen und ist ein
# Datenfehler → 422 (Wurzel 4/5), kein erfundener Ersatzwert.
SUPPORTED_CURRENCIES: frozenset[str] = frozenset(COUNTRY_CURRENCY.values()) | {
    "USD",
    "GBP",
}


def normalize_currency(value: str | None) -> str | None:
    """Objekt-/Preiswährung normalisieren: leer bleibt leer (None), sonst
    Großschreibung. Wirft ValueError bei einem nicht unterstützten Code — ein
    solcher Wert ist ein Datenfehler, kein legitimer Fall (kein stiller
    Fallback, Wurzel 4)."""
    if value is None or not value.strip():
        return None
    code = value.strip().upper()
    if code not in SUPPORTED_CURRENCIES:
        raise ValueError(
            f"Währung wird nicht unterstützt: {value!r}. Erlaubt sind "
            "EU27-Währungen, CHF, GBP und USD."
        )
    return code
