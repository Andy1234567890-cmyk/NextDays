"""Wer erfaehrt von einem Sperrantrag — und wovon genau.

Ausgelagert aus `sperrantraege.py`, das mit dem Aufhebungswunsch (0513) ueber
1500 Zeilen gewachsen war. Der Schnitt ist nicht willkuerlich: Benachrichtigung
ist eine andere Frage als der Zustandsautomat. Der Service entscheidet, WAS mit
einem Antrag passiert; hier steht, WER davon erfaehrt.

Beide Funktionen sind best-effort (Wurzel 5): der Vorgang ist gespeichert und
darf nicht verloren gehen, weil der Versand klemmt. Der Empfaengerkreis liegt
bewusst hier und nicht im public_portal-Slice — es ist eine Frage der
Capability-Matrix (wer darf entscheiden?), dieselbe Bedingung wie der Guard am
Endpunkt, und die Rolle kommt aus der DB, nicht aus einem JWT (Wurzel 7).
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text as mail_text
from src.features.auth.permissions import Capability, has_capability
from src.features.auth.schemas import UserRole

log = get_logger("nextdays.calendar.sperrantrag_meldung")


def melde_neuen_antrag(
    db: Client, tenant_id: str, antrag: dict, titel: str
) -> None:
    """Die Entscheider des Mandanten über einen NEUEN Antrag informieren.

    Liegt hier statt im public_portal, weil der Empfängerkreis eine Frage der
    Capability-Matrix ist (wer darf entscheiden?) und nicht der Portal-Sicht.

    Empfänger sind die Nutzer des Mandanten, deren ROLLE die Capability
    APPROVE_BLOCK trägt — dieselbe Bedingung wie der Guard am Endpunkt. Die
    Rolle kommt aus der DB, nicht aus einem JWT (Wurzel 7): der Antragsteller
    hat mit den Rollen der anderen nichts zu tun.

    Best-effort (Wurzel 5): der Antrag ist gespeichert; er darf nicht verloren
    gehen, weil der Versand klemmt.
    """
    try:
        rows = (
            db.table("users")
            .select("id, role")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        empfaenger = [
            str(r["id"]) for r in rows if _darf_entscheiden(r.get("role"))
        ]
        if not empfaenger:
            log.info("sperrantrag_ohne_entscheider", tenant_id=tenant_id)
            return
        from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
            NotificationDispatcher,
        )

        dispatcher = NotificationDispatcher(db)
        zeitraum = f"{antrag['start_date']} – {antrag['end_date']}"
        grund = (antrag.get("reason") or "").strip()
        werte: dict[str, object] = {"titel": titel, "zeitraum": zeitraum}
        # Die Begründung ist OPTIONAL und darum ein zweiter Absatz, kein
        # Satzende im Rumpf: fehlt sie, darf kein leeres „Begründung:"
        # dastehen (gleiche Regel wie bei der Anmerkung der Entscheidung).
        rumpf_keys = ["sperrantrag.rumpf_neu"]
        if grund:
            rumpf_keys.append("sperrantrag.begruendung")
            werte["grund"] = grund
        for nutzer in empfaenger:
            dispatcher.sende(
                user_id=nutzer,
                schluessel="block_request",
                # Glocke: fertiger Satz in der Ausweichsprache — die Oberfläche
                # bekommt keinen Schlüssel, sondern den gerenderten Text.
                betreff=mail_text("sperrantrag.neu", FALLBACK, **werte),
                text="\n\n".join(
                    mail_text(k, FALLBACK, **werte) for k in rumpf_keys
                ),
                # Mail/SMS: Schlüssel — der Dispatcher übersetzt sie in die
                # Sprache des Empfängers. Vorher stand hier ein hart deutscher
                # f-String, der jeden Entscheider unabhängig von seiner
                # Sprachwahl auf Deutsch anschrieb.
                betreff_key="sperrantrag.neu",
                betreff_werte=werte,
                text_key=rumpf_keys,
                text_werte=werte,
                tenant_id=tenant_id,
                property_id=str(antrag["property_id"]),
                ziel_pfad="/kalender/sperrantraege",
                dedup_key=f"block_request:{antrag['id']}",
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, siehe Docstring
        log.warning(
            "sperrantrag_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            error=str(exc)[:200],
        )


def melde_aufhebungswunsch(
    db: Client, tenant_id: str, antrag: dict, titel: str
) -> None:
    """Die Entscheider ueber einen AUFHEBUNGSWUNSCH informieren (0513).

    Eigene Funktion und nicht `melde_neuen_antrag` mit einem Flag: es ist eine
    andere Nachricht mit einer anderen Dringlichkeit. „Moechte sperren" laesst
    Zeit; „moechte die Sperrung aufheben" bedeutet, dass Naechte im Verkauf
    fehlen, die niemand mehr braucht — jeder Tag ohne Entscheidung ist ein Tag
    ohne Verkaufsmoeglichkeit.

    Eigener `dedup_key`: sonst unterdrueckte die Entdopplung die Meldung, weil
    zu diesem Antrag schon eine verschickt wurde (Wurzel 2 darf nicht dazu
    fuehren, dass ein ZWEITES, anderes Ereignis verschluckt wird).

    Best-effort wie die Schwesterfunktion: der Wunsch ist gespeichert.
    """
    try:
        rows = (
            db.table("users")
            .select("id, role")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        empfaenger = [
            str(r["id"]) for r in rows if _darf_entscheiden(r.get("role"))
        ]
        if not empfaenger:
            log.info("aufhebung_ohne_entscheider", tenant_id=tenant_id)
            return
        from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
            NotificationDispatcher,
        )

        dispatcher = NotificationDispatcher(db)
        zeitraum = f"{antrag['start_date']} – {antrag['end_date']}"
        grund = (antrag.get("aufhebung_grund") or "").strip()
        werte: dict[str, object] = {"titel": titel, "zeitraum": zeitraum}
        rumpf_keys = ["sperrantrag.rumpf_aufhebung"]
        if grund:
            rumpf_keys.append("sperrantrag.begruendung")
            werte["grund"] = grund
        for nutzer in empfaenger:
            dispatcher.sende(
                user_id=nutzer,
                schluessel="block_request",
                betreff=mail_text("sperrantrag.aufhebung", FALLBACK, **werte),
                text="\n\n".join(
                    mail_text(k, FALLBACK, **werte) for k in rumpf_keys
                ),
                betreff_key="sperrantrag.aufhebung",
                betreff_werte=werte,
                text_key=rumpf_keys,
                text_werte=werte,
                tenant_id=tenant_id,
                property_id=str(antrag["property_id"]),
                ziel_pfad="/kalender/sperrantraege",
                dedup_key=f"block_request_aufhebung:{antrag['id']}",
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, siehe Docstring
        log.warning(
            "aufhebung_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            error=str(exc)[:200],
        )


def _darf_entscheiden(role: str | None) -> bool:
    """Trägt diese Rolle die Capability APPROVE_BLOCK? Fail-closed (Wurzel 6):
    eine unbekannte oder fehlende Rolle bekommt nichts."""
    if not role:
        return False
    try:
        rolle = UserRole(role)
    except ValueError:
        return False
    return has_capability(rolle, Capability.APPROVE_BLOCK)
