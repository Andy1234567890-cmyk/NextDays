-- 0469_nachberechnung_zahlungslinks.sql — Nachberechnung einer WEBSITE-Buchung
-- per Stripe-Zahlungslink kassieren
--
-- ANLASS (live, 25.08.2026): Eine Buchung über die Website des Betriebs
-- („FeWo Vidstrup Have", 23.–28.10.2026) wurde manuell verlängert. Der
-- Zeitraum-Move mit `reprice=True` hob `total_amount` an, aber es gab keinen
-- Weg, die Differenz beim Gast einzuziehen: Der Datensatz kam per Import aus
-- Lodgify, hat also KEINEN Stripe-Customer und keine gespeicherte Karte —
-- `charge_due_balance` (payments/service.py) kann off-session nichts belasten.
-- Der einzige vorhandene Link-Weg (0386) kassiert ausschließlich
-- Zusatzleistungen (`reservation_addons`); eine Nachberechnung der Buchung
-- selbst ist keine Zusatzleistung und darf nicht als solche verbucht werden
-- (sie gehört in Rechnung und Eigentümer-Abrechnung an eine andere Zeile).
--
-- GELDFLUSS — wie 0386: **Direct Charge im verbundenen Konto** des Betriebs
-- (Stripe-Account-Header). Der Charge gehört ihm, das Geld landet auf seinem
-- Saldo, sein Name steht auf der Kartenabrechnung.
--   ABER: Der Plattform-Anteil ist hier **0**. `channel='website'` ist laut
--   0380 ausdrücklich provisionsfrei („Eine Buchung über die eigene Website des
--   Betriebs läuft nicht über uns und trägt deshalb keine Provision"), und
--   `payments/service._platform_fee_bps` gibt für alles außer `portal` 0 zurück.
--   Der 5-%-Satz `tenants.addon_fee_bps` gilt für Zusatzleistungen und DARF
--   hier nicht herangezogen werden — das wäre eine Falschabrechnung zulasten
--   der Kundin. Die Spalten `application_fee_cents`/`fee_bps` bleiben trotzdem
--   am Beleg: der historische Satz muss ablesbar sein, auch wenn er 0 ist.
--
-- WARUM EIGENE TABELLE UND NICHT `addon_payment_links` ERWEITERN:
-- Deren Positionen zeigen per Fremdschlüssel auf `reservation_addons`
-- (`addon_payment_link_items`). Eine Nachberechnung hat keine solche Position —
-- sie ist ein Betrag mit Grund an der Buchung. Ein `zweck`-Diskriminator plus
-- optional leere Positionsliste hätte den Webhook-Pfad von 0386 mehrdeutig
-- gemacht (welche Zeilen auf `paid` setzen?) und den partiellen Unique-Index
-- „ein offener Link je Buchung" über zwei Zwecke gespannt: eine offene
-- Zusatzleistung hätte dann die Nachberechnung blockiert und umgekehrt.
-- Zwei Zwecke, zwei Tabellen — aber DERSELBE Stripe-Helfer
-- (`payments/stripe_client.create_payment_link`) und dasselbe
-- Sicherheitsmuster, damit keine dritte Variante entsteht.
--
-- IDEMPOTENZ (Wurzel 2): partieller Unique-Index → höchstens EIN offener Link
-- je Buchung; Unique auf Stripe-Link-ID und Checkout-Session (Webhook-
-- Redelivery); am Link selbst hängt in Stripe
-- `restrictions.completed_sessions.limit = 1`.
--
-- SICHERHEIT (Wurzel 6): Finanzdaten. Pauschale GRANTs entziehen + tenant-
-- Policy UND restriktive Policy `for all` (nicht nur `for select`, sonst wäre
-- der Schreibpfad tenant-weit offen). Nur `service_role` spricht diese Tabelle;
-- ein eingeloggter cleaner bekommt per anon-Key-`curl` auf
-- `/rest/v1/reservation_charge_links` weder Beträge noch Zahl-URLs.
--
-- REALTIME: bewusst KEINE Publikations-Mitgliedschaft (ohne `select` für
-- `authenticated` wäre das Abo eine stumme Attrappe). Die Oberfläche hört auf
-- `reservations` — `paid_amount` ändert sich, sobald die Nachberechnung
-- eingeht, und genau das ist das sichtbare Ereignis.

-- ============================================================================
-- 1. Zahlungsart „surcharge" im payments-Enum
-- ============================================================================
-- Eine Nachberechnung ist weder Anzahlung ('down_payment') noch Restzahlung
-- ('balance') noch Zusatzleistung ('addon'). Ohne eigenen Typ liefe sie als
-- 'full' und wiese die Buchung als vollständig bezahlt aus (Falschaussage in
-- Rechnung und Zeitleiste) — dieselbe Begründung wie bei 'addon' in 0386.
alter type public.payment_type add value if not exists 'surcharge';

-- ============================================================================
-- 2. Geplante Restzahlung darf ENTFALLEN
-- ============================================================================
-- `payments.scheduled_status` (0166) kannte nur scheduled/charging/done/failed/
-- needs_action. Für eine geplante Restzahlung, die durch eine bezahlte
-- Nachberechnung ODER durch einen Reprice gegenstandslos wird, fehlte der
-- ehrliche Zustand: 'done' wäre eine Lüge (es wurde nie eine Karte belastet),
-- 'failed' auch (nichts ist abgelehnt worden), und die Zeile auf 'scheduled'
-- stehen zu lassen heißt, dass der stündliche Worker-Tick
-- (`due_balance_payment_ids` liest genau diesen Status) sie später NOCH EINMAL
-- einzieht — der Gast zahlt doppelt (Wurzel 1: der Gegenzustand zur
-- Betragsänderung muss mitgepflegt werden).
alter table public.payments
    drop constraint if exists payments_scheduled_status_check;
alter table public.payments
    add constraint payments_scheduled_status_check
        check (scheduled_status is null or scheduled_status in
               ('scheduled', 'charging', 'done', 'failed', 'needs_action',
                'cancelled'));

comment on column public.payments.scheduled_status is
  'Zustand einer geplanten Zahlung: scheduled = wartet auf Faelligkeit; '
  'charging = Worker belastet gerade; done = belastet; failed = abgelehnt; '
  'needs_action = 3DS noetig; cancelled = entfallen (Betrag anderweitig '
  'beglichen oder Buchungsbetrag geaendert) — wird nie mehr eingezogen.';

-- ============================================================================
-- 3. Zahlungslinks für Nachberechnungen
-- ============================================================================
create table if not exists public.reservation_charge_links (
    id                     uuid primary key default gen_random_uuid(),
    tenant_id              uuid not null
                             references public.tenants (id) on delete cascade,
    reservation_id         uuid not null
                             references public.reservations (id) on delete cascade,
    -- Verbundenes Konto, in dem der Link entstanden ist. Festgehalten, weil
    -- Abruf und Deaktivierung denselben Stripe-Account-Header brauchen — der
    -- Betrieb könnte sein Konto zwischenzeitlich gewechselt haben.
    stripe_account_id      text not null,
    stripe_payment_link_id text not null,
    stripe_price_id        text not null,
    stripe_product_id      text not null,
    url                    text not null,
    -- Währung kommt aus der Buchung (Wurzel 4) — nie ein EUR-Ersatzwert.
    currency               text not null,
    amount_cents           bigint not null check (amount_cents > 0),
    -- Warum nachberechnet wird. PFLICHT: Ein Betrag, den ein Gast nachträglich
    -- zahlen soll, muss begründet sein — er landet in Rechnung, Zeitleiste und
    -- (über die Mail) beim Gast. Freitext statt Enum, weil die realen Gründe
    -- (Verlängerung, Zusatzgast, Schaden, Vertragsänderung) nicht abschließend
    -- aufzählbar sind; eine Enum hätte beim ersten unpassenden Fall ein
    -- „sonstiges" erzwungen und die Auskunft entwertet (wie 0397).
    grund                  text not null
                             check (char_length(btrim(grund)) between 3 and 500),
    -- `total_amount` der Buchung im Moment der Erstellung. Damit ist erkennbar,
    -- ob der Betrag seither erneut geändert wurde (weiterer Move/Reprice) und
    -- der offene Link auf einen veralteten Stand lautet (Wurzel 1).
    basis_total_amount     numeric(12, 2) not null check (basis_total_amount >= 0),
    -- Plattform-Anteil. Bei channel='website' immer 0 (s. Kopf); die Spalte
    -- bleibt, damit der historische Satz am Beleg steht.
    application_fee_cents  bigint not null default 0
                             check (application_fee_cents >= 0),
    fee_bps                integer not null default 0
                             check (fee_bps between 0 and 10000),
    status                 text not null default 'open'
                             check (status in ('open', 'paid', 'cancelled')),
    checkout_session_id    text,
    payment_intent_id      text,
    paid_at                timestamptz,
    created_at             timestamptz not null default now(),
    created_by             uuid references public.users (id) on delete set null,
    constraint reservation_charge_links_fee_kleiner_betrag
        check (application_fee_cents <= amount_cents)
);

-- Höchstens EIN offener Link je Buchung (Wurzel 2): Der zweite Klick auf
-- „Zahlungslink erstellen" findet den vorhandenen und gibt ihn zurück, statt
-- eine zweite bezahlbare URL in Umlauf zu bringen.
create unique index if not exists reservation_charge_links_offen_uidx
    on public.reservation_charge_links (reservation_id)
    where status = 'open';
create unique index if not exists reservation_charge_links_stripe_uidx
    on public.reservation_charge_links (stripe_payment_link_id);
-- Eine Checkout-Session darf nur einen Link bezahlen (Webhook-Redelivery).
create unique index if not exists reservation_charge_links_session_uidx
    on public.reservation_charge_links (checkout_session_id)
    where checkout_session_id is not null;
create index if not exists reservation_charge_links_tenant_idx
    on public.reservation_charge_links (tenant_id, created_at desc);
create index if not exists reservation_charge_links_reservation_idx
    on public.reservation_charge_links (reservation_id);

comment on table public.reservation_charge_links is
  'Stripe Payment Link je Buchung, mit dem der Gast eine NACHBERECHNUNG '
  '(z. B. nach manueller Verlaengerung) bezahlt. Nur fuer eigene '
  'Website-Buchungen (channel=''website''), Direct Charge im verbundenen Konto '
  'des Betriebs, provisionsfrei (0380). Sensibel (Wurzel 6): nur service_role.';

comment on column public.reservation_charge_links.basis_total_amount is
  'total_amount der Buchung bei Erstellung des Links — erkennt, ob der Betrag '
  'seither erneut geaendert wurde (Wurzel 1).';

-- ============================================================================
-- 4. RLS + Direktpfad schließen (Wurzel 6)
-- ============================================================================
alter table public.reservation_charge_links enable row level security;

revoke all on public.reservation_charge_links from anon, authenticated;

drop policy if exists reservation_charge_links_tenant
    on public.reservation_charge_links;
create policy reservation_charge_links_tenant
    on public.reservation_charge_links
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists reservation_charge_links_tenant_restrict
    on public.reservation_charge_links;
create policy reservation_charge_links_tenant_restrict
    on public.reservation_charge_links
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
