-- 0722 — Eigentümer sehen den vollen Gastnamen und die Nationalität
--
-- Entscheidung des Betreibers vom 18.09.2026, auf Wunsch der Eigentümer.
-- Bis hierher sah ein Eigentümer im Portal nur den VORNAMEN seines Gastes
-- (§4.2, `guest_masking`). Begründung der Änderung: er haftet für sein Objekt,
-- empfängt Gäste teils selbst und kann eine Beschwerde oder einen Schaden ohne
-- Nachnamen keiner Buchung zuordnen.
--
-- WARUM ES DIESE MIGRATION ÜBERHAUPT BRAUCHT:
-- `effective_permissions` (granular_permissions.py) liest AUSSCHLIESSLICH die
-- gespeicherte Liste in `users.permissions`. Es gibt keinen Rückfall auf die
-- Rollenvorgabe `_OWNER` — diese gilt nur beim ANLEGEN eines Nutzers. Die
-- Vorgabe im Code zu erweitern wirkt deshalb ausschliesslich auf künftige
-- Eigentümer; jeder heute bestehende hätte die Änderung nie gesehen. Genau
-- diese Sorte Lücke bleibt still: niemand bekommt einen Fehler, die Funktion
-- ist nur für alle Bestandskunden nicht da.
--
-- Was NICHT passiert: Kontakt (E-Mail/Telefon) und Ausweisdaten bleiben dem
-- Eigentümer verschlossen — dafür brauchte es `view_guest_contact` bzw.
-- `view_guest_id_docs`, und die vergibt diese Migration bewusst nicht.
--
-- Es bleibt eine ENTZIEHBARE Berechtigung: ein Betrieb, der seinen Eigentümern
-- weniger zeigen will, nimmt sie dem einzelnen Nutzer wieder weg. Darum wird
-- hier auch nur ERGÄNZT und nichts überschrieben.

update public.users
   set permissions = (
         select jsonb_agg(distinct wert)
           from jsonb_array_elements(
                  coalesce(permissions, '[]'::jsonb) || '["view_guest_name"]'::jsonb
                ) as wert
       )
 where role = 'owner'
   -- Nur Zeilen, denen das Recht wirklich fehlt: sonst schreibt die Migration
   -- jede Eigentümer-Zeile neu und löst deren Trigger aus, ohne etwas zu ändern.
   and not (coalesce(permissions, '[]'::jsonb) @> '["view_guest_name"]'::jsonb);
