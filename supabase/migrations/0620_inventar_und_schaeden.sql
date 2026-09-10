-- 0620 — Inventarliste je Objekt: Räume, Zustand, Schäden mit Foto und Beleg
--
-- WARUM: `inventory_items` gibt es seit 0012, aber nur als Rumpf — `name` und
-- `quantity`, ein einziger Schreibpfad (`POST /tasks/inventory`), KEIN
-- Lesepfad, keine Oberfläche. Was ein Betrieb wirklich braucht, ist eine
-- Inventurliste: Was steht wo, wie viele sollen es sein, wie viele sind es,
-- und was ist kaputt.
--
-- ERWEITERT statt neu angelegt: eine zweite Inventartabelle neben der ersten
-- hiesse zwei Wahrheiten über denselben Gegenstand. Die vorhandene trägt
-- bereits RLS (0015), den Schreib-Lockdown (0229/0337) und den Owner-/Staff-
-- Objekt-Scope (0059/0136) — alles, was eine neue Tabelle erst wieder
-- bekommen müsste, mit dem Risiko, eine Stelle zu vergessen.
--
-- DER SCHADEN IST EINE EIGENE ZEILE, nicht ein Feld am Gegenstand. Gründe:
--   * Ein Gegenstand geht mehrmals kaputt. Ein Statusfeld kennt nur den
--     letzten Fall; niemand könnte sagen, ob die Lampe seit gestern oder seit
--     einem Jahr Ärger macht.
--   * Zu jedem Schaden gehören Foto, Melder, Datum, Betrag, Beleg und ein
--     Abrechnungsposten. Das an den Gegenstand zu hängen hiesse, all das beim
--     nächsten Schaden zu überschreiben.
--
-- FOTO IST PFLICHT (Vorgabe vom 09.09.2026): ohne Bild keine Meldung. Ein
-- Schaden ohne Beleg ist im Streitfall wertlos — und genau dann wird er
-- gebraucht. Erzwungen wird das im Service, nicht per CHECK: die Datei liegt
-- im Storage, die DB kann ihre Existenz nicht prüfen.
--
-- WER ZAHLT, wird BEIM MELDEN gewählt (`traeger`), nicht fest verdrahtet. Die
-- bestehende Automatik für Dienstleistungen schreibt immer `from_owner`
-- (`tasks/abrechnung.py`); bei einem Schaden ist das oft falsch — hat der Gast
-- die Lampe zerbrochen, wird sie ihm berechnet, nicht dem Eigentümer.
--
-- DER ABRECHNUNGSPOSTEN ENTSTEHT ERST NACH BESTÄTIGUNG. Eine Reinigungskraft
-- meldet „Lampe kaputt" und kennt den Preis nicht. Ein Posten über 0,00 oder
-- ein geschätzter Betrag wäre eine Falschaussage in der Eigentümer-Abrechnung
-- (Wurzel 4). Deshalb: melden → Agentur trägt Betrag und Träger ein →
-- Posten. Diese Freigabestufe gibt es für `owner_expenses` bisher nicht; die
-- Form ist von 0538 übernommen (Status + entschieden_von + entschieden_am).
--
-- SICHERHEIT (Wurzel 6): Eine Reinigungskraft DARF Schäden melden
-- (`MANAGE_INVENTORY` hat sie bereits, permissions.py:189), aber sie darf die
-- Kartei NICHT sehen — dort stehen IBAN, Steuer-ID und Türcodes. Der
-- Melde-Endpunkt ist deshalb ein eigener, und die Tabellen bekommen dieselbe
-- Behandlung wie der Rest: RLS, Schreib-Lockdown, kein Direktpfad.

-- --------------------------------------------------------------------------
-- Räume: die Gliederung, in der man beim Rundgang durchgeht
-- --------------------------------------------------------------------------
-- Eigene Tabelle statt Freitext an der Zeile: „Küche", „kueche" und "Küche "
-- liefen binnen Wochen auseinander, und die Gruppierung wäre wertlos —
-- dieselbe Begründung wie bei den festen Kategorien in 0496.
create table if not exists public.inventory_room (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    name text not null check (length(name) between 1 and 120),
    -- Reihenfolge beim Rundgang. Gleiche Werte sind erlaubt; sortiert wird
    -- danach und dann nach Name.
    sortierung integer not null default 0,
    created_at timestamptz not null default now(),

    constraint inventory_room_name_je_objekt unique (property_id, name)
);

create index if not exists inventory_room_objekt_idx
    on public.inventory_room (tenant_id, property_id, sortierung);

comment on table public.inventory_room is
    'Räume eines Objekts als Gliederung der Inventarliste. Feste Menge statt '
    'Freitext, damit die Gruppierung nicht auseinanderläuft.';

-- --------------------------------------------------------------------------
-- Der Gegenstand: `inventory_items` bekommt, was eine Inventur braucht
-- --------------------------------------------------------------------------
alter table public.inventory_items
    add column if not exists room_id uuid
        references public.inventory_room (id) on delete set null,
    -- Wie viele es sein SOLLEN. `quantity` (0012) bleibt der IST-Stand —
    -- umbenannt wird nichts, das bräche den vorhandenen Schreibpfad.
    add column if not exists soll_menge integer
        check (soll_menge is null or soll_menge >= 0),
    add column if not exists beschreibung text
        check (beschreibung is null or length(beschreibung) <= 2000),
    -- Woher die Zeile kommt: von Hand getippt oder aus einem PDF übernommen.
    -- Bei „dokument" steht in `quelle_dokument_id`, aus welchem.
    add column if not exists quelle text not null default 'manuell'
        check (quelle in ('manuell', 'dokument')),
    add column if not exists quelle_dokument_id uuid
        references public.mappe_dokument (id) on delete set null,
    -- Wann zuletzt jemand nachgesehen hat. NULL = noch nie inventarisiert —
    -- ausdrücklich nicht `now()` als Vorgabe: eine nie geprüfte Zeile darf
    -- nicht aussehen wie eine heute geprüfte (Wurzel 4).
    add column if not exists geprueft_am timestamptz,
    add column if not exists geprueft_von uuid
        references public.users (id) on delete set null,
    add column if not exists updated_by uuid
        references public.users (id) on delete set null;

create index if not exists inventory_items_raum_idx
    on public.inventory_items (tenant_id, property_id, room_id);

comment on column public.inventory_items.quantity is
    'IST-Stand: wie viele wirklich da sind. Das SOLL steht in soll_menge; die '
    'Differenz ist die eigentliche Aussage einer Inventur.';
comment on column public.inventory_items.geprueft_am is
    'Letzte Sichtprüfung. NULL = nie geprüft, NICHT „heute geprüft".';

-- --------------------------------------------------------------------------
-- Der Schaden
-- --------------------------------------------------------------------------
create table if not exists public.inventory_damage (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    -- Das Objekt steht redundant an der Zeile: der Melde-Endpunkt eines
    -- cleaners muss den Objekt-Scope prüfen können, ohne die Kartei zu
    -- berühren, und die Schadensliste eines Objekts darf keinen Join über
    -- den Gegenstand brauchen.
    property_id uuid not null references public.properties (id) on delete cascade,
    -- Der Gegenstand. `set null`, nicht `cascade`: wird ein Gegenstand aus der
    -- Liste genommen, bleibt der Schaden samt Foto und Beleg bestehen — er ist
    -- passiert, und der Abrechnungsposten hängt daran.
    item_id uuid references public.inventory_items (id) on delete set null,
    -- Name zum Zeitpunkt der Meldung. Ohne ihn stünde nach dem Entfernen des
    -- Gegenstands ein Schaden ohne Gegenstand da.
    item_name text not null check (length(item_name) between 1 and 300),

    -- Was los ist. `fehlt` und `beschaedigt` sind verschiedene Dinge: das eine
    -- ist weg, das andere da und kaputt.
    art text not null check (art in ('beschaedigt', 'fehlt', 'entsorgt')),
    beschreibung text check (beschreibung is null or length(beschreibung) <= 2000),
    menge integer not null default 1 check (menge > 0),

    -- WER ZAHLT — beim Melden gewählt, nicht fest verdrahtet. `offen` heisst
    -- „noch nicht entschieden" und ist etwas anderes als „der Betrieb zahlt".
    traeger text not null default 'offen'
        check (traeger in ('offen', 'eigentuemer', 'gast', 'betrieb')),
    -- Die Buchung, deren Gast es war. Nur bei traeger='gast' sinnvoll.
    reservation_id uuid references public.reservations (id) on delete set null,

    -- Der Ablauf: gemeldet → (Betrag/Träger eingetragen) → bestaetigt →
    -- abgerechnet. `verworfen` = doch kein Schaden.
    status text not null default 'gemeldet'
        check (status in ('gemeldet', 'bestaetigt', 'abgerechnet', 'verworfen')),

    -- Der Betrag der Neuanschaffung. NULL, solange niemand ihn kennt — die
    -- meldende Reinigungskraft kennt ihn nicht, und eine 0 wäre eine Zahl,
    -- die nach „kostenlos" aussieht (Wurzel 4).
    betrag numeric(12, 2) check (betrag is null or betrag >= 0),
    -- Währung IMMER aus den Daten, nie hart gesetzt (Wurzel 4). Zusammen mit
    -- dem Betrag gesetzt oder gar nicht.
    currency text check (currency is null or length(currency) = 3),

    gemeldet_von uuid references public.users (id) on delete set null,
    gemeldet_am timestamptz not null default now(),
    bestaetigt_von uuid references public.users (id) on delete set null,
    bestaetigt_am timestamptz,
    -- Der erzeugte Abrechnungsposten. `set null`: wird der Posten storniert,
    -- bleibt der Schaden bestehen.
    owner_expense_id uuid references public.owner_expenses (id) on delete set null,
    -- Die erzeugte Aufgabe („ersetzen"). Ebenfalls `set null`.
    task_id uuid references public.tasks (id) on delete set null,

    -- Ein Betrag ohne Währung ist keine Angabe, sondern eine Zahl.
    constraint inventory_damage_betrag_hat_waehrung
        check ((betrag is null) = (currency is null)),
    -- Bestätigt heisst: jemand hat Betrag UND Träger festgelegt. Ohne beides
    -- entstünde ein Abrechnungsposten, den niemand verantwortet.
    constraint inventory_damage_bestaetigt_hat_betrag
        check (
            status not in ('bestaetigt', 'abgerechnet')
            or (betrag is not null and traeger <> 'offen')
        )
);

create index if not exists inventory_damage_objekt_idx
    on public.inventory_damage (tenant_id, property_id, status, gemeldet_am desc);
create index if not exists inventory_damage_item_idx
    on public.inventory_damage (item_id);

comment on table public.inventory_damage is
    'Gemeldete Schäden am Inventar. Eigene Zeile je Vorfall, damit ein '
    'mehrfach beschädigter Gegenstand seine Geschichte behält.';
comment on column public.inventory_damage.traeger is
    'Wer die Kosten trägt — beim Melden gewählt. offen = noch nicht '
    'entschieden, NICHT „der Betrieb zahlt".';

-- --------------------------------------------------------------------------
-- Die Fotos zum Schaden
-- --------------------------------------------------------------------------
-- Eigene Tabelle statt einer Spalte: ein Schaden hat oft mehrere Bilder
-- (Übersicht, Detail, Seriennummer).
create table if not exists public.inventory_damage_photo (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    damage_id uuid not null
        references public.inventory_damage (id) on delete cascade,
    storage_path text not null check (length(storage_path) <= 600),
    hochgeladen_von uuid references public.users (id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists inventory_damage_photo_idx
    on public.inventory_damage_photo (tenant_id, damage_id);

comment on table public.inventory_damage_photo is
    'Bilder zu einem Schaden. Pflicht bei der Meldung — im Streitfall ist das '
    'Foto oft das Einzige, was zählt.';

-- --------------------------------------------------------------------------
-- RLS (Wurzel 6)
-- --------------------------------------------------------------------------
-- Dieselbe Behandlung wie der übrige Bestand: Mandanten-Policy für das Lesen,
-- Schreiben ausschliesslich über den Server. Ein eingeloggter cleaner darf per
-- `curl /rest/v1/inventory_damage` NICHT schreiben — auch nicht an einem
-- Objekt, das ihm zugewiesen ist.
alter table public.inventory_room enable row level security;
drop policy if exists inventory_room_tenant on public.inventory_room;
create policy inventory_room_tenant on public.inventory_room
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
drop policy if exists inventory_room_write_restrict on public.inventory_room;
create policy inventory_room_write_restrict on public.inventory_room
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke insert, update, delete on public.inventory_room from anon, authenticated;

alter table public.inventory_damage enable row level security;
drop policy if exists inventory_damage_tenant on public.inventory_damage;
create policy inventory_damage_tenant on public.inventory_damage
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
drop policy if exists inventory_damage_write_restrict on public.inventory_damage;
create policy inventory_damage_write_restrict on public.inventory_damage
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke insert, update, delete on public.inventory_damage from anon, authenticated;

-- Die Fotozeilen tragen Ablagepfade. Lesen bleibt tenant-weit erlaubt (die
-- Oberfläche zeigt die Bilder), Schreiben nur über den Server; die Datei
-- selbst liegt im privaten Bucket und ist nur über signierte URLs erreichbar.
alter table public.inventory_damage_photo enable row level security;
drop policy if exists inventory_damage_photo_tenant on public.inventory_damage_photo;
create policy inventory_damage_photo_tenant on public.inventory_damage_photo
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
drop policy if exists inventory_damage_photo_write_restrict
    on public.inventory_damage_photo;
create policy inventory_damage_photo_write_restrict on public.inventory_damage_photo
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke insert, update, delete on public.inventory_damage_photo
    from anon, authenticated;

-- --------------------------------------------------------------------------
-- Objekt-Scope für Eigentümer und Personal
-- --------------------------------------------------------------------------
-- Dieselben Helfer wie 0059/0136. Ohne sie sähe ein Eigentümer die Schäden
-- ALLER Objekte seines Betriebs, und eine Reinigungskraft die von Häusern, die
-- ihr nicht zugewiesen sind. Die Helfer sind fail-closed: unbekannte Rolle →
-- kein Zugriff.
do $$
declare
  t text;
  tables text[] := array['inventory_room', 'inventory_damage'];
begin
  foreach t in array tables loop
    execute format(
      'drop policy if exists %I_owner_scope on public.%I', t, t
    );
    execute format(
      'create policy %I_owner_scope on public.%I as restrictive for all '
      'using (public.owner_can_see_property(property_id)) '
      'with check (public.owner_can_see_property(property_id))', t, t
    );
    execute format(
      'drop policy if exists %I_staff_scope on public.%I', t, t
    );
    execute format(
      'create policy %I_staff_scope on public.%I as restrictive for all '
      'using (public.staff_can_see_property(property_id)) '
      'with check (public.staff_can_see_property(property_id))', t, t
    );
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- Bucket für die Schadensfotos
-- --------------------------------------------------------------------------
-- PRIVAT wie `task-photos` (0126): auf einem Schadensfoto ist die Wohnung
-- eines Gastes zu sehen. Zugriff ausschliesslich über signierte URLs vom
-- Server. Bilder UND PDF — der Beleg der Neuanschaffung kommt oft als PDF vom
-- Händler, und beides in einem Bucket erspart eine zweite Ablage mit eigener
-- Rechteverwaltung.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventar-schaeden', 'inventar-schaeden', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
    set public = false,
        file_size_limit = 20971520,
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp',
                                   'application/pdf'];
