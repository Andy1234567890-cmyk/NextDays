#!/usr/bin/env bash
# automail-uhrzeit-pruefen.sh — Stimmt jede geplante Automail mit der Uhrzeit
# überein, die der Kunde in der Regel eingestellt hat?
#
# WARUM: Am 14.09.2026 stand „Anreisetag 06:00" live als 08:00 dänischer Zeit
# im Plan — die Uhrzeit wurde in UTC gedeutet, weil ein Schalter „Ortszeit"
# aus war. Der Kunde stellt die Uhrzeit ein, nicht wir. Kein Unit-Test sieht
# das: er rechnet mit der Zeitzone, die man ihm gibt. Nur der Vergleich der
# LIVE-Zeilen (send_at in der Objekt-Zeitzone) mit der Regel (send_time) zeigt
# es. Dieses Skript ist dieser Vergleich, jederzeit wiederholbar.
#
# Prüft alle offenen Zeilen aller Betriebe, Regeln mit fester Uhrzeit.
# Exit 0 = jede Zeile trifft die eingestellte Uhrzeit (Abweichung 0 Minuten,
# Zeitfenster-Verschiebungen auf window_from ausgenommen), Exit 1 sonst.
#
# Zugang wie db-trigger-pruefen.sh (DB_SSH, DB_CONTAINER, PSQL_DSN).
set -uo pipefail
: "${DB_SSH:=root@65.21.144.136}"
: "${DB_CONTAINER:=}"
: "${DB_USER:=supabase_admin}"
: "${DB_NAME:=postgres}"
: "${PSQL_DSN:=}"

# Container EINMAL hier auflösen, nicht in der Funktion: die läuft in $(...)
# Subshells, und eine dort gesetzte Variable geht verloren — die Abfragen
# liefen dann gegen "docker exec -i  psql", kamen leer zurück, und das Skript
# meldete GRÜN (fail-open, 14.09.2026 beim ersten Lauf passiert).
if [ -z "$PSQL_DSN" ] && [ -z "$DB_CONTAINER" ]; then
  DB_CONTAINER=$(ssh -o ConnectTimeout=15 "$DB_SSH" "docker ps --format '{{.Names}}' | grep '^db-' | head -1")
  if [ -z "$DB_CONTAINER" ]; then echo "DB-Container nicht gefunden" >&2; exit 2; fi
fi
psql_ta() {
  if [ -n "$PSQL_DSN" ]; then psql "$PSQL_DSN" -tAq -f -
  else ssh -o ConnectTimeout=15 "$DB_SSH" "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -tAq -f -"
  fi
}

ERGEBNIS=$(psql_ta <<'SQL'
with zeilen as (
  select t.name as betrieb, a.name as regel, a.trigger, a.send_time, a.window_from,
         p.title as objekt, p.timezone,
         to_char(m.send_at at time zone coalesce(p.timezone, 'UTC'), 'HH24:MI') as lokal
    from automation_scheduled_message m
    join message_automation a on a.id = m.automation_id
    join channex_booking b on b.id = m.thread_id
    join properties p on p.id = b.property_id
    join tenants t on t.id = m.tenant_id
   where m.status = 'pending' and a.send_time is not null
)
select betrieb || ' | ' || regel || ' | eingestellt ' || to_char(send_time, 'HH24:MI')
       || ' | geplant ' || lokal || ' | ' || objekt || ' | ' || coalesce(timezone, 'OHNE ZEITZONE')
  from zeilen
 where lokal <> to_char(send_time, 'HH24:MI')
   and (window_from is null or lokal <> to_char(window_from, 'HH24:MI'))
 order by 1;
SQL
)
GESAMT=$(printf 'select count(*) from automation_scheduled_message m join message_automation a on a.id=m.automation_id where m.status=%s and a.send_time is not null;' "'pending'" | psql_ta | tr -d '[:space:]')
# Fail-closed: ohne Zählwert ist die Abfrage nicht gelaufen — das ist kein Grün.
if ! [[ "$GESAMT" =~ ^[0-9]+$ ]]; then
  echo "Abfrage lieferte keinen Zählwert — Verbindung/SQL prüfen." >&2; exit 2
fi
if [ -n "$ERGEBNIS" ]; then
  printf '\033[31mABWEICHUNG — geplante Uhrzeit ≠ eingestellte Uhrzeit:\033[0m\n%s\n' "$ERGEBNIS"
  exit 1
fi
printf '\033[32m✓ %s offene Automails mit fester Uhrzeit — jede trifft die vom Kunden eingestellte Ortszeit.\033[0m\n' "$GESAMT"
