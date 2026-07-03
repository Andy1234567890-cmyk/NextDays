"""USt-IdNr.-Prüfung gegen VIES (offizieller EU-Prüfdienst, 27 EU-Länder).

Eigenes Modul (Slice-Konvention: service.py bleibt dünner Facade-Layer) —
BuchhaltungService delegiert hierher.
"""
import re

import httpx

from .service import BuchhaltungError

# Länderkürzel, die VIES kennt: die 27 EU-Staaten (Griechenland = EL, nicht GR)
# plus XI (Nordirland, Protokoll).
_VIES_COUNTRIES = frozenset({
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR",
    "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
    "SE", "SI", "SK", "XI",
})
_VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{country}/vat/{number}"


def check_vat_id(vat_id: str) -> dict:
    """USt-IdNr. prüfen. Zwei Stufen: (1) Grobformat lokal (Länderkürzel +
    alnum) → 422 mit Klartext; (2) Echtheit über die VIES-REST-API — sie kennt
    die landesspezifischen Formate und liefert bei gültigen Nummern Name/
    Anschrift zurück. VIES nicht erreichbar → 503 (Prüfung offen, kein
    stilles „gültig")."""
    cleaned = re.sub(r"[\s.\-]", "", (vat_id or "")).upper()
    if len(cleaned) < 4 or not cleaned[:2].isalpha():
        raise BuchhaltungError(
            "USt-IdNr. muss mit dem Länderkürzel beginnen (z. B. DE123456789).",
            status_code=422,
        )
    country, number = cleaned[:2], cleaned[2:]
    if country not in _VIES_COUNTRIES:
        raise BuchhaltungError(
            f"„{country}“ ist kein EU-Länderkürzel für die USt-IdNr. "
            "(Hinweis: Griechenland = EL).",
            status_code=422,
        )
    if not number.isalnum():
        raise BuchhaltungError(
            "USt-IdNr. darf nach dem Länderkürzel nur Buchstaben/Ziffern "
            "enthalten.",
            status_code=422,
        )
    try:
        resp = httpx.get(
            _VIES_URL.format(country=country, number=number), timeout=8.0
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise BuchhaltungError(
            "Der EU-Prüfdienst (VIES) ist gerade nicht erreichbar — "
            "bitte später erneut prüfen.",
            status_code=503,
        ) from exc
    name = (data.get("name") or "").strip()
    address = (data.get("address") or "").strip()
    return {
        "vatId": cleaned,
        "valid": bool(data.get("isValid")),
        # VIES liefert bei manchen Ländern "---" statt leer.
        "name": name if name and name != "---" else None,
        "address": address if address and address != "---" else None,
    }
