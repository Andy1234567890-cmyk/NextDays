-- 0489_whatsapp_vorlagen_felder.sql — welche Platzhalter in welcher Reihenfolge
-- in einer WhatsApp-Vorlage stehen.
--
-- WARUM ES DIESE TABELLE BRAUCHT
-- ==============================
-- myNextDays hat EIN Platzhalter-System: benannte Felder aus dem Katalog in
-- `inbox/felder.py` (`{{guest_first_name}}`, `{{property_name}}` …). Sie sind
-- die einzige Schreibweise, die ein Betrieb je zu sehen bekommt.
--
-- Meta kennt sie nicht. Die WhatsApp Cloud API akzeptiert in Vorlagen
-- ausschliesslich POSITIONELLE Platzhalter (`{{1}}`, `{{2}}` …) und liefert sie
-- genauso zurück. Beim Senden werden die Werte dann der Reihe nach eingesetzt.
--
-- Damit fehlt genau ein Stück Wissen, und Meta speichert es nirgends: WELCHES
-- Feld hinter Position 1 steht. Ohne diese Zuordnung
--   * zeigt die Oberflaeche beim Bearbeiten „{{1}}" statt „{{guest_first_name}}",
--   * und der automatische Versand kann die Werte nicht in der richtigen
--     Reihenfolge einsetzen — er wuerde den Namen des Gastes an die Stelle des
--     Objektnamens schreiben, ohne dass irgendetwas fehlschlaegt.
-- Deshalb liegt die Zuordnung hier, auf unserer Seite.
--
-- Der Schluessel ist (Betrieb, Vorlagenname, Sprache): genau so fuehrt Meta eine
-- Vorlage, und die Sprachfassungen desselben Namens koennen unterschiedlich
-- viele Felder haben.
create table if not exists public.whatsapp_template_field (
    tenant_id     uuid    not null references public.tenants(id) on delete cascade,
    template_name text    not null,
    language      text    not null,
    -- Metas Position: 1 entspricht {{1}}. Beginnt bei 1, nicht bei 0.
    position      int     not null check (position >= 1),
    -- Der Katalog-Schluessel, z. B. 'guest_first_name'. Bewusst ohne
    -- Fremdschluessel: der Katalog steht im Code, nicht in der Datenbank.
    field_key     text    not null,
    created_at    timestamptz not null default now(),
    primary key (tenant_id, template_name, language, position)
);

create index if not exists whatsapp_template_field_vorlage_idx
    on public.whatsapp_template_field (tenant_id, template_name, language);

-- =========================================================================
-- RLS + Grant-Entzug (Wurzel 6)
-- =========================================================================
-- Hier steht kein Geheimnis, aber auch nichts, was ein Client direkt braucht:
-- gelesen und geschrieben wird ausschliesslich beim Anlegen, Anzeigen und
-- Versenden einer Vorlage, und das laeuft ueber FastAPI. Ein offener
-- PostgREST-Pfad waere eine Angriffsflaeche ohne jeden Nutzen.
alter table public.whatsapp_template_field enable row level security;

drop policy if exists whatsapp_template_field_tenant on public.whatsapp_template_field;
create policy whatsapp_template_field_tenant on public.whatsapp_template_field
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke all on public.whatsapp_template_field from anon, authenticated;

drop policy if exists whatsapp_template_field_kein_direktzugriff
    on public.whatsapp_template_field;
create policy whatsapp_template_field_kein_direktzugriff
    on public.whatsapp_template_field
    as restrictive for all
    using (false)
    with check (false);

comment on table public.whatsapp_template_field is
    'Zuordnung Metas positioneller Platzhalter ({{1}}) zu den benannten Feldern '
    'des myNextDays-Katalogs. Meta speichert diese Zuordnung nicht.';
