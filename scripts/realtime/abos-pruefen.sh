#!/usr/bin/env bash
# ============================================================================
# abos-pruefen.sh — findet stumme Realtime-Abos, BEVOR sie in Produktion sind
# ----------------------------------------------------------------------------
# Ein useRealtime-Abo wirkt nur, wenn BEIDES stimmt (CLAUDE.md, Qualitätsgate):
#   1. `select` für die Rolle `authenticated` auf public.<tabelle>
#      (RLS entscheidet danach, WELCHE Zeilen — der Grant entscheidet, ob
#      überhaupt ein Event ausgeliefert wird)
#   2. Mitgliedschaft in der Publikation `supabase_realtime`
# Fehlt eines, ist das Abo eine stumme Attrappe: die UI sieht live aus,
# aktualisiert aber nie. Genau so waren 8 Abos in web tot (payments, invoices,
# invoice_line_items, commission_ledger, owner_statements — dort ist der
# Grant-Entzug gewollt, Wurzel 6, also war das ABO der Fehler).
#
# Das Skript liest alle `table: "…"` aus Dateien, die useRealtime benutzen,
# und prüft jede Tabelle gegen die LIVE-DB. Read-only, keine Schreibzugriffe.
#
# Aufruf:
#   bash scripts/realtime/abos-pruefen.sh
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   DB_SSH=root@65.21.144.136     # leer lassen, wenn psql lokal erreichbar ist
#   DB_CONTAINER=                 # leer = automatisch (docker ps, Präfix db-)
#   DB_USER=supabase_admin
#   DB_NAME=postgres
#   PSQL_DSN=                     # gesetzt → direkt per lokalem psql, ohne SSH
#
# Exit 0 = alle Abos tragfähig, Exit 1 = mindestens eine Attrappe.
# ============================================================================
set -uo pipefail

: "${DB_SSH:=root@65.21.144.136}"
: "${DB_CONTAINER:=}"
: "${DB_USER:=supabase_admin}"
: "${DB_NAME:=postgres}"
: "${PSQL_DSN:=}"

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJEKTE=(web admin gastgeber plattform partner mobile-bestdays mobile-nextdays mobile-owner)

rot(){ printf '\033[31m%s\033[0m\n' "$*"; }
gruen(){ printf '\033[32m%s\033[0m\n' "$*"; }
gelb(){ printf '\033[33m%s\033[0m\n' "$*"; }
kopf(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# --- 1) Abos aus dem Quellcode einsammeln ----------------------------------
# Nur Dateien, die useRealtime wirklich benutzen — sonst fischt das Muster
# `table:` aus fremden Objektliteralen (Tabellen-Komponenten, Konfigs).
kopf "1) useRealtime-Abos im Quellcode"

DATEIEN=$(cd "$WURZEL" && grep -rl "useRealtime" \
  --include="*.ts" --include="*.tsx" --exclude-dir=node_modules \
  "${PROJEKTE[@]}" 2>/dev/null)

if [ -z "$DATEIEN" ]; then
  rot "Keine Datei mit useRealtime gefunden — Pfade/PROJEKTE prüfen."
  exit 1
fi

# Treffer als "tabelle<TAB>datei:zeile", damit der Report die Fundstelle nennt.
# Wortgrenze vor `table:`, sonst matcht auch `importable:`/`syncTable:`.
TREFFER=$(cd "$WURZEL" && echo "$DATEIEN" | tr '\n' '\0' | xargs -0 grep -Hn \
  -oE '(^|[^a-zA-Z0-9_])table: *"[a-zA-Z0-9_]+"' 2>/dev/null \
  | sed -E 's/^([^:]+):([0-9]+):.*table: *"([a-zA-Z0-9_]+)"/\3\t\1:\2/')

# RealtimeRefresh nimmt die Tabellen als Liste entgegen (`tables={["a","b"]}`)
# und reicht sie an useRealtime durch — die Aufrufer sind der eigentliche Ort,
# an dem der Tabellenname steht.
# MEHRZEILIG lesen: prettier bricht jede Liste ab zwei Einträgen um, und ein
# zeilenweises grep sah davon nur die Klammerzeile — die Abos standen dann gar
# nicht im Report und galten als geprüft, obwohl sie niemand angesehen hatte.
LISTEN=$(cd "$WURZEL" && find "${PROJEKTE[@]}" -name '*.tsx' -not -path '*/node_modules/*' \
  -print0 2>/dev/null | xargs -0 perl -0777 -ne '
    while (/tables=\{\[(.*?)\]\}/gs) {
      my $inhalt = $1; my $vor = substr($_, 0, pos($_));
      my $zeile = ($vor =~ tr/\n//) + 1;
      my @namen = ($inhalt =~ /"([a-zA-Z0-9_]+)"/g);
      print "$ARGV:$zeile:tables={[" . join(",", map { "\"$_\"" } @namen) . "]}\n" if @namen;
    }' 2>/dev/null || true)
if [ -n "$LISTEN" ]; then
  TREFFER=$(printf '%s\n%s' "$TREFFER" "$(echo "$LISTEN" | while IFS= read -r zeile; do
    ort=${zeile%%:tables=*}
    echo "$zeile" | grep -oE '"[a-zA-Z0-9_]+"' | tr -d '"' \
      | sed "s|\$|\t$ort|"
  done)")
fi

# Dynamische Tabellennamen kann das Skript nicht auflösen — sichtbar machen,
# statt sie stillschweigend zu übergehen. Typdeklarationen (`table: string`)
# und die Weiterreichung in RealtimeRefresh sind kein Befund.
DYNAMISCH=$(cd "$WURZEL" && echo "$DATEIEN" | tr '\n' '\0' | xargs -0 grep -Hn \
  -E '(^|[^a-zA-Z0-9_])table: *[^"'"'"' ]' 2>/dev/null \
  | grep -vE 'table: *"' \
  | grep -vE 'table: *(string|tables\[)' || true)

TABELLEN=$(echo "$TREFFER" | cut -f1 | sort -u | grep -v '^$')
ANZ=$(echo "$TABELLEN" | wc -l | tr -d ' ')
echo "  $ANZ verschiedene Tabellen in $(echo "$DATEIEN" | wc -l | tr -d ' ') Dateien."
if [ -n "$DYNAMISCH" ]; then
  gelb "  Nicht prüfbar (Tabellenname kommt aus einer Variablen):"
  echo "$DYNAMISCH" | sed 's/^/    /'
fi

# --- 2) Gegen die Live-DB prüfen -------------------------------------------
kopf "2) Grant + Publikation gegen die Live-DB"

WERTE=$(echo "$TABELLEN" | sed "s/.*/('&')/" | paste -sd, -)
SQL="
with gefragt(name) as (values $WERTE)
select g.name,
       (to_regclass('public.'||g.name) is not null) as existiert,
       coalesce(has_table_privilege('authenticated', 'public.'||g.name, 'select'), false) as darf_lesen,
       exists (select 1 from pg_publication_tables p
               where p.pubname = 'supabase_realtime'
                 and p.schemaname = 'public'
                 and p.tablename = g.name) as in_publikation
from gefragt g order by g.name;
"

# Feldtrenner ist der psql-Default `|` — ein \t würde über SSH als zwei Zeichen
# ankommen und die Spalten in den Tabellennamen kleben.
if [ -n "$PSQL_DSN" ]; then
  ERGEBNIS=$(psql "$PSQL_DSN" -At -c "$SQL" 2>&1)
else
  if [ -z "$DB_CONTAINER" ]; then
    # Der Container-Name traegt einen Deploy-Hash — nie fest verdrahten.
    DB_CONTAINER=$(ssh -o ConnectTimeout=10 "$DB_SSH" \
      "docker ps --format '{{.Names}}' | grep '^db-' | head -1" 2>/dev/null)
  fi
  if [ -z "$DB_CONTAINER" ]; then
    rot "DB-Container auf $DB_SSH nicht gefunden (docker ps, Präfix db-)."
    exit 1
  fi
  echo "  DB-Container: $DB_CONTAINER"
  ERGEBNIS=$(ssh -o ConnectTimeout=10 "$DB_SSH" \
    "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -At" \
    <<< "$SQL" 2>&1)
fi

if [ -z "$ERGEBNIS" ] || echo "$ERGEBNIS" | grep -qi '^psql:\|ERROR:'; then
  rot "DB-Abfrage fehlgeschlagen:"
  echo "$ERGEBNIS" | sed 's/^/    /'
  exit 1
fi

# --- 3) Report --------------------------------------------------------------
kopf "3) Ergebnis"

BEFUNDE=0
while IFS='|' read -r name existiert darf_lesen in_pub; do
  [ -n "$name" ] || continue
  case "$existiert|$darf_lesen|$in_pub" in
    t\|t\|t)
      gruen "  OK        $name"
      continue
      ;;
    f\|*)
      GRUND="Tabelle existiert nicht in public"
      ;;
    *\|f\|f)
      GRUND="kein select für authenticated UND nicht in supabase_realtime"
      ;;
    *\|f\|t)
      GRUND="kein select für authenticated (RLS/Grant) → 0 Events"
      ;;
    *)
      GRUND="nicht in der Publikation supabase_realtime → 0 Events"
      ;;
  esac
  BEFUNDE=$((BEFUNDE + 1))
  rot "  ATTRAPPE  $name — $GRUND"
  echo "$TREFFER" | awk -F'\t' -v t="$name" '$1==t {print "              " $2}' | sort -u
done <<< "$ERGEBNIS"

echo
if [ "$BEFUNDE" -gt 0 ]; then
  rot "$BEFUNDE stumme(s) Abo(s). Entweder den Grant nachziehen ODER — wenn die"
  rot "Sperre gewollt ist (Finanzen, Wurzel 6) — das Abo auf eine erlaubte"
  rot "Quelle umhängen (z. B. reservations). Kein Grant auf gesperrte Tabellen."
  exit 1
fi
gruen "Alle geprüften Abos haben Grant und Publikation."
