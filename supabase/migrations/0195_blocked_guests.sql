-- Blockierte Personen (Airbnb „Konto → Datenschutz → Nachrichten → Blockierte
-- Personen", Hilfeartikel 4046). Ein Betrieb (Tenant) blockiert eine konkrete
-- Plattform-Gast-Identität (portal_guest). Wirkung wie bei Airbnb:
--   - der blockierte Gast kann dem Betrieb NICHT mehr schreiben (Nachrichten),
--   - er kann Objekte des Betriebs NICHT mehr buchen,
--   - AUSNAHME (2-Wochen-Trip-Fenster): bei aktiver/kommender Reservierung laufen
--     trip-bezogene Nachrichten weiter bis 2 Wochen nach Check-out; ist die
--     Reservierung storniert, greift der Block sofort (Durchsetzung im Service).
--
-- Warum portal_guest (nicht der CRM-„guest")? Nur der portal_guest ist die
-- einloggende Identität, die tatsächlich schreibt/bucht. Die Zuordnung
-- Betrieb↔portal_guest läuft fachlich über die E-Mail (portal_guests.email ↔
-- reservations.guest_email), wie im Gast-Dashboard.
--
-- Sensibel (wer wen blockiert = PII/Verhalten) → Wurzel 6: RLS + harter
-- GRANT-Entzug. Nur der Server (service_role) über den guest_blocks-Slice
-- schreibt/liest; ein Client käme per anon-Key-curl nicht an fremde Blocks.

create table if not exists public.blocked_guests (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    portal_guest_id uuid not null
        references public.portal_guests (id) on delete cascade,
    -- Wer im Betrieb den Block gesetzt hat (Audit; kann NULL werden, wenn der
    -- User gelöscht wird — der Block bleibt bestehen).
    blocked_by uuid references public.users (id) on delete set null,
    -- Optionaler Meldegrund (Airbnb erlaubt „report to Airbnb" beim Blocken).
    reason text,
    created_at timestamptz not null default now(),
    -- Ein Betrieb blockiert eine Gast-Identität höchstens EINMAL (idempotent,
    -- Wurzel 2): Doppelklick/Retry legt keine zweite Zeile an.
    constraint blocked_guests_unique unique (tenant_id, portal_guest_id)
);

create index if not exists blocked_guests_tenant_idx
    on public.blocked_guests (tenant_id);
create index if not exists blocked_guests_guest_idx
    on public.blocked_guests (portal_guest_id);

comment on table public.blocked_guests is
    'Vom Betrieb blockierte Plattform-Gäste (Airbnb „Blockierte Personen", '
    'Artikel 4046). Sperrt Nachrichten + Buchen des Gasts beim Betrieb; '
    '2-Wochen-Trip-Ausnahme im Service. Nur service_role schreibt/liest.';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug --------------------------
alter table public.blocked_guests enable row level security;

revoke all on public.blocked_guests from anon, authenticated;

-- Restriktive Guard für ALLE Operationen: streng per-Tenant. Selbst wenn je ein
-- Grant hinzukäme, sähe/änderte ein Client nur Zeilen des eigenen Tenants.
create policy blocked_guests_tenant_restrict on public.blocked_guests
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
