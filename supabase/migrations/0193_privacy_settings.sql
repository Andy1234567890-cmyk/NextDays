-- Datenschutz-Einstellungen des Gastgeber-Kontos (Airbnb „Konto → Datenschutz").
--
-- EINE Zeile pro Nutzer mit den persistierbaren Präferenzen aus dem Airbnb-
-- Datenschutz-Tab. Fehlt die Zeile, gelten die Spalten-Defaults (Airbnb-Defaults:
-- Lesebestätigungen AN, Review-Detailfelder AUS außer Aufenthaltsdauer,
-- KI-Feature-Beitrag AN). Der Service upsertet lazy. „Objekte in Suchmaschinen
-- aufnehmen" ist bewusst KEINE Spalte hier (Objekt-Eigenschaft, siehe 0194).
--
-- Verweis-Aktionen des Tabs (Datenexport anfordern, Konto löschen, Cookie-
-- Präferenzen) sind KEINE Präferenzen und leben nicht hier — sie sind eigene
-- Flows bzw. clientseitig (Cookies). Hier nur echte, gespeicherte Schalter.
--
-- Sensibel (nutzergebunden, PII-nah) → Wurzel 6: RLS + harter GRANT-Entzug.
-- Nur service_role (der Server über den FastAPI-Slice) schreibt/liest; ein
-- eingeloggter Client käme per anon-Key-curl NICHT an fremde Präferenzen.

create table if not exists public.privacy_settings (
    user_id uuid primary key references auth.users (id) on delete cascade,

    -- Nachrichten: „Anderen zeigen, wann ich ihre Nachricht gelesen habe."
    -- Airbnb-Default: AN.
    message_read_receipts boolean not null default true,

    -- HINWEIS: „Objekte in Suchmaschinen aufnehmen" ist KEINE Spalte hier — es
    -- ist eine Objekt-Eigenschaft (properties.search_engine_indexing, 0194). Der
    -- Konto-Schalter leitet sich aus dem Objekt-Zustand ab (kein Doppelwert).

    -- Bewertungen: welche Detailfelder in eigenen Rezensionen sichtbar sind.
    -- Airbnb-Default: Heimatstadt/Reiseart/Buchungen AUS, Aufenthaltsdauer AN.
    review_show_home_city boolean not null default false,
    review_show_trip_type boolean not null default false,
    review_show_length_of_stay boolean not null default true,
    review_show_booked_services boolean not null default false,

    -- Datenschutz: „Beim Verbessern KI-gestützter Funktionen helfen."
    -- Airbnb-Default: AN (opt-out möglich).
    ai_features_contribution boolean not null default true,

    updated_at timestamptz not null default now()
);

comment on table public.privacy_settings is
    'Datenschutz-Präferenzen pro Gastgeber-Konto (Airbnb „Konto → Datenschutz"). '
    'Fehlende Zeile = Spalten-Defaults (Airbnb-Defaults). Vom Server (service_role) '
    'über den privacy_settings-Slice geschrieben.';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug --------------------------
alter table public.privacy_settings enable row level security;

-- Kein pauschales Grant an anon/authenticated — nur der Server (service_role)
-- greift zu. Falls Default-Privilegien etwas gesetzt haben: entziehen.
revoke all on public.privacy_settings from anon, authenticated;

-- Restriktive Guard für ALLE Operationen: streng per-User. Selbst wenn je ein
-- Grant hinzukäme, sähe/änderte ein Client nur die EIGENE Zeile.
create policy privacy_settings_self_restrict on public.privacy_settings
    as restrictive for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
