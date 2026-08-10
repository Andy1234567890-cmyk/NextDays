"""Vertragsende eines Objekts durchsetzen (0355).

Der Betrieb hinterlegt am Objekt den Tag, ab dem der Vermarktungsvertrag nicht
mehr gilt (`properties.contract_end_date`, erster Tag OHNE Vertrag). Ab diesem
Tag darf das Objekt nirgends mehr verkauft werden — nicht im eigenen Kalender,
nicht auf myBestDays, nicht bei Booking/Airbnb/Expedia.

WARUM SPERRNÄCHTE UND NICHT NUR EINE PRÜFUNG:
Ein Tag ohne `availability`-Zeile ist überall als OFFEN definiert — im
Board-Aufbau (`_build_days`) wie im Full-Sync an die Portale
(`full_sync._availability_full_values`: „Tage ohne Zeile sind offen"). Eine
Sperre, die nur als Datumsvergleich im Buchungspfad lebte, käme bei den OTAs
also nie an: Booking und Airbnb würden das Objekt weiter verkaufen, und die
Buchung schlüge erst beim Import auf. Die Sperre muss deshalb als Zeilen in
`availability` stehen — das ist die eine Wahrheit, die alle Kanäle lesen.

WARUM EIN HORIZONT UND KEIN „BIS UNENDLICH":
Ein Vertragsende ist unbefristet, `availability` ist eine Tabelle mit einer
Zeile je Tag und Einheit. „Für immer sperren" ist damit nicht schreibbar.
Gesperrt wird der Horizont, der überhaupt jemand sehen kann: Channex' Full-Sync
reicht 365 Tage, der Publish-Horizont 500 — 730 Tage deckt beides mit Reserve.
Der Horizont wächst mit: jeder erneute Lauf (Speichern, nächtlicher Nachzug)
rechnet ihn ab HEUTE neu und schreibt die dann fehlenden Tage nach. Für die
Zeit dahinter ist der DB-Trigger aus 0355 der Riegel — er lehnt jede
Reservierung ab, die über das Enddatum hinausreicht, egal wie weit sie liegt.

WURZEL 1 — DER GEGENZUSTAND:
Wird das Enddatum entfernt oder nach hinten verschoben, MÜSSEN die dadurch
freigewordenen Nächte wieder offen werden und als verfügbar an die Portale
gehen. Beides läuft über denselben Einstiegspunkt
(`vertragsende_durchsetzen`), damit niemand die eine Hälfte ohne die andere
aufrufen kann. Freigegeben wird ausschließlich, was DIESE Automatik gesetzt hat
(`source='contract_end'`) — eine daneben liegende Handsperre oder eine
OTA-Belegung bleibt unangetastet.
"""

from __future__ import annotations

from datetime import date, timedelta

from supabase import Client

from src.core.einheiten import AVAILABILITY_CONFLICT, je_einheit
from src.core.einheiten_verfuegbar import freie_einheiten_spannen
from src.core.logging import get_logger
from src.jobs.queue import try_enqueue_ari

from .errors import PropertyError

log = get_logger("nextdays.properties")

# Wie weit ab HEUTE die Vertragssperre geschrieben wird. Größer als der
# Channex-Full-Sync-Horizont (365) und der Publish-Horizont (500), damit kein
# Kanal einen Tag als offen meldet, den der Vertrag nicht mehr deckt. Jeder
# Lauf rechnet ab heute neu — der Horizont wandert also mit der Zeit mit.
SPERR_HORIZONT_TAGE = 730

# Die Quelle, die NUR diese Automatik schreibt. Eigener Enum-Wert (0355), damit
# `CalendarService._unblock` sie nicht mit aufhebt: „Sperre aufheben" im
# Kalender darf ein Objekt nicht wieder verkäuflich machen, für das es keinen
# Vertrag mehr gibt.
QUELLE = "contract_end"


def als_datum(wert: object) -> date | None:
    """Ein Datum aus einem `model_dump(mode="json")`-Payload zurückgewinnen.

    `mode="json"` macht aus einem `date` einen ISO-String — die Helfer hier
    rechnen aber mit `date` (Horizont, Tagesliste). Leer bleibt leer: `None`
    heißt „unbefristet" und ist ein echter Zustand, kein fehlender Wert
    (Wurzel 4). Ein unbrauchbarer Wert kommt hier nicht an, Pydantic hat ihn
    beim Parsen des Requests schon abgelehnt.
    """
    if wert is None:
        return None
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert))


def _sperr_fenster(ende: date, *, heute: date) -> tuple[date, date] | None:
    """Zu sperrender Zeitraum [von, bis_exkl) für ein Enddatum.

    Beginnt am Enddatum selbst (es ist der erste Tag OHNE Vertrag) oder heute,
    falls das Ende schon vorbei ist — Vergangenheit wird nicht angefasst, dort
    liegen abgerechnete Buchungen. Gibt `None`, wenn nichts zu sperren bleibt.
    """
    von = max(ende, heute)
    bis = heute + timedelta(days=SPERR_HORIZONT_TAGE)
    return (von, bis) if von < bis else None


def buchungen_nach_ende(
    db: Client, property_id: str, ende: date
) -> list[dict[str, str]]:
    """Aktive Reservierungen, die über das Enddatum hinausreichen.

    Wurzel 5: Das Setzen eines Enddatums darf bestehende Buchungen nicht still
    entwerten. Wer zum 02.01.2027 kündigt, aber eine bestätigte Buchung bis zum
    10.01. im Kalender hat, muss zuerst entscheiden — stornieren oder ein
    späteres Datum. Der Aufrufer meldet das als 409 mit dieser Liste zurück.

    `check_out` ist die Abreise (ausschließlich): eine Buchung, die AM Endtag
    abreist, belegt nur Nächte davor und ist gültig. Storniertes zählt nicht.
    Dieselbe Grenze prüft der DB-Trigger aus 0355 — bewusst doppelt: hier für
    die sprechende Meldung, dort als Riegel gegen jeden anderen Schreibweg.
    """
    rows = (
        db.table("reservations")
        .select("id, check_in, check_out, status, guests(name)")
        .eq("property_id", property_id)
        .neq("status", "cancelled")
        .gt("check_out", ende.isoformat())
        .order("check_in")
        .execute()
    ).data or []
    treffer = []
    for r in rows:
        gast = r.get("guests") or {}
        treffer.append(
            {
                "id": str(r["id"]),
                "check_in": str(r["check_in"]),
                "check_out": str(r["check_out"]),
                "gast": str(gast.get("name", "") if isinstance(gast, dict) else ""),
            }
        )
    return treffer


FELD = "contract_end_date"


def vertragsende_pruefen(
    db: Client, property_id: str, changes: dict[str, object]
) -> None:
    """Vor dem Schreiben: steht dem neuen Enddatum eine Buchung im Weg?

    Nimmt den ganzen `changes`-Dict statt eines Datums, damit die
    „ist das Feld überhaupt im Update?"-Frage und die Umrechnung des
    JSON-Datums an EINER Stelle stehen — im Objekt-Update wären es zwei
    zusätzliche Verzweigungen, und wer eine davon vergisst, setzt ein
    Enddatum ohne Prüfung.
    """
    if FELD not in changes:
        return
    _pruefen(db, property_id, als_datum(changes[FELD]))


def vertragsende_aus_update(
    db: Client, tenant_id: str, property_id: str, changes: dict[str, object]
) -> None:
    """Nach dem Schreiben: Sperre setzen bzw. Gegenzustand aufheben.

    Gegenstück zu `vertragsende_pruefen` auf demselben `changes`-Dict — beide
    Hälften prüfen dieselbe Bedingung, damit die eine nicht ohne die andere
    laufen kann (Wurzel 1).
    """
    if FELD not in changes:
        return
    vertragsende_durchsetzen(db, tenant_id, property_id, als_datum(changes[FELD]))


def _pruefen(db: Client, property_id: str, ende: date | None) -> None:
    """Ein neues Vertragsende darf keine bestehende Buchung entwerten.

    Wurzel 5: Wer zum 02.01.2027 kündigt, aber eine bestätigte Buchung bis zum
    10.01. im Kalender hat, muss zuerst entscheiden — stornieren oder ein
    späteres Datum. Das Datum stillschweigend zu setzen und den Gast im Regen
    stehen zu lassen, ist keine Option.

    WARUM HIER UND NICHT NUR IM DB-TRIGGER (0355): Der Trigger schützt die
    Daten, aber er kann nur „geht nicht" sagen. Diese Prüfung gibt dem Nutzer
    die LISTE der betroffenen Buchungen — ohne sie müsste er raten, welche
    Reservierung im Weg steht.

    Getrennt von `vertragsende_durchsetzen`, damit ein maschineller Nachzug des
    Horizonts NICHT an einer Bestandsbuchung scheitert: dort ist die Buchung
    eine Tatsache, hier eine Entscheidung des Nutzers.

    Das Entfernen (`None`) braucht keine Prüfung — mehr Vertrag steht keiner
    Buchung im Weg.
    """
    if ende is None:
        return
    offen = buchungen_nach_ende(db, property_id, ende)
    if offen:
        raise PropertyError(
            "Es gibt Buchungen, die über das Vertragsende hinausreichen. "
            "Storniere sie oder wähle ein späteres Datum.",
            status_code=409,
            details={"buchungen": offen},
        )


def vertragsende_durchsetzen(
    db: Client,
    tenant_id: str,
    property_id: str,
    ende: date | None,
    *,
    heute: date | None = None,
) -> int:
    """Den Kalender und die Portale auf das Vertragsende bringen. Gibt die Zahl
    der geschriebenen Sperrtage zurück (0 beim Aufheben).

    DER EINE EINSTIEGSPUNKT für beide Richtungen (Wurzel 1):
      * `ende` gesetzt   → Nächte ab dem Endtag sperren, davor liegende
                           Vertragssperren wieder öffnen (Datum nach hinten
                           verschoben), Portale bekommen den neuen Stand.
      * `ende is None`   → ALLE Vertragssperren dieses Objekts aufheben und die
                           Tage als verfügbar melden.

    Aufgehoben wird immer nur `source='contract_end'`. Eine Handsperre oder eine
    OTA-Belegung im selben Zeitraum bleibt stehen — sie hat einen anderen Grund
    und einen anderen Gegenzustand.

    Der Aufrufer hat das Objekt bereits tenant-gescopt geladen; `tenant_id`
    dient hier dem Auffächern auf die Einheiten und dem Push-Job.
    """
    heute = heute or date.today()
    # ERST öffnen, dann sperren: Bei einem nach hinten verschobenen Enddatum
    # (02.01. → 01.06.) müssen die Januar-bis-Mai-Nächte frei werden, bevor der
    # Stand gemeldet wird — sonst pusht der Helfer unten den alten Zustand.
    geoeffnet = _sperren_aufheben(db, property_id, ende, heute=heute)

    geschrieben = 0
    fenster = _sperr_fenster(ende, heute=heute) if ende is not None else None
    if fenster is not None:
        geschrieben = _sperren_schreiben(
            db, tenant_id, property_id, fenster[0], fenster[1]
        )

    # Portale: den FERTIGEN Stand melden — für das neu gesperrte Fenster und für
    # alles, was gerade freigeworden ist. Nach dem Schreiben, damit
    # `freie_einheiten_spannen` den Ist-Zustand sieht (Wurzel 1).
    for von, bis_exkl in _gemeldete_bereiche(fenster, geoeffnet):
        _push_stand(db, tenant_id, property_id, von, bis_exkl)

    log.info(
        "vertragsende_durchgesetzt",
        tenant_id=tenant_id,
        property_id=property_id,
        ende=ende.isoformat() if ende else None,
        gesperrt=geschrieben,
        geoeffnet=len(geoeffnet),
    )
    return geschrieben


def _gemeldete_bereiche(
    fenster: tuple[date, date] | None, geoeffnet: list[str]
) -> list[tuple[date, date]]:
    """Zeiträume, deren Stand an die Portale gehen muss (jeweils [von, bis_exkl)).

    Das neu gesperrte Fenster und — als EIN zusammenhängender Bereich — die
    freigewordenen Tage. Ein Bereich statt ein Push je Tag: `_push_stand`
    gruppiert intern nach gleicher Stückzahl, ein Loch in der Mitte (Tag blieb
    aus anderem Grund gesperrt) ergibt dort schlicht eine eigene Spanne mit 0.
    """
    bereiche: list[tuple[date, date]] = []
    if fenster is not None:
        bereiche.append(fenster)
    if geoeffnet:
        tage = sorted(date.fromisoformat(t) for t in geoeffnet)
        bereiche.append((tage[0], tage[-1] + timedelta(days=1)))
    return bereiche


def _sperren_schreiben(
    db: Client, tenant_id: str, property_id: str, von: date, bis_exkl: date
) -> int:
    """Vertragssperre für [von, bis_exkl) auf ALLE Einheiten schreiben.

    Der Vertrag endet für den ganzen Typ, nie für eine einzelne Einheit —
    deshalb ohne `unit_id` durch `je_einheit`, das auf alle auffächert (0266).

    FREMDER ZUSTAND BLEIBT FREMD: Der Upsert läuft auf
    `(property_id, unit_id, date)`. Ein blindes Schreiben übernähme jede Zeile,
    die schon dort liegt — und zwar auf ZWEI Wegen schädlich:

      * eine `booked`-Zeile verlöre ihre Kalenderspur; der Gast stünde vor der
        Tür, während das Objekt „gesperrt" zeigt, ohne Bezug zu ihm.
      * eine fremde SPERRE (Handsperre Renovierung, Eigennutzung, iCal) trüge
        danach `source='contract_end'`. Sie fiele damit beim Zurücknehmen des
        Enddatums mit — die Renovierungssperre wäre weg und das Objekt in der
        Bauphase verkäuflich. Genau dieser Fehler ist im Test
        `test_aufheben_laesst_eine_fremde_sperre_stehen` festgehalten.

    Beides wird deshalb ausgelassen: der Tag ist so oder so nicht verkäuflich,
    der Zielzustand steht also bereits. Die Vertragssperre beansprucht nur die
    Nächte, die es OHNE sie nicht gäbe — dasselbe Prinzip wie
    `CalendarService.block` mit `_fremde_sperrtage`.
    """
    besetzt = {
        str(r["date"])
        for r in (
            db.table("availability")
            .select("date, status, source")
            .eq("property_id", property_id)
            .neq("status", "open")
            .gte("date", von.isoformat())
            .lt("date", bis_exkl.isoformat())
            .execute()
        ).data or []
        # Die eigene Vertragssperre ist NICHT fremd: sie darf erneut
        # geschrieben werden, sonst wäre ein zweiter Lauf kein No-op, sondern
        # ließe die Zeilen im alten Stand liegen (Wurzel 2 — Doppelklick).
        if r.get("source") != QUELLE
    }
    payload = [
        {
            "property_id": property_id,
            "date": tag.isoformat(),
            "status": "blocked",
            "source": QUELLE,
        }
        for tag in _tage(von, bis_exkl)
        if tag.isoformat() not in besetzt
    ]
    if not payload:
        return 0
    db.table("availability").upsert(
        je_einheit(db, property_id, payload, tenant_id=tenant_id),
        on_conflict=AVAILABILITY_CONFLICT,
    ).execute()
    return len(payload)


def _sperren_aufheben(
    db: Client, property_id: str, ende: date | None, *, heute: date
) -> list[str]:
    """Vertragssperren wieder öffnen, die das aktuelle Enddatum nicht mehr deckt.

    Gibt die betroffenen Tage (ISO) zurück, damit der Aufrufer genau für sie den
    neuen Stand an die Portale meldet.

    Ohne Enddatum fallen ALLE Vertragssperren ab heute; mit Enddatum die vor dem
    Endtag liegenden (das Datum wurde nach hinten verschoben). Vergangenes wird
    nicht angefasst — was gestern zu war, bleibt zu.

    AUF `open` SETZEN, NICHT LÖSCHEN (Wurzel 1): Eine gelöschte Zeile ist für
    Board und Full-Sync gleichbedeutend mit „offen", das Ergebnis wäre also
    dasselbe — aber nur solange kein zweiter Grund auf derselben Zeile liegt.
    `status='open'` lässt `unit_id` und die Zeile selbst intakt und ist damit
    derselbe Weg, den `CalendarService._unblock` nach dem Loch-Bug geht.
    """
    query = (
        db.table("availability")
        .update({"status": "open"})
        .eq("property_id", property_id)
        .eq("source", QUELLE)
        .eq("status", "blocked")
        .gte("date", heute.isoformat())
    )
    if ende is not None:
        query = query.lt("date", ende.isoformat())
    rows = (query.execute()).data or []
    return sorted({str(r["date"]) for r in rows})


def _push_stand(
    db: Client, tenant_id: str, property_id: str, von: date, bis_exkl: date
) -> None:
    """Den fertigen Kalenderstand eines Bereichs an die Portale melden.

    Dieselbe Rechnung wie im Kalender- und Buchungspfad: die echte Zahl freier
    Einheiten je Tag, gruppiert in Spannen gleichen Werts (`freie_einheiten_
    spannen`). Ein festes `0` wäre hier falsch, sobald ein Objekt mehrere
    Einheiten hat und eine davon aus anderem Grund schon zu war.

    `freie_einheiten_spannen` nimmt `bis` INKLUSIV und gibt inklusive Enden
    zurück, der übrige Slice rechnet exklusiv — umgerechnet wird genau hier.

    Best-effort (Wurzel 5): `try_enqueue_ari` schluckt ein nicht erreichbares
    Channex, der nächtliche Full-Sync ist der Backstop. Das Enddatum steht
    dann trotzdem in der DB und die Sperre im eigenen Kalender.
    """
    for span_von, span_bis, frei in freie_einheiten_spannen(
        db, tenant_id, property_id, von, bis_exkl - timedelta(days=1)
    ):
        try_enqueue_ari(
            db,
            tenant_id,
            property_id,
            "availability",
            {
                "date_from": span_von.isoformat(),
                "date_to": (span_bis + timedelta(days=1)).isoformat(),
                "availability": frei,
            },
        )


def vertragsenden_nachziehen(db: Client, grenze: int) -> None:
    """Für jedes Objekt mit Enddatum die Sperrnächte bis zum Horizont
    nachschreiben. Der tägliche Wartungslauf des Workers.

    WARUM ÜBERHAUPT: `vertragsende_durchsetzen` sperrt ab HEUTE für einen
    festen Horizont. Ohne diesen Nachzug wäre die Sperre eines heute gesetzten
    Enddatums in zwei Jahren aufgebraucht — und ein Tag ohne
    `availability`-Zeile ist für den Full-Sync OFFEN, das Objekt also bei
    Booking und Airbnb wieder verkäuflich, obwohl es keinen Vertrag mehr gibt.
    Der Fehler fiele erst mit der ersten unvertraglichen Buchung auf.

    OHNE die Buchungsprüfung (`vertragsende_pruefen`): hier ist eine
    Bestandsbuchung eine Tatsache, keine Entscheidung des Nutzers. Sie würde
    den Wartungslauf sonst dauerhaft blockieren, und die Sperre der ÜBRIGEN
    Tage bliebe aus. Gebuchte Nächte lässt `_sperren_schreiben` ohnehin stehen.

    Idempotent (Wurzel 2): ein zweiter Lauf am selben Tag schreibt dieselben
    Zeilen und ändert nichts.

    Ein Objekt, das scheitert, kippt den Lauf nicht — die übrigen sollen
    trotzdem gesperrt werden, und der nächste Tick versucht es erneut.
    """
    rows = (
        db.table("properties")
        .select("id, tenant_id, contract_end_date")
        .not_.is_("contract_end_date", "null")
        .limit(grenze)
        .execute()
    ).data or []
    for row in rows:
        tenant_id, property_id = row.get("tenant_id"), row.get("id")
        ende = als_datum(row.get("contract_end_date"))
        if not tenant_id or not property_id or ende is None:
            continue
        try:
            vertragsende_durchsetzen(db, str(tenant_id), str(property_id), ende)
        except Exception as exc:  # noqa: BLE001 — ein Objekt kippt nicht den Lauf
            log.warning(
                "vertragsende_nachzug_failed",
                property_id=str(property_id),
                error=str(exc)[:200],
            )
    if rows:
        log.info("vertragsende_nachgezogen", properties=len(rows))


def _tage(von: date, bis_exkl: date) -> list[date]:
    """Tage in [von, bis_exkl). Eigener Helfer, weil der Bereich hier bis zu
    730 Einträge hat und ein Off-by-one am Ende die letzte Nacht offen ließe."""
    return [von + timedelta(days=i) for i in range((bis_exkl - von).days)]
