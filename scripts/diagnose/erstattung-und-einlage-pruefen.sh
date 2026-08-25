#!/usr/bin/env bash
# ============================================================================
# erstattung-und-einlage-pruefen.sh — Erstattungen und Sicherheitseinlage (0473)
# ----------------------------------------------------------------------------
# HINTERGRUND (25.08.2026, live): Buchung 6179a5d0 (Robin McCartney,
# Booking.com, 25.–28.08.2026) wurde vom Portal storniert. Die Zusatzleistung
# „Wäschepaket" für 150,00 DKK war per Stripe-Zahlungslink bezahlt — Session
# cs_live_a1XG2v… `paid`, PaymentIntent pi_3U6YJC… `succeeded`, Geld im
# Verbundkonto. Bei UNS stand der Link auf `open`, die Position auf `pending`,
# ein payments-Beleg fehlte, und es gab keinen Weg, das Geld zurückzuzahlen.
#
# Drei Ursachen, die dieses Skript ab jetzt sichtbar hält:
#   1. `checkout.session.completed` war bei Stripe NIE abonniert, und der einzige
#      Webhook-Endpunkt ist kein Connect-Endpunkt. Jeder Zahlungseingang eines
#      Verbundkontos wurde ausschließlich vom Nachlese-Abgleich in
#      `zahlung.lesen` bemerkt — der nur läuft, wenn jemand die Buchung öffnet.
#   2. `cancel()` schloss den Nachberechnungs-Link (0469), den Addon-Link nicht.
#   3. Das Geld war längst ausgezahlt (`daily`, `available` 0 DKK). Bei
#      `controller.losses.payments = application` ist ein Minus auf dem
#      Verbundkonto UNSER Verlust — daher die Sicherheitseinlage.
#
# Geprüft wird die LIVE-DB (read-only). Was hier auftaucht, ist entweder ein
# offener Geldposten oder eine Unterdeckung — beides niemals „nur kosmetisch".
#
# Aufruf:
#   bash scripts/diagnose/erstattung-und-einlage-pruefen.sh
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

# 1. DER Live-Fall: bezahltes Geld auf einer stornierten Buchung, nicht erstattet.
#    Das ist ein OFFENER GELDPOSTEN, kein Datenfehler: Der Gast hat bezahlt, der
#    Aufenthalt findet nicht statt. Er muss erstattet werden — oder es gibt einen
#    kaufmännischen Grund, ihn zu behalten (Kulanzfrist abgelaufen, Leistung
#    schon erbracht). Beides ist eine Entscheidung, kein Zustand zum Liegenlassen.
pruefe "Bezahlt auf stornierter Buchung, nicht erstattet" \
  "select count(*) from public.addon_payment_links l
     join public.reservations r on r.id = l.reservation_id
    where r.status = 'cancelled'
      and l.status in ('paid','partially_refunded')
      and l.amount_cents > l.refunded_cents" \
  "select l.id || ' | ' || r.id || ' | ' || l.currency || ' ' ||
          ((l.amount_cents - l.refunded_cents)/100.0)::text || ' | seit ' ||
          coalesce(l.paid_at::date::text, '?')
     from public.addon_payment_links l
     join public.reservations r on r.id = l.reservation_id
    where r.status = 'cancelled'
      and l.status in ('paid','partially_refunded')
      and l.amount_cents > l.refunded_cents
    order by l.paid_at" \
  "Offener Erstattungsbetrag. Über die Buchungsansicht erstatten (Zusatzleistung → Erstatten) oder den Grund fürs Behalten dokumentieren."

# 2. Dasselbe für die Nachberechnung (0469) — die Lücke war dort identisch.
pruefe "Nachberechnung bezahlt auf stornierter Buchung" \
  "select count(*) from public.reservation_charge_links l
     join public.reservations r on r.id = l.reservation_id
    where r.status = 'cancelled'
      and l.status in ('paid','partially_refunded')
      and l.paid_manually = false
      and l.amount_cents > l.refunded_cents" \
  "select l.id || ' | ' || r.id || ' | ' || l.currency || ' ' ||
          ((l.amount_cents - l.refunded_cents)/100.0)::text || ' | ' || l.grund
     from public.reservation_charge_links l
     join public.reservations r on r.id = l.reservation_id
    where r.status = 'cancelled'
      and l.status in ('paid','partially_refunded')
      and l.paid_manually = false
      and l.amount_cents > l.refunded_cents" \
  "Offener Erstattungsbetrag der Nachberechnung."

# 3. Offener Zahlungslink auf einer stornierten Buchung. Die URL nimmt weiter
#    Geld für einen Aufenthalt an, den es nicht gibt (Wurzel 1). Seit 0473
#    schließt `cancel()` bzw. der OTA-Import ihn — im OTA-Pfad best-effort, damit
#    eine Stripe-Störung den Import nicht kippt (Überbuchungsgefahr). Genau
#    dieser Rückstand landet hier.
pruefe "Offener Zahlungslink auf stornierter Buchung" \
  "select count(*) from public.addon_payment_links l
     join public.reservations r on r.id = l.reservation_id
    where r.status = 'cancelled' and l.status = 'open'" \
  "select l.id || ' | ' || r.id || ' | ' || l.stripe_payment_link_id || ' | ' ||
          l.currency || ' ' || (l.amount_cents/100.0)::text
     from public.addon_payment_links l
     join public.reservations r on r.id = l.reservation_id
    where r.status = 'cancelled' and l.status = 'open'" \
  "Bei Stripe deaktivieren. Vorher prüfen, ob doch bezahlt wurde — dann verbuchen und erstatten, nicht schließen."

# 4. Bezahlter Link ohne payments-Beleg. Der Fingerabdruck des fehlenden
#    Connect-Webhooks: Der Geldeingang steht am Link, aber nicht im
#    Zahlungsjournal — also fehlt er in Rechnung und Eigentümer-Abrechnung.
pruefe "Bezahlter Zahlungslink ohne payments-Beleg" \
  "select count(*) from public.addon_payment_links l
    where l.status in ('paid','partially_refunded','refunded')
      and l.checkout_session_id is not null
      and not exists (
        select 1 from public.payments p where p.gateway_ref = l.checkout_session_id)" \
  "select l.id || ' | ' || l.checkout_session_id || ' | ' || l.currency || ' ' ||
          (l.amount_cents/100.0)::text
     from public.addon_payment_links l
    where l.status in ('paid','partially_refunded','refunded')
      and l.checkout_session_id is not null
      and not exists (
        select 1 from public.payments p where p.gateway_ref = l.checkout_session_id)" \
  "Beleg fehlt im Zahlungsjournal. Buchung im Dashboard öffnen (löst den Nachlese-Abgleich aus) oder den Connect-Webhook prüfen."

# 5. Erstattung ohne Elternbeleg — die Erstattung steht ohne Bezug zum Eingang.
pruefe "Erstattungsbeleg ohne Ursprungsbeleg" \
  "select count(*) from public.payments
    where type = 'refund' and parent_payment_id is null
      and gateway = 'stripe' and gateway_ref like 're_%'" \
  "select id || ' | ' || reservation_id || ' | ' || currency || ' ' || amount::text
     from public.payments
    where type = 'refund' and parent_payment_id is null
      and gateway = 'stripe' and gateway_ref like 're_%'" \
  "Der Geldeingang war bei uns nie verbucht (fehlender Webhook). Nach dem Nachverbuchen den Bezug setzen."

# 6. Erstattete Position, die NICHT storniert ist. Das darf der CHECK
#    `reservation_addons_refund_nur_storniert` gar nicht zulassen — taucht hier
#    etwas auf, ist der CHECK weg oder wurde umgangen. Die Folge wäre, dass
#    sechs Umsatzleser den erstatteten Betrag weiter als Erlös zählen.
pruefe "Erstattete Position ohne Storno (CHECK umgangen)" \
  "select count(*) from public.reservation_addons
    where refunded_at is not null and status <> 'cancelled'" \
  "select id || ' | ' || reservation_id || ' | ' || status
     from public.reservation_addons
    where refunded_at is not null and status <> 'cancelled'" \
  "CHECK reservation_addons_refund_nur_storniert prüfen — erstattete Beträge laufen sonst als Umsatz weiter."

# 7. Erstattung ohne Grund bzw. Grund ohne Erstattung (Protokoll-Lücke, wie 0397).
pruefe "Erstattung ohne Grund" \
  "select count(*) from public.reservation_addons
    where (refunded_at is null) <> (refund_reason is null)" \
  "select id || ' | ' || coalesce(refund_reason,'<leer>')
     from public.reservation_addons
    where (refunded_at is null) <> (refund_reason is null)" \
  "Ein Geldabfluss ohne Begründung ist später nicht mehr erklärbar."

# 8. Unterdeckung: Einlage höher als das, was das Konto überhaupt hergeben kann.
#    Nur als ANZEIGE, nicht als Befund — der Stripe-Saldo steht nicht in der DB.
#    Was hier steht, ist die Summe, die gedeckt sein MUSS.
echo "— Sicherheitseinlage je Betrieb (Soll-Deckung) —"
psql_exec "with e as (
    select l.tenant_id, l.currency, l.amount_cents - l.refunded_cents as offen
      from public.addon_payment_links l
      join public.reservations r on r.id = l.reservation_id
      left join public.payout_settings ps on ps.tenant_id = l.tenant_id
     where l.status in ('paid','partially_refunded')
       and l.amount_cents > l.refunded_cents
       and (r.status = 'cancelled'
            or r.check_out is null
            or r.check_out >= current_date - coalesce(ps.karenz_tage, 3))
    union all
    select l.tenant_id, l.currency, l.amount_cents - l.refunded_cents
      from public.reservation_charge_links l
      join public.reservations r on r.id = l.reservation_id
      left join public.payout_settings ps on ps.tenant_id = l.tenant_id
     where l.status in ('paid','partially_refunded')
       and l.amount_cents > l.refunded_cents
       and (r.status = 'cancelled'
            or r.check_out is null
            or r.check_out >= current_date - coalesce(ps.karenz_tage, 3))
  )
  select tenant_id || ' | ' || currency || ' ' || (sum(offen)/100.0)::text ||
         ' | ' || count(*)::text || ' Posten'
    from e group by tenant_id, currency order by 1"
echo

# 9. Einlage abgeschaltet — bewusst möglich, aber nie unbemerkt. Bei
#    `losses.payments = application` trägt die Plattform dann das Risiko.
echo "— Betriebe mit abgeschalteter Einlage —"
psql_exec "select tenant_id::text from public.payout_settings where einlage_aktiv = false"
echo

# 10. Rhythmus noch nicht übernommen: Solange `verbund_interval` NULL ist, zahlt
#     unser Lauf NICHT aus (kein geratener Rhythmus, Wurzel 4). Steht bei Stripe
#     zugleich schon `manual`, bekommt der Betrieb gar keine Auszahlung mehr —
#     das muss auffallen. Behoben wird es durch EINEN Aufruf der Abrechnungsseite.
pruefe "Verbundkonto ohne übernommenen Auszahlungs-Rhythmus" \
  "select count(*) from public.tenant_billing_profile p
     left join public.payout_settings s on s.tenant_id = p.tenant_id
    where p.stripe_account_id is not null
      and p.stripe_payouts_enabled = true
      and s.verbund_interval is null" \
  "select p.tenant_id::text || ' | ' || p.stripe_account_id
     from public.tenant_billing_profile p
     left join public.payout_settings s on s.tenant_id = p.tenant_id
    where p.stripe_account_id is not null
      and p.stripe_payouts_enabled = true
      and s.verbund_interval is null" \
  "Konto → Abrechnung einmal öffnen: der erste Aufruf übernimmt den Stripe-Rhythmus als Wunsch und stellt Stripe auf manual."

# 11. Direktpfad (Wurzel 6): Die neuen Spalten dürfen für anon/authenticated
#     nicht schreibbar sein — sonst setzt ein eingeloggter cleaner per curl
#     `refunded_cents` und nimmt einen Betrag aus der Abrechnung.
pruefe "Schreibrechte anon/authenticated auf den Erstattungstabellen" \
  "select count(*) from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('reservation_addons','addon_payment_links',
                         'reservation_charge_links','payout_settings')
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')" \
  "select table_name || ' | ' || grantee || ' | ' || privilege_type
     from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('reservation_addons','addon_payment_links',
                         'reservation_charge_links','payout_settings')
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')" \
  "revoke insert,update,delete ... from anon, authenticated (Wurzel 6)."

if [[ "$fehler" != "0" ]]; then
  echo "Mindestens ein Befund — siehe oben." >&2
  exit 1
fi
echo "Alles sauber."
