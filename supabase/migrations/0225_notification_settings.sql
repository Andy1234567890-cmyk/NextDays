-- Benachrichtigungs-Einstellungen des Kontos (Airbnb „Konto → Benachrichtigungen").
--
-- EINE Zeile pro Nutzer. Fehlt die Zeile, gelten die Spalten-Defaults; der
-- Service upsertet lazy — wie bei privacy_settings (0193).
--
-- STRUKTUR (Airbnb-Vorbild, zwei Tabs):
--   Tab „Angebote und Updates" — Marketing. Frei abwählbar, plus ein
--     Sammel-Opt-out („Von allen Marketing-Mails abmelden").
--   Tab „Konto" — Betriebsbenachrichtigungen. Hier ist E-Mail bei den
--     rechtlich/vertraglich nötigen Kategorien NICHT abwählbar (Airbnb zeigt
--     den Schalter dort ausgegraut-an, siehe Screenshot „Guest policies").
--     Das bildet `email_locked` unten ab — erzwungen im Service, nicht in der UI.
--
-- KANÄLE: E-Mail / SMS / Telefon. Nicht jede Kategorie kennt jeden Kanal
-- (Airbnb: „Recognition and achievements" hat alle drei, „Guest policies" nur
-- E-Mail+SMS). Welche Kanäle eine Kategorie anbietet, ist Anzeige-Logik im
-- Frontend; die Spalten hier decken den Maximalfall ab.
--
-- KEINE Spalte für Push: die mobile App hat noch keine Push-Registrierung
-- (mobile/, P1-P9 offen). Lieber gar kein Feld als ein totes (Wurzel 4).
--
-- Sensibel (nutzergebunden, enthält Kommunikationspräferenzen) → Wurzel 6:
-- RLS + harter GRANT-Entzug. Nur service_role schreibt/liest.

create table if not exists public.notification_settings (
    user_id uuid primary key references auth.users (id) on delete cascade,

    -- ---------------------------------------------------------------------
    -- Tab „Angebote und Updates" (Marketing) — Airbnb-Default: E-Mail an.
    -- ---------------------------------------------------------------------
    -- Gruppe „Einblicke und Prämien fürs Gastgeben"
    insights_recognition_email boolean not null default true,
    insights_recognition_sms boolean not null default false,
    insights_recognition_phone boolean not null default false,

    insights_tips_email boolean not null default true,
    insights_tips_sms boolean not null default false,
    insights_tips_phone boolean not null default false,

    insights_pricing_email boolean not null default true,
    insights_pricing_sms boolean not null default false,
    insights_pricing_phone boolean not null default false,

    insights_perks_email boolean not null default true,
    insights_perks_sms boolean not null default false,
    insights_perks_phone boolean not null default false,

    -- Gruppe „Neuigkeiten zum Gastgeben"
    hosting_news_email boolean not null default true,
    hosting_news_sms boolean not null default false,
    hosting_news_phone boolean not null default false,

    hosting_local_laws_email boolean not null default true,
    hosting_local_laws_sms boolean not null default false,
    hosting_local_laws_phone boolean not null default false,

    -- Gruppe „Reisetipps und Angebote"
    travel_inspiration_email boolean not null default true,
    travel_inspiration_sms boolean not null default false,
    travel_inspiration_phone boolean not null default false,

    travel_planning_email boolean not null default true,
    travel_planning_sms boolean not null default false,
    travel_planning_phone boolean not null default false,

    -- Gruppe „myNextDays-Updates"
    platform_news_email boolean not null default true,
    platform_news_sms boolean not null default false,
    platform_news_phone boolean not null default false,

    platform_feedback_email boolean not null default true,
    platform_feedback_sms boolean not null default false,
    platform_feedback_phone boolean not null default false,

    platform_travel_regulations_email boolean not null default true,
    platform_travel_regulations_sms boolean not null default false,
    platform_travel_regulations_phone boolean not null default false,

    -- Sammel-Opt-out. Setzt der Nutzer das, schaltet der Service ALLE
    -- Marketing-Kanäle oben aus (Gegenzustand pflegen, Wurzel 1) — die
    -- Einzelspalten bleiben die Wahrheit, dieses Flag ist nur die Absicht.
    marketing_unsubscribed_all boolean not null default false,

    -- ---------------------------------------------------------------------
    -- Tab „Konto" (Betrieb) — E-Mail bei Policies/Aktivität nicht abwählbar.
    -- ---------------------------------------------------------------------
    account_activity_email boolean not null default true,
    account_activity_sms boolean not null default false,

    listing_activity_email boolean not null default true,
    listing_activity_sms boolean not null default true,

    guest_policies_email boolean not null default true,
    guest_policies_sms boolean not null default false,

    host_policies_email boolean not null default true,
    host_policies_sms boolean not null default false,

    reminders_email boolean not null default true,
    reminders_sms boolean not null default false,

    messages_email boolean not null default true,
    messages_sms boolean not null default false,

    updated_at timestamptz not null default now()
);

comment on table public.notification_settings is
    'Benachrichtigungs-Präferenzen pro Konto (Airbnb „Konto → Benachrichtigungen"). '
    'Fehlende Zeile = Spalten-Defaults. Vom Server (service_role) über den '
    'notification_settings-Slice geschrieben. E-Mail der Konto-Kategorien ist '
    'nicht abwählbar (rechtlich/vertraglich nötig) — erzwungen im Service.';

-- Wurzel 6: RLS + harter GRANT-Entzug. Kommunikationspräferenzen sind
-- nutzergebunden; ein Client darf sie NICHT per anon-Key-curl lesen oder
-- schreiben (sonst könnte er fremde Präferenzen abgreifen oder still
-- Sicherheits-Benachrichtigungen abschalten).
alter table public.notification_settings enable row level security;

revoke select, insert, update, delete
    on public.notification_settings from anon, authenticated;

drop policy if exists notification_settings_self_restrict
    on public.notification_settings;
create policy notification_settings_self_restrict
    on public.notification_settings
    as restrictive for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
