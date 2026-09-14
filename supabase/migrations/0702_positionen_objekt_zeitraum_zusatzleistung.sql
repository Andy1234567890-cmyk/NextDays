-- 0702_positionen_objekt_zeitraum_zusatzleistung.sql
-- Übernachtungspositionen tragen ihren eigenen Aufenthalt, Zusatzleistungen
-- hängen an ihrer Übernachtung.
--
-- Befund: seit 0698 kennt der Beleg EINEN Aufenthalt (`stay_from`/`stay_to`)
-- und EIN Objekt (`quotes.property_id`, 0701) — im Kopf. Ein Beleg über zwei
-- Zimmer oder zwei Zeiträume ist damit nicht darstellbar: beide Zeilen erben
-- denselben Kopfzeitraum, und auf dem PDF steht unter beiden dasselbe Objekt.
-- Der Kopf bleibt (er liefert die Vorbelegung und die Mengen der Positionen
-- ohne eigenen Zeitraum); die WAHRHEIT einer Übernachtungszeile steht ab hier
-- an der Zeile.
--
-- `parent_line_id` bildet die zweite Hälfte davon ab: eine Zusatzleistung
-- (Frühstück, Reinigung, Parkplatz aus `property_addons`) gehört zu GENAU
-- EINER Übernachtung, nicht zum Beleg. `on delete set null` statt `cascade`,
-- weil das Löschen der Übernachtung die bereits vereinbarte Zusatzleistung
-- nicht stillschweigend mitlöschen darf (sie wird dann eine eigenständige
-- Position, sichtbar statt still verschwunden).
--
-- Grants bleiben, wie 0224/0337 sie gesetzt haben: beide Tabellen sind für
-- anon/authenticated geschlossen, neue Spalten erben das Tabellen-GRANT
-- (Wurzel 6) — hier wird NICHTS gewährt.

alter table public.invoice_line_items
    add column if not exists property_id    uuid references public.properties (id) on delete set null,
    add column if not exists check_in       date,
    add column if not exists check_out      date,
    add column if not exists parent_line_id uuid references public.invoice_line_items (id) on delete set null;

alter table public.invoice_line_items drop constraint if exists invoice_line_items_zeitraum_chk;
alter table public.invoice_line_items add constraint invoice_line_items_zeitraum_chk check (
    check_out is null or check_in is null or check_out > check_in
);

alter table public.quote_line_items
    add column if not exists property_id    uuid references public.properties (id) on delete set null,
    add column if not exists check_in       date,
    add column if not exists check_out      date,
    add column if not exists parent_line_id uuid references public.quote_line_items (id) on delete set null;

alter table public.quote_line_items drop constraint if exists quote_line_items_zeitraum_chk;
alter table public.quote_line_items add constraint quote_line_items_zeitraum_chk check (
    check_out is null or check_in is null or check_out > check_in
);

create index if not exists invoice_line_items_parent_idx
    on public.invoice_line_items (parent_line_id) where parent_line_id is not null;
create index if not exists quote_line_items_parent_idx
    on public.quote_line_items (parent_line_id) where parent_line_id is not null;

comment on column public.invoice_line_items.property_id is
    'Objekt DIESER Position (Übernachtung); NULL = keine Objektbindung. Der Kopf (invoices.stay_from/-to) liefert nur die Vorbelegung.';
comment on column public.invoice_line_items.check_in is
    'Anreise DIESER Übernachtungszeile. Die Nächte der Zeile = check_out - check_in, unabhängig vom Belegkopf.';
comment on column public.invoice_line_items.check_out is
    'Abreise DIESER Übernachtungszeile; muss echt nach check_in liegen.';
comment on column public.invoice_line_items.parent_line_id is
    'Übernachtungszeile, zu der diese Zusatzleistung gehört; NULL = eigenständige Position. Beim Löschen der Übernachtung wird die Zusatzleistung eigenständig, nicht mitgelöscht.';

comment on column public.quote_line_items.property_id is
    'Objekt DIESER Position (Übernachtung); NULL = keine Objektbindung. Der Kopf (quotes.property_id, 0701) liefert nur die Vorbelegung.';
comment on column public.quote_line_items.check_in is
    'Anreise DIESER Übernachtungszeile. Die Nächte der Zeile = check_out - check_in, unabhängig vom Belegkopf.';
comment on column public.quote_line_items.check_out is
    'Abreise DIESER Übernachtungszeile; muss echt nach check_in liegen.';
comment on column public.quote_line_items.parent_line_id is
    'Übernachtungszeile, zu der diese Zusatzleistung gehört; NULL = eigenständige Position. Beim Löschen der Übernachtung wird die Zusatzleistung eigenständig, nicht mitgelöscht.';

-- Backfill: Angebote, die die Kalender-Brücke (0699) vor der Objekt-Spalte
-- (0701) gespiegelt hat, tragen kein Objekt — die Angebotsliste zeigte dort
-- „–" (live AN-0001, 14.09.2026). Das Objekt steht am verknüpften
-- Kalender-Angebot; nur leere Werte werden gefüllt, nichts überschrieben.
update public.quotes q
   set property_id = o.property_id
  from public.booking_offers o
 where o.quote_id = q.id
   and q.property_id is null
   and o.property_id is not null;
