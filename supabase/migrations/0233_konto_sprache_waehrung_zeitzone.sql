-- Kontoeinstellungen „Sprache & Währung" (Airbnb-Vorbild: Sprache, Währung,
-- Zeitzone).
--
-- Befund beim Bau: `preferred_language` gab es in `public.users` NIE — die
-- Sprachauswahl im Konto schrieb ins Leere und zeigte darum dauerhaft „Nicht
-- angegeben". Diese Migration legt die Spalte an und ergaenzt die beiden
-- fehlenden Einstellungen.
--
-- Alle drei bewusst NULLABLE ohne Default: „noch nicht gewaehlt" ist ein
-- eigener Zustand. Ein Default 'de'/'EUR'/'Europe/Berlin' waere ein erfundener
-- Wert (Wurzel 4) — er wuerde behaupten, der Nutzer haette Deutsch und Euro
-- gewaehlt, und die Oberflaeche koennte nicht mehr unterscheiden, ob jemand
-- Euro will oder nur nie gefragt wurde.

begin;

alter table public.users
  add column if not exists preferred_language text,
  add column if not exists preferred_currency char(3),
  add column if not exists preferred_timezone text;

comment on column public.users.preferred_language is
  'BCP-47-Kuerzel der Oberflaechensprache, z. B. "de". NULL = nicht gewaehlt.';
comment on column public.users.preferred_currency is
  'ISO-4217, z. B. "EUR". Anzeigewaehrung des Nutzers — NICHT die Waehrung '
  'eines Objekts (properties.currency) und nicht die einer Buchung.';
comment on column public.users.preferred_timezone is
  'IANA-Zeitzone, z. B. "Europe/Berlin". Fuer die Anzeige von Zeiten im Konto.';

-- Waehrung: ISO-4217 sind drei Grossbuchstaben. Ohne diesen CHECK landete
-- "eur" oder "€" in der Spalte und liefe still durch die Formatierung.
alter table public.users
  add constraint users_preferred_currency_iso
  check (preferred_currency is null or preferred_currency ~ '^[A-Z]{3}$');

-- Zeitzone gegen die echte IANA-Datenbank pruefen, statt Freitext zu erlauben:
-- ein Tippfehler wuerde sonst erst beim Rendern auffallen.
--
-- Ueber einen Trigger, nicht ueber CHECK: ein CHECK darf keine Unterabfrage
-- enthalten, und `pg_timezone_names` ist eine Funktion. Ein Regex auf
-- "Kontinent/Stadt" waere kein Ersatz — er liesse "Europe/Berlim" durch.
create or replace function public.pruefe_zeitzone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.preferred_timezone is not null
     and not exists (
       select 1 from pg_catalog.pg_timezone_names
       where name = new.preferred_timezone
     ) then
    raise exception 'Unbekannte Zeitzone: %', new.preferred_timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.pruefe_zeitzone() from anon, authenticated;

create trigger users_zeitzone_pruefen
  before insert or update of preferred_timezone on public.users
  for each row execute function public.pruefe_zeitzone();

commit;
