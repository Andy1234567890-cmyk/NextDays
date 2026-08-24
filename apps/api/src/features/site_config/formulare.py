"""Formular-Einsendungen einer Kunden-Website (0436, Etappe F).

Zwei Wege, und sie sind bewusst getrennt:

* **Absenden** — öffentlich, ohne JWT. Ein Gast tippt etwas in ein Formular auf
  einer Kundenseite. Das ist der einzige Weg im ganzen Slice, auf dem ein
  FREMDER schreibt, und er ist entsprechend eng: Host-Auflösung, Block muss
  existieren und veröffentlicht sein, Pflichtfelder werden serverseitig geprüft,
  Größe gedeckelt, Ratelimit.
* **Lesen und löschen** — nur mit ``MANAGE_SITE_CONFIG``. Die Zeilen enthalten
  personenbezogene Daten Dritter; die Tabelle hat für ``anon``/``authenticated``
  KEIN Grant (siehe 0436), also gibt es keinen anderen Weg als diesen.

Was hier NICHT passiert: E-Mail versenden. Das ist der Job des Mail-Slice, und
der Aufruf gehört an die Stelle, die auch die Fehlschläge behandelt. Diese
Funktionen speichern und geben zurück, was gespeichert wurde — der Aufrufer
entscheidet über die Benachrichtigung.
"""

from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger

from .fehler import SiteConfigError
from .schemas import FormContent, FormFieldType

log = get_logger("nextdays.site_config.formulare")

_COLS = "id, block_id, form_name, daten, created_at, is_read"

# Höchstlänge eines einzelnen Feldwerts. Ein Freitextfeld ohne Deckel ist ein
# unbegrenzter Bereich (Wurzel 8): ein Skript kann damit Megabyte in die
# Datenbank schreiben, und der CHECK auf die Zeilengröße würde erst danach
# greifen — mit einem 500 statt einer verständlichen Meldung.
MAX_WERT_LAENGE = 5_000

# Höchstzahl der Einsendungen, die die Liste auf einmal liefert.
MAX_LISTE = 200


def _text(wert: object) -> str:
    """Einen eingesendeten Wert als Text — gekürzt, getrimmt.

    Alles wird zu Text: das Formular des Kunden hat keine Typinformation, die
    über die Feldart hinausgeht, und eine Zahl als Zahl zu speichern hieße, beim
    CSV-Export wieder zu raten. Für die Auswertung („Wie viele Personen?")
    genügt der Text.
    """
    if wert is None:
        return ""
    if isinstance(wert, bool):
        # Ein Häkchen wird zu „ja"/„" — nicht zu „True"/„False". Der Betrieb
        # liest das, nicht ein Programm.
        return "ja" if wert else ""
    return str(wert).strip()[:MAX_WERT_LAENGE]


def einsendung_pruefen(inhalt: FormContent, daten: dict) -> dict:
    """Die Eingaben gegen die Felddefinition prüfen und normalisieren.

    Serverseitig, obwohl der Browser dasselbe prüft: die Browser-Prüfung ist
    eine Bequemlichkeit für den Gast, keine Kontrolle. Ein POST direkt auf den
    Endpunkt umgeht sie vollständig.

    Was geprüft wird:

    * Pflichtfelder sind gefüllt. Bei ``consent`` heißt das: das Häkchen ist
      gesetzt — ohne Zustimmung darf die Einsendung nicht gespeichert werden,
      und ein „ist ja nur ein Häkchen" wäre hier ein Rechtsverstoß.
    * Unbekannte Feldnamen fliegen WEG. Ein Angreifer, der zusätzliche Felder
      mitschickt, soll damit nicht die Antwortenliste des Betriebs füllen.
    * Jeder Wert wird zu getrimmtem, gekürztem Text.
    """
    erlaubt = {f.name: f for f in inhalt.fields}
    sauber: dict[str, str] = {}
    fehlend: list[str] = []

    for name, feld in erlaubt.items():
        wert = _text(daten.get(name))
        if feld.required and not wert:
            fehlend.append(name)
        if wert:
            sauber[name] = wert

    if fehlend:
        # Die Feldnamen und nicht die Beschriftungen: die Beschriftung ist
        # mehrsprachig, und der Aufrufer weiß, in welcher Sprache er antwortet.
        raise SiteConfigError(
            "Pflichtfelder fehlen: " + ", ".join(fehlend), status_code=422
        )

    # Die Zustimmung noch einmal ausdrücklich, unabhängig von `required`: ein
    # Consent-Feld ohne Häkchen ist NIE gültig, auch wenn der Betrieb es
    # versehentlich als optional angelegt hat.
    for feld in inhalt.fields:
        if feld.type is FormFieldType.consent and not sauber.get(feld.name):
            raise SiteConfigError(
                "Ohne Zustimmung zur Datenverarbeitung kann das Formular nicht "
                "gesendet werden.",
                status_code=422,
            )
    return sauber


def speichern(
    db: Client,
    tenant_id: str,
    block_id: str,
    inhalt: FormContent,
    daten: dict,
) -> dict:
    """Eine geprüfte Einsendung speichern.

    Der Rückgabewert ist die gespeicherte Zeile — der Aufrufer braucht sie für
    die Benachrichtigung und für die Antwort an den Gast.
    """
    sauber = einsendung_pruefen(inhalt, daten)
    rows = (
        db.table("site_form_submissions")
        .insert(
            {
                "tenant_id": tenant_id,
                "block_id": block_id,
                "form_name": inhalt.form_name,
                "daten": sauber,
            }
        )
        .execute()
    ).data or []
    if not rows:
        raise SiteConfigError(
            "Die Anfrage konnte nicht gespeichert werden.", status_code=500
        )
    log.info(
        "site_form_submission",
        tenant_id=tenant_id,
        block_id=block_id,
        felder=sorted(sauber.keys()),
    )
    return rows[0]


def liste(db: Client, tenant_id: str, *, limit: int = 50, offset: int = 0) -> dict:
    """Einsendungen des Betriebs, neueste zuerst.

    Der Deckel ist hart: ein Client, der ``limit=100000`` schickt, darf keine
    unbegrenzte Antwort auslösen (Wurzel 8).
    """
    limit = max(1, min(limit, MAX_LISTE))
    offset = max(0, offset)
    rows = (
        db.table("site_form_submissions")
        .select(_COLS)
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    ).data or []
    return {
        "items": [
            {
                "id": str(r["id"]),
                "block_id": str(r["block_id"]) if r.get("block_id") else None,
                "form_name": r.get("form_name"),
                "daten": r.get("daten") or {},
                "created_at": str(r["created_at"]) if r.get("created_at") else None,
                "is_read": bool(r.get("is_read")),
            }
            for r in rows
        ],
        "total": len(rows),
    }


def als_gelesen(db: Client, tenant_id: str, submission_id: str) -> None:
    """Eine Einsendung als gelesen markieren.

    Per ``(id, tenant_id)`` und nicht per ID allein (Wurzel 3): Service-Role
    umgeht RLS, und ohne den Tenant im Filter könnte ein Betrieb die Einsendung
    eines anderen markieren.
    """
    rows = (
        db.table("site_form_submissions")
        .update({"is_read": True})
        .eq("id", submission_id)
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    if not rows:
        raise SiteConfigError("Anfrage nicht gefunden.", status_code=404)


def loeschen(db: Client, tenant_id: str, submission_id: str) -> None:
    """Eine Einsendung endgültig löschen.

    Ohne Papierkorb, und das ist Absicht: es sind personenbezogene Daten, und
    ein Löschbegehren nach Art. 17 DSGVO muss zu einem echten Löschen führen.
    Ein Papierkorb, der die Zeile 30 Tage behält, wäre genau das Gegenteil.
    """
    rows = (
        db.table("site_form_submissions")
        .delete()
        .eq("id", submission_id)
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    if not rows:
        raise SiteConfigError("Anfrage nicht gefunden.", status_code=404)
    log.info(
        "site_form_submission_geloescht",
        tenant_id=tenant_id,
        submission_id=submission_id,
    )
