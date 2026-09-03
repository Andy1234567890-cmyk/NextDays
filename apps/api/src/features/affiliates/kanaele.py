"""Social-Media-Kanäle eines Partners — die Plattformliste, die Erkennung aus
einer Adresse und der Bau einer Profil-Adresse aus dem Handle.

Die Plattformliste steht an VIER Stellen (hier, `partner/lib/kanaele.ts`,
`admin/lib/kanaele.ts`, `marketing/lib/kanaele.ts`);
`scripts/i18n/kanal-plattformen-pruefen.mjs` hält sie deckungsgleich. Ein neuer
Wert ohne die anderen ist im Dashboard ein Kanal ohne Logo.

WARUM DER HANDLE FÜHRT (03.09.2026)
===================================
Die Bewerbung verlangte bis dahin die vollständige Profil-ADRESSE. Das war für
die meisten Bewerber die falsche Frage: sie kennen ihren Benutzernamen
(`@pia.reist`), nicht die URL — die steht in keiner App sichtbar, sie muss über
„Profil teilen → Link kopieren" geholt werden. Wer sie nicht findet, tippt
etwas Falsches oder bricht ab.

Seitdem ist bei den echten Netzwerken der HANDLE das Pflichtfeld, und die
Adresse baut der Server daraus (`_PROFIL_MUSTER`). Wer doch eine Adresse
angibt, behält sie; der Handle wird dann daraus gelesen (`handle_aus_url`).
Generische Kanäle (Website, Blog, Newsletter, Podcast, Sonstiges) haben keinen
Handle — dort bleibt die Adresse Pflicht.
"""

from __future__ import annotations

import re
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


# Profil-Adresse je Plattform aus dem Handle. `{h}` = Handle ohne führendes @.
# Die Muster sind die kanonischen Profilpfade der Netzwerke (03.09.2026 geprüft);
# ein Netzwerk ohne Eintrag hier ist ein Kanal, bei dem der Handle NICHT
# ausreicht — dort bleibt die Adresse Pflicht.
_PROFIL_MUSTER: dict[str, str] = {
    "instagram": "https://www.instagram.com/{h}",
    "tiktok": "https://www.tiktok.com/@{h}",
    "youtube": "https://www.youtube.com/@{h}",
    "facebook": "https://www.facebook.com/{h}",
    "x": "https://x.com/{h}",
    "linkedin": "https://www.linkedin.com/in/{h}",
    "pinterest": "https://www.pinterest.com/{h}",
    "threads": "https://www.threads.net/@{h}",
    "twitch": "https://www.twitch.tv/{h}",
    "snapchat": "https://www.snapchat.com/add/{h}",
    "telegram": "https://t.me/{h}",
}

# Plattformen, bei denen der Handle allein genügt (die Adresse entsteht daraus).
HANDLE_PLATTFORMEN: frozenset[str] = frozenset(_PROFIL_MUSTER)

# Erlaubte Zeichen eines Handles. Absichtlich eng: der Wert landet in einer URL
# (Wurzel 8) und im Backoffice als Link. Punkt/Unterstrich/Bindestrich deckt
# Instagram, TikTok, X, YouTube, Telegram und Snapchat ab.
_HANDLE_ERLAUBT = re.compile(r"^[A-Za-z0-9._-]{1,100}$")

# Pfadsegmente, die KEIN Handle sind — Instagram/Facebook/LinkedIn hängen
# Profile unter solche Präfixe. Steht so ein Segment vorn, ist das nächste der
# Handle (`linkedin.com/in/pia`, `facebook.com/profile.php` ausgenommen).
_KEIN_HANDLE = frozenset({"in", "add", "channel", "c", "user", "p", "pin", "profile.php"})


def handle_bereinigen(handle: str | None) -> str | None:
    """Handle normalisieren: @ und umgebende Leerzeichen weg, sonst unverändert.

    Gibt None zurück, wenn nach dem Kürzen nichts übrig ist. Wirft
    ValueError bei unerlaubten Zeichen — der Wert wird zu einer URL, also darf
    hier nichts durchrutschen (Wurzel 8).
    """
    wert = (handle or "").strip().lstrip("@").strip()
    if not wert:
        return None
    if not _HANDLE_ERLAUBT.match(wert):
        raise ValueError(
            "Der Benutzername darf nur Buchstaben, Zahlen, Punkt, "
            "Unterstrich und Bindestrich enthalten."
        )
    return wert


def profil_url(plattform: str, handle: str) -> str | None:
    """Profil-Adresse aus Plattform + Handle; None, wenn die Plattform keine hat."""
    muster = _PROFIL_MUSTER.get(plattform)
    if muster is None:
        return None
    from urllib.parse import quote  # noqa: PLC0415

    return muster.format(h=quote(handle, safe="._-"))


def handle_aus_url(url: str) -> str | None:
    """Handle aus einer Profil-Adresse lesen; None, wenn keiner erkennbar ist.

    Nimmt das erste Pfadsegment, das kein bekanntes Präfix ist (`/in/`, `/@`,
    `/channel/` …). Query und Fragment bleiben außen vor.
    """
    pfad = urlsplit(url.strip()).path
    for teil in pfad.split("/"):
        stueck = teil.strip().lstrip("@")
        if not stueck or stueck.lower() in _KEIN_HANDLE:
            continue
        try:
            return handle_bereinigen(stueck)
        except ValueError:
            return None
    return None
