"""Stock-Foto-Suche über einen SERVERSEITIGEN Proxy (0461).

Warum ein Proxy und kein Aufruf aus dem Browser: der Zugriffsschlüssel beider
Anbieter ist ein Geheimnis, und alles, was der Browser sendet, kann jeder lesen,
der die Entwicklerkonsole öffnet. Ein Schlüssel im Frontend ist ein
veröffentlichter Schlüssel — und einer, der auf UNSER Kontingent geht, bis er
gesperrt wird (Wurzel 6/7). Er steht deshalb nur hier, in der Umgebung von
``apps/api``, und verlässt den Server nie.

Vorher gab es statt einer Suche die Datei ``web/lib/website-stock.ts``: 18 fest
verdrahtete Unsplash-Foto-Kennungen als Hotlink. Das ist keine Suche, sondern
eine Liste — und ihr Dateikommentar behauptete, sie spiegele
``builder/lib/stock-images.ts``, eine Datei, die es nie gab.

============================================================================
DIE ANBIETER
============================================================================

**Pexels** — keine Attributionspflicht, Kontingent 200 Anfragen je Stunde und
20 000 je Monat. Beides zählt Pexels selbst und meldet den Stand in den
Antwort-Kopfzeilen (``X-Ratelimit-Remaining``). Genau die werden hier gelesen,
statt einen eigenen Zähler zu führen: unser Zähler wüsste nichts von Aufrufen
aus einer zweiten Instanz, nichts von einem Neustart und nichts vom Monatsschnitt
des Anbieters. Er wäre eine PLAUSIBLE Zahl neben der echten — dieselbe Klasse
Fehler wie eine eigene Uhr für ein fremdes Ereignis (Wurzel 5b). Ist das
Kontingent erschöpft, gibt es einen 429 mit ``Retry-After``, keine stille leere
Trefferliste.

**Unsplash** — Attribution ist VERTRAGSPFLICHT, nicht Höflichkeit. Bei jeder
Anzeige „Photo by <Name> on Unsplash", beide Teile verlinkt und mit
utm-Parametern. Dazu zwei weitere Pflichten, die man leicht übersieht:

* Bei der ÜBERNAHME eines Bildes muss ein ``GET`` auf
  ``photo.links.download_location`` abgesetzt werden. Das ist kein Download —
  es ist der Zähler, aus dem der Fotograf seine Statistik bekommt. Wer ihn
  auslässt, benutzt die API vertragswidrig.
* Die Bilder werden per HOTLINK aus ``photo.urls`` eingebunden, nicht auf
  unseren Bucket kopiert.

**Shutterstock — bewusst NICHT scharf geschaltet.** Der Anbieter steht unten in
``ANBIETER`` als vorbereiteter, deaktivierter Eintrag. Grund: er verlangt ein
bezahltes Abo UND eine Erweiterung unserer AGB. Die „API Platform License"
macht UNS für Verstöße unserer Kunden haftbar — jedes Bild, das ein Betrieb
lizenzwidrig verwendet, fällt auf unseren Vertrag zurück. Das ist keine
technische, sondern eine geschäftliche Entscheidung; sie gehört dem Nutzer, und
solange sie nicht getroffen ist, wäre ein funktionierender Knopf eine Zusage,
die niemand gegeben hat.

============================================================================
WAS DEM CLIENT NICHT GEGLAUBT WIRD
============================================================================
Beim Übernehmen schickt der Browser NUR Anbieter und Foto-Kennung. Alles andere
— Bildadresse, Fotografenname, Profil-Adresse — holt der Server frisch beim
Anbieter (Wurzel 3). Käme es aus der Anfrage, könnte jeder eine beliebige
Adresse in die Mediathek und damit in die Website schreiben, und der
„Bildnachweis" wäre ein Feld, in das der Angreifer schreibt.

Zusätzlich wird jede übernommene Adresse gegen die bekannten Bild-Hosts des
Anbieters geprüft. Ein Anbieter, dessen Antwort auf einen fremden Host zeigt,
ist entweder kompromittiert oder nicht der, für den wir ihn halten — in beiden
Fällen ist Ablehnen richtig (fail-closed, Wurzel 5).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

from .fehler import SiteConfigError
from .schemas_mediathek import (
    StockAnbieter,
    StockFoto,
    StockProviderInfo,
    StockProviderListResponse,
    StockSearchResponse,
)

log = get_logger("nextdays.site_config.stock")

#: Zeitgrenze je Anbieteraufruf. Kurz, weil der Kunde davor sitzt und tippt: ein
#: Anbieter, der 20 s braucht, ist für eine Bildsuche ausgefallen, nicht langsam.
_TIMEOUT = httpx.Timeout(8.0, connect=4.0)

#: Deckel für die Antwortgröße. Eine Trefferseite ist wenige Dutzend Kilobyte;
#: ein Anbieter, der 50 MB schickt, ist ein Speicher-DoS (Wurzel 8).
_MAX_ANTWORT_BYTES = 2 * 1024 * 1024

#: utm-Kennung in den Attributionslinks. MUSS dem bei Unsplash registrierten
#: Anwendungsnamen entsprechen — ein abweichender Wert macht die Attribution
#: formal falsch, obwohl sie richtig aussieht.
_UTM = "utm_source=mynextdays&utm_medium=referral"

#: Höchstzahl Treffer je Seite. Der Anbieter erlaubt mehr; 30 ist eine
#: Bildschirmfüllung und deckelt die Antwortgröße (Wurzel 8).
MAX_TREFFER = 30


@dataclass(frozen=True)
class _AnbieterProfil:
    """Alles, was einen Anbieter ausmacht — an EINER Stelle.

    Als Datensatz und nicht als if/elif-Kette: ein dritter Anbieter ist damit
    ein Eintrag, keine dritte Verzweigung in fünf Funktionen."""

    kennung: StockAnbieter
    anzeigename: str
    api_basis: str
    such_pfad: str
    #: Erlaubte Hosts der Bildadressen. Alles andere wird abgelehnt.
    bild_hosts: tuple[str, ...]
    #: Adresse des Anbieters für den zweiten Attributionslink.
    startseite: str
    #: Muss der Fotograf genannt werden? Bei Unsplash Vertragspflicht.
    attribution_pflicht: bool
    #: Kostet ein Bild dieses Anbieters Geld? Trennt im Media Manager die
    #: Abschnitte „KOSTENLOSE BILDER" und „PREMIUM-BILDER". Als Eigenschaft des
    #: Anbieters und nicht als zweite Liste in der Oberfläche: sonst stünde die
    #: Zuordnung an zwei Stellen, und eine davon wäre falsch, sobald ein
    #: Anbieter sein Modell ändert.
    bezahlt: bool = False
    #: Deaktivierte Anbieter erscheinen NIRGENDS in der Oberfläche.
    aktiv: bool = True
    #: Warum ein Anbieter deaktiviert ist — für Log und Doku, nie für den Kunden.
    deaktiviert_grund: str = ""
    kopfzeilen_praefix: str = ""


ANBIETER: dict[str, _AnbieterProfil] = {
    "pexels": _AnbieterProfil(
        kennung=StockAnbieter.pexels,
        anzeigename="Pexels",
        api_basis="https://api.pexels.com/v1",
        such_pfad="/search",
        bild_hosts=("images.pexels.com",),
        startseite="https://www.pexels.com",
        attribution_pflicht=False,
    ),
    "unsplash": _AnbieterProfil(
        kennung=StockAnbieter.unsplash,
        anzeigename="Unsplash",
        api_basis="https://api.unsplash.com",
        such_pfad="/search/photos",
        bild_hosts=("images.unsplash.com",),
        startseite="https://unsplash.com",
        attribution_pflicht=True,
        kopfzeilen_praefix="Client-ID ",
    ),
    # VORBEREITET, ABER AUS. Siehe Modul-Docstring: bezahltes Abo plus
    # AGB-Erweiterung (API Platform License — wir haften für Kundenverstöße).
    # Der Eintrag steht hier, damit die Entscheidung sichtbar ist und nicht als
    # vergessene Lücke erscheint. Scharfschalten heißt: `aktiv=True`, einen
    # Schlüssel setzen, den Wert `shutterstock` in den CHECK-Constraint von
    # `site_media.source` aufnehmen (eigene Migration) — und vorher die AGB.
    "shutterstock": _AnbieterProfil(
        kennung=StockAnbieter.shutterstock,
        anzeigename="Shutterstock",
        api_basis="https://api.shutterstock.com/v2",
        such_pfad="/images/search",
        bild_hosts=("image.shutterstock.com",),
        startseite="https://www.shutterstock.com",
        attribution_pflicht=False,
        bezahlt=True,
        aktiv=False,
        deaktiviert_grund=(
            "Braucht ein bezahltes Abo und eine AGB-Erweiterung (API Platform "
            "License): wir haften für Lizenzverstöße unserer Kunden."
        ),
    ),
}


#: Die BEZAHLTEN Anbieter, die wirklich scharf sind. Heute leer — Shutterstock
#: ist vorbereitet und aus. Abgeleitet und nicht aufgeschrieben: die Zahl
#: „GEKAUFT (0)" in der Mediathek zählt genau über diese Liste, und am Tag der
#: Freischaltung soll niemand daran denken müssen (Wurzel 4).
BEZAHLTE_ANBIETER: tuple[str, ...] = tuple(
    k for k, p in ANBIETER.items() if p.bezahlt and p.aktiv
)


def _schluessel(kennung: str) -> str:
    """Der Zugriffsschlüssel des Anbieters aus der Umgebung, oder ``""``.

    Leer heißt NICHT „nimm einen Ersatzwert", sondern „diesen Anbieter gibt es
    hier nicht" (Wurzel 4). Die Oberfläche bekommt ihn dann gar nicht erst
    angeboten, statt eine Suche zu zeigen, die immer scheitert."""
    s = get_settings()
    if kennung == "pexels":
        return s.pexels_api_key.get_secret_value().strip()
    if kennung == "unsplash":
        return s.unsplash_access_key.get_secret_value().strip()
    return ""


def verfuegbare_anbieter() -> list[_AnbieterProfil]:
    """Anbieter, die aktiv sind UND einen Schlüssel haben."""
    return [p for k, p in ANBIETER.items() if p.aktiv and _schluessel(k)]


def _profil(kennung: str) -> _AnbieterProfil:
    profil = ANBIETER.get(kennung)
    if profil is None or not profil.aktiv:
        # 404 und nicht 400: dieser Anbieter existiert hier schlicht nicht.
        raise SiteConfigError("Unbekannter Bildanbieter.", status_code=404)
    if not _schluessel(kennung):
        raise SiteConfigError(
            f"{profil.anzeigename} ist auf diesem Server nicht eingerichtet.",
            status_code=503,
        )
    return profil


def _kopfzeilen(profil: _AnbieterProfil) -> dict[str, str]:
    return {
        "Authorization": f"{profil.kopfzeilen_praefix}{_schluessel(profil.kennung)}",
        "Accept": "application/json",
    }


def _hole(profil: _AnbieterProfil, pfad: str, params: dict | None = None) -> dict:
    """Einen Anbieteraufruf machen und die Kontingent-Kopfzeilen auswerten.

    Der Ziel-Host ist FEST (``profil.api_basis``) und stammt nicht aus einer
    Nutzereingabe. Deshalb ist hier KEINE SSRF-Prüfung nötig — die aus
    ``core.ausgehende_url`` gehört an Adressen, die der Kunde eintippt (iCal,
    Webhooks). Sie hier zu wiederholen wäre eine Prüfung ohne Angriffsfläche
    und würde vortäuschen, die Adresse sei veränderlich."""
    url = f"{profil.api_basis}{pfad}"
    try:
        with httpx.Client(timeout=_TIMEOUT, follow_redirects=False) as client:
            antwort = client.get(url, headers=_kopfzeilen(profil), params=params)
    except httpx.HTTPError as exc:
        log.warning("stock_abruf_fehler", anbieter=profil.kennung, error=str(exc))
        raise SiteConfigError(
            f"{profil.anzeigename} ist gerade nicht erreichbar.", status_code=502
        ) from exc

    _kontingent_pruefen(profil, antwort)

    if antwort.status_code == 401:
        # Der Schlüssel ist da, aber falsch. Das ist ein Betriebsfehler bei uns
        # und keiner des Kunden — deshalb 503 und ein LAUTES Log, kein 401
        # weitergereicht (das läse sich für den Kunden wie „du bist nicht
        # angemeldet").
        log.error("stock_schluessel_abgelehnt", anbieter=profil.kennung)
        raise SiteConfigError(
            f"{profil.anzeigename} ist auf diesem Server nicht eingerichtet.",
            status_code=503,
        )
    if antwort.status_code == 404:
        raise SiteConfigError("Dieses Foto gibt es nicht mehr.", status_code=404)
    if antwort.status_code >= 400:
        log.warning(
            "stock_fehlerantwort",
            anbieter=profil.kennung,
            status=antwort.status_code,
        )
        raise SiteConfigError(
            f"{profil.anzeigename} hat die Anfrage abgelehnt.", status_code=502
        )
    if len(antwort.content) > _MAX_ANTWORT_BYTES:
        raise SiteConfigError("Antwort des Bildanbieters zu groß.", status_code=502)
    try:
        daten = antwort.json()
    except ValueError as exc:
        raise SiteConfigError(
            f"{profil.anzeigename} hat unlesbar geantwortet.", status_code=502
        ) from exc
    if not isinstance(daten, dict):
        raise SiteConfigError(
            f"{profil.anzeigename} hat unlesbar geantwortet.", status_code=502
        )
    return daten


def _kontingent_pruefen(profil: _AnbieterProfil, antwort: httpx.Response) -> None:
    """Kontingent aus den Kopfzeilen des ANBIETERS lesen (siehe Modul-Docstring).

    Zwei Fälle enden mit 429, und beide sind eine ehrliche Aussage statt einer
    leeren Trefferliste:
      * der Anbieter hat selbst mit 429 geantwortet,
      * er meldet ``X-Ratelimit-Remaining: 0``, der nächste Aufruf würde also
        scheitern."""
    rest = antwort.headers.get("x-ratelimit-remaining")
    if rest is not None:
        try:
            uebrig = int(rest)
        except ValueError:
            uebrig = -1
        if 0 <= uebrig <= 2:
            log.warning(
                "stock_kontingent_knapp", anbieter=profil.kennung, rest=uebrig
            )
    if antwort.status_code != 429 and rest not in ("0",):
        return
    reset = antwort.headers.get("retry-after") or antwort.headers.get(
        "x-ratelimit-reset"
    )
    log.warning("stock_kontingent_erschoepft", anbieter=profil.kennung, reset=reset)
    raise SiteConfigError(
        f"Das Kontingent bei {profil.anzeigename} ist für den Moment "
        "aufgebraucht. Bitte später erneut suchen.",
        status_code=429,
    )


def _bildadresse_pruefen(profil: _AnbieterProfil, url: str) -> str:
    """Nur https und nur die bekannten Bild-Hosts des Anbieters (fail-closed)."""
    if not url.startswith("https://"):
        raise SiteConfigError("Bildadresse des Anbieters ist ungültig.", status_code=502)
    host = url.split("/", 3)[2].split("@")[-1].split(":")[0].lower()
    if host not in profil.bild_hosts:
        log.error("stock_fremder_bildhost", anbieter=profil.kennung, host=host)
        raise SiteConfigError("Bildadresse des Anbieters ist ungültig.", status_code=502)
    return url


# === Umformen: Anbieterantwort → unsere Form ================================

def _pexels_foto(profil: _AnbieterProfil, roh: dict) -> StockFoto:
    src = roh.get("src") or {}
    return StockFoto(
        provider=profil.kennung,
        external_id=str(roh.get("id") or ""),
        thumb_url=_bildadresse_pruefen(profil, str(src.get("medium") or "")),
        full_url=_bildadresse_pruefen(profil, str(src.get("large2x") or "")),
        width=int(roh.get("width") or 0) or None,
        height=int(roh.get("height") or 0) or None,
        alt_text=(str(roh.get("alt") or "").strip() or None),
        credit_name=str(roh.get("photographer") or "").strip(),
        credit_url=_mit_utm(str(roh.get("photographer_url") or "")),
        provider_name=profil.anzeigename,
        provider_url=_mit_utm(profil.startseite),
        attribution_required=profil.attribution_pflicht,
    )


def _unsplash_foto(profil: _AnbieterProfil, roh: dict) -> StockFoto:
    urls = roh.get("urls") or {}
    user = roh.get("user") or {}
    profil_url = ((user.get("links") or {}).get("html")) or ""
    return StockFoto(
        provider=profil.kennung,
        external_id=str(roh.get("id") or ""),
        thumb_url=_bildadresse_pruefen(profil, str(urls.get("small") or "")),
        full_url=_bildadresse_pruefen(profil, str(urls.get("regular") or "")),
        width=int(roh.get("width") or 0) or None,
        height=int(roh.get("height") or 0) or None,
        # Unsplash liefert eine Bildbeschreibung — genau das, was ein Alt-Text
        # ist. Sie zu übernehmen ist besser, als den Kunden ein leeres Feld
        # ausfüllen zu lassen, das er leer lässt.
        alt_text=(
            str(roh.get("alt_description") or roh.get("description") or "").strip()
            or None
        ),
        credit_name=str(user.get("name") or "").strip(),
        credit_url=_mit_utm(str(profil_url)),
        provider_name=profil.anzeigename,
        provider_url=_mit_utm(profil.startseite),
        attribution_required=profil.attribution_pflicht,
    )


def _mit_utm(url: str) -> str:
    """utm-Parameter anhängen, wie Unsplash es vorschreibt. Leer bleibt leer —
    ein Link auf ``?utm_source=…`` ohne Adresse wäre ein toter Link."""
    if not url.startswith("https://"):
        return ""
    trenner = "&" if "?" in url else "?"
    return f"{url}{trenner}{_UTM}"


def startseite_mit_utm(anbieter: str) -> str:
    """Der zweite Attributionslink („… on Unsplash"), inkl. utm-Parameter.

    Aus dem Anbieterprofil und nicht aus der DB: er ist für alle Fotos desselben
    Anbieters gleich, und ihn je Zeile zu speichern wäre dieselbe Adresse
    hundertmal — hundertmal veraltbar."""
    profil = ANBIETER.get(anbieter)
    return _mit_utm(profil.startseite) if profil else ""


_UMFORMER = {"pexels": _pexels_foto, "unsplash": _unsplash_foto}


# === Öffentliche Funktionen ================================================

def anbieter_liste() -> StockProviderListResponse:
    """Was die Oberfläche anbieten darf.

    Ein Anbieter ohne Schlüssel taucht NICHT auf. Eine Suchmaske zu zeigen, die
    verlässlich in einen Fehler läuft, ist schlechter als sie wegzulassen."""
    return StockProviderListResponse(
        items=[
            StockProviderInfo(
                id=p.kennung,
                name=p.anzeigename,
                attribution_required=p.attribution_pflicht,
                homepage=_mit_utm(p.startseite),
                bezahlt=p.bezahlt,
            )
            for p in verfuegbare_anbieter()
        ]
    )


def suche(anbieter: str, begriff: str, *, seite: int, anzahl: int) -> StockSearchResponse:
    """Trefferliste eines Anbieters."""
    profil = _profil(anbieter)
    anzahl = max(1, min(anzahl, MAX_TREFFER))
    seite = max(1, min(seite, 50))
    params: dict[str, Any] = {"query": begriff, "page": seite, "per_page": anzahl}
    daten = _hole(profil, profil.such_pfad, params)
    roh_liste = daten.get("photos") if anbieter == "pexels" else (
        daten.get("results")
    )
    umformer = _UMFORMER[anbieter]
    fotos: list[StockFoto] = []
    for eintrag in (roh_liste or [])[:anzahl]:
        if not isinstance(eintrag, dict):
            continue
        try:
            fotos.append(umformer(profil, eintrag))
        except SiteConfigError:
            # Ein einzelner Treffer mit unbrauchbarer Adresse darf die ganze
            # Suche nicht kippen — er wird ausgelassen und geloggt.
            log.warning("stock_treffer_verworfen", anbieter=anbieter)
    return StockSearchResponse(
        provider=profil.kennung,
        items=fotos,
        page=seite,
        has_more=len(fotos) >= anzahl,
    )


def foto_holen(anbieter: str, external_id: str) -> tuple[StockFoto, str | None]:
    """EIN Foto frisch beim Anbieter holen — die Quelle für die Übernahme.

    Zweiter Rückgabewert ist Unsplashs ``links.download_location``: die Adresse,
    die bei einer Übernahme angepingt werden MUSS (Vertragspflicht). ``None``
    bei Anbietern ohne diese Pflicht."""
    profil = _profil(anbieter)
    kennung = external_id.strip()
    if not kennung or len(kennung) > 120 or "/" in kennung:
        raise SiteConfigError("Ungültige Foto-Kennung.", status_code=422)
    pfad = f"/photos/{kennung}"
    daten = _hole(profil, pfad)
    foto = _UMFORMER[anbieter](profil, daten)
    ziel = None
    if anbieter == "unsplash":
        ziel = str((daten.get("links") or {}).get("download_location") or "") or None
    return foto, ziel


def download_melden(anbieter: str, ziel: str | None) -> None:
    """Unsplashs Download-Zähler auslösen (Vertragspflicht bei Übernahme).

    Best-effort: schlägt der Ping fehl, ist das ein Fehler in der STATISTIK des
    Fotografen — die Übernahme selbst ist erfolgt und darf daran nicht
    scheitern. Er wird aber LAUT geloggt, nicht verschluckt: eine Pflicht, die
    reihenweise ausfällt, muss sichtbar sein (Wurzel 5)."""
    if not ziel:
        return
    profil = ANBIETER.get(anbieter)
    if profil is None or not ziel.startswith(f"{profil.api_basis}/"):
        # Die Adresse kommt aus der Anbieterantwort; zeigt sie woandershin,
        # wird sie nicht abgerufen (fail-closed).
        log.error("stock_download_ziel_fremd", anbieter=anbieter)
        return
    try:
        with httpx.Client(timeout=_TIMEOUT, follow_redirects=False) as client:
            antwort = client.get(ziel, headers=_kopfzeilen(profil))
        if antwort.status_code >= 400:
            log.error(
                "stock_download_meldung_abgelehnt",
                anbieter=anbieter,
                status=antwort.status_code,
            )
    except httpx.HTTPError as exc:  # noqa: BLE001 — Hauptpfad darf nicht kippen
        log.error("stock_download_meldung_fehler", anbieter=anbieter, error=str(exc))
