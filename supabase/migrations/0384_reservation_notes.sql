-- 0384 — Buchungsnotizen als 1:n-Verlauf (Autor, Zeit, Kategorie).
--
-- WARUM eine eigene Tabelle, obwohl `reservations.note` existiert:
-- `note` ist EIN Textfeld, das jeder Schreibzugriff vollständig überschreibt.
-- Wer eine Notiz ergänzt, löscht damit die des Kollegen; wer sie später liest,
-- kann weder sagen, von wem sie stammt, noch wann sie entstand. Für einen
-- Betrieb mit Schichtwechsel (Rezeption → Reinigung → Eigentümer) ist das die
-- falsche Form: Notizen sind ein VERLAUF, kein Zustand.
--
-- `reservations.note` BLEIBT bestehen und ist weiterhin „die aktuelle Notiz"
-- (die bestehende Oberfläche und `update_note` schreiben unverändert weiter).
-- Diese Tabelle ergänzt den Verlauf daneben — kein Bruch, keine Migration von
-- Bestandsdaten, die einen erfundenen Autor bekommen müssten (Wurzel 4).
--
-- Vorbild ist `guest_notes` (0046): dieselben Spalten, aber am AUFENTHALT statt
-- an der Person. Eine Gastnotiz gilt für alle Buchungen dieses Gastes, eine
-- Buchungsnotiz nur für diesen einen Aufenthalt — das ist fachlich verschieden
-- und darf nicht in eine Tabelle fallen.

create table if not exists public.reservation_notes (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    reservation_id uuid not null references public.reservations(id) on delete cascade,
    -- Autor bleibt bei Nutzer-Löschung leer statt die Notiz mitzureißen:
    -- der Inhalt gehört dem Betrieb, nicht der Person, die ihn getippt hat.
    author_id      uuid references public.users(id) on delete set null,
    category       text,
    body           text not null,
    created_at     timestamptz not null default now()
);

-- Lesepfad ist immer „alle Notizen dieser Buchung, neueste zuerst".
create index if not exists reservation_notes_reservation_idx
    on public.reservation_notes(reservation_id, created_at desc);
create index if not exists reservation_notes_tenant_idx
    on public.reservation_notes(tenant_id);

alter table public.reservation_notes enable row level security;

-- Wurzel 6: `enable rls` + Tenant-Policy reicht NICHT. Eine Buchungsnotiz ist
-- interner Freitext des Betriebs über einen Gast (Beschwerden, Zahlungsmoral,
-- Verdachtsmomente) — sie darf den DB-Direktpfad nie erreichen. Erst das
-- pauschale Tabellen-GRANT entziehen, dann bleibt nur service_role übrig; der
-- Zugriff läuft ausschließlich über die API (reservations-Slice), die
-- PM_VIEW_NOTES prüft.
revoke select, insert, update, delete on public.reservation_notes
    from anon, authenticated;

-- Restriktive Policy als zweite Schicht: `for all`, nicht nur `for select` —
-- sonst wäre der SCHREIB-Pfad tenant-weit offen, falls je ein GRANT zurückkommt.
drop policy if exists reservation_notes_tenant_restrict on public.reservation_notes;
create policy reservation_notes_tenant_restrict on public.reservation_notes
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

comment on table public.reservation_notes is
    'Interner Notiz-VERLAUF je Buchung (Autor/Zeit/Kategorie). '
    '`reservations.note` bleibt die aktuelle Einzelnotiz. '
    'Kein Direktpfad: nur service_role, Lesen erfordert PM_VIEW_NOTES.';
