"""Live-Probe der KI-Wissensdatenbank und der Eskalation.

WOZU: Die Unit-Tests laufen gegen eine Fake-DB, die erfundene Spalten
klaglos annimmt. Was sie NICHT beweisen können: dass die Spalten in der
LIVE-DB heissen wie im Code, dass die Rechte sitzen und dass Gemini ein PDF
tatsächlich liest. Genau dort lagen bisher die stillen Fehler.

Geprüft wird in dieser Reihenfolge:

  1. Schema — jede neue Spalte und Tabelle aus 0496–0500
  2. Rechte (Wurzel 6) — 0 Grants für anon/authenticated
  3. Kontext-Sammler — läuft er gegen ein echtes Objekt durch, und was
     kommt dabei heraus (Zeichenzahl, Quellen, Weggelassenes)
  4. Themensperre — die vier gesperrten Themen greifen
  5. Dublettenprüfung des Lernens

Es wird NICHTS geschrieben und NICHTS gesendet: reine Lesevorgänge und
reine Funktionsaufrufe. Der Vertex-Aufruf ist optional (`--ki`), weil er
Geld kostet.

Aufruf (aus apps/api):
    uv run python ../../scripts/diagnose/ki-wissen-pruefen.py
    uv run python ../../scripts/diagnose/ki-wissen-pruefen.py --ki
"""
from __future__ import annotations

import sys
from datetime import UTC, datetime

sys.path.insert(0, ".")

from src.core.supabase import get_service_client  # noqa: E402
from src.features.inbox.ki_kontext import kontext_bauen  # noqa: E402
from src.features.inbox.ki_lernen import _ist_dublette  # noqa: E402
from src.features.inbox.ki_regeln import gesperrtes_thema  # noqa: E402
from src.features.inbox.ki_wissen import KATEGORIEN  # noqa: E402

GRUEN = "\033[32m✓\033[0m"
ROT = "\033[31m✗\033[0m"

fehler = 0


def pruefe(bedingung: bool, text: str, zusatz: str = "") -> None:
    global fehler  # noqa: PLW0603
    if bedingung:
        print(f"  {GRUEN} {text}{f'  {zusatz}' if zusatz else ''}")
    else:
        fehler += 1
        print(f"  {ROT} {text}{f'  {zusatz}' if zusatz else ''}")


def main() -> int:
    db = get_service_client()
    if db is None:
        print(f"{ROT} Keine DB-Verbindung — SUPABASE_* gesetzt?")
        return 1

    print("\n1. Schema (0496–0500)")
    for tabelle, spalten in [
        ("inbox_knowledge_fact", "id, titel, kategorie, quelle_id"),
        ("ki_wissen_quelle", "id, art, datei_name, thread_id"),
        ("ki_eskalation", "id, thread_id, ausloeser, grund, erledigt_at"),
        ("ki_regel", "id, eskalation_posteingang"),
        ("inbox_ai_settings", "tenant_id, antwortlaenge"),
    ]:
        try:
            db.table(tabelle).select(spalten).limit(1).execute()
            pruefe(True, f"{tabelle}: {spalten}")
        except Exception as exc:  # noqa: BLE001 — Diagnose meldet, was kommt
            pruefe(False, f"{tabelle}: {spalten}", str(exc)[:120])

    print("\n2. Kategorien")
    pruefe(len(KATEGORIEN) == 7, f"sieben Kategorien: {', '.join(KATEGORIEN)}")

    print("\n3. Kontext-Sammler gegen ein echtes Objekt")
    objekte = (
        db.table("properties")
        .select("id, tenant_id, title, city, description, amenities, max_guests, "
                "property_type, type_attributes")
        .not_.is_("type_attributes", "null")
        .limit(20)
        .execute()
    ).data or []
    # Das Objekt mit der GRÖSSTEN Gästemappe: dort greift der Deckel, und
    # nur dort zeigt sich, ob die Auswahl etwas taugt.
    objekte.sort(key=lambda p: len(str(p.get("type_attributes") or "")), reverse=True)
    if not objekte:
        pruefe(False, "kein Objekt mit type_attributes gefunden")
    else:
        prop = objekte[0]
        roh = len(str(prop.get("type_attributes") or ""))
        for frage in ("Wie ist das WLAN?", "Wann können wir anreisen?",
                      "Sind Hunde erlaubt?"):
            k = kontext_bauen(
                db,
                str(prop["tenant_id"]),
                prop=prop,
                frage=frage,
                sprache="de",
                status="confirmed",
                heute=datetime.now(UTC).date(),
            )
            pruefe(
                k.zeichen > 0 and k.zeichen <= 14_000,
                f"'{frage}' -> {k.zeichen} Zeichen aus {roh} roh",
                f"Quellen: {', '.join(k.quellen[:4])}",
            )
            if k.weggelassen:
                print(f"      weggelassen: {'; '.join(k.weggelassen[:3])}")

    print("\n4. Themensperre (nicht abschaltbar)")
    for frage, erwartet in [
        ("Können Sie mir den Betrag erstatten?", True),
        ("Can I get a refund?", True),
        ("Es gab einen Wasserschaden im Bad.", True),
        ("Können Sie uns die Woche danach reservieren?", True),
        ("Wie ist das WLAN-Passwort?", False),
        ("Wo ist der nächste Supermarkt?", False),
        ("Der Weg zurück zum Strand?", False),
    ]:
        treffer = gesperrtes_thema(frage) is not None
        pruefe(treffer == erwartet, f"'{frage}' -> {'gesperrt' if treffer else 'frei'}")

    print("\n5. Dublettenprüfung des Lernens")
    for neu, bestand, erwartet in [
        ("Das WLAN heisst MERCUSYS.", ["Das WLAN heisst MERCUSYS."], True),
        ("Das WLAN heisst MERCUSYS.", ["Der Strand ist 300 Meter entfernt."], False),
    ]:
        pruefe(_ist_dublette(neu, bestand) is erwartet, f"'{neu[:40]}' -> {erwartet}")

    print()
    if fehler:
        print(f"{ROT} {fehler} Befund(e).")
        return 1
    print(f"{GRUEN} Alles grün.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
