-- 0470_nachberechnung_manuell_bezahlt.sql — Nachberechnung ohne Kartenzahlung
--
-- ANLASS (25.08.2026, direkt nach 0469): Der Betrieb muss zwei Dinge können, die
-- der reine Zahlungslink nicht abdeckt:
--   1. SEHEN, dass eine Nachberechnung bezahlt ist — nicht nur, dass gerade ein
--      Link offen ist. Nach der Zahlung verschwand die Information aus der
--      Buchungsansicht; sichtbar blieb allein ein gestiegenes `paid_amount`,
--      dem niemand ansieht, WOFÜR es gestiegen ist.
--   2. Eine Nachberechnung ALS BEZAHLT SETZEN, wenn der Gast anders gezahlt hat
--      (bar bei der Anreise, Überweisung, Karte an der Rezeption). Ohne diesen
--      Weg müsste der Betrieb den Gast durch einen Stripe-Link schicken, den er
--      gar nicht braucht — oder die Zahlung bliebe außerhalb des Systems und
--      fehlte in Rechnung und Eigentümer-Abrechnung.
--
-- ÄNDERUNG: Die Stripe-Spalten werden OPTIONAL. Eine Nachberechnung ist damit
-- ein Vorgang mit Betrag und Grund, für den es einen Zahlungslink geben KANN.
-- Der CHECK erzwingt Alles-oder-nichts: eine halb gefüllte Stripe-Zeile (URL da,
-- Konto fehlt) wäre für den Webhook und für das Deaktivieren unbrauchbar.
--
-- RÜCKNAHME (Wurzel 1, Muster aus 0397): Eine Bezahlt-Markierung erhöht
-- `reservations.paid_amount` und schreibt einen `payments`-Beleg. Ohne Weg
-- zurück wäre ein Fehlklick eine Falle — genau der Fall, der am 14.08.2026 bei
-- einer Zusatzleistung auftrat („Wäschepaket 600 DKK", kein Rückweg).
-- Zurückgenommen werden darf NUR eine MANUELLE Markierung: eine per Stripe
-- eingegangene Zahlung ist eine Tatsache, keine Meinung — sie wird erstattet,
-- nicht umgedeutet. Der Grund ist Pflicht, weil der Betrag aus Rechnung und
-- Abrechnung herausfällt.
--
-- SICHERHEIT: Die Tabelle trägt bereits `revoke all from anon, authenticated`
-- plus permissive UND restriktive tenant-Policy (0469). Die neuen Spalten erben
-- das; kein zusätzliches Grant.

-- ============================================================================
-- 1. Stripe-Felder optional (Nachberechnung ohne Link)
-- ============================================================================
alter table public.reservation_charge_links
    alter column stripe_account_id      drop not null,
    alter column stripe_payment_link_id drop not null,
    alter column stripe_price_id        drop not null,
    alter column stripe_product_id      drop not null,
    alter column url                    drop not null;

alter table public.reservation_charge_links
    drop constraint if exists reservation_charge_links_stripe_vollstaendig;
alter table public.reservation_charge_links
    add constraint reservation_charge_links_stripe_vollstaendig
        check (
            (stripe_account_id is not null
             and stripe_payment_link_id is not null
             and stripe_price_id is not null
             and stripe_product_id is not null
             and url is not null)
            or
            (stripe_account_id is null
             and stripe_payment_link_id is null
             and stripe_price_id is null
             and stripe_product_id is null
             and url is null)
        );

-- Eine Zeile OHNE Stripe-Link darf nicht 'open' sein: sie wäre eine Forderung,
-- die niemand bezahlen kann und die den partiellen Unique-Index blockiert
-- („ein offener Link je Buchung") — der Betrieb könnte danach keinen echten
-- Link mehr erstellen.
alter table public.reservation_charge_links
    drop constraint if exists reservation_charge_links_offen_braucht_link;
alter table public.reservation_charge_links
    add constraint reservation_charge_links_offen_braucht_link
        check (status <> 'open' or url is not null);

-- ============================================================================
-- 2. Herkunft der Zahlung + Rücknahme-Protokoll
-- ============================================================================
alter table public.reservation_charge_links
    -- true = der Betrieb hat die Zahlung von Hand bestätigt (bar, Überweisung,
    -- Karte an der Rezeption). false = per Stripe eingegangen. Die Unterscheidung
    -- ist keine Kosmetik: nur eine manuelle Markierung darf zurückgenommen
    -- werden, und in der Übersicht muss ablesbar sein, was Stripe belegt und
    -- was eine Aussage des Betriebs ist.
    add column if not exists paid_manually boolean not null default false,
    add column if not exists paid_by uuid references public.users (id)
                               on delete set null,
    -- Rücknahme (nur bei paid_manually): Grund PFLICHT, sobald sie stattfindet.
    add column if not exists unpaid_reason text
        check (unpaid_reason is null
               or char_length(btrim(unpaid_reason)) between 3 and 500),
    add column if not exists unpaid_at timestamptz,
    add column if not exists unpaid_by uuid references public.users (id)
                               on delete set null;

comment on column public.reservation_charge_links.paid_manually is
  'true = Bezahlt-Markierung durch den Betrieb (bar/Ueberweisung/Karte vor Ort), '
  'false = Zahlungseingang ueber Stripe. Nur eine manuelle Markierung darf '
  'zurueckgenommen werden (0470).';

comment on column public.reservation_charge_links.unpaid_reason is
  'Grund der Ruecknahme einer manuellen Bezahlt-Markierung. Pflicht, weil der '
  'Betrag aus Rechnung und Eigentuemer-Abrechnung herausfaellt (Muster 0397).';

-- Rücknahme ist nur bei einer manuellen Markierung zulässig — eine per Stripe
-- eingegangene Zahlung wird erstattet, nicht umgedeutet.
alter table public.reservation_charge_links
    drop constraint if exists reservation_charge_links_ruecknahme_nur_manuell;
alter table public.reservation_charge_links
    add constraint reservation_charge_links_ruecknahme_nur_manuell
        check (unpaid_at is null or paid_manually);

-- Wo eine Rücknahme protokolliert ist, MUSS ein Grund stehen (und umgekehrt) —
-- sonst entstünde genau die Protokoll-Lücke, die 0397 für Zusatzleistungen
-- geschlossen hat.
alter table public.reservation_charge_links
    drop constraint if exists reservation_charge_links_ruecknahme_mit_grund;
alter table public.reservation_charge_links
    add constraint reservation_charge_links_ruecknahme_mit_grund
        check ((unpaid_at is null) = (unpaid_reason is null));
