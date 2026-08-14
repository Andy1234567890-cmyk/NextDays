"""Zeigt, WELCHE Gebühren- und Steuerarten die Portale wirklich schicken.

Die Frage, die dieses Skript beantwortet: *Kennt unser System jede Art, die im
Bestand vorkommt — oder läuft etwas unter „unbekannt" mit?*

WARUM ES DAS BRAUCHT (live gefunden 14.08.2026):

Booking meldet die Art einer Gebühr als freien Text in ``rooms[].taxes[].name``,
und dieser Text kommt in der Sprache des INSERATS. Der Betrieb führt seine
Objekte auf Dänisch, Deutsch und Englisch — dieselbe Reinigungsgebühr heißt
darum „Reinigungsgebühr", „Cleaning fee" oder „Rengøringsgebyr". Eine feste
Namensliste ist gegen dieses Feld prinzipiell unvollständig, und weder Booking
noch Channex dokumentieren die vollständige Liste ihrer Arten.

Der Leser (``owner_statements.gebuehren_quelle``) löst deshalb in drei Stufen
auf: Namensliste → sprachneutraler Schlüssel aus ``meta.charge_periods`` →
Auffangnetz ``portal:<originaltext>``. Die dritte Stufe verhindert, dass eine
unbekannte Art die ganze Eigentümer-Abrechnung blockiert (genau das tat sie bei
Feriehus Rævehulen: „Mehrwertsteuer (25%)" stand in keiner Liste). Der Betrag
ist dabei nie geraten — er steht als ``total_price`` im Payload.

Aber ein Auffangnetz, in das niemand hineinsieht, ist ein stiller Sammler. Genau
dafür ist dieses Skript da: es listet jede Art auf, die im Bestand vorkommt, und
sagt bei jeder, ÜBER WELCHE STUFE sie erkannt wurde. Was unter Stufe 3 landet,
gehört in ``_BOOKING_ARTEN`` bzw. ``_BOOKING_SCHLUESSEL_ARTEN`` nachgetragen.

Aufruf::

    cd apps/api
    python -m scripts.portal_gebuehrenarten_pruefen                 # alle
    python -m scripts.portal_gebuehrenarten_pruefen --tenant <uuid> # einer
    python -m scripts.portal_gebuehrenarten_pruefen --exit-code     # Exit 1

Nur LESEND. ``--exit-code`` macht es für einen Cron/CI-Lauf nutzbar: solange
jede Art über Stufe 1 oder 2 aufgeht, ist es still.
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from typing import TYPE_CHECKING, Any

from src.core.supabase import get_service_client
from src.features.owner_statements.gebuehren_quelle import (
    _BOOKING_ARTEN,
    _STEUER_ARTEN,
    _booking_schluessel_arten,
    _ist_booking_steuer,
)

if TYPE_CHECKING:  # pragma: no cover - nur für die Typprüfung
    from supabase import Client

# Stufen der Auflösung, in der Reihenfolge, in der der Leser sie versucht.
STUFE_NAME = "name"
STUFE_SCHLUESSEL = "schluessel"
STUFE_UNBEKANNT = "unbekannt"
STUFE_STEUER = "steuer"

_KOPF = {
    STUFE_UNBEKANNT: (
        "UNBEKANNT — weder Name noch Schlüssel lösen die Art auf "
        "(läuft als portal:<text>)"
    ),
    STUFE_SCHLUESSEL: (
        "Nur über den Schlüssel erkannt — Name gehört in _BOOKING_ARTEN"
    ),
    STUFE_STEUER: "Als Steuer erkannt (gehört nicht in die Auszahlung)",
    STUFE_NAME: "Über die Namensliste erkannt (alles in Ordnung)",
}


def _buchungen(db: Client, tenant_id: str | None) -> list[dict[str, Any]]:
    q = db.table("channex_booking").select(
        "id, tenant_id, property_id, ota_name, ota_reservation_code, raw"
    )
    if tenant_id:
        q = q.eq("tenant_id", tenant_id)
    return q.execute().data or []


def _stufe(posten: dict[str, Any], zimmer: dict[str, Any]) -> tuple[str, str]:
    """Über welche Stufe wird dieser Posten aufgelöst? → (stufe, art)."""
    text = str(posten.get("name") or "").strip()
    if _ist_booking_steuer(posten):
        return STUFE_STEUER, str(posten.get("type") or "")
    art = _BOOKING_ARTEN.get(text.casefold())
    if art is not None:
        return STUFE_NAME, art
    schluessel = [
        a for a in _booking_schluessel_arten(zimmer) if a not in _STEUER_ARTEN
    ]
    if len(schluessel) == 1:
        return STUFE_SCHLUESSEL, schluessel[0]
    return STUFE_UNBEKANNT, f"portal:{text.casefold()}" if text else "portal:unbenannt"


def pruefen(
    db: Client, tenant_id: str | None
) -> dict[str, dict[str, dict[str, Any]]]:
    """Je Stufe: die vorkommenden Arten mit Anzahl und einem Beispiel."""
    befunde: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for buchung in _buchungen(db, tenant_id):
        raw = buchung.get("raw")
        if not isinstance(raw, dict):
            continue
        for zimmer in raw.get("rooms") or []:
            if not isinstance(zimmer, dict):
                continue
            for posten in zimmer.get("taxes") or []:
                if not isinstance(posten, dict):
                    continue
                stufe, art = _stufe(posten, zimmer)
                text = str(posten.get("name") or "").strip() or "(ohne Namen)"
                eintrag = befunde[stufe].setdefault(
                    text,
                    {
                        "anzahl": 0,
                        "art": art,
                        "typ": str(posten.get("type") or ""),
                        "preismodus": str(posten.get("price_mode") or ""),
                        "portal": str(buchung.get("ota_name") or ""),
                        "beispiel": str(buchung.get("ota_reservation_code") or ""),
                    },
                )
                eintrag["anzahl"] += 1
    return befunde


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant", help="nur dieser Betrieb (UUID)")
    parser.add_argument(
        "--exit-code",
        action="store_true",
        help="Exit 1, wenn eine Art unbekannt ist",
    )
    args = parser.parse_args()

    befunde = pruefen(get_service_client(), args.tenant)
    if not any(befunde.values()):
        print("Keine Portal-Gebührenposten im Bestand gefunden.")
        return 0

    for stufe, kopf in _KOPF.items():
        arten = befunde.get(stufe) or {}
        if not arten:
            continue
        print(f"\n=== {kopf} ({len(arten)}) ===")
        for text, info in sorted(
            arten.items(), key=lambda kv: -kv[1]["anzahl"]
        ):
            print(
                f"  {text!r} ×{info['anzahl']}  → {info['art']}"
                f"  [typ={info['typ']!r} modus={info['preismodus']!r}"
                f" portal={info['portal']} bsp={info['beispiel']}]"
            )

    offen = befunde.get(STUFE_UNBEKANNT) or {}
    ueber_schluessel = befunde.get(STUFE_SCHLUESSEL) or {}
    if ueber_schluessel:
        print(
            "\nDie oben unter „Nur über den Schlüssel erkannt“ genannten "
            "Namen sind bereits richtig zugeordnet, hängen aber am Auffangnetz. "
            "Trag sie in `_BOOKING_ARTEN` (gebuehren_quelle.py) nach, dann "
            "greift Stufe 1 — das ist die genauere: Bookings Schlüssel "
            "unterscheidet z. B. Reinigung und Endreinigung nicht."
        )
    if offen:
        print(
            "\nDie UNBEKANNTEN Arten sind der eigentliche Befund: der Betrag "
            "stimmt und die Abrechnung läuft, aber die Kategorie ist offen — "
            "der Posten trägt keine Aussage darüber, wem er gehört und ob er "
            "provisionspflichtig ist. Sieh im Portal nach, was die Art "
            "bedeutet, und trag sie in `_BOOKING_ARTEN` bzw. "
            "`_BOOKING_SCHLUESSEL_ARTEN` nach. Bis dahin verlangt "
            "`gebuehren_zuordnen` die Zuordnung durch den Betrieb "
            "(Abschnitt 'Wem gehören die Gebühren?')."
        )
        return 1 if args.exit_code else 0
    print("\nJede vorkommende Art ist bekannt.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
