-- Preisänderung je Portal: Kanal-Pläne mit portal_scope.
--
-- Lodgify-Verhalten: jede Portal-Verbindung eines Objekts kann einen eigenen
-- prozentualen Aufschlag tragen (Booking +15 %, Airbnb +18 %, …). Umgesetzt
-- über den VORHANDENEN Mechanismus der abgeleiteten Rate-Pläne: je Portal
-- entsteht ein automatisch gepflegter Plan (derived vom Standard,
-- offset_percent = Aufschlag), der NUR an diesem Portal gemappt wird —
-- `portal_scope` trägt den Portal-Code. NULL = normaler Plan (alle Kanäle).
--
-- Der bisherige „Aufschlag (Mark-up)"-Block (property_pricing_config.markup)
-- war eine Attrappe: die Quote läuft mit channel='direct', die Keys waren
-- airbnb/booking/google — der Wert wirkte NIRGENDS, weder auf die eigene
-- Strecke noch auf den Channex-Push. Die Spalte fällt; UI und Resolver-Leser
-- werden im selben Stand entfernt (row.get('markup') alter Stände toleriert
-- die fehlende Spalte).

alter table public.rate_plans
    add column if not exists portal_scope text;

comment on column public.rate_plans.portal_scope is
    'Portal-Code (BookingCom, AirBNB, …): dieser Plan ist der automatisch '
    'gepflegte Kanal-Plan GENAU DIESES Portals (Preisänderung je Portal) und '
    'wird nur dort gemappt. NULL = normaler Plan für alle Kanäle.';

-- Höchstens EIN Kanal-Plan je Objekt und Portal.
create unique index if not exists rate_plans_portal_scope_uidx
    on public.rate_plans (property_id, portal_scope)
    where portal_scope is not null;

-- Attrappen-Spalte entfernen (nie ausgewertet, s. o.).
alter table public.property_pricing_config
    drop column if exists markup;
