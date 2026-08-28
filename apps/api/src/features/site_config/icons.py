"""Symbole für den Baukasten: Suche und Übernahme über Iconify (0479).

Der Media Manager hat einen Reiter „Symbole" neben Bildern, Videos, Audio und
Dateien. Er liegt hier und nicht im Frontend, aus drei Gründen:

1. **Der Abruf ist ein ausgehender Aufruf.** Er gehört auf den Server, wo
   ``medien_holen`` ihn prüft, deckelt und auf die geprüfte IP pinnt — und wo
   ein eigener Rate-Limit-Eimer greift (Wurzel 8).
2. **Der Nachweis muss vom Anbieter kommen.** Ein Symbolsatz hat eine Lizenz
   (MIT, Apache, CC-BY …), und bei CC-BY ist die Nennung Pflicht. Käme sie aus
   dem Browser, wäre der „Nachweis" ein Feld, in das der Client schreibt
   (Wurzel 3). Deshalb holt die Übernahme die Satz-Metadaten FRISCH.
3. **Ein Symbol wird eine Zeile in ``site_media``.** Damit gelten Ordner,
   Verwendungsnachweis, Ersetzen und Bestandsgrenze auch für Symbole — ohne
   einen zweiten Bestand, der all das nicht kann.

**Warum Hotlink und kein Rehosting.** Ein Symbol ist ein SVG. Ein SVG in
unserem öffentlichen Bucket ist Stored-XSS (es darf ``<script>`` tragen, und
der Browser führt es als Dokument aus) — genau deshalb steht SVG seit 0422 nicht
in der Upload-Allowlist. Iconify liefert jedes Symbol unter einer stabilen
Adresse (``https://api.iconify.design/<satz>/<name>.svg``); die wandert in die
Zeile, die Datei bleibt dort. Dieselbe Bauart wie bei den Stock-Fotos, wo der
Anbieter es ausdrücklich verlangt.

**Was NICHT geprüft werden kann:** ob Iconify die Adresse in fünf Jahren noch
ausliefert. Das ist bei einem Hotlink immer so und bei den Stock-Fotos schon
akzeptiert; die Alternative wäre ein SVG-Sanitizer plus eigener privater Bucket
plus signierte URLs für ein 2-KB-Symbol.
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote, urlencode

from src.core.logging import get_logger

from .fehler import SiteConfigError
from .medien_holen import datei_holen
from .schemas_mediathek import IconSearchResponse, IconTreffer

log = get_logger("nextdays.site_config.icons")

#: Basis der Iconify-API. Öffentlich und ohne Schlüssel — es gibt hier also
#: nichts zu verstecken, aber trotzdem etwas zu deckeln (siehe unten).
API_BASIS = "https://api.iconify.design"

#: Deckel für die Antwortgröße der Suche. Eine Trefferseite ist wenige
#: Kilobyte; wer 50 MB schickt, ist ein Speicher-DoS (Wurzel 8).
MAX_ANTWORT_BYTES = 2 * 1024 * 1024

#: Deckel für ein einzelnes Symbol. Ein SVG-Symbol ist selten über 20 KB;
#: 512 KB lassen Luft für Sätze mit eingebetteten Pfaden und sind weit von
#: allem entfernt, was ein Angreifer damit anfangen könnte.
MAX_SYMBOL_BYTES = 512 * 1024

#: Höchstzahl Treffer je Suche. Iconify erlaubt mehr; 64 ist eine
#: Bildschirmfüllung und deckelt die Antwort (Wurzel 8).
MAX_TREFFER = 64


def _json_holen(pfad: str, zweck: str) -> dict[str, Any]:
    """Eine JSON-Antwort der Iconify-API holen.

    Über ``datei_holen`` und nicht mit einem eigenen ``httpx``-Aufruf: das ist
    dieselbe geprüfte, gepinnte, gedeckelte Verbindung, die auch der Bild-Import
    benutzt. Ein zweiter Download-Pfad im selben Slice wäre die Kopie, die man
    beim nächsten Sicherheitsfix vergisst.
    """
    roh = datei_holen(
        f"{API_BASIS}{pfad}", max_bytes=MAX_ANTWORT_BYTES, zweck=zweck
    )
    try:
        daten = json.loads(roh)
    except json.JSONDecodeError as exc:
        # Kein 500: die Gegenseite hat Unsinn geschickt, nicht wir. Und kein
        # stilles „nichts gefunden" — das sähe wie ein leerer Reiter aus.
        log.warning("iconify_antwort_kein_json", pfad=pfad)
        raise SiteConfigError(
            "Die Symbolbibliothek antwortet unerwartet.", status_code=502
        ) from exc
    if not isinstance(daten, dict):
        # Eine Liste oder eine Zahl statt eines Objekts: die Form stimmt nicht,
        # und `.get()` darauf wäre ein 500. Fremde Antworten werden geprüft,
        # nicht angenommen (Wurzel 5).
        log.warning("iconify_antwort_falsche_form", pfad=pfad)
        raise SiteConfigError(
            "Die Symbolbibliothek antwortet unerwartet.", status_code=502
        )
    return daten


def _nachweis(satz: dict[str, Any], praefix: str) -> tuple[str, str]:
    """Nachweis eines Symbolsatzes: (Anzeigename mit Lizenz, Adresse).

    Der Rückgabewert ist Pflicht, nicht Beigabe: die DB verlangt bei fremder
    Herkunft ``credit_name`` UND ``credit_url`` (Constraint
    ``site_media_herkunft_stimmig``, 0461), und bei CC-BY-Sätzen ist die Nennung
    Lizenzbedingung. Fehlt sie, wird NICHT übernommen (fail-closed, Wurzel 5) —
    ein Symbol, das die Lizenz bricht, sobald es auf einer Seite steht, ist kein
    halber Erfolg.

    ``https`` ist Bedingung, weil der CHECK-Constraint es verlangt. Eine
    ``http``-Adresse zurechtzubiegen wäre ein erfundener Wert (Wurzel 4).
    """
    name = str(satz.get("name") or praefix)
    lizenz = satz.get("license") or {}
    titel = str(lizenz.get("title") or lizenz.get("spdx") or "").strip()
    autor = satz.get("author") or {}
    adresse = str(lizenz.get("url") or autor.get("url") or "").strip()
    if not adresse.startswith("https://"):
        raise SiteConfigError(
            f"Für den Symbolsatz {name} liefert die Bibliothek keinen "
            "Lizenznachweis; er kann nicht übernommen werden.",
            status_code=502,
        )
    anzeige = f"{name} ({titel})" if titel else name
    return anzeige[:200], adresse


def svg_adresse(icon: str) -> str:
    """Die stabile SVG-Adresse eines Symbols (``ph:house`` → …/ph/house.svg).

    ``quote`` auf beiden Teilen: der Wert kommt aus der Anfrage, und ein
    ``../`` darin darf keinen anderen Pfad der API treffen.
    """
    praefix, name = zerlegen(icon)
    return f"{API_BASIS}/{quote(praefix)}/{quote(name)}.svg"


def zerlegen(icon: str) -> tuple[str, str]:
    """``satz:name`` in seine zwei Teile — oder 422.

    Iconify-Kennungen haben GENAU einen Doppelpunkt. Alles andere ist keine
    Kennung, und zu raten (etwa am ersten Doppelpunkt zu trennen) würde eine
    Adresse bauen, hinter der nichts liegt.
    """
    teile = icon.split(":")
    if len(teile) != 2 or not all(t.strip() for t in teile):
        raise SiteConfigError(
            "Symbol-Kennung erwartet in der Form satz:name.", status_code=422
        )
    return teile[0].strip(), teile[1].strip()


def suche(begriff: str, *, anzahl: int = 24) -> IconSearchResponse:
    """Symbolsuche über Iconify.

    Die Trefferliste trägt je Symbol schon den Nachweis mit. Das ist Absicht:
    die Oberfläche kann den Satz und seine Lizenz NEBEN dem Symbol zeigen, statt
    den Kunden erst nach der Übernahme zu informieren, unter welcher Lizenz er
    das Symbol gerade auf seine Website gelegt hat.
    """
    anzahl = max(1, min(anzahl, MAX_TREFFER))
    frage = urlencode({"query": begriff[:100], "limit": anzahl})
    daten = _json_holen(f"/search?{frage}", "Die Symbolsuche")
    saetze = daten.get("collections") or {}
    treffer: list[IconTreffer] = []
    for icon in (daten.get("icons") or [])[:anzahl]:
        try:
            praefix, _ = zerlegen(str(icon))
        except SiteConfigError:
            # Ein Treffer, den wir nicht zerlegen können, wird ÜBERSPRUNGEN und
            # nicht zum Fehler der ganzen Suche: die Liste kommt von außen.
            continue
        satz = saetze.get(praefix) or {}
        lizenz = satz.get("license") or {}
        treffer.append(
            IconTreffer(
                icon=str(icon),
                svg_url=svg_adresse(str(icon)),
                satz=str(satz.get("name") or praefix),
                lizenz=str(lizenz.get("title") or lizenz.get("spdx") or "") or None,
            )
        )
    return IconSearchResponse(
        items=treffer, total=int(daten.get("total") or len(treffer))
    )


def symbol_pruefen(icon: str) -> tuple[str, str, str]:
    """Ein Symbol vor der Übernahme prüfen: (SVG-Adresse, Nachweis, Adresse).

    Zwei Dinge werden hier wirklich geprüft, und beide sind nötig:

    * **Gibt es das Symbol?** Iconify antwortet auf eine unbekannte Kennung mit
      404, und ``datei_holen`` macht daraus einen 422. Ohne diese Prüfung läge
      eine Zeile in der Mediathek, deren Adresse nichts liefert — sichtbar erst
      als leeres Kästchen auf der veröffentlichten Seite.
    * **Ist es wirklich ein SVG?** Der ``Content-Type`` der Gegenseite ist eine
      Behauptung; das erste Zeichen nicht (Wurzel 8).

    Die Bytes werden danach WEGGEWORFEN — gespeichert wird der Hotlink. Der
    Abruf ist die Prüfung, nicht der Download.
    """
    adresse = svg_adresse(icon)
    inhalt = datei_holen(
        adresse, max_bytes=MAX_SYMBOL_BYTES, zweck="Das Symbol"
    )
    anfang = inhalt[:512].lstrip().lower()
    if not (anfang.startswith(b"<svg") or anfang.startswith(b"<?xml")):
        raise SiteConfigError(
            "Hinter dieser Symbol-Kennung liegt kein SVG.", status_code=422
        )
    praefix, _ = zerlegen(icon)
    daten = _json_holen(
        f"/collections?prefix={quote(praefix)}", "Die Symbolsatz-Angaben"
    )
    satz = daten.get(praefix)
    if not isinstance(satz, dict):
        raise SiteConfigError(
            "Diesen Symbolsatz kennt die Bibliothek nicht.", status_code=422
        )
    nachweis, nachweis_url = _nachweis(satz, praefix)
    return adresse, nachweis, nachweis_url
