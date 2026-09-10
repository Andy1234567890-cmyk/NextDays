-- 0617 — Doppelversand schliessen: atomares Claim + Dedup unabhaengig vom Lesestand
--
-- ANLASS (live gemeldet 09.09.2026): „hier kommen immer alte benachrichtungen
-- in den notfcaichon und die e-mails gehen auch doppelt raus." In der Glocke
-- standen dutzende Buchungen als frische Ereignisse, mehrere davon WORTGLEICH
-- doppelt, und die zugehoerigen Mails gingen zweimal hinaus.
--
-- Diese Migration deckt die zwei DB-seitigen Anteile daran ab. Die beiden
-- Code-Anteile (Bestandsimport ohne `bestandsimport=True`, Bell am Alter der
-- Nachricht statt an „unbekannt in unserer DB") stehen im selben Zug in
-- bookings_sync.py, buchungs_abgleich.py und nachrichten_eingang.py.

-- ---------------------------------------------------------------------------
-- TEIL 1 — `sendet` als Claim-Status der KI-Warteschlange
-- ---------------------------------------------------------------------------
-- WARUM: `dispatch_ki_autoantworten` waehlte `status='wartend'` aus, sendete,
-- und setzte den Status ERST DANACH. Zwischen Auswahl und Statuswechsel liegt
-- ein vollstaendiger Netzwerk-Roundtrip zum Portal (Channex/WhatsApp), also
-- hunderte Millisekunden bis Sekunden. Jeder Takt, der in diesem Fenster
-- dieselbe Zeile sieht, sendet sie erneut.
--
-- Dass das kein theoretisches Rennen ist, haengt an `main.py`: der Takt startet
-- im FastAPI-Lifespan, und der laeuft je uvicorn-Worker. Bei `UVICORN_WORKERS=4`
-- (Compose-Vorgabe) sind das vier unabhaengige Loops im Minutentakt; der
-- Ueberlappungs-Guard in `ki_takt.py` ist ein Modul-Global und damit
-- prozesslokal — er sieht die drei anderen Prozesse nicht.
--
-- Die beiden Zwillinge derselben Familie (`dispatch_due_automations`,
-- `dispatch_due_scheduled`) haben dieses Claim seit je, mit dem Kommentar
-- „Atomares Claim gegen ueberlappende Cron-Laeufe (kein Doppelversand)". Der
-- KI-Pfad hat es bei seiner Anlage (0494) nie bekommen.
--
-- OHNE DIESE MIGRATION waere der Claim im Code ein 500 BEIM LESEN: der
-- CHECK aus 0494 kennt `sendet` nicht, und ein abgewiesener Wert kippt nicht
-- nur den Schreibpfad.
-- Der CHECK aus 0494 steht INLINE in der Spaltendefinition und traegt damit
-- einen von Postgres generierten Namen. Ihn hier zu erraten
-- (`<tabelle>_<spalte>_check`) waere die Konvention, aber kein Beweis: liegt
-- der Name daneben, tut `drop ... if exists` stillschweigend nichts und das
-- anschliessende `add` scheitert an zwei widersprechenden Constraints. Deshalb
-- wird der Name AUS DEM KATALOG gelesen, statt ihn anzunehmen (Wurzel 4).
do $$
declare
    alt text;
begin
    select con.conname into alt
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'ki_autoantwort_warteschlange'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%status%'
      and pg_get_constraintdef(con.oid) like '%wartend%'
    limit 1;

    if alt is not null then
        execute format(
            'alter table public.ki_autoantwort_warteschlange '
            'drop constraint %I', alt
        );
    end if;
end $$;

alter table public.ki_autoantwort_warteschlange
    drop constraint if exists ki_warteschlange_status_gueltig;

alter table public.ki_autoantwort_warteschlange
    add constraint ki_warteschlange_status_gueltig
    check (status in ('wartend', 'sendet', 'gesendet', 'abgebrochen', 'fehler'));

-- Der Reaper sucht verwaiste `sendet`-Zeilen ueber `updated_at`. Ohne Index ist
-- das ein Full-Scan je Tick.
create index if not exists ki_warteschlange_sendet_idx
    on public.ki_autoantwort_warteschlange (updated_at)
    where status = 'sendet';

-- ---------------------------------------------------------------------------
-- TEIL 2 — Dedup, das nicht am Lesestand haengt
-- ---------------------------------------------------------------------------
-- WARUM: Der Index aus 0287 ist partiell auf `gelesen_am is null`:
--
--     create unique index notifications_dedup_offen_uq
--         on public.notifications (user_id, dedup_key)
--         where dedup_key is not null and gelesen_am is null;
--
-- Das ist fuer ZUSTANDS-Meldungen richtig und ausdruecklich so gewollt: „Balkon
-- hat kein Foto" darf nach dem Lesen erneut melden, sonst bliebe ein zweites
-- Auftreten fuer immer stumm.
--
-- Fuer EREIGNIS-Meldungen ist es falsch. Eine Buchung wird genau einmal
-- angelegt; „Neue Buchung" ist keine Zustandsbeschreibung, die erneut
-- zutreffen kann. Sobald der Nutzer die Meldung gelesen (oder „Alle gelesen"
-- gedrueckt) hatte, war der Riegel weg — und weil `dispatcher.sende()` den
-- Mailversand GENAU an diesem 23505 der Glocke entdoppelt, ging mit der
-- zweiten Glockenzeile auch die zweite Mail hinaus. Das ist die Bruecke
-- zwischen den beiden gemeldeten Symptomen: ein Fehler, nicht zwei.
--
-- WARUM EINE SPALTE UND KEINE PRAEFIX-LISTE IM INDEX: Ein Ausdrucks-Index auf
-- `split_part(dedup_key, ':', 1) in (…)` muesste jede neue Meldungsart in SQL
-- nachtragen — eine zweite Pflegestelle, die niemand findet, wenn in
-- `ereignisse.py` ein `dedup_key` dazukommt. Die Entscheidung „einmalig oder
-- wiederholbar" gehoert dorthin, wo die Meldung entsteht.
--
-- DEFAULT `false` = wiederholbar, also das bisherige Verhalten. Nur die
-- Aufrufer, die ein echtes Einzelereignis melden, setzen die Spalte; nichts
-- Bestehendes aendert sein Verhalten still.
alter table public.notifications
    add column if not exists einmalig boolean not null default false;

comment on column public.notifications.einmalig is
    'true = Einzelereignis (Buchung angelegt/storniert): darf NIE erneut '
    'melden, auch nicht nach dem Lesen. false = Zustandsmeldung (fehlendes '
    'Foto, offene Anfrage): darf nach dem Lesen erneut melden. Steuert, '
    'welcher der zwei UNIQUE-Indizes greift.';

-- Ein Eintrag je dedup_key und Nutzer — UNABHAENGIG vom Lesestand.
create unique index if not exists notifications_dedup_einmalig_uq
    on public.notifications (user_id, dedup_key)
    where dedup_key is not null and einmalig;
