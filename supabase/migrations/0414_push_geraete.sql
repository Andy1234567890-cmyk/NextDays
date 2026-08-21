-- Push-Benachrichtigungen auf das Telefon (mobile-nextdays, mobile-bestdays).
--
-- ZWEI Dinge in einer Migration, weil sie ohne einander sinnlos sind:
--   1. `push_devices` — wohin ein Push geht (FCM-Token je Gerät)
--   2. zwei Präferenzspalten — ob er überhaupt gehen darf
--
-- WARUM EIN EIGENER KANAL und nicht die Glocke (Kanal.INAPP) mitbenutzen: die
-- Glocke ist der Ort IN der Anwendung und darum bewusst nicht abwählbar. Ein
-- Push STÖRT — er klingelt nachts auf dem Nachttisch. Damit gehört er zu
-- E-Mail und SMS: abwählbar, mit eigener Spalte je Kategorie.
--
-- WARUM NUR ZWEI KATEGORIEN: gebaut ist, was der Betrieb wirklich sofort
-- wissen muss — eine neue Buchung (`betrieb_buchung`) und eine neue
-- Gastnachricht (`messages`). Die 30 Marketing-Kategorien bekommen KEINEN
-- Push-Schalter: eine Push-Meldung über „Reisetipps" ist eine Zumutung, und
-- eine Spalte, die niemand nutzt, ist eine Spalte, die irgendwann falsch
-- gesetzt wird. Weitere Kategorien kommen dazu, wenn sie gebraucht werden —
-- `SPALTEN` in katalog.py leitet sich aus KATALOG × kanaele ab, es genügt
-- dann der Kanal-Eintrag plus eine Spalte hier.

create table if not exists public.push_devices (
    id uuid primary key default gen_random_uuid(),
    -- Wem das Gerät gehört. Der Push-Empfänger ist immer ein Nutzer, nie ein
    -- Mandant: dieselbe Person kann in zwei Betrieben arbeiten, das Gerät
    -- gehört ihr, nicht dem Betrieb.
    user_id uuid not null references public.users (id) on delete cascade,
    -- Der Mandant, in dem das Gerät angemeldet wurde. Nur für den Tenant-Scope
    -- der Policies; die Zustellentscheidung fällt über user_id + Präferenz.
    tenant_id uuid references public.tenants (id) on delete cascade,
    -- Das FCM-Registrierungstoken. Es ist ein GEHEIMNIS: wer es hat, kann dem
    -- Gerät Pushes schicken. Deshalb steht die Tabelle unter hartem
    -- GRANT-Entzug (Wurzel 6) — kein Client liest es je.
    token text not null,
    -- 'ios' | 'android'. Bewusst kein Enum: ein drittes Ziel (Web-Push)
    -- käme sonst nur über eine Migration am Typ.
    platform text not null check (platform in ('ios', 'android')),
    -- Welche der beiden Apps (ADR-0019). Ein Push für den Betrieb darf nicht
    -- auf dem Gast-Telefon landen, auch wenn dieselbe Person beide Apps hat.
    app text not null check (app in ('mynextdays', 'mybestdays')),
    -- Für das Aufräumen: FCM meldet ungültige Tokens erst beim Senden. Wer
    -- 60 Tage nicht mehr auftauchte, wird nicht mehr bedient.
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    -- EIN Token gehört genau EINEM Gerät (Wurzel 2): ein erneutes Anmelden
    -- mit demselben Token legt keine zweite Zeile an, sondern hebt
    -- last_seen_at. Ohne diesen Riegel bekäme ein Gerät nach fünf Anmeldungen
    -- fünf identische Pushes.
    constraint push_devices_token_unique unique (token)
);

create index if not exists push_devices_user_idx
    on public.push_devices (user_id, app);
create index if not exists push_devices_tenant_idx
    on public.push_devices (tenant_id);

comment on table public.push_devices is
    'FCM-Registrierungstokens der Mobile-Apps. Token = Geheimnis, nur '
    'service_role liest/schreibt (Wurzel 6).';

alter table public.push_devices enable row level security;

-- Tenant-Policy für die Vollständigkeit des Modells. Sie ist NICHT der Schutz —
-- der liegt im GRANT-Entzug darunter (Wurzel 6: RLS erzwingt nur den
-- Mandanten, nicht die Schreibrichtung).
drop policy if exists push_devices_tenant on public.push_devices;
create policy push_devices_tenant on public.push_devices
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- DER eigentliche Schutz: kein Client-Zugriff, in KEINE Richtung. Ein
-- eingeloggter cleaner mit dem öffentlichen anon-Key käme sonst per
-- `curl /rest/v1/push_devices` an die Tokens aller Kollegen und könnte ihnen
-- beliebige Meldungen schicken. Registriert wird ausschließlich über die
-- FastAPI (service_role).
revoke all on public.push_devices from anon, authenticated;

-- Die zwei Präferenzspalten. Default TRUE: wer die App installiert und sich
-- anmeldet, will die zwei Ereignisse wissen — sonst hätte er die App nicht.
-- Abschalten geht in /konto (derselbe Schalter-Dialog wie Mail/SMS).
alter table public.notification_settings
    add column if not exists betrieb_buchung_push boolean not null default true,
    add column if not exists messages_push boolean not null default true;

comment on column public.notification_settings.betrieb_buchung_push is
    'Push bei neuer Buchung (Betrieb). Abwählbar — anders als die Glocke.';
comment on column public.notification_settings.messages_push is
    'Push bei neuer Gastnachricht. Abwählbar — anders als die Glocke.';
