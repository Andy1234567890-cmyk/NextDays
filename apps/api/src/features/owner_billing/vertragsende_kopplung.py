"""Abrechnungsvertrag und Vermarktungsende sind EIN Ereignis (0378).

WARUM DAS ÜBERHAUPT GEBAUT WERDEN MUSSTE:
Bis hierhin gab es zwei Felder für dieselbe Tatsache „der Vertrag mit dem
Eigentümer endet", aus zwei getrennten Etappen:

  * ``owner_billing_terms.gueltig_bis`` (0343, Abrechnung) — bis wann mit dem
    vereinbarten Satz gerechnet wird.
  * ``properties.contract_end_date`` (0355, Kalender) — ab wann das Objekt
    nirgends mehr verkauft werden darf.

Sie wussten nichts voneinander. Live zu sehen am 12.08.2026: vier Objekte
trugen ein Vermarktungsende OHNE Vertragszeile (nur die Kalenderseite gesetzt),
und ein „Gültig bis" im Vertrag-Panel sperrte den Kalender nicht — das Objekt
blieb bei Booking und Airbnb verkäuflich, obwohl der Vertrag auslief. Ein
Eigentümer, der kündigt, kündigt aber nicht die halbe Sache.

WELCHE RICHTUNG HIER LÄUFT:
Der Vertrag ist die Vereinbarung, das Vermarktungsende ihre Folge. Also
Vertrag → Objekt. Die Gegenrichtung (Kalender-Datum von Hand ändern) bleibt
absichtlich frei: der genehmigte Kündigungsantrag setzt ``contract_end_date``
direkt und braucht keinen Abrechnungsvertrag, den es bei vier von fünf Objekten
gar nicht gibt.

DIE REGEL, UND WARUM SIE NICHT „gueltig_bis KOPIEREN" IST:
Ein Vertragsende ist das Ende der GELTUNG, nicht das Ende einer Zeile. Ein
Satzwechsel besteht aus zwei Zeilen (20 % bis 31.12., 18 % ab 01.01.) — würde
die erste Zeile ihr ``gueltig_bis`` an das Objekt schreiben, sperrte ein
Preisanpassung den Verkauf ab Silvester. Gefragt ist deshalb: *wann endet die
LETZTE Vertragszeile, die dieses Objekt abdeckt, und folgt danach noch etwas?*

  * Anschlussvertrag vorhanden  → kein Ende (nur ein Satzwechsel)
  * unbefristete Zeile          → kein Ende
  * letzte Zeile endet am Tag X → Vermarktungsende = X

ZWEI GELTUNGSEBENEN, OBJEKT SCHLÄGT EIGENTÜMER:
``property_id`` ist nullable: eine Zeile ohne Objekt gilt für ALLE Objekte des
Eigentümers, eine mit Objekt nur für dieses. Dieselbe Rangfolge wie in
``vertrag_aufloesen``: existiert für ein Objekt eine eigene Zeile, entscheidet
allein sie — die eigentümerweite Zeile ist für dieses Objekt abgelöst und darf
sein Ende nicht mitbestimmen.

WURZEL 1 — DER GEGENZUSTAND:
Jede der drei Schreibwege (anlegen, ändern, löschen) rechnet HINTERHER neu, und
zwar für jedes Objekt, das die Zeile VORHER oder NACHHER berührt hat. Sonst
bliebe ein Objekt gesperrt, dessen Vertrag gerade verlängert wurde. Durchgesetzt
wird ausschließlich über ``properties.vertragsende_durchsetzen`` — den einen
Einstiegspunkt, der Nächte sperrt UND freigibt und die Portale meldet.

WURZEL 4 — KEINE ERFUNDENEN WERTE:
Findet die Kopplung für ein Objekt keine Vertragszeile, schreibt sie NICHTS.
Ein Objekt ohne Abrechnungsvertrag hat sein Vermarktungsende aus einer anderen
Quelle (Kündigungsantrag, Handeintrag); ein ``None`` von hier würde diese
Entscheidung stumm löschen.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.features.properties.vertragsende import vertragsende_durchsetzen

log = get_logger("nextdays.owner_billing.vertragsende")


def _als_datum(wert: object) -> date | None:
    """Ein Datum aus einer PostgREST-Zeile. Leer bleibt leer (Wurzel 4)."""
    if wert is None or wert == "":
        return None
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert)[:10])


def betroffene_objekte(
    db: Client, tenant_id: str, owner_id: str, property_id: str | None
) -> list[str]:
    """Welche Objekte eine Vertragszeile berührt.

    Mit ``property_id`` genau dieses eine. Ohne — die Zeile gilt eigentümerweit
    — ALLE Objekte des Eigentümers: sein Vertrag endet, nicht der eines
    einzelnen Hauses.

    Gescopet über ``owner_properties`` JOIN ``properties.tenant_id`` (Wurzel 3):
    die Zuordnungstabelle allein würde ein Objekt eines fremden Mandanten
    mitnehmen, wenn dort je eine Fremdzeile landet.
    """
    if property_id:
        return [property_id]
    zuordnungen = (
        db.table("owner_properties")
        .select("property_id")
        .eq("owner_id", owner_id)
        .execute()
    ).data or []
    ids = [str(z["property_id"]) for z in zuordnungen if z.get("property_id")]
    if not ids:
        return []
    eigene = (
        db.table("properties")
        .select("id")
        .eq("tenant_id", tenant_id)
        .in_("id", ids)
        .execute()
    ).data or []
    return [str(p["id"]) for p in eigene]


def _zeilen_fuer_objekt(
    db: Client, tenant_id: str, owner_id: str, property_id: str
) -> list[dict[str, Any]]:
    """Die Vertragszeilen, die für DIESES Objekt gelten — Objekt schlägt
    Eigentümer.

    Gibt es objektbezogene Zeilen, gelten allein sie; die eigentümerweiten sind
    für dieses Objekt abgelöst. Andernfalls die eigentümerweiten.
    """
    alle = (
        db.table("owner_billing_terms")
        .select("id, property_id, gueltig_ab, gueltig_bis")
        .eq("tenant_id", tenant_id)
        .eq("owner_id", owner_id)
        .execute()
    ).data or []
    eigene = [z for z in alle if str(z.get("property_id") or "") == property_id]
    if eigene:
        return eigene
    return [z for z in alle if not z.get("property_id")]


def ende_bestimmen(zeilen: list[dict[str, Any]]) -> date | None:
    """Das Vermarktungsende aus den Vertragszeilen eines Objekts.

    ``None`` heißt „kein Ende" — unbefristet ODER Satzwechsel mit Anschluss.
    Beides ist derselbe Zustand für den Kalender: verkaufen erlaubt.

    Ein Anschluss ist eine Zeile, die AM Endtag oder davor beginnt: die
    Intervalle sind halb offen [ab, bis), der Endtag gehört bereits dem
    Folgevertrag. Eine Zeile, die später beginnt, lässt eine echte Lücke — dann
    endet der Vertrag, auch wenn irgendwann wieder einer anfängt.
    """
    if not zeilen:
        return None

    fenster: list[tuple[date, date | None]] = []
    for zeile in zeilen:
        ab = _als_datum(zeile.get("gueltig_ab"))
        if ab is None:
            # Ohne Beginn ist die Zeile nicht auswertbar. NOT NULL in der DB
            # (0343) — bleibt als Sicherung, damit ein Datenfehler hier nicht
            # stumm ein Vertragsende erfindet (Wurzel 4/5).
            continue
        fenster.append((ab, _als_datum(zeile.get("gueltig_bis"))))
    if not fenster:
        return None

    if any(bis is None for _, bis in fenster):
        return None

    # Der späteste Endtag ist der Kandidat. Endet dort eine Zeile und beginnt
    # keine andere spätestens an diesem Tag, ist es das Vertragsende.
    ende = max(bis for _, bis in fenster if bis is not None)
    if any(ab <= ende and (bis is None or bis > ende) for ab, bis in fenster):
        # Eine Zeile deckt den Kandidaten-Tag selbst noch ab → Anschluss.
        return None
    return ende


def _aktuelles_ende(db: Client, tenant_id: str, property_id: str) -> date | None:
    rows = (
        db.table("properties")
        .select("contract_end_date")
        .eq("tenant_id", tenant_id)
        .eq("id", property_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return None
    return _als_datum(rows[0].get("contract_end_date"))


def nachziehen(
    db: Client,
    tenant_id: str,
    owner_id: str,
    property_ids: list[str],
) -> list[dict[str, Any]]:
    """Für jedes Objekt das Vermarktungsende aus seinen Verträgen neu setzen.

    Der EINE Weg von der Abrechnung in den Kalender. Gibt je Objekt einen
    Protokolleintrag zurück — die Oberfläche zeigt daraus, was der Klick am
    Verkauf geändert hat, statt es nur stumm zu tun.

    Best-effort je Objekt (`# noqa: BLE001`): scheitert das Durchsetzen an
    einem Objekt (z. B. Push-Job), darf das den Vertrag nicht zurückrollen —
    der nächtliche `vertragsenden_nachziehen` holt den Kalender nach. Der
    Fehler wird geloggt UND im Protokoll zurückgegeben, nie verschluckt
    (Wurzel 5).
    """
    protokoll: list[dict[str, Any]] = []
    for property_id in property_ids:
        zeilen = _zeilen_fuer_objekt(db, tenant_id, owner_id, property_id)
        if not zeilen:
            # Kein Vertrag mehr für dieses Objekt: das Vermarktungsende hat
            # dann eine ANDERE Quelle (Kündigungsantrag, Handeintrag) und wird
            # nicht von hier gelöscht (Wurzel 4).
            log.info(
                "kopplung_uebersprungen",
                tenant_id=tenant_id,
                property_id=property_id,
                grund="keine_vertragszeile",
            )
            protokoll.append(
                {
                    "property_id": property_id,
                    "uebersprungen": "keine_vertragszeile",
                }
            )
            continue

        neu = ende_bestimmen(zeilen)
        alt = _aktuelles_ende(db, tenant_id, property_id)
        if neu == alt:
            log.info(
                "kopplung_unveraendert",
                tenant_id=tenant_id,
                property_id=property_id,
                ende=neu.isoformat() if neu else None,
            )
            protokoll.append(
                {
                    "property_id": property_id,
                    "ende": neu.isoformat() if neu else None,
                    "unveraendert": True,
                }
            )
            continue

        log.info(
            "kopplung_setzt_ende",
            tenant_id=tenant_id,
            property_id=property_id,
            owner_id=owner_id,
            ende_alt=alt.isoformat() if alt else None,
            ende_neu=neu.isoformat() if neu else None,
            zeilen=len(zeilen),
        )
        treffer = (
            db.table("properties")
            .update({"contract_end_date": neu.isoformat() if neu else None})
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .execute()
        ).data or []
        if not treffer:
            # Sichtbar machen: in der Oberfläche sähe das wie „nichts passiert"
            # aus, und der Kalender bliebe auf dem alten Stand.
            log.warning(
                "kopplung_update_ohne_treffer",
                tenant_id=tenant_id,
                property_id=property_id,
            )
            protokoll.append(
                {"property_id": property_id, "fehler": "objekt_nicht_gefunden"}
            )
            continue

        eintrag: dict[str, Any] = {
            "property_id": property_id,
            "ende_alt": alt.isoformat() if alt else None,
            "ende": neu.isoformat() if neu else None,
        }
        try:
            eintrag["gesperrte_naechte"] = vertragsende_durchsetzen(
                db, tenant_id, property_id, neu
            )
        except Exception as exc:  # noqa: BLE001
            # Den GRUND benennen, nicht nur „ging nicht" (Wurzel 5). Live
            # aufgetreten (12.08.2026): ein Objekt ohne `property_units` läuft
            # in `availability.unit_id NOT NULL`, weil `je_einheit` nichts zum
            # Auffächern findet. Das ist ein Datenfehler am Objekt und
            # absichtlich laut — ohne diese Unterscheidung sucht man den Fehler
            # aber in der Kopplung statt bei den fehlenden Einheiten.
            text = str(exc)
            grund = (
                "objekt_ohne_einheit"
                if "unit_id" in text and "not-null" in text.lower()
                else "kalender_nicht_gesetzt"
            )
            log.error(
                "kopplung_durchsetzen_fehler",
                tenant_id=tenant_id,
                property_id=property_id,
                grund=grund,
                fehler=text[:300],
            )
            eintrag["fehler"] = grund
        protokoll.append(eintrag)
    return protokoll
