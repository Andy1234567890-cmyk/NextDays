-- Der Überschneidungsschutz muss je EINHEIT greifen, nicht je Objekt.
--
-- `reservations_no_local_overlap` (0184) verbietet zwei überlappende lokale
-- Buchungen mit demselben `property_id`. Das war richtig, solange galt
-- „1 property = 1 buchbare Einheit". Seit 0265 hat ein Objekt n ≥ 1 Einheiten
-- (`property_units`), und 0275 wählt beim Anlegen gezielt eine freie Einheit.
--
-- Folge des alten Constraints: Ein Objekt mit zwei identischen Studios kann
-- lokal nur EINES verkaufen. Die zweite Buchung scheitert mit
-- exclusion_violation, das 0275 auf RS409 mappt — obwohl eine freie Einheit
-- existiert und die RPC sie gerade ausgewählt hat. Genau das Multi-Inventory-
-- Listing, für das 0265 gebaut wurde, war damit nicht buchbar.
--
-- Neu: `unit_id` wird Teil des Schlüssels. Zwei Buchungen desselben Objekts
-- dürfen sich überlappen, solange sie auf VERSCHIEDENEN Einheiten liegen; auf
-- DERSELBEN Einheit bleibt die Überschneidung verboten.
--
-- `unit_id` ist NOT NULL für neue Buchungen (0275 setzt sie immer), kann bei
-- Altbestand aber leer sein. `coalesce(unit_id, property_id)` hält solche
-- Zeilen im alten, strengeren Verhalten: sie kollidieren untereinander weiter
-- objektweit — lieber eine Buchung zu viel abweisen als eine Überbuchung
-- zulassen (Wurzel 5, fail-closed).

alter table public.reservations
  drop constraint if exists reservations_no_local_overlap;

alter table public.reservations
  add constraint reservations_no_local_overlap
  exclude using gist (
    property_id with =,
    coalesce(unit_id, property_id) with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (
    status <> all (array[
      'cancelled'::reservation_status,
      'declined'::reservation_status,
      'expired'::reservation_status
    ])
    and source_channex_booking_id is null
  );

comment on constraint reservations_no_local_overlap on public.reservations is
  'Keine zwei überlappenden lokalen Buchungen auf DERSELBEN Einheit (0315). '
  'Verschiedene Einheiten desselben Objekts dürfen sich überlappen — das ist '
  'der Sinn von n Einheiten je Typ. OTA-Buchungen (source_channex_booking_id) '
  'sind wie bisher ausgenommen: der Aggregator ist dort die Wahrheit.';
