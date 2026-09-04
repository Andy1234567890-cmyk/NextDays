"""Warum kommt der dynamische Preis nicht bei Channex/den Portalen an?

Geht die Kette Dynamic Pricing -> Channex Station fuer Station durch und
benennt die ERSTE Stelle, an der sie abreisst. Jede dieser Stellen ist im Code
ein stilles `return`/`log.warning` — im Betrieb sieht deshalb alles gesund aus,
waehrend nie ein Preis rausgeht.

Geprueft wird (in der Reihenfolge des echten Pushs):
  1. Modul freigeschaltet   subscriptions/entitlements (modul_aktiv)
  2. dp_settings.enabled    der Schalter der Agentur je Objekt (aus = gewollt)
  3. dynamic_prices         gibt es ueberhaupt berechnete Tage?
  4. price_overrides        manuelle Preise; sie RUHEN, solange DP an ist
  5. _is_channex_managed    aktives channex_property_map (deleted_at IS NULL)
  6. Rate-Plan-Mapping      ohne Plan bleibt jeder Push ewig 'pending'
  7. ari_restriction_outbox pending/failed = Push kam nie durch
  8. channex_ari_shadow     unser Ist-Spiegel: was glauben wir gesendet zu haben
  9. Channex live           was liegt dort WIRKLICH (nur GET, nie schreibend)

NUR LESEND. Kein POST/PUT/PATCH/DELETE gegen Channex (Regel "Channex: NUR
lesen"), kein Schreiben in die DB.

Aufruf:
    cd apps/api && uv run python ../../scripts/diagnose/dynamic-preis-kette-pruefen.py
    OBJEKT="Kornblomst" uv run python ../../scripts/diagnose/dynamic-preis-kette-pruefen.py
    TAGE=30 ...   (Standard: 30 Tage ab heute)
"""
from __future__ import annotations

import os
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client

# Fest auf apps/api/.env — sonst haengt das Ergebnis am Arbeitsverzeichnis
# (leere Umgebung sieht aus wie "nicht erreichbar" statt "falsch aufgerufen").
_ENV = Path(__file__).resolve().parents[2] / "apps" / "api" / ".env"
if not _ENV.exists():
    sys.exit(f"Env-Datei nicht gefunden: {_ENV}")
load_dotenv(_ENV)

OBJEKT_FILTER = os.environ.get("OBJEKT", "").lower()
TAGE = int(os.environ.get("TAGE", "30"))
HEUTE = datetime.now(UTC).date()
BIS = HEUTE + timedelta(days=TAGE)

OK = "  OK   "
FEHLT = "  BRUCH"
WARN = "  HINW "


def _db():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen (apps/api/.env).")
    return create_client(url, key)


def _channex_get(pfad: str, params: dict | None = None):
    """GET gegen Channex. Gibt (daten, fehlertext) zurueck."""
    basis = (os.environ.get("CHANNEX_BASE_URL") or "").rstrip("/")
    key = os.environ.get("CHANNEX_API_KEY")
    if not basis or not key:
        return None, "CHANNEX_BASE_URL/CHANNEX_API_KEY fehlen"
    try:
        antwort = httpx.get(
            f"{basis}{pfad}",
            params=params or {},
            headers={"user-api-key": key, "Accept": "application/json"},
            timeout=30.0,
        )
    except httpx.HTTPError as exc:
        return None, f"Netzwerkfehler: {exc}"
    if antwort.status_code >= 400:
        return None, f"HTTP {antwort.status_code}: {antwort.text[:200]}"
    return antwort.json(), None


def _objekte(db):
    rows = (
        db.table("properties")
        .select("id, title, tenant_id, status, currency")
        .is_("archived_at", "null")
        .execute()
    ).data or []
    if OBJEKT_FILTER:
        rows = [r for r in rows if OBJEKT_FILTER in (r.get("title") or "").lower()]
    return rows


def _pruefe_objekt(db, obj: dict) -> list[str]:
    """Eine Objekt-Kette pruefen. Gibt die Liste der Bruchstellen zurueck."""
    pid, tid = obj["id"], obj["tenant_id"]
    brueche: list[str] = []
    print(f"\n{'=' * 78}\n{obj.get('title') or '?'}   [{pid}]")
    print(f"  Status: {obj.get('status')}   Waehrung: {obj.get('currency') or '(fehlt)'}")

    # 1/2 — dp_settings
    dp = (
        db.table("dp_settings").select("*").eq("property_id", pid).limit(1).execute()
    ).data
    dp_an = bool(dp) and bool(dp[0].get("enabled"))
    if not dp:
        # KEIN Bruch: die Agentur aktiviert DP bewusst je Objekt. Ohne Zeile
        # gilt der manuelle Tagespreis — das ist der gewollte Normalfall.
        print(f"{WARN} 2. dp_settings: keine Zeile -> DP aus, manueller Preis gilt.")
    elif not dp_an:
        print(f"{WARN} 2. dp_settings.enabled = false -> DP aus, manueller Preis gilt.")
    else:
        print(f"{OK} 2. dp_settings.enabled = true -> Autopilot fuehrt die Preise")

    # 3 — berechnete Tage
    dyn = (
        db.table("dynamic_prices")
        .select("date, price, min_stay")
        .eq("property_id", pid)
        .gte("date", HEUTE.isoformat())
        .lte("date", BIS.isoformat())
        .order("date")
        .execute()
    ).data or []
    if not dyn:
        stufe = FEHLT if dp_an else WARN
        print(f"{stufe} 3. dynamic_prices: 0 Tage in {HEUTE}..{BIS}.")
        if dp_an:
            # NUR bei aktivem DP ein Bruch: dann muesste gerechnet worden sein.
            brueche.append("keine dynamic_prices trotz aktivem DP")
    else:
        spanne = f"{dyn[0]['price']}..{dyn[-1]['price']}"
        print(f"{OK} 3. dynamic_prices: {len(dyn)} Tage (Preis {spanne})")

    # 4 — Overrides gewinnen
    ovr = (
        db.table("price_overrides")
        .select("date, price")
        .eq("property_id", pid)
        .gte("date", HEUTE.isoformat())
        .lte("date", BIS.isoformat())
        .not_.is_("price", "null")
        .execute()
    ).data or []
    if ovr:
        if dp_an:
            print(
                f"{OK} 4. price_overrides: {len(ovr)} Tage vorhanden, ruhen aber "
                "(DP an -> berechneter Preis gilt). Sie greifen sofort wieder, "
                "sobald die Agentur DP abschaltet."
            )
        else:
            print(
                f"{OK} 4. price_overrides: {len(ovr)} Tage -> diese Preise gelten "
                "(DP aus)."
            )

    # 5 — Channex-managed
    pm = (
        db.table("channex_property_map")
        .select("id, channex_property_id, sync_enabled, deleted_at")
        .eq("tenant_id", tid)
        .eq("property_id", pid)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    ).data
    if not pm:
        print(
            f"{FEHLT} 5. channex_property_map: keine aktive Zeile -> "
            "_is_channex_managed() = False, push_rates_batch bricht STILL ab (No-op)."
        )
        brueche.append("nicht channex-managed")
        return brueche
    cx_pid = pm[0]["channex_property_id"]
    print(f"{OK} 5. Channex-managed: property {cx_pid} (sync_enabled={pm[0].get('sync_enabled')})")

    # 6 — Rate-Plan-Mapping
    rtms = (
        db.table("channex_room_type_map")
        .select("id")
        .eq("tenant_id", tid)
        .eq("property_map_id", pm[0]["id"])
        .is_("deleted_at", "null")
        .execute()
    ).data or []
    rps = []
    if rtms:
        rps = (
            db.table("channex_rate_plan_map")
            .select("channex_rate_plan_id, local_rate_plan_id")
            .eq("tenant_id", tid)
            .in_("room_type_map_id", [r["id"] for r in rtms])
            .is_("deleted_at", "null")
            .execute()
        ).data or []
    if not rps:
        print(
            f"{FEHLT} 6. Rate-Plan-Mapping FEHLT ({len(rtms)} Room-Types, 0 Rate-Plans) -> "
            "push_rates_batch loggt 'deferred_no_rate_plan' und sendet NIE."
        )
        brueche.append("kein Rate-Plan-Mapping")
    else:
        print(f"{OK} 6. Rate-Plans gemappt: {len(rps)} ({len(rtms)} Room-Type-Maps)")

    # 7 — Outbox
    ob = (
        db.table("ari_restriction_outbox")
        .select("id, kind, status, date_from, date_to, attempts, last_error, created_at")
        .eq("tenant_id", tid)
        .eq("property_id", pid)
        .eq("kind", "rate")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    ).data or []
    if not ob:
        print(
            f"{FEHLT} 7. ari_restriction_outbox: KEINE 'rate'-Zeile -> "
            "push_rates_batch wurde fuer dieses Objekt nie aufgerufen "
            "(Job lief nicht, oder Abbruch VOR dem Enqueue)."
        )
        brueche.append("keine Outbox-Zeile")
    else:
        offen = [r for r in ob if r["status"] != "done"]
        letzte = ob[0]
        print(
            f"{OK if not offen else FEHLT} 7. Outbox: {len(ob)} Zeilen, "
            f"{len(offen)} offen. Letzte: {letzte['status']} "
            f"({letzte['date_from']}..{letzte['date_to']}, {str(letzte['created_at'])[:19]})"
        )
        for r in offen[:5]:
            fehler = r.get("last_error") or ""
            print(
                f"         - {r['status']}  {r['date_from']}..{r['date_to']}  "
                f"Versuche={r.get('attempts')}  {fehler[:120]}"
            )
        if offen:
            brueche.append(f"{len(offen)} Outbox-Zeilen nicht 'done'")

    # 8 — unser Ist-Spiegel
    sh = (
        db.table("channex_ari_shadow")
        .select("date, rate_cents, min_stay, updated_at")
        .eq("property_id", pid)
        .gte("date", HEUTE.isoformat())
        .lte("date", BIS.isoformat())
        .order("date")
        .execute()
    ).data or []
    if not sh:
        print(
            f"{FEHLT} 8. channex_ari_shadow: leer -> nach unserem eigenen Stand "
            "wurde NIE ein Preis erfolgreich gesendet."
        )
        brueche.append("ARI-Shadow leer")
    else:
        print(
            f"{OK} 8. ARI-Shadow: {len(sh)} Tage, zuletzt {str(sh[-1].get('updated_at'))[:19]}"
        )

    # 9 — Channex live gegenlesen
    if rps:
        brueche.extend(_channex_gegenlesen(cx_pid, rps, dyn, ovr, dp_an))
    return brueche


def _channex_gegenlesen(
    cx_pid: str, rps: list[dict], dyn: list[dict], ovr: list[dict], dp_an: bool
) -> list[str]:
    """Was liegt bei Channex WIRKLICH? Nur GET."""
    # CHANNEX_BASE_URL enthaelt bereits /api/v1 — hier NICHT nochmal anhaengen.
    daten, fehler = _channex_get(
        "/restrictions",
        {
            "filter[property_id]": cx_pid,
            "filter[date][gte]": HEUTE.isoformat(),
            "filter[date][lte]": min(BIS, HEUTE + timedelta(days=14)).isoformat(),
            "filter[restrictions]": "rate",
        },
    )
    if fehler:
        print(f"{WARN} 9. Channex nicht lesbar: {fehler}")
        return []
    werte = (daten or {}).get("data") or {}
    if not werte:
        print(
            f"{FEHLT} 9. Channex liefert KEINE rate-Restriktionen fuer {cx_pid} -> "
            "dort liegt kein Preis, egal was unser Shadow sagt."
        )
        return ["Channex ohne rate-Restriktionen"]
    # Erwartung nach der Rangfolge des Resolvers (_effective_for_day):
    # bei aktivem Dynamic Pricing gewinnt der berechnete Preis, sonst der
    # manuelle Tagespreis. Genau andersherum als bis zum 04.09.2026.
    if dp_an:
        erwartet = {o["date"]: float(o["price"]) for o in ovr}
        erwartet.update({r["date"]: float(r["price"]) for r in dyn})
    else:
        erwartet = {o["date"]: float(o["price"]) for o in ovr}
    gefunden = abweichung = 0
    beispiele: list[str] = []
    for _plan_id, tage in (werte.items() if isinstance(werte, dict) else []):
        if not isinstance(tage, dict):
            continue
        for tag, feld in tage.items():
            live = (feld or {}).get("rate") if isinstance(feld, dict) else None
            if live is None or tag not in erwartet:
                continue
            gefunden += 1
            # Channex gibt rate beim LESEN als Dezimalstring in Haupteinheit
            # zurueck, geschrieben wird Cent (dokumentierte Asymmetrie).
            if abs(float(live) - erwartet[tag]) > 0.01:
                abweichung += 1
                if len(beispiele) < 5:
                    beispiele.append(f"{tag}: wir {erwartet[tag]:.2f} / Channex {float(live):.2f}")
    if not gefunden:
        print(f"{WARN} 9. Channex antwortet, aber kein vergleichbarer Tag im Fenster.")
        return []
    elif abweichung:
        print(f"{FEHLT} 9. Channex weicht an {abweichung}/{gefunden} Tagen ab:")
        for b in beispiele:
            print(f"         - {b}")
        return [f"Channex weicht an {abweichung}/{gefunden} Tagen ab"]
    else:
        print(f"{OK} 9. Channex deckungsgleich an {gefunden} Tagen -> der Preis IST dort.")
        print("         Kommt er trotzdem nicht bei Airbnb an, liegt es am Kanal")
        print("         (Mapping/Connection), nicht an unserem Push.")
    return []


def main() -> int:
    db = _db()
    objekte = _objekte(db)
    if not objekte:
        print("Kein Objekt passt auf den Filter.")
        return 1
    print(f"Dynamic-Preis-Kette -> Channex   Fenster {HEUTE}..{BIS}   {len(objekte)} Objekt(e)")

    # 1 — Modul global (einmal je Tenant). modul_aktiv() ist fail-CLOSED:
    # fehlende Zeile = Modul aus = recompute laeuft gar nicht erst.
    for tid in sorted({o["tenant_id"] for o in objekte}):
        ent = (
            db.table("tenant_module_entitlement")
            .select("active")
            .eq("tenant_id", tid)
            .eq("module_key", "dynamische_preise")
            .limit(1)
            .execute()
        ).data
        if not ent:
            print(
                f"\n{FEHLT} 1. Modul 'dynamische_preise' fuer Tenant {tid}: KEINE Zeile "
                "-> modul_aktiv() = False (fail-closed), Autopilot laeuft nicht."
            )
        elif not ent[0].get("active"):
            print(f"\n{FEHLT} 1. Modul 'dynamische_preise' fuer Tenant {tid}: active = false.")
        else:
            print(f"\n{OK} 1. Modul 'dynamische_preise' aktiv (Tenant {tid})")

    gesamt: dict[str, list[str]] = {}
    for obj in objekte:
        try:
            brueche = _pruefe_objekt(db, obj)
        except Exception as exc:  # noqa: BLE001  # Diagnose darf nie ganz abbrechen
            print(f"  FEHLER bei {obj.get('title')}: {type(exc).__name__}: {exc}")
            brueche = [f"Diagnosefehler: {exc}"]
        if brueche:
            gesamt[obj.get("title") or obj["id"]] = brueche

    print(f"\n{'=' * 78}\nZUSAMMENFASSUNG")
    if not gesamt:
        print("  Keine Bruchstelle gefunden — die Kette traegt bis Channex.")
        return 0
    for name, brueche in gesamt.items():
        print(f"  {name}: {', '.join(brueche)}")
    print("\n  Die ERSTE Bruchstelle je Objekt ist die Ursache — alles danach folgt daraus.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
