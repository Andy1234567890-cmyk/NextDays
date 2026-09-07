-- 0570 — Kopf- und Fußzeile als EBENEN im Baukasten (Framer-Parität, 05.09.2026)
--
-- Framer zeigt Kopf- und Fußzeile im Layers-Panel als aufklappbare Ebenen mit
-- Kindern (Logo, Navigation, Buchen-Knopf …): je Kind Auge je Breakpoint,
-- Schloss, Reihenfolge per Ziehen. Unser Baum führte beide bisher als tote
-- Zeilen „aus dem Theme" ohne Kinder.
--
-- WAS HIER ENTSTEHT
-- Zwei jsonb-Spalten am Branding — site-weit, weil Kopf- und Fußzeile es sind:
--   header_teile  { hidden_on, locked, reihenfolge[], teile{ <teil>{hidden_on, locked} } }
--   footer_teile  dieselbe Form
-- Die Teilnamen sind ein geschlossener Satz (Pydantic `schemas_regionen.py`,
-- Paket `packages/baukasten-stil/src/regionen.ts`): jeder Name ist eine Stelle
-- im Renderer. Kein Block, keine Migration bestehender Kopfzeilen — der Inhalt
-- bleibt Theme-Code, einstellbar wird nur, was der Baum zeigt.
--
-- WURZEL 1 — der Gegenzustand
-- `'{}'` heißt „nichts eingestellt": alles sichtbar, Standardreihenfolge. Das
-- ist exakt der Zustand jeder bestehenden Site; nach dem Deploy sieht keine
-- anders aus.
--
-- WURZEL 6/8 — der DB-Direktpfad
-- Der Check erzwingt die Objektform; die Feld-Prüfung (erlaubte Teilnamen,
-- Geräte) sitzt in Pydantic UND beim Lesen im Paket — was per service_role
-- an der API vorbei hineinkommt, verwirft der Renderer beim Lesen, statt eine
-- Klasse zu bauen, die es nicht gibt. RLS/Grants der Tabelle bleiben wie in
-- 0086/0426 (Schreiben nur über die API).

alter table public.tenant_site_config
    add column if not exists header_teile jsonb not null default '{}'::jsonb,
    add column if not exists footer_teile jsonb not null default '{}'::jsonb;

alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_teile_form;
alter table public.tenant_site_config
    add constraint tenant_site_config_teile_form check (
        jsonb_typeof(header_teile) = 'object'
        and jsonb_typeof(footer_teile) = 'object'
    );

comment on column public.tenant_site_config.header_teile is
    '0570: Kopfzeile als Ebene — hidden_on/locked der Region, reihenfolge[] und teile{logo,slogan,navigation,sprachwaehler,buchen}{hidden_on,locked}. {} = Standard.';
comment on column public.tenant_site_config.footer_teile is
    '0570: Fußzeile als Ebene — wie header_teile mit teile{navigation,social,bildnachweise,copyright}. {} = Standard.';
