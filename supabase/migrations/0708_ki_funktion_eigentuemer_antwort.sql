-- 0708_ki_funktion_eigentuemer_antwort.sql — KI-Funktionsname für den Eigentümer-Chat
--
-- MUSS hier UND in `site_config.ki_nutzung.FUNKTIONEN` stehen. Fehlt der Name,
-- steigt `_schreiben` still aus: der Zähler bewegt sich nicht, `deckel_pruefen`
-- prüft einen Stand, der nie steigt, und der Tagesdeckel ist eine Attrappe.
-- Das ist in diesem Projekt schon viermal passiert — zuletzt bei
-- 'addon_uebersetzen', wo 22 bezahlte Aufrufe ungebucht blieben und nur der
-- laute `ki_nutzung_unbekannte_funktion`-Log es zeigte.
--
-- 'eigentuemer_antwort' getrennt von 'gast_antwort', obwohl beide einen
-- Antwortvorschlag im Posteingang erzeugen: der eine geht an einen Gast und
-- schöpft aus Buchung und Gästemappe, der andere an einen Geschäftspartner und
-- schöpft aus Objekt, Aufgaben und Belegung. In einem Topf liesse sich nicht
-- sagen, welcher Knopf den Deckel gesprengt hat.
--
-- Der CHECK wird ERSETZT, nicht ergänzt: jeder bestehende Name muss
-- mitgeführt werden, sonst weist die Datenbank vorhandene Zeilen ab und die
-- Migration scheitert. Stand der Liste: 0658.
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
      'beleg_ocr',
      'eigentuemer_antwort'
    )
  );
