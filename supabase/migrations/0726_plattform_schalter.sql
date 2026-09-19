-- 0726 — Plattformweite Schalter, erster davon: das Eigentuemer-Portal sperren.
--
-- WOZU: Das Eigentuemer-Portal soll voruebergehend fuer ALLE Eigentuemer aller
-- Betriebe zu sein, mit einem Hinweis statt einer leeren Seite. Das ist keine
-- Eigenschaft eines einzelnen Betriebs (dann waere es eine Spalte an `tenants`,
-- wie `zugang_gesperrt_ab` in 0724), sondern eine Eigenschaft der Plattform.
--
-- WARUM EINE TABELLE und keine Umgebungsvariable: eine Variable aendert man nur
-- mit Redeploy. Eine Sperre, deren Aufhebung einen Deploy braucht, bleibt im
-- Zweifel einen halben Tag laenger stehen als noetig. Hier genuegt ein
-- `update` — die naechste Anfrage sieht es.
--
-- WARUM EINE ZEILE und kein Schluessel/Wert-Speicher: ein generischer
-- Flag-Speicher laedt dazu ein, jede kuenftige Kleinigkeit dort abzulegen, und
-- niemand weiss danach, welche Schluessel es gibt und wer sie liest. Eine Zeile
-- mit benannten Spalten ist nachlesbar; jeder neue Schalter ist eine Migration
-- und damit sichtbar.
--
-- KEIN RIEGEL FUER SICH: Diese Zeile ist Zustand, nicht Durchsetzung. Wirksam
-- wird sie ausschliesslich dort, wo sie GEPRUEFT wird — serverseitig im
-- `public_portal`-Router (Wurzel 7: eine Sperre nur im Frontend umgeht jeder,
-- der sich direkt bei GoTrue anmeldet und die API selbst aufruft).

create table if not exists public.plattform_schalter (
    -- Genau EINE Zeile, erzwungen: Primaerschluessel `true` mit CHECK. Ohne das
    -- entstehen mit der Zeit zwei Zeilen, und welche gilt, entscheidet dann die
    -- Reihenfolge des `limit 1` — ein Fehler, der sich nie reproduzieren laesst.
    einzig boolean primary key default true check (einzig),

    -- NULL = Portal offen. Gesetzt = gesperrt, und der Wert sagt seit wann.
    -- Ein Zeitstempel statt eines booleschen Schalters, weil die Frage „seit
    -- wann eigentlich?" sonst niemand mehr beantworten kann.
    eigentuemer_portal_gesperrt_seit timestamptz,

    -- Was der Eigentuemer zu lesen bekommt. NULL = die Oberflaeche zeigt ihren
    -- uebersetzten Standardtext; ein eigener Text ueberschreibt ihn und steht
    -- dann in der Sprache, in der er hier eingetragen wurde.
    eigentuemer_portal_hinweis text,

    updated_at timestamptz not null default now()
);

comment on table public.plattform_schalter is
    'Plattformweite Schalter, genau eine Zeile. Zustand, kein Riegel — '
    'durchgesetzt wird im FastAPI-Guard.';

insert into public.plattform_schalter (einzig) values (true)
on conflict (einzig) do nothing;

-- Wurzel 6: die Zeile liest ausschliesslich der Server (service_role) und
-- reicht sie ueber /auth/me weiter. Kein Direktpfad, weder lesend noch
-- schreibend — sonst koennte ein eingeloggter Eigentuemer per
-- `PATCH /rest/v1/plattform_schalter` seine eigene Sperre aufheben.
alter table public.plattform_schalter enable row level security;

revoke select, insert, update, delete on public.plattform_schalter
    from anon, authenticated;

-- Restriktiv und `for all`, nicht nur `for select`: sonst bliebe der
-- SCHREIB-Pfad offen, falls spaeter versehentlich ein Grant gesetzt wird.
drop policy if exists plattform_schalter_nur_server on public.plattform_schalter;
create policy plattform_schalter_nur_server
    on public.plattform_schalter
    as restrictive
    for all
    using (false)
    with check (false);
