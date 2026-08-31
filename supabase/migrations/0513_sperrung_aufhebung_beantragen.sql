-- 0513 — Der Eigentümer kann die Aufhebung einer Sperrung beantragen.
--
-- WAS FEHLTE: Der Sperrantrag kannte genau eine Richtung. Ein Eigentümer konnte
-- sperren lassen, aber nichts zurücknehmen — weder einen offenen Antrag noch
-- eine erteilte Genehmigung. Der Widerruf existiert (`sperrantraege.
-- zuruecknehmen`), liegt aber hinter der Agentur-Berechtigung `_APPROVE`; das
-- Portal hat nur POST (anlegen) und GET (lesen).
--
-- Real heißt das: „Wir kommen doch nicht" ging nur per Anruf, und bis jemand
-- ihn umsetzte, blieben die Nächte aus dem Verkauf. Genau die Nächte, die
-- jemand freiwillig zurückgeben wollte.
--
-- ZWEI WEGE, WEIL ES ZWEI VERSCHIEDENE LAGEN SIND:
--
--   * OFFENER Antrag (`status='pending'`): Es ist nichts gesperrt, also gibt es
--     keinen Gegenzustand. Der Eigentümer zieht seinen EIGENEN Antrag zurück,
--     die Agentur muss dafür nichts tun. Das ist keine Entscheidung über
--     Inventar, sondern die Rücknahme einer eigenen Erklärung.
--   * GENEHMIGTER Antrag (`status='approved'`): Hier hängt eine Reservierung
--     (`is_owner_stay`, 0353) samt Kalenderbelegung und Portal-Push daran. Die
--     Aufhebung ist ein ANTRAG, den die Agentur entscheidet — dieselbe Logik
--     wie beim Sperren (§4.2: der Eigentümer beantragt, er entscheidet nicht).
--     Erst ihre Zustimmung ruft den bestehenden Widerruf auf.
--
-- KEIN NEUER ENUM-WERT, sondern eine eigene Spalte — dieselbe Begründung wie
-- bei `owner_freigabe` (0389), und sie wiegt hier genauso schwer:
--
--   1. TECHNISCH: apply-migrations.sh fährt jede Migration in EINER
--      Transaktion. Postgres verbietet, einen frisch per `alter type … add
--      value` erzeugten Enum-Wert in derselben Transaktion zu verwenden.
--   2. FACHLICH: An `status='approved'` hängen der EXCLUDE-Constraint
--      `block_requests_kein_ueberlapp` (0377) und die Reservierung. Ein
--      vierter Wert im Enum hieße, dass jede Verzweigung im Code ihn kennen
--      muss — und die eine, die ihn vergisst, verkauft ein Haus, das gesperrt
--      sein sollte. Solange die Aufhebung nur BEANTRAGT ist, bleibt die Sperre
--      real bestehen, und der Status muss das auch sagen.

do $$
begin
    if not exists (select 1 from pg_type where typname = 'aufhebung_status') then
        create type public.aufhebung_status as enum (
            -- Niemand hat eine Aufhebung beantragt. Der Normalfall und der
            -- gesamte Altbestand.
            'keine',
            -- Der Eigentümer hat sie beantragt, die Agentur hat noch nicht
            -- entschieden. Die Sperre besteht in dieser Zeit WEITER — das ist
            -- der Kern: ein Antrag ist keine Freigabe.
            'beantragt',
            -- Die Agentur hat aufgehoben; der Widerruf ist gelaufen und die
            -- Nächte sind frei. Der Antrag steht dann auf status='rejected'
            -- (der Widerruf nutzt diesen Zielzustand, siehe `zuruecknehmen`).
            'aufgehoben',
            -- Die Agentur hat die Aufhebung abgelehnt: die Sperre bleibt.
            'abgelehnt'
        );
    end if;
end $$;

alter table public.block_requests
    add column if not exists aufhebung public.aufhebung_status
        not null default 'keine',
    add column if not exists aufhebung_grund text,
    add column if not exists aufhebung_beantragt_am timestamptz,
    add column if not exists aufhebung_entschieden_von uuid
        references public.users (id) on delete set null,
    add column if not exists aufhebung_entschieden_am timestamptz,
    add column if not exists aufhebung_entscheidungsnotiz text;

comment on column public.block_requests.aufhebung is
    'Antrag des Eigentuemers, diese GENEHMIGTE Sperrung wieder aufzuheben '
    '(0513). Solange er auf beantragt steht, besteht die Sperre WEITER — der '
    'Kalender wird erst durch die Entscheidung der Agentur frei.';
comment on column public.block_requests.aufhebung_grund is
    'Warum der Eigentuemer die Sperrung nicht mehr braucht. Freitext; daraus '
    'wird NICHTS abgeleitet (Wurzel 4), er dient der Entscheidung der Agentur.';
comment on column public.block_requests.aufhebung_beantragt_am is
    'Wann der Eigentuemer die Aufhebung beantragt hat. UNSERE Uhr ist hier '
    'korrekt: die Handlung passiert in diesem System (Wurzel 5b greift nicht).';

-- Ein Datum darf nur dastehen, wenn auch jemand entschieden hat — sonst
-- behauptete die Zeile eine Entscheidung ohne Entscheider. Dasselbe Muster wie
-- `block_requests_owner_entscheidung` (0389).
alter table public.block_requests
    drop constraint if exists block_requests_aufhebung_entscheidung;
alter table public.block_requests
    add constraint block_requests_aufhebung_entscheidung check (
        (aufhebung_entschieden_am is null) = (aufhebung_entschieden_von is null)
    );

-- Eine entschiedene Aufhebung braucht einen Entscheider, eine unentschiedene
-- darf keinen haben (Wurzel 5, fail-closed gegen eine Zeile, die eine
-- Entscheidung behauptet, die niemand getroffen hat).
alter table public.block_requests
    drop constraint if exists block_requests_aufhebung_spur;
alter table public.block_requests
    add constraint block_requests_aufhebung_spur check (
        (aufhebung in ('aufgehoben', 'abgelehnt'))
        = (aufhebung_entschieden_am is not null)
    );

-- Ein Antrag ohne Beantragungsdatum ist kein Antrag. Ohne diesen Riegel könnte
-- `aufhebung='beantragt'` ohne Zeitpunkt stehen, und die Warteschlange der
-- Agentur hätte nichts zu sortieren.
alter table public.block_requests
    drop constraint if exists block_requests_aufhebung_beantragt;
alter table public.block_requests
    add constraint block_requests_aufhebung_beantragt check (
        (aufhebung = 'keine') = (aufhebung_beantragt_am is null)
    );

-- Die Warteschlange der Agentur: „welche Aufhebungen warten auf mich".
-- Partiell, weil der Normalfall 'keine' ist und nicht indiziert gehört.
create index if not exists block_requests_aufhebung_offen_idx
    on public.block_requests (tenant_id, aufhebung_beantragt_am)
    where aufhebung = 'beantragt';
