"""Serverseitige Verschlüsselung des Eigentümer-Chats.

WAS SICH HIER GEGENÜBER ADR-0029 ÄNDERT — und warum es benannt gehört:

Der Chat war Ende-zu-Ende verschlüsselt: Nur die Geräte konnten lesen, der
Server sah Chiffretext. Das hatte eine Folge, die im Betrieb nicht tragbar war
— die Verwaltung arbeitet im Dashboard, im Browser, und dort gibt es keinen
Ort für einen privaten Schlüssel. Am 09.09.2026 lag der reale Fall vor: Ein
Eigentümer schrieb zwei Nachrichten, und NIEMAND auf der Agenturseite konnte
sie öffnen, weil kein Agenturgerät registriert war. Die Nachrichten waren
zugestellt, gespeichert und dauerhaft unlesbar.

Was das kostet, offen gesagt: Wer diesen Server übernimmt und an
`OWNER_CHAT_SCHLUESSEL` kommt, liest jeden Chat mit. Die Aussage „Auch wir
können es nicht lesen" gilt nicht mehr und ist aus der Oberfläche zu entfernen
— eine Zusicherung, die nicht mehr stimmt, ist schlimmer als keine.

Was bleibt: Der Chat liegt NICHT im Klartext in der Datenbank. Ein Angreifer
mit reinem DB-Zugriff (gestohlenes Backup, offener Direktpfad, Wurzel 6) sieht
weiterhin nichts. Der Schlüssel liegt in der Umgebung des Dienstes, nicht in
der Datenbank — beides zusammen braucht es zum Lesen.

Verfahren: AES-256-GCM mit 12-Byte-Nonce je Nachricht, Schlüssel aus der
Umgebung. Der Nonce steht vor dem Chiffretext; beides zusammen wird base64
abgelegt, damit die vorhandene `body`-Spalte (text) unverändert bleibt.
"""
from __future__ import annotations

import base64
import os
import secrets
from typing import Final

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .fehler import OwnerChatError

# 12 Byte ist die von NIST für GCM empfohlene Nonce-Länge und die einzige, für
# die der Standard die Sicherheitsgrenzen belegt.
NONCE_BYTES: Final = 12

# Kennzeichnung am Anfang jeder serverseitig verschlüsselten Nachricht.
# WOZU: Im Bestand liegen E2E-Nachrichten (ADR-0029), die dieser Schlüssel
# NICHT öffnen kann. Ohne Unterscheidung liefe die Entschlüsselung darauf an
# und schlüge mit einem Krypto-Fehler fehl — die Oberfläche zeigte
# „manipuliert", obwohl die Nachricht bloß älter ist (Wurzel 5).
MARKE: Final = b"sv1:"


def _schluessel() -> bytes:
    """Der Serverschlüssel aus der Umgebung, 32 Byte, base64.

    Fail-CLOSED (Wurzel 5): Fehlt er, wird NICHT im Klartext gespeichert und
    auch kein Ersatzschlüssel erfunden (Wurzel 4) — der Aufruf schlägt fehl.
    Ein Chat, der still unverschlüsselt liefe, wäre der schlimmere Zustand.
    """
    roh = os.environ.get("OWNER_CHAT_SCHLUESSEL", "")
    if not roh:
        raise OwnerChatError(
            "Chat ist nicht eingerichtet (OWNER_CHAT_SCHLUESSEL fehlt).",
            status_code=503,
        )
    try:
        key = base64.b64decode(roh, validate=True)
    except (ValueError, TypeError) as exc:
        raise OwnerChatError(
            "Chat-Schlüssel ist unlesbar.", status_code=503
        ) from exc
    if len(key) != 32:
        raise OwnerChatError(
            f"Chat-Schlüssel muss 32 Byte haben, hat {len(key)}.",
            status_code=503,
        )
    return key


def verschluesseln(klartext: str) -> str:
    """Klartext → base64(MARKE + Nonce + Chiffretext).

    Je Aufruf ein frischer Nonce. Bei einem festen Schlüssel ist die
    Nonce-Wiederverwendung der eine Fehler, der AES-GCM vollständig bricht —
    deshalb kommt er aus `secrets`, nicht aus einem Zähler.
    """
    if not klartext:
        raise OwnerChatError("Nachricht ist leer.", status_code=422)
    nonce = secrets.token_bytes(NONCE_BYTES)
    chiffre = AESGCM(_schluessel()).encrypt(nonce, klartext.encode(), None)
    return base64.b64encode(MARKE + nonce + chiffre).decode()


def entschluesseln(gespeichert: str) -> str | None:
    """base64(MARKE + Nonce + Chiffretext) → Klartext.

    `None` bei einer Nachricht, die dieser Schlüssel nicht öffnen kann — das
    sind die E2E-Bestände aus der Zeit vor dieser Umstellung. Sie sind nicht
    kaputt, sie gehören einem anderen Verfahren; die Oberfläche sagt das,
    statt einen Fehler zu zeigen (Wurzel 5).
    """
    try:
        roh = base64.b64decode(gespeichert, validate=True)
    except (ValueError, TypeError):
        return None
    if not roh.startswith(MARKE):
        return None
    kern = roh[len(MARKE) :]
    if len(kern) <= NONCE_BYTES:
        return None
    try:
        klar = AESGCM(_schluessel()).decrypt(
            kern[:NONCE_BYTES], kern[NONCE_BYTES:], None
        )
    except InvalidTag:
        # Authentifizierter Fehlschlag: der Chiffretext wurde verändert oder
        # der Schlüssel ist ein anderer. Beides ist KEIN Klartext-Ersatz.
        return None
    return klar.decode()


def ist_serverseitig(gespeichert: str) -> bool:
    """Hat DIESER Server diesen Eintrag erzeugt? Authentifiziert geprüft.

    Die Marke `sv1:` allein beweist NICHTS: sie steht im base64, das der
    Client schickt, und lässt sich in einer Zeile fälschen
    (`b64encode(b"sv1:" + irgendwas)`). Die erste Fassung prüfte genau das —
    ein Absender konnte damit die Geräteprüfung in `nachricht_ablegen`
    überspringen und beliebiges `sender_key`-Material unter fremdem Namen
    ablegen. Genau die Fälschungs-Hintertür, die `_absender_schluessel_pruefen`
    verhindern soll (nachgestellt 09.09.2026).

    Beweiskräftig ist allein der GCM-Auth-Tag: entschlüsselt der Serverschlüssel
    den Eintrag, dann hat dieser Server ihn geschrieben. Fälschen hiesse den
    Schlüssel zu kennen.
    """
    return entschluesseln(gespeichert) is not None


def ablage_inhalt(text: str, chiffre: str) -> str:
    """Was in `owner_messages.body` landet — Klartext-verschlüsselt oder durchgereicht.

    ZWEI WEGE, bewusst nebeneinander (09.09.2026):

    * `text` gesetzt → der SERVER verschlüsselt. Der neue Weg, seit das
      Dashboard mitlesen können muss: im Browser gibt es keinen Ort für einen
      privaten Geräteschlüssel.
    * `chiffre` gesetzt → eine App-Version aus der E2E-Zeit hat selbst
      verschlüsselt. Der Server reicht durch, wie bisher.

    Entschieden wird am FELD, nicht an einer Fassung im User-Agent: Letzteres
    wäre eine Vermutung über den Client, Ersteres eine Tatsache über die
    Anfrage.

    EINE Stelle für beide Sendepfade (Eigentümer und Agentur) — zwei Kopien
    liefen auseinander, sobald einer von beiden angefasst wird.
    """
    if text and chiffre:
        # Beides zu setzen ist kein „nimm eins", sondern ein Client-Fehler.
        # Ihn stillschweigend aufzulösen versteckte ihn (Wurzel 5).
        raise OwnerChatError(
            "Entweder `text` oder `chiffre`, nicht beides.", status_code=422
        )
    return verschluesseln(text) if text else chiffre
