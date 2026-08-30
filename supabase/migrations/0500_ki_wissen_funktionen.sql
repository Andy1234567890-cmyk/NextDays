-- 0500 — Zwei neue KI-Funktionen: Dokument-Import und Lernen aus Nachrichten
--
-- `site_ai_usage.funktion` trägt einen CHECK mit acht Werten (0492). Fehlt ein
-- Name darin, steigt `ki_nutzung._schreiben` STILL aus: der Zähler bewegt sich
-- nicht, `deckel_pruefen` prüft einen Stand, der nie steigt, und der
-- Tagesdeckel wird zur Attrappe — bei einem Import, der ein 200-Seiten-PDF
-- durch Gemini schickt, wäre das der teuerste Ort dafür.
--
-- Zwei Namen, nicht einer:
--   'wissen_import'  — der Betrieb hat ein PDF hochgeladen (bewusster Aufruf)
--   'wissen_lernen'  — die Auswertung einer gesendeten Nachricht (läuft von
--                      selbst, im Hintergrund)
--
-- Getrennt, weil sie sich unterschiedlich verhalten und die Abrechnung sie
-- unterscheiden können muss: der Import ist ein seltener, teurer Einzelaufruf,
-- das Lernen ein häufiger, kleiner. In einem Topf liesse sich später nicht
-- sagen, welcher der beiden einen Deckel gesprengt hat.

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
      -- Fakten aus einem hochgeladenen Dokument ziehen (Wissensdatenbank).
      'wissen_import',
      -- Fakten aus einer vom Menschen gesendeten Nachricht lernen.
      'wissen_lernen'
    )
  );
