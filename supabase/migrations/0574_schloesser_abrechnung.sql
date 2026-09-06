-- 0574_schloesser_abrechnung.sql — Weiterberechnung der Schloss-Gebühr
--
-- WAS ABGERECHNET WIRD: Der Aggregator Seam kostet uns 5 USD je aktivem Gerät
-- und Monat. Diese Kosten werden an den Betrieb weitergegeben — genauso, wie es
-- die Referenz-PMS tun: Lodgify nimmt 7 USD / 6 EUR je Gerät und Monat, Smoobu
-- 4 EUR (belegt in docs/SCHLOESSER-RECHERCHE.md). Beide berechnen es
-- ausdrücklich zusätzlich zum Abo.
--
-- WARUM STÜCKZAHL UND NICHT UMSATZ: Unsere Kosten entstehen je GERÄT, nicht je
-- Buchung. Ein Betrieb mit fünf Schlössern und zwei Buchungen im Monat kostet
-- uns mehr als einer mit einem Schloss und dreißig Buchungen. Eine
-- umsatzabhängige Gebühr (wie bei „Dynamische Preise", 0,5 %) würde an der
-- Kostenseite vorbeirechnen.
--
-- WARUM EIN LEDGER UND KEIN STRIPE-BILLING-METER — dieselbe Begründung wie in
-- 0277: ein Meter ist eine währungslose Zahl. Unsere Betriebe rechnen in
-- EUR/DKK/GBP; ein Meter würde sie mit implizitem Kurs 1:1 addieren. Die
-- Währung gehört deshalb an JEDE Zeile, und der Monatslauf stellt je Währung
-- ein eigenes Invoice-Item (eine Stripe-Rechnung trägt genau eine Währung).
--
-- WARUM JE MONAT UND NICHT JE TAG: Seam rechnet monatlich je „managed device".
-- Ein tagesgenauer Anteil wäre genauer als unsere Kostenseite und damit eine
-- Scheingenauigkeit. Ein Gerät, das im Monat auch nur einen Tag verwaltet
-- wurde, kostet uns den Monatspreis — also berechnen wir den Monat.

-- =========================================================================
-- Der Ledger: eine Zeile je Gerät und Monat
-- =========================================================================
create table if not exists public.schloesser_ledger (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null
                     references public.tenants(id) on delete cascade,
    -- Das Gerät. `on delete set null`, NICHT cascade: eine bereits erfasste
    -- Gebühr darf nicht verschwinden, weil der Betrieb sein Schloss später
    -- entfernt — sonst fehlt sie im Monatslauf und wir tragen die Kosten
    -- (Wurzel 1: der Gegenzustand ist „Zeile bleibt", nicht „Zeile weg").
    device_id      uuid references public.seam_device(id) on delete set null,
    -- Redundant zur Referenz, aber bewusst: nach dem Löschen des Geräts ist
    -- das die einzige Spur, WELCHES Gerät gemeint war.
    seam_device_id text not null,
    -- Der Abrechnungsmonat als erster Tag (2026-09-01). Ein `date` statt
    -- text/int-Paar, damit sich Zeiträume ohne Zerlegen vergleichen lassen.
    monat          date not null,
    -- Preis und Währung als TATSACHE dieser Zeile, nicht als Verweis auf eine
    -- Konfiguration: ändert sich der Preis später, bleibt die alte Zeile
    -- richtig. Genau der Grund, warum `commission_ledger` seine Rate
    -- mitschreibt.
    betrag         numeric(12,2) not null check (betrag >= 0),
    currency       text not null check (char_length(currency) = 3),
    -- pending   = erfasst, noch nicht fakturiert
    -- invoiced  = als Stripe-Invoice-Item gestellt
    -- cancelled = zurückgenommen (Gerät war doch nicht verwaltet)
    status         text not null default 'pending'
                     check (status in ('pending', 'invoiced', 'cancelled')),
    stripe_invoice_item_id text,
    invoiced_at    timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    -- DER IDEMPOTENZ-BACKSTOP (Wurzel 2): ein Gerät kostet je Monat GENAU
    -- einmal. Der Monatslauf, ein Retry und ein zweiter Worker erzeugen
    -- zusammen eine Zeile, nicht drei. Ohne diese Bedingung würde ein
    -- wiederholter Lauf den Betrieb doppelt belasten — ein Fehler, der beim
    -- Kunden auf der Rechnung landet, bevor ihn jemand im Log sieht.
    unique (seam_device_id, monat)
);

create index if not exists schloesser_ledger_tenant_idx
    on public.schloesser_ledger (tenant_id, monat);
-- Für den Monatslauf: welche Zeilen sind noch offen?
create index if not exists schloesser_ledger_offen_idx
    on public.schloesser_ledger (monat)
    where status = 'pending';

create trigger trg_schloesser_ledger_updated
    before update on public.schloesser_ledger
    for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS + Grant-Entzug (Wurzel 6)
-- =========================================================================
-- FINANZDATEN. Der Grant-Entzug ist hier nicht Vorsicht, sondern Pflicht: die
-- Projektregel nennt Finanztabellen (payments, commissions, owner_statements)
-- ausdrücklich als das, was nur die service_role sehen darf. Ein eingeloggter
-- cleaner darf per `curl /rest/v1/schloesser_ledger` weder lesen noch
-- schreiben — und ein Realtime-Abo darauf wäre ebenfalls falsch (dort ist das
-- Abo der Fehler, nicht der fehlende Grant).
alter table public.schloesser_ledger enable row level security;

drop policy if exists schloesser_ledger_tenant on public.schloesser_ledger;
create policy schloesser_ledger_tenant on public.schloesser_ledger
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke all on public.schloesser_ledger from anon, authenticated;

drop policy if exists schloesser_ledger_kein_direktzugriff
    on public.schloesser_ledger;
create policy schloesser_ledger_kein_direktzugriff
    on public.schloesser_ledger
    as restrictive for all using (false) with check (false);

comment on table public.schloesser_ledger is
    'Weiterberechnung der Schloss-Gebuehr je Geraet und Monat (0574). '
    'Finanzdaten: nur service_role, NIE per anon-Key erreichbar.';

comment on column public.schloesser_ledger.betrag is
    'Preis als TATSACHE dieser Zeile. Eine spaetere Preisaenderung veraendert '
    'alte Zeilen NICHT — sonst wuerde eine gestellte Rechnung nachtraeglich '
    'falsch.';

comment on constraint schloesser_ledger_seam_device_id_monat_key
    on public.schloesser_ledger is
    'Ein Geraet kostet je Monat genau einmal (Wurzel 2). Ohne diese Bedingung '
    'belastet ein wiederholter Monatslauf den Betrieb doppelt.';
