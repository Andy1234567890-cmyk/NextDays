-- Deploy-Spiegel: der Zustand aus Coolify in UNSERER Datenbank.
--
-- WARUM DIESE TABELLE EXISTIERT:
-- Der Deploy-Monitor im Backoffice zeigte den Zustand per Takt-Refresh (alle
-- paar Sekunden neu laden). Das ist Polling und widerspricht der Hausregel
-- „alles Realtime, kein Polling". Ein Supabase-Abo braucht aber eine Tabelle
-- in UNSERER DB — die Deploy-Daten liegen in Coolifys eigener Postgres, die
-- wir nicht abonnieren können.
--
-- Also spiegeln wir sie: ein Worker-Job liest Coolify und schreibt Änderungen
-- hierher; das Backoffice abonniert diese Tabelle und aktualisiert sich per
-- Push. Coolify bleibt die Quelle der Wahrheit, diese Tabelle ist nur der
-- Übertragungsweg (deshalb `spiegel` im Namen, kein eigener Zustand).

create table if not exists public.deploy_spiegel (
    -- Die Coolify-Anwendungs-UUID ist der natürliche Schlüssel: je Anwendung
    -- genau EINE Zeile, die fortgeschrieben wird (kein Verlauf — der kommt bei
    -- Bedarf weiterhin live aus Coolify).
    anwendung_uuid   text primary key,
    name             text        not null,
    status           text        not null,
    deployment_uuid  text,
    commit           text,
    commit_nachricht text,
    gestartet_at     timestamptz,
    beendet_at       timestamptz,
    -- Wann der Worker zuletzt nachgesehen hat. Steht das lange still, ist der
    -- Spiegel veraltet — sichtbar machen statt „alles ruhig" vorzutäuschen.
    geprueft_at      timestamptz not null default now(),
    aktualisiert_at  timestamptz not null default now()
);

create index if not exists deploy_spiegel_status_idx
    on public.deploy_spiegel (status);

alter table public.deploy_spiegel enable row level security;

-- Wurzel 6: `enable rls` allein genügt nicht. Schreiben darf ausschließlich
-- der Server (service_role) — sonst könnte ein eingeloggter Nutzer per
-- anon-Key einen falschen Deploy-Zustand hineinschreiben. LESEN muss
-- `authenticated` erlaubt sein, sonst ist das Realtime-Abo eine stumme
-- Attrappe; WELCHE Zeilen, entscheidet die Policy darunter.
revoke all on public.deploy_spiegel from anon, authenticated;
grant select on public.deploy_spiegel to authenticated;

-- Nur Backoffice-Nutzer. Kein Mandantenbezug: Deploys gehören der Plattform,
-- nicht einem Betrieb — ein Betriebs-Nutzer hat hier nichts zu suchen.
create policy deploy_spiegel_platform_read on public.deploy_spiegel
    for select to authenticated
    using (public.is_platform_admin());

-- Restriktiv für ALLE Kommandos: schließt den Schreibpfad mit, nicht nur
-- select (ein reines `for select` ließe insert/update/delete offen).
create policy deploy_spiegel_deny_write on public.deploy_spiegel
    as restrictive for all
    using (public.is_platform_admin())
    with check (false);

-- Realtime: das Backoffice abonniert diese Tabelle. Grant (oben) UND
-- Publikation müssen BEIDE stimmen, sonst ist das Abo eine Attrappe.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'deploy_spiegel'
    ) then
        alter publication supabase_realtime add table public.deploy_spiegel;
    end if;
end $$;

comment on table public.deploy_spiegel is
    'Spiegel des Deploy-Zustands aus Coolify, damit das Backoffice ihn per '
    'Realtime abonnieren kann statt zu pollen. Quelle der Wahrheit bleibt '
    'Coolify; geschrieben ausschließlich vom Worker (service_role).';
comment on column public.deploy_spiegel.geprueft_at is
    'Letzter Blick des Workers nach Coolify. Steht der Wert still, ist der '
    'Spiegel veraltet — das muss die UI zeigen, statt Ruhe vorzutäuschen.';
