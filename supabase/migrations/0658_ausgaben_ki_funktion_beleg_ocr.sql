-- 0658_ausgaben_ki_funktion_beleg_ocr.sql — KI-Funktionsname für den Belegausleser
--
-- MUSS hier UND in `site_config.ki_nutzung.FUNKTIONEN` stehen. Fehlt der Name,
-- steigt `_schreiben` still aus: der Zähler bewegt sich nicht, `deckel_pruefen`
-- prüft einen Stand, der nie steigt, und der Tagesdeckel ist ausgerechnet
-- beim teuersten Aufruf eine Attrappe. Das ist in diesem Projekt schon
-- viermal passiert — deshalb weigert sich der Ausgaben-Service, den Ausleser
-- überhaupt aufzurufen, solange der Name nicht in FUNKTIONEN steht (503,
-- fail-closed; Wurzel 5).
--
-- 'beleg_ocr' getrennt von 'mappe_dokument'/'inventar_import', obwohl alle
-- drei ein Dokument durch Gemini schicken: in einem Topf liesse sich nicht
-- sagen, welcher den Deckel gesprengt hat.
--
-- Der CHECK wird ERSETZT, nicht ergänzt: jeder bestehende Name muss
-- mitgeführt werden, sonst weist die Datenbank vorhandene Zeilen ab und die
-- Migration scheitert. Stand der Liste: 0622.
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
      'inventar_import',
      'beleg_ocr'
    )
  );
