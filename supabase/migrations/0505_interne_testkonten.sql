-- 0505 — `tenants.is_internal`: interne Test-/Vorführkonten des Hauses.
--
-- WARUM NICHT `is_demo` (0407): das ist bereits vergeben und bedeutet das
-- GEGENTEIL. `is_demo = true` kennzeichnet die anonyme Schaufenster-Vorführung
-- der Marketing-Seite. Ein solcher Mandant bekommt zwei Riegel:
--   * `demo_gate.demo_schreibzugriff_pruefen` → 405 auf JEDE Änderung,
--   * `demo_gate.GESPERRTE_PRAEFIXE` → `/buchhaltung` gar nicht einsehbar.
-- Es wäre also genau falsch herum: Nordlicht, Seeblick und Alpenzeit wären
-- schreibgeschützt, und die Buchhaltung wäre dort gesperrt statt sichtbar.
--
-- WOFÜR DIE NEUE SPALTE: eigene Konten, in denen unfertige Module benutzbar
-- sein sollen, bevor sie an zahlende Betriebe gehen. Zurzeit ist das die
-- Buchhaltung — 13 ihrer 17 Unterseiten sind noch Platzhalter, und ein
-- Platzhalter vor einem Kunden ist schlimmer als ein fehlender Menüpunkt.
--
-- Diese Spalte ist KEIN Sicherheitsmerkmal. Sie steuert Sichtbarkeit von
-- unfertigem, nicht Zugriff auf fremde Daten: die Buchhaltung zeigt
-- ausschließlich Zeilen des eigenen Mandanten, davor stehen unverändert RLS
-- und die Autorisierung der Endpunkte.

alter table public.tenants
  add column if not exists is_internal boolean not null default false;

comment on column public.tenants.is_internal is
  'Internes Test-/Vorfuehrkonto des Hauses: unfertige Module (derzeit die '
  'Buchhaltung) sind hier sichtbar. NICHT `is_demo` — das ist die anonyme '
  'Schaufenster-Vorfuehrung und sperrt Schreibzugriffe samt Buchhaltung.';

-- Partieller Index wie bei `is_demo` (0407): gefragt wird fast immer nach den
-- wenigen `true`-Zeilen, ein voller Index über 10 Zeilen `false` brächte nichts.
create index if not exists tenants_is_internal_idx
  on public.tenants (id)
  where is_internal;

-- Die drei Fotomodell-Mandanten (siehe Memory „Demo-Tenants = Fotomodell":
-- Nordlicht/Seeblick/Alpenzeit werden nie gelöscht, an ihnen entstehen die
-- Marketing-Aufnahmen). Namentlich statt per ID, damit die Migration auf
-- jeder Umgebung dasselbe meint; `where` trifft nur Vorhandene.
update public.tenants
   set is_internal = true
 where name in (
   'Nordlicht Ferienvermietung',
   'Hotel Seeblick Warnemünde',
   'Alpenzeit Chalets'
 );
