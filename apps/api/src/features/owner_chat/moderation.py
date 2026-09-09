"""Melden und Chat-Stopp — die zwei Wege, die Googles UGC-Richtlinie verlangt.

WÖRTLICH (geprüft am 09.09.2026, Play Console Help „User Generated Content"):

  „Apps featuring UGC that identify a specified set of users through means such
   as user verification or offline registration (for example, apps exclusively
   used within a specific school or company, etc.) must provide in-app
   functionality to report content and users."

  „UGC features that enable 1:1 user interaction with specific users (for
   example, direct messaging, tagging, mentioning, etc.) must provide an in-app
   functionality for blocking users."

Der Eigentümer-Chat (0611) ist beides zugleich: geschlossener, eingeladener
Nutzerkreis UND Direktnachricht zwischen zwei Seiten. Eine Ausnahme für
geschäftliche Kommunikation nennt die Richtlinie nicht.

WAS DER SERVER DABEI NICHT KANN — und das gehört in die Prüfungs-Antwort, nicht
unter den Teppich: Er kann den gemeldeten Text nicht lesen. Der Chat ist
Ende-zu-Ende verschlüsselt (ADR-0029); `owner_messages.body` trägt Chiffretext.
Moderiert wird deshalb über den METADATEN-Faden: wer hat wen gemeldet, wie oft,
in welchem Gespräch — und über die Beschreibung des Melders. Das ist die
„moderation … as is reasonable and consistent with the type of UGC hosted",
die die Richtlinie verlangt; ein Auszug des Textes wäre nur zu haben, wenn man
die Verschlüsselung aufhebt.

WARUM STOPP UND NICHT BLOCKIEREN: siehe Migration 0615. Die Gegenseite ist die
Verwaltung der eigenen Objekte; ein Knopf „Verwaltung blockieren" wäre eine
Zusage, die das Produkt nicht halten kann. Der Stopp beendet das Gespräch für
den Meldenden und sagt es der Gegenseite — und ist umkehrbar (Wurzel 1).
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger

from .fehler import OwnerChatError

log = get_logger(__name__)

MELDUNGEN = "owner_chat_meldungen"
STOPPS = "owner_chat_stopps"

# Feste Liste statt Freitext: eine Auswertung über getippte Gründe gibt es
# nicht, und die Prüfung braucht die Einordnung. Dieselben Werte wie der
# CHECK in 0615 — wer hier einen ergänzt, ergänzt dort mit, sonst wirft die
# Datenbank und niemand sieht warum.
GRUENDE = ("beleidigung", "betrug", "unerwuenscht", "anderes")

# Wie im übrigen Chat (Wurzel 8): jeder Freitext bekommt eine harte Obergrenze.
FREITEXT_MAX = 2000


def melden(
    db: Client,
    *,
    tenant_id: str,
    user_id: str,
    seite: str,
    thread_id: str,
    message_id: str | None,
    grund: str,
    freitext: str | None,
) -> dict[str, Any]:
    """Eine Nachricht oder das Gespräch melden.

    IDEMPOTENT (Wurzel 2): Liegt für dieselbe Nachricht bzw. denselben Faden
    schon eine OFFENE Meldung dieses Menschen vor, wird sie zurückgegeben statt
    einer zweiten. Der Teil-UNIQUE aus 0615 ist der Backstop; ein 23505 im
    Gesicht dessen, der zweimal getippt hat, wäre keine Antwort.

    Der Aufrufer hat den Faden bereits gescopet — hier wird NICHT noch einmal
    geprüft, wem er gehört, sondern nur, dass die gemeldete Nachricht auch
    wirklich in diesem Faden liegt. Sonst meldete jemand über eine geratene ID
    eine fremde Nachricht in seinen eigenen Faden hinein.
    """
    if grund not in GRUENDE:
        raise OwnerChatError("Unbekannter Meldegrund.", status_code=422)
    if seite not in ("owner", "agency"):
        raise OwnerChatError("Unbekannte Seite.", status_code=422)

    if message_id is not None:
        gehoert = (
            db.table("owner_messages")
            .select("id")
            .eq("id", message_id)
            .eq("thread_id", thread_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not gehoert:
            raise OwnerChatError("Nachricht nicht gefunden.", status_code=404)

    vorhanden = _offene_meldung(db, thread_id, message_id, user_id)
    if vorhanden is not None:
        return vorhanden

    text = (freitext or "").strip()[:FREITEXT_MAX] or None
    zeilen = (
        db.table(MELDUNGEN)
        .insert(
            {
                "tenant_id": tenant_id,
                "thread_id": thread_id,
                "message_id": message_id,
                "melder_user_id": user_id,
                "melder_seite": seite,
                "grund": grund,
                "freitext": text,
                "status": "offen",
            }
        )
        .execute()
    ).data or []
    if not zeilen:
        raise OwnerChatError("Meldung konnte nicht abgelegt werden.", status_code=500)
    log.info(
        "owner_chat_gemeldet",
        tenant_id=tenant_id,
        thread_id=thread_id,
        message_id=message_id,
        grund=grund,
        seite=seite,
    )
    return zeilen[0]


def _offene_meldung(
    db: Client, thread_id: str, message_id: str | None, user_id: str
) -> dict[str, Any] | None:
    frage = (
        db.table(MELDUNGEN)
        .select("id, grund, freitext, status, created_at")
        .eq("thread_id", thread_id)
        .eq("melder_user_id", user_id)
        .eq("status", "offen")
    )
    frage = (
        frage.eq("message_id", message_id)
        if message_id is not None
        else frage.is_("message_id", "null")
    )
    zeilen = (frage.limit(1).execute()).data or []
    return zeilen[0] if zeilen else None


def stopp_setzen(
    db: Client,
    *,
    tenant_id: str,
    user_id: str,
    thread_id: str,
    grund: str | None,
) -> dict[str, Any]:
    """Das Gespräch für DIESEN Menschen beenden.

    `upsert` statt `insert`: ein zweiter Druck darf kein 23505 werfen, und der
    Zustand danach ist derselbe (Wurzel 2).
    """
    zeilen = (
        db.table(STOPPS)
        .upsert(
            {
                "tenant_id": tenant_id,
                "thread_id": thread_id,
                "user_id": user_id,
                "grund": (grund or "").strip()[:FREITEXT_MAX] or None,
                "gestoppt_am": datetime.now(UTC).isoformat(),
            },
            on_conflict="thread_id,user_id",
        )
        .execute()
    ).data or []
    log.info("owner_chat_gestoppt", tenant_id=tenant_id, thread_id=thread_id)
    return zeilen[0] if zeilen else {"thread_id": thread_id, "user_id": user_id}


def stopp_aufheben(db: Client, *, tenant_id: str, user_id: str, thread_id: str) -> None:
    """Der Gegenzustand (Wurzel 1). Ohne ihn wäre ein Streit für immer.

    Kein 404, wenn kein Stopp vorliegt: „wieder aufnehmen" auf einem laufenden
    Gespräch ist ein No-op, kein Fehler.
    """
    db.table(STOPPS).delete().eq("tenant_id", tenant_id).eq("thread_id", thread_id).eq(
        "user_id", user_id
    ).execute()
    log.info("owner_chat_stopp_aufgehoben", tenant_id=tenant_id, thread_id=thread_id)


def ist_gestoppt(db: Client, *, thread_id: str, user_id: str) -> bool:
    """Hat dieser Mensch das Gespräch beendet?

    Wird VOR dem Senden gefragt: ein „beendet", nach dem man weiterschreiben
    kann, ist eine Attrappe.
    """
    if not thread_id:
        return False
    zeilen = (
        db.table(STOPPS)
        .select("id")
        .eq("thread_id", thread_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    ).data or []
    return bool(zeilen)


def gestoppte_faeden(db: Client, *, user_id: str, thread_ids: list[str]) -> set[str]:
    """Welche der genannten Fäden hat dieser Mensch beendet?

    Eine Abfrage für die ganze Liste statt einer je Zeile — die Fadenliste
    fragt sonst je Objekt einmal nach.
    """
    if not thread_ids:
        return set()
    zeilen = (
        db.table(STOPPS)
        .select("thread_id")
        .eq("user_id", user_id)
        .in_("thread_id", thread_ids)
        .execute()
    ).data or []
    return {str(z["thread_id"]) for z in zeilen}
