-- 0630 — `tenants.ist_vorfuehrbetrieb`: der Betrieb, an dem wir der Behörde
-- den kompletten DAC7-Weg zeigen. Für IHN gelten die Demo-Riegel nicht.
--
-- ANLASS
-- ======
-- Skattestyrelsen hat uns gebeten, eine Teststufe zu bauen, die zeigt, wie
-- die Daten von myNextDays bei der Behörde ankommen — verschlüsselt und
-- wieder lesbar, mit Protokoll. Das lässt sich nur an einem Betrieb mit
-- echten gepflegten Kundendaten vorführen.
--
-- Genau dort standen bisher zwei Riegel im Weg, beide aus `demo_gate.py`:
--   * `GESPERRTE_PRAEFIXE` enthält `/taxpayer` → die DAC7-Seite meldete
--     „Die Meldungen konnten nicht geladen werden" (403, auch lesend),
--   * `demo_schreibzugriff_pruefen` → 405 auf JEDE Änderung, also auch auf
--     das Erzeugen eines Meldelaufs und das Absenden an die Empfangsstelle.
-- Beide greifen an `is_demo`, und der Vorführbetrieb trägt das.
--
-- WARUM EINE DRITTE SPALTE UND NICHT `is_demo` WEGNEHMEN
-- ======================================================
-- `is_demo` schützt mehr als die Menüpunkte: In 0407 hängen zwei
-- RLS-Policies auf `storybook_chat` daran, die den internen Team-Chat mit
-- Klarnamen vor dem öffentlichen Demo-Login verbergen. Wer `is_demo`
-- ausschaltet, um DAC7 zu zeigen, öffnet damit den Team-Chat — genau der
-- Fehler, den 0529 schon einmal reparieren musste, nachdem ein Seed-Lauf
-- die Spalte auf `false` zurückfallen ließ.
--
-- WARUM AUCH NICHT `is_internal` (0505)
-- ======================================
-- Das bedeutet „unfertige Module sind hier sichtbar" und steuert
-- Sichtbarkeit, nicht Schreibrecht. Es an dieser Stelle mitzubenutzen
-- hieße, zwei verschiedene Aussagen an eine Spalte zu hängen: Der nächste,
-- der einem Konto `is_internal` gibt, um ihm die Buchhaltung zu zeigen,
-- hätte ihm damit unbemerkt auch den Schreibschutz genommen.
--
-- WAS DIESE SPALTE IST — UND WAS NICHT
-- =====================================
-- Sie hebt die VORFÜHR-Riegel auf, sonst nichts. Unverändert davor stehen:
-- RLS, der Mandanten-Scope jeder Abfrage, die Capability-Prüfung der
-- Endpunkte (DAC7 verlangt `manage_billing`) und die Rollen-Trennung. Ein
-- Vorführbetrieb kann dadurch nicht mehr sehen als sein eigener Admin —
-- er kann nur das, was ein zahlender Betrieb auch kann.
--
-- Sie ist deshalb KEIN Sicherheitsmerkmal, sondern die Rücknahme einer
-- Vorführ-Einschränkung. Sie gehört an genau einen Betrieb.

alter table public.tenants
  add column if not exists ist_vorfuehrbetrieb boolean not null default false;

comment on column public.tenants.ist_vorfuehrbetrieb is
  'Betrieb, an dem der DAC7-Meldeweg der Behoerde vorgefuehrt wird: die '
  'Demo-Riegel aus demo_gate.py (403 auf gesperrte Bereiche, 405 auf '
  'Schreibzugriffe) gelten fuer ihn NICHT. Hebt weder RLS noch '
  'Mandanten-Scope noch Capability-Pruefung auf. Nicht `is_demo` '
  '(oeffentliche Schaufenster-Vorfuehrung, schuetzt zusaetzlich den '
  'Team-Chat per RLS) und nicht `is_internal` (0505, Sichtbarkeit '
  'unfertiger Module).';

-- Partieller Index wie bei `is_demo` (0407) und `is_internal` (0505):
-- gefragt wird nach den wenigen `true`-Zeilen.
create index if not exists tenants_ist_vorfuehrbetrieb_idx
  on public.tenants (id)
  where ist_vorfuehrbetrieb;

-- Namentlich statt per ID — wie in 0505 begründet, damit die Migration auf
-- jeder Umgebung dasselbe meint.
--
-- `Nordstrand Feriehusudlejning` (vormals „Alpenzeit Chalets") wurde am
-- 11.09.2026 für diesen Zweck nach Dänemark umgestellt: DK/DKK, elf
-- Ferienhäuser in Westjütland mit BFE-Nummer und Matrikel, sechs
-- Eigentümer mit CPR- und zwei mit CVR-Nummer, 579 Reservierungen in 2025.
--
-- NICHT `Nordlys Feriehusudlejning`: Das ist der öffentliche
-- Live-Vorschau-Zugang der Marketing-Seite. Dort die Schreibsperre zu
-- lösen hieße, die Schaufenster-Demo für jeden Besucher schreibbar zu
-- machen.
update public.tenants
   set ist_vorfuehrbetrieb = true
 where name = 'Nordstrand Feriehusudlejning';

-- Genau einer, nie mehr. Eine stille Ausweitung auf einen zweiten Betrieb
-- wäre eine stille Aufhebung seiner Schreibsperre.
do $$
declare anzahl int;
begin
  select count(*) into anzahl
    from public.tenants where ist_vorfuehrbetrieb;
  if anzahl <> 1 then
    raise exception
      '0630: genau ein Vorfuehrbetrieb erwartet, gefunden: %', anzahl;
  end if;
end $$;
