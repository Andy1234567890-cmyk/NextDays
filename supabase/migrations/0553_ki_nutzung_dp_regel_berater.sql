-- 0553_ki_nutzung_dp_regel_berater.sql — Funktionsname des DP-Regel-Beraters
--
-- Der KI-Regel-Berater im Dynamic Pricing bucht seine Aufrufe unter
-- 'dp_regel_berater'. Der Name MUSS an ZWEI Stellen stehen: in
-- `ki_nutzung.FUNKTIONEN` und in diesem CHECK. Fehlt er hier, steigt
-- `_schreiben` still aus, der Zähler bewegt sich nicht — und der Tagesdeckel
-- ist eine Attrappe, während die Aufrufe bezahlt werden.
--
-- Genau das ist am 31.08.2026 mit 'addon_uebersetzen' passiert (22 bezahlte,
-- ungebuchte Aufrufe) und heute beim ersten Live-Lauf des Beraters erneut:
--   ki_nutzung_unbekannte_funktion  funktion=dp_regel_berater
-- Diesmal fiel es sofort auf, weil `_schreiben` LAUT loggt statt still zu
-- schlucken (Wurzel 5) — der laute Ausstieg hat sich damit ein zweites Mal
-- bezahlt gemacht.
--
-- Eigener Name und nicht in einen Topf mit den anderen: der Berater läuft je
-- Objekt auf Knopfdruck und schickt EINEN kleinen Prompt. Zusammengelegt liesse
-- sich später nicht sagen, welche Funktion den Deckel gesprengt hat.

alter table public.site_ai_usage
  drop constraint if exists site_ai_usage_funktion_check;

-- Der CHECK wird ERSETZT, nicht ergänzt: jeder bestehende Name muss
-- mitgeführt werden, sonst weist die Datenbank vorhandene Zeilen ab und die
-- Migration scheitert.
-- KEINE Klammern in den Kommentaren dieses Blocks: der Test
-- `test_funktionen_deckungsgleich_mit_db_check` liest die Werteliste bis zur
-- ersten schliessenden Klammer.
alter table public.site_ai_usage
  add constraint site_ai_usage_funktion_check check (
    funktion in (
      'umschreiben',
      'seo',
      'alt_text',
      'abschnitt',
      'blogbeitrag',
      'profil_vorschlag',
      'seite_uebersetzen',
      'gast_antwort',
      'wissen_import',
      'wissen_lernen',
      'bewertung_deuten',
      'bewertung_bilanz',
      'addon_uebersetzen',
      'personal_prognose',
      'personal_autoplan',
      'personal_assistent',
      'bewertung_gast',
      'bewertung_antwort',
      -- Neu 0553: Regel-Berater im Dynamic Pricing. Er schlaegt EINSTELLUNGEN
      -- vor, keine Preise; das Sprachmodell liefert nur die Begruendung.
      'dp_regel_berater'
    )
  );

comment on constraint site_ai_usage_funktion_check on public.site_ai_usage is
  'Erlaubte KI-Funktionsnamen. Deckungsgleich mit ki_nutzung.FUNKTIONEN zu '
  'halten - ein fehlender Name laesst die Buchung still ausfallen und macht '
  'den Tagesdeckel zur Attrappe.';
