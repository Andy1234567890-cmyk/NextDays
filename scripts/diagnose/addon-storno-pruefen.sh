#!/usr/bin/env bash
# ============================================================================
# addon-storno-pruefen.sh — prüft Storno/Rücknahme von Zusatzleistungen
# ----------------------------------------------------------------------------
# Hintergrund (14.08.2026): Bei einer Booking-Buchung wurde „Wäschepaket,
# 600 DKK" versehentlich auf „Bezahlt" gesetzt. Danach gab es keinen Weg
# zurück — Storno und Mengenänderung lehnten eine bezahlte Position beide mit
# 409 ab und verwiesen auf eine Rückabwicklung, für die keine Route existierte.
# Migration 0397 ergänzt Grund/Urheber/Zeitpunkt, der Slice bekommt
# „Bezahlt-Markierung zurücknehmen" und ein Storno MIT Pflicht-Grund.
#
# Das Skript prüft die LIVE-DB (read-only) auf die Zustände, die nach dieser
# Änderung nicht mehr vorkommen dürfen:
#   1. Stornierte/zurückgenommene Zeilen OHNE Grund → Protokoll-Lücke.
#      (Bestandszeilen von VOR 0397 sind davon ausgenommen: sie haben
#      cancelled_at = NULL, weil sie den Zeitstempel nie bekamen.)
#   2. Stornierte Positionen, die noch auf einem OFFENEN Zahlungslink hängen
#      → die Stripe-URL nimmt Geld für eine stornierte Leistung an (Wurzel 1).
#      Genau das fängt der Betragsabgleich in verbuche_zahlung NICHT: die
#      Summe des Links stimmt weiter, während das Positions-Update die
#      stornierte Zeile per .eq(status,'pending') überspringt.
#   3. Widersprüchliche Zeilen: status='paid', aber ein Storno-Grund gesetzt.
#   4. Der Direktpfad (Wurzel 6): anon/authenticated dürfen auf
#      reservation_addons kein INSERT/UPDATE/DELETE haben — sonst könnte ein
#      eingeloggter cleaner per curl den Grund fälschen oder den Status
#      direkt auf 'cancelled' setzen.
#
# Zusätzlich als Übersicht (nur Anzeige): die letzten Stornos mit Grund.
#
# Aufruf:
#   bash scripts/diagnose/addon-storno-pruefen.sh
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

# 1. Storno ohne Grund (nur Zeilen AB 0397 — Bestand hat kein cancelled_at).
pruefe "Stornos ohne Grund (ab 0397)" \
  "select count(*) from public.reservation_addons
    where cancelled_at is not null
      and (cancel_reason is null or btrim(cancel_reason) = '')" \
  "select id || ' | ' || coalesce(name->>'de','?') || ' | ' || status
     from public.reservation_addons
    where cancelled_at is not null
      and (cancel_reason is null or btrim(cancel_reason) = '')
    order by cancelled_at desc limit 20" \
  "Der Grund ist Pflicht (Service prüft, CHECK sichert ab). Eine solche Zeile
  kann nur über den DB-Direktpfad entstanden sein — Herkunft klären."

# 2. Stornierte Position auf einem OFFENEN Zahlungslink.
pruefe "Stornierte Positionen auf offenem Zahlungslink" \
  "select count(*) from public.reservation_addons ra
     join public.addon_payment_link_items i on i.reservation_addon_id = ra.id
     join public.addon_payment_links l on l.id = i.link_id
    where ra.status = 'cancelled' and l.status = 'open'" \
  "select ra.id || ' | ' || coalesce(ra.name->>'de','?') || ' | Link ' || l.id
          || ' | ' || (l.amount_cents/100.0) || ' ' || l.currency
     from public.reservation_addons ra
     join public.addon_payment_link_items i on i.reservation_addon_id = ra.id
     join public.addon_payment_links l on l.id = i.link_id
    where ra.status = 'cancelled' and l.status = 'open'
    order by l.created_at desc limit 20" \
  "Die Stripe-URL nimmt weiter Geld für eine stornierte Leistung an. Der Link
  MUSS beim Storno geschlossen werden (zahlung.ziehe_link_zurueck_bei_storno).
  Betroffene Links sofort zurückziehen."

# 3. Widerspruch: bezahlt, aber mit Storno-Grund.
pruefe "Widersprüchliche Zeilen (paid + Storno-Grund)" \
  "select count(*) from public.reservation_addons
    where status = 'paid' and cancel_reason is not null" \
  "select id || ' | ' || coalesce(name->>'de','?') || ' | ' || cancel_reason
     from public.reservation_addons
    where status = 'paid' and cancel_reason is not null
    order by cancelled_at desc nulls last limit 20" \
  "Entweder wurde ein Storno überschrieben (mark_paid lässt das nicht mehr zu)
  oder direkt in die DB geschrieben. Beleg widerspricht sich selbst."

# 4. Stornierte Position, die noch auf einem Rechnungs-ENTWURF steht.
#    Der Entwurf wird beim Storno neu aufgebaut; scheitert das (z. B. fehlendes
#    Firmenprofil), gilt das Storno trotzdem und der Rückstand wird nur geloggt
#    — genau der Fall, den diese Abfrage sichtbar macht. Sonst bekäme die
#    stornierte Position beim Check-out eine GoBD-Nummer.
pruefe "Stornierte Positionen auf einem Rechnungsentwurf" \
  "select count(*) from public.reservation_addons ra
     join public.invoices i on i.reservation_id = ra.reservation_id
                           and i.tenant_id = ra.tenant_id
     join public.invoice_line_items li on li.invoice_id = i.id
    where ra.status = 'cancelled'
      and i.invoice_type = 'invoice' and i.invoice_number is null
      and i.status <> 'cancelled' and i.deleted_at is null
      and li.description = coalesce(ra.name->>'de', ra.name->>'en')" \
  "select i.id || ' | Entwurf | ' || li.description || ' | ' || li.gross_amount
     from public.reservation_addons ra
     join public.invoices i on i.reservation_id = ra.reservation_id
                           and i.tenant_id = ra.tenant_id
     join public.invoice_line_items li on li.invoice_id = i.id
    where ra.status = 'cancelled'
      and i.invoice_type = 'invoice' and i.invoice_number is null
      and i.status <> 'cancelled' and i.deleted_at is null
      and li.description = coalesce(ra.name->>'de', ra.name->>'en')
    limit 20" \
  "Der Entwurfs-Neuaufbau ist ausgefallen (Log:
  addon_storno_rechnungsentwurf_nicht_aktualisiert). Ursache beheben und eine
  beliebige Änderung an der Buchung auslösen — der Entwurf baut sich dann neu."

# 5. Direktpfad (Wurzel 6).
pruefe "Schreibrechte für anon/authenticated (müssen leer sein)" \
  "select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'reservation_addons'
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')" \
  "select grantee || ': ' || privilege_type
     from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'reservation_addons'
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE')" \
  "Mit dem öffentlichen anon-Key könnte ein eingeloggter Nutzer per
  'curl /rest/v1/reservation_addons' den Grund fälschen oder den Status direkt
  auf 'cancelled' setzen. revoke nachziehen (0224/0337/0397)."

echo "— Zur Einordnung: letzte Stornos/Rücknahmen mit Grund (nur Anzeige) —"
psql_exec "select ra.cancelled_at || ' | ' || ra.status || ' | '
                  || coalesce(ra.name->>'de','?') || ' | ' || ra.total
                  || ' | ' || ra.cancel_reason
             from public.reservation_addons ra
            where ra.cancelled_at is not null
            order by ra.cancelled_at desc limit 10" || true

exit "$fehler"
