#!/usr/bin/env bash
# ============================================================================
# direktpfad-pruefen.sh — beweist, dass der DB-Direktpfad auf die sensiblen
# Tabellen wirklich zu ist (Wurzel 6), statt es zu behaupten.
# ----------------------------------------------------------------------------
# WAS ES PRUEFT — pro Tabelle alle acht Kombinationen aus
#   {anon, authenticated} x {SELECT, INSERT, UPDATE, DELETE}
# per echtem Rollenwechsel gegen die LIVE-DB (`set local role …`). Erwartet
# wird jedes Mal SQLSTATE 42501 „permission denied". Ein 0-Zeilen-Ergebnis
# zaehlt AUSDRUECKLICH NICHT als Beweis: es kann auch nur bedeuten, dass RLS
# gerade zufaellig keine Zeile durchlaesst — der Grant waere trotzdem offen und
# eine spaeter ergaenzte Policy wuerde ihn sofort nutzbar machen.
#
# Zusaetzlich wird belegt, dass service_role (die FastAPI, rolbypassrls = t)
# weiterarbeitet: LESEND auf jeder Tabelle, und SCHREIBEND auf einer — der
# Schreibtest laeuft in einer Transaktion, die IMMER mit rollback endet, es
# wird also keine Kundenzeile veraendert.
#
# Alles laeuft in EINER Transaktion pro Rolle mit rollback am Ende. Read-only
# in der Wirkung.
#
# Aufruf (vom Repo-Root):
#   bash scripts/security/direktpfad-pruefen.sh
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   DB_SSH=root@65.21.144.136
#   DB_PREFIX=db-cdqxi
#   DB_USER=supabase_admin
#   DB_NAME=postgres
#
# Exit 0 = jede gepruefte Tabelle ist fuer anon UND authenticated in allen vier
#          Richtungen dicht und service_role kommt weiterhin durch.
# Exit 1 = mindestens eine Kombination war NICHT „permission denied".
# ============================================================================
set -uo pipefail

: "${DB_SSH:=root@65.21.144.136}"
: "${DB_PREFIX:=db-cdqxi}"
: "${DB_USER:=supabase_admin}"
: "${DB_NAME:=postgres}"

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

rot(){ printf '\033[31m%s\033[0m\n' "$*"; }
gruen(){ printf '\033[32m%s\033[0m\n' "$*"; }
kopf(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# Die Liste der Tabellen, die 0336/0337 geschlossen haben, plus die schon
# vorher gesperrten Finanz-/Auth-Tabellen (0172/0182/0187/0224/0229/0314).
# Sie steht hier ausgeschrieben und wird NICHT aus der DB abgeleitet: sonst
# pruefte das Skript nur, was ohnehin schon zu ist, und ein versehentliches
# Re-Grant fiele nicht auf.
TABELLEN=(
  guests guest_addresses guest_contacts guest_identity_documents
  guest_documents guest_notes guest_consents guest_preferences
  guest_external_ids
  messages whatsapp_conversation whatsapp_message portal_messages
  sandbox_message automation_scheduled_message inbox_scheduled_message
  inbox_thread_note inbox_ai_settings inbox_assignment_log
  message_template message_templates message_automation message_triggers
  channex_booking channex_review channex_debug_log channex_webhook_event
  channex_property_map channex_room_type_map channex_rate_plan_map
  channex_group_map channex_channel_connection channex_tax_map
  ota_account airbnb_historie_lauf reservation_cancellation_log
  owners co_owners owner_properties owner_expenses owner_statements
  owner_billing_terms fee_classification portal_abzugssaetze
  owner_reports owner_report_properties owner_report_payments
  owner_report_payment_items owner_report_payment_parts
  owner_report_schedules owner_report_schedule_properties
  owner_report_schedule_recipients owner_recurring_items
  customers quotes quote_line_items leads partners deals
  travel_agencies travel_agency_contacts travel_agency_contracts
  travel_agency_rates number_sequences
  payments invoices invoice_line_items commissions commission_ledger
  platform_fees payouts payout_adjustments payout_settings donations
  tenant_donation_settings cohost_payouts cohost_stripe_accounts
  property_cohosts subscriptions tenant_subscription
  tenant_module_entitlement tenant_billing_profile
  users user_mfa user_auth_tokens otp_challenge login_devices
  mfa_recovery_code mfa_enforcement mfa_reset_audit
  privacy_settings platform_admins api_clients newsletter_subscribers
  buildings property_access property_guest_portal property_tradespeople
  property_emergency_authority property_service_agreements
  property_process property_marketing property_housebook
  property_platform_launches
  tenants tenant_custom_domains tenant_onboarding
  staff_property_assignments owner_property_assignments
  jobs ari_outbox ari_restriction_outbox support_diagnostics
  announcements announcement_reads announcement_translations
  schema_migrations
)


# Erzeugt fuer eine Rolle die vier Proben je Tabelle. INSERT/UPDATE/DELETE
# werden mit einer Bedingung gefahren, die NIE zutrifft (`where false`): trifft
# der Grant-Riegel, kommt 42501 noch VOR der Auswertung; trifft er nicht, wird
# garantiert keine Kundenzeile angefasst.
#
# Das UPDATE braucht eine ECHTE Spalte. Ein erster Versuch mit
# `set tableoid = tableoid` lief in SQLSTATE 0A000 („feature not supported"):
# Postgres lehnt die Systemspalte ab, BEVOR es die Rechte prueft — die Probe
# haette dann 198 falsche Befunde gemeldet, ohne dass ein Grant offen war.
# Genau darum meldet probe() jeden Nicht-42501-Fehler als FEHLER und nicht als
# „dicht": ein Fehler aus einem anderen Grund ist kein Beweis fuer einen Riegel.
# Die Spalte wird pro Tabelle aus dem Katalog geholt (erste normale Spalte) und
# auf sich selbst gesetzt, ist also auch bei zufaelligem Treffer wertneutral.
proben_sql() {
  local rolle="$1"
  {
    echo "begin;"
    echo "create or replace function pg_temp.probe(sql text) returns text language plpgsql as \$fn\$"
    echo "declare n bigint;"
    echo "begin"
    echo "  execute sql; get diagnostics n = row_count; return 'OFFEN(' || n::text || ')';"
    echo "exception when insufficient_privilege then return 'DENIED';"
    echo "when others then return 'FEHLER:' || sqlstate; end \$fn\$;"
    echo "set local role $rolle;"
    for t in "${TABELLEN[@]}"; do
      local sp
      sp="$(spalte_von "$t")"
      echo "select '$rolle|$t|SELECT|' || pg_temp.probe('select 1 from public.$t limit 1');"
      echo "select '$rolle|$t|INSERT|' || pg_temp.probe('insert into public.$t select * from public.$t where false');"
      if [ -n "$sp" ]; then
        echo "select '$rolle|$t|UPDATE|' || pg_temp.probe('update public.$t set \"$sp\" = \"$sp\" where false');"
      else
        echo "select '$rolle|$t|UPDATE|KEINE_SPALTE';"
      fi
      echo "select '$rolle|$t|DELETE|' || pg_temp.probe('delete from public.$t where false');"
    done
    echo "rollback;"
  }
}

psql_run() {
  ssh -o ConnectTimeout=20 "$DB_SSH" \
    "docker exec -i \$(docker ps --format '{{.Names}}' | grep -E '^$DB_PREFIX' | head -1) psql -U $DB_USER -d $DB_NAME -tAq -f -"
}

# Je Tabelle die erste normale Spalte holen — sie traegt die UPDATE-Probe.
# Bewusst KEIN assoziatives Array: macOS liefert bash 3.2 aus, dort gibt es
# `declare -A` nicht. Die Zuordnung liegt darum als "tabelle|spalte"-Zeilen in
# einer Variablen und wird per grep nachgeschlagen.
kopf "0) Spalten fuer die UPDATE-Probe aus dem Katalog holen"
spalte_von() {
  printf '%s\n' "$SPALTEN_MAP" | awk -F'|' -v t="$1" '$1==t {print $2; exit}'
}
SPALTEN_SQL="select c.relname || '|' || a.attname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
join pg_attribute a on a.attrelid = c.oid and a.attnum = (
    select min(a2.attnum) from pg_attribute a2
    where a2.attrelid = c.oid and a2.attnum > 0 and not a2.attisdropped)
where c.relkind = 'r' and c.relname in ($(printf "'%s'," "${TABELLEN[@]}" | sed 's/,$//'));"
SPALTEN_MAP="$(printf '%s\n' "$SPALTEN_SQL" | psql_run 2>/dev/null)"
GEFUNDEN="$(printf '%s\n' "$SPALTEN_MAP" | grep -c '|' || true)"
echo "  $GEFUNDEN von ${#TABELLEN[@]} Tabellen im Katalog gefunden."
if [ "$GEFUNDEN" -ne "${#TABELLEN[@]}" ]; then
  # Eine Tabelle aus der Liste existiert nicht mehr — das ist ein Befund, kein
  # Grund weiterzumachen: sonst prueft das Skript still weniger als behauptet
  # und ein „alles gruen" waere wertlos.
  for t in "${TABELLEN[@]}"; do
    [ -n "$(spalte_von "$t")" ] || rot "  FEHLT in public: $t"
  done
  exit 1
fi

kopf "1) anon + authenticated x SELECT/INSERT/UPDATE/DELETE (${#TABELLEN[@]} Tabellen)"

AUSGABE="$( { proben_sql anon; proben_sql authenticated; } | psql_run 2>&1 )"

if [ -z "$AUSGABE" ]; then
  rot "Keine Ausgabe von der DB — Verbindung/Container pruefen."
  exit 1
fi

BEFUNDE=0
GEPRUEFT=0
while IFS='|' read -r rolle tabelle op status; do
  case "$rolle" in anon|authenticated) ;; *) continue ;; esac
  GEPRUEFT=$((GEPRUEFT + 1))
  if [ "$status" != "DENIED" ]; then
    BEFUNDE=$((BEFUNDE + 1))
    rot "  OFFEN  $rolle $op public.$tabelle -> $status"
  fi
done <<< "$AUSGABE"

if [ "$BEFUNDE" -eq 0 ]; then
  gruen "  $GEPRUEFT/$GEPRUEFT Kombinationen: permission denied (42501)."
else
  rot "  $BEFUNDE von $GEPRUEFT Kombinationen NICHT gesperrt."
fi

kopf "2) service_role: lesend auf jeder Tabelle"

SR_SQL=$(
  {
    echo "begin;"
    echo "create or replace function pg_temp.probe(sql text) returns text language plpgsql as \$fn\$"
    echo "begin execute sql; return 'OK';"
    echo "exception when others then return 'FEHLER:' || sqlstate; end \$fn\$;"
    echo "set local role service_role;"
    for t in "${TABELLEN[@]}"; do
      echo "select 'service_role|$t|SELECT|' || pg_temp.probe('select 1 from public.$t limit 1');"
    done
    echo "rollback;"
  }
)
SR_AUS="$(printf '%s\n' "$SR_SQL" | psql_run 2>&1)"

SR_BEFUNDE=0
SR_GEPRUEFT=0
while IFS='|' read -r rolle tabelle op status; do
  [ "$rolle" = "service_role" ] || continue
  SR_GEPRUEFT=$((SR_GEPRUEFT + 1))
  if [ "$status" != "OK" ]; then
    SR_BEFUNDE=$((SR_BEFUNDE + 1))
    rot "  BLOCKIERT  service_role $op public.$tabelle -> $status"
  fi
done <<< "$SR_AUS"

if [ "$SR_BEFUNDE" -eq 0 ]; then
  gruen "  $SR_GEPRUEFT/$SR_GEPRUEFT Tabellen lesbar — die FastAPI arbeitet weiter."
else
  rot "  $SR_BEFUNDE Tabelle(n) fuer service_role blockiert — das waere ein Ausfall."
fi

kopf "3) service_role: schreibend (mit rollback, keine Datenzeile bleibt geaendert)"

# Bewusst public.guest_notes: eine der in 0337 geschlossenen Tabellen, deren
# Schreibpfad die API braucht. Der Insert laeuft in einer Transaktion, die
# unmittelbar danach zurueckgerollt wird — die Zeilenzahl davor und danach
# wird mit ausgegeben, damit der Rueckweg belegt ist und nicht behauptet.
SCHREIB_SQL=$(cat <<'SQLEND'
begin;
set local role service_role;
select 'vorher|' || count(*)::text from public.guest_notes;
insert into public.guest_notes (tenant_id, guest_id, body, category)
select tenant_id, id, 'direktpfad-pruefen.sh Schreibprobe', 'test'
from public.guests limit 1
returning 'insert_ok|' || id::text;
select 'waehrend|' || count(*)::text from public.guest_notes;
rollback;
select 'nachher|' || count(*)::text from public.guest_notes;
SQLEND
)
SCHREIB_AUS="$(printf '%s\n' "$SCHREIB_SQL" | psql_run 2>&1)"
echo "$SCHREIB_AUS" | sed 's/^/  /'

VORHER="$(echo "$SCHREIB_AUS" | awk -F'|' '/^vorher\|/{print $2}')"
NACHHER="$(echo "$SCHREIB_AUS" | awk -F'|' '/^nachher\|/{print $2}')"
SCHREIB_OK=0
if echo "$SCHREIB_AUS" | grep -q '^insert_ok|' && [ -n "$VORHER" ] && [ "$VORHER" = "$NACHHER" ]; then
  gruen "  service_role darf schreiben, und der rollback hat gehalten ($VORHER = $NACHHER)."
else
  rot "  Schreibprobe nicht sauber (vorher=$VORHER nachher=$NACHHER)."
  SCHREIB_OK=1
fi

kopf "Ergebnis"
if [ "$BEFUNDE" -eq 0 ] && [ "$SR_BEFUNDE" -eq 0 ] && [ "$SCHREIB_OK" -eq 0 ]; then
  gruen "Direktpfad dicht, FastAPI unbeeintraechtigt."
  exit 0
fi
rot "Mindestens eine Pruefung ist durchgefallen."
exit 1
