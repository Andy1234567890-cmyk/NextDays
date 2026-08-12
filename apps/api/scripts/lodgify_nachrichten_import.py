"""Nachrichtenverlauf der übernommenen Website-Buchungen importieren (0382).

WAS: Zu jeder aus Lodgify übernommenen Buchung (`lodgify_booking_id` gesetzt)
den zugehörigen Thread nach `reservation_nachricht_uebernahme` schreiben —
als eingefrorenes Archiv, getrennt von jedem laufenden Nachrichtenweg.

NICHTS WIRD VERMISCHT (die ausdrückliche Anforderung):
  * NICHT nach `guest_messages`   — das ist der Marktplatz-Chat myBestDays.
  * NICHT nach `portal_messages`  — das sind OTA-Nachrichten (Channel-Manager).
  * NICHT nach `messages`         — das ist der laufende Betriebs-Posteingang.
Jede Zeile trägt `herkunft='lodgify'` und `kanal='website'`, ist also auch
später eindeutig als übernommene Website-Korrespondenz erkennbar.

HTML → KLARTEXT beim Import (Wurzel 8): Lodgify liefert die Nachrichten als
HTML. Roh gespeichert wäre es ein XSS-Sink, sobald es irgendwo gerendert wird.
Gewandelt wird mit `inbox.felder.html_zu_text` — demselben Helfer, den der
Nachrichten-Composer benutzt; er erhält Listen und Absätze, statt alles zu
einer Textwand zu verkleben.

AUFRUF (Trockenlauf ist Standard):
    uv run python scripts/lodgify_nachrichten_import.py --threads <threads.json> \
        --eingabe <bookings.json> --tenant <uuid> [--schreiben]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.supabase import get_service_client  # noqa: E402
from src.features.inbox.felder import html_zu_text  # noqa: E402

# Lodgify kennzeichnet die Richtung am Nachrichtentyp.
_RICHTUNG = {"Renter": "gast", "Owner": "gastgeber"}
HERKUNFT = "lodgify"
KANAL = "website"


def buchungen_je_lodgify_id(db, tenant_id: str) -> dict[str, str]:
    """lodgify_booking_id → unsere reservation_id (nur übernommene Buchungen)."""
    zeilen = (
        db.table("reservations")
        .select("id, lodgify_booking_id")
        .eq("tenant_id", tenant_id)
        .not_.is_("lodgify_booking_id", "null")
        .execute()
    ).data or []
    return {str(z["lodgify_booking_id"]): str(z["id"]) for z in zeilen}


def bekannte_quelle_ids(db, tenant_id: str) -> set[str]:
    """Was schon importiert ist — die Anwendungsseite der Idempotenz."""
    zeilen = (
        db.table("reservation_nachricht_uebernahme")
        .select("quelle_id")
        .eq("tenant_id", tenant_id)
        .eq("herkunft", HERKUNFT)
        .execute()
    ).data or []
    return {str(z["quelle_id"]) for z in zeilen if z.get("quelle_id")}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--threads", required=True, help="lodgify_threads.json")
    p.add_argument("--tenant", required=True)
    p.add_argument("--schreiben", action="store_true")
    args = p.parse_args()

    threads = json.loads(Path(args.threads).read_text(encoding="utf-8"))
    db = get_service_client()
    je_lodgify = buchungen_je_lodgify_id(db, args.tenant)
    bekannt = bekannte_quelle_ids(db, args.tenant)

    modus = "SCHREIBEN" if args.schreiben else "TROCKENLAUF (nichts wird angelegt)"
    print(f"=== Nachrichten-Übernahme — {modus}")
    print(f"{len(je_lodgify)} übernommene Buchung(en) im Bestand\n")

    neu = uebersprungen = ohne_buchung = 0
    for lodgify_id, thread in sorted(threads.items()):
        reservation_id = je_lodgify.get(str(lodgify_id))
        if not reservation_id:
            # Kein Raten: ohne zugeordnete Buchung gibt es kein Ziel.
            print(f"  Buchung {lodgify_id}: nicht im Bestand — übersprungen")
            ohne_buchung += 1
            continue

        nachrichten = thread.get("messages") or []
        zeilen: list[dict] = []
        for m in nachrichten:
            quelle_id = str(m.get("id") or "").strip() or None
            if quelle_id and quelle_id in bekannt:
                uebersprungen += 1
                continue
            richtung = _RICHTUNG.get(str(m.get("type") or ""))
            if richtung is None:
                # Unbekannte Richtung: NICHT auf „gastgeber" raten — in einem
                # Verlauf ist die Richtung die halbe Aussage (Wurzel 4).
                print(f"  Nachricht {quelle_id}: Typ {m.get('type')!r} unbekannt")
                continue
            text = html_zu_text(m.get("message") or "")
            if not text.strip():
                continue
            zeilen.append(
                {
                    "tenant_id": args.tenant,
                    "reservation_id": reservation_id,
                    "herkunft": HERKUNFT,
                    "kanal": KANAL,
                    "quelle_thread": thread.get("thread_uid"),
                    "quelle_id": quelle_id,
                    "richtung": richtung,
                    "betreff": (m.get("subject") or "").strip() or None,
                    "text": text,
                    # Wurzel 5b: Zeitpunkt aus der QUELLE, nicht unsere Uhr.
                    "gesendet_at": m.get("date_created"),
                    "anhaenge_anzahl": len(m.get("attachments") or []),
                }
            )

        gast = thread.get("guest_name") or ""
        if not zeilen:
            print(f"  {gast[:24]:<24} nichts Neues ({len(nachrichten)} bekannt)")
            continue

        if args.schreiben:
            for zeile in zeilen:
                try:
                    db.table("reservation_nachricht_uebernahme").insert(
                        zeile
                    ).execute()
                except Exception as exc:  # noqa: BLE001 — eine Zeile kippt nicht alles
                    if "reservation_nachricht_uebernahme_quelle_uidx" in str(exc):
                        uebersprungen += 1
                        continue
                    print(f"  FEHLER bei {zeile['quelle_id']}: {str(exc)[:100]}")
                    continue
                neu += 1
        else:
            neu += len(zeilen)
        gastanteil = sum(1 for z in zeilen if z["richtung"] == "gast")
        print(
            f"  {gast[:24]:<24} {len(zeilen):>3} Nachricht(en) "
            f"({gastanteil} vom Gast) {'übernommen' if args.schreiben else 'würden übernommen'}"
        )

    print(
        f"\nneu: {neu} · schon bekannt: {uebersprungen} · "
        f"ohne Buchung: {ohne_buchung}"
    )
    if not args.schreiben:
        print("\nTrockenlauf — es wurde NICHTS geschrieben. Mit --schreiben ausführen.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
