-- 0337 — Offizielle Ankündigungen (Neuerungen) des Plattform-Betreibers.
--
-- WOFÜR: Das Plattform-Team braucht einen Weg, allen myNextDays-Betrieben eine
-- redaktionelle Eins-an-alle-Mitteilung zuzustellen (neue Funktion, Wartungs-
-- fenster, wichtiger Hinweis). Dafür gab es bisher nichts: `notifications`
-- (0331) ist eine Ereignis-Glocke PRO Nutzer und Mandant, `host_messages` ist
-- Gast↔Betrieb, `support_tickets` ist bidirektional und fallbezogen. Keine
-- dieser Tabellen trägt eine Mitteilung, die für ALLE gilt.
--
-- WARUM `announcements` KEINE tenant_id hat: eine Ankündigung gilt für jeden
-- Betrieb. Eine Kopie je Mandant wäre dieselbe Wahrheit an N Orten — bei einer
-- Korrektur müsste man N Zeilen nachziehen und hätte nach dem ersten Fehlschlag
-- N verschiedene Texte (Wurzel 4). Der Mandantenbezug entsteht erst beim LESEN
-- (wer hat quittiert) und steht deshalb ausschließlich in `announcement_reads`.

create table if not exists public.announcements (
    id uuid primary key default gen_random_uuid(),

    titel text not null,

    -- TipTap-HTML. Wird BEIM SPEICHERN serverseitig mit nh3 (Allowlist-Parser)
    -- gesäubert, nicht erst beim Rendern (Wurzel 8) — was hier steht, ist
    -- bereits bereinigt. Ein Renderer darf sich darauf trotzdem nicht
    -- verlassen, aber die Spalte ist kein Stored-XSS-Depot.
    inhalt_html text not null default '',

    -- Ein bis zwei Sätze für Popup-Kopf und Listen-Karte. Bewusst getrennt vom
    -- Inhalt: die Liste soll nicht das erste Absatz-Fragment des HTML anreißen.
    kurztext text,

    -- entwurf = nur im Backoffice sichtbar, veroeffentlicht = beim Kunden,
    -- archiviert = zurückgezogen (bleibt in der Historie, erscheint nicht mehr).
    -- CHECK statt Enum: ein weiterer Zustand soll eine bewusste Migration sein,
    -- aber kein `create type`-Umbau mit Abhängigkeiten.
    status text not null default 'entwurf'
        check (status in ('entwurf', 'veroeffentlicht', 'archiviert')),

    -- Der fachliche Veröffentlichungs-Zeitpunkt, gesetzt beim Umschalten auf
    -- 'veroeffentlicht'. NICHT `created_at` verwenden: das ist unsere
    -- Verarbeitungszeit des Entwurfs und sagt nichts darüber, ab wann die
    -- Mitteilung gilt (Wurzel 5b). Er ist zugleich die Sortierung der Historie
    -- und die Grenze des Neukunden-Filters.
    veroeffentlicht_am timestamptz,

    -- Begrenzt NUR das Popup, nicht die Liste: ein abgelaufenes Wartungsfenster
    -- soll niemanden mehr unterbrechen, aber in der Historie nachlesbar
    -- bleiben. NULL = unbegrenzt.
    gueltig_bis timestamptz,

    -- false = erscheint ausschließlich auf /neuerungen, unterbricht niemanden.
    als_popup boolean not null default true,

    kategorie text not null default 'neuerung'
        check (kategorie in ('neuerung', 'wartung', 'hinweis', 'wichtig')),

    -- Wer sie verfasst hat. `on delete set null`: scheidet jemand aus dem
    -- Plattform-Team aus, bleibt die Ankündigung bestehen — sie gehört der
    -- Plattform, nicht der Person. Kein FK auf public.users: der Verfasser ist
    -- ein Backoffice-Nutzer (platform_admins), kein Betriebs-Nutzer.
    erstellt_von uuid references auth.users (id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.announcements is
    'Redaktionelle Eins-an-alle-Mitteilungen des Plattform-Betreibers (0337). '
    'Bewusst OHNE tenant_id: eine Ankuendigung gilt fuer alle Betriebe. Fuer '
    'anon/authenticated vollstaendig gesperrt (Wurzel 6).';
comment on column public.announcements.inhalt_html is
    'TipTap-HTML, beim Speichern serverseitig per nh3-Allowlist gesaeubert.';
comment on column public.announcements.veroeffentlicht_am is
    'Fachlicher Veroeffentlichungs-Zeitpunkt (nicht created_at, Wurzel 5b). '
    'Grenze des Neukunden-Filters: aeltere Ankuendigungen poppen bei einem '
    'frisch registrierten Betrieb nicht auf.';
comment on column public.announcements.gueltig_bis is
    'Begrenzt NUR das Popup, nicht die Historie.';

-- Der EINE Zugriff aus dem Kundendashboard: veröffentlichte Ankündigungen in
-- Erscheinungsreihenfolge. Partiell, weil Entwürfe und Archiviertes für diesen
-- Pfad nie in Frage kommen und der Index sonst mit der Historie mitwächst.
create index if not exists announcements_veroeffentlicht_idx
    on public.announcements (veroeffentlicht_am desc)
    where status = 'veroeffentlicht';


-- == Quittierungen ==========================================================
-- Eigene Tabelle, weil N Nutzer dieselbe Ankündigung quittieren (m:n) — ein
-- Array-Feld auf `announcements` wäre bei gleichzeitigem Schließen durch zwei
-- Nutzer ein Lost-Update.
create table if not exists public.announcement_reads (
    id uuid primary key default gen_random_uuid(),

    announcement_id uuid not null
        references public.announcements (id) on delete cascade,

    -- Kein FK auf auth.users: dieselbe Begründung wie in 0334 — das Schema
    -- gehört GoTrue, und ein FK dorthin macht das Löschen eines Auth-Nutzers
    -- von unserer Tabelle abhängig. Verwaiste Zeilen sind unschädlich.
    user_id uuid not null,

    -- Für Auswertung („welcher Betrieb hat gelesen") und Aufräumen beim
    -- Mandanten-Ende. Fuer die Quittierungs-Logik selbst nicht nötig: der
    -- Nutzer identifiziert die Zeile.
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    -- NOT NULL mit Absicht: „nicht quittiert" ist die ABWESENHEIT der Zeile,
    -- kein NULL. Sonst gäbe es zwei Darstellungen desselben Zustands und die
    -- Popup-Abfrage müsste beide kennen.
    -- Der Name sagt bewusst *quittiert*, nicht *gesehen*: gesehen wird beim
    -- Rendern, quittiert wird durch aktives Schließen. Hieße die Spalte
    -- `gesehen_am`, schriebe der naechste Entwickler beim Rendern hinein und
    -- das Popup waere nach dem ersten Blitzen weg.
    quittiert_am timestamptz not null default now()
);

comment on table public.announcement_reads is
    'Wer welche Ankuendigung aktiv quittiert hat (0337). Abwesenheit der Zeile '
    '= nicht quittiert. Fuer anon/authenticated vollstaendig gesperrt '
    '(Wurzel 6): sonst koennte ein Mitarbeiter fuer eine fremde user_id '
    'quittieren und damit ein Popup unterdruecken.';
comment on column public.announcement_reads.quittiert_am is
    'Zeitpunkt des aktiven Schliessens. NOT NULL — nicht quittiert = keine Zeile.';

-- Wurzel 2 (Idempotenz) als DB-Backstop: Doppelklick, Retry nach Timeout und
-- Redelivery kommen real doppelt an. Der Service quittiert per
-- `upsert(..., ignore_duplicates=True)`; dieser Index ist der Grund, warum das
-- funktioniert — und er sorgt dafür, dass ein Retry den urspruenglichen
-- Zeitpunkt NICHT nach vorn schiebt (`ignore`, nicht `merge`).
create unique index if not exists announcement_reads_uq
    on public.announcement_reads (announcement_id, user_id);

-- Der zweite Roundtrip der Popup-Abfrage: „welche dieser Kandidaten hat DIESER
-- Nutzer schon quittiert". Index-Only-Scan über beide Spalten.
create index if not exists announcement_reads_user_idx
    on public.announcement_reads (user_id, announcement_id);

-- Leserate im Backoffice: „wie viele haben Ankuendigung X quittiert, wann".
create index if not exists announcement_reads_announcement_idx
    on public.announcement_reads (announcement_id, quittiert_am desc);


-- == Wurzel 6: DB-Direktpfad (PostgREST/Realtime mit anon-Key) ===============
-- Ein Client mit gültigem JWT + öffentlichem anon-Key spricht PostgREST DIREKT
-- an; der FastAPI-Layer wird dabei komplett umgangen. Jede Rollen- und
-- Zielgruppenprüfung im Service ist gegen `curl /rest/v1/announcements`
-- wirkungslos. Deshalb hier, auf DB-Ebene:
--   • LESEN von `announcements` waere fuer JEDEN eingeloggten Nutzer JEDES
--     Betriebs offen — inklusive der ENTWUERFE. „Wartungsfenster am 3." oder
--     eine noch unveroeffentlichte Preisaenderung waeren damit oeffentlich,
--     bevor das Team sie freigibt.
--   • LESEN von `announcement_reads` waere die Quittierungshistorie der
--     Vorgesetzten (wer war wann im System).
--   • SCHREIBEN in `announcement_reads` waere das Unterdruecken fremder Popups:
--     eine Zeile mit fremder user_id genuegt, damit die Mitteilung dort nie
--     erscheint.
--   • SCHREIBEN in `announcements` waere eine Falschmeldung im Namen der
--     Plattform an ALLE Kunden.
-- Nur service_role (unser Server) arbeitet hier.

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- (a) Grants entziehen. `enable rls` + Policy allein reicht NICHT: ohne
-- Grant-Entzug bliebe der Weg offen, sobald jemand spaeter eine permissive
-- Policy ergaenzt.
revoke all on public.announcements from anon, authenticated;
revoke all on public.announcement_reads from anon, authenticated;

-- (b) Restriktive Deny-all-Policy als zweiter, unabhaengiger Riegel. Bewusst
-- `for all` (nicht nur `for select`): sonst waere der SCHREIB-Pfad offen,
-- sobald ein Grant zurueckkommt. RESTRICTIVE heisst: diese Bedingung MUSS
-- zusaetzlich erfuellt sein — `false` kann keine spaetere permissive Policy
-- uebersteuern. service_role umgeht RLS ohnehin.
drop policy if exists announcements_deny_all on public.announcements;
create policy announcements_deny_all
    on public.announcements
    as restrictive
    for all
    to anon, authenticated
    using (false)
    with check (false);

drop policy if exists announcement_reads_deny_all on public.announcement_reads;
create policy announcement_reads_deny_all
    on public.announcement_reads
    as restrictive
    for all
    to anon, authenticated
    using (false)
    with check (false);

-- (c) Dritter Riegel: Zielgruppe. Greift erst, falls jemand spaeter bewusst ein
-- `grant select` zurueckgibt UND die Deny-all-Policy dabei lockert — dann steht
-- immer noch die fachliche Regel „nur admin/co_admin", statt dass die Tabelle
-- fuer cleaner/staff/owner aufgeht. Restriktiv und `for all`, aus demselben
-- Grund wie oben. `current_user_role()` (0058) liest die Rolle aus dem
-- JWT-Claim; das ist bis zu eine Stunde alt und deshalb hier NUR ein
-- zusaetzlicher Riegel — die verbindliche, frische Pruefung macht der Service
-- gegen public.users.
drop policy if exists announcements_nur_leitung on public.announcements;
create policy announcements_nur_leitung
    on public.announcements
    as restrictive
    for all
    to anon, authenticated
    using (public.current_user_role() in ('admin', 'co_admin'))
    with check (public.current_user_role() in ('admin', 'co_admin'));

drop policy if exists announcement_reads_nur_leitung on public.announcement_reads;
create policy announcement_reads_nur_leitung
    on public.announcement_reads
    as restrictive
    for all
    to anon, authenticated
    using (public.current_user_role() in ('admin', 'co_admin'))
    with check (public.current_user_role() in ('admin', 'co_admin'));

-- BEWUSST KEINE Realtime-Publikation (kein `alter publication supabase_realtime
-- add table ...`). Ein Abo wirkt nur mit `grant select to authenticated` —
-- damit waere die Tabelle fuer jeden eingeloggten Nutzer jedes Betriebs offen,
-- inklusive Entwuerfen; genau das schliesst der Block oben. Ankuendigungen sind
-- redaktionell und erscheinen beim Login, Live-Zustellung ist nicht gefordert.
-- Ein Abo hier waere eine stumme Attrappe (CLAUDE.md „Realtime").
-- FOLGE FUERS BACKOFFICE-UI: die Zusage lautet „erscheint beim naechsten
-- Login", nicht „sofort".
