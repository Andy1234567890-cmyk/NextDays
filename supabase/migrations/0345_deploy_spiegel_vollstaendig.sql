-- Deploy-Spiegel vervollständigen: der Lesepfad soll IHN lesen, nicht Coolify.
--
-- WARUM DIESE MIGRATION:
-- 0294 hat die Tabelle `public.deploy_spiegel` angelegt und der Worker füllt
-- sie — aber der Lesepfad (`GET /api/v1/platform/deploy`) hat sie nie benutzt.
-- Er rief bei JEDEM Request Coolify seriell ab (ein Aufruf für die laufenden
-- Deploys, ein `verlauf`-Aufruf JE nicht laufender App, dazu `watch_paths` und
-- der GitHub-`/compare` je ausgerolltem Commit mit 20 s Timeout). Weil das
-- Backoffice bei jedem Realtime-Event von `deploy_spiegel` neu lädt und der
-- Worker während eines Baus alle 5 s schreibt, hing die Oberfläche bei jedem
-- Event mehrere Sekunden. Ereignis-Quelle und Daten-Quelle waren verschieden.
--
-- Damit der Lesepfad wirklich NUR noch diese Tabelle braucht, muss sie alles
-- tragen, was `DeployUebersicht` ausliefert. 0294 deckte nur den letzten
-- Deploy-Kern ab; es fehlten:
--   * `deploy_id`   — Coolifys numerische Deployment-ID (DeployEintrag.id)
--   * `anwendung`   — der von Coolify gemeldete Anwendungsname (kann vom Namen
--                     aus unserer geführten Liste abweichen; beide ausliefern
--                     statt einen zu raten)
--   * `log_url`     — Direktlink in Coolifys Log-Ansicht
--   * `laeuft`      — baut diese App GERADE (aus Coolifys Liste der laufenden
--                     Deploys; nicht aus `status` ableitbar, weil ein Eintrag
--                     aus dem Verlauf denselben Status tragen kann)
--   * `rueckstand`  — das Ergebnis des GitHub-/compare (DeployRueckstand als
--                     JSONB). Der teuerste Teil des alten Request-Pfads; er
--                     gehört in den Worker-Tick, nicht in den Seitenaufbau.
--   * `main_sha`    — Kopf von `main`, gegen den verglichen wurde. Je Zeile
--                     mitgeführt, weil der Rückstand ohne seinen Bezugspunkt
--                     nicht interpretierbar ist.
--
-- KEINE Ersatzwerte (Wurzel 4): alle neuen Spalten sind nullable. Konnte der
-- Worker etwas nicht ermitteln (kein GitHub-Token, Coolify-Teilausfall), steht
-- dort NULL und die API liefert null — nicht 0 und nicht "unbekannt".

alter table public.deploy_spiegel
    add column if not exists deploy_id  bigint,
    add column if not exists anwendung  text,
    add column if not exists log_url    text,
    -- `laeuft` hat einen Default, weil es eine Ja/Nein-Aussage des Workers ist:
    -- schreibt er die Zeile, sagt er beides ausdrücklich. false ist hier kein
    -- geratener Ersatzwert, sondern der Zustand "baut gerade nicht".
    add column if not exists laeuft     boolean not null default false,
    add column if not exists rueckstand jsonb,
    add column if not exists main_sha   text;

comment on column public.deploy_spiegel.deploy_id is
    'Coolifys numerische Deployment-ID des letzten/laufenden Deploys.';
comment on column public.deploy_spiegel.anwendung is
    'Anwendungsname, wie Coolify ihn am Deployment meldet. Kann vom gefuehrten '
    'Namen (Spalte name) abweichen; beide werden ausgeliefert, keiner geraten.';
comment on column public.deploy_spiegel.log_url is
    'Direktlink in Coolifys Log-Ansicht des Deploys. NULL, wenn Coolify keinen '
    'liefert.';
comment on column public.deploy_spiegel.laeuft is
    'Baut diese Anwendung GERADE (aus Coolifys Liste laufender Deploys). Nicht '
    'aus status ableitbar: ein Verlaufseintrag kann denselben Status tragen.';
comment on column public.deploy_spiegel.rueckstand is
    'DeployRueckstand als JSONB: was zwischen ausgerolltem Stand und main '
    'liegt und die watch_paths DIESER App beruehrt (GitHub /compare). Steht im '
    'Spiegel, weil der Abruf zu teuer fuer den Request-Pfad ist. NULL = vom '
    'Worker (noch) nicht ermittelt.';
comment on column public.deploy_spiegel.main_sha is
    'Kopf von main zum Zeitpunkt der Rueckstands-Ermittlung. Ohne ihn ist der '
    'Rueckstand nicht interpretierbar. NULL = nicht abrufbar (kein GitHub-Zugang).';

-- Nur der Vollstaendigkeit halber: Grants, RLS-Policies und die Mitgliedschaft
-- in `supabase_realtime` stehen bereits aus 0294 und gelten tabellenweit —
-- neue Spalten erben sie. Kein `grant` noetig, und vor allem kein zusaetzliches:
-- Wurzel 6 verlangt hier weiterhin `select` NUR fuer authenticated (Policy
-- `deploy_spiegel_platform_read` schraenkt auf is_platform_admin ein) und
-- KEIN insert/update/delete ausser service_role.
