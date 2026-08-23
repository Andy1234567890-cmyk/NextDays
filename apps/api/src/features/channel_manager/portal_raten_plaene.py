"""Fuer jede Portal-Rate einen eigenen Preisplan — statt mehrere auf einen.

Booking.com fuehrt Restriktionen auf RATE-Ebene, nicht auf Zimmer-Ebene
(SiteMinder-Doku zum selben OTA-Protokoll: „Restrictions are set at the room
rate level, while availability is set at the room type level … Each rate plan
can have independent restrictions"). Jede Rate braucht deshalb ihre eigene
Zeile mit eigenem Mindestaufenthalt.

Vorher legte `_build_rate_plans` jede ueberzaehlige Portal-Rate auf den ERSTEN
Preisplan (`pairs += [(rate, selected[0]) …]`). Zwei Folgen, beide live belegt
am 23.08.2026:

  1. In unserer Oberflaeche war die zweite Rate unsichtbar. Der Betrieb fuehrt
     bei Booking eine „Wochenrate" fuer den Wochenrabatt; unter „Preise" stand
     nur „Grundpreis", weil es bei uns keinen zweiten Plan gab.
  2. Nur EIN Eintrag je Plan trug `primary_occ` und damit die Restriktionen.
     Im Extranet-Kalender von „Rævlingehuset" stand an der Standard Rate
     min_stay 3 in jeder Spalte, an der Wochenrate LEER — und ueber diese Rate
     kam um 11:46 eine 1-NACHT-Buchung (1.820 DKK, 28.–29.05.2027).

Gegenprobe im selben Bestand: bei „FeWo *Stjerneskud*" ist die Wochenrate
(Code 63941996) mit `primary_occ: True` gemappt, und dort zeigt das Extranet
die 2 auf BEIDEN Raten. Es ist also genau die fehlende eigene Zuordnung.

WAS DIESES MODUL TUT: es legt fuer eine Portal-Rate ohne eigenen Preisplan
einen an — Name aus dem Portal-Titel, Preis und Mindestaufenthalt vom
Grundpreis geerbt (kein erfundener Wert, Wurzel 4), `send_to_portals` gesetzt,
weil die Rate beim Portal ohnehin schon verkauft.

WAS ES NICHT TUT: Raten beim Portal anlegen oder loeschen. Die Raten existieren
dort bereits (der Betrieb hat sie im Extranet gebaut — belegt: ihre Codes
erscheinen im Channex-Protokoll ausschliesslich in ANTWORTEN, in keinem
Request-Body). Wir bilden sie nach, wir erzeugen sie nicht.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger(__name__)

# Obergrenze je Zimmer. Booking-Kennungen fuehren real zwei bis drei Raten
# (Standard, Wochenrate, non-refundable); ein Abruf, der Dutzende liefert, ist
# ein Fehler und darf nicht Dutzende Plaene anlegen (Wurzel 8: jeder unbegrenzte
# Bereich bekommt eine harte Obergrenze).
MAX_PLAENE_JE_ZIMMER = 6

# Portal-Raten, deren Titel eine Wochen- oder Monatsrate benennt, bekommen den
# dazu gehoerenden Mindestaufenthalt statt den des Grundpreises.
#
# Belegt (partner.booking.com, „Setting up weekly rate plans for extended
# stays"): eine Wochenrate ist bei Booking ein EIGENER Ratenkategorie-Typ
# („Add new rate plan -> Weekly"), und sie erscheint Gaesten, die „stays of
# seven nights or more" suchen. Booking hat KEINEN separaten Wochenrabatt-
# Schalter: „To encourage more guests to book longer stays, you can set up
# discounts through a Weekly or Monthly Rate Plan." Der Mindestaufenthalt IST
# die Mechanik dieser Rate.
#
# Ohne das erbte eine „Wochenrate" den Mindestaufenthalt des Grundpreises
# (real 2 oder 3 Naechte) und waere damit keine Wochenrate, sondern ein
# zweiter Standardpreis — genau der Zustand, der live gemessen wurde: bei
# „FeWo *Stjerneskud*" traegt die Wochenrate denselben Preis (605 DKK) und
# denselben min_stay (2) wie die Standard Rate.
#
# Nur Titel-Erkennung, kein Raten: trifft kein Wort, bleibt der Grundwert.
_WOCHE_WOERTER = ("wochen", "weekly", "week", "uge", "ugentlig", "semana")
_MONAT_WOERTER = ("monats", "monatlich", "monthly", "month", "maaned", "måned")
WOCHE_NAECHTE = 7
MONAT_NAECHTE = 30


def min_stay_aus_titel(portal_titel: str | None) -> int | None:
    """7 bei einer Wochenrate, 30 bei einer Monatsrate, sonst None.

    None heisst „nicht erkannt" und laesst den Grundwert gelten — kein
    geratener Mindestaufenthalt (Wurzel 4).
    """
    titel = (portal_titel or "").strip().lower()
    if not titel:
        return None
    if any(w in titel for w in _MONAT_WOERTER):
        return MONAT_NAECHTE
    if any(w in titel for w in _WOCHE_WOERTER):
        return WOCHE_NAECHTE
    return None


def _plan_name(
    portal_titel: str | None, code: int | str, portal_label: str
) -> str:
    """Der Plan traegt den Namen der Portal-Rate, damit der Betrieb ihn im
    Extranet wiedererkennt („Wochenrate" heisst bei uns „Wochenrate").
    Ohne Titel der Code — nie ein erfundener Name."""
    titel = (portal_titel or "").strip()
    if titel:
        return titel
    return f"{portal_label} Rate {code}"


def plan_fuer_portal_rate(
    db: Client, *, property_id: str, grundpreis: dict[str, Any],
    portal_titel: str | None, rate_code: int | str, portal_label: str,
) -> str | None:
    """Einen Preisplan fuer eine Portal-Rate anlegen; gibt seine ID zurueck.

    Erbt Preis, Waehrung und Mindestaufenthalt vom Grundpreis: die Rate verkauft
    beim Portal bereits zu diesem Preis (im Extranet-Kalender tragen Standard-
    und Wochenrate denselben Betrag), und ein abweichender Startwert waere eine
    Behauptung ueber den Verkauf, die niemand getroffen hat. Der Betrieb passt
    ihn danach unter „Preise" an — dafuer ist der Plan da.

    None bei Fehlschlag: eine fehlende Plan-Zeile darf den Kanal-Aufbau nicht
    kippen (der Aufrufer faellt dann auf den Grundpreis zurueck wie bisher).
    """
    name = _plan_name(portal_titel, rate_code, portal_label)
    # Eine Wochen-/Monatsrate traegt ihren eigenen Mindestaufenthalt (7 bzw. 30),
    # sonst gilt der des Grundpreises.
    min_stay = min_stay_aus_titel(portal_titel) or grundpreis.get("min_stay")
    payload = {
        "property_id": property_id,
        "name": name,
        "base_price": grundpreis.get("base_price"),
        "currency": grundpreis.get("currency"),
        "min_stay": min_stay,
        # `manual` und OHNE parent_rate_plan_id — bewusst. Mit einem Parent
        # stehen bei Channex `inherit_rate` und `inherit_min_stay_arrival`
        # standardmaessig auf true (Doku rate-plans-collection), und die
        # Wochenrate truege zwangsweise Preis und Mindestaufenthalt der
        # Elternrate. Genau das ist der Zustand, der behoben werden soll.
        "rate_mode": "manual",
        # Die Rate verkauft beim Portal schon — sie muss dorthin gesendet
        # werden, sonst bekommt sie weiterhin keine Restriktionen.
        "send_to_portals": True,
    }
    try:
        ins = (db.table("rate_plans").insert(payload).execute()).data or []
    except Exception as exc:  # noqa: BLE001 — Kanal-Aufbau darf nicht kippen
        log.error(
            "portal_rate_plan_anlegen_fehlgeschlagen",
            property_id=property_id, rate_code=rate_code, error=str(exc)[:200],
        )
        return None
    if not ins:
        log.error(
            "portal_rate_plan_leer_zurueck",
            property_id=property_id, rate_code=rate_code,
        )
        return None
    plan_id = str(ins[0].get("id"))
    log.info(
        "portal_rate_plan_angelegt",
        property_id=property_id, rate_plan_id=plan_id,
        name=name, rate_code=rate_code,
    )
    return plan_id


def vorhandene_plan_namen(
    db: Client, property_id: str
) -> dict[str, str]:
    """{name_klein: plan_id} der Plaene eines Objekts — fuer Idempotenz.

    Wurzel 2: der Kanal-Aufbau laeuft mehrfach (erneutes Verbinden, additiver
    PUT, Reconnect). Ohne diesen Abgleich entstuende bei jedem Lauf ein weiterer
    „Wochenrate"-Plan.
    """
    return {name: plan_id for name, (plan_id, _) in _plaene_je_name(
        db, property_id
    ).items()}


def _plaene_je_name(
    db: Client, property_id: str
) -> dict[str, tuple[str, bool]]:
    """{name_klein: (plan_id, send_to_portals)} der Plaene eines Objekts."""
    try:
        rows = (
            db.table("rate_plans")
            .select("id, name, send_to_portals")
            .eq("property_id", property_id)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — leer heisst "nichts wiederverwenden"
        log.warning(
            "portal_rate_plan_namen_unlesbar",
            property_id=property_id, error=str(exc)[:200],
        )
        return {}
    return {
        str(r.get("name") or "").strip().lower():
            (str(r.get("id")), bool(r.get("send_to_portals")))
        for r in rows
        if r.get("id") and r.get("name")
    }


def portalfreigabe_nachziehen(
    db: Client, *, property_id: str, plan_id: str, plan_name: str
) -> bool:
    """`send_to_portals` an einem BESTEHENDEN Portal-Raten-Plan wieder setzen.

    DER GEGENZUSTAND ZUR IDEMPOTENZ-SPERRE (Wurzel 1/2). Der taegliche Abgleich
    laesst einen Plan aus, sobald es ihn schon gibt (`vorhandene_plan_namen`) —
    er prueft aber nicht, ob der Plan noch FREIGEGEBEN ist. Ohne diesen Schritt
    ist ein einmal verlorenes `send_to_portals` fuer immer verloren: die
    Zuordnung am Kanal laeuft ausschliesslich ueber
    `freigegebene_plaene_zuordnen`, und die liest genau dieses Flag
    (`.eq("send_to_portals", True)`).

    Live gemessen (23.08.2026): der Plan „Wochenrate" von
    „FeWo *Stjerneskud*" (05f602c2-…) wurde 17:28:02 mit `send_to_portals: True`
    angelegt und stand 49 Sekunden spaeter auf `false` — waehrend die vier am
    selben Lauf angelegten Schwester-Plaene ihr `true` behielten. In den Logs
    beider API-Container steht in diesem Fenster KEIN schreibender Request
    (nur Channex-Webhooks), und `mcp_access_log` ist leer; der Schreiber war
    also ein Prozess mit dem Service-Key ausserhalb der deployten Dienste.
    Die Ursache ist damit nicht im Code — die FOLGE aber war es: der Plan war
    danach dauerhaft unzuordenbar, weil niemand das Flag nachzieht.

    Ein Portal-Raten-Plan MUSS freigegeben sein: seine Rate verkauft beim
    Portal bereits (der Betrieb hat sie im Extranet angelegt), und nur ueber die
    Kanal-Zuordnung bekommt sie ihre eigenen Restriktionen. `false` ist hier
    kein Kundenwunsch, sondern ein verlorener Zustand.

    `True` = nachgezogen. Ein `portal_scope`-Plan wird NIE angefasst: der geht
    ausschliesslich ueber seine Portal-Achse und traegt `send_to_portals: False`
    absichtlich.
    """
    try:
        zeile = (
            db.table("rate_plans")
            .select("id, send_to_portals, portal_scope")
            .eq("id", plan_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt den Lauf nie
        log.warning(
            "portalfreigabe_nicht_lesbar",
            property_id=property_id, rate_plan_id=plan_id,
            error=str(exc)[:200],
        )
        return False
    if not zeile or zeile[0].get("portal_scope"):
        return False
    if zeile[0].get("send_to_portals"):
        return False  # steht schon richtig → nichts tun (Wurzel 2)
    try:
        db.table("rate_plans").update({"send_to_portals": True}).eq(
            "id", plan_id
        ).eq("property_id", property_id).execute()
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt den Lauf nie
        log.warning(
            "portalfreigabe_nicht_nachgezogen",
            property_id=property_id, rate_plan_id=plan_id,
            error=str(exc)[:200],
        )
        return False
    log.info(
        "portalfreigabe_nachgezogen",
        property_id=property_id, rate_plan_id=plan_id, plan_name=plan_name,
    )
    return True


def paar_fuer_portal_plan(
    bestand: list[dict[str, Any]], plan_name: str,
    *, portal_titel_je_code: dict[str, str],
) -> dict[str, Any] | None:
    """Die VOLLSTAENDIGEN `settings` fuer das OTA-Paar dieses Portal-Plans.

    Rueckgabe ist der `settings`-Block, den `POST channels/{id}/mappings`
    verlangt: `room_type_code`, `rate_plan_code`, `occupancy`, `pricing_type`,
    `primary_occ`, `readonly` — dieselben Felder, die
    `channels._rate_plan_settings` beim Kanal-AUFBAU setzt.

    WARUM DAS HIER STEHT (gemessen 23.08.2026): diese Funktion gab nur
    `{room_type_code, rate_plan_code}` zurueck. Damit legte
    `freigegebene_plaene_zuordnen` unseren Wochen-Plan als VIERTEN Eintrag an
    den Kanal von „FeWo *Stjerneskud*" — ohne `primary_occ`. Channex sendet an
    so einem Eintrag keine Restriktionen, der alte primaere Eintrag desselben
    Paares (Grundpreis, occupancy 4, primary_occ true) blieb ihr Traeger, und
    das Booking-Extranet zeigte an der Wochenrate weiter Mindestaufenthalt 2
    statt 7. Der Lauf meldete Erfolg und hatte nichts bewirkt.

    DER GEGENZUSTAND ZU `plan_fuer_portal_rate` (Wurzel 1). Der Plan entsteht
    beim Kanal-Aufbau ohne Channex-ID; registriert wird er erst durch den
    Content-Sync, und danach ordnet `freigegebene_plaene_zuordnen` ihn am Kanal
    zu. Genau dort fehlte die Zuordnungs-REGEL: dieser Weg legt einen
    freigegebenen Plan auf JEDES Paar des Zimmers, weil er fuer den
    Portal-Aufschlag gebaut wurde — der gilt fuer das ganze Zimmer.

    Fuer einen Portal-Raten-Plan ist das falsch, und zwar genau verkehrt herum.
    Nachgerechnet an der Live-Lage (Rævlingehuset, Zimmer 1220760101, Raten
    45621028 „Standard Rate" und 45627350 „Wochenrate"): der Wochen-Plan mit
    min_stay 7 laege danach AUCH auf der Standard Rate. Booking verkaufte die
    Standard-Rate dann erst ab sieben Naechten — der Schaden waere groesser als
    der behobene. Zusaetzlich verletzt es Channex' Eindeutigkeit
    („One OTA room+rate pair should map to at most one local rate plan"): das
    Paar 1220760101/45621028 trueg zwei lokale Plaene.

    ZUORDNUNGS-SCHLUESSEL ist der Rate-TITEL, nicht die Reihenfolge: der Plan
    heisst genau wie die Rate im Extranet (`_plan_name`), und der Titel steht je
    Code in `portal_titel_je_code` (aus `POST /channels/mapping_details`).
    Ueber die Reihenfolge zu gehen waere ein Ratespiel — Channex garantiert
    keine, und ein Fehlgriff verschiebt Restriktionen auf die falsche Rate.

    None heisst „kein Paar sicher zuordenbar" → der Aufrufer laesst die
    Zuordnung LIEBER GANZ (fail-closed, Wurzel 5). Eine ungemappte Rate ist
    ein sichtbarer Zustand, den der Betrieb im Kanal sieht; eine auf die
    falsche Rate gelegte Restriktion ist unsichtbar und verkauft falsch.
    """
    gesucht = (plan_name or "").strip().lower()
    if not gesucht:
        return None
    passende = [
        code for code, titel in (portal_titel_je_code or {}).items()
        if (titel or "").strip().lower() == gesucht
    ]
    if len(passende) != 1:
        # Kein Treffer oder MEHRERE Raten desselben Titels — in beiden Faellen
        # ist nicht entscheidbar, welche gemeint ist.
        log.warning(
            "portal_plan_paar_nicht_eindeutig",
            plan_name=plan_name, treffer=sorted(passende),
            portal_codes=sorted(portal_titel_je_code or {}),
        )
        return None
    code = passende[0]
    traeger = restriktions_traeger(bestand, code)
    if traeger is None:
        log.warning(
            "portal_plan_paar_nicht_im_kanal",
            plan_name=plan_name, rate_plan_code=code,
        )
        return None
    settings = traeger.get("settings") or {}
    # Die Codes kommen aus dem BESTEHENDEN Mapping, also von Channex selbst
    # — im Originaltyp weitergeben (Integer; Strings landen laut Skill unter
    # "removed rates").
    ziel: dict[str, Any] = {
        "room_type_code": settings["room_type_code"],
        "rate_plan_code": settings.get("rate_plan_code"),
        # `primary_occ: True` IST der Punkt: nur der primaere Eintrag eines
        # Paares traegt bei Channex die Restriktionen. Ohne ihn war die neue
        # Zuordnung eine Attrappe — live gemessen am 23.08.2026 an
        # „FeWo *Stjerneskud*": unser Wochen-Plan stand als dritter Eintrag im
        # Kanal (`{room_type_code, rate_plan_code}` ohne alles andere), und das
        # Booking-Extranet zeigte an der Wochenrate weiter Mindestaufenthalt 2
        # — den des Grundpreises, der den primaeren Eintrag desselben Paares
        # behielt.
        "primary_occ": True,
        # `occupancy`/`pricing_type` NICHT erfinden (Wurzel 4): sie stehen im
        # bestehenden primaeren Eintrag desselben Paares, weil das Portal
        # genau diese Werte kennt (live: occupancy 4, pricing_type "RLO").
        # `_build_rate_plans` faellt beim Kanal-AUFBAU auf 2/"Standard"
        # zurueck, weil dort das Mapping-Formular die Werte liefert; hier gibt
        # es kein Formular, nur den Bestand.
        "occupancy": settings["occupancy"],
        "pricing_type": settings["pricing_type"],
        # `readonly` gehoert zum Katalog jedes Booking-artigen Kanals und steht
        # in allen funktionierenden Bestands-Eintraegen auf false. Wir schreiben
        # nicht read-only, also false — kein geratener Wert, sondern der
        # gemessene Bestand.
        "readonly": False,
    }
    return ziel


def settings_fuer_paar(
    bestand: list[dict[str, Any]], raum_code: object, rate_code: object
) -> dict[str, Any] | None:
    """Die vollen `settings` fuer EIN OTA-Paar, abgeleitet aus dem Bestand.

    Derselbe Bau wie in `paar_fuer_portal_plan`, nur ohne den Namens-Umweg —
    gebraucht vom Aufschlags-Pfad (`objekt_kanal._zuordnungs_ziele`), der die
    Paare direkt aus dem Kanal liest.

    `None` = kein Restriktions-Traeger fuer dieses Paar → nicht zuordnen
    (fail-closed, Wurzel 5).
    """
    traeger = restriktions_traeger(bestand, str(rate_code))
    if traeger is None:
        return None
    settings = traeger.get("settings") or {}
    if str(settings.get("room_type_code")) != str(raum_code):
        # Derselbe Ratencode an einem ANDEREN Zimmer ist ein anderes Paar.
        return None
    return {
        "room_type_code": settings["room_type_code"],
        "rate_plan_code": settings.get("rate_plan_code"),
        "primary_occ": True,
        "occupancy": settings["occupancy"],
        "pricing_type": settings["pricing_type"],
        "readonly": False,
    }


# Eigenes Signal, weil `None` hier schon „fail-closed" bedeutet und ein
# leerer String eine gueltige Antwort vortaeuschen wuerde.
NICHTS_ZU_LOESEN: object = object()


def alter_traeger_mapping_id(
    bestand: list[dict[str, Any]], raum_code: object, rate_code: object,
    *, neue_channex_rate_plan_id: str,
) -> str | object | None:
    """Die `mapping_id` des Eintrags, der fuer dieses Paar heute die
    Restriktionen traegt — und der beim Umhaengen WEG muss (Wurzel 1).

    DER KERN DES GEGENZUSTANDS. Channex traegt je OTA-Paar hoechstens EINEN
    lokalen Plan („One OTA room+rate pair should map to at most one local rate
    plan"). Legt man den neuen Eintrag mit `primary_occ: True` an, ohne den
    alten zu loesen, hat das Paar ZWEI primaere Eintraege — und live gewinnt der
    alte: am Kanal von „FeWo *Stjerneskud*" blieb der Grundpreis-Eintrag
    (94cc38bb, occupancy 4, primary_occ true) der Traeger, waehrend unser
    Wochen-Eintrag daneben stand und nichts sendete.

    Drei Rueckgaben, drei Bedeutungen:
      `str`         diese `mapping_id` muss vor dem Anlegen geloescht werden.
      `NICHTS_ZU_LOESEN` der Traeger ist SCHON unser neuer Plan, oder es gibt
                    keinen — es gibt nichts zu loesen. Der erste Fall ist die
                    Idempotenz (Wurzel 2): ein zweiter Lauf loescht nicht die
                    Zuordnung, die er gerade selbst hergestellt hat.
      `None`        Traeger vorhanden, aber OHNE `id` — er laesst sich nicht
                    loeschen. Dann darf auch nicht angelegt werden, sonst
                    entsteht genau der Doppel-Primary-Zustand, der behoben wird
                    (fail-closed, Wurzel 5).

    Die `mapping_id` steht ausschliesslich im Kanal-Objekt unter
    `attributes.rate_plans[].id` (es gibt keinen GET-Pfad fuer Mappings, siehe
    `channex_client.delete_channel_mapping`).
    """
    traeger = restriktions_traeger(bestand, str(rate_code))
    if traeger is None:
        return NICHTS_ZU_LOESEN
    settings = traeger.get("settings") or {}
    if str(settings.get("room_type_code")) != str(raum_code):
        return NICHTS_ZU_LOESEN
    if str(traeger.get("rate_plan_id") or "") == str(neue_channex_rate_plan_id):
        return NICHTS_ZU_LOESEN  # der Traeger IST schon unser Plan
    mapping_id = str(traeger.get("id") or "")
    if not mapping_id:
        log.warning(
            "portal_plan_alter_traeger_ohne_mapping_id",
            rate_plan_code=rate_code, room_type_code=raum_code,
            rate_plan_id=traeger.get("rate_plan_id"),
        )
        return None
    return mapping_id


def restriktions_traeger(
    bestand: list[dict[str, Any]], rate_plan_code: str
) -> dict[str, Any] | None:
    """Der EINE Eintrag eines OTA-Paares, der heute die Restriktionen traegt.

    Das ist der Eintrag mit `primary_occ: True` — bei Channex sendet nur er die
    Restriktionen eines Paares (dieselbe Regel, auf die sich
    `portal_raten_abgleich._belegte_ratencodes` stuetzt). Er ist gleichzeitig
    die QUELLE fuer `occupancy`/`pricing_type` und der ALTE Zustand, der beim
    Umhaengen geloest werden muss (Wurzel 1).

    `None` heisst „kein Traeger gefunden" und ist fail-closed (Wurzel 5): ohne
    ihn gibt es keine belegte `occupancy` und keinen zu loesenden Vorgaenger.
    Eine geratene Belegung waere ein anderer Preis fuer dieselbe Rate.

    Ein Eintrag OHNE `occupancy`/`pricing_type` zaehlt nicht als Traeger — genau
    so sah der kaputte dritte Eintrag am Kanal von „FeWo *Stjerneskud*" aus
    (`primary_occ` fehlte ganz). Ihn als Quelle zu nehmen, hiesse den Fehler
    fortzuschreiben.

    ZWEI STUFEN, und die zweite ist kein Zugestaendnis, sondern ein zweiter
    gemessener Zustand:
      1. Der Eintrag mit `primary_occ: True` — er traegt heute die
         Restriktionen (live: „FeWo *Stjerneskud*", Paar 63941996, Grundpreis
         mit occupancy 4 / pricing_type RLO).
      2. Gibt es KEINEN primaeren Eintrag, der EINDEUTIGE Eintrag des Paares
         mit `occupancy` + `pricing_type`. Genau so steht die Wochenrate von
         „Feriehus Rævehulen" am Kanal 1e553277 (Paar 65402734, occupancy 6,
         pricing_type Standard, `primary_occ: false` — und daneben ein
         Attrappen-Eintrag ohne jedes Feld). Dieses Paar sendet heute GAR KEINE
         Restriktionen; das ist derselbe Schaden, nur ohne Vorgaenger, der ihn
         haelt. Stufe 2 uebernimmt seine Belegung und macht den neuen Plan zum
         Traeger. MEHRERE nicht-primaere Kandidaten (Belegungs-Varianten
         occ=1/occ=4 desselben Paares) sind NICHT entscheidbar → None, statt
         eine Belegung zu waehlen (fail-closed, Wurzel 5).
    """
    kandidaten: list[dict[str, Any]] = []
    for eintrag in bestand or []:
        settings = eintrag.get("settings") or {}
        if str(settings.get("rate_plan_code")) != str(rate_plan_code):
            continue
        if settings.get("room_type_code") is None:
            continue
        if settings.get("occupancy") is None or not settings.get("pricing_type"):
            # Attrappen-Eintrag (nur die beiden Codes) — er traegt nichts und
            # ist keine Quelle fuer eine Belegung.
            continue
        if settings.get("primary_occ") is True:
            return eintrag  # Stufe 1
        kandidaten.append(eintrag)
    # Nach BELEGUNG unterscheiden, nicht nach Zeilenzahl: derselbe Eintrag
    # zweimal im Array (Channex liefert je Kanal-Lauf gelegentlich Duplikate)
    # ist keine Uneindeutigkeit — zwei VERSCHIEDENE Belegungen sind es.
    belegungen = {
        (
            str((k.get("settings") or {}).get("occupancy")),
            str((k.get("settings") or {}).get("pricing_type")),
        )
        for k in kandidaten
    }
    if len(belegungen) == 1:
        return kandidaten[0]  # Stufe 2
    if kandidaten:
        log.warning(
            "portal_plan_traeger_nicht_entscheidbar",
            rate_plan_code=rate_plan_code, kandidaten=len(kandidaten),
        )
    return None


def portal_titel_je_code(ota_rooms: list[dict[str, Any]]) -> dict[str, str]:
    """{rate_plan_code: Titel} aus einem `mapping_details`-Abruf.

    Schluessel ist der String: Channex liefert die Codes je OTA als int
    (Booking) oder str (Sandbox); ein Typvergleich verfehlte jeden Code.
    """
    titel: dict[str, str] = {}
    for room in ota_rooms or []:
        for rate in room.get("rates") or []:
            code = rate.get("id")
            name = (rate.get("title") or "").strip()
            if code is not None and name:
                titel[str(code)] = name
    return titel
