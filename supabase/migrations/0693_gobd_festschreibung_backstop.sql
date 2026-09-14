-- 0693_gobd_festschreibung_backstop.sql — festgeschriebene Rechnungen sind in der DB unveränderbar
--
-- WARUM: `invoices.is_locked` existiert seit 0023, wurde aber nie gesetzt und
-- nie erzwungen — der Schutz stand allein im Service
-- (`BuchhaltungService.update_invoice_raw`/`delete_invoice`, Status- und
-- Nummern-Gate). Mit dem Bereich »gobd« wird `is_locked` erstmals gesetzt
-- (`POST /gobd/lock`, Auto-Festschreibung). Ein Service-Check reicht als
-- Schutz NICHT (Wurzel 6): elf weitere Schreibstellen im Backend fassen
-- `invoices` an, und jede neue könnte den Check vergessen. Deshalb hier der
-- Backstop in der Datenbank — er greift für jeden Pfad, auch service_role.
--
-- Was an einer festgeschriebenen Rechnung (OLD.is_locked = true) VERBOTEN ist:
--   * jede Änderung des Beleginhalts: Nummer, Art, Kunde, Ausstellungs- und
--     Fälligkeitsdatum, Währung, Netto/Steuer/Brutto, Steuersatz/-regel,
--     Kleinunternehmer-Angaben, Kopf-/Fußtext, Notizen, Storno-Verweis,
--     Leitweg-ID, Sprache, Reservierungs-Verweis, Mandant;
--   * das Entsperren (`is_locked` → false, `gobd_status` ≠ 'locked') und das
--     Umschreiben von `locked_at`/`locked_by`;
--   * das (Soft-)Löschen (`deleted_at`) und DELETE;
--   * Positionen anlegen, ändern oder löschen (`invoice_line_items`).
--
-- Was ERLAUBT bleibt — das sind Zahlungs- und Anlagen-Tatsachen, kein
-- Beleginhalt (GoBD Rz. 58: die Festschreibung schützt den Inhalt des Belegs,
-- nicht seinen Zahlungsstatus):
--   * `status`, `paid_amount`, `paid_at`, `payment_method`, `card_brand`
--     (Bereich »zahlungen«, 0644 schreibt sie; Storno setzt `cancelled` +
--     `storno_reason`);
--   * `e_invoice_xml`, `e_invoice_format`, `pdf_url` (technische Anlagen,
--     wie in `update_invoice_raw`);
--   * `updated_at` (Trigger).
--
-- Warum eine Spaltenliste statt „alles außer …": eine neue Spalte an `invoices`
-- ist dann standardmäßig FREI, und der Autor entscheidet bewusst, ob sie
-- Beleginhalt ist. Umgekehrt (Standard gesperrt) würde jede neue technische
-- Spalte (Sync-Zeitstempel, Zähler) still jede Zahlungsbuchung an
-- festgeschriebenen Rechnungen brechen.
--
-- Danach `bash scripts/diagnose/db-trigger-pruefen.sh` (Regel „Trigger
-- angefasst"): die Bedingung liest nur OLD/NEW-Spalten, kein coalesce auf
-- einer Enum-Spalte.

create or replace function public.invoices_festgeschrieben_schutz()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        if old.is_locked then
            raise exception 'Rechnung % ist festgeschrieben (GoBD) und kann nicht gelöscht werden.',
                coalesce(old.invoice_number, old.id::text)
                using errcode = 'P0001',
                      hint = 'Korrektur nur per Stornorechnung (POST /invoices/{id}/storno).';
        end if;
        return old;
    end if;

    if not old.is_locked then
        return new;
    end if;

    if new.is_locked is distinct from true
       or new.gobd_status is distinct from 'locked'
       or new.locked_at is distinct from old.locked_at
       or new.locked_by is distinct from old.locked_by then
        raise exception 'Rechnung % ist festgeschrieben (GoBD): Entsperren ist nicht möglich.',
            coalesce(old.invoice_number, old.id::text)
            using errcode = 'P0001',
                  hint = 'Die Festschreibung ist unumkehrbar; Korrektur nur per Stornorechnung.';
    end if;

    if new.deleted_at is distinct from old.deleted_at then
        raise exception 'Rechnung % ist festgeschrieben (GoBD) und kann nicht gelöscht werden.',
            coalesce(old.invoice_number, old.id::text)
            using errcode = 'P0001';
    end if;

    if new.tenant_id            is distinct from old.tenant_id
       or new.invoice_number      is distinct from old.invoice_number
       or new.invoice_prefix      is distinct from old.invoice_prefix
       or new.invoice_sequence    is distinct from old.invoice_sequence
       or new.invoice_year        is distinct from old.invoice_year
       or new.invoice_type        is distinct from old.invoice_type
       or new.customer_id         is distinct from old.customer_id
       or new.issue_date          is distinct from old.issue_date
       or new.due_date            is distinct from old.due_date
       or new.currency            is distinct from old.currency
       or new.net_amount          is distinct from old.net_amount
       or new.tax_amount          is distinct from old.tax_amount
       or new.gross_amount        is distinct from old.gross_amount
       or new.tax_rate            is distinct from old.tax_rate
       or new.tax_rule            is distinct from old.tax_rule
       or new.is_kleinunternehmer is distinct from old.is_kleinunternehmer
       or new.kleinunternehmer_text is distinct from old.kleinunternehmer_text
       or new.head_text           is distinct from old.head_text
       or new.footer_text         is distinct from old.footer_text
       or new.notes               is distinct from old.notes
       or new.original_invoice_id is distinct from old.original_invoice_id
       or new.leitweg_id          is distinct from old.leitweg_id then
        raise exception 'Rechnung % ist festgeschrieben (GoBD): Beleginhalt ist unveränderbar.',
            coalesce(old.invoice_number, old.id::text)
            using errcode = 'P0001',
                  hint = 'Erlaubt bleiben Zahlungsstatus und technische Anlagen (E-Rechnung, PDF).';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_invoices_festgeschrieben_schutz on public.invoices;
create trigger trg_invoices_festgeschrieben_schutz
    before update or delete on public.invoices
    for each row execute function public.invoices_festgeschrieben_schutz();

-- Positionen: hängen ohne tenant_id an der Rechnung; gesperrt ist, was zu einer
-- festgeschriebenen Rechnung gehört.
create or replace function public.invoice_line_items_festgeschrieben_schutz()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_invoice_id uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
    v_locked boolean;
begin
    select i.is_locked into v_locked from public.invoices i where i.id = v_invoice_id;
    if coalesce(v_locked, false) then
        raise exception 'Positionen einer festgeschriebenen Rechnung (GoBD) sind unveränderbar (%).', tg_op
            using errcode = 'P0001',
                  hint = 'Korrektur nur per Stornorechnung.';
    end if;
    -- Beim UPDATE darf eine Position auch nicht an eine gesperrte Rechnung umgehängt werden.
    if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
        select i.is_locked into v_locked from public.invoices i where i.id = old.invoice_id;
        if coalesce(v_locked, false) then
            raise exception 'Positionen einer festgeschriebenen Rechnung (GoBD) sind unveränderbar (UPDATE).'
                using errcode = 'P0001';
        end if;
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_invoice_line_items_festgeschrieben_schutz on public.invoice_line_items;
create trigger trg_invoice_line_items_festgeschrieben_schutz
    before insert or update or delete on public.invoice_line_items
    for each row execute function public.invoice_line_items_festgeschrieben_schutz();

-- Für die Status-Karte (offen/festgeschrieben) und den Auto-Lock-Lauf.
create index if not exists invoices_tenant_locked_idx
    on public.invoices (tenant_id, is_locked)
    where deleted_at is null;

revoke execute on function public.invoices_festgeschrieben_schutz() from anon, authenticated;
revoke execute on function public.invoice_line_items_festgeschrieben_schutz() from anon, authenticated;
