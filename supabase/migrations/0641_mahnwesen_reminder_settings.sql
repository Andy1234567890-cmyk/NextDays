-- 0641_mahnwesen_reminder_settings.sql — Einstellungen des Mahnwesens je Betrieb
--
-- WARUM EINE EIGENE TABELLE UND KEINE DEFAULTS IM CODE:
-- Das alte Werkzeug trug „5/10/15 € Gebühr, 7/14/21 Tage" als Konstanten im
-- Browser (ReminderSettings.tsx, ReminderComponent.tsx:76-78) und schrieb sie
-- als `reminderFees` in das Firmendokument. Für einen Betrieb in DKK, PLN oder
-- CHF ist „5 €" ein erfundener Wert (Wurzel 4) — und Mahngebühren sind
-- rechtlich je Land verschieden. Deshalb: KEIN Ersatzwert. Fehlt die Zeile,
-- liefert `GET /reminders/settings/{company}` `null`-Felder, und die erste
-- Mahnung schlägt mit 422 fehl, bis der Betrieb seine Stufen eingestellt hat.
--
-- Je Stufe: Zahlungsfrist der Mahnung in Tagen (`levelN_days`, ab Mahndatum),
-- Gebühr in der Mandantenwährung (`levelN_fee`), Titel und Anschreibetext.
-- Dazu der Verzugszinssatz in % p.a. (`interest_rate`, 0 = keine Zinsen) und
-- der Schalter für den Überfälligkeits-Lauf (`auto_mark_overdue`): nur Betriebe
-- mit `true` bekommen ihre versendeten Rechnungen nach Fälligkeit automatisch
-- auf `status = 'overdue'` gesetzt (apps/api/src/jobs/mahnwesen_tick.py).
-- Auch dieser Schalter hat KEINEN Default: der Betrieb entscheidet beim
-- Speichern der Einstellungen, der Lauf fasst niemanden ohne Zeile an.
--
-- Alle Fachfelder sind NULL-fähig, damit die Zeile per Upsert entstehen kann;
-- ob ein Satz VOLLSTÄNDIG ist, prüft der Service (jede Stufe braucht days, fee,
-- title; interest_rate und auto_mark_overdue gesetzt). Versendet wird hier
-- nichts automatisch.
--
-- Finanz-/Betriebseinstellungen sind server-only (Wurzel 6): RLS + revoke,
-- keine Realtime-Publikation.

create table if not exists public.reminder_settings (
    tenant_id           uuid primary key references public.tenants(id) on delete cascade,
    level1_days         integer       check (level1_days is null or level1_days between 0 and 365),
    level1_fee          numeric(12,2) check (level1_fee  is null or level1_fee  >= 0),
    level1_title        text,
    level1_text         text,
    level2_days         integer       check (level2_days is null or level2_days between 0 and 365),
    level2_fee          numeric(12,2) check (level2_fee  is null or level2_fee  >= 0),
    level2_title        text,
    level2_text         text,
    level3_days         integer       check (level3_days is null or level3_days between 0 and 365),
    level3_fee          numeric(12,2) check (level3_fee  is null or level3_fee  >= 0),
    level3_title        text,
    level3_text         text,
    interest_rate       numeric(5,2)  check (interest_rate is null or interest_rate between 0 and 100),
    auto_mark_overdue   boolean,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

drop trigger if exists trg_reminder_settings_updated on public.reminder_settings;
create trigger trg_reminder_settings_updated
    before update on public.reminder_settings
    for each row execute function public.set_updated_at();

alter table public.reminder_settings enable row level security;

drop policy if exists reminder_settings_tenant on public.reminder_settings;
create policy reminder_settings_tenant on public.reminder_settings
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.reminder_settings from anon, authenticated;
