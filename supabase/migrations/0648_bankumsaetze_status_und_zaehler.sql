-- 0648_bankumsaetze_status_und_zaehler.sql — Bearbeitungszustand eines
-- Bankumsatzes (Bereich »zahlungen«, Buchhaltung).
--
-- WARUM: 0643 legt den Umsatz als reine Tatsache aus der Datei ab. Für die
-- Zuordnungsarbeit fehlen vier Dinge:
--   * `ignored`/`note`   — der Nutzer legt Umsätze bewusst beiseite (Gebühren,
--                          Privatentnahmen) und schreibt sich einen Grund dazu.
--   * `link_count`/`linked_amount` — der GEGENZUSTAND jeder Verknüpfung
--                          (Wurzel 1): beim Anlegen einer transaction_links-
--                          Zeile hochgezählt, beim Lösen zurück. So filtert
--                          die Liste `unmatched`/`matched` in der DB statt alle
--                          Links nachzuladen, und der Restbetrag eines Umsatzes
--                          (Teilzahlungen) ist ohne Summenabfrage bekannt.
--   * `source`           — woher die Zeile stammt: `import` (Datei), `manual`
--                          (von Hand erfasst, Kassenbuch), `opening`
--                          (Anfangsbestand eines Kontos als ERSTE Buchung).
--                          Das Kassenbuch ist KEINE eigene Tabelle: Kasse =
--                          payment_accounts.type = 'cash' + diese Umsätze.
--
-- Der Status der Oberfläche (unmatched | matched | ignored) wird daraus
-- abgeleitet, nicht gespeichert: ignored → 'ignored', link_count > 0 →
-- 'matched', sonst 'unmatched'. Zwei Wahrheiten für denselben Zustand wären
-- die Quelle der nächsten Drift.

alter table public.bank_transactions
    add column if not exists ignored        boolean       not null default false,
    add column if not exists note           text,
    add column if not exists link_count     integer       not null default 0
                                            check (link_count >= 0),
    add column if not exists linked_amount  numeric(14,2) not null default 0,
    add column if not exists source         text          not null default 'import'
                                            check (source in ('import', 'manual', 'opening'));

comment on column public.bank_transactions.ignored is
    'Vom Nutzer beiseitegelegt (Gebühr, Privatentnahme …) — zählt nicht als offen.';
comment on column public.bank_transactions.link_count is
    'Anzahl transaction_links auf diesen Umsatz; Gegenzustand der Verknüpfung (Wurzel 1).';
comment on column public.bank_transactions.linked_amount is
    'Summe amount_allocated aller Verknüpfungen; Restbetrag = amount - linked_amount.';
comment on column public.bank_transactions.source is
    'import = Datei, manual = von Hand (Kassenbuch), opening = Anfangsbestand des Kontos.';

-- Offene Umsätze eines Betriebs schnell finden (Zuordnungsliste, Vorschläge).
create index if not exists bank_transactions_offen_idx
    on public.bank_transactions (tenant_id, booking_date desc)
    where link_count = 0 and not ignored;

-- Der Anfangsbestand eines Kontos ist GENAU EINE Buchung — Doppelklick auf
-- „Konto anlegen" oder ein Retry darf keinen zweiten erzeugen (Wurzel 2).
create unique index if not exists bank_transactions_ein_anfangsbestand_idx
    on public.bank_transactions (payment_account_id)
    where source = 'opening';
