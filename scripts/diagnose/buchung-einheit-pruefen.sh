#!/usr/bin/env bash
# ============================================================================
# buchung-einheit-pruefen.sh — findet Buchungen, die keiner Einheit gehören
# ----------------------------------------------------------------------------
# Hintergrund (24.08.2026): Eine Website-Buchung (Otto Kurz, FeWo Vidstrup
# Have, 23.–25.10.) ließ sich nicht verlängern. Der Kalender-Drag endete in
# „Ziel-Zeitraum enthält bereits belegte/gesperrte Tage", obwohl 25.–27.10.
# frei waren. Ursache: `reservations.unit_id` war NULL, die `availability`-
# Zeilen derselben Buchung trugen die Einheit dagegen sehr wohl. Der
# Alt-Tag-Filter in `move()` vergleicht Kalenderzeile ↔ Reservierung über die
# Einheit — er traf nie, und die Buchung zählte ihre EIGENEN Nächte als
# Fremdbelegung. Sie blockierte sich selbst, dauerhaft.
#
# Betroffen waren alle 10 `channel='website'`-Zeilen des Beta-Betriebs; jede
# über `create_reservation_atomic` (0275) angelegte Buchung trägt ihre Einheit,
# denn die RPC schreibt sie selbst. Migration 0431 hat den Bestand nachgezogen,
# `_gehaltene_einheit` leitet sie zur Laufzeit ab.
#
# Warum ein Dauer-Prüfskript und kein Einmal-Fix: die Spalte ist nullable und
# trägt `on delete set null` (0265). Jeder Insert-Pfad, der die RPC umgeht —
# ein Import, ein Skript, PostgREST direkt —, legt den Zustand neu an. Ohne
# Einheit hängt nicht nur der Move: `_release_nights` gibt die Nächte einer
# solchen Buchung bei n > 1 Einheiten fail-closed GAR NICHT frei (Wurzel 1),
# und der Kalender behält sie dann als unverkäuflich.
#
# Geprüft wird (read-only):
#   1. Aktive Buchungen ohne `unit_id`, deren Objekt Einheiten führt.
#   2. Davon die, bei denen die Einheit NICHT eindeutig ableitbar ist (mehrere
#      Kandidatinnen bzw. keine) — dort schlägt auch die Laufzeit-Ableitung
#      fehl und der Betrieb bekommt den 409 „keiner Einheit zugeordnet".
#   3. Buchungen, deren `unit_id` auf eine Einheit eines FREMDEN Objekts zeigt
#      — dann prüft der EXCLUDE-Constraint (0315) gegen die falsche Einheit.
#   4. Objekte ganz ohne `property_units`-Zeile: dort lehnt die RPC jede neue
#      Buchung mit 22023 ab (Datenfehler, nicht Ausbuchung).
#
# Aufruf:
#   bash scripts/diagnose/buchung-einheit-pruefen.sh
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   DB_SSH=root@65.21.144.136     # leer lassen, wenn psql lokal erreichbar ist
#   DB_CONTAINER=                 # leer = automatisch (docker ps, Präfix db-)
#   DB_USER=supabase_admin
#   DB_NAME=postgres
#
# Exit 0 = alles sauber, Exit 1 = mindestens ein Befund.
# ============================================================================
set -uo pipefail

DB_SSH="${DB_SSH-root@65.21.144.136}"
DB_CONTAINER="${DB_CONTAINER-}"
DB_USER="${DB_USER-supabase_admin}"
DB_NAME="${DB_NAME-postgres}"

psql_exec() {
  local sql="$1"
  if [[ -n "$DB_SSH" ]]; then
    local container="$DB_CONTAINER"
    if [[ -z "$container" ]]; then
      container=$(ssh "$DB_SSH" "docker ps --format '{{.Names}}' | grep '^db-' | head -1")
    fi
    ssh "$DB_SSH" "docker exec $container psql -U $DB_USER -d $DB_NAME -Atc \"$sql\""
  else
    psql -U "$DB_USER" -d "$DB_NAME" -Atc "$sql"
  fi
}

fehler=0

pruefe() {
  # $1 = Titel, $2 = count-SQL, $3 = Detail-SQL, $4 = Erklärung
  local titel="$1" count_sql="$2" detail_sql="$3" hinweis="$4"
  echo "— $titel —"
  local anzahl
  anzahl=$(psql_exec "$count_sql")
  if [[ -z "$anzahl" ]]; then
    echo "FEHLER: keine Antwort von der DB — Zugang prüfen (DB_SSH/DB_CONTAINER)." >&2
    exit 1
  fi
  if [[ "$anzahl" != "0" ]]; then
    echo "BEFUND: $anzahl Zeile(n)." >&2
    psql_exec "$detail_sql" >&2
    echo "→ $hinweis" >&2
    fehler=1
  else
    echo "OK: 0."
  fi
  echo
}

# Aktiv = belegt eine Nacht. Deckungsgleich mit der WHERE-Klausel des
# EXCLUDE-Constraints (0184) und mit `_NICHT_BELEGEND` im Service.
AKTIV="r.status not in ('cancelled','declined','expired')"

# 1. Buchung ohne Einheit, obwohl das Objekt Einheiten führt.
pruefe "Aktive Buchungen ohne unit_id" \
  "select count(*) from public.reservations r
    where r.unit_id is null and $AKTIV
      and exists (select 1 from public.property_units u
                   where u.property_id = r.property_id)" \
  "select r.id || ' | ' || r.channel || ' | ' || r.check_in || '–' || r.check_out
          || ' | ' || coalesce(p.title,'?')
     from public.reservations r
     left join public.properties p on p.id = r.property_id
    where r.unit_id is null and $AKTIV
      and exists (select 1 from public.property_units u
                   where u.property_id = r.property_id)
    order by r.check_in desc limit 30" \
  "Diese Buchungen sind nicht verlängerbar/verschiebbar und ihre Nächte werden
  bei n > 1 Einheiten nicht freigegeben. Migration 0431 erneut fahren
  (bash supabase/apply-migrations.sh reicht nicht — sie ist getrackt; das SQL
  aus 0431 von Hand nachziehen) und den Insert-Pfad finden, der die RPC
  create_reservation_atomic umgeht."

# 2. Davon die NICHT eindeutig ableitbaren. Kandidatin = Einheit, die an ALLEN
#    Nächten der Buchung 'booked' ist und die keine andere aktive Buchung im
#    Zeitraum für sich benennt. Genau die Rechnung, die `_gehaltene_einheit`
#    macht — hier als Vorhersage, wo sie fehlschlägt.
pruefe "Buchungen ohne unit_id, deren Einheit NICHT ableitbar ist" \
  "with offen as (
      select r.id, r.property_id, r.check_in, r.check_out
        from public.reservations r
       where r.unit_id is null and $AKTIV
         and r.check_out > r.check_in
   ), kandidat as (
      select o.id, a.unit_id, count(*) as belegt, (o.check_out - o.check_in) as n
        from offen o
        join public.availability a
          on a.property_id = o.property_id and a.status = 'booked'
         and a.date >= o.check_in and a.date < o.check_out
         and a.unit_id is not null
       group by o.id, a.unit_id, o.check_in, o.check_out
   ), frei as (
      select k.id, k.unit_id from kandidat k
        join offen o on o.id = k.id
       where k.belegt = k.n
         and not exists (
            select 1 from public.reservations x
             where x.property_id = o.property_id and x.id <> o.id
               and x.unit_id = k.unit_id
               and x.status not in ('cancelled','declined','expired')
               and x.check_in < o.check_out and x.check_out > o.check_in)
   )
   select count(*) from offen o
    where (select count(*) from frei f where f.id = o.id) <> 1" \
  "with offen as (
      select r.id, r.property_id, r.check_in, r.check_out, r.channel
        from public.reservations r
       where r.unit_id is null and $AKTIV
         and r.check_out > r.check_in
   ), kandidat as (
      select o.id, a.unit_id, count(*) as belegt, (o.check_out - o.check_in) as n
        from offen o
        join public.availability a
          on a.property_id = o.property_id and a.status = 'booked'
         and a.date >= o.check_in and a.date < o.check_out
         and a.unit_id is not null
       group by o.id, a.unit_id, o.check_in, o.check_out
   ), frei as (
      select k.id, k.unit_id from kandidat k
        join offen o on o.id = k.id
       where k.belegt = k.n
         and not exists (
            select 1 from public.reservations x
             where x.property_id = o.property_id and x.id <> o.id
               and x.unit_id = k.unit_id
               and x.status not in ('cancelled','declined','expired')
               and x.check_in < o.check_out and x.check_out > o.check_in)
   )
   select o.id || ' | ' || o.channel || ' | ' || o.check_in || '–' || o.check_out
          || ' | Kandidatinnen: '
          || (select count(*) from frei f where f.id = o.id)
     from offen o
    where (select count(*) from frei f where f.id = o.id) <> 1
    order by o.check_in desc limit 30" \
  "Hier scheitert auch die Laufzeit-Ableitung: move() antwortet 409 „Diese
  Buchung ist keiner Einheit zugeordnet“. Die Einheit MUSS von Hand gesetzt
  werden — welche, sagt der Kalender nicht eindeutig, also mit dem Betrieb
  klären. Eine geratene Einheit ist eine Doppelbelegung (Wurzel 4)."

# 3. unit_id zeigt auf ein FREMDES Objekt.
pruefe "unit_id gehört zu einem anderen Objekt" \
  "select count(*) from public.reservations r
     join public.property_units u on u.id = r.unit_id
    where u.property_id <> r.property_id" \
  "select r.id || ' | Buchung an ' || r.property_id || ' | Einheit an ' || u.property_id
     from public.reservations r
     join public.property_units u on u.id = r.unit_id
    where u.property_id <> r.property_id
    order by r.check_in desc limit 30" \
  "Der EXCLUDE-Constraint (0315, coalesce(unit_id, property_id)) prüft damit
  gegen die falsche Einheit — Doppelbuchungen kommen durch. Entstehen kann das
  nur, wenn ein Objektwechsel die Einheit nicht mitgezogen hat."

# 4. Objekt ohne Einheiten-Zeile.
pruefe "Objekte ohne property_units-Zeile" \
  "select count(*) from public.properties p
    where p.status <> 'inactive'
      and not exists (select 1 from public.property_units u
                       where u.property_id = p.id)" \
  "select p.id || ' | ' || coalesce(p.title,'?') || ' | ' || p.status
     from public.properties p
    where p.status <> 'inactive'
      and not exists (select 1 from public.property_units u
                       where u.property_id = p.id)
    order by p.created_at desc limit 30" \
  "create_reservation_atomic lehnt dort JEDE Buchung mit 22023 ab („Objekt hat
  keine Einheit“). Einheit anlegen (property_mapping legt sie beim Onboarding
  mit an, 0265/0267)."

echo "— Übersicht: Buchungen je Kanal ohne Einheit —"
psql_exec "select r.channel || ': ' || count(*)
             from public.reservations r
            where r.unit_id is null and $AKTIV
            group by r.channel order by 1"
echo

if [[ "$fehler" != "0" ]]; then
  echo "✗ Befunde vorhanden — siehe oben." >&2
  exit 1
fi
echo "✓ Jede aktive Buchung gehört genau einer Einheit ihres Objekts."
