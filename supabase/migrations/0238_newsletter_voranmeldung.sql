-- Voranmeldungen / Newsletter (Popup auf der Marketing-Seite).
--
-- Die Adressen sind personenbezogene Daten, die ein UNAUTHENTIFIZIERTER
-- Besucher einreicht — damit gilt hier alles gleichzeitig:
--
--   • Wurzel 6: kein Client darf diese Tabelle sehen. Weder lesen (E-Mail-Liste
--     = Datenpanne) noch schreiben (sonst könnte jemand fremde Adressen als
--     „bestätigt" eintragen). Deny-all + harter GRANT-Entzug; geschrieben wird
--     ausschließlich vom Server (service_role).
--   • Wurzel 2: dieselbe Adresse kommt real mehrfach (Doppelklick, zweiter
--     Besuch, Retry). UNIQUE auf der normalisierten E-Mail ist der Backstop.
--   • DSGVO Art. 7 Abs. 1 (Rechenschaftspflicht): die Einwilligung muss
--     NACHWEISBAR sein. Deshalb liegt der Nachweis hier — Zeitpunkt, IP,
--     User-Agent und der WORTLAUT, dem zugestimmt wurde. Ein Brevo-Konto ist
--     kein Nachweis, den wir selbst vorlegen können.
--
-- Double-Opt-in läuft bewusst über UNSEREN Weg (eigener Token, eigene Mail über
-- den Mailcow), nicht über Brevos DOI-Endpunkt: der bräuchte ein eigenes
-- Template je Sprache (wir haben 24) und würde den Einwilligungs-Nachweis
-- ausschließlich bei Brevo ablegen.

create table if not exists public.newsletter_subscribers (
    id uuid primary key default gen_random_uuid(),

    -- Normalisiert (trim + lower) vom Service geschrieben; der UNIQUE-Index
    -- unten steht auf genau dieser Spalte.
    email text not null,

    -- pending   = eingetragen, Bestätigung noch offen (zählt NICHT als Kontakt)
    -- confirmed = Doppel-Opt-in abgeschlossen, darf angeschrieben werden
    -- unsubscribed = abgemeldet; Zeile bleibt als Nachweis/Sperre bestehen
    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'unsubscribed')),

    -- Sprache der Anmeldung (Bestätigungsmail + späterer Versand).
    locale text,
    -- Woher die Anmeldung kam ('popup_start', 'popup_preise' …).
    source text,

    -- --- Einwilligungs-Nachweis ---------------------------------------------
    -- Der exakte Text, dem zugestimmt wurde. Ändert sich der Text, bleibt bei
    -- Altfällen der alte erhalten — genau das ist der Zweck.
    consent_text text,
    consent_ip inet,
    consent_user_agent text,
    consent_at timestamptz not null default now(),
    confirmed_at timestamptz,
    unsubscribed_at timestamptz,

    -- --- Bestätigungs-Token (Einmal, nur als Hash) --------------------------
    -- Klartext existiert nur im Link in der Mail; ein DB-Leak verschafft damit
    -- keine Bestätigungsmöglichkeit.
    confirm_token_hash text,
    confirm_expires_at timestamptz,
    -- Wann zuletzt eine Bestätigungsmail rausging (Wiederholsperre).
    confirm_sent_at timestamptz,

    -- --- Abmelde-Token (dauerhaft gültig, ebenfalls nur als Hash) -----------
    unsubscribe_token_hash text,

    -- --- Brevo-Abgleich ------------------------------------------------------
    -- Kontakt-ID bei Brevo, sobald übertragen. Bleibt NULL, solange kein
    -- API-Schlüssel konfiguriert ist oder die Übertragung scheiterte — dann
    -- steht der Grund in brevo_last_error. Kein stilles „ist synchronisiert".
    brevo_contact_id text,
    brevo_synced_at timestamptz,
    brevo_last_error text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists newsletter_subscribers_email_uq
    on public.newsletter_subscribers (email);
create unique index if not exists newsletter_subscribers_confirm_token_uq
    on public.newsletter_subscribers (confirm_token_hash)
    where confirm_token_hash is not null;
create unique index if not exists newsletter_subscribers_unsub_token_uq
    on public.newsletter_subscribers (unsubscribe_token_hash)
    where unsubscribe_token_hash is not null;
-- Nachlauf: bestätigte Zeilen, die noch nicht bei Brevo sind.
create index if not exists newsletter_subscribers_pending_sync_idx
    on public.newsletter_subscribers (status, brevo_synced_at)
    where status = 'confirmed' and brevo_synced_at is null;

comment on table public.newsletter_subscribers is
    'Voranmeldungen/Newsletter der Marketing-Seite. Enthält den DSGVO-'
    'Einwilligungsnachweis (Zeitpunkt, IP, Wortlaut). Nur service_role liest '
    'und schreibt — es gibt keinen legitimen Client-Direktpfad.';

comment on column public.newsletter_subscribers.confirm_token_hash is
    'SHA-256 des Bestätigungstokens. Klartext steht nur im Link der Mail.';

drop trigger if exists trg_newsletter_subscribers_updated on public.newsletter_subscribers;
create trigger trg_newsletter_subscribers_updated
    before update on public.newsletter_subscribers
    for each row execute function public.set_updated_at();

-- --- Härtung (Wurzel 6) ------------------------------------------------------
alter table public.newsletter_subscribers enable row level security;

revoke all on public.newsletter_subscribers from anon, authenticated;

-- Deny-all für alles außer service_role: kein Realtime, kein PostgREST, nichts.
-- Die Marketing-Seite spricht ausschließlich mit der FastAPI.
drop policy if exists newsletter_subscribers_deny_all on public.newsletter_subscribers;
create policy newsletter_subscribers_deny_all on public.newsletter_subscribers
    as restrictive for all
    using (false)
    with check (false);
