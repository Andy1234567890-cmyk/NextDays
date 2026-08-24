#!/usr/bin/env bash
# ============================================================================
# db-trigger-pruefen.sh — löst JEDEN Trigger der Live-DB einmal aus, in einer
# Transaktion, die anschließend zurückgerollt wird.
# ----------------------------------------------------------------------------
# ANLASS (23.08.2026): Der Ereignis-Trigger `public_api_trg_tasks` (Migration
# 0418) verglich ein Enum mit dem Leerstring:
#     coalesce(old.status, '') <> 'done'
# Postgres castet den zweiten coalesce-Parameter auf den Typ des ersten und
# wirft, sobald der Zweig ausgewertet wird — bei JEDEM UPDATE:
#     ERROR: invalid input value for enum public.task_status: ""
# Betroffen waren `tasks` (kein Statuswechsel, kein Abschluss, kein Zuweisen)
# und `reservations` (keine Buchungsänderung). Der INSERT-Pfad lief weiter,
# darum sah das System lebendig aus; in der App stand nur „Ungültiger Wert im
# Aufruf" und es sah nach einem App-Fehler aus. Gefunden wurde es erst, als
# jemand von Hand ein `update` in psql absetzte — genau das macht dieses
# Skript, nur für alle Trigger auf einmal und wiederholbar.
#
# WARUM EIN NO-OP-UPDATE REICHT: Ein Trigger, der beim Auswerten seiner eigenen
# Bedingung wirft, wirft unabhängig davon, WAS geändert wird. `set spalte =
# spalte` löst ihn aus, ohne einen fachlichen Wert zu verändern.
#
# WARUM ES TROTZDEM SCHREIBT UND ZURÜCKROLLT: Ein Trigger lässt sich nicht
# lesend prüfen. `begin … rollback` um jede einzelne Zeile hält den Eingriff
# auf null — nach dem Lauf steht in der DB nichts anderes als davor. AFTER-
# Trigger, die selbst schreiben (public_api_events), rollen mit zurück.
#
# Geprüft wird JEDE Tabelle mit mindestens einem Trigger, nicht nur die
# bekannten: eine neue Tabelle mit neuem Trigger ist genau der Fall, den man
# sonst wieder übersieht. `set_updated_at` ist der einzige ausgenommene
# Auslöser, wenn er der EINZIGE auf der Tabelle ist (er schreibt nur now()).
#
# Aufruf:
#   bash scripts/diagnose/db-trigger-pruefen.sh
#   bash scripts/diagnose/db-trigger-pruefen.sh --alle   # auch set_updated_at
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   DB_SSH=root@65.21.144.136     # leer lassen, wenn psql lokal erreichbar ist
#   DB_CONTAINER=                 # leer = automatisch (docker ps, Präfix db-)
#   DB_USER=supabase_admin
#   DB_NAME=postgres
#   PSQL_DSN=                     # gesetzt → direkt per lokalem psql, ohne SSH
#
# Exit 0 = jeder Trigger läuft durch, Exit 1 = mindestens einer bricht ab.
# ============================================================================
set -uo pipefail

: "${DB_SSH:=root@65.21.144.136}"
: "${DB_CONTAINER:=}"
: "${DB_USER:=supabase_admin}"
: "${DB_NAME:=postgres}"
: "${PSQL_DSN:=}"

ALLE=0
[ "${1:-}" = "--alle" ] && ALLE=1

rot(){ printf '\033[31m%s\033[0m\n' "$*"; }
gruen(){ printf '\033[32m%s\033[0m\n' "$*"; }
gelb(){ printf '\033[33m%s\033[0m\n' "$*"; }
kopf(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# psql-Aufruf; SQL kommt IMMER über stdin, nie über -c — sonst zerbrechen
# Klammern und Quotes an den Shell-Schichten (SSH + docker exec).
psql_ta() {
  if [ -n "$PSQL_DSN" ]; then
    psql "$PSQL_DSN" -tAq -f -
  else
    ssh -o ConnectTimeout=15 "$DB_SSH" \
      "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAq -f -"
  fi
}
# OHNE `-q`: der Befehls-Tag („UPDATE 1" / „UPDATE 0") ist hier die Messung.
# Mit `-q` unterdrückt psql ihn, und eine LEERE Tabelle sähe aus wie ein
# erfolgreich ausgelöster Trigger — der Report behauptete „geprüft", obwohl
# nichts lief.
psql_roh() {
  if [ -n "$PSQL_DSN" ]; then
    psql "$PSQL_DSN" -f -
  else
    ssh -o ConnectTimeout=30 "$DB_SSH" \
      "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -f -"
  fi
}

if [ -z "$PSQL_DSN" ] && [ -z "$DB_CONTAINER" ]; then
  # Der Container-Name trägt einen Deploy-Hash — nie fest verdrahten.
  DB_CONTAINER=$(ssh -o ConnectTimeout=10 "$DB_SSH" \
    "docker ps --format '{{.Names}}' | grep '^db-' | head -1" 2>/dev/null)
  if [ -z "$DB_CONTAINER" ]; then
    rot "DB-Container auf $DB_SSH nicht gefunden (docker ps, Präfix db-)."
    exit 1
  fi
  echo "  DB-Container: $DB_CONTAINER"
fi

# --- 1) Welche Tabellen tragen Trigger? ------------------------------------
kopf "1) Trigger in public"

FILTER="having bool_or(p.proname <> 'set_updated_at')"
[ "$ALLE" = "1" ] && FILTER=""

LISTE=$(psql_ta <<SQL
select c.relname, string_agg(distinct p.proname, ','order by p.proname)
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
group by c.relname
$FILTER
order by c.relname;
SQL
)

if [ -z "$LISTE" ] || echo "$LISTE" | grep -qi '^psql:\|ERROR:'; then
  rot "Trigger-Abfrage fehlgeschlagen:"
  echo "$LISTE" | sed 's/^/    /'
  exit 1
fi
echo "  $(echo "$LISTE" | wc -l | tr -d ' ') Tabelle(n) mit Trigger."

# --- 2) Jeden Trigger einmal auslösen (und zurückrollen) -------------------
kopf "2) No-Op-UPDATE je Tabelle, in begin/rollback"

BEFUNDE=0
LEER=0
while IFS='|' read -r tabelle funktionen; do
  [ -n "$tabelle" ] || continue

  # Eine Spalte, die es sicher gibt und die ohne Nebenwirkung auf sich selbst
  # gesetzt werden kann. `ctid` als Schlüssel, weil nicht jede Tabelle `id` hat.
  SPALTE=$(psql_ta <<SQL
select column_name from information_schema.columns
where table_schema='public' and table_name='$tabelle'
  and column_name in ('updated_at','created_at','id')
order by case column_name when 'updated_at' then 1 when 'created_at' then 2 else 3 end
limit 1;
SQL
)
  if [ -z "$SPALTE" ]; then
    gelb "  ÜBERSPRUNGEN  $tabelle — keine Spalte zum No-Op-Setzen gefunden"
    continue
  fi

  # `ON_ERROR_STOP 0`, damit der Fehlertext in der Ausgabe landet, statt die
  # Verbindung abzubrechen; das rollback läuft in jedem Fall.
  AUSGABE=$(psql_roh <<SQL 2>&1
\set ON_ERROR_STOP 0
begin;
update public.$tabelle set $SPALTE = $SPALTE
 where ctid = (select ctid from public.$tabelle limit 1);
rollback;
SQL
)

  if echo "$AUSGABE" | grep -q '^ERROR:'; then
    BEFUNDE=$((BEFUNDE + 1))
    rot "  BRICHT AB    $tabelle ($funktionen)"
    echo "$AUSGABE" | grep '^ERROR:\|^DETAIL:\|^CONTEXT:' | sed 's/^/                 /'
  elif echo "$AUSGABE" | grep -q 'UPDATE 0'; then
    # Leere Tabelle: der Trigger wurde nicht ausgelöst, also ist NICHTS geprüft.
    # Das als „OK" zu zählen wäre eine Falschaussage (Wurzel 5b-Gedanke: nur
    # sagen, was wirklich gemessen wurde).
    LEER=$((LEER + 1))
    gelb "  UNGEPRÜFT    $tabelle ($funktionen) — Tabelle ist leer"
  else
    gruen "  OK           $tabelle ($funktionen)"
  fi
done <<< "$LISTE"

# --- 2b) Statisch: Enum-Spalte gegen ein String-Literal ---------------------
# Das No-Op-UPDATE oben prüft nur Tabellen, die ZEILEN haben. Eine leere
# Tabelle mit kaputtem Trigger fiele durch — und sie ist genau so lange leer,
# bis der erste Kunde sie füllt. Deshalb zusätzlich der Blick in den Rumpf:
# `coalesce(old.<enum-spalte>, '…')` ist die Konstruktion, die 0418 gebaut hat.
# Postgres castet den zweiten coalesce-Parameter auf den Typ des ersten; steht
# dort ein String-Literal, das kein gültiger Enum-Wert ist, wirft der Trigger,
# sobald der Zweig ausgewertet wird — unabhängig von jeder Zeile.
kopf "2b) Enum-Spalten gegen String-Literale (statisch)"

MUSTER=$(psql_ta <<'SQL'
select distinct p.proname || '|' || c.relname || '|' || a.attname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
join pg_type ty on ty.oid = a.atttypid
where not t.tgisinternal
  and c.relnamespace = 'public'::regnamespace
  and ty.typtype = 'e'
  and p.prosrc ~* ('coalesce\s*\(\s*(old|new)\.' || a.attname || '\s*,\s*''')
order by 1;
SQL
)

if [ -n "$MUSTER" ]; then
  while IFS='|' read -r fn tab spalte; do
    [ -n "$fn" ] || continue
    BEFUNDE=$((BEFUNDE + 1))
    rot "  MUSTER       $fn — coalesce($tab.$spalte, '…') auf einer ENUM-Spalte"
    rot "                 Postgres castet das Literal auf den Enum-Typ und wirft."
    rot "                 Die Spalte ist in aller Regel NOT NULL: coalesce weg."
  done <<< "$MUSTER"
else
  gruen "  Kein coalesce(<enum>, '…') in einer Trigger-Funktion."
fi

# --- 3) Ergebnis ------------------------------------------------------------
kopf "3) Ergebnis"
if [ "$LEER" -gt 0 ]; then
  gelb "$LEER Tabelle(n) ohne Zeile — ihr Trigger ist NICHT geprüft."
fi
if [ "$BEFUNDE" -gt 0 ]; then
  rot "$BEFUNDE Trigger bricht/brechen bei einem gewöhnlichen UPDATE ab."
  rot "Damit ist jede Änderung an diesen Tabellen tot — auch die, die nichts"
  rot "mit dem Ereignis des Triggers zu tun hat. Trigger-Rumpf prüfen"
  rot "(häufigster Fall: ein Enum gegen '' oder einen Text verglichen)."
  exit 1
fi
gruen "Alle geprüften Trigger laufen bei einem gewöhnlichen UPDATE durch."
