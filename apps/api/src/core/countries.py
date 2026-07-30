"""Zentrale Länder-Normalisierung auf ISO-3166-1 alpha-2 (eine Quelle der Wahrheit).

Objekte/Firmen/Owner speichern ihr Land als ISO-2-Code („DE"), NIE als Klartext-
Name („Germany"/„Deutschland") — sonst brechen Channex (max 2 Zeichen), Zeitzone,
Währungs- und Steuerableitung, die alle ISO-2 erwarten.

``normalize_country`` nimmt entweder einen bereits gültigen ISO-2-Code oder einen
Landesnamen (deutsch ODER englisch, wie ihn der Google-Places-Picker je nach
Sprache liefert) und gibt den ISO-2-Code zurück. Unbekannt → None (der Aufrufer
schlägt fail-closed fehl, kein erfundener Ersatzwert — Wurzel 4).

Umfang bewusst wie ``apps/web/lib/countries.ts``: 27 EU + CH/GB. Erweiterung nur
gemeinsam mit der Frontend-Liste (Single Source of Truth).
"""

# ISO-2 → (deutscher Name, englischer Name). Deutsche Namen identisch zu
# countries.ts; englische Namen sind die von Google Places gelieferten long_name.
_COUNTRIES: dict[str, tuple[str, str]] = {
    "BE": ("Belgien", "Belgium"),
    "BG": ("Bulgarien", "Bulgaria"),
    "DK": ("Dänemark", "Denmark"),
    "DE": ("Deutschland", "Germany"),
    "EE": ("Estland", "Estonia"),
    "FI": ("Finnland", "Finland"),
    "FR": ("Frankreich", "France"),
    "GR": ("Griechenland", "Greece"),
    "IE": ("Irland", "Ireland"),
    "IT": ("Italien", "Italy"),
    "HR": ("Kroatien", "Croatia"),
    "LV": ("Lettland", "Latvia"),
    "LT": ("Litauen", "Lithuania"),
    "LU": ("Luxemburg", "Luxembourg"),
    "MT": ("Malta", "Malta"),
    "NL": ("Niederlande", "Netherlands"),
    "AT": ("Österreich", "Austria"),
    "PL": ("Polen", "Poland"),
    "PT": ("Portugal", "Portugal"),
    "RO": ("Rumänien", "Romania"),
    "SE": ("Schweden", "Sweden"),
    "SK": ("Slowakei", "Slovakia"),
    "SI": ("Slowenien", "Slovenia"),
    "ES": ("Spanien", "Spain"),
    "CZ": ("Tschechien", "Czechia"),
    "HU": ("Ungarn", "Hungary"),
    "CY": ("Zypern", "Cyprus"),
    "CH": ("Schweiz", "Switzerland"),
    "GB": ("Vereinigtes Königreich", "United Kingdom"),
}

_VALID_CODES: frozenset[str] = frozenset(_COUNTRIES)

# ISO-2 → internationale Telefonvorwahl (E.164, inkl. „+"). Identisch zur
# `dialCode`-Spalte in packages/ui/src/countries.ts — Erweiterung nur gemeinsam.
# Gebraucht wird sie dort, wo eine national gespeicherte Nummer („1234567890")
# für einen Empfänger auf E.164 gebracht werden muss (Stripe lehnt Nummern ohne
# Landesvorwahl mit "not a valid phone number" ab).
_DIAL_CODES: dict[str, str] = {
    "BE": "+32", "BG": "+359", "DK": "+45", "DE": "+49", "EE": "+372",
    "FI": "+358", "FR": "+33", "GR": "+30", "IE": "+353", "IT": "+39",
    "HR": "+385", "LV": "+371", "LT": "+370", "LU": "+352", "MT": "+356",
    "NL": "+31", "AT": "+43", "PL": "+48", "PT": "+351", "RO": "+40",
    "SE": "+46", "SK": "+421", "SI": "+386", "ES": "+34", "CZ": "+420",
    "HU": "+36", "CY": "+357", "CH": "+41", "GB": "+44",
}


def dial_code(country: str | None) -> str | None:
    """Telefonvorwahl zu einem ISO-2-Ländercode („DE" → „+49").

    Unbekanntes/leeres Land → None. Der Aufrufer entscheidet dann, ob er ohne
    Vorwahl weitermacht oder fehlschlägt — geraten wird hier nichts (Wurzel 4).
    """
    return _DIAL_CODES.get((country or "").strip().upper())

# Name (lower-case, deutsch + englisch + Varianten) → ISO-2.
_NAME_TO_CODE: dict[str, str] = {}
for _code, (_de, _en) in _COUNTRIES.items():
    _NAME_TO_CODE[_de.lower()] = _code
    _NAME_TO_CODE[_en.lower()] = _code
# Häufige Varianten, die Google Places/Nutzer liefern.
_NAME_TO_CODE.update({
    "czech republic": "CZ",
    "united kingdom of great britain and northern ireland": "GB",
    "great britain": "GB",
    "uk": "GB",
    "the netherlands": "NL",
    "österreich": "AT",
})


def is_iso2_country(value: str | None) -> bool:
    return isinstance(value, str) and value.upper() in _VALID_CODES


def normalize_country(value: str | None) -> str | None:
    """ISO-2-Code oder Landesname → ISO-2-Code. Unbekannt/leer → None.

    Kein Fallback-Wert: Der Aufrufer entscheidet, ob ein fehlendes/unbekanntes
    Land ein harter Fehler ist (Wurzel 4/5)."""
    if not isinstance(value, str):
        return None
    v = value.strip()
    if not v:
        return None
    if v.upper() in _VALID_CODES:
        return v.upper()
    return _NAME_TO_CODE.get(v.lower())
