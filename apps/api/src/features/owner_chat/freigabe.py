"""Alte Verläufe für ein neues Gerät freigeben (ADR-0029).

DAS PROBLEM, das E2E erzeugt: Ein neues Teammitglied kann ältere Nachrichten
kryptografisch NICHT lesen — für sein Gerät wurde nie ein Schlüssel verpackt.
Beim Personalwechsel steht der Nachfolger sonst vor einem leeren Gespräch,
obwohl der Verlauf existiert.

DER WEG ZURÜCK: Ein Gerät, das den Verlauf lesen KANN, entschlüsselt die alten
Inhaltsschlüssel und verpackt sie für das neue Gerät neu. Der Server sieht
dabei wieder nur Chiffretext — er vermittelt, er öffnet nichts.

WER DAS DARF: ausschließlich `admin` und `co_admin` (Festlegung vom
09.09.2026). Nicht jeder Kollege — sonst wäre der Zugang zu Betriebsinterna
eine Gefälligkeit unter Mitarbeitern statt eine Rechteentscheidung. Die Tabelle
`owner_chat_freigaben` ist zugleich das Protokoll: wer wem wann Einblick gab.
"""
from __future__ import annotations

from typing import Final

from supabase import Client

from src.core.logging import get_logger
from src.features.auth.schemas import UserRole

from . import kern, serverkrypto
from .fehler import OwnerChatError

log = get_logger(__name__)

# Wurzel 8: eine Freigabe darf nicht unbegrenzt viele Zeilen schreiben.
MAX_NACHRICHTEN_JE_FREIGABE: Final = 2000

_DARF_FREIGEBEN: Final = frozenset({UserRole.admin, UserRole.co_admin})


def _rolle_pruefen(db: Client, tenant_id: str, user_id: str) -> None:
    """Nur admin/co_admin. Rolle aus der DB, nicht aus dem JWT (Wurzel 7)."""
    zeilen = (
        db.table("users")
        .select("role")
        .eq("id", user_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise OwnerChatError("Kein Zugriff.", status_code=403)
    try:
        rolle = UserRole(zeilen[0].get("role") or "")
    except ValueError:
        # Unbekannte Rolle = keine Freigabe (fail-closed).
        raise OwnerChatError("Kein Zugriff.", status_code=403) from None
    if rolle not in _DARF_FREIGEBEN:
        raise OwnerChatError(
            "Nur die Betriebsleitung kann einen Verlauf freigeben.",
            status_code=403,
        )


def _zielgeraet_pruefen(
    db: Client, tenant_id: str, faden: dict, device_id: str
) -> None:
    """Darf für DIESES Gerät in DIESEM Gespräch freigegeben werden?

    EINE Funktion für Lese- und Schreibpfad. Vorher standen die Prüfungen
    zweimal nebeneinander — und liefen prompt auseinander: Der Schreibpfad
    verlangte ein ungesperrtes Gerät aus dem Empfängerkreis, der Lesepfad
    prüfte nur den Mandanten. Über ihn ließ sich der vollständige Chiffretext
    eines Gesprächs ziehen, indem man eine beliebige Geräte-ID des Mandanten
    einsetzte — ein gesperrtes genügte (nachgestellt am 09.09.2026).

    Genau die Asymmetrie, die Wurzel 9 benennt: derselbe Scope an Liste UND
    Detail. Zwei getrennte Blöcke sind die Ursache, nicht die Lösung.
    """
    geraet = (
        db.table("owner_chat_devices")
        .select("id, user_id")
        .eq("id", device_id)
        .eq("tenant_id", tenant_id)
        # Gesperrt heißt gesperrt — auch beim LESEN. Ein als verloren
        # gemeldetes Gerät darf kein Vorwand sein, an den Verlauf zu kommen.
        .is_("gesperrt_am", "null")
        .limit(1)
        .execute()
    ).data or []
    if not geraet:
        raise OwnerChatError("Gerät nicht gefunden.", status_code=404)

    # Der Besitzer muss zum Empfängerkreis DIESES Gesprächs gehören. Die
    # Rollenprüfung sagt, WER freigeben darf — nicht, FÜR WEN.
    besitzer = str(geraet[0].get("user_id") or "")
    property_id = str(faden.get("property_id") or "")
    erlaubt = set(kern.agentur_nutzer(db, tenant_id)) | set(
        kern.eigentuemer_nutzer(db, tenant_id, property_id)
    )
    if besitzer not in erlaubt:
        raise OwnerChatError(
            "Dieses Gerät gehört nicht zu diesem Gespräch.", status_code=403
        )


def _faden_laden(db: Client, tenant_id: str, thread_id: str) -> dict:
    """Faden laden UND scopen (Wurzel 3) — für beide Pfade dieselbe Zeile."""
    zeilen = (
        db.table("owner_threads")
        .select("id, property_id")
        .eq("id", thread_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise OwnerChatError("Gespräch nicht gefunden.", status_code=404)
    return zeilen[0]


def offene_nachrichten(  # noqa: PLR0913 — Scope-Prüfung braucht den Anrufer
    db: Client,
    tenant_id: str,
    user_id: str,
    thread_id: str,
    device_id: str,
) -> list[dict]:
    """Nachrichten, für die DIESES Gerät noch keinen Schlüssel hat.

    Das freigebende Gerät holt sie, entschlüsselt jeden Inhaltsschlüssel mit
    seinem eigenen und verpackt ihn für das neue Gerät neu.

    WURZEL 9 — dieselbe Autorisierung wie der Schreibpfad: Diese Funktion gibt
    den VOLLSTÄNDIGEN Chiffretext eines Gesprächs heraus. Ohne die Rollen- und
    Scope-Prüfung konnte JEDER eingeloggte Nutzer des Mandanten — auch eine
    Reinigungskraft — mit einer geratenen `thread_id` und einer beliebigen
    Geräte-ID den kompletten Verlauf jedes Eigentümer-Gesprächs abziehen.
    Chiffretext ist ohne Schlüssel zwar nicht lesbar, aber er lässt sich
    aufbewahren und bei jedem späteren Schlüssel-Leck auswerten; die
    Metadaten (Anzahl, Längen, Zeitpunkte) liegen ohnehin offen.

    Der Fehler war die Asymmetrie: `schluessel_nachtragen` daneben prüfte
    korrekt, dieser Lesepfad gar nicht — genau das Muster, das Wurzel 9
    benennt (daten-ausgebende Route mit nur `get_current_user`).
    """
    _rolle_pruefen(db, tenant_id, user_id)
    faden = _faden_laden(db, tenant_id, thread_id)
    _zielgeraet_pruefen(db, tenant_id, faden, device_id)

    alle = (
        db.table("owner_messages")
        .select("id, body")
        .eq("tenant_id", tenant_id)
        .eq("thread_id", thread_id)
        .order("sent_at")
        .limit(MAX_NACHRICHTEN_JE_FREIGABE)
        .execute()
    ).data or []
    if not alle:
        return []

    vorhanden = (
        db.table("owner_message_keys")
        .select("message_id")
        .eq("device_id", device_id)
        .in_("message_id", [str(z["id"]) for z in alle])
        .execute()
    ).data or []
    schon = {str(z["message_id"]) for z in vorhanden}
    # Serverseitig verschlüsselte Nachrichten brauchen KEINE Freigabe: der
    # Server öffnet sie für jedes Gerät. Sie hier aufzulisten böte eine
    # Nachverpackung für Nachrichten an, die längst lesbar sind — und die
    # Freigabe-Oberfläche zählte sie als offen (09.09.2026).
    return [
        z
        for z in alle
        if str(z["id"]) not in schon
        and not serverkrypto.ist_serverseitig(str(z.get("body") or ""))
    ]


def schluessel_nachtragen(
    db: Client,
    tenant_id: str,
    user_id: str,
    thread_id: str,
    device_id: str,
    *,
    schluessel: dict[str, str],
    wrapper_key: str,
) -> int:
    """Nachverpackte Schlüssel für ein Gerät ablegen. Gibt die Anzahl zurück.

    Wurzel 3: Sowohl der Thread als auch das Zielgerät werden gegen den
    Mandanten geprüft — sonst schöbe ein Aufruf mit fremden IDs Schlüssel in
    ein Gespräch eines anderen Betriebs.
    """
    _rolle_pruefen(db, tenant_id, user_id)
    faden = _faden_laden(db, tenant_id, thread_id)
    _zielgeraet_pruefen(db, tenant_id, faden, device_id)

    if not schluessel:
        return 0
    if not wrapper_key:
        # Ohne den Schlüssel des VERPACKENDEN Geräts kann das Zielgerät die
        # nachgetragenen Schlüssel nicht öffnen — es bildete das Geheimnis
        # gegen den ursprünglichen Absender und bekäme nichts auf. Genau der
        # Fehler, der die Freigabe bis zum 09.09.2026 unmöglich machte, ohne
        # dass irgendetwas fehlschlug (Wurzel 5).
        raise OwnerChatError(
            "Schlüssel des freigebenden Geräts fehlt.", status_code=422
        )
    if len(schluessel) > MAX_NACHRICHTEN_JE_FREIGABE:
        raise OwnerChatError("Zu viele Nachrichten auf einmal.", status_code=422)

    # Nur Nachrichten DIESES Threads — ein Client könnte sonst Schlüssel für
    # fremde Nachrichten mitschicken und dem Gerät Zugang zu einem Gespräch
    # geben, das gar nicht freigegeben wurde (Wurzel 9).
    erlaubte = (
        db.table("owner_messages")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("thread_id", thread_id)
        .in_("id", sorted(schluessel.keys()))
        .execute()
    ).data or []
    gueltig = {str(z["id"]) for z in erlaubte}

    zeilen = [
        {
            "message_id": mid,
            "device_id": device_id,
            "wrapped_key": wert,
            "wrapper_key": wrapper_key,
        }
        for mid, wert in schluessel.items()
        if mid in gueltig
    ]
    if not zeilen:
        return 0

    # Wurzel 2: dieselbe Freigabe kann doppelt ankommen (Doppelklick, Retry).
    # Der Primärschlüssel (message_id, device_id) fängt das ab — `upsert`
    # macht daraus ein No-Op statt eines 23505.
    db.table("owner_message_keys").upsert(
        zeilen, on_conflict="message_id,device_id"
    ).execute()

    db.table("owner_chat_freigaben").insert(
        {
            "tenant_id": tenant_id,
            "thread_id": thread_id,
            "freigegeben_von": user_id,
            "device_id": device_id,
        }
    ).execute()

    log.info(
        "owner_chat_verlauf_freigegeben",
        extra={
            "tenant_id": tenant_id,
            "thread_id": thread_id,
            "anzahl": len(zeilen),
        },
    )
    return len(zeilen)
