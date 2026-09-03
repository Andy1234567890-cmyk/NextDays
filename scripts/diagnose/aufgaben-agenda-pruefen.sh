#!/usr/bin/env bash
# ============================================================================
# aufgaben-agenda-pruefen.sh — prüft die Datenlage hinter der Aufgaben-Agenda
# ----------------------------------------------------------------------------
# Hintergrund (21.08.2026): Die PMS-App zeigt Aufgaben jetzt nach TAG gruppiert
# mit Zeitfenster, Objekt, Zuständigen, Fortschritt und Wechsel-Merker
# (`mobile-nextdays/screens/HostTasks.tsx`, `HostTaskCalendar.tsx`), plus einen
# Wochenstreifen über der Tages-Agenda. Vorher stand dort nur Titel + Status —
# fehlende oder widersprüchliche Zeitangaben fielen deshalb NICHT auf.
#
# Mit der neuen Ansicht sind genau diese Fälle sichtbar (und teils erklärungs-
# bedürftig). Das Skript liest sie read-only aus der Live-DB:
#   1. Aufgaben ohne start_at UND ohne due_at → Gruppe „Ohne Termin", im
#      Wochenstreifen tragen sie keinen Punkt (kein erfundenes Datum, Wurzel 4).
#   2. Aufgaben nur mit due_at → die Agenda datiert sie über die Fälligkeit,
#      genau wie `_calendar_tasks` im Backend. Zähler, damit die Größenordnung
#      bekannt ist.
#   3. start_at > end_at → das Zeitfenster liest sich als „8:00 – 7:00". Ein
#      Datenfehler, den keine Oberfläche vorher zeigte.
#   4. Offen und niemandem zugewiesen → roter Streifen („kann so nicht erledigt
#      werden", dieselbe Semantik wie im Web-Kalender).
#   5. Überfällig: offen und der Tag liegt vor heute.
#   6. Offene Checklistenpunkte mit Foto-Pflicht → in der App NICHT abhakbar
#      (keine Kamera-Anbindung); der Punkt braucht die Weboberfläche. Die App
#      sagt das im Detail, hier steht die Menge.
#   7. Wurzel 6 (Direktpfad): `tasks` und `checklist_items` dürfen von
#      anon/authenticated NICHT geschrieben werden — sonst hakt eine
#      Reinigungskraft fremde Listen per curl ab, am FastAPI-Scope vorbei.
#
# Aufruf:
#   bash scripts/diagnose/aufgaben-agenda-pruefen.sh
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   DB_SSH=root@65.21.144.136     # leer lassen, wenn psql lokal erreichbar ist
#   DB_CONTAINER=                 # leer = automatisch (docker ps, Präfix db-)
#   DB_USER=supabase_admin
#   DB_NAME=postgres
#
# Exit 0 = keine harten Befunde, Exit 1 = mindestens einer (3, 3b–3g, 7).
# ============================================================================
set -uo pipefail

DB_SSH="${DB_SSH-root@65.21.144.136}"
DB_CONTAINER="${DB_CONTAINER-}"
DB_USER="${DB_USER-supabase_admin}"
DB_NAME="${DB_NAME-postgres}"

rot=$'\033[31m'; gruen=$'\033[32m'; gelb=$'\033[33m'; aus=$'\033[0m'
befunde=0

psql_exec() {
  local sql="$1"
  if [ -n "$DB_SSH" ]; then
    local container="$DB_CONTAINER"
    if [ -z "$container" ]; then
      container=$(ssh "$DB_SSH" "docker ps --format '{{.Names}}' | grep '^db-' | head -1")
    fi
    ssh "$DB_SSH" "docker exec -i $container psql -U $DB_USER -d $DB_NAME -At -F '|' -c \"${sql//\"/\\\"}\""
  else
    psql -U "$DB_USER" -d "$DB_NAME" -At -F '|' -c "$sql"
  fi
}

abschnitt() { printf '\n%s\n' "── $1 ─────────────────────────────────────────"; }

abschnitt "1) Aufgaben ohne jeden Zeitpunkt (Gruppe: Ohne Termin)"
psql_exec "select coalesce(count(*),0) from public.tasks
           where start_at is null and due_at is null
             and status not in ('done','cancelled')" |
  while IFS= read -r n; do
    [ "${n:-0}" -gt 0 ] && printf '%s\n' "${gelb}  $n offene Aufgabe(n) ohne Termin${aus}" ||
      printf '%s\n' "${gruen}  keine${aus}"
  done

abschnitt "2) Aufgaben nur mit Fälligkeit (Agenda datiert über due_at)"
psql_exec "select coalesce(count(*),0) from public.tasks
           where start_at is null and due_at is not null" |
  while IFS= read -r n; do printf '  %s Aufgabe(n)\n' "$n"; done

abschnitt "3) Widersprüchliches Zeitfenster (start_at > end_at)"
ausgabe=$(psql_exec "select id, title, start_at, end_at from public.tasks
                     where start_at is not null and end_at is not null and start_at > end_at
                     order by start_at desc limit 20")
if [ -n "$ausgabe" ]; then
  printf '%s\n' "${rot}  BEFUND — das Zeitfenster liest sich verdreht:${aus}"
  printf '%s\n' "$ausgabe" | sed 's/^/    /'
  befunde=$((befunde + 1))
else
  printf '%s\n' "${gruen}  keine${aus}"
fi

abschnitt "3b) Aufgabe steht nicht am Tag ihrer Buchung"
# Der Fund vom 31.08.2026: 161 von 234 „Velk"-Aufgaben (Empfang bei Anreise)
# standen am falschen Tag, 151 davon genau EINEN Tag zu frueh — der Empfang lag
# vor dem Gast. Ursache war eine Regel mit `days_before_check_in`, deren Offset
# die Distanz tragen sollte und auf 0 stand; niemand pruefte, ob das Ergebnis
# zur Buchung passt.
#
# Geprueft wird die ANKUNFTSBEZOGENE Aufgabe: ihr Start gehoert auf den
# Anreisetag. Abreisebezogene (Reinigung) haben ihren eigenen Anker und sind
# hier bewusst nicht dabei — ihr Start ist der Check-out.
#
# Ein Treffer heisst nicht zwingend „kaputt": eine Regel darf bewusst einen Tag
# vorher greifen (Vorbereitung). Er heisst „hier weicht die Aufgabe vom Anker
# ihrer Regel ab, sieh nach". Deshalb steht die Regel mit in der Ausgabe.
# Der Tag wird in der ZONE DES OBJEKTS gelesen, nicht als UTC-Datum: eine
# Aufgabe um 00:00 Kopenhagen ist 22:00Z des Vortags, und `::date` auf dem
# UTC-Wert meldete sie faelschlich einen Tag zu frueh (03.09.2026).
ausgabe=$(psql_exec "select r.name, count(*),
                            min((t.start_at at time zone coalesce(nullif(p.timezone,''),'UTC'))::date - res.check_in),
                            max((t.start_at at time zone coalesce(nullif(p.timezone,''),'UTC'))::date - res.check_in)
                     from public.tasks t
                     join public.reservations res on res.id = t.reservation_id
                     join public.properties p on p.id = t.property_id
                     join public.task_rules r on r.id = t.rule_id
                     where t.start_at is not null
                       and r.start_trigger in ('check_in','days_before_check_in','arrival_day')
                       and (t.start_at at time zone coalesce(nullif(p.timezone,''),'UTC'))::date <> res.check_in
                     group by r.name order by 2 desc limit 20")
if [ -n "$ausgabe" ]; then
  printf '%s\n' "${rot}  BEFUND — Regel | Anzahl | min/max Tage Abweichung:${aus}"
  printf '%s\n' "$ausgabe" | sed 's/^/    /'
  befunde=$((befunde + 1))
else
  printf '%s\n' "${gruen}  keine${aus}"
fi

abschnitt "3c) Regel, deren Ende vor ihrem Start liegt"
# Die WURZEL, nicht die Folge: eine so konfigurierte Regel erzeugt bei JEDER
# Buchung eine verdrehte Aufgabe. Seit dem 31.08.2026 weist der Server sie beim
# Speichern zurueck (`TasksService._pruefe_zeitfenster`) — dieser Abschnitt
# findet, was VOR der Pruefung angelegt wurde.
ausgabe=$(psql_exec "select name, start_trigger, start_offset_minutes,
                            end_trigger, end_offset_minutes
                     from public.task_rules
                     where kind = 'auto'
                       and start_trigger in ('check_in','days_before_check_in')
                       and end_trigger in ('check_in','days_before_check_in')
                       and coalesce(end_offset_minutes,0) < coalesce(start_offset_minutes,0)")
if [ -n "$ausgabe" ]; then
  printf '%s\n' "${rot}  BEFUND — diese Regeln legen das Ende vor den Start:${aus}"
  printf '%s\n' "$ausgabe" | sed 's/^/    /'
  befunde=$((befunde + 1))
else
  printf '%s\n' "${gruen}  keine${aus}"
fi

abschnitt "3d) Aufgabe liegt VOR der Anreise oder NACH der Abreise ihrer Buchung"
# Der Fund vom 03.09.2026: 25 „Anreisecheck" standen einen Tag vor der
# Anreise. Ursache war `.date()` auf einem bereits nach UTC gerechneten Anker
# (`engine._trigger_time`) — ohne gepflegte Anreisezeit ist das der Vortag.
# Der Tag wird hier in der Zone des OBJEKTS gelesen. „Endreinigung nach
# Abreise" liegt per Definition hinter dem Auszug und ist ausgenommen.
ausgabe=$(psql_exec "select t.title, count(*),
                            sum(case when tag < res.check_in then 1 else 0 end) as vor_anreise,
                            sum(case when tag > res.check_out then 1 else 0 end) as nach_abreise
                     from (select t.*, (t.start_at at time zone coalesce(nullif(p.timezone,''),'UTC'))::date as tag
                           from public.tasks t join public.properties p on p.id = t.property_id
                           where t.start_at is not null) t
                     join public.reservations res on res.id = t.reservation_id
                     where t.title not ilike '%nach Abreise%'
                       and (tag < res.check_in or tag > res.check_out)
                     group by t.title order by 2 desc limit 20")
if [ -n "$ausgabe" ]; then
  printf '%s\n' "${rot}  BEFUND — Titel | Anzahl | vor Anreise | nach Abreise:${aus}"
  printf '%s\n' "$ausgabe" | sed 's/^/    /'
  befunde=$((befunde + 1))
else
  printf '%s\n' "${gruen}  keine${aus}"
fi

abschnitt "3e) Zeitfenster läuft über Mitternacht (Ende an einem anderen Tag als der Start)"
# 233 Aufgaben live (03.09.2026): Regeln mit `days_after_check_out` bzw.
# `+1440 Minuten` und ohne Uhrzeit ergaben Fenster „02:00 bis 02:00 am
# Folgetag". Eine Reinigung dauert keine 24 Stunden. Zwei verschiedene Anker
# (Anreise bis Abreise) sind eine Aufenthaltsaufgabe und hier nicht gemeint —
# geprueft werden nur Aufgaben, deren Regel dieselbe Basis fuer Start und Ende
# traegt, plus alle regellosen mit Fenster ueber Mitternacht.
ausgabe=$(psql_exec "select coalesce(r.name, t.title), count(*)
                     from public.tasks t
                     join public.properties p on p.id = t.property_id
                     left join public.task_rules r on r.id = t.rule_id
                     where t.start_at is not null and t.end_at is not null
                       and (r.id is null or r.start_trigger = r.end_trigger
                            or (r.start_trigger in ('check_in','days_before_check_in','arrival_day')
                                and r.end_trigger in ('check_in','days_before_check_in','arrival_day','after_check_in_24h'))
                            or (r.start_trigger in ('check_out','days_after_check_out','departure_day')
                                and r.end_trigger in ('check_out','days_after_check_out','departure_day')))
                       and (t.end_at at time zone coalesce(nullif(p.timezone,''),'UTC'))::date
                         > (t.start_at at time zone coalesce(nullif(p.timezone,''),'UTC'))::date
                     group by 1 order by 2 desc limit 20")
if [ -n "$ausgabe" ]; then
  printf '%s\n' "${rot}  BEFUND — Regel/Titel | Anzahl:${aus}"
  printf '%s\n' "$ausgabe" | sed 's/^/    /'
  befunde=$((befunde + 1))
else
  printf '%s\n' "${gruen}  keine${aus}"
fi

abschnitt "3f) Aufgabe mit Fälligkeit, aber ohne Startzeit (kein Zeitfenster)"
# 30 Zusatzleistungs-Aufgaben live (03.09.2026): `_task_fuer_addon` schrieb nur
# `due_at`. Ohne `start_at` weiss niemand, WANN die Aufgabe zu tun ist, und
# der Kalender musste den Tag aus dem ENDE holen. Abschnitt 2 zaehlt dasselbe
# nur — seit dem 03.09. ist es ein Befund, weil jeder Schreibpfad ein Fenster
# setzt.
ausgabe=$(psql_exec "select title, count(*) from public.tasks
                     where start_at is null and due_at is not null
                       and status not in ('done','cancelled')
                     group by title order by 2 desc limit 20")
if [ -n "$ausgabe" ]; then
  printf '%s\n' "${rot}  BEFUND — offene Aufgaben ohne Startzeit:${aus}"
  printf '%s\n' "$ausgabe" | sed 's/^/    /'
  befunde=$((befunde + 1))
else
  printf '%s\n' "${gruen}  keine${aus}"
fi

abschnitt "3g) Regel am Tagesanker ohne Uhrzeit oder mit 24h-Fenster an derselben Basis"
# Die WURZEL von 3e: seit dem 03.09.2026 weist der Server beide Formen beim
# Speichern ab (`_pruefe_zeitfenster`). Dieser Abschnitt findet, was VORHER
# angelegt wurde oder am Server vorbei in die Tabelle kam.
ausgabe=$(psql_exec "select name, start_trigger, start_clock, end_trigger, end_clock, end_offset_minutes
                     from public.task_rules
                     where kind = 'auto' and start_trigger is not null
                       and ((start_trigger in ('arrival_day','departure_day') and start_clock is null)
                         or (end_trigger in ('arrival_day','departure_day') and coalesce(end_clock, start_clock) is null)
                         or ((start_trigger in ('check_in','days_before_check_in','arrival_day')
                              and end_trigger in ('check_in','days_before_check_in','arrival_day')
                              or start_trigger in ('check_out','days_after_check_out','departure_day')
                              and end_trigger in ('check_out','days_after_check_out','departure_day'))
                             and coalesce(end_offset_minutes,0) - coalesce(start_offset_minutes,0) >= 1440))")
if [ -n "$ausgabe" ]; then
  printf '%s\n' "${rot}  BEFUND — diese Regeln erzeugen Fenster ohne Uhrzeit oder über den Tag hinaus:${aus}"
  printf '%s\n' "$ausgabe" | sed 's/^/    /'
  befunde=$((befunde + 1))
else
  printf '%s\n' "${gruen}  keine${aus}"
fi

abschnitt "4) Offen und niemandem zugewiesen (roter Streifen)"
psql_exec "select coalesce(count(*),0) from public.tasks
           where assignee_id is null and status not in ('done','cancelled')" |
  while IFS= read -r n; do
    [ "${n:-0}" -gt 0 ] && printf '%s\n' "${gelb}  $n Aufgabe(n) ohne Zuständige${aus}" ||
      printf '%s\n' "${gruen}  keine${aus}"
  done

abschnitt "5) Überfällig (offen, Tag vor heute)"
psql_exec "select coalesce(count(*),0) from public.tasks
           where status not in ('done','cancelled')
             and coalesce(start_at, due_at) < date_trunc('day', now())" |
  while IFS= read -r n; do
    [ "${n:-0}" -gt 0 ] && printf '%s\n' "${gelb}  $n überfällige Aufgabe(n)${aus}" ||
      printf '%s\n' "${gruen}  keine${aus}"
  done

abschnitt "6) Offene Checklistenpunkte mit Foto-Pflicht (App kann sie nicht abhaken)"
psql_exec "select coalesce(count(*),0) from public.checklist_items ci
           join public.tasks t on t.id = ci.task_id
           where ci.requires_photo and not ci.done
             and t.status not in ('done','cancelled')" |
  while IFS= read -r n; do
    [ "${n:-0}" -gt 0 ] && printf '%s\n' "${gelb}  $n Punkt(e) brauchen die Weboberfläche${aus}" ||
      printf '%s\n' "${gruen}  keine${aus}"
  done

abschnitt "7) Direktpfad (Wurzel 6): Schreibrechte von anon/authenticated"
ausgabe=$(psql_exec "select table_name, grantee, privilege_type
                     from information_schema.role_table_grants
                     where table_schema = 'public'
                       and table_name in ('tasks','checklist_items','checklist_photos')
                       and grantee in ('anon','authenticated')
                       and privilege_type in ('INSERT','UPDATE','DELETE')
                     order by table_name, grantee, privilege_type")
if [ -n "$ausgabe" ]; then
  printf '%s\n' "${rot}  BEFUND — Schreibrecht am FastAPI-Scope vorbei:${aus}"
  printf '%s\n' "$ausgabe" | sed 's/^/    /'
  befunde=$((befunde + 1))
else
  printf '%s\n' "${gruen}  kein Schreibrecht für anon/authenticated${aus}"
fi

printf '\n'
if [ "$befunde" -gt 0 ]; then
  printf '%s\n' "${rot}$befunde harte(r) Befund — siehe oben.${aus}"
  exit 1
fi
printf '%s\n' "${gruen}Keine harten Befunde.${aus}"
