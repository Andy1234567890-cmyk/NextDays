"""Social-Media-Kanäle eines Partners — die Liste der Plattformen und die
Erkennung aus einer Adresse.

Die Plattformliste steht an DREI Stellen (hier, `partner/lib/kanaele.ts`,
`admin/lib/kanaele.ts`); `scripts/i18n/kanal-plattformen-pruefen.mjs` hält sie
deckungsgleich. Ein neuer Wert ohne die anderen beiden ist im Dashboard ein
Kanal ohne Logo.
"""

from __future__ import annotations

from typing import Literal
from urllib.parse import urlsplit

Plattform = Literal[
    "instagram",
    "tiktok",
    "youtube",
    "facebook",
    "x",
    "linkedin",
    "pinterest",
    "threads",
    "twitch",
    "snapchat",
    "telegram",
    "whatsapp",
    "website",
    "blog",
    "newsletter",
    "podcast",
    "other",
]

PLATTFORMEN: tuple[str, ...] = Plattform.__args__  # type: ignore[attr-defined]

# Echte Social-Media-Netzwerke — mindestens eines davon ist in der Bewerbung
# Pflicht (Anweisung 02.09.2026: „jeder Bewerber muss seine Social-Media-
# Accounts angeben"). Website/Blog/Newsletter/Podcast zählen zusätzlich, nicht
# stattdessen.
SOCIAL_PLATTFORMEN: frozenset[str] = frozenset(
    {
        "instagram",
        "tiktok",
        "youtube",
        "facebook",
        "x",
        "linkedin",
        "pinterest",
        "threads",
        "twitch",
        "snapchat",
        "telegram",
        "whatsapp",
    }
)

# Domain → Plattform. Subdomains zählen mit (www., m., vm.tiktok.com …).
_DOMAINS: dict[str, str] = {
    "instagram.com": "instagram",
    "instagr.am": "instagram",
    "tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "facebook.com": "facebook",
    "fb.com": "facebook",
    "fb.me": "facebook",
    "x.com": "x",
    "twitter.com": "x",
    "linkedin.com": "linkedin",
    "lnkd.in": "linkedin",
    "pinterest.com": "pinterest",
    "pinterest.de": "pinterest",
    "pinterest.dk": "pinterest",
    "pin.it": "pinterest",
    "threads.net": "threads",
    "threads.com": "threads",
    "twitch.tv": "twitch",
    "snapchat.com": "snapchat",
    "t.me": "telegram",
    "telegram.me": "telegram",
    "whatsapp.com": "whatsapp",
    "wa.me": "whatsapp",
}


def plattform_aus_url(url: str) -> str | None:
    """Erkennt die Plattform am Host; None, wenn kein bekanntes Netzwerk."""
    host = (urlsplit(url.strip()).hostname or "").lower()
    while host:
        if host in _DOMAINS:
            return _DOMAINS[host]
        if "." not in host:
            break
        host = host.split(".", 1)[1]
    return None


def kanaele_aus_zeile(row: dict[str, object], modell: type) -> list:
    """Kanäle aus einer affiliates-Zeile als Pydantic-Objekte; kaputte Einträge
    (Altbestand, Handpflege) werden übersprungen statt das ganze Profil zu
    kippen — geloggt, nicht verschluckt (Wurzel 5). `modell` = SocialKanal
    (Parameter statt Import, damit kanaele.py schemafrei bleibt)."""
    from src.core.logging import get_logger  # noqa: PLC0415

    log = get_logger(__name__)
    aus = []
    for eintrag in row.get("channels") or []:  # type: ignore[union-attr]
        try:
            aus.append(modell.model_validate(eintrag))
        except ValueError:  # noqa: PERF203
            log.warning("partner_kanal_unlesbar", affiliate_id=row.get("id"), eintrag=eintrag)
    return aus
