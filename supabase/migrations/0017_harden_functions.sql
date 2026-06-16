-- 0017_harden_functions.sql — Security-Hardening der Helper-Funktionen
--
-- Behebt den Supabase-Advisor "function_search_path_mutable": ein festes,
-- leeres search_path verhindert, dass ein manipulierter Suchpfad die Funktion
-- umlenkt. Objekte werden in den Funktionen ohnehin schema-qualifiziert
-- (public., pg_catalog-Builtins) referenziert.

alter function public.current_tenant_id() set search_path = '';
alter function public.set_updated_at() set search_path = '';
