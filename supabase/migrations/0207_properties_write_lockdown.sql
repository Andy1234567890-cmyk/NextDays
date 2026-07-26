-- Schreibpfad auf public.properties schließen (Wurzel 6).
--
-- BEFUND: anon UND authenticated hatten INSERT, UPDATE, DELETE auf properties.
-- Die tenant-RLS-Policy begrenzt zwar, WELCHE Zeilen ein Nutzer trifft — sie
-- verhindert aber nicht, dass er sie überhaupt ändert. Verifiziert mit einem
-- echten Betriebs-Nutzer-Token:
--
--     PATCH /rest/v1/properties?tenant_id=eq.<eigener>  {"moderation_status":"approved"}
--     → 204
--
-- Damit konnte sich ein Gastgeber selbst für den Marktplatz freigeben und die
-- Prüfung aus 0203 komplett umgehen. Ebenso wären Preise, Kapazitäten und
-- Kanal-Flags direkt manipulierbar gewesen — vorbei an jeder Validierung des
-- properties-Slice (Typ-/Betriebsart-Prüfung, Channex-Sync, Publish-Gates).
--
-- Das ist die Lücke, die Wurzel 6 beschreibt: „enable rls + tenant-Policy
-- reicht NICHT für sensible Daten" — es braucht zusätzlich den GRANT-Entzug.
--
-- Was bleibt: SELECT (für Realtime + Lesen, weiterhin durch RLS gescopt).
-- Geschrieben wird ausschließlich serverseitig über den properties-Slice mit
-- service_role, wo die Fachregeln greifen.

revoke insert, update, delete on public.properties from anon, authenticated;

-- anon braucht auf einer Objekt-Tabelle gar kein SELECT: der öffentliche
-- Marktplatz liest über den public_portal-Slice (service_role), nicht direkt.
revoke select on public.properties from anon;

comment on table public.properties is
    'Objekte (1 Zeile = 1 buchbare Einheit). SCHREIBEN ausschließlich '
    'serverseitig über den properties-Slice (service_role) — anon/authenticated '
    'haben nur SELECT, damit Realtime funktioniert. Ein direkter Client-Schreib'
    'zugriff würde Publish-Gates und die Marktplatz-Freigabe (0203) umgehen.';
