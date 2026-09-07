-- 0605 — Spaltenreihenfolge der Buchungstabelle, gespeichert je Abrechnung.
--
-- WARUM AN DER ABRECHNUNG und nicht im Browser: die Reihenfolge lag zuerst im
-- localStorage (07.09.2026, wie die Panelbreiten des Website-Editors). Ansage
-- des Betriebs noch am selben Tag: „wenn wir es verschieben wird es nicht an
-- vorschau weitergeben" — die Beleg-Vorschau und das PDF sollen die Spalten
-- so zeigen, wie der Editor sie zeigt. Dann ist die Reihenfolge eine
-- Eigenschaft des BELEGS (wie `sort_key`/`sort_dir` aus 0604), nicht des
-- Bildschirms: Editor, Vorschau, PDF und der Download des Eigentümers aus dem
-- Portal lesen dieselbe Liste.
--
-- NULL = Standardreihenfolge. Gesetzt = vollständige Liste der bekannten
-- Spaltenschlüssel in gewünschter Folge. Der CHECK hält die Werte auf die
-- bekannte Menge (deckungsgleich mit Pydantic `ColumnKey` und dem Frontend);
-- eine unbekannte Spalte wäre ein stiller Tippfehler, der in der Anzeige
-- einfach fehlt.

alter table public.owner_statements
    add column if not exists column_order text[];

alter table public.owner_statements
    drop constraint if exists owner_statements_column_order_check;

alter table public.owner_statements
    add constraint owner_statements_column_order_check
    check (
        column_order is null
        or (
            cardinality(column_order) > 0
            and column_order <@ array[
                'guest', 'listing', 'check_in', 'check_out', 'nights',
                'channel', 'gross', 'portal', 'commission', 'flat_fee',
                'owner_payout'
            ]::text[]
        )
    );

comment on column public.owner_statements.column_order is
    '0605: Spaltenreihenfolge der Buchungstabelle (Editor, Vorschau, PDF). '
    'NULL = Standard. Werte deckungsgleich mit Pydantic ColumnKey.';

-- Kein Grant-/RLS-Teil: `owner_statements` ist über 0187 für anon/authenticated
-- vollständig gesperrt (Wurzel 6).
