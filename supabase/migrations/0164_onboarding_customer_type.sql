-- 0164_onboarding_customer_type.sql
-- Zwei-Wege-Onboarding: Neukunde vs. Wechselkunde (Switcher).
-- Ein Wechselkunde hat bereits Objekte auf Booking.com/Airbnb & Co. — die werden
-- über Channex IMPORTIERT (Kanal verbinden → 1:1-Mapping → Buchungs-/ARI-Pull),
-- nicht neu getippt. Der Neukunde legt Objekte neu an.
--
-- customer_type steuert den Zweig; imported_from_ota markiert, dass mindestens
-- ein Bestands-Listing importiert wurde (Fortschritt des Import-Schritts, nicht
-- nur die Absicht wie has_ota/selected_portals). NULL customer_type = noch nicht
-- gewählt (Weiche noch offen).
alter table public.tenant_onboarding
    add column if not exists customer_type text
        check (customer_type in ('new', 'switch'));

alter table public.tenant_onboarding
    add column if not exists imported_from_ota boolean not null default false;
