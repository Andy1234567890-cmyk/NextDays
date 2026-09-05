-- 0565 — Regel „Mindestpreis aus dem Saisonkalender" (Dynamic Pricing).
--
-- ANWEISUNG (05.09.2026): „Wenn ein Saisonkalender erstellt wurde, greift der
-- Mindestpreis vom Saisonkalender. Jeder kann mehrere Saisons erstellen. Ist
-- kein Saisonkalender vorhanden, darf die Regel nicht ausgewählt werden.
-- Der Saisonkalender bestimmt nur den Mindestpreis, nie die Obergrenze."
--
-- WIRKUNG: An jedem Tag, der in einer Saison des Objekts liegt
-- (property_season_assignments → property_seasons), ist der Saisonpreis des
-- Tages die Untergrenze der Automatik: fixed = Betrag, percent = Grundpreis
-- des Ratenplans ± Prozent — dieselbe Regel, mit der der Kalender die
-- Saison materialisiert. Höchstpreis (global wie Ausnahme) bleibt unberührt.
-- Tage ohne Saison behalten den normalen Mindestpreis.
--
-- Migration 0550 beschrieb diese Untergrenze für price_mode='steuert' bereits
-- im Kommentar — im Engine-Code kam sie nie an. Diese Regel löst das ein,
-- als bewusster Schalter je Objekt (Default aus: bestehende Objekte ändern
-- sich nicht still).
--
-- Wählbarkeit (kein Saisonkalender → 422) prüft der Server beim Speichern
-- (settings_service) — ein DB-CHECK über zwei Tabellen wäre ein Trigger, der
-- bei jeder Saison-Löschung dp_settings mitändern müsste.
alter table public.dp_settings
    add column if not exists saison_mindestpreis boolean not null default false;

comment on column public.dp_settings.saison_mindestpreis is
  'Saisonpreis des Saisonkalenders als Untergrenze der Automatik (nie '
  'Obergrenze). Nur waehlbar, wenn das Objekt mindestens eine Saison mit '
  'Zeitraum hat (Server prueft beim Speichern).';
