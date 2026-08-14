"""Objektsuche für die Monitore — Freitext auf den Objektnamen.

WARUM EIN EIGENES MODUL FÜR BEIDE MONITORE:
Weder `channex_webhook_event` noch `worker_ereignis` trägt den Objektnamen; sie
tragen nur `property_id`. Die Suche muss deshalb zuerst in `properties` die
passenden IDs finden und dann die Ereignisse darauf filtern — dieselbe Geste in
beiden Monitoren, also EIN Modul statt zweier Implementierungen, die
auseinanderlaufen.

WARUM FREITEXT UND KEINE AUSWAHLLISTE:
Live sind es 43 Objekte (19 im Webhook-Monitor, 39 im Worker-Monitor). Eine
Auswahlliste wäre heute bequem und bei den erwarteten 100+ Objekten mehrerer
Betriebe selbst das Problem: ein Dropdown, durch das man scrollen muss, ist
keine Suche.

WARUM EINE OBERGRENZE AUF DIE TREFFER-IDS:
Die gefundenen IDs gehen als `in_(...)`-Liste in die Ereignisabfrage — also in
die URL des PostgREST-Requests. Ein einzelnes Zeichen als Suchbegriff („e")
träfe sonst alle Objekte der Plattform und baute mit wachsendem Bestand eine
immer längere URL, bis der Request an einer Längengrenze scheitert (Wurzel 8:
jeder unbegrenzte Bereich bekommt eine harte Obergrenze). Die Grenze ist
großzügig genug, dass sie eine echte Suche nie trifft.
"""

from __future__ import annotations

from supabase import Client

from src.core.supabase import escape_like

#: Mehr Treffer als das nimmt keine sinnvolle Suche an — und die IDs müssen in
#: die Request-URL passen. Wird die Grenze erreicht, ist der Begriff zu unscharf.
MAX_TREFFER = 200


def property_ids_zu_suche(db: Client, suche: str) -> list[str]:
    """Die IDs aller Objekte, deren Titel `suche` enthält (case-insensitiv).

    Gibt eine LEERE Liste zurück, wenn nichts passt. Das ist ein echtes
    Ergebnis, kein Fehler: Der Aufrufer muss daraus „keine Treffer" machen und
    darf den Filter NICHT stillschweigend weglassen — sonst zeigte eine
    Suche ohne Treffer die ungefilterte Liste, und das sähe aus, als hätte das
    gesuchte Objekt jedes dieser Ereignisse ausgelöst (Wurzel 4).
    """
    begriff = suche.strip()
    if not begriff:
        return []
    rows = (
        db.table("properties")
        .select("id")
        .ilike("title", f"%{escape_like(begriff)}%")
        .limit(MAX_TREFFER)
        .execute()
    ).data or []
    return [str(r["id"]) for r in rows]
