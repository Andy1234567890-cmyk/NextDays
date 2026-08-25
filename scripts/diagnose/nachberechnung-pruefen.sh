#!/usr/bin/env bash
# ============================================================================
# nachberechnung-pruefen.sh — prüft die Nachberechnungs-Zahlungslinks (0469)
# ----------------------------------------------------------------------------
# Hintergrund (25.08.2026): Eine Buchung über die eigene Website („FeWo
# Vidstrup Have", 23.–28.10.2026) wurde manuell verlängert. Der Preis wurde neu
# gerechnet, aber es gab keinen Weg, die Differenz beim Gast einzuziehen — der
# Datensatz kam per Import aus Lodgify, hat also keine gespeicherte Karte.
# 0469 ergänzt einen Stripe Payment Link je Buchung (`reservation_charge_links`).
#
# Das Skript prüft die LIVE-DB (read-only) auf die Zustände, die es nach dieser
# Änderung nicht geben darf:
#   1. Offener Link an einer Buchung, die den Weg gar nicht (mehr) erlaubt:
#      fremder Kanal, Channex-Import oder storniert. Die Stripe-URL nimmt dann
#      Geld für eine Forderung an, die es so nicht gibt (Wurzel 1/3).
#   2. Offener Link, dessen `basis_total_amount` nicht mehr zum aktuellen
#      `total_amount` passt → der Betrag ist veraltet. Der Betragsabgleich in
#      `verbuche_zahlung` fängt das NICHT: er vergleicht mit `amount_cents`,
#      und der stimmt weiter.
#   3. Bezahlter Link ohne `payments`-Beleg → die Zahlung ist eingegangen, steht
#      aber in keiner Rechnung und keiner Eigentümer-Abrechnung.
#   4. Offener Betrag überschritten: Summe der bezahlten Nachberechnungen einer
#      Buchung größer als `total_amount − (paid_amount − Nachberechnungen)`
#      → der Gast hat mehr gezahlt, als die Buchung fordert.
#   5. Geplante Restzahlung (`payments.type='balance'`, `scheduled_status
#      ='scheduled'`), deren Betrag nicht `total_amount − paid_amount` ist. Das
#      ist der Fehler, den 0469 abgestellt hat: der stündliche Worker-Tick zieht
#      sonst den ALTEN Betrag ein (Wurzel 1).
#   6. Manuelle Bezahlt-Markierung ohne Beleg in `payments` (0470) — die Zahlung
#      erscheint dann in keiner Rechnung und keiner Eigentümer-Abrechnung.
#   7. Zurückgenommene Markierung, deren Beleg noch steht — der Betrag wäre aus
#      der Buchung heraus, aber im Zahlungsjournal noch drin.
#   8. Der Direktpfad (Wurzel 6): anon/authenticated dürfen auf
#      `reservation_charge_links` KEIN Recht haben — die Tabelle trägt Beträge
#      und bezahlbare URLs. Zusätzlich: RLS an, beide Policies vorhanden.
#
# Aufruf:
#   bash scripts/diagnose/nachberechnung-pruefen.sh
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

# 1. Offener Link an einer Buchung, die den Weg nicht erlaubt.
pruefe "Offene Links an unzulässigen Buchungen" \
  "select count(*) from public.reservation_charge_links l
     join public.reservations r on r.id = l.reservation_id
    where l.status = 'open'
      and (r.channel <> 'website'
           or r.source_channex_booking_id is not null
           or r.status = 'cancelled')" \
  "select l.id || ' | ' || r.channel || ' | ' || r.status || ' | '
          || (l.amount_cents/100.0) || ' ' || l.currency
     from public.reservation_charge_links l
     join public.reservations r on r.id = l.reservation_id
    where l.status = 'open'
      and (r.channel <> 'website'
           or r.source_channex_booking_id is not null
           or r.status = 'cancelled')
    order by l.created_at desc limit 20" \
  "Die URL nimmt Geld für eine Buchung an, die diesen Zahlweg nicht (mehr) hat.
  Betroffene Links zurückziehen (DELETE .../nachberechnung). Bei Storno/Move
  macht das der Gegenzustand automatisch — hier ist er ausgefallen."

# 2. Offener Link auf veraltetem Buchungsbetrag.
pruefe "Offene Links mit veraltetem Basisbetrag" \
  "select count(*) from public.reservation_charge_links l
     join public.reservations r on r.id = l.reservation_id
    where l.status = 'open'
      and abs(coalesce(r.total_amount,0) - l.basis_total_amount) >= 0.01" \
  "select l.id || ' | Basis ' || l.basis_total_amount || ' | jetzt '
          || coalesce(r.total_amount,0) || ' ' || l.currency
     from public.reservation_charge_links l
     join public.reservations r on r.id = l.reservation_id
    where l.status = 'open'
      and abs(coalesce(r.total_amount,0) - l.basis_total_amount) >= 0.01
    order by l.created_at desc limit 20" \
  "Der Buchungsbetrag hat sich nach der Erstellung geändert. Die Oberfläche
  warnt, aber der Link ist weiter bezahlbar: prüfen, zurückziehen und mit dem
  richtigen Betrag neu erstellen."

# 3. Bezahlter Link ohne Beleg in payments.
# Nur STRIPE-Zahlungen: Bei einer manuellen Markierung (0470) ist
# `checkout_session_id` null, und `p.gateway_ref = null` ist niemals wahr —
# ohne `not l.paid_manually` hätte diese Prüfung JEDE manuelle Markierung als
# Befund gemeldet. Für die gilt Prüfung 6 mit ihrer eigenen Belegreferenz.
pruefe "Bezahlte Links ohne payments-Beleg" \
  "select count(*) from public.reservation_charge_links l
    where l.status = 'paid' and not l.paid_manually
      and not exists (select 1 from public.payments p
                       where p.gateway_ref = l.checkout_session_id)" \
  "select l.id || ' | ' || (l.amount_cents/100.0) || ' ' || l.currency
          || ' | Session ' || coalesce(l.checkout_session_id,'-')
     from public.reservation_charge_links l
    where l.status = 'paid' and not l.paid_manually
      and not exists (select 1 from public.payments p
                       where p.gateway_ref = l.checkout_session_id)
    order by l.paid_at desc limit 20" \
  "Geld ist eingegangen, aber der Beleg fehlt — die Zahlung erscheint in keiner
  Rechnung und keiner Eigentümer-Abrechnung. verbuche_zahlung nachfahren
  (GET .../nachberechnung löst den Stripe-Abgleich aus)."

# 4. Mehr Nachberechnung bezahlt als die Buchung fordert.
pruefe "Überzahlte Buchungen durch Nachberechnung" \
  "select count(*) from (
     select p.reservation_id, sum(p.amount) as nach
       from public.payments p
      where p.type = 'surcharge' and p.status = 'succeeded'
      group by p.reservation_id) s
     join public.reservations r on r.id = s.reservation_id
    where coalesce(r.paid_amount,0) - coalesce(r.total_amount,0) >= 0.01" \
  "select r.id || ' | total ' || coalesce(r.total_amount,0) || ' | bezahlt '
          || coalesce(r.paid_amount,0) || ' | davon Nachberechnung ' || s.nach
     from (select p.reservation_id, sum(p.amount) as nach
             from public.payments p
            where p.type = 'surcharge' and p.status = 'succeeded'
            group by p.reservation_id) s
     join public.reservations r on r.id = s.reservation_id
    where coalesce(r.paid_amount,0) - coalesce(r.total_amount,0) >= 0.01
    limit 20" \
  "Der Gast hat mehr gezahlt, als die Buchung fordert. Prüfen, ob eine
  Nachberechnung doppelt verbucht wurde (Webhook UND Abgleich) und ggf.
  erstatten."

# 5. Geplante Restzahlung, die nicht zum Buchungsstand passt.
pruefe "Geplante Restzahlungen mit falschem Betrag" \
  "select count(*) from public.payments p
     join public.reservations r on r.id = p.reservation_id
    where p.type = 'balance' and p.scheduled_status = 'scheduled'
      and abs(p.amount - (coalesce(r.total_amount,0)
                          - coalesce(r.paid_amount,0))) >= 0.01" \
  "select p.id || ' | geplant ' || p.amount || ' | offen '
          || (coalesce(r.total_amount,0) - coalesce(r.paid_amount,0))
          || ' ' || coalesce(p.currency,'?') || ' | faellig ' || coalesce(p.due_at::text,'-')
     from public.payments p
     join public.reservations r on r.id = p.reservation_id
    where p.type = 'balance' and p.scheduled_status = 'scheduled'
      and abs(p.amount - (coalesce(r.total_amount,0)
                          - coalesce(r.paid_amount,0))) >= 0.01
    order by p.due_at limit 20" \
  "Der Worker-Tick zieht diesen Betrag off-session ein — zu niedrig heißt
  Fehlbetrag in der Kasse, zu hoch heißt Überbelastung des Gastes.
  payments.service.passe_restzahlung_an nachfahren (Move mit reprice) oder den
  Betrag prüfen."

# 6. Manuell als bezahlt markiert, aber ohne Beleg in payments.
pruefe "Manuelle Bezahlt-Markierungen ohne Beleg" \
  "select count(*) from public.reservation_charge_links l
    where l.status = 'paid' and l.paid_manually
      and not exists (select 1 from public.payments p
                       where p.gateway_ref = 'manuell:' || l.id::text)" \
  "select l.id || ' | ' || (l.amount_cents/100.0) || ' ' || l.currency
          || ' | ' || left(l.grund, 40)
     from public.reservation_charge_links l
    where l.status = 'paid' and l.paid_manually
      and not exists (select 1 from public.payments p
                       where p.gateway_ref = 'manuell:' || l.id::text)
    order by l.paid_at desc limit 20" \
  "Die Markierung steht, der Beleg fehlt — der Betrag taucht in keiner Rechnung
  und keiner Eigentuemer-Abrechnung auf. Markierung zuruecknehmen und neu
  setzen, damit beide Seiten wieder zusammenpassen."

# 7. Rücknahme protokolliert, aber der Beleg steht noch.
pruefe "Zurückgenommene Markierungen mit stehendem Beleg" \
  "select count(*) from public.reservation_charge_links l
    where l.unpaid_at is not null
      and exists (select 1 from public.payments p
                   where p.gateway_ref = 'manuell:' || l.id::text)" \
  "select l.id || ' | ' || (l.amount_cents/100.0) || ' ' || l.currency
          || ' | ' || coalesce(l.unpaid_reason,'-')
     from public.reservation_charge_links l
    where l.unpaid_at is not null
      and exists (select 1 from public.payments p
                   where p.gateway_ref = 'manuell:' || l.id::text)
    order by l.unpaid_at desc limit 20" \
  "Der Beleg einer zurueckgenommenen Markierung ist stehen geblieben: die
  Buchung fordert den Betrag wieder, das Zahlungsjournal weist ihn als bezahlt
  aus. Beleg entfernen (payments, gateway_ref = manuell:<id>)."

# 8. Direktpfad (Wurzel 6): kein Recht für anon/authenticated.
pruefe "Direktpfad offen (anon/authenticated auf reservation_charge_links)" \
  "select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'reservation_charge_links'
      and grantee in ('anon','authenticated')" \
  "select grantee || ' | ' || privilege_type
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'reservation_charge_links'
      and grantee in ('anon','authenticated')" \
  "Ein eingeloggter cleaner könnte per anon-Key Beträge und Zahl-URLs lesen
  oder schreiben. revoke all ... from anon, authenticated (0469)."

echo "— RLS + Policies —"
rls=$(psql_exec "select relrowsecurity from pg_class
                  where relname = 'reservation_charge_links'")
pol=$(psql_exec "select count(*) from pg_policies
                  where tablename = 'reservation_charge_links'")
if [[ "$rls" != "t" ]]; then
  echo "BEFUND: RLS ist AUS auf reservation_charge_links." >&2
  fehler=1
elif [[ "$pol" != "2" ]]; then
  echo "BEFUND: $pol Policy(s) statt 2 (permissive + restrictive)." >&2
  fehler=1
else
  echo "OK: RLS an, 2 Policies."
fi
echo

echo "— Übersicht: letzte Nachberechnungen —"
psql_exec "select coalesce(status,'?') || ' | ' || (amount_cents/100.0) || ' '
                  || currency || ' | '
                  || case when paid_manually then 'manuell' else 'stripe' end
                  || ' | ' || left(grund, 40) || ' | '
                  || created_at::date
             from public.reservation_charge_links
            order by created_at desc limit 10" || true
echo

if [[ "$fehler" != "0" ]]; then
  echo "Ergebnis: BEFUNDE vorhanden (siehe oben)." >&2
  exit 1
fi
echo "Ergebnis: sauber."
