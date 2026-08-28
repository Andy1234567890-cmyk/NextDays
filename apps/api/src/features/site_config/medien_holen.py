"""Eine Datei von einer FREMDEN Adresse holen — sicher, gedeckelt, gepinnt.

Es gibt im Baukasten zwei Stellen, die das brauchen: die Alt-Text-Erzeugung
(``ki_bild``) muss das Bild ans Modell schicken, und der Bild-Import per Adresse
(„Bilder importieren", 0479) muss die Datei in unseren Bucket legen. Beides ist
derselbe Vorgang mit demselben Angriffsvektor — deshalb steht er EINMAL hier.

Warum das wichtig ist, steht als Regel in ``core.ausgehende_url``: eine
Sicherheitsprüfung in zwei Fassungen wird in einer davon geflickt und bleibt in
der anderen offen. Genau das wäre passiert, hätte der Import sich den
Download-Block aus ``ki_bild`` kopiert.

Drei Riegel, und keiner ist verzichtbar:

1. **IP prüfen und PINNEN.** Jede aufgelöste Adresse muss öffentlich sein;
   verbunden wird mit genau der geprüften IP, nicht erneut über den Namen
   (DNS-Rebinding ist ein TOCTOU). Host-Header und SNI bleiben der echte Name,
   damit die Zertifikatsprüfung weiter greift.
2. **Keine Weiterleitungen.** Eine 302 auf ``http://169.254.169.254`` würde die
   ganze Prüfung aushebeln, weil der Client das neue Ziel selbst auflöst.
3. **Byte-Deckel WÄHREND des Lesens.** ``Content-Length`` ist eine Behauptung
   der Gegenseite; abgebrochen wird beim Lesen, nicht danach.

Was hier NICHT passiert: die Prüfung, WAS angekommen ist. Das entscheidet der
Aufrufer über die Signatur (``medien.bild_typ``/``medien.datei_typ``) — er
weiß, welche Arten er annehmen will, und nur er kann die Fehlermeldung dazu
formulieren.
"""

from __future__ import annotations

from urllib.parse import urlparse

import httpx

from src.core.ausgehende_url import (
    UnsichereUrl,
    host_header,
    host_pinnen,
    oeffentliche_ips,
)
from src.core.logging import get_logger

from .fehler import SiteConfigError

log = get_logger("nextdays.site_config.medien_holen")

#: Voreinstellung für den Verbindungs-/Leseabbruch. Kürzer als ein
#: Modellaufruf: was nach 15 Sekunden nicht anfängt zu kommen, kommt nicht.
STANDARD_TIMEOUT = 15.0


def datei_holen(
    url: str,
    *,
    max_bytes: int,
    timeout: float = STANDARD_TIMEOUT,
    zweck: str = "Datei",
) -> bytes:
    """Die Datei hinter ``url`` holen, oder mit ``SiteConfigError`` scheitern.

    ``zweck`` steht in den Fehlermeldungen („Das Bild …", „Die Datei …"). Er ist
    ein Parameter und keine feste Zeichenkette, weil die Meldung beim Kunden
    landet und „Datei" unter einem Bild-Import falsch klingt.

    Alle Fehler sind 422: die Adresse kommt vom Kunden, also ist es ein Fehler
    der Eingabe und nicht des Servers — und ein 5xx würde in der Überwachung als
    unser Ausfall zählen.
    """
    try:
        ips = oeffentliche_ips(url, nur_https=False)
    except UnsichereUrl as exc:
        # Der Grund wird geloggt, aber NICHT ausgeliefert: „zeigt auf 10.0.0.5"
        # wäre ein Netzwerk-Scanner für den Angreifer.
        log.warning("medien_holen_unsichere_url", grund=str(exc))
        raise SiteConfigError(
            "Diese Adresse lässt sich nicht sicher abrufen.",
            status_code=422,
        ) from exc

    zerlegt = urlparse(url)
    gepinnt = zerlegt._replace(netloc=host_pinnen(zerlegt.netloc, ips[0])).geturl()
    daten = bytearray()
    try:
        with httpx.Client(
            timeout=timeout, follow_redirects=False, verify=True
        ) as client:
            with client.stream(
                "GET",
                gepinnt,
                headers={"Host": host_header(url)},
                extensions={"sni_hostname": zerlegt.hostname},
            ) as antwort:
                if antwort.status_code >= 400:
                    raise SiteConfigError(
                        f"{zweck} ist nicht abrufbar ({antwort.status_code}).",
                        status_code=422,
                    )
                for stueck in antwort.iter_bytes():
                    daten.extend(stueck)
                    if len(daten) > max_bytes:
                        raise SiteConfigError(
                            f"{zweck} ist zu groß "
                            f"(über {max_bytes // (1024 * 1024)} MB).",
                            status_code=422,
                        )
    except httpx.HTTPError as exc:
        log.warning("medien_holen_fehler", grund=type(exc).__name__)
        raise SiteConfigError(
            f"{zweck} konnte nicht geladen werden.", status_code=422
        ) from exc

    if not daten:
        # Eine leere Antwort ist kein Erfolg. Ohne diese Zeile läge eine
        # 0-Byte-Datei im Bucket, und der `bytes > 0`-Check der DB würde erst
        # beim Insert zuschlagen — mit einer Waise im Bucket (Wurzel 1).
        raise SiteConfigError(f"{zweck} ist leer.", status_code=422)
    return bytes(daten)
