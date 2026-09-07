-- 0586 — Buchungsangebot: Angebot per Mail mit Bestätigungslink und Zahlung
--
-- LASTENHEFT §2.2: „Buchungsangebot: Angebots-E-Mail an Gast mit
-- Bestätigungs-Link + verschlüsseltem Zahlungs-Gateway."
--
-- DER ANLASS (07.09.2026, Gap-Abgleich): Im Kalender-Aktionsmenü stand der
-- Eintrag „Angebot" seit Monaten sichtbar, aber `calendar-board.tsx` behandelte
-- die Aktion `reservation_quote` NICHT — sie fiel in denselben Zweig wie die
-- Direktbuchung und öffnete den Reservierungs-Assistenten. Ein Betrieb, der ein
-- Angebot schicken wollte, legte damit eine echte Buchung an. Ein toter
-- Menüpunkt, der sich als etwas anderes tarnt, ist schlimmer als keiner.
--
-- WIE ES SICH IN DEN BESTAND EINFÜGT — kein zweiter Buchungsweg:
-- Das Angebot ist die VORSTUFE zur Buchungsabsicht (0409). Nimmt der Gast an,
-- entsteht KEINE Reservierung, sondern eine `booking_intent`-Zeile plus
-- Zahlung; erst `payment_intent.succeeded` erzeugt die Buchung. Damit gilt auch
-- hier die Regel aus 0409: keine Buchung ohne bezahlte Zahlung. Der Angebots-
-- Zustand `accepted` heißt „Gast hat zugesagt und zahlt gerade", nicht „gebucht".
--
-- WAS DAS ANGEBOT BEWUSST NICHT TUT: Es belegt KEINE Nächte. Ein Angebot, das
-- den Kalender hält, wäre eine Option auf Zeit — die hat der Betrieb schon bei
-- 0409 abgelehnt (lieber eine seltene Absage als blockierte Nächte ohne
-- Gegenwert). Nimmt der Gast an und der Zeitraum ist inzwischen vergeben,
-- scheitert die Annahme mit 409, BEVOR Geld fließt (der Zahlungslink entsteht
-- erst nach der erneuten Verfügbarkeitsprüfung).
--
-- WURZEL 3 — der Token ist der ganze Zugang: Die öffentliche Annahmeseite hat
-- keine Anmeldung. Deshalb liegt hier NUR der SHA-256-Hash des Tokens, nie der
-- Token selbst: ein Leseleck an dieser Tabelle darf niemandem erlauben, ein
-- fremdes Angebot anzunehmen.

create table if not exists public.booking_offers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  property_id     uuid not null references public.properties (id) on delete cascade,
  -- Die Einheit, auf die sich das Angebot bezieht (1 Objekt = 1 Typ mit n
  -- Einheiten). Nullable: bei genau einer Einheit entscheidet erst die
  -- Buchungs-RPC, welche es wird — ein hier festgeschriebener Wert wäre eine
  -- Vorwegnahme, die beim Annehmen ohnehin erneut geprüft werden muss.
  unit_id         uuid references public.property_units (id) on delete set null,
  check_in        date not null,
  check_out       date not null,
  constraint booking_offers_zeitraum check (check_out > check_in),
  adults          integer not null default 2 check (adults >= 1),
  children        integer not null default 0 check (children >= 0),
  pets            integer not null default 0 check (pets >= 0),
  -- Der Gast ist hier noch kein Konto: das Angebot geht an eine Adresse, die
  -- der Betrieb eintippt. Die Gästekartei entsteht erst mit der Buchung.
  guest_name      text not null check (length(btrim(guest_name)) between 1 and 200),
  guest_email     text not null check (position('@' in guest_email) > 1),
  guest_phone     text,
  -- Sprache des Gastes für Mail und Annahmeseite (Code wie `mail_sprache`).
  language        text,
  -- Währung und Preisaufschlüsselung kommen aus dem zentralen Resolver und
  -- werden als TATSACHE festgehalten: das Angebot gilt zu dem Preis, der im
  -- Angebot stand, auch wenn sich der Kalenderpreis danach ändert. Wurzel 4:
  -- die Währung wird nie geraten, sie kommt vom Objekt.
  currency        text not null,
  quote_snapshot  jsonb not null,
  total_amount    numeric(12,2) not null check (total_amount > 0),
  -- Anzahlung: was der Gast JETZT zahlt, um das Angebot verbindlich zu machen.
  -- Null = der Gesamtbetrag ist fällig. Nie größer als die Summe.
  deposit_amount  numeric(12,2) check (deposit_amount > 0),
  constraint booking_offers_anzahlung_kleiner check (
    deposit_amount is null or deposit_amount <= total_amount
  ),
  -- Ablauf: danach kann nicht mehr angenommen werden. Pflicht, damit kein
  -- Angebot ewig bezahlbar bleibt.
  expires_at      timestamptz not null,
  -- WURZEL 3: nur der Hash. Der Token steht ausschließlich im Mail-Link.
  token_hash      text not null unique
                  check (token_hash ~ '^[0-9a-f]{64}$'),
  -- draft    angelegt, noch nicht verschickt
  -- sent     Mail ist raus
  -- viewed   Gast hat die Seite geöffnet
  -- accepted Gast hat zugesagt, Zahlung läuft (booking_intent existiert)
  -- paid     Zahlung durch, Reservierung entstanden
  -- declined Gast hat abgelehnt
  -- expired  Frist verstrichen
  -- cancelled Betrieb hat zurückgezogen
  status          text not null default 'draft'
                  check (status in ('draft','sent','viewed','accepted','paid',
                                    'declined','expired','cancelled')),
  sent_at         timestamptz,
  viewed_at       timestamptz,
  accepted_at     timestamptz,
  declined_at     timestamptz,
  -- Die Buchungsabsicht (0409), die beim Annehmen entsteht, und die
  -- Reservierung, die aus ihr wird. Beide nullable bis zum jeweiligen Schritt.
  booking_intent_id uuid references public.booking_intent (id) on delete set null,
  reservation_id  uuid references public.reservations (id) on delete set null,
  -- Der Zahlungslink im Konto des Betriebs (Direct Charge). Er entsteht ERST
  -- bei der Annahme und wird festgehalten, damit ein zweiter Klick des Gastes
  -- denselben Link bekommt statt eines zweiten (Wurzel 2 — sonst könnte er
  -- zweimal zahlen). Payment Link und nicht Checkout-Session, weil eine
  -- Session-URL nach 24 h verfällt und der Gast Tage Zeit hat.
  stripe_payment_link_id text,
  payment_url     text,
  -- Interne Notiz des Betriebs (steht NICHT in der Mail).
  internal_note   text,
  created_by      uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Ein Angebot führt zu GENAU EINER Reservierung. Partieller UNIQUE-Index als
-- DB-Backstop gegen doppelte Einlösung bei Webhook-Redelivery (Wurzel 2).
create unique index if not exists booking_offers_reservation_uidx
  on public.booking_offers (reservation_id)
  where reservation_id is not null;

-- Der Weg vom Webhook zurück zum Angebot läuft über die Absicht.
create unique index if not exists booking_offers_intent_uidx
  on public.booking_offers (booking_intent_id)
  where booking_intent_id is not null;

-- Listenansicht des Betriebs: neueste zuerst je Mandant.
create index if not exists booking_offers_tenant_idx
  on public.booking_offers (tenant_id, created_at desc);

-- Der Ablaufjob sucht offene Angebote, deren Frist vorbei ist.
create index if not exists booking_offers_ablauf_idx
  on public.booking_offers (expires_at)
  where status in ('draft','sent','viewed');

-- Kalender-/Objektansicht: welche Angebote laufen für dieses Objekt.
create index if not exists booking_offers_property_idx
  on public.booking_offers (property_id, check_in);

create or replace function public.booking_offers_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.booking_offers_updated_at() from anon, authenticated;

drop trigger if exists booking_offers_updated_at_trg on public.booking_offers;
create trigger booking_offers_updated_at_trg
  before update on public.booking_offers
  for each row
  execute function public.booking_offers_updated_at();

alter table public.booking_offers enable row level security;

-- WURZEL 6 — der Direktpfad ist der reale Schutz.
-- Die Zeile trägt Gastname, E-Mail, Telefon und den Preis. Lesen darf die
-- Oberfläche (der Betrieb sieht seine Angebotsliste), schreiben NUR der Server:
-- ein Client, der `status` direkt auf `paid` setzen könnte, hätte eine bezahlte
-- Buchung ohne Zahlung. `token_hash` bleibt der Oberfläche ebenfalls verwehrt —
-- ein Spalten-Revoke greift nur, wenn das Tabellen-GRANT weg ist, deshalb erst
-- alles entziehen und dann gezielt die unkritischen Spalten gewähren.
revoke all on public.booking_offers from anon, authenticated;
grant select (
  id, tenant_id, property_id, unit_id, check_in, check_out,
  adults, children, pets, guest_name, guest_email, guest_phone, language,
  currency, quote_snapshot, total_amount, deposit_amount, expires_at,
  status, sent_at, viewed_at, accepted_at, declined_at,
  booking_intent_id, reservation_id, payment_url, internal_note, created_by,
  created_at, updated_at
) on public.booking_offers to authenticated;

drop policy if exists booking_offers_tenant on public.booking_offers;
create policy booking_offers_tenant
  on public.booking_offers
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

-- Schreiben ist dem Server vorbehalten — restriktiv, damit ein später
-- versehentlich gesetztes GRANT nicht doch einen Schreibpfad öffnet.
drop policy if exists booking_offers_kein_client_schreiben on public.booking_offers;
create policy booking_offers_kein_client_schreiben
  on public.booking_offers
  as restrictive
  for all
  to anon, authenticated
  using (true)
  with check (false);

-- Eigentümer und Mitarbeiter haben mit dem Vertrieb nichts zu tun (§4.2/§4.3:
-- kein Finanz-/Vertriebseinblick). Restriktiv und fail-closed: nur admin und
-- co_admin sehen Angebote, jede andere oder fehlende Rolle sieht keine Zeile.
drop policy if exists booking_offers_nur_leitung on public.booking_offers;
create policy booking_offers_nur_leitung
  on public.booking_offers
  as restrictive
  for all
  to authenticated
  using (public.current_user_role() in ('admin','co_admin'))
  with check (false);

-- Die Angebotsliste aktualisiert sich live (Gast öffnet, nimmt an, zahlt).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booking_offers'
  ) then
    alter publication supabase_realtime add table public.booking_offers;
  end if;
end $$;

comment on table public.booking_offers is
  'Buchungsangebot (Lastenheft §2.2, 0586): Angebot per Mail mit '
  'Bestätigungslink und Zahlung. Vorstufe zur Buchungsabsicht (0409) — die '
  'Reservierung entsteht erst aus bezahlter Zahlung. Belegt KEINE Nächte.';
comment on column public.booking_offers.token_hash is
  'SHA-256 des Zugangstokens. Der Token selbst steht nur im Mail-Link — ein '
  'Leseleck darf keine fremde Annahme erlauben (Wurzel 3).';
comment on column public.booking_offers.quote_snapshot is
  'Preisaufschlüsselung des zentralen Resolvers zum Zeitpunkt des Angebots. '
  'Tatsache, nicht Neuberechnung: das Angebot gilt zum angebotenen Preis.';
comment on column public.booking_offers.status is
  'draft/sent/viewed = Gast hat noch nicht zugesagt; accepted = zugesagt, '
  'Zahlung läuft; paid = bezahlt, Reservierung steht; declined/expired/'
  'cancelled = beendet.';
comment on column public.booking_offers.deposit_amount is
  'Was der Gast jetzt zahlt (Anzahlung). Null = Gesamtbetrag fällig.';
