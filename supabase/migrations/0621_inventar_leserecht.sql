-- 0621 — Inventar: `select` für `authenticated` nachziehen
--
-- WARUM EINE EIGENE NUMMER UND KEINE KORREKTUR AN 0620: eine angewendete
-- Migration läuft nie wieder. Eine Änderung in der alten Datei wäre auf der
-- Live-DB wirkungslos (Lehre aus 0430 → 0439).
--
-- WAS SCHIEFLAG: 0620 hat `revoke insert, update, delete` gesetzt — richtig,
-- das ist der Schreib-Riegel. Aber die neuen Tabellen bekamen nie ein
-- `select`-GRANT, weil sie nach dem Lauf der pauschalen Grant-Migrationen
-- entstanden sind. Gemessen nach dem Einspielen am 09.09.2026:
--
--     inventory_room     authenticated → REFERENCES
--     inventory_damage   authenticated → REFERENCES
--     inventory_items    authenticated → REFERENCES, SELECT   (Bestand)
--     tasks              authenticated → REFERENCES, SELECT   (Bestand)
--
-- Ohne `select` wäre ein Realtime-Abo auf diese Tabellen eine stumme
-- Attrappe: die Oberfläche sähe live aus und aktualisierte nie. Genau der
-- Fehler, den `scripts/realtime/abos-pruefen.sh` sucht.
--
-- WARUM DAS SICHER IST: `select` heisst nicht „alles sichtbar". RLS entscheidet
-- die ZEILEN — Mandanten-Policy plus die restriktiven Objekt-Scopes aus 0620
-- (`owner_can_see_property`, `staff_can_see_property`, beide fail-closed). Ein
-- Eigentümer sieht damit die Schäden SEINER Objekte, eine Reinigungskraft die
-- ihrer zugewiesenen, ein Fremder nichts. Der Schreibpfad bleibt zu: die
-- GRANTS für insert/update/delete sind entzogen und die restriktive
-- `write_restrict`-Policy steht.
--
-- `inventory_damage_photo` bekommt es ebenfalls: die Zeile trägt nur den
-- Ablagepfad, die Datei selbst liegt im privaten Bucket `inventar-schaeden`
-- und ist ausschliesslich über eine serverseitig signierte URL erreichbar.

grant select on public.inventory_room to authenticated;
grant select on public.inventory_damage to authenticated;
grant select on public.inventory_damage_photo to authenticated;

-- `anon` bekommt NICHTS. Ein nicht angemeldeter Aufruf hat an einer
-- Inventarliste nichts zu suchen, und `current_tenant_id()` wäre dort ohnehin
-- leer — die Policy würde jede Zeile verwerfen. Das GRANT wegzulassen ist der
-- ehrlichere Riegel: kein Zugriff statt „Zugriff, der immer leer ausgeht".
revoke all on public.inventory_room from anon;
revoke all on public.inventory_damage from anon;
revoke all on public.inventory_damage_photo from anon;

-- Dieselbe Lücke bei den Mappe-Tabellen aus 0619 — dort ist sie ABSICHT und
-- bleibt: `mappe_dokument` trägt Pfade zu Hausordnungen mit Türcodes, und die
-- restriktive `kein_direktzugriff`-Policy (using false) verweigert dort
-- ohnehin jede Zeile. Ein `select`-GRANT wäre dort ein Element ohne Wirkung.
