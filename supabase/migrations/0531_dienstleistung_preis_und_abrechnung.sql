-- 0531 — Vom Eigentümer bestellte Leistungen kommen in seine Abrechnung.
--
-- WAS FEHLTE: Der Eigentümer bestellt im Portal eine Endreinigung (0330), der
-- Auftrag landet korrekt als `tasks`-Zeile beim Betrieb — und danach endet die
-- Kette. Die Eigentümer-Abrechnung erwähnt Aufgaben an KEINER Stelle; ein
-- Posten entsteht nur, wenn jemand ihn von Hand unter „Ausgaben & Extras"
-- erfasst. Live gemeldet am 03.09.2026: bestellte Endreinigung für „FeWo Lille
-- Vidstrup" (02.09. 17:01, fällig 30.10.) war in der Abrechnung unsichtbar.
-- Ausgeführte Arbeit, die niemand berechnet, ist ein Geldverlust — derselbe
-- Fehlerfall wie 0510, nur am anderen Ende der Kette.
--
-- ZWEI HÄLFTEN, deshalb zwei Teile in dieser Migration:
--   1. Der PREIS. Ohne ihn ist der Posten nicht bezifferbar, und geraten wird
--      nicht (Wurzel 4). Er hängt am Leistungstyp je Betrieb, mit Ausnahme je
--      Objekt — dieselbe Vorrang-Regel wie bei den Gebühren
--      (`fee_classification`): Objekt-Ausnahme schlägt Betriebsregel.
--   2. Der BEZUG. Die Aufgabe merkt sich, welchen Abrechnungsposten sie erzeugt
--      hat. Ohne diesen Anker entstünde bei jedem erneuten Abschließen ein
--      zweiter Posten (Wurzel 2), und ein Widerruf könnte den eigenen Posten
--      nicht von einem fremden, handisch erfassten unterscheiden (Wurzel 1).
--
-- WARUM NICHT `property_service_agreements` (0127): die Tabelle gehört zum
-- Objekt-DOSSIER, trägt freie Textschlüssel („caretaker", „window_cleaning")
-- und ist mit den `service_types`-Schlüsseln der Beauftragung nicht
-- deckungsgleich. Sie ist live leer und wird von keinem Slice außer dem
-- Dossier gelesen. Ein Preis dort wäre an einer zweiten Namenswelt gepflegt.

-- === 1. Preis je Leistungstyp und Betrieb ===================================
create table if not exists public.service_type_prices (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    service_type_id uuid not null references public.service_types (id) on delete cascade,
    -- NULL = Betriebsregel (gilt für alle Objekte). Gesetzt = Ausnahme für
    -- GENAU dieses Objekt. Vorrang: Ausnahme vor Regel.
    property_id     uuid references public.properties (id) on delete cascade,
    amount          numeric(12, 2) not null check (amount >= 0),
    -- Währung IMMER aus den Daten, kein Default (Wurzel 4): der Betrieb kann
    -- in DKK führen und Objekte in EUR haben.
    currency        char(3) not null check (currency ~ '^[A-Z]{3}$'),
    note            text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Je (Betrieb, Leistung, Objekt) genau EIN Preis. Zwei Zeilen liessen die
-- Ladereihenfolge entscheiden, welcher gilt — und der Betrag stünde später
-- unerklärlich in der Abrechnung. Zwei Indizes, weil NULL in einem UNIQUE
-- nicht gegen NULL vergleicht: die Betriebsregel braucht ihren eigenen.
create unique index if not exists service_type_prices_regel_uq
    on public.service_type_prices (tenant_id, service_type_id)
    where property_id is null;
create unique index if not exists service_type_prices_ausnahme_uq
    on public.service_type_prices (tenant_id, service_type_id, property_id)
    where property_id is not null;

comment on table public.service_type_prices is
    'Preis einer beauftragbaren Dienstleistung (service_types) je Betrieb, '
    'optional als Ausnahme je Objekt. Grundlage des Abrechnungspostens, der '
    'beim Abschluss einer vom Eigentümer bestellten Aufgabe entsteht (0531).';

-- Wurzel 6: Preise sind Betriebszahlen. Ein eingeloggter cleaner darf sie per
-- anon-Key nicht lesen und niemand darf sie schreiben — nur der Server.
alter table public.service_type_prices enable row level security;
revoke all on public.service_type_prices from anon, authenticated;

-- === 2. Bezug Aufgabe → Abrechnungsposten ==================================
alter table public.tasks
    add column if not exists owner_expense_id uuid
        references public.owner_expenses (id) on delete set null;

-- Ein Posten je Aufgabe. Der partielle UNIQUE ist der DB-Backstop gegen den
-- zweiten Posten, wenn eine Aufgabe erneut abgeschlossen wird (Wurzel 2) —
-- der Service prüft es auch, aber ein Riegel, den nur der Code kennt, ist
-- keiner.
create unique index if not exists tasks_owner_expense_uq
    on public.tasks (owner_expense_id)
    where owner_expense_id is not null;

comment on column public.tasks.owner_expense_id is
    'Der Abrechnungsposten, den DIESE Aufgabe erzeugt hat (0531). Anker für '
    'den Gegenzustand: nur ein Posten mit dieser Kennung wird beim Zurücknehmen '
    'entfernt, nie ein handisch erfasster (Wurzel 1).';

-- === 3. Kennzeichen nachziehen =============================================
-- `ordered_by_owner` (0510) blieb bei der Portal-Beauftragung auf false, obwohl
-- genau dort der Eigentümer bestellt. Der Bestand wird nachgezogen: jede
-- Aufgabe mit `requested_by`, hinter der ein Eigentümer-Login steht, IST eine
-- Bestellung des Eigentümers. Ohne das Kennzeichen würde die Abrechnung sie
-- nicht als abrechenbar erkennen.
update public.tasks t
   set ordered_by_owner = true
 where t.ordered_by_owner = false
   and t.requested_by is not null
   and exists (
        select 1 from public.owners o
         where o.user_id = t.requested_by
           and o.tenant_id = t.tenant_id
   );
