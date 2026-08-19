-- Löschanträge für Konten, gestellt über die öffentliche Marketing-Seite.
--
-- WARUM ES DIESE SEITE GEBEN MUSS: Google Play verlangt für jede App, in der
-- man ein Konto anlegen kann, ZWEI Wege zur Löschung — einen in der App und
-- einen im Web, der OHNE installierte App und ohne Login erreichbar ist
-- („Some users may have already uninstalled your app"). Ohne diesen Web-Weg
-- wird die App nicht veröffentlicht.
--
-- WARUM ANTRAG UND NICHT SOFORT-LÖSCHUNG: An einem myNextDays-Konto hängt ein
-- ganzer BETRIEB — Buchungen, Rechnungen, OTA-Verbindungen, Auszahlungen.
-- Ein Klick, der das sofort entfernt, ist keine Funktion, sondern eine Waffe.
-- Google fordert ausdrücklich nur die Möglichkeit, die Löschung zu VERLANGEN
-- („request deletion"); Lodgify deklariert im Play Store genau das
-- („You can request that data be deleted"). Der Antrag landet also im
-- Backoffice und wird dort geprüft — u. a. auf offene Zahlungen und auf
-- gesetzliche Aufbewahrungsfristen (Buchhaltung).
--
-- WARUM DOUBLE-OPT-IN (der eigentliche Schutz): Ein Formular, das auf eine
-- eingetippte Adresse hin einen Antrag anlegt, wäre ein Werkzeug gegen fremde
-- Konten. Deshalb löst das Absenden NICHTS aus außer einer Mail an genau diese
-- Adresse. Nur wer dieses Postfach besitzt, kann bestätigen. Wer eine fremde
-- Adresse einträgt, erreicht damit nur eines: der echte Inhaber bekommt eine
-- Mail und weiß, dass jemand es versucht hat. Der Angriff wird zur Warnung.
--
-- WURZEL 6: Die Tabelle enthält E-Mail-Adressen aus einer unauthentifizierten
-- Quelle. Kein Client darf sie lesen (Adressliste unserer Kunden = Datenpanne)
-- und keiner schreiben (sonst legt jemand direkt einen 'confirmed'-Antrag an).
-- Deny-all + GRANT-Entzug; nur der Server (service_role) arbeitet damit.
--
-- WURZEL 2: Dieselbe Adresse kommt real mehrfach (Doppelklick, zweiter Versuch,
-- Retry). Ein Teil-UNIQUE über die offenen Anträge ist der Backstop: pro
-- Adresse höchstens EIN offener Antrag, während abgeschlossene Anträge als
-- Historie erhalten bleiben.

create table if not exists public.account_deletion_requests (
    id uuid primary key default gen_random_uuid(),

    -- Normalisiert (trim + lower) vom Service geschrieben.
    email text not null,

    -- pending   = eingereicht, Bestätigung per Mail noch offen. Zählt NICHT als
    --             Antrag — in diesem Zustand ist nicht bewiesen, dass der
    --             Antragsteller das Postfach besitzt.
    -- confirmed = Postfach-Besitz bewiesen, liegt dem Backoffice zur Prüfung vor.
    -- done      = Löschung durchgeführt.
    -- rejected  = abgelehnt (z. B. offene Forderung, Aufbewahrungsfrist,
    --             kein Konto zu dieser Adresse). Grund in resolution_note.
    -- expired   = Bestätigungslink verfallen, ohne dass geklickt wurde.
    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'done', 'rejected', 'expired')),

    -- Sprache für die Bestätigungsmail.
    locale text,

    -- Optionale Begründung des Antragstellers (Freitext aus dem Formular).
    -- Wird beim SPEICHERN gekappt; ein unbegrenztes Feld aus einer öffentlichen
    -- Quelle ist eine Einladung (Wurzel 8).
    reason text,

    -- --- Nachweis der Einreichung -------------------------------------------
    requested_ip inet,
    requested_user_agent text,
    requested_at timestamptz not null default now(),
    confirmed_at timestamptz,

    -- --- Bestätigungs-Token (Einmal, nur als Hash) --------------------------
    -- Klartext existiert nur im Link in der Mail. Ein DB-Leak verschafft damit
    -- keine Bestätigungsmöglichkeit.
    confirm_token_hash text,
    confirm_expires_at timestamptz,
    -- Wann zuletzt eine Bestätigungsmail rausging (Wiederholsperre gegen
    -- Mail-Flut auf fremde Postfächer).
    confirm_sent_at timestamptz,

    -- --- Bearbeitung im Backoffice ------------------------------------------
    -- Wer den Antrag abgeschlossen hat und was entschieden wurde. Bewusst
    -- Pflicht bei 'rejected' (siehe Trigger unten): eine Ablehnung ohne Grund
    -- ist gegenüber dem Antragsteller nicht begründbar (DSGVO Art. 12 Abs. 4).
    resolved_by uuid references public.users (id) on delete set null,
    resolved_at timestamptz,
    resolution_note text,

    -- Zu welchem Konto der Antrag gehört, SOFERN es eines gibt. Bleibt NULL,
    -- wenn zu der Adresse kein Konto existiert — dann ist der Antrag trotzdem
    -- gültig eingereicht und wird als 'rejected' mit Hinweis geschlossen.
    -- Kein Fantasie-Wert, kein stilles Zuordnen (Wurzel 4).
    matched_user_id uuid references public.users (id) on delete set null,
    matched_tenant_id uuid references public.tenants (id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Pro Adresse höchstens EIN offener Antrag. Abgeschlossene Anträge bleiben als
-- Historie erhalten, deshalb ein TEIL-Index statt UNIQUE auf der Spalte.
create unique index if not exists account_deletion_requests_offen_uq
    on public.account_deletion_requests (email)
    where status in ('pending', 'confirmed');

create unique index if not exists account_deletion_requests_token_uq
    on public.account_deletion_requests (confirm_token_hash)
    where confirm_token_hash is not null;

-- Arbeitsvorrat des Backoffice: bestätigte Anträge, älteste zuerst.
create index if not exists account_deletion_requests_offen_idx
    on public.account_deletion_requests (status, confirmed_at)
    where status = 'confirmed';

comment on table public.account_deletion_requests is
    'Löschanträge aus dem öffentlichen Web-Formular (Play-Store-Pflicht). '
    'Double-Opt-in: erst nach Klick auf den Mail-Link gilt der Postfach-Besitz '
    'als bewiesen (status=confirmed). Die Löschung selbst führt das Backoffice '
    'durch — an einem Konto hängt ein ganzer Betrieb. Nur service_role.';

comment on column public.account_deletion_requests.confirm_token_hash is
    'SHA-256 des Bestätigungstokens. Klartext steht nur im Link der Mail.';

comment on column public.account_deletion_requests.matched_user_id is
    'Gefundenes Konto oder NULL. NULL heißt „zu dieser Adresse gibt es kein '
    'Konto" — der Antrag wird dann abgelehnt, nicht still verworfen.';

drop trigger if exists trg_account_deletion_requests_updated on public.account_deletion_requests;
create trigger trg_account_deletion_requests_updated
    before update on public.account_deletion_requests
    for each row execute function public.set_updated_at();

-- Eine Ablehnung MUSS einen Grund tragen. Ohne diese Wache steht am Ende ein
-- 'rejected' ohne Begründung, und niemand kann dem Antragsteller sagen, warum
-- (DSGVO Art. 12 Abs. 4 verlangt eine Begründung binnen Monatsfrist).
create or replace function public.account_deletion_request_grund_pflicht()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.status = 'rejected'
       and coalesce(btrim(new.resolution_note), '') = '' then
        raise exception
            'resolution_note ist bei status=rejected Pflicht (Begründung des Antragstellers gegenüber)';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_account_deletion_requests_grund on public.account_deletion_requests;
create trigger trg_account_deletion_requests_grund
    before insert or update on public.account_deletion_requests
    for each row execute function public.account_deletion_request_grund_pflicht();

-- --- Härtung (Wurzel 6) ------------------------------------------------------
alter table public.account_deletion_requests enable row level security;

revoke all on public.account_deletion_requests from anon, authenticated;

-- Deny-all für alles außer service_role. Die Marketing-Seite und das Backoffice
-- sprechen ausschließlich mit der FastAPI; es gibt keinen legitimen
-- Client-Direktpfad auf diese Tabelle.
drop policy if exists account_deletion_requests_deny_all on public.account_deletion_requests;
create policy account_deletion_requests_deny_all on public.account_deletion_requests
    as restrictive for all
    using (false)
    with check (false);

revoke execute on function public.account_deletion_request_grund_pflicht() from anon, authenticated;
