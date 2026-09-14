"""Der Standard-Regelsatz, den ein NEUER Betrieb bei der Anlage mitbekommt.

ANLASS (14.09.2026): Ein frisch registrierter Betrieb hatte null Automail-
Regeln. Der Posteingang zeigte eine leere Liste, der Automatisierungs-Tab eine
leere Liste, und der erste Gast bekam nichts — obwohl der ganze Apparat
(Planung, Versand, Sprachfassungen) dahintersteht. Die Hürde war nicht das
Können, sondern das leere Blatt: wer nie eine Automail-Regel gesehen hat,
schreibt keine.

WARUM DIE REGELN INAKTIV ANGELEGT WERDEN (`is_active = False`)
--------------------------------------------------------------
Weil wir sonst im Namen des Betriebs Nachrichten an fremde Gäste schicken
würden, die er nie gelesen hat. Ein Vorschlag ist etwas anderes als eine
Entscheidung. Inaktiv heißt: die Regel steht sichtbar in der Liste, mit Text,
Zeitpunkt und Platzhaltern, und ein Schalter macht sie scharf. `planung`
überspringt inaktive Regeln, es entsteht also auch keine geplante Nachricht.

WARUM `property_ids`/`channels` LEER BLEIBEN
-------------------------------------------
Leer heißt „alle" (`automation_payload` schreibt daraus NULL). Beim Anlegen
eines Betriebs gibt es noch kein Objekt und keinen verbundenen Kanal — eine
Auswahl wäre hier kein Vorbehalt, sondern eine Erfindung (Wurzel 4).

WARUM DER TEXT ZWEIMAL GESCHRIEBEN WIRD
---------------------------------------
Einmal als GRUNDFASSUNG (`message_automation.message`/`subject`) und einmal als
SPRACHFASSUNG (`message_automation_text`, 0363). Ohne die Grundfassung bekäme
ein Gast, dessen Sprache nicht gepflegt ist, gar nichts — `fassung_waehlen`
fällt am Ende genau dorthin zurück. Ohne die Sprachfassung stünde der Text im
Sprach-Reiter der Maske nicht und wäre je Sprache nicht pflegbar.

IDEMPOTENT (Wurzel 2)
---------------------
Gibt es im Betrieb schon IRGENDEINE Regel, passiert nichts. Die Anlage kann
wiederholt werden (Retry der Registrierung, manueller Nachtrag im Backoffice),
ohne dass ein zweiter Satz entsteht — und eine vom Betrieb GELÖSCHTE Regel wird
nicht wieder herbeigeschrieben, solange noch eine andere steht.
"""
from __future__ import annotations

from typing import Final

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_texte import text as mail_text

from .automation_mapping import automation_payload
from .schemas import AutomationText, AutomationUpsert
from .sprachen import automation_texte_schreiben

log = get_logger("nextdays.inbox")

# Die vier Regeln: (trigger, Betrag des Versatzes, Einheit, Uhrzeit).
#
# Das VORZEICHEN steht hier bewusst NICHT: es gehört dem Auslöser
# (`ausloeser.versatz_normieren`, 0307) und wird von `automation_payload`
# gesetzt. Eine −1 hier wäre eine zweite Wahrheit über die Richtung.
#
# `booking_new` bekommt +5 Minuten statt 0: die Buchung ist im Moment des
# Eingangs noch nicht fertig verarbeitet (Gastdaten, Objektzuordnung, Preis),
# und ein Platzhalter ohne Wert lässt den Versand scheitern (`felder.FeldFehlt`).
# Fünf Minuten sind für den Gast sofort und für uns ein vollständiger Datensatz.
#
# `send_time` steht in der ZEITZONE DES OBJEKTS (`use_property_timezone`), nicht
# in UTC: „18:00" meint 18:00 dort, wo das Haus steht. Ohne das verschöbe sich
# eine Anreise-Erinnerung je nach Jahreszeit um ein bis zwei Stunden.
REGELN: Final[tuple[tuple[str, int, str, str | None], ...]] = (
    ("booking_new", 5, "minutes", None),
    ("before_checkin", 1, "days", "18:00"),
    ("on_checkin", 0, "days", "06:00"),
    ("on_checkout", 0, "days", "11:00"),
)


def _regel(trigger: str, betrag: int, einheit: str, uhrzeit: str | None,
           sprache: str) -> AutomationUpsert:
    """Eine Regel als Upsert-Modell — Texte aus dem Mailkatalog."""
    return AutomationUpsert(
        name=mail_text(f"standardregeln.{trigger}.name", sprache),
        trigger=trigger,
        offset_unit=einheit,
        offset_value=betrag,
        offset_days=betrag if einheit == "days" else 0,
        send_time=uhrzeit,
        subject=mail_text(f"standardregeln.{trigger}.betreff", sprache),
        message=mail_text(f"standardregeln.{trigger}.text", sprache),
        # Kein Vorschlag ist eine Entscheidung: der Betrieb schaltet selbst ein.
        is_active=False,
        # Nur wo es eine Uhrzeit gibt, ist eine Zeitzone eine Aussage. Bei
        # „+5 Minuten nach der Buchung" bestimmt der Versatz die Zeit ohnehin.
        use_property_timezone=True,
    )


def standard_regeln_anlegen(db: Client, tenant_id: str, sprache: str) -> int:
    """Den Standard-Regelsatz anlegen. Gibt die Zahl der neuen Regeln zurück.

    `sprache` ist ein bereits aufgelöster Code (`core.mail_sprache`); ein
    unbekannter fällt im Katalog auf `FALLBACK` zurück, statt zu werfen.

    Wirft NICHT bei „schon vorhanden" — das ist kein Fehler, sondern der
    Normalfall beim zweiten Aufruf.
    """
    vorhanden = (
        db.table("message_automation")
        .select("id")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if vorhanden:
        log.info("standardregeln_uebersprungen", tenant_id=tenant_id)
        return 0

    angelegt = 0
    for trigger, betrag, einheit, uhrzeit in REGELN:
        req = _regel(trigger, betrag, einheit, uhrzeit, sprache)
        ins = (
            db.table("message_automation")
            .insert({"tenant_id": tenant_id, **automation_payload(req)})
            .execute()
        ).data or []
        if not ins:
            # Kein stilles Weiterzählen: eine Regel, die nicht entstanden ist,
            # darf nicht als angelegt gemeldet werden (Wurzel 5).
            log.error("standardregel_ohne_zeile", tenant_id=tenant_id, trigger=trigger)
            continue
        automation_texte_schreiben(
            db,
            tenant_id,
            str(ins[0]["id"]),
            [AutomationText(lang=sprache, subject=req.subject,
                            message=req.message or "")],
        )
        angelegt += 1
    log.info("standardregeln_angelegt", tenant_id=tenant_id,
             sprache=sprache, anzahl=angelegt)
    return angelegt
