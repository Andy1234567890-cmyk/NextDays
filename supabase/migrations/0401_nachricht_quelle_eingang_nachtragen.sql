-- 0401 — `quelle='portal'` für den eingegangenen Bestand nachtragen
--
-- 0400 gab `portal_messages.quelle` den Default 'manuell'. Für ausgehende
-- Zeilen ist das die ehrliche Aussage „Quelle unbekannt, vermutlich von Hand".
-- Für EINGEGANGENE Zeilen ist es schlicht falsch: eine Nachricht mit
-- `sender = 'guest'` hat niemand im Betrieb geschrieben, sie kam über den
-- Aggregator herein. Das ist rückwirkend eindeutig bestimmbar — anders als bei
-- den ausgehenden, wo Automail und Handnachricht ununterscheidbar sind.
--
-- Streng auf `sender = 'guest'` begrenzt. Die 314 ausgehenden Zeilen bleiben
-- auf 'manuell' stehen: dort WÄRE eine Umdeutung geraten, und die Kennzahl
-- „per Automation gesendet" zählt deshalb bewusst erst ab 0400 (Wurzel 4 —
-- lieber eine Zahl, die klein anfängt, als eine, die plausibel und falsch ist).
--
-- `quelle <> 'portal'` hält den Lauf idempotent (Wurzel 2).

update public.portal_messages
   set quelle = 'portal'
 where sender = 'guest'
   and quelle <> 'portal';
