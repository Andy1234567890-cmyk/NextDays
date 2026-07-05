-- 0110_storno_unique.sql — Doppel-Storno DB-seitig ausschließen
--
-- BUG (Loop-Fund): create_storno_invoice prüft Doppel-Storno nur per Read-vor-
-- Write (SELECT existing_storno), ohne DB-Backstop. Zwei parallele Storno-
-- Requests auf dieselbe Rechnung sehen beide „kein Storno", ziehen beide je eine
-- ST-Nummer und legen ZWEI Stornobelege an → die Rechnung wird doppelt
-- gutgeschrieben (GoBD-Fehlbestand -200 statt -100).
--
-- FIX: partieller Unique-Index — höchstens EIN aktiver Storno je Original.
-- Live verifiziert: 0 Bestands-Duplikate (gefahrlos anlegbar). Der Code fängt
-- die Kollision ab und liefert den existierenden Storno idempotent zurück.

create unique index if not exists invoices_storno_per_original_uidx
    on public.invoices (original_invoice_id)
    where invoice_type = 'storno'
      and original_invoice_id is not null
      and deleted_at is null;
