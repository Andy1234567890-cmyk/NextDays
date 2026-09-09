"""Benachrichtigung über eine neue Chat-Nachricht (0611, ADR-0029).

WAS HIER NICHT DRINSTEHEN KANN, auch wenn man es gewohnt ist: der Text der
Nachricht. Der Server kennt ihn nicht — er hat nur Chiffretext. Die Meldung
sagt deshalb WER geschrieben hat und ZU WELCHEM OBJEKT, nie WAS.

Das ist kein Mangel, sondern die Folge der Entscheidung: Wer hier je einen
Auszug einbaut, hat entweder Chiffretext verschickt (unlesbar) oder die
Verschlüsselung aufgehoben.

BEST-EFFORT (Wurzel 5): Eine fehlgeschlagene Benachrichtigung darf das Senden
NICHT scheitern lassen. Die Nachricht liegt dann bereits in der Datenbank; ein
Fehler hier würde dem Absender „nicht gesendet" melden, obwohl sie angekommen
ist — er schriebe sie ein zweites Mal.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger

from . import kern

log = get_logger(__name__)


def _objekt_titel(db: Client, property_id: str) -> str:
    zeilen = (
        db.table("properties")
        .select("title")
        .eq("id", property_id)
        .limit(1)
        .execute()
    ).data or []
    return str(zeilen[0].get("title") or "") if zeilen else ""


def neue_nachricht_melden(  # noqa: PLR0913 — Ereignis, Ziel und Absender
    db: Client,
    tenant_id: str,
    *,
    property_id: str,
    thread_id: str,
    message_id: str,
    seite: str,
    absender_name: str,
    absender_user_id: str,
) -> None:
    """Die jeweils ANDERE Seite benachrichtigen.

    `seite` ist die Seite des ABSENDERS: schreibt der Eigentümer, geht die
    Meldung an den Betrieb und umgekehrt. Der Absender selbst bekommt nichts —
    sonst meldete sich sein eigenes Telefon bei jeder Nachricht.
    """
    titel = _objekt_titel(db, property_id)
    if seite == "owner":
        empfaenger = kern.agentur_nutzer(db, tenant_id)
        schluessel = "betrieb_chat"
        # Das Muster des Projekts: `/posteingang/{thread_id}` als eigene
        # Route (`web/app/(dashboard)/posteingang/[threadId]`), NICHT als
        # Query-Parameter. Meine erste Fassung erzeugte ein Sprungziel ohne
        # Seite — also einen 404 in einer bereits verschickten Mail, genau das,
        # wofür `melde-ziele-pruefen.mjs` existiert.
        ziel_pfad = f"/posteingang/eig:{thread_id}"
    else:
        empfaenger = kern.eigentuemer_nutzer(db, tenant_id, property_id)
        schluessel = "owner_chat"
        # Das Eigentümer-PORTAL im Web hat keinen Chat — er lebt in der App
        # (`mobile-owner`), weil der Schlüssel in der Keychain liegt und ein
        # Browser dafür keinen gleichwertigen Ort hat (ADR-0029). Der Link
        # führt deshalb auf die Portal-Startseite; ein Ziel `/portal/nachrichten`
        # wäre ein 404 in einer verschickten Mail.
        ziel_pfad = "/portal"

    # Lokaler Import wie bei den übrigen Aufrufern (`public_portal/familie.py`):
    # der Dispatcher zieht Mail- und Einstellungs-Dienste nach, und ein
    # Modul-Import hier schlösse einen Kreis über den inbox-Slice.
    from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
        NotificationDispatcher,
    )

    dispatcher = NotificationDispatcher(db)
    for user_id in empfaenger:
        if user_id == absender_user_id:
            continue
        try:
            dispatcher.sende(
                user_id=user_id,
                tenant_id=tenant_id,
                schluessel=schluessel,
                # Rohtext-Rückfall (englisch, wie die übrigen Aufrufer): die
                # Katalogschlüssel unten liefern die Sprache des Empfängers.
                betreff=f"New message: {titel}" if titel else "New message",
                text=f"{absender_name} sent you a message.",
                betreff_key="chat.neueNachrichtBetreff",
                betreff_werte={"objekt": titel},
                text_key="chat.neueNachrichtText",
                text_werte={"name": absender_name, "objekt": titel},
                ziel_pfad=ziel_pfad,
                property_id=property_id,
                thread_ref=f"eig:{thread_id}",
                # Wurzel 2: dieselbe Nachricht darf bei einem Retry nicht
                # zweimal melden. Der Schlüssel trägt die NACHRICHTEN-ID, nicht
                # nur den Thread — bei gleichem Schlüssel überspringt der
                # Dispatcher ALLE Kanäle, ein threadweiter Schlüssel hätte also
                # ab der zweiten Nachricht jede Meldung verschluckt. Ein
                # stiller Ausfall, den niemand als Fehler sieht (Wurzel 5).
                dedup_key=f"eigchat:{message_id}",
            )
        except Exception as exc:  # noqa: BLE001 — best effort, siehe Modulkopf
            log.warning(
                "owner_chat_meldung_fehlgeschlagen",
                extra={
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "fehler": str(exc)[:200],
                },
            )
