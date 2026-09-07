-- 0582_housebook_secret_tips.sql — Geheimtipps in der Hausmappe (Kartei Stufe 7)
--
-- Das Lastenheft führt unter Stufe 7 „Husmappe" die Geheimtipps des Objekts
-- (Restaurants, Strände, Ausflüge aus Sicht des Eigentümers). 0127 legte
-- die Hausmappe nur mit Status-Feldern an und verwies für die Texte auf den
-- Nachrichten-Bereich (type_attributes.messaging). Dort stehen aber die
-- Texte, die der GAST bekommt (Begrüßung, Reiseführer) — die Geheimtipps sind
-- zuerst eine Notiz des Onboardings: was der Eigentümer der Agentur beim
-- Rundgang erzählt, bevor daraus ein Gasttext wird. Dieses Feld ist die
-- Ablage dafür in der Kartei selbst; das PDF druckt es mit.
--
-- Freitext, nullable, keine Obergrenze in der DB — die API deckelt auf
-- 5000 Zeichen (Wurzel 8), damit kein unbegrenzter Bereich entsteht.
--
-- RLS/Grants: property_housebook ist seit 0128/0155 tenant- und rollen-
-- gescoped und in der Realtime-Publikation; eine neue Spalte erbt beides.
--
-- KEIN `begin;`/`commit;`: `apply-migrations.sh` fährt jede Migration bereits
-- in einer eigenen Transaktion.

alter table public.property_housebook
    add column if not exists secret_tips text;

comment on column public.property_housebook.secret_tips is
    'Geheimtipps des Eigentümers für die Hausmappe (Kartei Stufe 7), Freitext bis 5000 Zeichen.';
