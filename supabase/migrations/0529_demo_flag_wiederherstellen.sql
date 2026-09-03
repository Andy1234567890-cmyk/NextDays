-- 0529 — `tenants.is_demo` fuer den Vorfuehr-Mandanten wiederherstellen.
--
-- BEFUND (02.09.2026, live an der DB gemessen): `is_demo` stand bei KEINEM der
-- 10 Mandanten auf `true` — auch nicht bei Nordlicht, dem oeffentlichen
-- Vorfuehr-Mandanten (`merle.ahrens@mynextdays.com`). Damit lief die komplette
-- Absicherung der Vorfuehrung ins Leere, obwohl sie gebaut und korrekt
-- verdrahtet ist. Alles haengt an diesem einen Schalter:
--   * `demo_gate.demo_schreibzugriff_pruefen` (405 auf jede Aenderung),
--   * `demo_gate.demo_bereich_pruefen` (403 auf Buchhaltung, Kanalmanager,
--     Konto, Auszahlungen, Eigentuemer, Zahlungen …),
--   * die Schloss-Symbole der Sidebar (`web/components/app-sidebar.tsx`),
--   * das Vorfuehrungs-Band (`web/app/(dashboard)/layout.tsx`),
--   * und die `storybook_chat`-Policies aus 0407.
-- Der letzte Punkt war der ernsteste: der interne Team-Chat mit Klarnamen war
-- mit dem oeffentlich verteilten Demo-Login lesbar UND beschreibbar, weil der
-- Ausschluss in der Policy auf `t.is_demo` prueft.
--
-- WARUM 0407 NICHT GEREICHT HAT — UND DIE KORREKTUR HIER STEHT:
-- 0407 lief nachweislich (der partielle Index `tenants_demo_idx` und beide
-- `storybook_chat`-Policies stehen live, `public.schema_migrations` fuehrt
-- `0407_demo_mandant_nur_lesen`). Nur das `update` wurde spaeter ueberschrieben:
-- `scripts/demo/seed_demo.py` loescht die Mandanten-Zeile (`db.delete`) und legt
-- sie ohne `is_demo` neu an — die Spalte fiel damit auf ihren Default `false`.
-- Eine angewendete Migration laeuft nie wieder, eine Korrektur braucht deshalb
-- eine neue Nummer. Die Wurzel liegt aber im Seed, nicht hier: darum setzt
-- derselbe Arbeitsgang `is_demo` auch im Seed-Skript. Ohne das riss der
-- naechste Seed-Lauf den Schutz erneut auf (Wurzel 1 — die Aktion hat einen
-- Gegenzustand, der mitgepflegt werden muss).
--
-- WARUM PER NAME UND NICHT PER ID (Unterschied zu 0407):
-- 0407 traf die Zeile per ID. Die ID ist zwar deterministisch (uuid5 ueber
-- "nextdays-demo:tenant:nordlicht") und stimmte hier auch, aber 0505 hat fuer
-- `is_internal` bereits den besseren Weg gewaehlt und begruendet: namentlich,
-- damit die Migration auf JEDER Umgebung dasselbe meint. Dem folgt diese
-- Migration.
--
-- Seeblick und Alpenzeit bleiben bewusst OHNE Flag — 0407 begruendet das: sie
-- sind die Fotomodelle fuer die Marketing-Aufnahmen und sollen nicht
-- oeffentlich anmeldbar sein. Ein zweiter Vorfuehr-Mandant waere eine zweite
-- Angriffsflaeche fuer denselben Nutzen. `is_internal` (0505) tragen alle drei
-- weiterhin; die beiden Kennzeichen sind entgegengesetzt und unabhaengig.
--
-- KEINE NEUEN GRANTS (Wurzel 6): `public.tenants` bleibt fuer anon/
-- authenticated ohne Schreibrechte. Ein Demo-Besucher darf sein eigenes
-- Demo-Flag nicht entfernen koennen — gesetzt wird es ausschliesslich per
-- Migration bzw. service_role.
update public.tenants
   set is_demo = true
 where name = 'Nordlicht Ferienvermietung';

-- Gegenprobe im selben Zug: genau EIN Vorfuehr-Mandant, und zwar der richtige.
-- Ein stiller Fehlschlag ist hier besonders teuer, weil das Ergebnis erst
-- auffaellt, wenn ein Besucher etwas veraendert hat (Wurzel 5: laut scheitern
-- statt plausibel weiterlaufen).
do $$
declare
    anzahl integer;
begin
    select count(*) into anzahl from public.tenants where is_demo;
    if anzahl <> 1 then
        raise exception
            'Erwartet genau einen Vorfuehr-Mandanten, gefunden: %', anzahl;
    end if;
    if not exists (
        select 1 from public.tenants
         where is_demo and name = 'Nordlicht Ferienvermietung'
    ) then
        raise exception 'Das Demo-Flag sitzt am falschen Mandanten';
    end if;
end $$;
