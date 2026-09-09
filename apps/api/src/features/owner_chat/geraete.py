"""Geräteschlüssel registrieren, sperren, wiederherstellen (ADR-0029).

Der Server verwaltet hier ausschließlich ÖFFENTLICHE Schlüssel. Der private
Teil entsteht auf dem Gerät, liegt in Keychain bzw. Android Keystore und
verlässt es nie — es gibt keinen Endpunkt, der ihn entgegennähme.

WARUM DIE SIGNATUR BEIM REGISTRIEREN (Wurzel 3): Ohne sie könnte jeder
angemeldete Nutzer einen beliebigen öffentlichen Schlüssel eintragen und würde
fortan bei jeder Nachricht mitverschlüsselt — ein Mitleser, den niemand sieht.
Die Signatur über eine servergestellte Aufgabe belegt, dass der Registrierende
den zugehörigen privaten Schlüssel wirklich besitzt.
"""
from __future__ import annotations

import base64
import secrets
from datetime import UTC, datetime
from typing import Any, Final

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from supabase import Client

from src.core.logging import get_logger

from .fehler import OwnerChatError

log = get_logger(__name__)

# Ein Mensch mit mehr als so vielen Geräten ist kein Nutzer mehr, sondern ein
# Verteiler — jedes weitere Gerät liest sämtliche künftigen Nachrichten mit
# (Wurzel 8: jeder unbegrenzte Bereich bekommt eine Obergrenze).
MAX_GERAETE_JE_NUTZER: Final = 5

# Gültigkeit der Registrierungs-Aufgabe. Kurz, weil sie nur die Zeit zwischen
# Abholen und Antworten überbrücken muss.
AUFGABE_GUELTIG_SEKUNDEN: Final = 300


def _b64(wert: str, feld: str) -> bytes:
    """Base64 dekodieren — fehlerhafte Eingabe ist 422, nie ein 500.

    Der Wert kommt vom Client (Wurzel 5: angreiferkontrollierter Input darf
    keinen Serverfehler erzeugen).
    """
    try:
        roh = base64.b64decode(wert, validate=True)
    except Exception as exc:  # noqa: BLE001 — jede Dekodier-Ausnahme ist 422
        raise OwnerChatError(f"{feld} ist nicht lesbar.", status_code=422) from exc
    if not roh:
        raise OwnerChatError(f"{feld} fehlt.", status_code=422)
    return roh


def aufgabe_erzeugen(db: Client, tenant_id: str, user_id: str) -> str:
    """Zufallswert, den das Gerät signieren muss, um sich zu registrieren.

    Abgelegt wird er am Nutzer, damit die Antwort gegen GENAU diese Aufgabe
    geprüft wird — nicht gegen einen frei mitgeschickten Wert (Wurzel 3).
    """
    aufgabe = secrets.token_urlsafe(32)
    db.table("owner_chat_aufgaben").upsert(
        {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "aufgabe": aufgabe,
            "erzeugt_am": "now()",
        },
        on_conflict="user_id",
    ).execute()
    return aufgabe


def _abgelaufen(erzeugt_am: object) -> bool:
    """Ist die Aufgabe älter als ihre Gültigkeit?

    Fail-CLOSED (Wurzel 5): ein unlesbarer Zeitstempel gilt als abgelaufen.
    Die Gegenrichtung — „im Zweifel noch gültig" — hieße, dass ein defekter
    Wert die zeitliche Begrenzung stillschweigend aufhebt.
    """
    if not isinstance(erzeugt_am, str) or not erzeugt_am:
        return True
    try:
        gesetzt = datetime.fromisoformat(erzeugt_am.replace("Z", "+00:00"))
    except ValueError:
        return True
    if gesetzt.tzinfo is None:
        gesetzt = gesetzt.replace(tzinfo=UTC)
    alter = (datetime.now(UTC) - gesetzt).total_seconds()
    return alter > AUFGABE_GUELTIG_SEKUNDEN


def _aufgabe_pruefen(
    db: Client, tenant_id: str, user_id: str, signatur_b64: str, signing_key_b64: str
) -> None:
    """Signatur über die servergestellte Aufgabe prüfen und sie verbrauchen."""
    zeilen = (
        db.table("owner_chat_aufgaben")
        .select("aufgabe, erzeugt_am")
        .eq("user_id", user_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise OwnerChatError(
            "Keine offene Registrierung — bitte neu beginnen.", status_code=409
        )
    aufgabe = str(zeilen[0].get("aufgabe") or "")
    if not aufgabe:
        raise OwnerChatError("Registrierung ungültig.", status_code=409)
    if _abgelaufen(zeilen[0].get("erzeugt_am")):
        # Abgelaufene Aufgaben werden entfernt, nicht bloß abgelehnt — sonst
        # bliebe die Zeile liegen und der nächste Versuch liefe erneut in
        # denselben Fehler.
        db.table("owner_chat_aufgaben").delete().eq("user_id", user_id).eq(
            "tenant_id", tenant_id
        ).execute()
        raise OwnerChatError(
            "Registrierung ist abgelaufen — bitte neu beginnen.",
            status_code=409,
        )

    schluessel = _b64(signing_key_b64, "Signaturschlüssel")
    signatur = _b64(signatur_b64, "Signatur")
    try:
        Ed25519PublicKey.from_public_bytes(schluessel).verify(
            signatur, aufgabe.encode("utf-8")
        )
    except InvalidSignature as exc:
        # Fail-closed (Wurzel 5): eine ungültige Signatur ist kein Grund,
        # das Gerät „zur Sicherheit" trotzdem einzutragen.
        raise OwnerChatError("Signatur stimmt nicht.", status_code=403) from exc
    except ValueError as exc:
        raise OwnerChatError(
            "Signaturschlüssel hat die falsche Länge.", status_code=422
        ) from exc

    # Einmal verwendet, verbraucht (Wurzel 2): sonst registrierte dieselbe
    # abgefangene Signatur beliebig viele weitere Geräte.
    db.table("owner_chat_aufgaben").delete().eq("user_id", user_id).eq(
        "tenant_id", tenant_id
    ).execute()


def geraet_registrieren(
    db: Client,
    tenant_id: str,
    user_id: str,
    *,
    seite: str,
    public_key: str,
    signing_key: str,
    signatur: str,
    geraet_name: str,
) -> dict[str, Any]:
    """Öffentliche Schlüssel eines Geräts eintragen."""
    if seite not in ("owner", "agency"):
        raise OwnerChatError("Unbekannte Seite.", status_code=422)
    name = (geraet_name or "").strip()[:80]
    if not name:
        raise OwnerChatError("Gerätename fehlt.", status_code=422)

    # Länge vor der Signaturprüfung: X25519 ist immer 32 Byte, und eine
    # abweichende Länge ist ein Eingabefehler, kein Krypto-Fehler.
    if len(_b64(public_key, "Schlüssel")) != 32:
        raise OwnerChatError("Schlüssel hat die falsche Länge.", status_code=422)

    _aufgabe_pruefen(db, tenant_id, user_id, signatur, signing_key)

    aktive = (
        db.table("owner_chat_devices")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .is_("gesperrt_am", "null")
        .execute()
    ).data or []
    if len(aktive) >= MAX_GERAETE_JE_NUTZER:
        raise OwnerChatError(
            "Zu viele Geräte — bitte zuerst ein altes entfernen.",
            status_code=409,
        )

    angelegt = (
        db.table("owner_chat_devices")
        .insert(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "seite": seite,
                "public_key": public_key,
                "signing_key": signing_key,
                "geraet_name": name,
                "zuletzt_aktiv": "now()",
            }
        )
        .execute()
    ).data or []
    if not angelegt:
        raise OwnerChatError("Gerät konnte nicht angelegt werden.", 500)
    log.info(
        "owner_chat_geraet_registriert",
        extra={"tenant_id": tenant_id, "user_id": user_id, "seite": seite},
    )
    return angelegt[0]


def geraete_lesen(db: Client, tenant_id: str, user_id: str) -> list[dict]:
    """Die eigenen Geräte — damit der Nutzer sieht, WAS mitliest.

    Ohne diese Liste bliebe ein zusätzlich eingetragenes Gerät unsichtbar. Die
    Anzeige ist der Teil des Schutzes, den Kryptografie nicht leisten kann.
    """
    return (
        db.table("owner_chat_devices")
        .select("id, geraet_name, seite, gesperrt_am, zuletzt_aktiv, created_at")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    ).data or []


def geraet_sperren(
    db: Client, tenant_id: str, user_id: str, device_id: str
) -> None:
    """Ein eigenes Gerät sperren (verloren, verkauft, gestohlen).

    KEIN Löschen (Wurzel 1): die bereits verpackten Schlüssel bleiben stehen,
    sonst risse `on delete cascade` Lücken in Nachrichten, die andere Geräte
    noch lesen. Gesperrt heißt: ab jetzt keine NEUEN Schlüssel mehr.

    Wurzel 9: `user_id` steht in der Bedingung — sonst sperrte ein Nutzer per
    ID das Gerät eines Kollegen.
    """
    treffer = (
        db.table("owner_chat_devices")
        .update({"gesperrt_am": "now()"})
        .eq("id", device_id)
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .execute()
    ).data or []
    if not treffer:
        raise OwnerChatError("Gerät nicht gefunden.", status_code=404)
    log.info(
        "owner_chat_geraet_gesperrt",
        extra={"tenant_id": tenant_id, "user_id": user_id},
    )


def wiederherstellung_ablegen(
    db: Client,
    tenant_id: str,
    user_id: str,
    *,
    wrapped_identity: str,
    kdf_params: dict,
) -> None:
    """Den mit dem Sicherungscode verschlüsselten Identitätsschlüssel ablegen.

    Der CODE kommt hier nie an — er bleibt auf dem Zettel des Nutzers. Wir
    speichern nur die Hülle, die ohne ihn wertlos ist.
    """
    _b64(wrapped_identity, "Sicherung")
    if not isinstance(kdf_params, dict) or not kdf_params:
        raise OwnerChatError("Sicherungsparameter fehlen.", status_code=422)
    db.table("owner_chat_recovery").upsert(
        {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "wrapped_identity": wrapped_identity,
            "kdf_params": kdf_params,
            "updated_at": "now()",
        },
        on_conflict="user_id",
    ).execute()


def wiederherstellung_lesen(
    db: Client, tenant_id: str, user_id: str
) -> dict | None:
    """Die Hülle zurückgeben — aufmachen kann sie nur der Nutzer mit Code."""
    zeilen = (
        db.table("owner_chat_recovery")
        .select("wrapped_identity, kdf_params")
        .eq("user_id", user_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    return zeilen[0] if zeilen else None
