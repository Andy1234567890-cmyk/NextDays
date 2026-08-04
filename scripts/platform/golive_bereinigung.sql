-- golive_bereinigung.sql — Test-/Mock-Bestand vor dem Go-Live entfernen.
--
-- EINE Transaktion: entweder alles oder nichts. Vorher ein pg_dump ziehen
-- (/root/db-backups/vor-golive-bereinigung.dump) — dieses Skript ist NICHT
-- umkehrbar.
--
-- Entscheidungen des Betreibers (04.08.2026):
--   • ALLE fünf Tenants gehen weg, auch „Andy Staudinger" mit dem laufenden
--     Stripe-Abo. Das Abo muss in Stripe SEPARAT gekündigt werden — dieses
--     Skript kann das nicht (es spricht nur die DB).
--   • Channex wird NICHT mitgeräumt: die dort angelegten Properties bleiben als
--     Waisen stehen und sind im Channex-Backend manuell zu entfernen.
--   • Die Demo-Tenants (Nordlicht, Seeblick) werden danach über
--     scripts/demo/seed_demo.py neu erzeugt, nicht hier.
--
-- Reihenfolge ist bedeutungstragend: `reservations.property_id` ist ON DELETE
-- RESTRICT (die einzige nicht-kaskadierende Kante der Kette). Würde man direkt
-- die Tenants löschen, hinge das Ergebnis an der Auflösungsreihenfolge von
-- Postgres. Deshalb erst Reservierungen, dann Objekte, dann Betriebe — jeder
-- Schritt räumt über 60 bzw. 116 CASCADE-Kanten seine Kinder selbst ab.
--
-- Was BLEIBT (Stammdaten und Betreiber-Ebene, kein Mock):
--   tax_country_rules, tax_state_rules, ip_geo_ranges, property_categories,
--   property_subtypes, schema_migrations, platform_admins (Backoffice-Zugang
--   developer@mynextdays.dk) und platform_audit_log (Revisionsspur des
--   Betreibers — Historie, die man nach einem Go-Live nicht wegwirft).

begin;

-- ---------------------------------------------------------------------------
-- 1) Betriebe samt allem, was daran hängt
-- ---------------------------------------------------------------------------

create temporary table _weg_tenants on commit drop as
select id from public.tenants;

delete from public.reservations
    where tenant_id in (select id from _weg_tenants);

delete from public.properties
    where tenant_id in (select id from _weg_tenants);

delete from public.tenants
    where id in (select id from _weg_tenants);

-- ---------------------------------------------------------------------------
-- 2) Marktplatz-Gäste (eigene Auth-Welt, hängt NICHT an tenants)
-- ---------------------------------------------------------------------------
-- Alle drei vorhandenen Zeilen sind Testkonten (test@test.de,
-- diag-test-…@test.de, mobil-test+…@mynextdays.dk).

delete from public.portal_guests;

-- ---------------------------------------------------------------------------
-- 3) Auth-Identitäten
-- ---------------------------------------------------------------------------
-- Der Backoffice-Zugang MUSS bleiben: an ihm hängt public.platform_admins per
-- ON DELETE CASCADE — ihn mitzulöschen hieße, sich selbst aus dem Backoffice
-- auszusperren (Wurzel 1: der Gegenzustand zum Löschen ist „wer kommt danach
-- noch rein?").
--
-- Alles andere ist Testbestand: 63 Integrationstest-Konten (it-*@example.de)
-- plus die namentlich bekannten Hand-Testkonten.

delete from auth.users
    where email is not null
      and email <> 'developer@mynextdays.dk'
      and (
          email like 'it-%@example.de'
          or email in (
              'a.staudinger32@gmail.com',
              'test@mynextdays.de',
              'admin@mynextdays.de',
              'info@airsmil.dk',
              'andy@andy.de',
              'cert-e2e@mynextdays.de',
              'test@test.de',
              'info@the-freelancer-marketing.de'
          )
          or email like 'diag-test-%@test.de'
          or email like 'mobil-test+%@mynextdays.dk'
      );

-- ---------------------------------------------------------------------------
-- 4) Laufzeit-Spuren: Queues, Logs, Snapshots, Webhook-Journale
-- ---------------------------------------------------------------------------
-- Keine Mock-Daten, aber Spuren der Testphase. Ein Go-Live soll mit leeren
-- Queues starten: eine liegengebliebene ari_outbox-Zeile würde nach dem Start
-- einen Push für ein Objekt auslösen, das es nicht mehr gibt.

truncate table
    public.jobs,
    public.ari_outbox,
    public.ari_restriction_outbox,
    public.sync_lease,
    public.channex_debug_log,
    public.channex_webhook_event,
    public.channex_ari_shadow,
    public.stripe_webhook_event,
    public.dp_pickup_snapshots,
    public.support_diagnostics,
    public.support_debug_sessions,
    public.login_devices,
    public.otp_challenge,
    public.sandbox_message;

-- ---------------------------------------------------------------------------
-- 5) Hinterlassenschaft eines Smoke-Tests
-- ---------------------------------------------------------------------------
-- `backup_smoke_reservations_20260802` ist eine Sicherungskopie aus einem
-- Testlauf, die im produktiven Schema gelandet ist. Sie steht in keiner
-- Migration und gehört nicht ins Datenmodell.

drop table if exists public.backup_smoke_reservations_20260802;

commit;
