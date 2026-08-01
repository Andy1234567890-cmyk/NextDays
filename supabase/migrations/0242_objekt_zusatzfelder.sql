-- Benutzerdefinierte Objektfelder („Zusatzfelder").
--
-- Jeder Betrieb führt Angaben, die unser Objektmodell nicht kennt und auch nicht
-- kennen sollte: Müllabfuhrtag, Schlüsselkasten-Nummer, Kaminholz-Lieferant,
-- interne Inventarnummer, WLAN-Router-Modell. Bisher landete so etwas in der
-- Objektbeschreibung (die der Gast sieht) oder in einer Excel-Datei neben dem
-- System. Beides ist falsch.
--
-- Zwei Tabellen, bewusst getrennt:
--   property_custom_fields        DEFINITION je Betrieb (Feldname, Typ, Auswahl)
--   property_custom_field_values  WERT je Objekt
-- Sonst müsste jedes Objekt seine eigenen Feldnamen tragen und der Betrieb
-- könnte nie über alle Objekte hinweg dasselbe Feld auswerten.
--
-- KEINE Ebene „unterschiedlich pro Einheit". Die Referenz-App kennt Objekte mit
-- mehreren Einheiten darunter; unser Datenmodell ausdrücklich NICHT — eine
-- properties-Zeile IST genau eine buchbare Einheit (CLAUDE.md, unverhandelbar).
-- Eine solche Umschaltung hier wäre die Container-Ebene, die wir uns mehrfach
-- verboten haben.
--
-- Werte werden als TEXT gespeichert, auch Zahlen und Ja/Nein. Der Feldtyp steht
-- in der Definition und bestimmt Tastatur und Eingabemaske; ein numerisches
-- Feld, das der Betrieb später auf Text umstellt, verliert so keine Werte.
--
-- `is_public` markiert Felder, die im Gastportal sichtbar sind. Die Spalte wird
-- hier nur GEFÜHRT — sie schaltet nichts frei. Wer sie auswertet, muss die
-- Sichtbarkeit an seiner eigenen Stelle durchsetzen; ein Flag ist keine
-- Berechtigung (Wurzel 6).

create table if not exists public.property_custom_fields (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    -- Stabiler Schlüssel für Automationen/Export. Änderbar ist das LABEL, nicht
    -- der Schlüssel — sonst brechen Verweise still weg.
    field_key text not null,
    label text not null,
    field_type text not null default 'text',
    -- Auswahlmöglichkeiten für field_type='select'. Bei allen anderen Typen leer.
    options jsonb not null default '[]'::jsonb,
    is_public boolean not null default false,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint property_custom_fields_key_unique unique (tenant_id, field_key),
    constraint property_custom_fields_type_check check (
        field_type in ('text', 'textarea', 'number', 'select', 'checkbox')
    ),
    -- Ein Auswahlfeld ohne Auswahl ist eine Attrappe: der Nutzer öffnet es und
    -- kann nichts wählen. Fail-closed schon beim Anlegen (Wurzel 5).
    constraint property_custom_fields_select_hat_optionen check (
        field_type <> 'select' or jsonb_array_length(options) > 0
    )
);

create table if not exists public.property_custom_field_values (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    field_id uuid not null
        references public.property_custom_fields (id) on delete cascade,
    -- Alle Typen als Text (siehe Kopf). NULL = nie gesetzt, '' = bewusst geleert.
    value text,
    updated_at timestamptz not null default now(),
    -- Ein Objekt hat je Feld GENAU EINEN Wert (Wurzel 2: Doppelklick/Retry auf
    -- „Speichern" legt keine zweite Zeile an, sondern überschreibt).
    constraint property_custom_field_values_unique unique (property_id, field_id)
);

create index if not exists property_custom_fields_tenant_idx
    on public.property_custom_fields (tenant_id, sort_order);
create index if not exists property_custom_field_values_property_idx
    on public.property_custom_field_values (property_id);
create index if not exists property_custom_field_values_field_idx
    on public.property_custom_field_values (field_id);

comment on table public.property_custom_fields is
    'Betriebs-eigene Zusatzfelder für Objekte (Definition). Werte stehen in '
    'property_custom_field_values. Kein „pro Einheit" — eine properties-Zeile '
    'ist genau eine buchbare Einheit.';
comment on table public.property_custom_field_values is
    'Werte der Zusatzfelder je Objekt. Alle Typen als Text; der Typ steht in '
    'der Definition.';
comment on column public.property_custom_fields.is_public is
    'Nur ein Merkmal, KEINE Freischaltung: wer das Feld im Gastportal zeigt, '
    'muss die Sichtbarkeit an seiner Stelle selbst durchsetzen (Wurzel 6).';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug --------------------------
-- Zusatzfelder tragen im Alltag Betriebsinterna (Schlüsselkästen, Codes,
-- Dienstleister). Deshalb schreibt und liest AUSSCHLIESSLICH der Server über
-- den Slice; ein Client käme per anon-Key-curl nicht heran. Die restriktive
-- Policy gilt `for all` — nicht nur `for select` —, sonst stünde der
-- Schreibpfad tenant-weit offen, falls je ein Grant hinzukäme.
alter table public.property_custom_fields enable row level security;
alter table public.property_custom_field_values enable row level security;

revoke all on public.property_custom_fields from anon, authenticated;
revoke all on public.property_custom_field_values from anon, authenticated;

create policy property_custom_fields_tenant_restrict on public.property_custom_fields
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy property_custom_field_values_tenant_restrict
    on public.property_custom_field_values
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
