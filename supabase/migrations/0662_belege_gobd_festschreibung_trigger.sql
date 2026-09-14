-- 0662_belege_gobd_festschreibung_trigger.sql — Festschreibung auf DB-Ebene (Bereich »belege«)
--
-- BEFUND: Die GoBD-Unveränderbarkeit festgeschriebener Belege lebte bis heute
-- AUSSCHLIESSLICH im Service (`BuchhaltungService._MUTABLE_INVOICE_STATUSES`,
-- geprüft in tests/test_invoice_immutability.py). Einen Trigger gab es nicht.
-- Der Service-Layer ist gegen den Direktpfad wirkungslos (Wurzel 6): wer mit
-- service_role oder über einen künftigen Codepfad `update invoices set
-- gross_amount = …` schreibt, verändert einen Steuerbeleg, der im Ausdruck
-- längst beim Kunden liegt. Hier kommt der Backstop in die Datenbank.
--
-- REGEL (identisch zum Service): festgeschrieben ist ein Beleg, sobald er eine
-- Nummer trägt ODER nicht mehr `draft` ist ODER `is_locked` gesetzt ist.
-- Entwürfe bleiben frei änderbar. An einem festgeschriebenen Beleg dürfen sich
-- die FISKALISCHEN Felder nicht mehr ändern: Nummer, Art, Kunde, Datum,
-- Währung, Beträge, Steuersatz/-regel, Kopf-/Fußtext, Verweise, Mandant und
-- `deleted_at` (kein Soft-Delete eines Steuerbelegs).
--
-- Was WEITER erlaubt bleibt — bewusst, weil bestehende Pfade es brauchen:
--   * status, paid_amount, paid_at, payment_method, card_brand
--     (Zahlungseingang, Mahnlauf hebt auf `overdue`, Storno setzt das Original
--     auf `cancelled` — storno.py:203),
--   * storno_reason, pdf_url, e_invoice_xml, e_invoice_format, leitweg_id
--     (update_invoice_raw erlaubt genau diese Anlagen),
--   * gobd_status, is_locked, locked_at, locked_by, notes, updated_at und
--     jede Spalte, die hier nicht aufgezählt ist (neue Betriebs-/Versandfelder
--     der Nachbarbereiche laufen nicht auf).
-- Der Positions-INSERT wird NICHT gesperrt: storno.py legt den Kopf mit
-- `status='finalized'` an und fügt die Positionen DANACH ein. Gesperrt sind
-- UPDATE und DELETE auf Positionen festgeschriebener Belege.
--
-- Der Trigger wertet seine Bedingung nur über NOT-NULL-Spalten (`status`,
-- `is_locked`) und `is distinct from` aus — er kann beim Auswerten der EIGENEN
-- Bedingung nicht werfen (Lehre aus 0418→0424: ein Trigger, der dort scheitert,
-- legt JEDE Änderung an seiner Tabelle lahm). Nach dem Einspielen:
--   bash scripts/diagnose/db-trigger-pruefen.sh

create or replace function public.invoices_festgeschrieben_schuetzen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    -- Entwurf ohne Nummer und ohne Sperre: alles erlaubt.
    if old.invoice_number is null and old.status = 'draft' and not old.is_locked then
        return new;
    end if;

    if new.tenant_id           is distinct from old.tenant_id
    or new.invoice_number      is distinct from old.invoice_number
    or new.invoice_sequence    is distinct from old.invoice_sequence
    or new.invoice_year        is distinct from old.invoice_year
    or new.invoice_type        is distinct from old.invoice_type
    or new.customer_id         is distinct from old.customer_id
    or new.issue_date          is distinct from old.issue_date
    or new.currency            is distinct from old.currency
    or new.net_amount          is distinct from old.net_amount
    or new.tax_amount          is distinct from old.tax_amount
    or new.gross_amount        is distinct from old.gross_amount
    or new.tax_rate            is distinct from old.tax_rate
    or new.tax_rule            is distinct from old.tax_rule
    or new.is_kleinunternehmer is distinct from old.is_kleinunternehmer
    or new.head_text           is distinct from old.head_text
    or new.footer_text         is distinct from old.footer_text
    or new.original_invoice_id is distinct from old.original_invoice_id
    or new.source_document_id  is distinct from old.source_document_id
    or new.source_quote_id     is distinct from old.source_quote_id
    or new.deleted_at          is distinct from old.deleted_at
    then
        raise exception using
            errcode = 'check_violation',
            message = 'Festgeschriebener Beleg (GoBD): fiskalische Felder sind unveränderbar.',
            detail  = format('invoice %s, Nummer %s, Status %s',
                             old.id, coalesce(old.invoice_number, '-'), old.status),
            hint    = 'Korrekturen laufen über Storno oder Gutschrift, nie über ein Update.';
    end if;
    return new;
end;
$$;

revoke execute on function public.invoices_festgeschrieben_schuetzen() from public, anon, authenticated;

drop trigger if exists trg_invoices_festgeschrieben on public.invoices;
create trigger trg_invoices_festgeschrieben
    before update on public.invoices
    for each row execute function public.invoices_festgeschrieben_schuetzen();


create or replace function public.invoice_line_items_festgeschrieben_schuetzen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_invoice_id uuid := coalesce(old.invoice_id, new.invoice_id);
    v_gesperrt boolean;
begin
    select (i.invoice_number is not null or i.status <> 'draft' or i.is_locked)
      into v_gesperrt
      from public.invoices i
     where i.id = v_invoice_id;

    if coalesce(v_gesperrt, false) then
        raise exception using
            errcode = 'check_violation',
            message = 'Festgeschriebener Beleg (GoBD): Positionen sind unveränderbar.',
            detail  = format('invoice %s', v_invoice_id),
            hint    = 'Korrekturen laufen über Storno oder Gutschrift.';
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

revoke execute on function public.invoice_line_items_festgeschrieben_schuetzen() from public, anon, authenticated;

drop trigger if exists trg_invoice_line_items_festgeschrieben on public.invoice_line_items;
create trigger trg_invoice_line_items_festgeschrieben
    before update or delete on public.invoice_line_items
    for each row execute function public.invoice_line_items_festgeschrieben_schuetzen();
