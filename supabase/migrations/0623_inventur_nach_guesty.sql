-- 0623 — Inventur dort, wo ohnehin jemand steht: im Reinigungsdurchgang
--
-- WARUM DIESE MIGRATION 0620 KORRIGIERT: 0620 hat eine Bestandsliste gebaut —
-- Name, Raum, Soll, Ist. Das ist keine Inventur. Nach Recherche der Praxis
-- (Guesty, Breezeway, Sortly, Traum-Ferienwohnungen) fehlten sechs Dinge, und
-- der Zuschnitt war falsch:
--
-- Guesty baut KEINEN eigenen Inventarbereich. Die Zählung hängt am Turnover:
-- die Reinigungskraft, die nach der Abreise ohnehin im Haus steht, hakt die
-- Punkte in ihrer Checkliste ab. Ein getrennter Bereich, den jemand extra
-- öffnen müsste, wird nicht gepflegt — und eine ungepflegte Inventarliste ist
-- schlimmer als keine, weil sie Sicherheit vortäuscht.
--
-- Dieses Projekt hat die Bausteine dafür bereits: `task_rules` mit Auslöser
-- `check_out` (0272), `task_rule_items` als Vorlage, `checklist_items` je
-- Aufgabe, `requires_photo` mit 422 beim Abschluss ohne Bild (0123/0126),
-- und die App, in der abgehakt wird. Es fehlte allein die VERBINDUNG zwischen
-- Inventarzeile und Checklistenpunkt.
--
-- DIE SECHS PUNKTE:
--   1. Meldebestand statt reinem Soll (Guestys „par level"): Unterschreitung
--      löst eine Nachfüll-Aufgabe aus.
--   2. Zählpunkte in der Reinigungs-Checkliste — der Kern.
--   3. Zwei Rhythmen: Wertsachen/Verbrauch bei jeder Abreise, Möbel
--      quartalsweise, Rest jährlich (Sortly: „Appliances, furniture and shared
--      tools get quarterly counts. Consumables and parts get annual
--      reconciliation").
--   4. Zustand am Gegenstand für die Ersatzplanung — unabhängig vom Schaden.
--      Die Vermieter-Ratgeber nennen das als Kern der Liste: „dazu gehört
--      auch, ob sie in gutem oder schlechtem Zustand sind".
--   5. Foto vom INTAKTEN Zustand. Ohne Vorher-Bild kein Nachweis im
--      Streitfall; 0620 kannte Fotos nur am Schaden.
--   6. Fehlbestand an die Buchung — wer war da, als es verschwand. Das ist der
--      Kautionsfall, den mehrere Quellen als Hauptzweck nennen.
--
-- BEWUSST NICHT GEBAUT: Abschreibung und Anlagenbuchhaltung. Guesty hat das
-- nicht, und es gehört in die Buchhaltung, nicht in die Objektkartei.

-- --------------------------------------------------------------------------
-- 1 + 3 + 4 — Art, Meldebestand, Zählrhythmus, Zustand
-- --------------------------------------------------------------------------
alter table public.inventory_items
    -- Ein Sofa und Spülmittel sind nicht dasselbe. `verbrauch` wird
    -- nachgefüllt und hat einen Meldebestand; `bestand` ist ein Gegenstand,
    -- der da ist oder fehlt und einen Zustand hat. 0620 kannte nur „Menge"
    -- und behandelte beides gleich.
    add column if not exists art text not null default 'bestand'
        check (art in ('bestand', 'verbrauch')),

    -- MELDEBESTAND (Guesty: „par level"). Unterschreitung löst eine
    -- Nachfüll-Aufgabe aus. NULL = kein Meldebestand gepflegt, also keine
    -- Auslösung — ausdrücklich nicht 0, das hiesse „melde nie".
    add column if not exists meldebestand integer
        check (meldebestand is null or meldebestand >= 0),

    -- ZÄHLRHYTHMUS. Praxis: Wertsachen und Verbrauch bei JEDER Abreise,
    -- Möbel quartalsweise, der Rest jährlich. Ohne diese Angabe stünden 200
    -- Zeilen auf jeder Abreise-Checkliste und niemand hakte sie noch ab.
    add column if not exists zaehl_rhythmus text not null default 'jaehrlich'
        check (zaehl_rhythmus in ('jede_abreise', 'quartal', 'jaehrlich', 'nie')),
    -- Wann zuletzt im RHYTHMUS gezählt (nicht: nebenbei angesehen). Trägt die
    -- Fälligkeit der nächsten Zählung.
    add column if not exists zuletzt_gezaehlt_am timestamptz,

    -- ZUSTAND für die Ersatzplanung — unabhängig vom Schaden. Ein Sofa kann
    -- heil und trotzdem durchgesessen sein; `ersatz_faellig` ist die Zeile,
    -- die in die Budgetplanung der nächsten Saison geht.
    add column if not exists zustand text not null default 'gut'
        check (zustand in ('neu', 'gut', 'abgenutzt', 'ersatz_faellig')),
    add column if not exists zustand_notiz text
        check (zustand_notiz is null or length(zustand_notiz) <= 500),

    -- 5 — FOTO DES INTAKTEN ZUSTANDS. Ein Pfad, kein Bilderalbum: es geht um
    -- das eine Referenzbild „so sieht es aus, wenn es in Ordnung ist".
    -- Mehrere Bilder gehören an den Schaden (`inventory_damage_photo`).
    add column if not exists referenz_foto_pfad text
        check (referenz_foto_pfad is null or length(referenz_foto_pfad) <= 600),

    -- Anschaffung: Datum und Wert. KEINE Abschreibung — nur die Angabe, die
    -- im Schadensfall den Zeitwert begründet und beim Ersatz die Frage „was
    -- hat das damals gekostet?" beantwortet.
    add column if not exists angeschafft_am date,
    add column if not exists anschaffungswert numeric(12, 2)
        check (anschaffungswert is null or anschaffungswert >= 0),
    -- Währung IMMER aus den Daten (Wurzel 4). Zusammen mit dem Wert gesetzt
    -- oder gar nicht.
    add column if not exists anschaffung_currency text
        check (anschaffung_currency is null or length(anschaffung_currency) = 3);

alter table public.inventory_items
    drop constraint if exists inventory_items_wert_hat_waehrung;
alter table public.inventory_items
    add constraint inventory_items_wert_hat_waehrung
        check ((anschaffungswert is null) = (anschaffung_currency is null));

-- Die Zeilen, die auf die nächste Abreise-Checkliste gehören. Der Teilindex
-- hält ihn klein: der Normalfall ist `jaehrlich`, gesucht wird die Minderheit.
create index if not exists inventory_items_abreise_idx
    on public.inventory_items (tenant_id, property_id)
    where zaehl_rhythmus = 'jede_abreise';

comment on column public.inventory_items.meldebestand is
    'Guestys „par level": Unterschreitung löst eine Nachfüll-Aufgabe aus. '
    'NULL = nicht gepflegt, NICHT 0.';
comment on column public.inventory_items.zaehl_rhythmus is
    'Wie oft gezählt wird. jede_abreise landet auf der Reinigungs-Checkliste.';
comment on column public.inventory_items.zustand is
    'Ersatzplanung, unabhaengig vom Schaden: ein Sofa kann heil und trotzdem '
    'durchgesessen sein.';

-- --------------------------------------------------------------------------
-- 2 — Der Zählpunkt in der Reinigungs-Checkliste
-- --------------------------------------------------------------------------
-- `checklist_items` bekommt einen Verweis auf die Inventarzeile. Damit weiss
-- der Punkt „Gedecke vollstaendig?", WORAUF er sich bezieht — und ein
-- Fehlbestand kann von dort aus gemeldet werden, ohne dass die
-- Reinigungskraft die Kartei öffnet (die sie gar nicht sehen darf).
--
-- `on delete set null`: wird ein Gegenstand aus dem Inventar genommen, bleibt
-- der Checklistenpunkt einer LAUFENDEN Aufgabe stehen. Er ist eine
-- Momentaufnahme (siehe `_copy_checklist`), keine Live-Ansicht.
alter table public.checklist_items
    add column if not exists inventory_item_id uuid
        references public.inventory_items (id) on delete set null,
    -- Das Ergebnis der Zählung an diesem Punkt. NULL = noch nicht gezählt,
    -- ausdrücklich verschieden von 0 („nichts mehr da").
    add column if not exists gezaehlte_menge integer
        check (gezaehlte_menge is null or gezaehlte_menge >= 0);

create index if not exists checklist_items_inventar_idx
    on public.checklist_items (inventory_item_id)
    where inventory_item_id is not null;

comment on column public.checklist_items.inventory_item_id is
    'Zählpunkt: worauf sich dieser Checklistenpunkt bezieht. Gesetzt von der '
    'Abreise-Regel aus den Inventarzeilen mit zaehl_rhythmus=jede_abreise.';

-- Dieselbe Verbindung an der VORLAGE: ein Betrieb kann einen Zählpunkt fest
-- in seine Reinigungsvorlage schreiben, unabhängig vom Rhythmus.
alter table public.task_rule_items
    add column if not exists inventory_item_id uuid
        references public.inventory_items (id) on delete cascade;

-- --------------------------------------------------------------------------
-- 6 — Der Fehlbestand hängt an einer Buchung
-- --------------------------------------------------------------------------
-- `inventory_damage.reservation_id` gibt es seit 0620, aber nur als optionale
-- Angabe bei `traeger='gast'`. Für den Kautionsfall fehlt die Gegenrichtung:
-- WELCHE Zählung hat den Fehlbestand entdeckt, und in welcher Aufgabe.
alter table public.inventory_damage
    -- Aus welcher Zählung die Meldung stammt. `set null`: wird die Aufgabe
    -- gelöscht, bleibt der Schaden — er ist passiert.
    add column if not exists gemeldet_aus_task_id uuid
        references public.tasks (id) on delete set null,
    -- Der Zählpunkt, an dem es auffiel.
    add column if not exists gemeldet_aus_item_id uuid
        references public.checklist_items (id) on delete set null;

comment on column public.inventory_damage.reservation_id is
    'Die Buchung, deren Gast betroffen ist — der Kautionsfall. Wird beim '
    'Melden aus dem Turnover automatisch gesetzt: die Abreise, die die '
    'Reinigungsaufgabe ausgelöst hat.';

-- --------------------------------------------------------------------------
-- Der Nachschub-Anker: Wurzel 2
-- --------------------------------------------------------------------------
-- Eine Unterschreitung des Meldebestands darf NICHT bei jedem Turnover eine
-- neue Nachfüll-Aufgabe erzeugen — sonst stehen nach drei Abreisen drei
-- gleiche Aufgaben da. Der Anker hält fest, dass für DIESE Zeile schon eine
-- offene Aufgabe existiert; er wird geräumt, sobald sie abgeschlossen ist.
alter table public.inventory_items
    add column if not exists nachfuell_task_id uuid
        references public.tasks (id) on delete set null;

comment on column public.inventory_items.nachfuell_task_id is
    'Offene Nachfuell-Aufgabe zu dieser Zeile. Verhindert, dass jeder '
    'Turnover eine weitere anlegt (Wurzel 2).';

-- --------------------------------------------------------------------------
-- Bucht für die Referenzfotos
-- --------------------------------------------------------------------------
-- Dieselbe Ablage wie die Schadensfotos (0620): derselbe Schutzbedarf, und
-- zwei Buckets für dasselbe Thema wären zwei Rechteverwaltungen. Der Pfad
-- trennt sie (`.../referenz/...`).
-- Kein neuer Bucket, nur der Hinweis, dass er beides trägt.
comment on column public.inventory_items.referenz_foto_pfad is
    'Bild des intakten Zustands im privaten Bucket `inventar-schaeden`, '
    'Unterpfad referenz/. Ohne Vorher-Bild gibt es im Streitfall keinen '
    'Vergleich.';
