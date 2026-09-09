-- 0616 — `owner_chat` an bestehende Eigentümer nachtragen.
--
-- DER FEHLER, den das behebt: `effective_permissions` liest AUSSCHLIESSLICH
-- die Spalte `users.permissions`. Der Rollen-Standard `_OWNER` aus
-- `granular_permissions.py` wird nur beim ANLEGEN eines Kontos
-- hineingeschrieben — ein NEUES Recht erreicht bestehende Konten nie von
-- selbst.
--
-- Mit 0611 kam `OWNER_CHAT` in den Standard, aber die fünf bestehenden
-- Eigentümer trugen es nicht. Der Guard `require_portal_recht` lehnte
-- deshalb jeden Aufruf mit 403 ab, und die App zeigte „Die Nachrichten
-- konnten nicht geladen werden" — ein fertig gebautes, live deploytes
-- Feature, das für JEDEN Eigentümer unerreichbar war.
--
-- Nachgemessen am 09.09.2026: 5 von 5 Eigentümer-Konten ohne das Recht,
-- alle Endpunkte live (401 ohne Token, nicht 404).

-- Nur EIGENTÜMER, und nur wenn das Recht fehlt. Angehängt statt ersetzt: die
-- individuell vergebenen Rechte der Verwaltung bleiben unangetastet
-- (Wurzel 1 — der Gegenzustand ist hier der bestehende Satz, nicht ein
-- überschriebener Standard).
--
-- `permissions` ist jsonb (0022), kein text[] — also `||` mit einem
-- jsonb-Array, nicht `array_append`. Der `@>`-Test prüft die Enthaltung im
-- jsonb; `coalesce` fängt eine leere Spalte ab, auch wenn sie `not null` ist.
update public.users
   set permissions = coalesce(permissions, '[]'::jsonb) || '["owner_chat"]'::jsonb
 where role = 'owner'
   and not (coalesce(permissions, '[]'::jsonb) @> '["owner_chat"]'::jsonb);

-- Kein Nachtrag für andere Rollen: admin trägt `_ALL` (der Guard gibt ihm
-- alles ohne Spalteneintrag), und staff/cleaner sollen den Eigentümer-Chat
-- bewusst nicht sehen.
