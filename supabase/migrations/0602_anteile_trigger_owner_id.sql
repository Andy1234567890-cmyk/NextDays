-- 0602 — Anteils-Trigger schloss die eigene Zeile über die falsche Spalte aus.
--
-- WARUM (live am 07.09.2026): Britt Andersen hielt 50 % an „Feriehus Line",
-- Line Bech Thorsen die anderen 50 %. Beim Ändern von Britts Anteil auf 60 %
-- meldete der Trigger „ergäben 150,00 %" und die Oberfläche einen 409 — obwohl
-- 40 + 60 = 100 aufgeht. Sechs Fehlversuche hintereinander im Log.
--
-- URSACHE: 0601 schließt die eigene Zeile über `new.id` aus:
--
--     where x.property_id = new.property_id
--       and x.id <> coalesce(new.id, '000…000'::uuid)
--
-- Der Server schreibt aber per UPSERT auf `on_conflict=owner_id,property_id`
-- und sendet KEINE `id` (die kennt er nicht, er kennt owner_id + property_id).
-- Postgres führt den Konfliktfall als `insert … on conflict do update` aus,
-- und in dessen NEW steht `id` = NULL, weil die Nutzlast keine trug. Der
-- `coalesce`-Ersatzwert trifft dann auf keine Zeile, es wird NICHTS
-- ausgeschlossen — die eigene ALTE Zeile zählt mit:
--
--     Line 40  +  Britt 50 (alt)  +  Britt 60 (neu)  =  150
--
-- Gemessen: derselbe Upsert MIT mitgeschickter `id` geht durch, ohne `id`
-- schlägt er fehl. Der Trigger war also nicht zu streng, sondern hat die
-- falsche Zeile als „fremd" gezählt.
--
-- KORREKTUR: nach `owner_id` ausschließen. `unique (owner_id, property_id)`
-- (0063) garantiert, dass es je Objekt HÖCHSTENS EINE Zeile pro Eigentümer
-- gibt — die Spalte identifiziert die eigene Zeile also genauso eindeutig wie
-- `id`, ist aber in NEW immer gefüllt (sie ist `not null` und Teil des
-- Konflikt-Ziels). Damit wirkt der Ausschluss bei INSERT, UPDATE und UPSERT
-- gleich.
--
-- Die Grenze selbst bleibt unverändert: Summe je Objekt <= 100 (+0,0001
-- Toleranz für 33,33 × 3 = 99,99). Der Riegel gegen den DB-Direktpfad bleibt
-- damit vollständig erhalten (Wurzel 6) — er weist jetzt nur nicht mehr
-- Änderungen ab, die aufgehen.
--
-- Migration statt Änderung an 0601: eine bereits eingespielte Datei läuft nie
-- wieder (MEMORY „migration-aendern-wirkt-nicht", Lehre aus 0430→0439).

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
    -- Die eigene Zeile NICHT mitzählen — identifiziert über `owner_id`, nicht
    -- über `id`: bei einem UPSERT ohne mitgeschickte `id` ist `new.id` NULL,
    -- und ein Ausschluss über `id` griffe dann ins Leere (0602).
    select coalesce(sum(x.ownership_share), 0)
      into summe
      from public.owner_properties x
     where x.property_id = new.property_id
       and x.owner_id <> new.owner_id;

    if summe + new.ownership_share > 100.0001 then
        select string_agg(o.name || ' ' || x.ownership_share || ' %', ', ')
          into beteiligte
          from public.owner_properties x
          join public.owners o on o.id = x.owner_id
         where x.property_id = new.property_id
           and x.owner_id <> new.owner_id;
        raise exception
            'Die Miteigentumsanteile dieses Objekts ergäben % %% (mehr als 100). Bereits vergeben: %.',
            summe + new.ownership_share, coalesce(beteiligte, 'nichts');
    end if;
    return new;
end;
$$;

revoke execute on function public.owner_properties_anteile_pruefen()
    from anon, authenticated;

comment on function public.owner_properties_anteile_pruefen() is
    '0602: Summe der Miteigentumsanteile je Objekt <= 100 %. Gilt auch für '
    'service_role (Wurzel 6). Die eigene Zeile wird über owner_id '
    'ausgeschlossen — bei UPSERT ohne id ist new.id NULL (0601-Fehler).';
