-- Steuern/Gebühren je Portal: eigenes Channex-Objekt pro Portal + Airbnb-Szenario
--
-- HINTERGRUND (Branchenstandard, live gemessen 03.08.2026): jedes Portal will
-- Abgaben anders. Booking.com nimmt nur prozentuale Steuern und will sie IM
-- Zimmerpreis; Airbnb will sie GETRENNT ausgewiesen und nimmt Festbeträge nur
-- „pro Gast pro Nacht"; Expedia nimmt gar nichts.
--
-- Channex führt `is_inclusive` und `logic` AN DER STEUER, nicht am Tax-Set. Ein
-- einziges Steuer-Objekt kann also nicht gleichzeitig für Airbnb exklusiv und
-- für Booking inklusiv sein — bisher wurde dieser Widerspruch nur protokolliert
-- und eine Seite still falsch bespielt. Deshalb bekommt jedes Portal sein
-- EIGENES Channex-Steuer-/Gebühren-Objekt.
--
-- Damit braucht die Mapping-Tabelle eine Portal-Achse: der Unique-Schlüssel war
-- (property_id, local_tax_id) und hätte je Objekt nur ein Objekt je Steuer
-- zugelassen.

-- NULL = das portalneutrale Objekt im Standard-Set (Kanäle ohne eigenen
-- Kanal-Plan). Sonst der Portal-Code wie in rate_plans.portal_scope.
alter table public.channex_tax_map
    add column if not exists portal_scope text;

-- `local_tax_id` trägt jetzt auch Kategorie-Schlüssel (`cat:community`): Airbnb
-- verlangt EINE Gebühr je Kategorie, mehrere gleichartige Gebühren werden dafür
-- summiert. Der Schlüssel gibt der Summe eine stabile Identität, damit der
-- nächste Sync sie aktualisiert statt sie erneut anzulegen (Wurzel 2).
comment on column public.channex_tax_map.local_tax_id is
    'Lokale Kennung des Postens: pricing.taxes[].id, pricing.fees[].id oder '
    '"cat:<airbnb-kategorie>" für eine je Kategorie summierte Airbnb-Gebühr.';
-- Stillgelegt: welches Set zu welchem Portal gehört, steht seit 0273 in
-- channex_tax_set_map. Die Spalte könnte je Posten nur EINE Set-ID tragen, und
-- seit ein Posten je Portal existiert, wäre der Wert nur noch irreführend. Wird
-- deshalb nicht mehr geschrieben; nicht gelöscht, damit kein Bestand verschwindet.
comment on column public.channex_tax_map.channex_tax_set_id is
    'STILLGELEGT — die Set-Zuordnung steht in channex_tax_set_map (0273). Wird '
    'seit 0274 nicht mehr geschrieben.';
comment on column public.channex_tax_map.portal_scope is
    'NULL = Objekt im Standard-Set; sonst Portal-Code (BookingCom, AirBNB, …). '
    'Je Portal ein eigenes Channex-Objekt, weil is_inclusive/logic an der '
    'Steuer hängen und sich je Portal unterscheiden.';

-- Alten Schlüssel ablösen. Zwei partielle Indizes, weil Postgres NULL in einem
-- UNIQUE nicht als gleich behandelt — ein einzelner Index ließe beliebig viele
-- portalneutrale Zeilen derselben Steuer zu (Wurzel 2).
alter table public.channex_tax_map
    drop constraint if exists channex_tax_map_property_id_local_tax_id_key;
drop index if exists channex_tax_map_property_local_uidx;

create unique index if not exists channex_tax_map_portal_uidx
    on public.channex_tax_map (property_id, local_tax_id, portal_scope)
    where portal_scope is not null;
create unique index if not exists channex_tax_map_standard_uidx
    on public.channex_tax_map (property_id, local_tax_id)
    where portal_scope is null;

-- --------------------------------------------------------------------------
-- Airbnb-Steuererhebungsszenario
--
-- Ob Steuern überhaupt an Airbnb gehen dürfen, entscheidet nicht der Betrieb
-- allein: Airbnb erhebt in manchen Regionen selbst. Der Standard zeigt das
-- Szenario als GELESENEN Zustand („Keine von Airbnb erhobene Steuern — Airbnb
-- erhebt oder überweist keine Steuern.") und darunter zwei Schalter:
-- „Ich bestätige, dass ich das Szenario der Steuererhebung verstehe." und
-- „Benutzungssteuern senden". Beides pro Inserat, nicht pro Konto.
--
-- Channex bietet für das Szenario KEIN Feld (live geprüft: der AirBNB-Kanal
-- deklariert nur code/email/min_stay_type/rate_plans_enabled/
-- send_email_notifications/booking_amount_settings/cohost_payout_calculations).
-- Es ist deshalb ein gepflegter Wert an der Verbindung, kein geratener.
alter table public.channex_channel_connection
    add column if not exists airbnb_tax_scenario text
        check (airbnb_tax_scenario in ('ineligible', 'no_collected', 'stacked')),
    add column if not exists airbnb_tax_acknowledged boolean not null default false,
    add column if not exists airbnb_send_user_taxes boolean not null default false;

comment on column public.channex_channel_connection.airbnb_tax_scenario is
    'Airbnb-Steuererhebungsszenario dieses Inserats: ineligible (Airbnb erhebt '
    'automatisch bzw. Beherbergungssteuern nicht unterstützt — Export '
    'unmöglich), no_collected (Airbnb erhebt nichts), stacked (Airbnb erhebt, '
    'unsere Werte kommen obendrauf). NULL = noch nicht erfasst.';
comment on column public.channex_channel_connection.airbnb_tax_acknowledged is
    'Der Betrieb hat bestätigt, das Szenario verstanden zu haben. Ohne diese '
    'Bestätigung gehen keine Steuern an Airbnb.';
comment on column public.channex_channel_connection.airbnb_send_user_taxes is
    'Eigene Steuern an Airbnb übertragen. Fail-closed: solange dies aus ist '
    'oder das Szenario ineligible/unbekannt ist, bekommt Airbnb keine Steuern.';

-- Kein zusätzliches GRANT: channex_channel_connection ist bereits über 0035
-- (RLS-Tenant-Policy) und die Härtungs-Migrationen abgedeckt; die drei Spalten
-- erben das. Geschrieben wird ausschließlich serverseitig.
