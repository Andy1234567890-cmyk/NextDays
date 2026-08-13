#!/usr/bin/env bash
# connector-pruefen.sh — prüft den MCP-Connector so, wie claude.ai ihn sieht.
#
# WOZU: Der Verbindungsaufbau eines Custom Connectors scheitert fast immer an
# einer von vier Stellen, und die Fehlermeldung in claude.ai ist bei allen
# dieselbe („Couldn't reach the MCP server"). Dieses Skript geht die Kette in
# der Reihenfolge durch, in der der Client sie geht, und sagt, WO es klemmt.
#
# AUFRUF:
#   bash scripts/mcp/connector-pruefen.sh https://app.mynextdays.com
#   bash scripts/mcp/connector-pruefen.sh            # nutzt localhost:8000
set -uo pipefail

BASIS="${1:-http://localhost:8000}"
BASIS="${BASIS%/}"
MCP="$BASIS/api/v1/mcp"
FEHLER=0

gruen() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
rot()   { printf '  \033[31m✗\033[0m %s\n' "$1"; FEHLER=$((FEHLER + 1)); }
info()  { printf '  \033[2m·\033[0m %s\n' "$1"; }
titel() { printf '\n\033[1m%s\033[0m\n' "$1"; }

hole() { curl -sS -m 10 -o /tmp/mcp_body -w '%{http_code}' "$@" 2>/dev/null; }

echo "MCP-Connector-Prüfung gegen $BASIS"

# ---------------------------------------------------------------------------
titel "1) Protected Resource Metadata (RFC 9728)"
# Der Client sucht sie auf der WURZEL, nicht unter /api/v1 — der häufigste
# Fehler ist ein Mount unter dem API-Präfix.
for pfad in \
  "/.well-known/oauth-protected-resource/api/v1/mcp" \
  "/.well-known/oauth-protected-resource"
do
  code=$(hole "$BASIS$pfad")
  if [ "$code" = "200" ]; then
    gruen "$pfad → 200"
    res=$(python3 -c 'import json,sys;print(json.load(open("/tmp/mcp_body")).get("resource",""))' 2>/dev/null)
    if [ "$res" = "$MCP" ]; then
      gruen "resource stimmt exakt: $res"
    else
      rot "resource ist '$res', erwartet '$MCP' — Claude verlangt exakte Gleichheit"
    fi
  else
    rot "$pfad → $code (erwartet 200)"
  fi
done

# ---------------------------------------------------------------------------
titel "2) Authorization Server Metadata (RFC 8414)"
code=$(hole "$BASIS/.well-known/oauth-authorization-server")
if [ "$code" = "200" ]; then
  gruen "Dokument erreichbar"
  python3 - <<'PY'
import json
d = json.load(open("/tmp/mcp_body"))
def pruef(bedingung, gut, schlecht):
    print(("  \033[32m✓\033[0m " + gut) if bedingung else ("  \033[31m✗\033[0m " + schlecht))
    return 0 if bedingung else 1
f = 0
# BEIDE Felder sind nötig, sonst wählt Claude CIMD nicht und sucht einen
# registration_endpoint (DCR), den wir bewusst nicht anbieten.
f += pruef(d.get("client_id_metadata_document_supported") is True,
           "client_id_metadata_document_supported: true",
           "client_id_metadata_document_supported fehlt → Claude fällt auf DCR zurück")
f += pruef("none" in (d.get("token_endpoint_auth_methods_supported") or []),
           "token_endpoint_auth_methods_supported enthält 'none'",
           "'none' fehlt → CIMD-Client kann sich am Token-Endpunkt nicht anmelden")
f += pruef("S256" in (d.get("code_challenge_methods_supported") or []),
           "PKCE S256 angekündigt",
           "code_challenge_methods_supported ohne S256")
f += pruef(bool(d.get("authorization_endpoint")) and bool(d.get("token_endpoint")),
           "authorize- und token-Endpunkt benannt",
           "authorization_endpoint oder token_endpoint fehlt")
raise SystemExit(1 if f else 0)
PY
  [ $? -ne 0 ] && FEHLER=$((FEHLER + 1))
else
  rot "→ $code (erwartet 200)"
fi

# ---------------------------------------------------------------------------
titel "3) initialize ohne Anmeldung (Lazy Auth)"
code=$(hole -X POST "$MCP" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}')
if [ "$code" = "200" ]; then
  gruen "initialize → 200 (Server ist hinzufügbar)"
else
  rot "initialize → $code — ohne 200 lässt sich der Connector nicht anlegen"
fi

# ---------------------------------------------------------------------------
titel "4) tools/list ohne Anmeldung"
code=$(hole -X POST "$MCP" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')
if [ "$code" = "200" ]; then
  anz=$(python3 -c 'import json;print(len(json.load(open("/tmp/mcp_body"))["result"]["tools"]))' 2>/dev/null || echo 0)
  gruen "tools/list → 200, $anz Werkzeuge"
else
  rot "tools/list → $code"
fi

# ---------------------------------------------------------------------------
titel "5) tools/call OHNE Token — der kritische Punkt"
# Hier scheitern die meisten Connectors: ein 200 mit isError:true erzeugt in
# Claude KEINEN Anmelde-Dialog, sondern nur Text im Chat. Nur ein echter 401
# mit WWW-Authenticate löst den Verbindungs-Flow aus.
kopf=$(curl -sS -m 10 -D - -o /tmp/mcp_body -X POST "$MCP" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"buchungen_liste","arguments":{}}}' 2>/dev/null)
status=$(printf '%s' "$kopf" | head -1 | awk '{print $2}')
auth=$(printf '%s' "$kopf" | grep -i '^www-authenticate:' || true)

if [ "$status" = "401" ]; then
  gruen "Status 401 (richtig — löst den Anmelde-Dialog aus)"
else
  rot "Status $status statt 401 — Claude zeigt dann KEINEN Verbindungs-Button"
fi
if [ -n "$auth" ]; then
  gruen "WWW-Authenticate vorhanden"
  case "$auth" in
    *resource_metadata=*) gruen "resource_metadata im Header" ;;
    *) rot "resource_metadata fehlt im Header — Client findet die Metadaten nicht" ;;
  esac
else
  rot "WWW-Authenticate fehlt — ohne ihn bricht die Erkennung ab"
fi

# ---------------------------------------------------------------------------
titel "6) Token-Endpunkt nimmt form-urlencoded (RFC 6749)"
# Ein JSON-only Parser antwortet hier mit 415 und der Flow bricht ohne
# erkennbaren Grund ab.
code=$(hole -X POST "$MCP/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=test')
if [ "$code" = "400" ]; then
  gruen "form-urlencoded akzeptiert, unbekannter Grant → 400 (korrekt)"
elif [ "$code" = "415" ]; then
  rot "415 — der Endpunkt nimmt kein form-urlencoded an"
else
  info "Status $code (erwartet 400 für einen nicht unterstützten Grant)"
fi

# ---------------------------------------------------------------------------
titel "Ergebnis"
if [ "$FEHLER" -eq 0 ]; then
  printf '  \033[32mAlle Prüfungen bestanden.\033[0m\n\n'
  echo "  In claude.ai eintragen: $MCP"
  exit 0
fi
printf '  \033[31m%s Prüfung(en) fehlgeschlagen.\033[0m\n' "$FEHLER"
exit 1
