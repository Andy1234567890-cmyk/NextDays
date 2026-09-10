-- 0622 — KI-Funktionsname `inventar_import` fuer den Tagesdeckel
--
-- WARUM EINE EIGENE NUMMER: eine angewendete Migration laeuft nie wieder. Der
-- CHECK aus 0619 laesst sich nicht nachtraeglich aendern (Lehre 0430 → 0439).
--
-- WOZU: Die Inventarliste kann als PDF eingelesen werden — Gemini zieht daraus
-- die Zeilen. Das ist ein eigener, teurer Aufruf (bis 300 Zeilen Antwort) und
-- bekommt deshalb einen eigenen Funktionsnamen, getrennt von
-- `mappe_dokument`: in einem Topf liesse sich nicht sagen, welcher der beiden
-- den Tagesdeckel gesprengt hat.
--
-- Fehlt der Name hier, steigt `ki_nutzung._schreiben` still aus: der Zaehler
-- bewegt sich nicht, `deckel_pruefen` prueft einen Stand, der nie steigt, und
-- der Deckel ist ausgerechnet beim teuersten Aufruf eine Attrappe. Genau das
-- ist in diesem Projekt schon viermal passiert.
--
-- Der CHECK wird ERSETZT, nicht ergaenzt: jeder bestehende Name muss
-- mitgefuehrt werden, sonst weist die Datenbank vorhandene Zeilen ab.
-- KEINE Klammern in den Kommentaren dieses Blocks: der Test
-- `test_funktionen_deckungsgleich_mit_db_check` liest die Werteliste bis zur
-- ersten schliessenden Klammer.

alter table public.site_ai_usage
  drop constraint if exists site_ai_usage_funktion_check;

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
      'dp_regel_berater',
      'mappe_dokument',
      'inventar_import'
    )
  );
