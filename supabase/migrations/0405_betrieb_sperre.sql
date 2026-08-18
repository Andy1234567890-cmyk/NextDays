-- Betrieb (Tenant) plattformseitig sperren.
--
-- Bisher konnte das Backoffice Betriebe nur ANSEHEN (`platform_admin`-Slice:
-- ausschliesslich `.select()` auf tenants). Es gab keinen Weg, einen Betrieb
-- stillzulegen — weder bei Missbrauch noch fuer die vielen Demo-Konten, die auf
-- der Plattform stehen. Genau das legt diese Migration an.
--
-- WARUM `deactivated_at` UND KEIN `is_active`-FLAG:
-- Gleiche Begruendung wie bei `public.users` (0356), und bewusst dieselbe
-- Schreibweise: ein Zeitpunkt beantwortet zusaetzlich „seit wann" und laesst
-- sich in der Oberflaeche benennen („Gesperrt am 18.08.2026"). NULL = aktiv ist
-- der Ausdruck, den das Schema ueberall sonst nutzt (0355, 0356).
-- `deactivated_by` haelt fest, WER gesperrt hat; `deactivation_reason` warum.
-- Beides ist die Frage, die unmittelbar nach einer Sperre kommt — der Betrieb
-- ruft an und will wissen, weshalb nichts mehr geht.
--
-- WARUM AUF DEM BETRIEB UND NICHT JE NUTZER:
-- Ein Betrieb hat n Nutzer. Jeden einzeln zu deaktivieren (0356) ist weder
-- vollstaendig (neue Nutzer koennte der Betrieb selbst anlegen) noch
-- rueckabwickelbar (nach dem Entsperren waere unklar, wer vorher schon
-- deaktiviert war). Die Sperre gehoert deshalb an den Betrieb; die Nutzer-
-- Sperre aus 0356 bleibt unberuehrt daneben bestehen und wirkt zusaetzlich.
--
-- DURCHSETZUNG (Wurzel 7) — DIESE SPALTE ALLEIN SPERRT NIEMANDEN:
-- Wer sich direkt gegen GoTrue anmeldet (`POST /auth/v1/token`, oeffentlicher
-- anon-Key), sieht kein FastAPI. Wie bei 0356 passiert die Sperre daher an
-- drei Stellen, und diese Spalte ist die Wahrheit, die alle drei lesen:
--   1. GoTrue-`ban_duration` auf JEDEM Auth-User des Betriebs — blockt neue
--      Logins und das Erneuern des Tokens (`PlatformAdminService`).
--   2. `core.security.get_current_user` (aktiv_gate) wirft 401, solange
--      `deactivated_at` steht — damit faellt auch ein bereits ausgestelltes
--      Token sofort, nicht erst nach bis zu einer Stunde Restlaufzeit.
--   3. `booking_engine.list_listings` blendet die Objekte des Betriebs aus —
--      sonst bliebe der Betrieb auf dem Marktplatz sichtbar und buchbar,
--      obwohl niemand mehr auf die Buchung reagieren koennte.
--
-- KEINE NEUEN GRANTS (Wurzel 6): `public.tenants` traegt Stammdaten des
-- Betriebs. Ein gesperrter Betrieb darf seine eigene Sperre nicht loeschen
-- koennen — geschrieben wird ausschliesslich vom Backoffice ueber
-- service_role. Diese Migration vergibt daher keine Rechte an anon/
-- authenticated und darf es nicht.

alter table public.tenants
    add column if not exists deactivated_at     timestamptz,
    add column if not exists deactivated_by     uuid references auth.users (id)
        on delete set null,
    add column if not exists deactivation_reason text;

comment on column public.tenants.deactivated_at is
    'Zeitpunkt der plattformseitigen Sperre; NULL = aktiv. Gesetzt vom '
    'Backoffice. Sperrt Login (PMS und myBestDays-Gastgeber) und nimmt alle '
    'Objekte vom Marktplatz. Die Spalte ist die Wahrheit, die GoTrue-Bann, '
    'aktiv_gate und der Marktplatz-Filter lesen (0405).';

comment on column public.tenants.deactivated_by is
    'Auth-User des Backoffice-Zugangs, der gesperrt hat (Audit). Verweist auf '
    'auth.users wie platform_admins.granted_by (0202), NICHT auf '
    'platform_admins — dessen Primaerschluessel ist user_id, und die Zeile darf '
    'entfallen, ohne die Sperre mitzunehmen. ON DELETE SET NULL (0405).';

comment on column public.tenants.deactivation_reason is
    'Grund der Sperre, im Backoffice erfasst. Wird dem Betrieb beim '
    'Anmeldeversuch NICHT angezeigt (er koennte Rueckschluesse auf interne '
    'Pruefungen zulassen), steht aber im Backoffice und im Audit-Log (0405).';

-- Der Marktplatz-Filter (booking_engine) fragt je Listing-Abruf, ob der Betrieb
-- gesperrt ist. Ohne Index waere das ein Seq-Scan ueber tenants bei jedem
-- Aufruf der oeffentlichen Suche. Partiell, weil nur die gesperrten Zeilen
-- gesucht werden — der Normalfall (NULL) bleibt aus dem Index heraus.
create index if not exists tenants_deactivated_idx
    on public.tenants (id)
    where deactivated_at is not null;
