-- 0725 — den vergessenen Adressaten der Funktions-Sperre nachziehen: PUBLIC.
--
-- BEFUND (Audit 19.09.2026): PostgreSQL vergibt EXECUTE auf eine neue Funktion
-- standardmaessig an die Pseudo-Rolle PUBLIC. Ein `revoke ... from anon,
-- authenticated` hebt ein ueber PUBLIC gehaltenes Recht NICHT auf — die
-- Funktion bleibt fuer jeden eingeloggten Nutzer per
-- `POST /rest/v1/rpc/<name>` aufrufbar, obwohl der Entzug dasteht und
-- vollstaendig aussieht. Genau die Sorte Sperre, die man fuer geschlossen
-- haelt (Wurzel 6).
--
-- Das Repo macht es an zwei Stellen richtig (0107:24 und 0721:195 entziehen
-- ausdruecklich `from public`) und an drei Stellen nicht. Diese Migration
-- zieht die drei nach und schliesst die KLASSE, damit es nicht wieder
-- passiert.
--
-- NICHT angefasst werden die Policy-Helfer: siehe Abschnitt 3.

-- -------------------------------------------------------------------------
-- 1) Der eine SCHREIBENDE Kandidat
-- -------------------------------------------------------------------------
-- public_api_ereignis ist SECURITY DEFINER, nimmt p_tenant_id als ARGUMENT
-- und schreibt in public_api_events. Haelt PUBLIC hier EXECUTE, kann ein
-- eingeloggter Nutzer Partner-API-Ereignisse in FREMDE Mandanten schreiben —
-- der Mandant kommt aus dem Argument, nicht aus dem JWT.
--
-- Kein Aufrufer verliert dadurch etwas: die fuenf Aufrufer sind die
-- Trigger-Funktionen aus 0418/0424, und die sind selbst `security definer`.
-- Sie laufen als ihr Eigentümer, nicht als der schreibende Nutzer.
revoke execute on function public.public_api_ereignis(uuid, text, uuid, jsonb)
    from public;
grant execute on function public.public_api_ereignis(uuid, text, uuid, jsonb)
    to service_role;

-- -------------------------------------------------------------------------
-- 2) Die Klasse: Backstop fuer ALLE kuenftigen Funktionen
-- -------------------------------------------------------------------------
-- 0187:110 und 0229:208 setzen den Default-Privileges-Backstop nur gegen
-- `anon, authenticated` — also gegen die beiden Rollen, die Supabase explizit
-- beschenkt, aber nicht gegen das eingebaute PUBLIC-EXECUTE. Das ist die
-- strukturelle Ursache hinter Abschnitt 1: jede neue Funktion faengt wieder
-- offen an, und der naechste `revoke from anon, authenticated` sieht wieder
-- vollstaendig aus.
--
-- Fuer BEIDE erzeugenden Rollen, aus demselben Grund wie 0337:975 — die
-- Migrationen laufen als supabase_admin (apply-migrations.sh), Supabase legt
-- manches als postgres an. Nur eine der beiden zu setzen war der Fehler, der
-- nach 0187 dreimal aufriss.
--
-- WIRKUNG AUF KUENFTIGE POLICY-HELFER: ein neuer Helfer, der in einer
-- RLS-Policy ausgewertet wird, braucht ab jetzt ein AUSDRUECKLICHES
-- `grant execute ... to authenticated`. Das ist gewollt — fail-closed, und
-- der Grant steht dann sichtbar in der Migration statt als unsichtbarer
-- Default.
alter default privileges for role supabase_admin in schema public
    revoke execute on functions from public;
alter default privileges for role postgres in schema public
    revoke execute on functions from public;

-- -------------------------------------------------------------------------
-- 3) Die Policy-Helfer behalten EXECUTE — Ausnahmeliste fortgeschrieben
-- -------------------------------------------------------------------------
-- 0229:189-193 haelt fest, dass current_db_role, is_platform_admin,
-- diagnostics_freigabe_laeuft, owner_can_see_property und
-- staff_can_see_property ihr PUBLIC-execute BEWUSST behalten: sie werden in
-- RLS-Policies ausgewertet, und eine Policy laeuft als der abfragende Nutzer.
-- Ohne EXECUTE schlaegt nicht die Funktion fehl, sondern die POLICY — der
-- Nutzer sieht dann gar nichts mehr.
--
-- Diese Liste wurde seit 0229 nie fortgeschrieben. Nachgetragen, gegen die
-- Migrationen geprueft (Vorkommen in `using`/`with check`):
--
--   owner_can_see_task        0404 — Policy auf tasks
--   staff_can_see_task        0541 — Policy auf tasks
--   personal_sieht_person     0541 — vier Policies im Personal-Bereich
--   personal_sieht_schicht    0541 — Policy auf die Schichten
--   support_topic_teilnehmer  0236 — zwei Policies auf realtime.messages
--
-- Alle fuenf sind boolesch und fail-closed (unbekannte/fehlende Rolle ->
-- false). Sie geben keine Daten aus; wer sie aufruft, erfaehrt hoechstens,
-- ob eine Zuordnung besteht. Das ist der Preis dafuer, dass die Policies
-- funktionieren, und er ist hier ausdruecklich akzeptiert — nicht vergessen.
--
-- Wer einen dieser Helfer kuenftig schliessen will, muss ZUERST die Policy
-- umbauen, die ihn auswertet. Reihenfolge andersherum legt die Tabelle still.

-- -------------------------------------------------------------------------
-- 4) klima_normalwerte: anon-Leserecht zurueckziehen
-- -------------------------------------------------------------------------
-- 0339 hat den Endzustand festgeschrieben: anon liest in `public` NUR
-- property_categories und property_subtypes. 0551:82 hat danach wieder ein
-- `grant select ... to anon` gesetzt. Die Policy verlangt zwar
-- `auth.jwt()->>'tenant_id'`, ohne JWT kaeme also nichts zurueck — aber genau
-- diese Konstruktion („Grant offen, RLS haelt schon") benennt 0339 als die
-- falsche Verteidigungslinie. Die Schwestertabellen dp_verlauf,
-- dp_preisgrenzen und dp_ki_entscheidungen wurden in 0710:141 geschlossen;
-- klima_normalwerte blieb dabei liegen.
--
-- `authenticated` behaelt sein select — dort haengt die Anzeige dran.
revoke select on public.klima_normalwerte from anon;
