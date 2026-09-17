-- Buchungsberechtigungen — wer darf bei mir SOFORT buchen (Airbnb-Modell).
--
-- QUELLE. Airbnb führt das als EIN Feld am Inserat:
-- `instant_booking_allowed_category` mit fünf Werten (Airbnbs eigene API, von
-- uns live gegen Konto AirSmil gemessen, siehe `airbnb_direkt.booking_settings`
-- und `docs/OTA/Airbnb/Booking Settings Airbnb.pdf`):
--
--     off                                          jede Buchung ist eine Anfrage
--     everyone                                     alle dürfen sofort buchen
--     guests_with_verified_identity                nur mit geprüfter Identität
--     well_reviewed_guests                         nur mit guter Vorgeschichte
--     well_reviewed_guests_with_verified_identity  beides
--
-- Bestätigt in Airbnbs Hilfe (Artikel 484 · 1170 · 1237 und „Deciding how
-- you'll confirm reservations", abgerufen 17.09.2026). Zwei Punkte daraus sind
-- für den Bau entscheidend:
--
--   1. Wer die Voraussetzung NICHT erfüllt, wird nicht abgewiesen — er kann
--      weiterhin ANFRAGEN. Die Voraussetzung stuft von Sofortbuchung auf
--      Anfrage herunter. (Das ist der Unterschied zu `blocked_guests`, wo
--      wirklich gesperrt wird.)
--   2. Grundvoraussetzungen für ALLE Gäste (Name, E-Mail, bestätigte
--      Telefonnummer, Zahlungsmittel, Hausregeln) sind Plattform-Sache und
--      kein Schalter des Gastgebers.
--
-- WAS UNS BISHER FEHLTE. `properties.booking_mode` (0184) kennt nur
-- `instant`/`request`. Im Import steht seit jeher der Eigenbefund dazu:
-- „Alle anderen Werte erlauben Sofortbuchung — für WEN, kann unser Modell
-- nicht ausdrücken". Ein aus Airbnb importiertes Inserat mit
-- `well_reviewed_guests` wurde bei uns zu „alle dürfen sofort buchen" — die
-- Einschränkung des Gastgebers ging beim Import still verloren. Diese
-- Migration schließt genau das.

-- ---------------------------------------------------------------------------
-- Teil 1 — für WEN die Sofortbuchung gilt
-- ---------------------------------------------------------------------------
-- Vier Werte, nicht fünf: Airbnbs `off` ist bei uns `booking_mode='request'`
-- und bleibt dort. Zwei getrennte Spalten statt einer fünfwertigen, weil
-- `booking_mode` bereits in Buchungsstrecke, Kanalmanager und Website hängt —
-- ein Umbau dieser Spalte wäre ein Eingriff in alle drei, ohne dass er etwas
-- ausdrücken würde, was diese Spalte hier nicht ausdrückt. Die Zielgruppe ist
-- bedeutungslos, solange `booking_mode='request'` steht; genau so verhält sich
-- Airbnb auch (die Voraussetzungen bleiben stehen, wenn man Sofortbuchung
-- abschaltet, und gelten wieder, sobald man sie einschaltet).
do $$
begin
    if not exists (
        select 1 from pg_type where typname = 'instant_booking_audience'
    ) then
        create type public.instant_booking_audience as enum (
            'everyone',
            'guests_with_verified_identity',
            'well_reviewed_guests',
            'well_reviewed_guests_with_verified_identity'
        );
    end if;
end $$;

alter table public.properties
    add column if not exists instant_booking_audience
        public.instant_booking_audience not null default 'everyone';

comment on column public.properties.instant_booking_audience is
    'Für WEN die Sofortbuchung gilt (Airbnb instant_booking_allowed_category '
    'ohne den Wert „off" — der ist booking_mode=request). Bedeutungslos, '
    'solange booking_mode=request steht. Wer die Voraussetzung nicht erfüllt, '
    'wird NICHT abgewiesen, sondern auf eine Anfrage heruntergestuft.';

-- ---------------------------------------------------------------------------
-- Teil 2 — die Entscheidung des Betriebs
-- ---------------------------------------------------------------------------
-- Airbnb stellt das je Inserat ein. Ein Betrieb mit 40 Objekten will es aber
-- einmal entscheiden, nicht vierzigmal — dieselbe Überlegung wie beim
-- Suchmaschinen-Schalter (0714). Der Betriebswert ist die Vorgabe und die
-- Vorlage für neue Objekte; die Objektspalte bleibt maßgeblich für die
-- einzelne Buchung.
alter table public.tenants
    add column if not exists booking_mode public.property_booking_mode
        not null default 'instant',
    add column if not exists instant_booking_audience
        public.instant_booking_audience not null default 'everyone';

comment on column public.tenants.booking_mode is
    'Vorgabe des Betriebs: Sofortbuchung oder Anfrage. Quelle für den '
    'Konto-Schalter „Buchungsberechtigungen"; properties.booking_mode bleibt '
    'maßgeblich für die einzelne Buchung.';
comment on column public.tenants.instant_booking_audience is
    'Vorgabe des Betriebs, für wen die Sofortbuchung gilt.';

-- Bestand aus dem heutigen Zustand übernehmen, NICHT auf den Default setzen:
-- ein Betrieb, der heute jede Buchung prüft, darf durch diese Migration nicht
-- plötzlich Sofortbuchungen bekommen. „Anfrage" nur, wenn ALLE seine Objekte
-- so stehen — sonst ist „Sofortbuchung" der ehrlichere Sammelwert, und die
-- Oberfläche weist abweichende Objekte gesondert aus.
update public.tenants t
   set booking_mode = 'request'
 where exists (select 1 from public.properties p where p.tenant_id = t.id)
   and not exists (
       select 1 from public.properties p
        where p.tenant_id = t.id and p.booking_mode <> 'request'
   );

-- ---------------------------------------------------------------------------
-- Teil 3 — ein neues Objekt erbt die Zielgruppe
-- ---------------------------------------------------------------------------
-- NUR die Zielgruppe, NICHT den Buchungsmodus. Der Unterschied hat einen
-- Grund: nach dem Modus wird beim Anlegen ausdrücklich gefragt (Objekt-
-- Assistent, Schritt „Wie möchtest du Buchungen annehmen?"), und ein Trigger,
-- der eine eben getroffene Wahl überschreibt, ist schlimmer als gar keiner.
-- Für die Zielgruppe gibt es keine solche Frage — ohne Vererbung käme jedes
-- neue Objekt auf „alle" herein, obwohl der Betrieb etwas anderes entschieden
-- hat (Wurzel 1: die Aktion „Objekt anlegen" muss den Gegenzustand mitpflegen).
create or replace function public.properties_buchungszielgruppe_erben()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    vorgabe public.instant_booking_audience;
begin
    select t.instant_booking_audience
      into vorgabe
      from public.tenants t
     where t.id = new.tenant_id;
    -- Kein Betrieb gefunden (dürfte nicht vorkommen): nichts erfinden, der
    -- Spalten-Default gilt weiter.
    if vorgabe is not null then
        new.instant_booking_audience := vorgabe;
    end if;
    return new;
end;
$$;

comment on function public.properties_buchungszielgruppe_erben() is
    'Ein neues Objekt übernimmt die Buchungs-Zielgruppe seines Betriebs '
    '(tenants.instant_booking_audience). Der Buchungsmodus wird bewusst NICHT '
    'vererbt — nach ihm fragt der Objekt-Assistent ausdrücklich.';

revoke execute on function public.properties_buchungszielgruppe_erben()
    from anon, authenticated;

drop trigger if exists properties_buchungszielgruppe_erben on public.properties;
create trigger properties_buchungszielgruppe_erben
    before insert on public.properties
    for each row execute function public.properties_buchungszielgruppe_erben();

-- ---------------------------------------------------------------------------
-- Teil 4 — Identitätsprüfung für Marktplatz-Gäste
-- ---------------------------------------------------------------------------
-- Ohne sie wäre `guests_with_verified_identity` ein Schalter, den kein Gast je
-- erfüllen kann: `portal_guests` trug bisher nur Name, E-Mail und eine
-- UNBESTÄTIGTE Telefonnummer. Ein Gastgeber, der ihn einschaltet, bekäme
-- schlicht keine Sofortbuchungen mehr und wüsste nicht warum.
--
-- `guest_identity_documents` ist dafür KEINE Quelle, auch wenn der Name danach
-- klingt: dort steht der Meldeschein-Beleg, den EIN Betrieb erfasst hat
-- (tenant-gebunden, Nummer und Ausstellungsland). Das ist eine Angabe des
-- Betriebs über seinen Gast, keine geprüfte Identität — und sie über
-- Betriebsgrenzen hinweg zu lesen wäre zugleich ein Bruch der Mandantentrennung.
--
-- Gebaut wird deshalb dasselbe wie für Gastgeber (Stripe Identity, Ausweis +
-- Selfie-Abgleich, 0188/0715): Status, Sitzungs-Kennung, Zeitpunkt der Prüfung
-- und Zeitpunkt des Ereignisses. KEINE Ausweisdaten — nur der Status
-- (DSGVO/DE), genau wie bei den Gastgebern.
alter table public.portal_guests
    add column if not exists identity_status text not null default 'unverified'
        check (identity_status in
            ('unverified', 'processing', 'requires_input', 'verified')),
    add column if not exists identity_session_id text,
    add column if not exists identity_verified_at timestamptz,
    add column if not exists identity_event_at timestamptz;

comment on column public.portal_guests.identity_status is
    'Stripe-Identity-Status des Gastes (Ausweis + Selfie). Nie hartkodiert '
    'anzeigen — „verified" ist der EINZIGE Wert, der als geprüft gilt.';
comment on column public.portal_guests.identity_event_at is
    'Zeitpunkt des Stripe-Ereignisses, das identity_status gesetzt hat '
    '(event.created, NICHT unsere Uhr). Ein später eintreffendes, aber '
    'älteres Ereignis wird daran erkannt und verworfen — Stripe garantiert '
    'keine Zustellreihenfolge (Wurzel 2/5b, gelernt am 17.09.2026 an den '
    'Gastgebern: dort überschrieb ein nachgereichtes „processing" ein bereits '
    'verarbeitetes „verified").';

-- Rückmapping des Webhooks: Sitzung → Gast. Ohne Index ein Full Scan je
-- Ereignis.
create index if not exists portal_guests_identity_session_idx
    on public.portal_guests (identity_session_id)
    where identity_session_id is not null;

-- Härtung (Wurzel 6). `portal_guests` trägt RLS seit 0008 (eigene Zeile über
-- auth.uid()). Die neuen Spalten dürfen NICHT vom Gast selbst geschrieben
-- werden — sonst setzt sich jeder per anon-Key-`curl` auf „verified" und die
-- Voraussetzung des Gastgebers ist wertlos. Ein pauschaler Entzug des
-- Tabellen-GRANTs scheidet aus (der Gast pflegt Name, Telefon und
-- Einstellungen selbst), deshalb spaltenweise.
revoke update (
    identity_status,
    identity_session_id,
    identity_verified_at,
    identity_event_at
) on public.portal_guests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Teil 5 — „gute Vorgeschichte" braucht keinen neuen Speicher
-- ---------------------------------------------------------------------------
-- Airbnb: „completed at least one stay and haven't received any negative
-- reviews". Beides steht bereits da — abgeschlossene Aufenthalte in
-- `reservations`, die Bewertung des Gastes DURCH den Gastgeber in
-- `guest_reviews_by_host` (0465). Zu prüfen ist über alle Betriebe hinweg,
-- denn eine Vorgeschichte ist nicht auf einen Betrieb beschränkt; gelesen wird
-- ausschließlich serverseitig (service_role), nie vom Client.
--
-- Der Index bedient genau diese Frage: „hat diese Adresse eine
-- veröffentlichte Bewertung, und wie lautet sie".
create index if not exists guest_reviews_by_host_email_idx
    on public.guest_reviews_by_host (lower(guest_email))
    where published_at is not null;
