"""Objekt, Zeitraum und Elternzeile einer Beleg-Position (0702).

Drei Dinge, die sich weder in `service.py` noch in `angebote_bestand.py`
doppeln sollen, weil beide Wege (Rechnung und Angebot) dieselben Spalten
schreiben:

* `objekte_pruefen` — Wurzel 3: `property_id` kommt aus dem Client. Die
  Service-Role umgeht RLS, also MUSS jede genannte Objekt-ID explizit gegen den
  Tenant geprüft werden, bevor sie in einen Beleg wandert.
* `eltern_positionen` / `eltern_verknuepfen` — der Editor kennt nur seine
  eigenen Client-IDs; die DB-Zeilen entstehen bei JEDEM Speichern neu. Die
  Zuordnung „Zusatzleistung gehört zu dieser Übernachtung" wird daher über die
  POSITION aufgelöst, nachdem die Zeilen geschrieben sind. Die Alternative
  (Client-UUID als Zeilen-`id` einsetzen) wurde verworfen: der Editor fällt
  ohne `crypto.randomUUID` auf eine Base36-Zufallszeichenkette zurück, die
  keine UUID ist — das hätte einen 500 beim Speichern erzeugt, sichtbar erst
  live.
"""
from __future__ import annotations

from collections.abc import Sequence
from datetime import date

from supabase import Client

from src.core.supabase import load_scoped

# Die Client-Form des Editors spricht camelCase, die interne Form snake_case —
# beide Schreibweisen kommen real an (wie bei quantity/unitPrice).
_FELDER = (
    ("property_id", ("propertyId", "property_id")),
    ("check_in", ("checkIn", "check_in")),
    ("check_out", ("checkOut", "check_out")),
)


def _iso(value: object) -> str | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value)[:10]).isoformat()
    except ValueError:
        return None


def aufenthalt_aus_bestand(item: dict) -> dict[str, str | None]:
    """Objekt + Zeitraum einer Position aus der Client-Form.

    Wirft `ValueError`, wenn die Abreise nicht nach der Anreise liegt — der
    Aufrufer macht daraus seinen 422. Kein Tauschen, kein Zurechtbiegen.
    """
    werte: dict[str, str | None] = {}
    for spalte, schluessel in _FELDER:
        roh = next((item[k] for k in schluessel if item.get(k) not in (None, "")), None)
        werte[spalte] = str(roh) if spalte == "property_id" and roh else _iso(roh)
    if werte["check_in"] and werte["check_out"] and werte["check_out"] <= werte["check_in"]:
        raise ValueError("Abreise muss nach der Anreise liegen.")
    return werte


def objekte_pruefen(
    db: Client,
    tenant_id: str,
    property_ids: Sequence[str | None],
    *,
    not_found: Exception,
) -> None:
    """Jede genannte Objekt-ID muss dem Tenant gehören — sonst `not_found`."""
    for pid in {p for p in property_ids if p}:
        load_scoped(db, "properties", pid, tenant_id, columns="id", not_found=not_found)


def objekt_titel(
    db: Client, tenant_id: str, property_ids: Sequence[str | None]
) -> dict[str, str]:
    """Objekttitel je ID — für die Ausgabe („Objekt · Anreise – Abreise").

    Tenant-gescopt wie jeder Lesezugriff der Service-Role (Wurzel 3); fehlt der
    Titel, bleibt die ID ohne Eintrag und die Ausgabe zeigt nichts statt eines
    erfundenen Namens (Wurzel 4).
    """
    ids = sorted({str(p) for p in property_ids if p})
    if not ids:
        return {}
    rows = (
        db.table("properties")
        .select("id, title")
        .eq("tenant_id", tenant_id)
        .in_("id", ids)
        .execute()
    ).data or []
    return {str(r["id"]): str(r.get("title") or "") for r in rows if r.get("title")}


def eltern_positionen(
    paare: Sequence[tuple[str | None, str | None]],
) -> list[tuple[int, int]]:
    """(eigene Client-ID, Eltern-Client-ID) je Zeile → (Kind-Pos, Eltern-Pos).

    Positionen sind 1-basiert wie in der Tabelle. Eine Elternangabe, die auf
    keine mitgeschickte Zeile zeigt (die Übernachtung wurde gelöscht), wird
    still verworfen — die Zusatzleistung bleibt als eigenständige Position
    stehen, genau wie es die Oberfläche zeigt.
    """
    position_je_id = {
        eigen: nr for nr, (eigen, _) in enumerate(paare, start=1) if eigen
    }
    ergebnis: list[tuple[int, int]] = []
    for nr, (_, eltern) in enumerate(paare, start=1):
        ziel = position_je_id.get(eltern or "")
        if ziel is not None and ziel != nr:
            ergebnis.append((nr, ziel))
    return ergebnis


def eltern_verknuepfen(
    db: Client,
    tabelle: str,
    fk_spalte: str,
    beleg_id: str,
    paare: Sequence[tuple[int, int]],
) -> None:
    """`parent_line_id` der frisch geschriebenen Zeilen setzen.

    Liest die Zeilen des Belegs nach dem Insert zurück (Position → echte ID)
    und setzt die Verknüpfung. Ohne Kind-Zeilen passiert nichts — der
    Normalfall zahlt keinen Roundtrip.
    """
    if not paare:
        return
    zeilen = (
        db.table(tabelle)
        .select("id, position")
        .eq(fk_spalte, beleg_id)
        .order("position")
        .execute()
    ).data or []
    id_je_position = {int(z["position"]): str(z["id"]) for z in zeilen if z.get("position")}
    for kind, eltern in paare:
        kind_id = id_je_position.get(kind)
        eltern_id = id_je_position.get(eltern)
        if kind_id and eltern_id:
            db.table(tabelle).update({"parent_line_id": eltern_id}).eq(
                "id", kind_id
            ).execute()
