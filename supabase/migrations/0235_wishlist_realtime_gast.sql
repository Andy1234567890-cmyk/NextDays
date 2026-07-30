-- Merkliste des Gastes live: SELECT-Grant + Realtime-Publikation (Wurzel 6).
--
-- BEFUND (live geprüft): wishlists und wishlist_items haben je eine passende
-- RLS-Policy für den eingeloggten Gast —
--     wishlists_self      :: portal_guest_id = auth.uid()
--     wishlist_items_self :: über die eigene Wishlist
-- — aber `authenticated` hatte KEIN SELECT-Grant, und beide Tabellen fehlten in
-- der Publikation `supabase_realtime`. Ein Realtime-Abo der App wäre damit eine
-- stumme Attrappe gewesen: sichtbar „live", faktisch nie ein Event.
--
-- Sicher, weil der Scope am Gast selbst hängt: auth.uid() ist der JWT-`sub`, und
-- portal_guests.id IST die auth.users.id (live gegengeprüft: 3/3). Ein Gast
-- erreicht damit ausschliesslich seine eigenen Merklisten — nicht die eines
-- anderen Gastes und keine Betriebsdaten. anon bleibt aussen vor.
--
-- BEWUSST NICHT ENTHALTEN: reservations für Gäste. Die Policies dort sind
-- tenant-/owner-/staff-basiert, ein Gast bekommt also keine Events auf seine
-- eigene Buchung. Das bleibt so: eine portal_guest-Policy auf reservations
-- würde dem Gast die ROHZEILE über den DB-Direktpfad öffnen (Beträge, interne
-- Felder), während der API-Pfad bewusst maskiert — genau der Rückschritt, den
-- Wurzel 6 beschreibt. Die Reise-Ansichten aktualisieren daher über den
-- gescopten API-Pfad, nicht per Abo.

grant select on public.wishlists to authenticated;
grant select on public.wishlist_items to authenticated;

-- Schreiben bleibt serverseitig (guest_wishlist-Slice, service_role): der Client
-- soll Merklisten nicht an der Validierung vorbei anlegen/ändern.
revoke insert, update, delete on public.wishlists from anon, authenticated;
revoke insert, update, delete on public.wishlist_items from anon, authenticated;

-- `add table` ist nicht idempotent → vorher prüfen.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = 'wishlists'
    ) then
        alter publication supabase_realtime add table public.wishlists;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = 'wishlist_items'
    ) then
        alter publication supabase_realtime add table public.wishlist_items;
    end if;
end
$$;

comment on table public.wishlists is
    'Merklisten eines portal_guest. LESEN direkt erlaubt (RLS: nur eigene, '
    'wishlists_self) für Realtime; SCHREIBEN ausschliesslich serverseitig über '
    'den guest_wishlist-Slice. In supabase_realtime publiziert (0235).';
