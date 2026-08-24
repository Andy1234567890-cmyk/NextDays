#!/usr/bin/env bash
# ============================================================================
# aufgaben-luecken-pruefen.sh — findet Buchungen OHNE ihre planmäßige Aufgabe
# ----------------------------------------------------------------------------
# Eine planmäßige Aufgabe (Anreise-Check, Endreinigung …) entsteht aus einer
# `task_rules`-Zeile mit `kind='auto'`, gültig für die Objekte in
# `task_rule_assignments` (keine Zuordnung = alle Objekte). Sie entstand lange
# NUR im Moment des Reservierungs-Schreibens. Wer eine Regel nach einer Buchung
# anlegte, bekam für diese Buchung nie eine Aufgabe.
#
# LIVE PASSIERT (23.08.2026): Buchung „Feriehus Britt" vom 10.08. mit Anreise
# am 23.08. hatte keine Anreise-Aufgabe — die Regel „Velk T" wurde erst am
# 13.08. angelegt. Gemeldet als „heute ist eine Anreise, dazu gibt es keine
# Aufgabe". Genau diese Klasse Lücke macht das Skript sichtbar: sie fällt
# sonst erst auf, wenn niemand da war.
#
# Der Nachzug läuft seit 0272/24.08. im stündlichen Worker-Tick
# (`nachziehen_planmaessig`). Dieses Skript ist die Gegenprüfung: nach einem
# Deploy sollte es 0 Lücken melden. Read-only, keine Schreibzugriffe.
#
# Aufruf:
#   bash scripts/tasks/aufgaben-luecken-pruefen.sh            # −14 bis +60 Tage
#   HORIZONT=180 bash scripts/tasks/aufgaben-luecken-pruefen.sh
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   DB_SSH=root@65.21.144.136     # leer lassen, wenn psql lokal erreichbar ist
#   DB_CONTAINER=                 # leer = automatisch (docker ps, Präfix db-)
#   DB_USER=postgres
#   DB_NAME=postgres
#   PSQL_DSN=                     # gesetzt → direkt per lokalem psql, ohne SSH
#
# Exit 0 = keine Lücke, Exit 1 = mindestens eine Buchung ohne ihre Aufgabe.
# ============================================================================
set -uo pipefail

: "${DB_SSH:=root@65.21.144.136}"
: "${DB_CONTAINER:=}"
: "${DB_USER:=postgres}"
: "${DB_NAME:=postgres}"
: "${PSQL_DSN:=}"
: "${HORIZONT:=60}"
# Derselbe Rückblick wie im Nachzug (engine.NACHZUG_RUECKBLICK_TAGE): eine
# Abreise von vorgestern ohne Reinigungsaufgabe ist offene Arbeit, die niemand
# sieht — sie gehört in den Report, nicht hinter die Tagesgrenze.
: "${RUECKBLICK:=14}"

rot(){ printf '\033[31m%s\033[0m\n' "$*"; }
gruen(){ printf '\033[32m%s\033[0m\n' "$*"; }
kopf(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

container_bestimmen() {
  # VOR dem Abfrage-Aufruf, nie darin: ein `ssh` INNERHALB der Pipe frisst das
  # per stdin gelieferte SQL, psql bekommt eine leere Eingabe und das Skript
  # meldet fröhlich „keine Lücke". `-n` hält stdin auch hier zu.
  [ -n "$PSQL_DSN" ] && return 0
  [ -n "$DB_CONTAINER" ] && return 0
  DB_CONTAINER=$(ssh -n "$DB_SSH" 'docker ps --format "{{.Names}}" | grep "^db-" | head -1')
  if [ -z "$DB_CONTAINER" ]; then
    rot "Kein Postgres-Container gefunden (Präfix db-). DB_CONTAINER setzen."
    exit 2
  fi
}

psql_run() {
  # Liest SQL von stdin. Ein Aufrufweg, damit lokal und per SSH derselbe
  # Befehl gilt — sonst driften die beiden Pfade auseinander.
  if [ -n "$PSQL_DSN" ]; then
    psql "$PSQL_DSN" -X -A -t -q -v ON_ERROR_STOP=1
    return
  fi
  ssh "$DB_SSH" "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -X -A -t -q -v ON_ERROR_STOP=1"
}

# Die Lücke: eine Buchung im Fenster, für die eine für ihr Objekt gültige
# aktive auto-Regel MIT Start-Trigger keine Aufgabe hat. Endzustände und offene
# Anfragen sind ausgenommen — dort ist „keine Aufgabe" der richtige Zustand.
SQL=$(cat <<SQLEOF
with paare as (
  select r.id as reservation_id,
         r.tenant_id,
         p.title as objekt,
         r.check_in,
         r.status,
         r.channel,
         tr.id as rule_id,
         tr.name as regel,
         -- Der Termin, den die Engine der Aufgabe geben WUERDE: Ende, wenn es
         -- einen End-Trigger gibt, sonst Anfang. `after_check_in_24h` deckelt
         -- die Engine zusaetzlich auf den Check-out — fuer die Altersgrenze
         -- hier ist diese Naeherung genau genug.
         (case
            when tr.end_trigger is not null then
              (case when tr.end_trigger in ('check_in','days_before_check_in',
                                            'after_check_in_24h','booking_confirmed')
                    then r.check_in else r.check_out end)::timestamp
              + (tr.end_offset_minutes || ' minutes')::interval
            else
              (case when tr.start_trigger in ('check_in','days_before_check_in',
                                              'after_check_in_24h','booking_confirmed')
                    then r.check_in else r.check_out end)::timestamp
              + (tr.start_offset_minutes || ' minutes')::interval
          end) as termin
  from reservations r
  join properties p on p.id = r.property_id
  join task_rules tr
    on tr.tenant_id = r.tenant_id
   and tr.kind = 'auto'
   and tr.active
   and tr.start_trigger is not null
  where r.check_out >= current_date - interval '${RUECKBLICK} days'
    and r.check_in <= current_date + interval '${HORIZONT} days'
    and r.status not in ('cancelled','declined','expired','requested')
    and (
      not exists (select 1 from task_rule_assignments a where a.rule_id = tr.id)
      or exists (
        select 1 from task_rule_assignments a
        where a.rule_id = tr.id and a.property_id = r.property_id
      )
    )
)
select paare.check_in, paare.objekt, paare.regel, paare.status,
       coalesce(paare.channel::text,'-'), paare.reservation_id
from paare
where not exists (
  select 1 from tasks t
  where t.reservation_id = paare.reservation_id
    and t.rule_id = paare.rule_id
)
  -- DIESELBE Untergrenze wie im Nachzug (`_regel_anwenden(nicht_vor=…)`): eine
  -- Aufgabe, deren Termin laenger zurueckliegt als der Rueckblick, wird
  -- bewusst NICHT mehr angelegt — ein Willkommens-Check fuer eine Anreise von
  -- vor drei Wochen waere eine Falschmeldung. Ohne diese Zeile meldete das
  -- Skript sie dauerhaft als Luecke, und der Report waere dauerhaft rot,
  -- obwohl alles richtig ist.
  and paare.termin >= current_date - interval '${RUECKBLICK} days'
order by paare.check_in, paare.objekt, paare.regel;
SQLEOF
)

# --- 1) Objekte, die von KEINER Regel erreicht werden -----------------------
# Der Fall, der bei jedem neuen Kunden zuerst auftritt: es gibt noch keine
# Regel, oder ein später angelegtes Objekt fehlt in den Zuordnungen einer
# bestehenden. Beides erzeugt keine Fehlermeldung — es entstehen einfach nie
# Aufgaben. Eine Regel OHNE Zuordnung gilt dagegen für alle Objekte, auch für
# künftige.
DECKUNG_SQL=$(cat <<'SQLEOF'
with wirksam as (
  select r.tenant_id, r.id as rule_id,
         case when r.start_trigger in
                   ('check_in','days_before_check_in','after_check_in_24h',
                    'booking_confirmed')
              then 'anreise' else 'abreise' end as art,
         exists(select 1 from task_rule_assignments a where a.rule_id=r.id)
           as hat_zuordnung
  from task_rules r
  where r.kind='auto' and r.active and r.start_trigger is not null
), luecke as (
  select tn.name as betrieb, p.title as objekt,
         not exists (
           select 1 from wirksam w
           where w.tenant_id=p.tenant_id and w.art='anreise'
             and (not w.hat_zuordnung
                  or exists (select 1 from task_rule_assignments a
                             where a.rule_id=w.rule_id and a.property_id=p.id))
         ) as ohne_anreise,
         not exists (
           select 1 from wirksam w
           where w.tenant_id=p.tenant_id and w.art='abreise'
             and (not w.hat_zuordnung
                  or exists (select 1 from task_rule_assignments a
                             where a.rule_id=w.rule_id and a.property_id=p.id))
         ) as ohne_abreise
  from properties p join tenants tn on tn.id=p.tenant_id
)
select betrieb, objekt,
       case when ohne_anreise and ohne_abreise then 'keine Regel'
            when ohne_anreise then 'keine Anreise-Regel'
            else 'keine Abreise-Regel' end
from luecke where ohne_anreise or ohne_abreise
order by betrieb, objekt;
SQLEOF
)

kopf "Objekte, die von keiner planmäßigen Regel erreicht werden"
container_bestimmen
OHNE_REGEL=$(printf '%s\n' "$DECKUNG_SQL" | psql_run | sed '/^$/d')
if [ -z "$OHNE_REGEL" ]; then
  gruen "Jedes Objekt wird von einer Anreise- UND einer Abreise-Regel erreicht."
else
  printf 'Betrieb | Objekt | fehlt\n'
  printf '%s\n' "$OHNE_REGEL" | tr '|' '\t' \
    | awk -F'\t' '{printf "%s | %s | %s\n", $1,$2,$3}'
  ANZ_REGEL=$(printf '%s\n' "$OHNE_REGEL" | wc -l | tr -d ' ')
  rot "$ANZ_REGEL Objekt(e) ohne wirksame Regel — dort entsteht NIE eine Aufgabe."
  rot "Abhilfe: Regel anlegen, oder das Objekt einer bestehenden zuordnen."
fi

kopf "Buchungen ohne ihre planmäßige Aufgabe (−${RUECKBLICK} bis +${HORIZONT} Tage)"
LUECKEN=$(printf '%s\n' "$SQL" | psql_run)
STATUS=$?
if [ $STATUS -ne 0 ]; then
  rot "Abfrage fehlgeschlagen (Exit $STATUS) — Zugang prüfen."
  exit 2
fi

LUECKEN=$(printf '%s\n' "$LUECKEN" | sed '/^$/d')
if [ -z "$LUECKEN" ]; then
  gruen "Keine Lücke: jede Buchung im Fenster hat die Aufgaben ihrer Regeln."
  # Ein ungedecktes Objekt bleibt ein Befund, auch wenn keine Buchung fehlt.
  [ -z "$OHNE_REGEL" ] && exit 0
  exit 1
fi

printf 'Anreise    | Objekt | Regel | Status | Kanal | Reservierung\n'
printf '%s\n' "$LUECKEN" | tr '|' '\t' | awk -F'\t' '{printf "%-10s | %s | %s | %s | %s | %s\n", $1,$2,$3,$4,$5,$6}'
ANZAHL=$(printf '%s\n' "$LUECKEN" | wc -l | tr -d ' ')
rot "$ANZAHL Lücke(n). Nachzug: Worker-Tick abwarten (stündlich) oder je Buchung"
rot "POST /api/v1/tasks/sync-reservation/<reservation_id> aufrufen."
exit 1
