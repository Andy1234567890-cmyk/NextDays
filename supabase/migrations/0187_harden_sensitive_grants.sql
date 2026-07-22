-- =========================================================================
-- 0187 — Wurzel 6: harter GRANT-Entzug + restriktive Guards auf sensible
--        Tabellen (Finanzen, users-Rollen/PII, Webhook-Secrets).
-- =========================================================================
-- Belegter Anlass (Live-Redteam-Scan gegen die Server-DB, Juli 2026): anon &
-- authenticated hatten pauschale Table-Grants (SELECT+INSERT+UPDATE+DELETE) auf
-- Finanz-Tabellen und users. RLS war der EINZIGE Backstop — und laut Wurzel 6
-- reicht `enable rls` + tenant-PERMISSIVE-Policy für Finanzdaten NICHT: ein
-- eingeloggter cleaner spricht mit anon-Key + JWT PostgREST direkt an
-- (`curl /rest/v1/<tabelle>`) und umgeht den FastAPI-Layer komplett.
-- Reale CVE-Klasse: CVE-2025-48757 (170 Apps dumpten User/Payments/Keys so).
--
-- Vorbild ist die bereits korrekte payments/platform_fees-Härtung (0172/0182):
--   (a) revoke select,insert,update,delete FROM anon, authenticated
--   (b) RESTRICTIVE `for all`-Tenant-Guard (nicht nur SELECT) — sonst ist der
--       SCHREIB-Pfad tenant-weit offen.
-- service_role behält alle Grants (Backend liest/schreibt über service_role,
-- umgeht RLS) → das Backend bricht NICHT. Kein Frontend liest diese Tabellen
-- direkt (verifiziert), keine Realtime-Abos darauf.
--
-- Alt/Neu-Gegenzustand (Wurzel 1): rein additive Härtung, keine Daten berührt.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) FINANZ-TABELLEN — voller Entzug + RESTRICTIVE for-all-Guard.
-- -------------------------------------------------------------------------
-- commissions (OTA-1 %-Provision)
revoke select, insert, update, delete on public.commissions from anon, authenticated;
drop policy if exists commissions_tenant_restrict on public.commissions;
create policy commissions_tenant_restrict on public.commissions
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- commission_ledger (hatte nur SELECT-Policy → Schreibpfad war offen)
revoke select, insert, update, delete on public.commission_ledger from anon, authenticated;
drop policy if exists commission_ledger_tenant_restrict on public.commission_ledger;
create policy commission_ledger_tenant_restrict on public.commission_ledger
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- invoices
revoke select, insert, update, delete on public.invoices from anon, authenticated;
drop policy if exists invoices_tenant_restrict on public.invoices;
create policy invoices_tenant_restrict on public.invoices
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- invoice_line_items (Scope über die Eltern-Rechnung)
revoke select, insert, update, delete on public.invoice_line_items from anon, authenticated;
drop policy if exists invoice_line_items_tenant_restrict on public.invoice_line_items;
create policy invoice_line_items_tenant_restrict on public.invoice_line_items
    as restrictive for all
    using (exists (
        select 1 from public.invoices i
        where i.id = invoice_line_items.invoice_id
          and i.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.invoices i
        where i.id = invoice_line_items.invoice_id
          and i.tenant_id = public.current_tenant_id()));

-- owner_statements (Eigentümer-Abrechnung)
revoke select, insert, update, delete on public.owner_statements from anon, authenticated;
drop policy if exists owner_statements_tenant_restrict on public.owner_statements;
create policy owner_statements_tenant_restrict on public.owner_statements
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- channex_tax_map (Steuer-Mapping — hatte owner/staff-SELECT-Scope, aber keinen
-- RESTRICTIVE-Write-Guard und volle Grants → beides schließen)
revoke select, insert, update, delete on public.channex_tax_map from anon, authenticated;
drop policy if exists channex_tax_map_tenant_restrict on public.channex_tax_map;
create policy channex_tax_map_tenant_restrict on public.channex_tax_map
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- stripe_webhook_event (Webhook-Idempotenz/Payloads — reine Server-Daten)
revoke select, insert, update, delete on public.stripe_webhook_event from anon, authenticated;

-- -------------------------------------------------------------------------
-- 2) users — Priv-Esc- & Recon-Schutz (Wurzel 6 + 9).
-- -------------------------------------------------------------------------
-- Schreiben (role/permissions/email) darf NUR der Server (service_role) — sonst
-- könnte ein cleaner per `curl` PATCH die eigene role auf admin heben.
revoke insert, update, delete on public.users from anon, authenticated;

-- Lesen auf die EIGENE Zeile beschränken (auth.uid() = users.id, verifiziert):
-- ein cleaner darf nicht die ganze Tenant-User-Liste mit E-Mails/Rollen/
-- permissions abziehen (Recon für Priv-Esc). Rollen-/Capability-Gating kommt
-- ohnehin aus GET /auth/me (Backend), nicht aus einem Direkt-SELECT.
-- Das GRANT bleibt bewusst bestehen (kein Direkt-Frontend-Read, aber falls je
-- benötigt), die RESTRICTIVE-Policy sperrt fremde Zeilen hart zu.
drop policy if exists users_self_read_restrict on public.users;
create policy users_self_read_restrict on public.users
    as restrictive for select
    using (id = (select auth.uid()));

-- -------------------------------------------------------------------------
-- 3) Default-Backstop: NEUE public-Tabellen bekommen künftig KEINE
--    automatischen anon/authenticated-Grants mehr (Supabase-Default).
--    Macht "sicher per Default" statt "sicher, wenn dran gedacht" (Wurzel 6).
-- -------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

comment on policy commissions_tenant_restrict on public.commissions is
  'Wurzel 6: RESTRICTIVE for-all-Guard + GRANT-Entzug — anon/authenticated '
  'kein Direktzugriff auf Provisionen. Nur service_role (Backend).';
comment on policy users_self_read_restrict on public.users is
  'Wurzel 6/9: eingeloggter Nutzer liest per anon-Key nur die EIGENE Zeile — '
  'keine Tenant-weite User-/Rollen-/E-Mail-Liste (Recon-Schutz). Schreiben '
  'entzogen (Priv-Esc-Schutz). Backend nutzt service_role.';
