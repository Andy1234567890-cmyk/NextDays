-- 0710 — Wurzel 6: der Direktpfad gab dem Eigentümer mehr als die API.
--
-- BEFUND (15.09.2026, live gemessen). Zwei Lücken, beide seit langem offen:
--
-- 1. `reservations` trug SELECT für `authenticated` auf ALLEN 64 Spalten,
--    darunter `guest_email`, `guest_phone`, `guest_address`, `total_amount`,
--    `ota_commission`. Die Policy `reservations_owner_scope` ist restriktiv,
--    begrenzt aber ZEILEN, nicht SPALTEN. Was `guest_masking.mask_for` einem
--    Eigentümer verweigert (Name, Kontakt, Beträge — er hat per Default kein
--    `pm_booking_total`), stand über `GET /rest/v1/reservations` im Klartext.
--    Die Begründung in 0337 („genau die Sicht, die die API diesen Rollen
--    ohnehin gibt") trägt für owner/staff nicht: der Objekt-Scope ersetzt die
--    Spalten-Maske nicht, er ergänzt sie.
--
-- 2. Fünfzehn Geschwistertabellen trugen SELECT für `authenticated`, aber NUR
--    eine mandantenweite Policy — kein Objekt-Scope. Ein Eigentümer mit einem
--    Haus las damit quer über ALLE Objekte des Betriebs. Am deutlichsten bei
--    `property_seasons`: der Endpunkt `/public-portal/seasons` streicht `mode`
--    und `amount` ausdrücklich („Vertriebswissen des Betriebs"), der
--    Direktpfad gab beides für jedes fremde Objekt her. Ebenso die geheimen
--    iCal-Adressen in `external_calendar` und die Gastpreise der
--    Zusatzleistungen in `reservation_addons`.
--
-- WARUM DIE SPALTEN-VARIANTE BEI `reservations` REICHT: Kein Frontend liest
-- die Tabelle direkt (geprüft: null Treffer für `from("reservations")` in
-- allen sechs Web-Oberflächen und den drei Apps). Alle 34 Realtime-Abos
-- nutzen sie als AUSLÖSER und laden danach über die API nach — keines wertet
-- `payload.new` aus. Die verbleibenden acht Spalten tragen kein
-- personenbezogenes Datum und keinen Betrag; sie reichen, damit ein Abo
-- feuert und die Policy die Zeile prüfen kann.

begin;

-- --- 1. reservations: Tabellen-GRANT weg, dann gezielt gewähren -------------
-- Reihenfolge ist Pflicht: ein `revoke select (spalte)` greift NICHT, solange
-- das pauschale Tabellen-GRANT besteht (CLAUDE.md, Wurzel 6).
revoke select on public.reservations from authenticated;
grant select (
  id, tenant_id, property_id, unit_id, status, check_in, check_out, updated_at
) on public.reservations to authenticated;

-- --- 2. Objekt-Scope für die Geschwistertabellen ----------------------------
-- Dasselbe Paar wie bei `dynamic_prices`: beide Funktionen sind komplementär
-- (jede gibt `true` für die Rollen zurück, die die andere regelt), beide sind
-- fail-closed bei unbekannter Rolle. Restriktiv und nur `for select` — der
-- Schreibpfad hängt an den bestehenden `*_write_restrict`-Policies.

-- 2a. Tabellen mit eigenem `property_id`
do $$
declare t text;
begin
  foreach t in array array[
    'property_seasons', 'property_season_assignments', 'property_units',
    'property_rooms', 'property_photos', 'property_addons', 'rate_plans',
    'external_calendar', 'dp_verlauf', 'dp_preisgrenzen', 'dp_ki_entscheidungen'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_scope', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_scope', t);
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated '
      'using (public.owner_can_see_property(property_id))',
      t || '_owner_scope', t
    );
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated '
      'using (public.staff_can_see_property(property_id))',
      t || '_staff_scope', t
    );
  end loop;
end $$;

-- 2b. Über die Buchung: reservation_addons, reservation_events
do $$
declare t text;
begin
  foreach t in array array['reservation_addons', 'reservation_events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_scope', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_scope', t);
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated '
      'using (exists (select 1 from public.reservations r '
      'where r.id = %I.reservation_id and public.owner_can_see_property(r.property_id)))',
      t || '_owner_scope', t, t
    );
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated '
      'using (exists (select 1 from public.reservations r '
      'where r.id = %I.reservation_id and public.staff_can_see_property(r.property_id)))',
      t || '_staff_scope', t, t
    );
  end loop;
end $$;

-- 2c. Über den Ratenplan
drop policy if exists rate_plan_price_overrides_owner_scope on public.rate_plan_price_overrides;
drop policy if exists rate_plan_price_overrides_staff_scope on public.rate_plan_price_overrides;
create policy rate_plan_price_overrides_owner_scope on public.rate_plan_price_overrides
  as restrictive for select to authenticated
  using (exists (select 1 from public.rate_plans rp
    where rp.id = rate_plan_price_overrides.rate_plan_id
      and public.owner_can_see_property(rp.property_id)));
create policy rate_plan_price_overrides_staff_scope on public.rate_plan_price_overrides
  as restrictive for select to authenticated
  using (exists (select 1 from public.rate_plans rp
    where rp.id = rate_plan_price_overrides.rate_plan_id
      and public.staff_can_see_property(rp.property_id)));

-- 2d. Über die Aufgabe: checklist_items -> tasks, checklist_photos -> item
drop policy if exists checklist_items_owner_scope on public.checklist_items;
drop policy if exists checklist_items_staff_scope on public.checklist_items;
create policy checklist_items_owner_scope on public.checklist_items
  as restrictive for select to authenticated
  using (exists (select 1 from public.tasks tk
    where tk.id = checklist_items.task_id
      and public.owner_can_see_property(tk.property_id)));
create policy checklist_items_staff_scope on public.checklist_items
  as restrictive for select to authenticated
  using (exists (select 1 from public.tasks tk
    where tk.id = checklist_items.task_id
      and public.staff_can_see_property(tk.property_id)));

drop policy if exists checklist_photos_owner_scope on public.checklist_photos;
drop policy if exists checklist_photos_staff_scope on public.checklist_photos;
create policy checklist_photos_owner_scope on public.checklist_photos
  as restrictive for select to authenticated
  using (exists (select 1 from public.checklist_items ci
    join public.tasks tk on tk.id = ci.task_id
    where ci.id = checklist_photos.item_id
      and public.owner_can_see_property(tk.property_id)));
create policy checklist_photos_staff_scope on public.checklist_photos
  as restrictive for select to authenticated
  using (exists (select 1 from public.checklist_items ci
    join public.tasks tk on tk.id = ci.task_id
    where ci.id = checklist_photos.item_id
      and public.staff_can_see_property(tk.property_id)));

-- --- 3. `anon` hat auf der Preisstrategie nichts zu suchen ------------------
-- `dp_verlauf`, `dp_preisgrenzen` und `dp_ki_entscheidungen` trugen SELECT für
-- `anon`. Praktisch bremste nur, dass `current_tenant_id()` ohne Anmeldung
-- leer ist — das ist eine Policy-Nebenwirkung, kein Recht. Backstop setzen.
revoke select on public.dp_verlauf, public.dp_preisgrenzen,
  public.dp_ki_entscheidungen from anon;

commit;
