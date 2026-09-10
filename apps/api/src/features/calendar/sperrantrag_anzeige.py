"""Ein Sperrantrag als ANTWORT: Zeile → Modell, samt Objektfoto.

Ausgelagert aus `sperrantraege.py`, das mit exakt 1500 Zeilen an pylints
`too-many-lines` stand. Der ehrliche Anlass ist also die Zeilengrenze, nicht
eine fachliche Einsicht — und `_item` ist der generische Zeilen-Mapper des
Slice, kein Anzeige-Detail.

Trotzdem gehoert beides zusammen und nicht zum Rest: hier steht, WIE eine
Antragszeile zur Antwort wird (`_item`, `_als_datum`) und WORAN die
Entscheiderin das Objekt erkennt (`objekt_fotos`). Im Service bleibt der
Zustandsautomat: WAS mit einem Antrag passiert. Dieselbe Trennlinie wie bei
`sperrantrag_meldung.py`, wo steht, WER davon erfaehrt.
"""
from __future__ import annotations

from datetime import date

from supabase import Client

from .schemas import BestellteLeistungItem, SperrantragItem


def objekt_fotos(
    db: Client, tenant_id: str, property_ids: set[str]
) -> dict[str, str]:
    """Erstes Objektfoto je Objekt — dieselbe Quelle wie im Eigentuemer-Portal.

    WOZU: Die Warteschlange zeigte an dieser Stelle fuer JEDEN Antrag dasselbe
    Hand-Symbol. Wer ueber eine Sperre entscheidet, erkennt das Haus am Bild
    schneller als am Namen — und bei gleichlautenden Titeln („Feriehus Britt"
    I und II) am Namen ueberhaupt nicht.

    Objekte ohne Foto stehen NICHT im Ergebnis: die Oberflaeche faellt dann auf
    ihr Symbol zurueck, statt ein Platzhalterbild zu erfinden (Wurzel 4).

    `tenant_id` ist Pflicht (Wurzel 3): die Service-Role umgeht RLS, ein Lookup
    allein ueber `id` laege damit ueber alle Mandanten.
    """
    if not property_ids:
        return {}
    rows = (
        db.table("properties")
        .select("id, photos")
        .eq("tenant_id", tenant_id)
        .in_("id", sorted(property_ids))
        .execute()
    ).data or []
    fotos: dict[str, str] = {}
    for r in rows:
        erstes = (r.get("photos") or [None])[0]
        if erstes:
            fotos[str(r["id"])] = str(erstes)
    return fotos


def _als_datum(wert: object) -> date:
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert))


def _item(
    r: dict,
    titel: dict[str, str],
    namen: dict[str, str],
    einheiten: dict[str, str] | None = None,
    bestellt: list[BestellteLeistungItem] | None = None,
    fotos: dict[str, str] | None = None,
) -> SperrantragItem:
    pid = str(r["property_id"])
    uid = str(r["unit_id"]) if r.get("unit_id") else None
    requested_by = str(r["requested_by"]) if r.get("requested_by") else None
    return SperrantragItem(
        id=str(r["id"]),
        property_id=pid,
        property_title=titel.get(pid),
        property_photo=(fotos or {}).get(pid),
        unit_id=uid,
        unit_name=(einheiten or {}).get(uid or ""),
        requested_by=requested_by,
        requested_by_name=namen.get(requested_by or ""),
        start_date=_als_datum(r["start_date"]),
        end_date=_als_datum(r["end_date"]),
        status=r.get("status") or "pending",
        reason=r.get("reason"),
        decided_by=str(r["decided_by"]) if r.get("decided_by") else None,
        decided_at=str(r["decided_at"]) if r.get("decided_at") else None,
        decision_note=r.get("decision_note"),
        created_at=str(r["created_at"]) if r.get("created_at") else None,
        ist_kuendigung=bool(r.get("ist_kuendigung")),
        als_kuendigung_gewertet=bool(r.get("als_kuendigung_gewertet")),
        vertragsende_gesetzt_auf=(
            _als_datum(r["vertragsende_gesetzt_auf"])
            if r.get("vertragsende_gesetzt_auf")
            else None
        ),
        bestellte_leistungen=bestellt or [],
        aufhebung=str(r.get("aufhebung") or "keine"),
        aufhebung_grund=r.get("aufhebung_grund"),
        aufhebung_beantragt_am=(
            str(r["aufhebung_beantragt_am"])
            if r.get("aufhebung_beantragt_am")
            else None
        ),
        aufhebung_entscheidungsnotiz=r.get("aufhebung_entscheidungsnotiz"),
    )
