-- 0492 — KI-Nutzung: die Gastantwort als eigene Funktion zählen
--
-- WARUM: Der Posteingang erzeugt Gastantworten ab jetzt über Vertex AI statt
-- Groq (`features/inbox/ki_antwort.py`). Damit läuft dieser Aufruf durch
-- dieselbe Buchführung wie die Baukasten-Funktionen — Tagesdeckel je Betrieb,
-- Token-Zählung, Fehlerprotokoll (`site_ai_usage`, 0465).
--
-- Der check-Constraint kennt bisher sechs Namen aus dem Baukasten und seit
-- 0478 `seite_uebersetzen`. Ohne einen siebten Namen wäre die Zählung eine
-- ATTRAPPE, und zwar eine stille: `ki_nutzung._schreiben` steigt bei
-- unbekannter Funktion aus, BEVOR es den Insert versucht (es loggt und
-- returned). Der Zähler bewegte sich also nie, `deckel_pruefen` vergliche
-- dauerhaft 0 gegen die Grenze, und der Betrieb bekäme „0 von 200 verbraucht"
-- angezeigt, während jeder Aufruf bezahlt wird.
--
-- Genau dieser Fehler ist bei 0478 schon einmal passiert (dort steht er im
-- Kommentar). Er wiederholt sich, weil der Name an ZWEI Stellen stehen muss:
-- hier und in `ki_nutzung.FUNKTIONEN`. Beide sind in dieser Runde gesetzt.
--
-- `drop` + `add` statt `alter`: Postgres kann einen check-Constraint nicht
-- ändern. Die Tabelle enthält nur Protokollzeilen mit den bisherigen Namen,
-- die alle weiterhin erlaubt sind — der neue Constraint ist eine echte
-- Erweiterung, kein Umbau, und validiert den Bestand ohne Treffer.

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
      -- Antwortvorschlag an einen Gast (Posteingang und WhatsApp).
      'gast_antwort'
    )
  );
