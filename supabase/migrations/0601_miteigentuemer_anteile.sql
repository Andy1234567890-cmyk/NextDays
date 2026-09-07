-- 0601 — Miteigentümer: ein Objekt darf mehreren Eigentümern gehören.
--
-- WARUM (Ansage des Betriebs, 07.09.2026): „Ja es muss ein miteigentümer
-- geben". Damit wird ADR-0026 („ein Eigentümer je Objekt, Miteigentum über die
-- Stammdaten DIESES Eigentümers") aufgehoben und durch ADR-0028 ersetzt.
--
-- Der Anteil existiert seit 0063 (`owner_properties.ownership_share`, Default
-- 100) samt Eingabefeld in der Oberfläche — nur DREI Dinge fehlten: die
-- Exklusiv-Sperre aus 0073 verhindert den zweiten Eigentümer, kein Riegel hält
-- die Anteilssumme bei 100, und die Rechenkette der Abrechnung liest den Anteil
-- gar nicht (nur Kartei und Dossier-PDF zeigen ihn an).
--
-- ═══ TEIL 1: den Bestand entwirren (Absicht, nicht Etikett) ═══
--
-- Live gemessen am 07.09.2026, alle 22 Zuordnungen:
--
--   share=100  prov_ovr=NULL   ZZTest Haus Beta
--   share=100  prov_ovr=12.5   ZZTest Haus Alpha
--   share= 80  prov_ovr=20.0   Bedstefars lille skovhus
--   share= 80  prov_ovr=20.0   Feriehus Line
--   … 17 Zeilen dieser Form …
--   share=100  prov_ovr=NULL   FeWo *Stjerneskud*
--
-- Das Muster ist eindeutig: `share = 100 - prov_ovr`. Bei JEDER dieser 17
-- Zeilen ist genau EIN Eigentümer eingetragen — es gibt im ganzen Bestand kein
-- Objekt mit mehr als einem. Das Feld trug also nicht den Miteigentumsanteil,
-- sondern die Auszahlungsquote nach Provision; ein zweiter Ausdruck derselben
-- 20 %, die schon in `commission_override_pct` stehen.
--
-- Würde die Rechenkette diesen Wert ab jetzt als Anteil verwenden, zöge sie die
-- Provision ZWEIMAL ab: René Dahl Nielsen bekäme statt 3.736,00 DKK nur
-- 2.988,80 DKK je Buchung — ein stiller Fehler von 20 %, der wie eine
-- Rundungsdifferenz aussieht.
--
-- Deshalb wird der Anteil dort auf 100 gesetzt, wo ein Objekt genau EINEN
-- Eigentümer hat: dann und nur dann ist „100 %" nachweislich richtig, ganz
-- unabhängig davon, wie der Wert gemeint war. Objekte mit mehreren
-- Eigentümern (heute keine) bleiben unangetastet — dort wäre eine Änderung
-- eine Behauptung über die Aufteilung, die diese Migration nicht treffen darf.
-- Freigabe des Nutzers am 07.09.2026, nachdem die 22 Zeilen vorlagen.

update public.owner_properties op
   set ownership_share = 100
 where op.ownership_share <> 100
   and (
     select count(*)
       from public.owner_properties x
      where x.property_id = op.property_id
   ) = 1;

-- ═══ TEIL 2: die Exklusiv-Sperre aus 0073 lösen ═══
--
-- 0073 setzte `unique (property_id)`: ein Objekt in höchstens einem Link.
-- Genau das verhindert Miteigentum. `unique (owner_id, property_id)` aus 0063
-- BLEIBT — derselbe Eigentümer darf nicht zweimal am selben Objekt hängen,
-- sonst zählte die Abrechnung seinen Anteil doppelt.

alter table public.owner_properties
    drop constraint if exists owner_properties_property_id_key;

comment on column public.owner_properties.ownership_share is
    '0601: Miteigentumsanteil in Prozent. Summe je property_id <= 100 '
    '(Trigger owner_properties_anteile_pruefen). 100 = Alleineigentum. '
    'NICHT die Auszahlungsquote nach Provision — die steht in '
    'commission_override_pct bzw. owners.default_commission_pct.';

-- ═══ TEIL 3: der Riegel gegen mehr als 100 % ═══
--
-- Auf DB-Ebene und nicht nur im Service (Wurzel 6): `owner_properties` ist für
-- anon/authenticated schreibgesperrt (0224/0337), aber der Server selbst
-- schreibt mit service_role und umgeht damit jede Policy. Ein Fehler im
-- Zuordnungs-Dialog oder ein Skript könnte sonst 60 % + 60 % ablegen, und die
-- Abrechnung zahlte 120 % des Ertrags aus, ohne dass irgendwo etwas auffällt.
--
-- Der Trigger prüft die Bedingung SEINER EIGENEN Tabelle und wirft nur bei
-- echter Überschreitung — er kann also keine fremde Änderung lahmlegen
-- (Lehre aus 0418→0424, wo `coalesce(old.status, '') <> 'done'` jede Änderung
-- an einer Tabelle killte). Nach dem Einspielen läuft
-- `scripts/diagnose/db-trigger-pruefen.sh`.

create or replace function public.owner_properties_anteile_pruefen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    summe numeric;
    beteiligte text;
begin
    -- Die eigene ALTE Zeile ist bei UPDATE nicht mitzuzählen (sonst schlägt
    -- jede Änderung eines 100-%-Alleineigentümers auf sich selbst an).
    select coalesce(sum(x.ownership_share), 0)
      into summe
      from public.owner_properties x
     where x.property_id = new.property_id
       and x.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if summe + new.ownership_share > 100.0001 then
        select string_agg(o.name || ' ' || x.ownership_share || ' %', ', ')
          into beteiligte
          from public.owner_properties x
          join public.owners o on o.id = x.owner_id
         where x.property_id = new.property_id
           and x.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
        raise exception
            'Die Miteigentumsanteile dieses Objekts ergäben % %% (mehr als 100). Bereits vergeben: %.',
            summe + new.ownership_share, coalesce(beteiligte, 'nichts');
    end if;
    return new;
end;
$$;

-- 0,0001 Toleranz oben: `numeric(5,2)` kann exakt rechnen, aber ein Anteil wie
-- 33,33 × 3 = 99,99 soll durchgehen und 33,34 × 3 = 100,02 nicht — der
-- Schwellwert liegt bewusst knapp über 100, nicht darunter.

revoke execute on function public.owner_properties_anteile_pruefen()
    from anon, authenticated;

drop trigger if exists owner_properties_anteile_pruefen
    on public.owner_properties;

create trigger owner_properties_anteile_pruefen
    before insert or update of ownership_share, property_id, owner_id
    on public.owner_properties
    for each row
    execute function public.owner_properties_anteile_pruefen();

comment on function public.owner_properties_anteile_pruefen() is
    '0601: Summe der Miteigentumsanteile je Objekt <= 100 %. Gilt auch für '
    'service_role (Wurzel 6) — der Service prüft dieselbe Regel vorher mit '
    'verständlicher Meldung (owners/service.assign_property).';

-- ═══ TEIL 4: der Anteil zum Zeitpunkt der Abrechnung ═══
--
-- Ändert der Betrieb den Anteil später (Verkauf, Erbfall), muss ein bereits
-- erstellter Beleg wahr bleiben — genau wie der Kopf-Snapshot (pm_name,
-- owner_name) und die eingefrorenen Summen. NULL = vor 0601 erzeugt bzw. noch
-- nicht berechnet; die Anzeige fällt dann auf den Stammdaten-Anteil zurück und
-- erfindet keine 100 (Wurzel 4).

-- JE OBJEKT, nicht ein Wert für die ganze Abrechnung: derselbe Eigentümer kann
-- an einem Haus 50 % und am nächsten 100 % halten (René Dahl Nielsen hat drei
-- Objekte). Ein einzelner Prozentwert am Beleg wäre bei gemischten Anteilen
-- eine Falschaussage — und zwar eine, die genau wie eine richtige aussieht.
--
-- Form: {"<property_id>": <anteil>, …}. Leeres Objekt und NULL sind dasselbe
-- („kein Snapshot"), die Anzeige fällt dann auf die Stammdaten zurück.

alter table public.owner_statements
    add column if not exists ownership_shares jsonb;

comment on column public.owner_statements.ownership_shares is
    '0601: Miteigentumsanteile je Objekt zum Zeitpunkt der Erzeugung '
    '(Snapshot, {"property_id": anteil_prozent}). NULL bei Abrechnungen von '
    'vor 0601 — damals gab es nur Alleineigentum.';
