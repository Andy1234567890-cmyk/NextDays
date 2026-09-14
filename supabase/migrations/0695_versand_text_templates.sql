-- 0695_versand_text_templates.sql — Textvorlagen (Bereich »versand« der Buchhaltung)
--
-- WARUM: Der Bestand (`web/services/TextTemplateService.ts`, `web/types/
-- textTemplates.ts`) arbeitet seit dem Import aus dem alten Werkzeug mit
-- Textvorlagen — Kopf-/Fußtexte der Belege, Betreff und Nachricht der
-- Versand-Mails — gegen Routen, die es nicht gab (POST/PATCH/DELETE liefen
-- ins Leere, GET war ein Stub mit leerer Liste). Hier bekommt die Vorlage
-- erstmals eine Tabelle.
--
-- Form folgt dem Frontend-Typ `TextTemplate` (camelCase im Client, snake_case
-- hier): `category` DOCUMENT|EMAIL|LETTER, `object_type` = Belegart,
-- `text_type` HEAD|FOOT|BODY|SUBJECT. Die CHECK-Listen sind deckungsgleich mit
-- den Pydantic-Literalen in
-- apps/api/src/features/buchhaltung/bereiche/versand/schemas.py.
--
--   * `text` wird beim Speichern serverseitig mit `nh3` auf eine Tag-Allowlist
--     bereinigt (Wurzel 8) — Platzhalter wie `[%KUNDENNAME%]` oder `{kunde}`
--     überleben das, Skript-/Event-Attribute nicht.
--   * `language` ist NULL = gilt für alle Sprachen; ein Sprachcode (ISO 639-1)
--     macht die Vorlage sprachspezifisch. Kein Default „de" — die Sprache
--     eines Betriebs ist keine Konstante (27 Länder, Wurzel 4).
--   * `is_default`: höchstens EINE Standardvorlage je (tenant, category,
--     object_type, text_type, language) — partieller Unique-Index als
--     DB-Backstop, der Service nimmt der bisherigen den Stern (Wurzel 1).
--   * `is_private`: nur für den Ersteller sichtbar (Frontend „Nur für mich").
--
-- Server-only (Wurzel 6): RLS + revoke, keine Realtime-Publikation.

create table if not exists public.text_templates (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    name                text not null,
    category            text not null
                        check (category in ('DOCUMENT', 'EMAIL', 'LETTER')),
    object_type         text not null
                        check (object_type in (
                            'QUOTE', 'INVOICE', 'REMINDER', 'DELIVERY_NOTE',
                            'ORDER_CONFIRMATION', 'CREDIT_NOTE', 'CANCELLATION'
                        )),
    text_type           text not null
                        check (text_type in ('HEAD', 'FOOT', 'BODY', 'SUBJECT')),
    language            text check (language is null or language ~ '^[a-z]{2}$'),
    text                text not null,
    is_default          boolean not null default false,
    is_private          boolean not null default false,
    created_by          uuid,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists text_templates_tenant_art_idx
    on public.text_templates (tenant_id, category, object_type, text_type);

-- Genau eine Standardvorlage je Art und Sprache. `coalesce` macht NULL-Sprache
-- vergleichbar (sonst wären zwei „alle Sprachen"-Standards erlaubt).
create unique index if not exists text_templates_ein_standard_idx
    on public.text_templates (tenant_id, category, object_type, text_type, coalesce(language, ''))
    where is_default;

drop trigger if exists trg_text_templates_updated on public.text_templates;
create trigger trg_text_templates_updated
    before update on public.text_templates
    for each row execute function public.set_updated_at();

alter table public.text_templates enable row level security;

drop policy if exists text_templates_tenant on public.text_templates;
create policy text_templates_tenant on public.text_templates
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Vorlagen enthalten Geschäftstexte und private Bausteine einzelner
-- Nutzer — der Direktpfad bleibt zu, der Server filtert `is_private`.
revoke select, insert, update, delete on public.text_templates from anon, authenticated;
