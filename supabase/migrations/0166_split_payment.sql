-- 0166_split_payment.sql — Anzahlung + automatische Restzahlung (Split Payment)
--
-- Die Buchungs-Konditionen (0165) erlauben Zahlungspläne mit Anzahlung + Rest.
-- Für die AUTOMATISCHE Restzahlung X Tage vor Anreise muss die Karte des Gastes
-- bei der Anzahlung gespeichert werden (Stripe setup_future_usage=off_session),
-- damit sie später off-session (ohne Gast) belastet werden kann.
--
-- Neu:
--   * payment_type-Enum um 'down_payment' (Anzahlung) + 'balance' (Restzahlung).
--   * payments.stripe_customer_id / stripe_payment_method_id — gespeicherte Karte
--     für die spätere off-session-Restzahlung.
--   * payments.due_at — geplanter Fälligkeitszeitpunkt der Restzahlung (der
--     Worker chargt fällige 'balance'-Zeilen). scheduled_status trennt „geplant"
--     von „bezahlt/fehlgeschlagen", ohne den bestehenden payment_status zu
--     überladen.
--
-- SENSIBEL (Wurzel 6): payments trägt bereits revoke/RLS (Finanzdaten). Die
-- neuen Spalten erben das; kein zusätzliches Grant.

-- Enum erweitern (idempotent — add value if not exists).
alter type public.payment_type add value if not exists 'down_payment';
alter type public.payment_type add value if not exists 'balance';

-- Karten-Speicherung + Restzahlungs-Scheduling an payments.
alter table public.payments
    add column if not exists stripe_customer_id text,
    add column if not exists stripe_payment_method_id text,
    -- Geplante Fälligkeit der Restzahlung (nur bei type='balance' gesetzt).
    add column if not exists due_at timestamptz,
    -- Zustand der geplanten Restzahlung, getrennt vom Zahlungs-status:
    -- scheduled = wartet auf Fälligkeit; charging = Worker versucht gerade;
    -- done = erfolgreich belastet; failed = Charge abgelehnt; needs_action =
    -- 3DS/authentication_required, Gast muss on-session bestätigen.
    add column if not exists scheduled_status text
        check (scheduled_status is null or scheduled_status in
               ('scheduled', 'charging', 'done', 'failed', 'needs_action'));

-- Hinweis: Der Worker-Index auf 'balance'-Zeilen liegt in 0167 — ein partieller
-- Index mit `where type = 'balance'` darf den neuen Enum-Wert erst nutzen, NACHDEM
-- die Enum-Erweiterung committet ist (Postgres: "unsafe use of new enum value").
-- Deshalb strikt getrennt: Enum + Spalten hier (0166), Index in 0167.

comment on column public.payments.stripe_payment_method_id is
  'Gespeicherte Zahlungsmethode (pm_…) für die off-session-Restzahlung. Nur der '
  'Server (service_role) darf das lesen (payments ist revoke/RLS-geschützt).';
