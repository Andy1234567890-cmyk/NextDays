#!/usr/bin/env bash
# glocke-wiederholungen-pruefen.sh — meldet Benachrichtigungen, die mehrfach
# zum SELBEN Ereignis entstanden sind, und Meldungen, die lange NACH dem
# Ereignis entstanden, das sie melden.
#
# WARUM ES DIESES SKRIPT GIBT (live gemeldet 09.09.2026): „hier kommen immer
# alte benachrichtungen in den notfcaichon und die e-mails gehen auch doppelt
# raus." In der Glocke standen dutzende Buchungen als frische Ereignisse,
# mehrere wortgleich doppelt. Gefunden wurde das vom AUGE des Nutzers, nicht
# vom System — es gab kein Gate, das eine Wiederholung sichtbar macht.
#
# Fuenf Wurzeln lagen dahinter (alle im selben Zug behoben):
#   1. `import_bookings_for_property` projizierte ohne `bestandsimport=True`
#   2. `buchungs_abgleich` entschied „Bestand" an der ANREISE statt am
#      Buchungszeitpunkt
#   3. die Storno-Meldung hing an KEINEM Schalter (anders als `created`)
#   4. der Nachrichten-Nachtrag laeutete fuer den ganzen Verlauf
#   5. der partielle Dedup-Index fiel nach dem Lesen weg (0617: `einmalig`)
#
# Was hier gezaehlt wird, MUSS 0 sein. Jede Zeile > 0 ist eine Wiederholung,
# die ein Empfaenger als zweite Mail gesehen hat.
#
# AUFRUF (vom Repo-Root, braucht SSH-Zugang zum Server — derselbe Weg wie
# `csv-ueberschreibt-feed-pruefen.sh` und `apply-migrations.sh`):
#   bash scripts/diagnose/glocke-wiederholungen-pruefen.sh
#   TAGE=7 bash scripts/diagnose/glocke-wiederholungen-pruefen.sh
#
# Exit 1, sobald eine Doppelmeldung gefunden wird (CI-faehig).
set -euo pipefail

TAGE="${TAGE:-30}"

# Denselben Weg zur DB nehmen wie die zwoelf anderen Diagnose-Skripte: psql im
# DB-Container ueber SSH, SQL immer ueber stdin. Kein zweiter Verbindungsweg,
# der eigene Zugangsdaten pflegt.
#
# ACHTUNG (Fehler der ersten Fassung dieses Skripts, 09.09.2026): Ein lokales
# `docker exec` mit `DB_PREFIX=supabase-db` laeuft NICHT — die Live-DB heisst
# `db-cdqxi*` und liegt auf einem anderen Host. Ein Gate, das nicht laufen
# kann, ist schlechter als keines: es erzeugt den Glauben, geprueft zu sein.
SERVER="${MIGRATE_SSH:-root@65.21.144.136}"
DB_PREFIX="${MIGRATE_DB_PREFIX:-db-cdqxi}"
DB_USER="${MIGRATE_DB_USER:-supabase_admin}"
DB_NAME="${MIGRATE_DB_NAME:-postgres}"
# `$(docker ps …)` MUSS auf dem Server expandieren, nicht hier: der
# Containername ist dort zu ermitteln. Daher einfache Anfuehrungszeichen.
# shellcheck disable=SC2016
REMOTE_CMD='docker exec -i $(docker ps --format "{{.Names}}" | grep -E "^'"$DB_PREFIX"'" | head -1) psql -U "'"$DB_USER"'" -d "'"$DB_NAME"'" -f -'

lauf() {
    ssh -o ConnectTimeout=15 "$SERVER" "$REMOTE_CMD"
}

echo "== Glocke: Wiederholungen der letzten ${TAGE} Tage =="
echo

# ---------------------------------------------------------------------------
# 0. Die BASELINE. Sie steht zuerst, weil ohne sie kein Erfolgskriterium
#    existiert: „ist es besser geworden" braucht eine Zahl von vorher.
# ---------------------------------------------------------------------------
echo "-- 0. Meldungen je Praefix (Baseline: count > distinct = Wiederholung)"
lauf <<SQL
\pset format aligned
select
    split_part(dedup_key, ':', 1)  as praefix,
    count(*)                       as meldungen,
    count(distinct dedup_key)      as ereignisse,
    count(*) - count(distinct dedup_key) as ueberschuss
from public.notifications
where dedup_key is not null
  and created_at > now() - interval '${TAGE} days'
group by 1
order by 4 desc, 2 desc;
SQL

echo
# ---------------------------------------------------------------------------
# 1. Derselbe dedup_key mehrfach — die harte Doppelmeldung.
# ---------------------------------------------------------------------------
echo "-- 1. Mehrfache Meldungen zum selben dedup_key (MUSS leer sein)"
lauf <<SQL
\pset format aligned
select
    n.dedup_key,
    count(*)                             as anzahl,
    min(n.created_at)::timestamp(0)      as erste,
    max(n.created_at)::timestamp(0)      as letzte,
    bool_or(n.einmalig)                  as einmalig,
    count(n.gelesen_am)                  as davon_gelesen
from public.notifications n
where n.dedup_key is not null
  and n.created_at > now() - interval '${TAGE} days'
group by n.dedup_key
having count(*) > 1
order by count(*) desc, max(n.created_at) desc
limit 40;
SQL

echo
# ---------------------------------------------------------------------------
# 2. Ereignis-Meldungen OHNE `einmalig` — der Riegel greift dort nicht.
# ---------------------------------------------------------------------------
echo "-- 2. Ereignis-Meldungen ohne \`einmalig\` (0617 nicht gesetzt)"
lauf <<SQL
\pset format aligned
select
    split_part(dedup_key, ':', 1) as praefix,
    count(*)                      as zeilen
from public.notifications
where dedup_key is not null
  and not einmalig
  and split_part(dedup_key, ':', 1) in ('buchung', 'betrieb_buchung')
  and created_at > now() - interval '${TAGE} days'
group by 1
order by 2 desc;
SQL

echo
# ---------------------------------------------------------------------------
# 3. Wurzel 5b: Meldung entstand lange NACH dem Ereignis, das sie meldet.
#    Eine Buchung, die vor Monaten getaetigt wurde, aber heute gemeldet wird,
#    ist ein nachgetragener Bestand, der als Ereignis durchgekommen ist.
#
#    BEIDE Empfaengerkreise: `buchung:` (Eigentuemer) UND `betrieb_buchung:`
#    (Betriebsleitung, `ereignisse.py`). Die erste Fassung filterte nur
#    `buchung:created:%` — und `like` ist praefix-verankert, also fielen genau
#    die Betriebsleitungs-Meldungen heraus, die der Nutzer in seiner Glocke sah.
# ---------------------------------------------------------------------------
echo "-- 3. Meldung deutlich spaeter als die gemeldete Buchung (Wurzel 5b)"
lauf <<SQL
\pset format aligned
select
    n.created_at::timestamp(0)  as gemeldet,
    r.booked_at::timestamp(0)   as gebucht,
    r.check_in                  as anreise,
    date_part('day', n.created_at - r.booked_at)::int as tage_dazwischen,
    split_part(n.dedup_key, ':', 1) as kreis,
    n.titel
from public.notifications n
join public.reservations r
    on r.id::text = split_part(n.dedup_key, ':', 3)
where n.dedup_key ~ '^(betrieb_)?buchung:(created|cancelled):'
  and r.booked_at is not null
  and n.created_at - r.booked_at > interval '3 days'
  and n.created_at > now() - interval '${TAGE} days'
order by n.created_at desc
limit 30;
SQL

echo
# ---------------------------------------------------------------------------
# Das Urteil. Getrennt abgefragt, damit der Exit-Code an EINER Zahl haengt.
# ---------------------------------------------------------------------------
DOPPELT="$(lauf <<SQL
\pset format unaligned
\pset tuples_only on
select count(*) from (
    select user_id, dedup_key
    from public.notifications
    where dedup_key is not null
      and created_at > now() - interval '${TAGE} days'
    group by user_id, dedup_key
    having count(*) > 1
) t;
SQL
)"
DOPPELT="$(echo "${DOPPELT}" | tr -d '[:space:]')"

if [ -z "${DOPPELT}" ]; then
    echo "FEHLER: keine Antwort von der Datenbank — Verbindung pruefen."
    exit 2
fi
if [ "${DOPPELT}" != "0" ]; then
    echo "FEHLER: ${DOPPELT} dedup_key(s) mit mehr als einer Meldung."
    echo "Jede davon ist beim Empfaenger als zweite Mail angekommen."
    exit 1
fi
echo "OK: keine doppelten Meldungen im Fenster von ${TAGE} Tagen."
