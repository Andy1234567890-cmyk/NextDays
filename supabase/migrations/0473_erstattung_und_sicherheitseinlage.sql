-- ============================================================================
-- 0473 — Erstattung von Zusatzleistungen/Nachberechnungen + Sicherheitseinlage
-- ----------------------------------------------------------------------------
-- ANLASS (25.08.2026, live): Buchung 6179a5d0 (Robin McCartney, Booking.com,
-- 25.–28.08.2026) wurde vom Portal storniert. Der Gast hatte die Zusatzleistung
-- „Wäschepaket" (150,00 DKK) per Stripe-Zahlungslink bezahlt — Session
-- cs_live_a1XG2v… `paid`, PaymentIntent pi_3U6YJC… `succeeded`, Geld im
-- Verbundkonto acct_1U19sh… . Bei UNS stand der Link auf `open`, die Position
-- auf `pending`, ein payments-Beleg existierte nicht.
--
-- Drei Lücken standen dahinter, diese Migration schafft die Datenbasis für alle
-- drei:
--
-- 1. ES GAB KEINEN ERSTATTUNGSWEG. `refund_for_cancellation` filtert
--    `type in (full, down_payment, balance)`; `addon`/`surcharge` fielen heraus.
--    `refund_payment` hätte es auch nicht gekonnt: `gateway_ref` eines
--    Addon-Belegs ist die CHECKOUT-SESSION (`cs_…`), `sc.refund` erwartet einen
--    PaymentIntent, und `_direct_acct` liefert bei einer OTA-/Portal-Buchung
--    `None` — der Refund wäre im Plattformkonto gelaufen, wo der Charge nicht
--    liegt. Der Code sagte dem Nutzer bereits „Bitte den Betrag erstatten"
--    (addons/service.py::_bezahlt_fehler), ohne dass es diesen Weg gab: exakt
--    die Sackgasse von 0397, eine Ebene höher.
--
-- 2. DER GEGENZUSTAND FEHLTE (Wurzel 1). `cancel()` schließt seit 0469 den
--    Nachberechnungs-Link, den Addon-Link nicht — `ziehe_link_zurueck_bei_storno`
--    gibt es nur für das Storno EINER Position. Hier kam der Storno ohnehin über
--    den OTA-Import, der `cancel()` nie aufruft.
--
-- 3. DAS GELD WAR SCHON WEG. Auszahlung des Verbundkontos: `daily`,
--    `delay_days 7`, `available` 0 DKK. `controller.losses.payments` steht auf
--    `application` — ein Minus auf dem Verbundkonto ist UNSER Verlust, nicht der
--    des Betriebs. `debit_negative_balances` ist `false`, Stripe holt einen
--    Fehlbetrag also nicht von seiner Bank. Die Karenz aus 0411 greift nicht:
--    sie sitzt im Marktplatz-Auszahlungslauf vom PLATTFORM-Saldo, während
--    Zusatzleistungen Direct Charges sind, die Stripe nach dem Rhythmus des
--    Verbundkontos auszahlt — an unserem Lauf vorbei.
--
-- ENTSCHEIDUNGEN DES NUTZERS (25.08.2026), die hier Struktur werden:
--   * Der Gast bekommt IMMER 100 % dessen, was er gezahlt hat. Kein Abzug
--     unserer Provision von seiner Erstattung.
--   * Die Provision bleibt bei uns (`refund_application_fee` NICHT gesetzt) —
--     sonst zahlt die Plattform bei jedem Storno zu. Der Betrieb trägt damit die
--     Provision einer erstatteten Leistung; das ist die getroffene Wahl.
--   * Der vollständige Betrag wird aus dem VERBUNDKONTO erstattet.
--   * Für solche Fälle muss immer eine Deckung da sein → Sicherheitseinlage.
--
-- WARUM KEIN NEUER STATUS `refunded` AUF reservation_addons:
-- Sechs Umsatzleser entscheiden über `status == 'cancelled'` und zählen alles
-- andere als Umsatz (owner_statements, owner_reporting, public_portal,
-- guests 2×, reservation_invoice). Ein neuer Endzustand wäre in allen sechs
-- still als Erlös durchgelaufen — der Klassiker aus Wurzel 1. Eine erstattete
-- Position wird deshalb `cancelled` (sie fällt überall dort korrekt heraus, wo
-- sie herausfallen muss) und trägt die Erstattung als eigene Spalten. Der
-- CHECK `..._refund_nur_storniert` macht diese Invariante unumgehbar.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. reservation_addons — Erstattung am Beleg
-- ---------------------------------------------------------------------------
alter table public.reservation_addons
  add column if not exists refunded_cents bigint not null default 0,
  add column if not exists refunded_at    timestamptz,
  add column if not exists refund_reason  text,
  add column if not exists refunded_by    uuid references public.users(id) on delete set null;

comment on column public.reservation_addons.refunded_cents is
  'Tatsächlich an den Gast zurückgezahlter Betrag in Cent (Wahrheit ist Stripe; '
  'diese Spalte ist der Spiegel für Anzeige und Abrechnung). 0 = nichts erstattet.';
comment on column public.reservation_addons.refund_reason is
  'Pflicht-Grund der Erstattung, wie bei 0397 der Storno-Grund. Freitext über '
  'Geld — in der Zeitleiste betragsmaskiert (_MONEY_REASON_KINDS).';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_addons'::regclass
      and conname = 'reservation_addons_refund_reason_check'
  ) then
    alter table public.reservation_addons
      add constraint reservation_addons_refund_reason_check
        check (
          refund_reason is null
          or (char_length(btrim(refund_reason)) >= 3
              and char_length(btrim(refund_reason)) <= 500)
        );
  end if;

  -- Zeitpunkt und Grund gehören zusammen. Ohne diesen Paar-CHECK entsteht der
  -- Zustand „erstattet, aber niemand weiß warum" bzw. umgekehrt ein Grund ohne
  -- Vorgang — beides erklärt später keinen Geldabfluss (0397, gleiche Logik).
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_addons'::regclass
      and conname = 'reservation_addons_refund_paar'
  ) then
    alter table public.reservation_addons
      add constraint reservation_addons_refund_paar
        check ((refunded_at is null) = (refund_reason is null));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_addons'::regclass
      and conname = 'reservation_addons_refund_betrag'
  ) then
    alter table public.reservation_addons
      add constraint reservation_addons_refund_betrag
        check (refunded_cents >= 0);
  end if;

  -- DIE tragende Invariante (s. Kopfkommentar): Wer erstattet hat, hat die
  -- Position auch aus dem Umsatz genommen. Ohne diesen CHECK stünde eine
  -- erstattete Zeile weiter auf `paid` und wäre in Rechnung,
  -- Eigentümer-Abrechnung und Gast-Portal als Erlös gezählt.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_addons'::regclass
      and conname = 'reservation_addons_refund_nur_storniert'
  ) then
    alter table public.reservation_addons
      add constraint reservation_addons_refund_nur_storniert
        check (refunded_at is null or status = 'cancelled');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. addon_payment_links — Erstattungsstand des Zahlungslinks
-- ---------------------------------------------------------------------------
alter table public.addon_payment_links
  add column if not exists refunded_cents bigint not null default 0,
  add column if not exists refunded_at    timestamptz;

alter table public.addon_payment_links
  drop constraint if exists addon_payment_links_status_check;
alter table public.addon_payment_links
  add constraint addon_payment_links_status_check
    check (status in ('open', 'paid', 'cancelled', 'refunded', 'partially_refunded'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.addon_payment_links'::regclass
      and conname = 'addon_payment_links_refund_max'
  ) then
    alter table public.addon_payment_links
      add constraint addon_payment_links_refund_max
        check (refunded_cents >= 0 and refunded_cents <= amount_cents);
  end if;

  -- Betrag und Status dürfen nicht auseinanderlaufen: ein Link, der laut Status
  -- „erstattet" ist, aber 0 erstattete Cent führt, ist eine Falschauskunft über
  -- Geld. Ein Link deckt mehrere Positionen (addon_payment_link_items) — wird
  -- nur eine davon erstattet, ist `partially_refunded` der richtige Zustand.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.addon_payment_links'::regclass
      and conname = 'addon_payment_links_refund_status'
  ) then
    alter table public.addon_payment_links
      add constraint addon_payment_links_refund_status
        check (
          (refunded_cents = 0
             and status not in ('refunded', 'partially_refunded'))
          or (refunded_cents > 0 and refunded_cents < amount_cents
             and status = 'partially_refunded')
          or (refunded_cents = amount_cents and status = 'refunded')
        );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.addon_payment_links'::regclass
      and conname = 'addon_payment_links_refund_paar'
  ) then
    alter table public.addon_payment_links
      add constraint addon_payment_links_refund_paar
        check ((refunded_at is null) = (refunded_cents = 0));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. reservation_charge_links — dasselbe für die Nachberechnung (0469)
-- ---------------------------------------------------------------------------
-- Die Lücke ist dort identisch: ein per Karte bezahlter Nachberechnungs-Link
-- war ebenso unerstattbar. Ein Link trägt genau EINEN Betrag (keine
-- Positionen), deshalb gibt es hier nur „ganz oder gar nicht" — aber
-- `partially_refunded` bleibt im CHECK, damit eine Teilkulanz später nicht
-- wieder eine Migration braucht.
alter table public.reservation_charge_links
  add column if not exists refunded_cents bigint not null default 0,
  add column if not exists refunded_at    timestamptz,
  add column if not exists refund_reason  text,
  add column if not exists refunded_by    uuid references public.users(id) on delete set null;

alter table public.reservation_charge_links
  drop constraint if exists reservation_charge_links_status_check;
alter table public.reservation_charge_links
  add constraint reservation_charge_links_status_check
    check (status in ('open', 'paid', 'cancelled', 'refunded', 'partially_refunded'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_charge_links'::regclass
      and conname = 'reservation_charge_links_refund_reason_check'
  ) then
    alter table public.reservation_charge_links
      add constraint reservation_charge_links_refund_reason_check
        check (
          refund_reason is null
          or (char_length(btrim(refund_reason)) >= 3
              and char_length(btrim(refund_reason)) <= 500)
        );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_charge_links'::regclass
      and conname = 'reservation_charge_links_refund_paar'
  ) then
    alter table public.reservation_charge_links
      add constraint reservation_charge_links_refund_paar
        check ((refunded_at is null) = (refund_reason is null));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_charge_links'::regclass
      and conname = 'reservation_charge_links_refund_max'
  ) then
    alter table public.reservation_charge_links
      add constraint reservation_charge_links_refund_max
        check (refunded_cents >= 0 and refunded_cents <= amount_cents);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_charge_links'::regclass
      and conname = 'reservation_charge_links_refund_status'
  ) then
    alter table public.reservation_charge_links
      add constraint reservation_charge_links_refund_status
        check (
          (refunded_cents = 0
             and status not in ('refunded', 'partially_refunded'))
          or (refunded_cents > 0 and refunded_cents < amount_cents
             and status = 'partially_refunded')
          or (refunded_cents = amount_cents and status = 'refunded')
        );
  end if;

  -- Eine manuell („bar erhalten") als bezahlt geführte Nachberechnung hat nie
  -- einen Kartenumsatz erzeugt — dafür gibt es die Rücknahme
  -- (`unpaid_reason`, 0470), keine Stripe-Erstattung. Ohne diesen CHECK stünde
  -- am Ende eine Erstattung ohne Geldfluss in den Büchern.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reservation_charge_links'::regclass
      and conname = 'reservation_charge_links_erstattung_nur_karte'
  ) then
    alter table public.reservation_charge_links
      add constraint reservation_charge_links_erstattung_nur_karte
        check (refunded_at is null or paid_manually = false);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Sicherheitseinlage — die Deckung für genau diesen Fall
-- ---------------------------------------------------------------------------
-- Gehalten wird NICHT auf unserem Konto, sondern als nicht-auszahlbarer Teil
-- des Verbundkonto-Saldos: Der Stripe-Rhythmus des Verbundkontos wird auf
-- `manual` gezwungen, unser Lauf zahlt aus, und zwar nur
-- `verfügbar − Einlage`. Das Geld bleibt damit sichtbar das des Betriebs, und
-- eine Erstattung zieht direkt daraus — ohne Transfer, ohne zweiten Geldweg
-- (der wäre eine zweite Wahrheit über denselben Betrag).
--
-- Die HÖHE der Einlage wird nicht gespeichert, sondern bei jeder Auszahlung neu
-- aus den offenen Erstattungsrisiken berechnet (payouts/sicherheitseinlage.py):
-- bezahlte Zusatzleistungen und Nachberechnungen zu Buchungen, deren
-- `check_out + karenz_tage` noch nicht vorbei ist, abzüglich bereits erstatteter
-- Beträge. Eine gespiegelte Summenspalte würde driften, sobald jemand irgendwo
-- storniert (Wurzel 1) — abgeleitet kann sie das nicht.
--
-- `verbund_interval` ist der Rhythmus, den der Betrieb WÜNSCHT. Er steuert
-- unseren Lauf; bei Stripe steht dauerhaft `manual`. Ohne diese Spalte wäre der
-- Wunsch nach dem Erzwingen verloren, und `/konto/abrechnung` müsste ihn aus
-- dem Stripe-Wert ableiten, der dann immer „manual" sagt.
--
-- BEWUSST OHNE DEFAULT (Wurzel 4): Was ein Bestandsbetrieb wünscht, steht heute
-- allein bei Stripe (live: `daily`). Ein Default hier wäre eine erfundene
-- Auskunft über sein Geld — mit `'manual'` hätte jeder Bestandsbetrieb ab dem
-- Einspielen unbemerkt keine automatische Auszahlung mehr. NULL heißt „noch
-- nicht übernommen"; der erste Aufruf von `guthaben()` liest den echten
-- Stripe-Rhythmus, schreibt ihn hierher und stellt Stripe dann auf `manual`.
alter table public.payout_settings
  add column if not exists einlage_aktiv    boolean not null default true,
  add column if not exists verbund_interval text,
  -- Die Anker gehören zum Rhythmus: „wöchentlich" ohne Wochentag und
  -- „monatlich" ohne Tag wären keine Einstellung, sondern eine Annahme. Die
  -- Oberfläche schickt sie längst mit (`StripeRhythmusUpdate`); vor 0473 gingen
  -- sie direkt an Stripe, jetzt braucht unser Lauf sie selbst.
  add column if not exists verbund_weekly_anchor  text,
  add column if not exists verbund_monthly_anchor smallint;

alter table public.payout_settings
  drop constraint if exists payout_settings_verbund_weekly_anchor_check;
alter table public.payout_settings
  add constraint payout_settings_verbund_weekly_anchor_check
    check (
      verbund_weekly_anchor is null
      or verbund_weekly_anchor in ('monday', 'tuesday', 'wednesday', 'thursday',
                                   'friday', 'saturday', 'sunday')
    );

alter table public.payout_settings
  drop constraint if exists payout_settings_verbund_monthly_anchor_check;
alter table public.payout_settings
  add constraint payout_settings_verbund_monthly_anchor_check
    check (
      verbund_monthly_anchor is null
      or (verbund_monthly_anchor >= 1 and verbund_monthly_anchor <= 31)
    );

alter table public.payout_settings
  drop constraint if exists payout_settings_verbund_interval_check;
alter table public.payout_settings
  add constraint payout_settings_verbund_interval_check
    check (verbund_interval in ('manual', 'daily', 'weekly', 'monthly'));

comment on column public.payout_settings.einlage_aktiv is
  'Sicherheitseinlage aktiv: die Auszahlung des Verbundkontos wird um das noch '
  'erstattbare Volumen gekürzt. Abschalten heißt, das Erstattungsrisiko bei uns '
  'zu tragen (controller.losses.payments = application) — nur bewusst und pro '
  'Betrieb, nie als Default.';
comment on column public.payout_settings.verbund_interval is
  'Vom Betrieb gewünschter Auszahlungs-Rhythmus SEINES Verbundkontos. Bei Stripe '
  'steht `manual`, damit die Einlage überhaupt zurückgehalten werden kann; '
  'ausgezahlt wird nach diesem Wert durch unseren Lauf. NULL = noch nicht vom '
  'Stripe-Konto übernommen (kein geratener Ersatzwert).';

-- Grants/Policies: Beide Link-Tabellen und `reservation_addons` sind seit 0386
-- bzw. 0469 für anon/authenticated schreibgesperrt (Wurzel 6), `payout_settings`
-- ist nur lesbar. Neue Spalten erben das Tabellen-Grant, es ist hier also
-- NICHTS zu gewähren und nichts zu entziehen — geprüft am 25.08.2026:
-- reservation_addons hat für authenticated nur SELECT, die Link-Tabellen haben
-- gar kein SELECT. `scripts/security/direktpfad-pruefen.sh` deckt sie ab.

commit;
