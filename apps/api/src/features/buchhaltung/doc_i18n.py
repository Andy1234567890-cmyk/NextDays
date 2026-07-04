"""Dokumentsprache für Belege aus Buchungen (Rechnungssprache = Gastsprache).

Kleiner Begriffskatalog für die vom Booking→Invoice-Builder ERZEUGTEN Texte
(Aufenthalts-Label, Sammelposition, head_text, Einheit, Addon-Fallback) in den
24 EU-Amtssprachen — dieselben Locales wie apps/web/messages/*. Die statischen
PDF-Beschriftungen (Spaltenköpfe, Summen) übersetzt das Frontend über
apps/web/hooks/pdf/useDocumentTranslation.

Unbekannte/fehlende Gastsprache → "de" (Betreibersprache, dokumentierter
Rückfall — es wird keine Sprache erfunden, nur die Anzeigesprache gewählt).
"""
from __future__ import annotations

from datetime import date

SUPPORTED: frozenset[str] = frozenset(
    {
        "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
        "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
    }
)

_DEFAULT = "de"

# Begriff „Aufenthalt" (Label der Sammelposition + head_text-Anfang).
_STAY: dict[str, str] = {
    "bg": "Престой",
    "cs": "Pobyt",
    "da": "Ophold",
    "de": "Aufenthalt",
    "el": "Διαμονή",
    "en": "Stay",
    "es": "Estancia",
    "et": "Majutus",
    "fi": "Majoitus",
    "fr": "Séjour",
    "ga": "Tréimhse chónaithe",
    "hr": "Boravak",
    "hu": "Tartózkodás",
    "it": "Soggiorno",
    "lt": "Viešnagė",
    "lv": "Uzturēšanās",
    "mt": "Soġġorn",
    "nl": "Verblijf",
    "pl": "Pobyt",
    "pt": "Estadia",
    "ro": "Sejur",
    "sk": "Pobyt",
    "sl": "Bivanje",
    "sv": "Vistelse",
}

# Einheit der Positionen (heute überall „pauschal" — quantity ist immer 1).
_FLAT_RATE: dict[str, str] = {
    "bg": "фиксирана сума",
    "cs": "paušál",
    "da": "fast beløb",
    "de": "pauschal",
    "el": "κατ' αποκοπή",
    "en": "flat rate",
    "es": "importe fijo",
    "et": "kindel summa",
    "fi": "kiinteä hinta",
    "fr": "forfait",
    "ga": "ráta comhréidh",
    "hr": "paušalno",
    "hu": "átalány",
    "it": "forfettario",
    "lt": "fiksuota suma",
    "lv": "fiksēta summa",
    "mt": "rata fissa",
    "nl": "vast bedrag",
    "pl": "ryczałt",
    "pt": "montante fixo",
    "ro": "sumă fixă",
    "sk": "paušál",
    "sl": "pavšal",
    "sv": "fast belopp",
}

# Fallback-Label für Addon-Snapshots ohne Namen.
_EXTRA_SERVICE: dict[str, str] = {
    "bg": "Допълнителна услуга",
    "cs": "Doplňková služba",
    "da": "Ekstra ydelse",
    "de": "Zusatzleistung",
    "el": "Πρόσθετη υπηρεσία",
    "en": "Additional service",
    "es": "Servicio adicional",
    "et": "Lisateenus",
    "fi": "Lisäpalvelu",
    "fr": "Prestation supplémentaire",
    "ga": "Seirbhís bhreise",
    "hr": "Dodatna usluga",
    "hu": "Kiegészítő szolgáltatás",
    "it": "Servizio aggiuntivo",
    "lt": "Papildoma paslauga",
    "lv": "Papildu pakalpojums",
    "mt": "Servizz addizzjonali",
    "nl": "Extra dienst",
    "pl": "Usługa dodatkowa",
    "pt": "Serviço adicional",
    "ro": "Serviciu suplimentar",
    "sk": "Doplnková služba",
    "sl": "Dodatna storitev",
    "sv": "Tilläggstjänst",
}

# Fallback-Label für Positionszeilen ohne Label.
_ITEM: dict[str, str] = {
    "bg": "Позиция",
    "cs": "Položka",
    "da": "Position",
    "de": "Position",
    "el": "Θέση",
    "en": "Item",
    "es": "Concepto",
    "et": "Kirje",
    "fi": "Erä",
    "fr": "Poste",
    "ga": "Mír",
    "hr": "Stavka",
    "hu": "Tétel",
    "it": "Voce",
    "lt": "Pozicija",
    "lv": "Pozīcija",
    "mt": "Partita",
    "nl": "Post",
    "pl": "Pozycja",
    "pt": "Rubrica",
    "ro": "Poziție",
    "sk": "Položka",
    "sl": "Postavka",
    "sv": "Post",
}

# Nacht-Begriff: (Singular, Plural-Standard). Sprachen mit zählabhängigen
# Formen werden in nights_label() gesondert behandelt.
_NIGHT: dict[str, tuple[str, str]] = {
    "bg": ("нощувка", "нощувки"),
    "cs": ("noc", "nocí"),
    "da": ("nat", "nætter"),
    "de": ("Nacht", "Nächte"),
    "el": ("διανυκτέρευση", "διανυκτερεύσεις"),
    "en": ("night", "nights"),
    "es": ("noche", "noches"),
    "et": ("öö", "ööd"),
    "fi": ("yö", "yötä"),
    "fr": ("nuit", "nuits"),
    "ga": ("oíche", "oícheanta"),
    "hr": ("noć", "noći"),
    "hu": ("éjszaka", "éjszaka"),
    "it": ("notte", "notti"),
    "lt": ("naktis", "naktų"),
    "lv": ("nakts", "naktis"),
    "mt": ("lejl", "ljieli"),
    "nl": ("nacht", "nachten"),
    "pl": ("noc", "nocy"),
    "pt": ("noite", "noites"),
    "ro": ("noapte", "nopți"),
    "sk": ("noc", "nocí"),
    "sl": ("noč", "noči"),
    "sv": ("natt", "nätter"),
}

# Datumsformat je Sprache (strftime).
_DATE_FMT: dict[str, str] = {
    "bg": "%d.%m.%Y",
    "cs": "%d. %m. %Y",
    "da": "%d.%m.%Y",
    "de": "%d.%m.%Y",
    "el": "%d/%m/%Y",
    "en": "%d/%m/%Y",
    "es": "%d/%m/%Y",
    "et": "%d.%m.%Y",
    "fi": "%d.%m.%Y",
    "fr": "%d/%m/%Y",
    "ga": "%d/%m/%Y",
    "hr": "%d. %m. %Y.",
    "hu": "%Y. %m. %d.",
    "it": "%d/%m/%Y",
    "lt": "%Y-%m-%d",
    "lv": "%d.%m.%Y",
    "mt": "%d/%m/%Y",
    "nl": "%d-%m-%Y",
    "pl": "%d.%m.%Y",
    "pt": "%d/%m/%Y",
    "ro": "%d.%m.%Y",
    "sk": "%d. %m. %Y",
    "sl": "%d. %m. %Y",
    "sv": "%Y-%m-%d",
}


def resolve_language(guest_language: object) -> str:
    """Gastsprache → unterstützte Dokumentsprache ('de-AT' → 'de'; unbekannt/None → 'de')."""
    raw = str(guest_language or "").strip().lower()
    code = raw.replace("_", "-").split("-", maxsplit=1)[0]
    return code if code in SUPPORTED else _DEFAULT


def flat_rate_unit(lang: str) -> str:
    return _FLAT_RATE.get(lang, _FLAT_RATE[_DEFAULT])


def extra_service_label(lang: str) -> str:
    return _EXTRA_SERVICE.get(lang, _EXTRA_SERVICE[_DEFAULT])


def item_fallback_label(lang: str) -> str:
    return _ITEM.get(lang, _ITEM[_DEFAULT])


def fmt_date(lang: str, iso: str) -> str:
    """ISO-Datum in landesübliche Schreibweise der Dokumentsprache."""
    try:
        return date.fromisoformat(iso).strftime(_DATE_FMT.get(lang, _DATE_FMT[_DEFAULT]))
    except ValueError:
        return iso


def nights_label(lang: str, nights: int) -> str:
    """„3 Nächte" in der Dokumentsprache, inkl. zählabhängiger Pluralformen
    (slawische/baltische Sprachen, Rumänisch ≥20 mit „de")."""
    singular, plural = _NIGHT.get(lang, _NIGHT[_DEFAULT])
    if nights == 1:
        return f"1 {singular}"
    word = plural
    tens = nights % 100
    unit = nights % 10
    if lang in ("cs", "sk") and 2 <= nights <= 4:
        word = "noci"
    elif lang == "pl" and 2 <= unit <= 4 and not 12 <= tens <= 14:
        word = "noce"
    elif lang == "lt":
        if unit == 1 and tens != 11:
            word = "naktis"
        elif 2 <= unit <= 9 and not 11 <= tens <= 19:
            word = "naktys"
    elif lang == "lv" and unit == 1 and tens != 11:
        word = "nakts"
    elif lang == "ro" and (tens == 0 or 20 <= tens <= 99):
        # Rumänisch: „de" nur wenn die letzten zwei Ziffern 00 oder 20–99 sind
        # (20 de nopți, 100 de nopți, aber 101 nopți).
        return f"{nights} de {plural}"
    return f"{nights} {word}"


def stay_label(
    lang: str, property_title: str, check_in: str, check_out: str, nights: int
) -> str:
    """Label der Sammelposition: „Aufenthalt {Objekt} {von} – {bis} ({n Nächte})"."""
    stay = f"{fmt_date(lang, check_in)} – {fmt_date(lang, check_out)}"
    label = f"{_STAY.get(lang, _STAY[_DEFAULT])} {property_title} {stay}".strip()
    if nights > 0:
        label += f" ({nights_label(lang, nights)})"
    return label


def head_text(
    lang: str, check_in: str, check_out: str, nights: int, property_title: str
) -> str:
    """Kopftext des Belegs: „Aufenthalt {von} – {bis} ({n Nächte}), {Objekt}"."""
    text = (
        f"{_STAY.get(lang, _STAY[_DEFAULT])} "
        f"{fmt_date(lang, check_in)} – {fmt_date(lang, check_out)}"
        f" ({nights_label(lang, nights)})"
    )
    if property_title:
        text += f", {property_title}"
    return text
