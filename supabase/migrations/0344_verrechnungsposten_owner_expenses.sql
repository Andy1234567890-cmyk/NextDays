-- 0344_verrechnungsposten_owner_expenses.sql — Verrechnungsposten in der
-- Eigentümer-Abrechnung: Beträge in BEIDE Richtungen, voll verrechnet.
--
-- AUSGANGSLAGE (belegt, 09.08.2026 gegen die Live-DB):
--   * public.owner_expenses (0064) trug den Betrag als VORZEICHEN in einer
--     einzigen Spalte `amount` („negativ = Ausgabe, positiv = Extra/Gutschrift").
--     Die Richtung hing damit an einem Minuszeichen, das man beim Eintippen
--     vergisst — die UI stellte den Betrag sogar auf "-0" vor.
--   * Live liegen 0 Zeilen in owner_expenses UND 0 Zeilen in owner_statements
--     (auch keine finalisierten). Es gibt also KEINEN Bestand, dessen Rechnung
--     sich durch die neue Semantik verschieben könnte.
--
-- WARUM ERWEITERN STATT NEUE TABELLE: „Schadenskompensation an den Eigentümer"
-- und „Glühbirnen vom Eigentümer verrechnen" sind dasselbe fachliche Konzept
-- wie die vorhandene Expense-Zeile — ein Posten, der die Auszahlung um einen
-- festen Betrag verschiebt. Eine zweite Tabelle wäre eine zweite Wahrheit:
-- Statement-Zuordnung, Auto-Assign, Summenbildung, PDF und der Wurzel-6-Riegel
-- existierten dann doppelt und liefen auseinander.
--
-- WAS DIESE MIGRATION ÄNDERT
--   1. `direction` — die Richtung wird EXPLIZIT erfasst, nicht aus dem
--      Vorzeichen erraten: 'to_owner' (zugunsten, erhöht die Auszahlung) |
--      'from_owner' (zulasten, mindert sie).
--   2. `amount` muss ab jetzt > 0 sein. Vorzeichen und Richtung sind damit
--      nicht mehr zwei konkurrierende Wahrheiten.
--   3. `currency` — die Währung des Postens kommt aus den Daten und steht an
--      der Zeile (Wurzel 4). Es gibt DKK- und EUR-Objekte; ohne eigene Spalte
--      würde ein DKK-Posten stillschweigend als EUR in eine EUR-Abrechnung
--      addiert.
--   4. `created_by` / `created_by_name` — Nachvollziehbarkeit: wer hat den
--      Posten angelegt. `created_at` gab es schon.
--   5. `storage_path` — der Beleg liegt im neuen PRIVATEN Bucket
--      owner-expense-receipts; `attachment_url` (0064) war nur ein Textfeld
--      ohne Upload-Weg.
--   6. hidden_from_owner ist für einen Posten ZULASTEN des Eigentümers
--      verboten (Check-Constraint). Ein Abzug, den der Eigentümer nicht sieht,
--      macht seine Abrechnung unprüfbar.
--
-- WURZEL 6: owner_expenses ist eine Finanztabelle und bereits dicht (0224 +
-- 0337: revoke select/insert/update/delete für anon+authenticated, restriktive
-- Tenant-Policy). Neue SPALTEN erben das Tabellen-GRANT, es entsteht also kein
-- neues Loch — die Riegel werden am Ende trotzdem idempotent nachgezogen,
-- damit die Absicherung an der Tabelle selbst dokumentiert bleibt und ein
-- späteres `grant` sie nicht unbemerkt aufweicht.

-- ---------------------------------------------------------------------------
-- 1. Richtung
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'owner_expense_direction') then
    create type public.owner_expense_direction as enum ('to_owner', 'from_owner');
  end if;
end $$;

alter table public.owner_expenses
    add column if not exists direction public.owner_expense_direction;

-- Bestandszeilen: es gibt live keine (0 Zeilen, s. o.). Sollte auf einer
-- anderen Umgebung doch eine liegen, wird sie nach der ALTEN Vorzeichen-
-- Semantik übersetzt (negativ = Ausgabe = zulasten) — nicht geraten, sondern
-- exakt die Regel aus dem Kommentar in 0064.
update public.owner_expenses
   set direction = case when amount < 0 then 'from_owner'::public.owner_expense_direction
                        else 'to_owner'::public.owner_expense_direction end
 where direction is null;

-- Betrag ab jetzt vorzeichenlos: die Richtung steht in `direction`.
update public.owner_expenses set amount = abs(amount) where amount < 0;

alter table public.owner_expenses
    alter column direction set not null,
    alter column direction set default 'from_owner';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'owner_expenses_amount_positiv'
  ) then
    alter table public.owner_expenses
      add constraint owner_expenses_amount_positiv check (amount > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Währung — aus den Daten, nie geraten (Wurzel 4)
-- ---------------------------------------------------------------------------
alter table public.owner_expenses
    add column if not exists currency text;

-- Bestandszeilen (live 0): Währung des zugeordneten Objekts, sonst des Tenants.
-- KEIN 'EUR'-Fallback — bleibt die Spalte leer, ist das ein sichtbarer
-- Datenfehler, den der Service als 422 meldet, statt still falsch zu rechnen.
update public.owner_expenses e
   set currency = coalesce(
        (select p.currency from public.properties p where p.id = e.listing_id),
        (select t.currency from public.tenants t where t.id = e.tenant_id))
 where e.currency is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'owner_expenses_currency_format'
  ) then
    alter table public.owner_expenses
      add constraint owner_expenses_currency_format
      check (currency is null or currency ~ '^[A-Z]{3}$');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Nachvollziehbarkeit: wer hat den Posten angelegt
-- ---------------------------------------------------------------------------
-- `created_by` referenziert absichtlich NICHT hart auf public.users mit
-- `on delete cascade`: ein gelöschter Mitarbeiter darf einen Beleg nicht
-- mitnehmen. `set null` behält die Zeile, `created_by_name` behält den Namen
-- als Snapshot zum Zeitpunkt der Erfassung.
alter table public.owner_expenses
    add column if not exists created_by uuid
        references public.users (id) on delete set null,
    add column if not exists created_by_name text;

-- ---------------------------------------------------------------------------
-- 4. Beleg im privaten Bucket
-- ---------------------------------------------------------------------------
alter table public.owner_expenses
    add column if not exists storage_path text,
    add column if not exists file_name text;

-- PRIVATER Bucket (Muster agency-contracts/task-photos): Zugriff ausschließlich
-- über das Backend per signierter URL. Ohne storage.objects-Policy ist er für
-- anon/authenticated fail-closed dicht.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'owner-expense-receipts',
    'owner-expense-receipts',
    false,
    10485760,  -- 10 MB
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 5. Ein Abzug MUSS für den Eigentümer sichtbar sein
-- ---------------------------------------------------------------------------
-- hidden_from_owner blendet eine Zeile in der Eigentümer-Sicht aus (0064). Für
-- einen Posten ZULASTEN des Eigentümers ist das unzulässig: er sähe eine
-- geminderte Auszahlung ohne die Zeile, die sie mindert — die Abrechnung wäre
-- nicht nachvollziehbar. Für einen Posten ZUGUNSTEN bleibt es erlaubt (eine
-- interne Gutschrift darf zurückgehalten werden, sie schadet ihm nicht).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'owner_expenses_abzug_sichtbar'
  ) then
    alter table public.owner_expenses
      add constraint owner_expenses_abzug_sichtbar
      check (direction <> 'from_owner' or hidden_from_owner = false);
  end if;
end $$;

update public.owner_expenses
   set hidden_from_owner = false
 where direction = 'from_owner' and hidden_from_owner;

create index if not exists owner_expenses_direction_idx
    on public.owner_expenses (tenant_id, direction);

comment on column public.owner_expenses.direction is
    'Richtung des Verrechnungspostens: to_owner = zugunsten des Eigentuemers '
    '(erhoeht seine Auszahlung, z. B. Schadenskompensation), from_owner = '
    'zulasten (mindert sie, z. B. Material/Arbeitszeit des Betriebs). Der '
    'Betrag in `amount` ist IMMER positiv.';
comment on column public.owner_expenses.currency is
    'Waehrung des Postens (ISO-4217). Kommt aus den Daten (Objekt/Tenant), '
    'nie geraten — fehlt sie, meldet der Service 422 (Wurzel 4).';
comment on column public.owner_expenses.storage_path is
    'Beleg im PRIVATEN Bucket owner-expense-receipts; Download nur ueber eine '
    'vom Backend signierte URL.';

-- ---------------------------------------------------------------------------
-- 6. Wurzel-6-Riegel nachziehen (idempotent, war schon durch 0224/0337 gesetzt)
-- ---------------------------------------------------------------------------
revoke select, insert, update, delete on public.owner_expenses from anon, authenticated;

alter table public.owner_expenses enable row level security;

drop policy if exists owner_expenses_write_restrict on public.owner_expenses;
create policy owner_expenses_write_restrict on public.owner_expenses
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Kein Realtime: owner_expenses traegt Betraege je Eigentuemer und ist fuer
-- anon/authenticated bewusst ohne select-Grant. Ein Abo waere eine stumme
-- Attrappe (CLAUDE.md, Realtime-Gate) — die UI laedt nach eigener Aktion neu.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'owner_expenses'
  ) then
    alter publication supabase_realtime drop table public.owner_expenses;
  end if;
end $$;
