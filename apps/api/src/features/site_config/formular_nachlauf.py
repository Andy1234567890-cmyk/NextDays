"""Was NACH einer Formular-Einsendung passiert (0444).

Drei Wege, und alle drei sind BEST-EFFORT: die Einsendung ist an dieser Stelle
gespeichert. Kippt der Nachlauf, darf das den Gast nicht treffen — er hat sein
Formular abgeschickt, und dass unsere Bestaetigungsmail nicht durchkam, ist
unser Problem, nicht seins (Wurzel 5: der Nebenpfad kippt den Hauptpfad nie).

  1. **Bestaetigung an den Absender.** Standardmaessig an. Ein Gast, der
     abschickt und nichts hoert, schickt noch einmal — oder ruft an.
  2. **Meldung an den Betrieb.** Die gab es schon; sie steht hier mit den
     anderen beiden, damit man alle drei an einer Stelle sieht.
  3. **Webhook.** Ein POST je Einsendung an eine Adresse des KUNDEN — also eine
     nutzergelieferte URL, und damit ein SSRF-Vektor (Wurzel 8). Der Versand
     laeuft ueber `core.ausgehende_url`: IP aufloesen, pruefen, auf die
     GEPRUEFTE IP pinnen, interne Netze und CGNAT blocken.
"""

from __future__ import annotations

import json
from urllib.parse import urlparse

import httpx

from src.core.ausgehende_url import (
    host_header,
    host_pinnen,
    oeffentliche_ips,
)
from src.core.logging import get_logger

log = get_logger("nextdays.site_config.formular_nachlauf")

#: Wie lange ein Webhook hoechstens dauern darf. Kurz, weil der Aufruf im
#: Anfrage-Pfad des GASTES liegt: er wartet auf seine Bestaetigung, waehrend
#: wir einen fremden Server anrufen.
WEBHOOK_TIMEOUT = 5.0

#: Hoechstgroesse der Nutzlast. Eine Einsendung ist gedeckelt (64 KB, 0436) —
#: der Deckel hier ist der zweite Riegel fuer den Fall, dass sich das aendert.
MAX_NUTZLAST = 64 * 1024


def webhook_senden(url: str, nutzlast: dict) -> bool:
    """Eine Einsendung an die Adresse des Kunden schicken.

    Gibt zurueck, OB es geklappt hat — der Aufrufer schreibt es ins Protokoll.
    Wirft nie: ein fremder Server, der nicht antwortet, darf die Antwort an den
    Gast nicht aufhalten.

    Kein Wiederholungsversuch. Das ist eine Entscheidung, keine Auslassung: ein
    Wiederholen im Anfrage-Pfad laesst den Gast doppelt so lange warten, und ein
    Wiederholen im Hintergrund braucht eine Warteschlange mit Zustand. Wer
    Zustellgarantie braucht, liest die Antwortenliste — sie ist die Wahrheit,
    der Webhook ist die Bequemlichkeit.
    """
    try:
        koerper = json.dumps(nutzlast, ensure_ascii=False).encode()
        if len(koerper) > MAX_NUTZLAST:
            log.warning("webhook_nutzlast_zu_gross", groesse=len(koerper))
            return False

        # IP pruefen und PINNEN. Ohne das Pinnen loeste der HTTP-Client den
        # Namen neu auf — und ein Angreifer koennte zwischen Pruefung und
        # Aufruf auf eine interne Adresse umstellen (DNS-Rebinding).
        ips = oeffentliche_ips(url, nur_https=False)
        if not ips:
            log.warning("webhook_ziel_nicht_oeffentlich", url=url[:120])
            return False
        zerlegt = urlparse(url)
        gepinnt = zerlegt._replace(
            netloc=host_pinnen(zerlegt.netloc, ips[0])
        ).geturl()
        # Verbunden wird zur geprueften IP, aber Host-Header UND SNI tragen den
        # echten Namen — sonst schluege die Zertifikatspruefung fehl, und der
        # Kunde saehe einen Fehler, der nach seinem Server aussieht.
        with httpx.Client(
            timeout=WEBHOOK_TIMEOUT, follow_redirects=False
        ) as client:
            anfrage = client.build_request(
                "POST",
                gepinnt,
                content=koerper,
                headers={
                    "Content-Type": "application/json",
                    "Host": host_header(url),
                    "User-Agent": "myNextDays-Formular/1",
                },
                extensions={"sni_hostname": zerlegt.hostname or ""},
            )
            antwort = client.send(anfrage)
        # Weiterleitungen werden NICHT gefolgt: ein 302 auf `127.0.0.1` waere
        # der einfachste Weg, das Pinnen zu umgehen.
        ok = 200 <= antwort.status_code < 300
        if not ok:
            log.info("webhook_abgelehnt", status=antwort.status_code)
        return ok
    except Exception as exc:  # noqa: BLE001 — der Nebenpfad kippt nie den Gast
        log.warning("webhook_fehlgeschlagen", error=str(exc)[:200])
        return False


def bestaetigung_senden(
    empfaenger: str,
    absender_name: str | None,
    text: str,
    antworten: dict[str, str],
) -> bool:
    """Eine Bestaetigung an den ABSENDER des Formulars.

    Standardmaessig an, wie bei Hostaway — und aus einem praktischen Grund: ein
    Gast, der abschickt und nichts hoert, schickt noch einmal oder ruft an.

    MIT KOPIE SEINER ANTWORTEN, ebenfalls wie bei Hostaway. Sie sind seine
    eigenen Angaben; sie ihm zurueckzugeben ist kein Datenleck, sondern der
    Beleg, was er geschickt hat.

    Der Betreff traegt den NAMEN DES BETRIEBS und nicht unseren: der Gast hat
    dem Betrieb geschrieben, nicht uns.

    Gibt zurueck, ob es geklappt hat. Wirft nie — die Einsendung ist gespeichert,
    und ein Mailserver, der gerade nicht antwortet, darf den Gast nicht treffen
    (Wurzel 5).
    """
    ziel = (empfaenger or "").strip()
    if not ziel or "@" not in ziel:
        return False
    try:
        # Lokaler Import: der Mail-Dienst haengt an der Konfiguration, und der
        # Slice soll ohne ihn ladbar bleiben (Tests, Migrationslaeufe).
        from src.core.mail import MailService, OutboundMessage  # noqa: PLC0415

        zeilen = [text.strip() or "", ""]
        if antworten:
            zeilen.append("Ihre Angaben:")
            zeilen.extend(f"  {k}: {v}" for k, v in antworten.items())
        MailService().send(
            OutboundMessage(
                to=ziel,
                subject=(absender_name or "").strip() or "Ihre Anfrage",
                text="\n".join(zeilen).strip(),
            )
        )
        return True
    except Exception as exc:  # noqa: BLE001 — der Nebenpfad kippt nie den Gast
        log.warning("formular_bestaetigung_fehlgeschlagen", error=str(exc)[:200])
        return False
