-- 0258_objekt_zeitzone.sql — Zeitzone am Objekt, Sendezeit in Ortszeit
--
-- Die Sendezeit einer Automation wurde bisher fest in UTC gerechnet
-- (InboxService._compute_send_at). Für ein Objekt in Athen ging eine auf
-- „10:00" gestellte Anreise-Nachricht damit um 13:00 Ortszeit raus, für eines
-- in Lissabon um 09:00. Bei 27 Zielländern ist das kein Randfall.
--
-- properties.timezone ist eine IANA-Zone ('Europe/Copenhagen'). Sie bleibt
-- bewusst NULL, wo sie niemand gesetzt hat: aus dem Land zu raten wäre für
-- Länder mit mehreren Zonen falsch, und ein erfundener Wert verschiebt still
-- den Versand (Wurzel 4). Ist am Objekt keine Zone hinterlegt und verlangt die
-- Automation sie, wird für dieses Objekt NICHT geplant — mit sichtbarem Grund.

alter table public.properties
    add column if not exists timezone text;

-- Gültigkeitsprüfung gegen den Zonenkatalog der Datenbank: ein Tippfehler
-- ('Europe/Kopenhagen') soll beim Speichern auffallen und nicht Monate später
-- den Versand kippen. Als TRIGGER, nicht als CHECK: pg_timezone_names ist eine
-- mengenliefernde Funktion, und Postgres verbietet Unterabfragen im CHECK.
create or replace function public.properties_timezone_pruefen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.timezone is not null
       and not exists (
           select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone
       )
    then
        raise exception 'Unbekannte Zeitzone: %', new.timezone
            using errcode = '22023';
    end if;
    return new;
end;
$$;

revoke execute on function public.properties_timezone_pruefen() from anon, authenticated;

drop trigger if exists trg_properties_timezone on public.properties;
create trigger trg_properties_timezone
    before insert or update of timezone on public.properties
    for each row execute function public.properties_timezone_pruefen();

comment on column public.properties.timezone is
    'IANA-Zeitzone des Objekts (z. B. Europe/Copenhagen). NULL = nicht hinterlegt; '
    'Automationen mit use_property_timezone planen dann nicht.';

alter table public.message_automation
    add column if not exists use_property_timezone boolean not null default false;

comment on column public.message_automation.use_property_timezone is
    'Sendezeit in der Zeitzone des Objekts auflösen statt in UTC.';
