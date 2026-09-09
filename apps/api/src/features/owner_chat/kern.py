"""Empfängerkreis, Thread-Anlage und Ablage einer Nachricht (0611, ADR-0029).

DIE ZENTRALE AUFGABE dieses Moduls ist der EMPFÄNGERKREIS. Bei Ende-zu-Ende-
Verschlüsselung muss der Absender wissen, FÜR WEN er den Inhaltsschlüssel
verpackt — und diese Liste bestimmt der Server, nicht der Client (Wurzel 3).
Dürfte der Client sie mitschicken, könnte er ein fremdes Gerät hinzufügen und
sich damit selbst in ein Gespräch einschreiben.

Der Server sieht dabei NIE Klartext: er liefert die öffentlichen Schlüssel,
nimmt Chiffretext plus fertig verpackte Schlüssel entgegen und legt beides ab.
Was er prüft, ist die VOLLSTÄNDIGKEIT — für jedes Gerät des Empfängerkreises
muss ein verpackter Schlüssel dabei sein. Fehlte einer, wäre die Nachricht für
diesen Empfänger stumm verloren (Wurzel 5).
"""
from __future__ import annotations

from typing import Final

from supabase import Client

from src.core.logging import get_logger
from src.features.auth.granular_permissions import (
    Permission,
    effective_permissions,
)
from src.features.auth.schemas import UserRole

from . import bilder as bilder_modul
from .fehler import OwnerChatError

log = get_logger(__name__)

# Wurzel 8: harte Obergrenzen an jedem unbegrenzten Bereich.
#
# WICHTIG: Diese Grenze WIRFT, sie schneidet nicht ab. Ein `.limit()` allein
# wäre hier der schlimmere Fehler — PostgREST liefert dann stumm 60 Zeilen,
# die Vollständigkeitsprüfung prüft nur gegen diese verkürzte Liste, und jedes
# Gerät jenseits von Platz 60 bekäme nie einen Schlüssel. Es könnte die
# Nachricht dauerhaft nicht öffnen, ohne dass irgendwo etwas fehlschlägt
# (Wurzel 5). Erreichbar ist das real: 5 Geräte je Nutzer × 12 Mitarbeiter mit
# Postfach-Recht reichen schon.
MAX_EMPFAENGER: Final = 60
# Eigene Grenze für die Fäden-Liste. Vorher teilte sie sich die Konstante mit
# dem Empfängerkreis — zwei Bedeutungen an einem Wert, und ein Eigentümer mit
# mehr als 60 Objekten hätte Gespräche aus seiner Liste verloren.
MAX_FAEDEN: Final = 200
MAX_BILDER: Final = 10
# Chiffretext ist base64 und wächst gegenüber dem Klartext. 64 KB reichen für
# eine sehr lange Nachricht und begrenzen, was ein Client in eine Zeile legt.
MAX_CHIFFRE_BYTES: Final = 65536

# Wer auf Agenturseite mitliest: jeder mit Postfach-Recht. Festlegung vom
# 09.09.2026 — der Eigentümer-Chat liegt im normalen Posteingang, also gilt
# dieselbe Berechtigung wie für Gastnachrichten.
_AGENTUR_RECHT: Final = Permission.INBOX_VIEW_ALL


def _rolle(row: dict) -> UserRole | None:
    try:
        return UserRole(row["role"]) if row.get("role") else None
    except ValueError:
        # Unbekannte Rolle = keine Rolle (fail-closed, Wurzel 6).
        return None


def agentur_nutzer(db: Client, tenant_id: str) -> list[str]:
    """User-IDs der Agenturseite, die den Chat lesen dürfen.

    Quelle ist die DB, nicht das JWT (Wurzel 7): eine entzogene Rolle wirkt
    sofort, nicht erst mit dem nächsten Token.
    """
    zeilen = (
        db.table("users")
        .select("id, role, permissions")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    erlaubt: list[str] = []
    for z in zeilen:
        rolle = _rolle(z)
        # Der Eigentümer ist im selben Mandanten ein `users`-Eintrag mit Rolle
        # `owner` — er gehört auf die ANDERE Seite und darf hier nicht als
        # Agentur-Empfänger auftauchen.
        if rolle in (UserRole.owner, None):
            continue
        if _AGENTUR_RECHT in effective_permissions(rolle, z.get("permissions")):
            erlaubt.append(str(z["id"]))
    return erlaubt


def eigentuemer_nutzer(db: Client, tenant_id: str, property_id: str) -> list[str]:
    """User-IDs der Eigentümerseite für EIN Objekt.

    QUELLE IST `owner_property_assignments` — dieselbe, gegen die auch der
    ZUGRIFF geprüft wird (`public_portal/nachrichten.py._meine_objekte`).

    WARUM NICHT `owner_properties` (so war es bis zum 09.09.2026 gebaut, und
    das war ein Fehler): Die beiden Tabellen decken sich NICHT. Live gemessen
    am 09.09.2026: 8 von 30 Zuweisungen stehen nur in
    `owner_property_assignments`. Der Grund ist fachlich gewollt — die Agentur
    darf einem Eigentümer ein Objekt sichtbar machen, das ihm nicht gehört
    (Verwalter-Fall, `owners/service.py`), und Familienmitglieder haben
    ohnehin keinen Eintrag in `owner_properties`.

    Die Folge der alten Fassung war ein STUMMER Fehler: Diese acht Nutzer
    durften senden und lesen, standen aber nicht im Empfängerkreis. Für sie
    wurde nie ein Schlüssel verpackt — sie sahen dauerhaft „nicht lesbar", und
    niemand konnte das bemerken, weil die Vollständigkeitsprüfung
    (`_schluessel_pruefen`) einen Empfänger, den sie nicht kennt, auch nicht
    vermissen kann (Wurzel 5).

    Die Gegenrichtung war genauso falsch: Wird die Portalsicht entzogen, bleibt
    der `owner_properties`-Link stehen — jemand ohne Zugriff wäre weiter
    Verschlüsselungsempfänger (Wurzel 1).

    EINE Quelle für Zugriff UND Empfängerkreis macht beides deckungsgleich per
    Definition, nicht per Pflege.
    """
    zeilen = (
        db.table("owner_property_assignments")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .execute()
    ).data or []
    return sorted({str(z["user_id"]) for z in zeilen if z.get("user_id")})


def empfaenger_geraete(
    db: Client, tenant_id: str, property_id: str
) -> list[dict]:
    """Alle aktiven Geräte BEIDER Seiten für dieses Objekt.

    Das ist die Liste, für die der Absender verschlüsselt — sein eigenes Gerät
    eingeschlossen, sonst könnte er seine eigene Nachricht später nicht mehr
    lesen (auf einem zweiten Gerät oder nach einer Neuinstallation).

    Gesperrte Geräte (verlorenes Handy) fallen heraus: sie bekommen KEINE neuen
    Schlüssel mehr. Die alten bleiben gültig — sie zu löschen würde den Verlauf
    für die übrigen Geräte nicht retten, sondern nur Lücken reißen (Wurzel 1).
    """
    user_ids = agentur_nutzer(db, tenant_id) + eigentuemer_nutzer(
        db, tenant_id, property_id
    )
    if not user_ids:
        return []
    zeilen = (
        db.table("owner_chat_devices")
        .select("id, user_id, seite, public_key")
        .eq("tenant_id", tenant_id)
        .in_("user_id", sorted(set(user_ids)))
        .is_("gesperrt_am", "null")
        # EINS mehr holen als erlaubt: nur so ist die Überschreitung erkennbar.
        # Mit `.limit(MAX_EMPFAENGER)` sähe eine volle Liste genauso aus wie
        # eine abgeschnittene.
        .limit(MAX_EMPFAENGER + 1)
        .execute()
    ).data or []
    if len(zeilen) > MAX_EMPFAENGER:
        log.warning(
            "owner_chat_zu_viele_empfaenger",
            extra={"tenant_id": tenant_id, "property_id": property_id},
        )
        raise OwnerChatError(
            "Zu viele Geräte in diesem Gespräch — bitte alte Geräte entfernen.",
            status_code=409,
        )
    return zeilen


def thread_holen_oder_anlegen(
    db: Client, tenant_id: str, property_id: str
) -> str:
    """`owner_threads.id` für dieses Objekt; legt den Faden bei Bedarf an.

    Wurzel 2 (real kommt alles doppelt): Zwei gleichzeitige Erstnachrichten von
    beiden Seiten liefen sonst in zwei Fäden für dasselbe Haus. Der UNIQUE-Index
    `owner_threads_property_uidx` fängt das ab — der 23505 wird hier zum
    erneuten Lesen, nicht zum Fehler.
    """
    vorhanden = (
        db.table("owner_threads")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .limit(1)
        .execute()
    ).data or []
    if vorhanden:
        return str(vorhanden[0]["id"])

    try:
        angelegt = (
            db.table("owner_threads")
            .insert({"tenant_id": tenant_id, "property_id": property_id})
            .execute()
        ).data or []
        if angelegt:
            return str(angelegt[0]["id"])
    except Exception as exc:  # noqa: BLE001 — auf 23505 geprüft, sonst re-raise
        if "23505" not in str(exc) and "duplicate key" not in str(exc).lower():
            raise
        log.info(
            "owner_chat_thread_parallel_angelegt",
            extra={"tenant_id": tenant_id, "property_id": property_id},
        )

    # Der Konkurrent war schneller — seine Zeile ist die richtige.
    nachgelesen = (
        db.table("owner_threads")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .limit(1)
        .execute()
    ).data or []
    if not nachgelesen:
        raise OwnerChatError(
            "Gespräch konnte nicht angelegt werden.", status_code=500
        )
    return str(nachgelesen[0]["id"])


def _schluessel_pruefen(
    geraete: list[dict], schluessel: dict[str, str]
) -> list[dict]:
    """Für JEDES Empfängergerät muss ein verpackter Schlüssel vorliegen.

    Ohne diese Prüfung könnte ein Client — versehentlich oder absichtlich —
    einen Empfänger auslassen. Die Nachricht käme an, wäre für ihn aber
    dauerhaft unlesbar, ohne dass irgendwo etwas fehlschlägt: genau die Art
    stummen Fehlers, die Wurzel 5 verbietet.
    """
    fehlend = [str(g["id"]) for g in geraete if str(g["id"]) not in schluessel]
    if fehlend:
        raise OwnerChatError(
            "Für einen Empfänger fehlt der Schlüssel — bitte erneut senden.",
            status_code=409,
        )
    # Schlüssel für Geräte, die NICHT im Empfängerkreis sind, werden verworfen
    # statt gespeichert: sonst schriebe ein Client sich ein fremdes Gerät in
    # den Verteiler (Wurzel 3 — der Server bestimmt den Kreis).
    erlaubt = {str(g["id"]) for g in geraete}
    return [
        {"device_id": gid, "wrapped_key": wert}
        for gid, wert in schluessel.items()
        if gid in erlaubt
    ]


def _absender_schluessel_pruefen(
    db: Client, tenant_id: str, user_id: str, sender_key: str
) -> None:
    """Gehört `sender_key` einem registrierten Gerät DIESES Nutzers?

    WOZU (Wurzel 3): Der Absender liefert seinen öffentlichen Schlüssel selbst
    mit, und der Empfänger bildet damit das gemeinsame Geheimnis. Wurde er nur
    auf „nicht leer" geprüft, konnte jeder, der schreiben darf, ein
    Wegwerf-Schlüsselpaar erzeugen und damit unter FREMDEM Namen senden: die
    Nachricht wäre für alle Empfänger sauber lesbar und kryptografisch nicht
    von einer echten zu unterscheiden.

    Der Server ist damit zwar weiterhin kein Mitleser (Vertraulichkeit), wäre
    aber ein möglicher Fälscher (Integrität) — eine Hintertür, die ADR-0029
    nicht benennt und nicht will.

    Diese Prüfung bindet den Schlüssel an ein Gerät, dessen Besitz beim
    Registrieren per Ed25519-Signatur bewiesen wurde. Gesperrte Geräte zählen
    NICHT: wer sein Handy als verloren meldet, soll damit nicht weitersenden
    können (Wurzel 1 — die Sperre nimmt die Zukunft).
    """
    treffer = (
        db.table("owner_chat_devices")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .eq("public_key", sender_key)
        .is_("gesperrt_am", "null")
        .limit(1)
        .execute()
    ).data or []
    if not treffer:
        raise OwnerChatError(
            "Dieses Gerät ist für den Chat nicht registriert.",
            status_code=403,
        )


def nachricht_ablegen(
    db: Client,
    tenant_id: str,
    thread_id: str,
    *,
    seite: str,
    user_id: str,
    sender_name: str,
    chiffre: str,
    schluessel: dict[str, str],
    geraete: list[dict],
    bilder: list[str],
    sender_key: str,
) -> dict:
    """Chiffretext + verpackte Schlüssel ablegen, Thread-Kopf nachziehen.

    `chiffre` ist für uns eine undurchsichtige Zeichenkette — geprüft wird nur
    ihre Größe (Wurzel 8), nie ihr Inhalt: wir können ihn nicht lesen.
    """
    if len(chiffre.encode("utf-8")) > MAX_CHIFFRE_BYTES:
        raise OwnerChatError("Nachricht ist zu lang.", status_code=422)
    if len(bilder) > MAX_BILDER:
        raise OwnerChatError(
            f"Höchstens {MAX_BILDER} Bilder je Nachricht.", status_code=422
        )
    for pfad in bilder:
        # Wurzel 3: Die Pfade kommen vom Client. Ohne diese Prüfung könnte ein
        # Nutzer den Pfad eines FREMDEN Mandanten an seine Nachricht hängen —
        # er läge danach dauerhaft in `attachments`, ginge an alle Teilnehmer
        # und würde vom Adress-Endpunkt signiert. Geprüft wird die FORM, die
        # `bilder.hochladen` selbst erzeugt.
        bilder_modul.pfad_pruefen(pfad, tenant_id)
    if not chiffre and not bilder:
        raise OwnerChatError("Nachricht ist leer.", status_code=422)
    if not sender_key:
        # Ohne den öffentlichen Schlüssel des Absenders kann KEIN Empfänger das
        # gemeinsame Geheimnis bilden — die Nachricht wäre für alle unlesbar,
        # ohne dass irgendetwas fehlschlägt. Genau der stille Fehler aus
        # Wurzel 5, deshalb hier hart abgewiesen statt mit leerem Feld abgelegt
        # (Wurzel 4: kein Ersatzwert).
        raise OwnerChatError(
            "Absender-Schlüssel fehlt — bitte den Chat neu einrichten.",
            status_code=422,
        )
    _absender_schluessel_pruefen(db, tenant_id, user_id, sender_key)

    zeilen = _schluessel_pruefen(geraete, schluessel)

    nachricht = (
        db.table("owner_messages")
        .insert(
            {
                "tenant_id": tenant_id,
                "thread_id": thread_id,
                "sender": seite,
                "sender_user_id": user_id,
                "sender_name": sender_name,
                "body": chiffre,
                "sender_key": sender_key,
                "attachments": bilder,
            }
        )
        .execute()
    ).data or []
    if not nachricht:
        raise OwnerChatError("Nachricht konnte nicht gespeichert werden.", 500)
    message_id = str(nachricht[0]["id"])

    if zeilen:
        db.table("owner_message_keys").insert(
            [{"message_id": message_id, **z} for z in zeilen]
        ).execute()

    # Der Thread-Kopf trägt die Sortierung der Liste (Wurzel 1: der
    # Gegenzustand zur neuen Nachricht). Ohne ihn stünde ein Gespräch mit
    # frischer Nachricht weiterhin unten.
    db.table("owner_threads").update(
        {"last_message_at": nachricht[0]["sent_at"]}
    ).eq("id", thread_id).eq("tenant_id", tenant_id).execute()

    return nachricht[0]


def gelesen_setzen(
    db: Client, tenant_id: str, thread_id: str, *, seite: str
) -> None:
    """Lesestand EINER Seite setzen."""
    spalte = "owner_read_at" if seite == "owner" else "agency_read_at"
    db.table("owner_threads").update({spalte: "now()"}).eq("id", thread_id).eq(
        "tenant_id", tenant_id
    ).execute()


def geraet_gesehen(db: Client, tenant_id: str, device_id: str) -> None:
    """`zuletzt_aktiv` nachziehen — best effort.

    WOZU: Das Feld hieß „zuletzt aktiv", wurde aber NUR beim Registrieren
    gesetzt. In der Geräteliste — laut ihrem eigenen Zweck der einzige Schutz
    gegen einen untergeschobenen Mitleser — stand damit das Anlagedatum unter
    einer Überschrift, die etwas anderes verspricht (Wurzel 5b: unsere Uhr ist
    nicht der Zeitpunkt, den sie behauptet).

    Der Verlaufsabruf ist der ehrliche Moment: Dann hat dieses Gerät
    nachweislich gelesen. Fehlschläge werden geschluckt — ein Zeitstempel darf
    kein Gespräch kippen.
    """
    try:
        db.table("owner_chat_devices").update({"zuletzt_aktiv": "now()"}).eq(
            "id", device_id
        ).eq("tenant_id", tenant_id).execute()
    except Exception as exc:  # noqa: BLE001 — best effort, kippt nichts
        log.info(
            "owner_chat_aktivitaet_nicht_notiert",
            extra={"tenant_id": tenant_id, "fehler": str(exc)[:120]},
        )


def eigenes_geraet(
    db: Client, tenant_id: str, user_id: str, device_id: str | None
) -> str | None:
    """Gehört `device_id` diesem Nutzer? Sonst `None`.

    WOZU (Wurzel 3/9): `device_id` kommt als freier Query-Parameter. Ohne diese
    Prüfung konnte ein Nutzer mit legitimem Thread-Zugang die verpackten
    Schlüssel eines FREMDEN Geräts abrufen — auch aus einem anderen Mandanten,
    weil der Filter nur auf `device_id` lief. Öffnen kann er sie ohne den
    privaten Schlüssel nicht, aber es ist Krypto-Material, und wer es sammelt,
    braucht bei einem später kompromittierten Gerät keine Zuordnung mehr.

    `None` statt eines Fehlers: Ein unbekanntes Gerät bedeutet schlicht „keine
    Schlüssel für dich" — der Verlauf kommt dann als nicht lesbar zurück, und
    genau das ist die Wahrheit.
    """
    if not device_id:
        return None
    treffer = (
        db.table("owner_chat_devices")
        .select("id")
        .eq("id", device_id)
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        # GESPERRTE Geräte bekommen nichts mehr (Wurzel 1): Die bereits
        # verpackten Schlüssel bleiben in der DB stehen — sonst rissen Lücken
        # bei den übrigen Geräten. Sie über die API aktiv NACHZULIEFERN ist
        # aber etwas anderes: Wer sein Handy als verloren meldet, erwartet,
        # dass der Dieb ab jetzt nichts Neues mehr abholt.
        .is_("gesperrt_am", "null")
        .limit(1)
        .execute()
    ).data or []
    return device_id if treffer else None


def verlauf_lesen(
    db: Client,
    tenant_id: str,
    thread_id: str,
    *,
    device_id: str | None,
    limit: int = 200,
) -> tuple[list[dict], int]:
    """Nachrichten samt dem Schlüssel FÜR DIESES GERÄT.

    Gibt `(nachrichten, nicht_lesbar)` zurück. Fehlt zu einer Nachricht der
    verpackte Schlüssel, ist sie älter als das Gerät — sie wird MITGEZÄHLT und
    mit `wrapped_key=None` ausgeliefert, statt still zu verschwinden. Eine
    Lücke, die niemand sieht, ist der Fehler aus Wurzel 5; so kann die
    Oberfläche einen Hinweis zeigen und die Freigabe anbieten.
    """
    zeilen = (
        db.table("owner_messages")
        .select(
            "id, sender, sender_name, body, sender_key, attachments, sent_at"
        )
        .eq("tenant_id", tenant_id)
        .eq("thread_id", thread_id)
        .order("sent_at")
        .limit(limit)
        .execute()
    ).data or []
    if not zeilen:
        return [], 0

    passend: dict[str, str] = {}
    if device_id:
        schluessel = (
            db.table("owner_message_keys")
            .select("message_id, wrapped_key, wrapper_key")
            .eq("device_id", device_id)
            .in_("message_id", [str(z["id"]) for z in zeilen])
            .execute()
        ).data or []
        passend = {str(z["message_id"]): z for z in schluessel}

    if device_id:
        geraet_gesehen(db, tenant_id, device_id)

    nicht_lesbar = sum(1 for z in zeilen if str(z["id"]) not in passend)
    for z in zeilen:
        eintrag = passend.get(str(z["id"])) or {}
        z["wrapped_key"] = eintrag.get("wrapped_key")
        # Gegen WEN ist dieser Schlüssel zu öffnen (0614)? Leer heißt: gegen
        # den ursprünglichen Absender. Gefüllt bei einer Freigabe, wo ein
        # drittes Gerät verpackt hat — ohne diese Angabe bildete der Empfänger
        # das falsche Geheimnis und bekäme die Nachricht nie auf.
        z["wrapper_key"] = eintrag.get("wrapper_key") or None
    return zeilen, nicht_lesbar


def faeden_zu_objekten(
    db: Client, tenant_id: str, property_ids: list[str]
) -> list[dict]:
    """Gesprächsfäden zu den Objekten, die dieser Nutzer sehen darf.

    Der Scope kommt vom Aufrufer (er kennt die Objekte des Nutzers) — hier
    wird nur danach gefiltert. Ohne Objekte gibt es nichts: eine leere Liste,
    nie „alle" (fail-closed, Wurzel 6).
    """
    if not property_ids:
        return []
    return (
        db.table("owner_threads")
        .select("id, property_id, last_message_at, owner_read_at")
        .eq("tenant_id", tenant_id)
        .in_("property_id", property_ids)
        .order("last_message_at", desc=True)
        .limit(MAX_FAEDEN)
        .execute()
    ).data or []
