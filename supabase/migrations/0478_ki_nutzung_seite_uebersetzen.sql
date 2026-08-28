-- 0478 — `seite_uebersetzen` als gebuchte KI-Funktion zulassen.
--
-- 0476 hat den Übersetzungslauf für Seitenfassungen gebaut. Er bucht seine
-- Aufrufe über `ki_nutzung.buchen(funktion="seite_uebersetzen")` — ein Name,
-- den weder die Python-Allowlist noch dieser CHECK kannte.
--
-- Die Folge war nicht ein Fehler, sondern STILLE: `_schreiben` prüft die
-- Allowlist zuerst und steigt bei unbekanntem Namen mit einem `log.error` aus,
-- ohne zu schreiben. Also:
--
--   * keine Zeile in `site_ai_usage`,
--   * `verbrauch_heute()` sieht die Übersetzungen nie,
--   * `deckel_pruefen()` liest denselben Zähler und prüft bei einem Lauf über
--     23 Sprachen 23-mal einen Stand, der sich nie erhöht — der Tagesdeckel
--     war für diesen Endpunkt wirkungslos,
--   * die Antwort meldete „0 von 200 verbraucht", während 23 Modellaufrufe
--     bezahlt wurden. Eine Falschaussage, die plausibel aussieht.
--
-- Beide Seiten müssen es kennen: die Allowlist in `ki_nutzung.py` UND dieser
-- CHECK. Nur eine zu pflegen verschiebt den Fehler bloß — dann käme statt der
-- Stille ein 23514 aus der Datenbank.
--
-- Warum eine eigene Migration: 0465 (der CHECK) ist angewendet und läuft nie
-- wieder. Eine Änderung dort erreichte die Live-DB nicht.

alter table public.site_ai_usage
    drop constraint if exists site_ai_usage_funktion_check;

alter table public.site_ai_usage
    add constraint site_ai_usage_funktion_check
    check (funktion in (
        'umschreiben', 'seo', 'alt_text',
        'abschnitt', 'blogbeitrag', 'profil_vorschlag',
        'seite_uebersetzen'
    ));
