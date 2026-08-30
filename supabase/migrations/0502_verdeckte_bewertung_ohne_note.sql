-- 0502 — Verdeckte Portal-Bewertungen tragen keine Note (statt einer 0)
--
-- Channex schickt bei einer VERDECKTEN Bewertung `overall_score: 0`. Das ist
-- keine Null-Bewertung, sondern „steht noch nicht fest": Airbnb haelt die Note
-- zurueck, bis beide Seiten abgegeben haben.
--
-- Ungeprueft uebernommen zeigte die Liste dafuer fuenf leere Sterne und
-- „0 / 10" — eine Behauptung ueber einen Gast, der nichts dergleichen gesagt
-- hat. Schlimmer: die 0 ging in JEDEN Durchschnitt ein. Sechs solcher Zeilen
-- druecken den Schnitt eines Betriebs mit 184 Bewertungen sichtbar, und
-- niemand haette den Grund gefunden (Wurzel 4).
--
-- Der Import verwirft sie ab sofort selbst (`reviews_sync._note`). Diese
-- Migration raeumt den Bestand nach — ohne sie bliebe der Fehler fuer alles
-- stehen, was vor heute hereinkam, und der Fix waere nur halb.
--
-- Eng gefasst: NUR wo die Note 0 ist UND die Bewertung verdeckt. Eine
-- sichtbare 0 gaebe es bei keinem Portal, waere aber eine echte Aussage und
-- bleibt unangetastet.

update public.channex_review
   set overall_score = null
 where overall_score = 0
   and is_hidden;
