-- 0514 — 'addon_uebersetzen' als gebuchte KI-Funktion.
--
-- DER FEHLER, DEN DIESE MIGRATION BEHEBT, IST LIVE PASSIERT (31.08.2026):
--
--   addon_uebersetzt   uebersetzt=22 vorhanden=1 zeilen=19   status=200
--   ki_nutzung_unbekannte_funktion  funktion=addon_uebersetzen   (22x)
--
-- Der Lauf hat 22 Sprachen erzeugt und 19 Zeilen geschrieben — fachlich alles
-- richtig, HTTP 200. Nur wurde keiner der 22 bezahlten Aufrufe gebucht:
-- `ki_nutzung._schreiben` steigt bei einem Namen, der nicht in `FUNKTIONEN`
-- steht, absichtlich aus, weil der check-Constraint dieser Tabelle ihn ohnehin
-- ablehnen wuerde.
--
-- Die Folge ist genau die, die 0478 schon einmal beschrieben hat: der Zaehler
-- bewegt sich nicht, `deckel_pruefen` prueft 23-mal einen Stand, der nie
-- steigt — der Tagesdeckel ist eine Attrappe —, und die Abrechnung meldet dem
-- Betrieb „0 von 200 verbraucht", waehrend 22 Aufrufe bezahlt wurden.
--
-- Es war KEIN stiller Fehler: der Wachter hat 22-mal `error` geloggt, und
-- genau daran wurde es bemerkt. Das ist der Unterschied zu einem verschluckten
-- Exception (Wurzel 5) — und der Grund, warum `_schreiben` nicht einfach
-- durchlaesst, was es nicht kennt.
--
-- WARUM EIN EIGENER NAME und nicht 'seite_uebersetzen' mitbenutzen: beide
-- uebersetzen, aber sie verhalten sich verschieden. Eine Website-Seite ist ein
-- langer Text, der einmal uebersetzt wird; eine Zusatzleistung ist ein kurzer,
-- der auf n Objekten steht und ueber den Quelltext gebuendelt laeuft. In einem
-- Topf liesse sich spaeter nicht sagen, welcher der beiden den Deckel gesprengt
-- hat — dieselbe Begruendung, mit der 0500 und 0501 ihre Namen getrennt haben.
--
-- ZWEI STELLEN, IMMER GEMEINSAM: dieser Constraint UND `FUNKTIONEN` in
-- `apps/api/src/features/site_config/ki_nutzung.py`. Fehlt einer, ist der
-- Zaehler entweder blind (Konstante fehlt) oder der Insert wirft 23514
-- (Constraint fehlt).

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
      -- Name + Beschreibung einer Zusatzleistung in die EU-Amtssprachen.
      -- Ein Aufruf je Zielsprache; die Fassung wird auf alle Zeilen mit
      -- demselben Quelltext geschrieben, ohne erneut zu bezahlen.
      'addon_uebersetzen'
    )
  );

comment on constraint site_ai_usage_funktion_check on public.site_ai_usage is
    'Erlaubte KI-Funktionsnamen. Deckungsgleich mit FUNKTIONEN in '
    'site_config/ki_nutzung.py — beide Stellen immer gemeinsam pflegen, sonst '
    'ist der Tagesdeckel blind (0514).';
