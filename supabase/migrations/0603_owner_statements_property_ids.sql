-- 0603 — Abrechnung pro Objekt: welche Objekte eine Abrechnung umfasst.
--
-- WARUM (Lastenheft §6, Etappe 13.3): Eine Abrechnung galt bisher immer für
-- ALLE Objekte eines Eigentümers. Wer für ein einzelnes Haus abrechnen will
-- (getrennte Bankkonten je Objekt, ein Objekt im Verkauf, ein Objekt mit
-- eigenem Steuerberater), hatte keinen Weg — `owner_statements` kannte nur
-- `owner_id` + Zeitraum, und `_reservations` lud alles, was dem Eigentümer
-- gehört.
--
-- FORM: `uuid[]`, NULL = alle Objekte des Eigentümers. Der Bestand ist damit
-- bedeutungsgleich (jede vorhandene Abrechnung umfasst alle Objekte, so wurde
-- sie gerechnet). Ein gesetzter Wert ist NIE leer — eine Abrechnung über null
-- Objekte wäre eine leere Rechnung mit fortlaufender Nummer.
--
-- Bewusst KEINE Fremdschlüssel-Prüfung je Element (uuid[] kann das nicht): der
-- Service prüft beim Anlegen, dass jede ID zu einem Objekt DIESES Eigentümers
-- gehört (Wurzel 3/9), und der Snapshot muss auch dann lesbar bleiben, wenn ein
-- Objekt später entzogen oder archiviert wird — eine finalisierte Rechnung
-- darf nicht unlesbar werden, weil sich die Zuordnung geändert hat.
--
-- Kein Grant-/RLS-Teil: `owner_statements` ist über 0187 für anon/authenticated
-- vollständig gesperrt (Wurzel 6) — eine neue Spalte ändert daran nichts.

alter table public.owner_statements
    add column if not exists property_ids uuid[];

alter table public.owner_statements
    drop constraint if exists owner_statements_property_ids_nicht_leer;

alter table public.owner_statements
    add constraint owner_statements_property_ids_nicht_leer
    check (property_ids is null or cardinality(property_ids) > 0);

comment on column public.owner_statements.property_ids is
    '0603: Objekte, die diese Abrechnung umfasst. NULL = alle Objekte des '
    'Eigentümers (Bestand vor 0603). Gesetzt = Teilmenge, nie leer. Der '
    'Service prüft die Zugehörigkeit beim Anlegen; die Spalte ist ein Snapshot '
    'und bleibt auch nach einem Entzug des Objekts lesbar.';
