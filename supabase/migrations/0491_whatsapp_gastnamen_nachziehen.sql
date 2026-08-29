-- 0491 — WhatsApp: Gastnamen aus der Buchung nachziehen
--
-- WARUM: Die Konversationsliste zeigte fuer WhatsApp die Rohnummer
-- (`+4915251939026`) statt eines Namens. Zwei Ursachen, beide im Code behoben:
--
--   1. `_upsert_conversation` schrieb `guest_name` NUR beim Anlegen. Entstand
--      die Konversation aus einer AUSGEHENDEN Nachricht — dort schickt Meta
--      keine `contacts` mit —, blieb das Feld leer, und kein spaeterer Webhook
--      hat es je nachgetragen.
--   2. Die Liste las ausschliesslich `whatsapp_conversation.guest_name` und
--      ignorierte den VERKNUEPFTEN Gast. Live hatten zwei der vier
--      Konversationen einen Gast MIT Namen (Hanna Schaub, Enne Angela) und
--      zeigten trotzdem die Nummer.
--
-- Der Code deckt ab heute beide Faelle ab. Diese Migration holt den Bestand
-- nach: ohne sie stuende der Name erst nach der naechsten eingehenden
-- Nachricht da — bei einem ruhenden Chat also nie.
--
-- NUR wo `guest_name` leer ist: ein vorhandener Wert stammt aus dem
-- WhatsApp-Profil, also von der Person selbst. Der ist naeher an dem, wie sie
-- angesprochen werden will, als der Buchungsname — er wird nicht ueberschrieben
-- (Wurzel 1: der Gegenzustand ist hier der schon bekannte Name).

update public.whatsapp_conversation c
   set guest_name = trim(
         coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')
       )
  from public.guests g
 where g.id = c.guest_id
   and c.guest_name is null
   -- Ein namenloser Gast darf keinen leeren String hinterlassen: die
   -- Oberflaeche prueft auf NULL und faellt sonst auf die Nummer zurueck.
   -- '' waere ein Name, der keiner ist (Wurzel 4).
   and trim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')) <> '';
