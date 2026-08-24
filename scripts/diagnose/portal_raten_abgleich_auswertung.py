"""Auswertung EINER Kennung fuer den Trockenlauf portal-raten-abgleich.sh.

Liest drei Umgebungsvariablen und gibt EINE Zeile
`<anzahl-anlegen>|<anzahl-loeschen>|<befund>` aus:

  RATEN   Antwort von POST /channels/mapping_details (was das Portal fuehrt)
  KANAL   Antwort von GET  /channels/{id}            (worauf jede Rate zeigt)
  PLAENE  "<channex_rate_plan_id>=<planname>", mit '~~' getrennt (was wir haben)

Die Regel ist genau die des Jobs (`portal_raten_abgleich`), damit der
Trockenlauf keine zweite Wahrheit erfindet:

  BELEGT = die Rate zeigt auf einen Plan, der IHR gehoert (sein Name ist ihr
           Titel) ODER sie ist die PRIMAERE Rate eines namensfremden Plans (im
           Regelfall der Grundpreis) — die behaelt er.
  FEHLT  = jede andere Rate, deren Titel kein lokaler Plan traegt.
  VERWAIST = umgekehrte Richtung: ein KANAL-Eintrag, dessen `rate_plan_code` das
           Portal nicht mehr fuehrt. Er wird nicht bloss unordentlich
           mitgeschleppt, er kippt den Preis-Push des ganzen Zimmers. Live am
           24.08.2026 02:02 bei „Feriehus Line" (Hotel 11659051):
           <Error Code="RATE_NOT_ACTIVE_FOR_ROOM" ShortText="Rate '65900767' is
           not active for room '1165905102'"/> -> Result: Failure.
           `portal_raten_abgleich._verwaiste_kanal_eintraege_entfernen` loescht
           diese Eintraege; dieses Skript zeigt nur, WELCHE es waeren.

Warum nicht einfach „ist gemappt": weil dann nichts fehlte. Live gemessen am
23.08.2026 zeigen bei „Bedstefars lille skovhus" BEIDE Booking-Raten auf
denselben Plan „Grundpreis" — nur eine davon primaer. Die andere verkauft mit,
traegt aber keine eigenen Werte; genau das ist der Befund, den dieser Lauf
sichtbar machen soll.

Und warum nicht ueber die Reihenfolge: Channex liefert die WOCHENRATE VORN und
die primaere Standard Rate dahinter. „Die erste behaelt der Plan" haette den
Befund umgedreht.

Ein leerer/fehlgeschlagener Abruf ergibt „?" und NICHT „nichts fehlt": leer
heisst hier „nicht gemessen" (fail-closed, wie im Job selbst).
"""
import json
import os


def _laden(name: str) -> dict:
    """JSON aus der Umgebung; `{}` bei allem, was kein Objekt ist."""
    try:
        wert = json.loads(os.environ.get(name) or "{}")
    except json.JSONDecodeError:
        return {}
    return wert if isinstance(wert, dict) else {}


def _portal_raten(roh: dict) -> dict[str, str]:
    """{code: titel} aus mapping_details — beide Booking-Formen."""
    data = roh.get("data") or {}
    raeume = data.get("rooms")
    if not raeume:
        raeume = (data.get("attributes") or {}).get("room_types") or []
    raten: dict[str, str] = {}
    for raum in raeume:
        for rate in (raum.get("rates") or raum.get("rate_plans") or []):
            code = rate.get("id")
            if code is not None:
                raten[str(code)] = (rate.get("title") or "").strip()
    return raten


def _plannamen() -> tuple[dict[str, str], set[str]]:
    """({channex_id: planname}, {plannamen klein}) aus PLAENE."""
    je_id: dict[str, str] = {}
    namen: set[str] = set()
    for eintrag in (os.environ.get("PLAENE") or "").split("~~"):
        if "=" not in eintrag:
            continue
        cx, name = eintrag.split("=", 1)
        name = name.strip()
        if not name:
            continue
        namen.add(name.lower())
        if cx.strip():
            je_id[cx.strip()] = name
    return je_id, namen


raten = _portal_raten(_laden("RATEN"))
kanal_roh = _laden("KANAL")
name_je_cx, plan_namen = _plannamen()

if not raten:
    # Fail-closed, genau wie der Job: leer heisst „nicht gemessen". Ein
    # Trockenlauf, der hier ALLE Kanal-Eintraege als verwaist meldete, wuerde
    # zum Loeschen des ganzen Mappings raten.
    print("0|0|? mapping_details lieferte keine Rate (nicht gemessen)")
    raise SystemExit(0)
if not kanal_roh.get("data"):
    print("0|0|? Kanal nicht lesbar — worauf die Raten zeigen, ist unbekannt")
    raise SystemExit(0)

# Belegt: eigener (namensgleicher) Plan, sonst die EINE Rate, die ein
# namensfremder Plan je Zimmer behalten darf.
belegt: set[str] = set()
behalten: set[tuple[str, str]] = set()
# Kanal-Eintraege, deren Ratencode das Portal nicht mehr fuehrt:
# (code, room_type_code, mapping_id-vorhanden).
verwaist: list[tuple[str, str, bool]] = []
zuordnungen = (kanal_roh["data"].get("attributes") or {}).get("rate_plans") or []
for eintrag in zuordnungen:
    settings = eintrag.get("settings") or {}
    code = settings.get("rate_plan_code")
    if code is None:
        continue
    code = str(code)
    if code not in raten:
        # Der Eintrag zeigt auf eine Rate, die das Portal nicht mehr fuehrt.
        # `id` ist die `mapping_id` — sie steht nur hier, es gibt keinen
        # GET-Pfad fuer Mappings; ohne sie ist der Eintrag nicht loeschbar.
        verwaist.append((
            code, str(settings.get("room_type_code")),
            bool(eintrag.get("id")),
        ))
        continue
    plan_cx = str(eintrag.get("rate_plan_id"))
    name = (name_je_cx.get(plan_cx) or "").strip()
    titel = raten.get(code, "")
    if name and titel and name.lower() == titel.lower():
        belegt.add(code)
        continue
    if settings.get("primary_occ") is not True:
        continue  # weitere Rate an einem fremden Plan = Arbeit
    schluessel = (plan_cx, str(settings.get("room_type_code")))
    if schluessel not in behalten:
        behalten.add(schluessel)
        belegt.add(code)

offen = {c: t for c, t in raten.items() if c not in belegt}
fehlt = {c: t for c, t in offen.items() if t and t.lower() not in plan_namen}
ohne_titel = [c for c, t in offen.items() if not t]

teile = [
    f"{len(raten)} Rate(n) am Portal",
    f"{len(belegt)} versorgt (eigener/behaltener Plan)",
]
if fehlt:
    teile.append(
        "WUERDE ANLEGEN: " + ", ".join(
            f"{t} ({c})" for c, t in sorted(fehlt.items())
        )
    )
elif offen:
    teile.append("offen, aber Plan vorhanden: " + ", ".join(
        f"{t or '(ohne Titel)'} ({c})" for c, t in sorted(offen.items())
    ))
else:
    teile.append("nichts offen")
if ohne_titel:
    teile.append(f"{len(ohne_titel)} offene Rate(n) ohne Titel -> uebersprungen")
if verwaist:
    teile.append(
        "WUERDE LOESCHEN: " + ", ".join(
            f"{c}@{raum}" + ("" if hat_id else " (ohne mapping_id -> bleibt)")
            for c, raum, hat_id in sorted(verwaist)
        )
    )

loeschbar = sum(1 for _c, _r, hat_id in verwaist if hat_id)
print(f"{len(fehlt)}|{loeschbar}|" + "; ".join(teile))
