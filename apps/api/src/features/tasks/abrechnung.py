"""Vom Eigentuemer bestellte Leistung → Posten in seiner Abrechnung (0531).

WAS HIER GESCHLOSSEN WIRD: Der Eigentuemer bestellt im Portal eine Leistung
(0330), der Auftrag landet als `tasks`-Zeile beim Betrieb — und danach endete
die Kette. Die Eigentuemer-Abrechnung erwaehnte Aufgaben an keiner Stelle; ein
Posten entstand nur, wenn jemand ihn von Hand unter „Ausgaben & Extras"
erfasste. Live gemeldet am 03.09.2026 an einer bestellten Endreinigung, die in
der Abrechnung unsichtbar war. Ausgefuehrte Arbeit, die niemand berechnet, ist
ein Geldverlust — derselbe Fehlerfall wie 0510, nur am anderen Kettenende.

WANN: beim ABSCHLUSS, nicht bei der Bestellung (Entscheidung des Betriebs vom
03.09.2026). Was nicht ausgefuehrt wurde, wird nicht berechnet, und der
Stichtag der Abrechnungsperiode ist das Abschlussdatum — dasselbe Datum, das
der Eigentuemer auf seiner Rechnung erwartet.

WOHER DER BETRAG: `service_type_prices`, Objekt-Ausnahme vor Betriebsregel
(dieselbe Vorrang-Regel wie `fee_classification`). Fehlt der Preis, entsteht
KEIN Posten mit 0,00 — das waere eine Leistung, die der Eigentuemer geschenkt
bekaeme, ohne dass es jemand entschieden hat (Wurzel 4). Der Mangel wird LAUT
protokolliert, damit er auffaellt, statt die Abrechnung still zu kuerzen.

GEGENZUSTAND (Wurzel 1): Die Aufgabe merkt sich ihren Posten in
`tasks.owner_expense_id`. Wird sie aus `done` zurueckgeholt, verschwindet
genau dieser Posten — nie ein handisch erfasster. Wurde er bereits in eine
festgeschriebene Abrechnung uebernommen (`statement_id` gesetzt), bleibt er
stehen: eine fakturierte Zeile darf nicht ruecklings verschwinden.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.tasks.abrechnung")

# Die Kategorie, unter der der Posten in der Abrechnung steht. Ein bestehender
# Wert des Ausgaben-Slice, kein neuer: die Abrechnung gruppiert danach.
KATEGORIE = "service"

# Richtung: der Eigentuemer TRAEGT die Kosten (er hat sie bestellt). Die
# Ausgaben-Tabelle kennt beide Richtungen (0460); „from_owner" mindert seine
# Auszahlung, „to_owner" erhoeht sie.
RICHTUNG = "from_owner"


def preis_finden(
    db: Client, *, tenant_id: str, service_type_id: str, property_id: str | None
) -> tuple[Decimal, str] | None:
    """Der geltende Preis: Objekt-Ausnahme vor Betriebsregel.

    `None`, wenn kein Preis gepflegt ist — der Aufrufer legt dann KEINEN Posten
    an. Ein Ersatzwert waere hier besonders teuer: er stuende als Betrag in der
    Abrechnung eines Eigentuemers.
    """
    zeilen = (
        db.table("service_type_prices")
        .select("property_id, amount, currency")
        .eq("tenant_id", tenant_id)
        .eq("service_type_id", service_type_id)
        .execute()
    ).data or []
    if not zeilen:
        return None
    # Ausnahme zuerst: die spezifischere Angabe gewinnt.
    ausnahme = [
        z for z in zeilen
        if property_id and str(z.get("property_id") or "") == str(property_id)
    ]
    regel = [z for z in zeilen if not z.get("property_id")]
    treffer = (ausnahme or regel)[:1]
    if not treffer:
        return None
    betrag = treffer[0].get("amount")
    waehrung = str(treffer[0].get("currency") or "").strip().upper()
    if betrag is None or len(waehrung) != 3:
        # Halbe Zeile ist ein Datenfehler, kein Preis. Die DB verbietet das
        # (not null + check), ein Altbestand koennte es dennoch tragen.
        log.error(
            "dienstleistung_preis_unvollstaendig",
            tenant_id=tenant_id, service_type_id=service_type_id,
            betrag=betrag, currency=waehrung,
        )
        return None
    return Decimal(str(betrag)), waehrung


def _abrechenbar(zeile: dict[str, Any]) -> tuple[str, str] | None:
    """Die Vorbedingungen an der AUFGABE: `(service_type_id, property_id)`.

    Eigener Helfer, weil es fuenf Gruende gibt, aus denen kein Posten
    entsteht, und jeder einzeln benannt gehoert — in `posten_anlegen`
    zusammengelegt waeren es acht Ausstiege in einer Funktion, und der Leser
    muesste raten, welcher Grund welchen betrifft.

    `None` heisst „kein Posten", der Grund steht im Log.
    """
    task_id = str(zeile.get("id") or "")
    # Nur was der EIGENTUEMER bestellt hat. Eine gewoehnliche Betriebsaufgabe
    # (Endreinigung nach Gastabreise) ist im Provisionsmodell enthalten und
    # darf ihm nicht einzeln berechnet werden.
    if not zeile.get("ordered_by_owner"):
        return None
    if zeile.get("owner_expense_id"):
        # Wurzel 2: zweiter Abschluss, Redelivery, Nachlauf — der Posten steht
        # schon. Kein zweiter mit demselben Betrag.
        log.info(
            "dienstleistung_posten_bereits_vorhanden",
            task_id=task_id,
            owner_expense_id=str(zeile["owner_expense_id"]),
        )
        return None
    service_type_id = zeile.get("service_type_id")
    property_id = zeile.get("property_id")
    if not service_type_id or not property_id:
        # Freitext-Auftrag ohne Katalog-Typ: dafuer gibt es keinen Preis, und
        # einen zu erfinden hiesse raten. Der Betrieb erfasst ihn von Hand.
        log.info(
            "dienstleistung_ohne_katalogtyp",
            task_id=task_id,
            service_type_id=service_type_id,
            property_id=property_id,
        )
        return None
    return str(service_type_id), str(property_id)


def posten_anlegen(db: Client, *, tenant_id: str, zeile: dict[str, Any]) -> str | None:
    """Beim Abschluss: Abrechnungsposten fuer eine bestellte Leistung.

    Gibt die Posten-Kennung zurueck oder `None`, wenn keiner entsteht (keine
    Eigentuemer-Bestellung, kein Preis, schon gebucht). Best-effort im
    Aufrufer: der Abschluss der Aufgabe ist der Hauptpfad und darf daran nicht
    scheitern — aber jeder Grund steht im Log, nichts wird verschluckt
    (Wurzel 5).
    """
    task_id = str(zeile.get("id") or "")
    if not task_id:
        return None
    vorbedingung = _abrechenbar(zeile)
    if vorbedingung is None:
        return None
    service_type_id = vorbedingung[0]
    property_id = vorbedingung[1]
    owner_id = _owner_id(db, tenant_id=tenant_id, user_id=zeile.get("requested_by"))
    if not owner_id:
        # Ohne Eigentuemer-Zeile gibt es keine Abrechnung, in die der Posten
        # gehoerte. Fail-closed statt Posten ohne Empfaenger.
        log.warning(
            "dienstleistung_ohne_eigentuemer",
            task_id=task_id, requested_by=str(zeile.get("requested_by") or ""),
        )
        return None
    preis = preis_finden(
        db, tenant_id=tenant_id,
        service_type_id=service_type_id, property_id=property_id,
    )
    if preis is None:
        # LAUT, nicht still: eine ausgefuehrte Leistung ohne Preis ist genau
        # der Geldverlust, den diese Kette verhindern soll. Der Betrieb muss
        # den Preis EINMAL pflegen, danach gilt er.
        log.error(
            "dienstleistung_ohne_preis",
            tenant_id=tenant_id, task_id=task_id,
            service_type_id=service_type_id, property_id=property_id,
            hinweis="Preis in service_type_prices pflegen (0531)",
        )
        return None
    betrag, waehrung = preis
    posten = {
        "tenant_id": tenant_id,
        # KEIN `statement_id`: der Posten haengt frei am Eigentuemer und wird
        # von der naechsten Abrechnung eingesammelt, deren Zeitraum sein Datum
        # umfasst. Ihn an eine bestehende Abrechnung zu haengen hiesse, eine
        # womoeglich schon verschickte zu veraendern.
        "owner_id": owner_id,
        "listing_id": property_id,
        "concept": str(zeile.get("title") or "").strip() or None,
        # Der ABSCHLUSStag, nicht heute: er entscheidet, in welche
        # Abrechnungsperiode die Leistung faellt (Wurzel 5b — unsere Uhr ist
        # nicht der Zeitpunkt des Ereignisses).
        "date": _tag(zeile.get("completed_at")),
        "category": KATEGORIE,
        "amount": str(betrag),
        "currency": waehrung,
        "direction": RICHTUNG,
        "created_by_name": "myNextDays",
    }
    angelegt = (db.table("owner_expenses").insert(posten).execute()).data or []
    if not angelegt:
        log.error("dienstleistung_posten_nicht_angelegt", task_id=task_id)
        return None
    posten_id = str(angelegt[0]["id"])
    # Der Anker fuer den Gegenzustand. Erst NACH dem Insert: gaebe es ihn
    # vorher, zeigte er bei einem gescheiterten Insert auf nichts.
    db.table("tasks").update({"owner_expense_id": posten_id}).eq(
        "id", task_id
    ).eq("tenant_id", tenant_id).execute()
    log.info(
        "dienstleistung_posten_angelegt",
        tenant_id=tenant_id, task_id=task_id, owner_expense_id=posten_id,
        betrag=str(betrag), currency=waehrung, owner_id=owner_id,
    )
    return posten_id


def posten_zuruecknehmen(
    db: Client, *, tenant_id: str, zeile: dict[str, Any]
) -> bool:
    """Gegenzustand (Wurzel 1): Aufgabe verlaesst `done` → Posten entfernen.

    NUR der eigene Posten (`owner_expense_id`), nie ein handisch erfasster.
    Steckt er schon in einer festgeschriebenen Abrechnung (`statement_id`),
    bleibt er stehen — eine fakturierte Zeile darf nicht ruecklings
    verschwinden; dann muss die Abrechnung storniert werden.
    """
    posten_id = zeile.get("owner_expense_id")
    task_id = str(zeile.get("id") or "")
    if not posten_id:
        return False
    vorhanden = (
        db.table("owner_expenses")
        .select("id, statement_id")
        .eq("tenant_id", tenant_id)
        .eq("id", str(posten_id))
        .limit(1)
        .execute()
    ).data or []
    if vorhanden and vorhanden[0].get("statement_id"):
        log.warning(
            "dienstleistung_posten_bereits_abgerechnet",
            task_id=task_id, owner_expense_id=str(posten_id),
            statement_id=str(vorhanden[0]["statement_id"]),
        )
        return False
    if vorhanden:
        db.table("owner_expenses").delete().eq("tenant_id", tenant_id).eq(
            "id", str(posten_id)
        ).execute()
    # Den Anker in JEDEM Fall loesen: zeigt er auf eine geloeschte Zeile, waere
    # die Aufgabe fuer immer „schon gebucht" und bekaeme beim naechsten
    # Abschluss keinen Posten mehr.
    db.table("tasks").update({"owner_expense_id": None}).eq("id", task_id).eq(
        "tenant_id", tenant_id
    ).execute()
    log.info(
        "dienstleistung_posten_zurueckgenommen",
        tenant_id=tenant_id, task_id=task_id, owner_expense_id=str(posten_id),
    )
    return True


# --- Preispflege (Betriebssicht) --------------------------------------------


def preise_laden(db: Client, tenant_id: str) -> list[dict[str, Any]]:
    """Alle gepflegten Preise des Betriebs — Regeln und Objekt-Ausnahmen.

    Die Oberflaeche zeigt daneben den Katalog (`service_types`), damit ein
    Leistungstyp OHNE Preis sichtbar bleibt: genau der ist der Fall, in dem
    eine ausgefuehrte Leistung unberechnet blieb.
    """
    return (
        db.table("service_type_prices")
        .select("id, service_type_id, property_id, amount, currency, note")
        .eq("tenant_id", tenant_id)
        .order("service_type_id")
        .execute()
    ).data or []


def preis_setzen(
    db: Client,
    *,
    tenant_id: str,
    service_type_id: str,
    property_id: str | None,
    amount: Decimal,
    currency: str,
    note: str | None = None,
) -> dict[str, Any]:
    """Einen Preis anlegen oder aendern (Betriebsregel oder Objekt-Ausnahme).

    Idempotent ueber die beiden UNIQUE-Indizes aus 0531 (Wurzel 2): ein
    zweiter Aufruf mit demselben Ziel aendert die vorhandene Zeile, statt eine
    zweite anzulegen, die dann nach Ladereihenfolge gaelte.
    """
    zeile = {
        "tenant_id": tenant_id,
        "service_type_id": service_type_id,
        "property_id": property_id,
        "amount": str(amount),
        "currency": currency.strip().upper(),
        "note": (note or "").strip() or None,
        "updated_at": "now()",
    }
    query = (
        db.table("service_type_prices")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("service_type_id", service_type_id)
    )
    # `is_("property_id", "null")` ist NICHT dasselbe wie `eq(..., None)`:
    # SQL vergleicht NULL nie per Gleichheit, die Betriebsregel waere sonst
    # nicht wiederzufinden und jedes Speichern legte eine neue Zeile an.
    query = (
        query.is_("property_id", "null")
        if property_id is None
        else query.eq("property_id", property_id)
    )
    vorhanden = (query.limit(1).execute()).data or []
    if vorhanden:
        geaendert = (
            db.table("service_type_prices")
            .update(zeile)
            .eq("id", str(vorhanden[0]["id"]))
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return geaendert[0] if geaendert else vorhanden[0]
    return (db.table("service_type_prices").insert(zeile).execute()).data[0]


def preis_loeschen(db: Client, *, tenant_id: str, preis_id: str) -> bool:
    """Einen Preis entfernen. Danach entsteht fuer diese Leistung kein Posten
    mehr — der Mangel wird beim naechsten Abschluss laut protokolliert."""
    weg = (
        db.table("service_type_prices")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("id", preis_id)
        .execute()
    ).data or []
    return bool(weg)


def _owner_id(db: Client, *, tenant_id: str, user_id: object) -> str | None:
    """Das Eigentuemer-Konto hinter einem Portal-Login."""
    if not user_id:
        return None
    zeilen = (
        db.table("owners")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    ).data or []
    return str(zeilen[0]["id"]) if zeilen else None


def _tag(wert: object) -> str | None:
    """Datumsteil eines Zeitstempels („2026-10-30T08:12:00+00:00" → Tag).

    `None` bleibt `None`: die Ausgaben-Zeile darf lieber ohne Datum entstehen
    und auffallen, als mit einem erfundenen in die falsche Periode zu fallen.
    """
    if not wert:
        return None
    text = str(wert)
    return text[:10] if len(text) >= 10 else None
