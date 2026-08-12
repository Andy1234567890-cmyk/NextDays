-- Deploy-Ereignisse: der VERLAUF, den der Spiegel nicht führen kann.
--
-- WARUM DIESE TABELLE:
-- `deploy_spiegel` (0294/0345) hält je Anwendung GENAU EINE Zeile, die
-- fortgeschrieben wird. Das ist für „wie ist der Stand jetzt" richtig, macht
-- aber jede Geschichte unsichtbar: Sobald ein Dienst neu deployt, überschreibt
-- die neue Zeile die alte. Ein fehlgeschlagener Deploy von vorgestern ist damit
-- spurlos weg — im Backoffice war nie zu sehen, DASS er fehlschlug, geschweige
-- denn warum. Coolifys eigene Historie ist der einzige Ort, an dem er noch
-- steht, und die ist weder abonnierbar noch durchsuchbar.
--
-- Diese Tabelle sammelt deshalb an, statt fortzuschreiben: je fachlichem
-- ZUSTANDSWECHSEL einer Anwendung eine Zeile. Sie ist die Ereignis-Quelle für
-- den Live-Verlauf im Backoffice (Realtime-Abo) und das Gedächtnis über
-- Coolifys Retention hinaus.
--
-- WAS SIE NICHT IST: kein zweiter Zustand. Der aktuelle Stand kommt weiterhin
-- aus `deploy_spiegel`; hier steht, was passiert IST. Quelle der Wahrheit
-- bleibt Coolify.
--
-- ZUR FEHLERMELDUNG (der eigentliche Grund für die Tabelle):
-- Coolify liefert an der Deployment-Zeile KEIN Fehlerfeld — live gegen die
-- Coolify-Postgres geprüft (12.08.2026, 60 fehlgeschlagene Deploys):
-- `application_deployment_queues` hat Spalten für status/commit/logs, aber
-- keine für einen Fehlergrund. Die Ursache steht ausschließlich im Build-Log.
-- Deshalb zieht der Worker beim Übergang nach `failed` das Log und legt die
-- extrahierte Ursache hier ab (`fehler_text`), zusammen mit den letzten
-- Log-Zeilen als Beleg (`fehler_kontext`). Findet die Extraktion nichts,
-- bleibt `fehler_text` NULL — es wird NICHTS geraten (Wurzel 4).

create table if not exists public.deploy_ereignis (
    id               uuid primary key default gen_random_uuid(),
    -- Welche Anwendung. Kein FK auf deploy_spiegel: dessen Zeile darf
    -- verschwinden (App aus der Liste genommen), das Ereignis bleibt wahr.
    anwendung_uuid   text        not null,
    name             text        not null,
    -- Der Zustandswechsel, der dieses Ereignis ausgelöst hat. `von` ist NULL,
    -- wenn wir die Anwendung zum ersten Mal sehen — dann ist es kein Wechsel,
    -- sondern ein Erstbefund, und genau das soll man unterscheiden können.
    status_von       text,
    status_nach      text        not null,
    -- Der Deploy, um den es geht (Coolifys UUID + numerische ID).
    deployment_uuid  text,
    deploy_id        bigint,
    commit           text,
    commit_nachricht text,
    log_url          text,
    -- Zeiten AUS COOLIFY (Wurzel 5b: fremdes Ereignis, fremde Uhr).
    gestartet_at     timestamptz,
    beendet_at       timestamptz,
    -- Die extrahierte Fehlerursache. NULL bei Erfolg — und auch dann, wenn ein
    -- Fehlschlag vorliegt, aus dem Log aber keine Ursache lesbar war. Beides
    -- ist ehrlicher als ein erfundener Text.
    fehler_text      text,
    -- Wie die Ursache gefunden wurde: 'deployment_failed' (Coolifys eigene
    -- Fehlerzeile), 'healthcheck' (Container nicht gesund → Rollback),
    -- 'stderr' (letzte Fehlerausgabe), 'kein_log' (Coolify hatte kein Log),
    -- 'unbekannt' (Log da, kein Muster erkannt). Macht auswertbar, wie gut die
    -- Extraktion trägt, statt sie schweigend danebenliegen zu lassen.
    fehler_quelle    text,
    -- Beleg: die letzten sichtbaren Log-Zeilen rund um den Fehler, gedeckelt.
    -- Damit man im Backoffice den Grund SIEHT, ohne das ganze Log zu ziehen.
    fehler_kontext   text,
    -- UNSERE Uhr — der Zeitpunkt, zu dem der Worker den Wechsel bemerkt hat.
    -- Bewusst getrennt von gestartet_at/beendet_at (Wurzel 5b).
    erkannt_at       timestamptz not null default now()
);

-- Der Verlauf wird IMMER zeitlich absteigend gelesen, je App oder gesamt.
create index if not exists deploy_ereignis_zeit_idx
    on public.deploy_ereignis (erkannt_at desc);
create index if not exists deploy_ereignis_app_idx
    on public.deploy_ereignis (anwendung_uuid, erkannt_at desc);
-- Für „nur Fehler zeigen" — der häufigste Filter der Oberfläche.
create index if not exists deploy_ereignis_fehler_idx
    on public.deploy_ereignis (erkannt_at desc)
    where status_nach = 'failed';

-- IDEMPOTENZ (Wurzel 2): Der Worker tickt alle 5 s. Zwischen zwei Ticks kann
-- derselbe Zustand mehrfach gesehen werden — etwa wenn der Spiegel-Schreibpfad
-- retryt oder zwei Worker-Instanzen laufen. Ohne Backstop stünde derselbe
-- Fehlschlag dann drei- oder viermal im Verlauf.
-- Der Schlüssel ist (Deploy, Zielzustand): EIN Deploy geht genau einmal nach
-- `failed`, einmal nach `finished`. `deployment_uuid` kann NULL sein (App ohne
-- bekannten Deploy) — dann greift der Index nicht, deshalb partiell.
create unique index if not exists deploy_ereignis_wechsel_uidx
    on public.deploy_ereignis (deployment_uuid, status_nach)
    where deployment_uuid is not null;

alter table public.deploy_ereignis enable row level security;

-- Wurzel 6: `enable rls` + Policy genügt nicht. Schreiben darf ausschließlich
-- der Server (service_role); sonst könnte ein eingeloggter Nutzer per anon-Key
-- eine erfundene Deploy-Historie hineinschreiben. LESEN muss `authenticated`
-- erlaubt sein, sonst ist das Realtime-Abo eine stumme Attrappe — WELCHE
-- Zeilen, entscheidet die Policy darunter.
revoke all on public.deploy_ereignis from anon, authenticated;
grant select on public.deploy_ereignis to authenticated;

-- Nur Backoffice-Nutzer. Kein Mandantenbezug: Deploys gehören der Plattform,
-- nicht einem Betrieb — ein Betriebs-Nutzer hat hier nichts zu suchen.
create policy deploy_ereignis_platform_read on public.deploy_ereignis
    for select to authenticated
    using (public.is_platform_admin());

-- Restriktiv für ALLE Kommandos: schließt den Schreibpfad mit, nicht nur
-- select (ein reines `for select` ließe insert/update/delete offen).
create policy deploy_ereignis_deny_write on public.deploy_ereignis
    as restrictive for all
    using (public.is_platform_admin())
    with check (false);

-- Realtime: der Verlauf im Backoffice hört hier zu. Grant (oben) UND
-- Publikation müssen BEIDE stimmen, sonst ist das Abo eine Attrappe.
-- REPLICA IDENTITY bleibt DEFAULT (wie deploy_spiegel): die Oberfläche
-- filtert clientseitig, ein serverseitiger Filter auf alte Werte wird nicht
-- gebraucht — INSERTs tragen ihre Nutzlast ohnehin vollständig.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'deploy_ereignis'
    ) then
        alter publication supabase_realtime add table public.deploy_ereignis;
    end if;
end $$;

comment on table public.deploy_ereignis is
    'Verlauf der Deploy-Zustandswechsel je Anwendung (der Spiegel haelt nur '
    'den JETZT-Stand und ueberschreibt ihn). Traegt bei Fehlschlaegen die aus '
    'dem Coolify-Build-Log extrahierte Ursache, weil Coolify an der '
    'Deployment-Zeile kein Fehlerfeld liefert. Nur Server schreibt.';
comment on column public.deploy_ereignis.status_von is
    'Zustand VOR dem Wechsel. NULL = Erstbefund (Anwendung zum ersten Mal '
    'gesehen), kein Wechsel.';
comment on column public.deploy_ereignis.fehler_text is
    'Extrahierte Fehlerursache aus dem Build-Log. NULL bei Erfolg ODER wenn '
    'aus dem Log keine Ursache lesbar war — nie ein geratener Text.';
comment on column public.deploy_ereignis.fehler_quelle is
    'Wie die Ursache gefunden wurde: deployment_failed | healthcheck | stderr '
    '| kein_log | unbekannt. Macht die Trefferquote der Extraktion auswertbar.';
comment on column public.deploy_ereignis.erkannt_at is
    'UNSERE Uhr: wann der Worker den Wechsel bemerkt hat. NICHT der Zeitpunkt '
    'des Deploys — der steht in gestartet_at/beendet_at (Wurzel 5b).';
