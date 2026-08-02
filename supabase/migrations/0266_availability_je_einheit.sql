-- 0266_availability_je_einheit.sql — Belegung je Einheit (Phase 2, Schritt 1)
--
-- `availability` hat heute genau EINE Zeile je (Objekt, Tag) und kann deshalb
-- nur „ganz frei" oder „ganz belegt" ausdrücken. Für einen Typ mit mehreren
-- identischen Einheiten (0265) ist das zu grob: die erste Buchung würde dem
-- ganzen Typ die Verfügbarkeit nehmen. Der Kalender liest AUSSCHLIESSLICH aus
-- dieser Tabelle — es gibt keine zweite Quelle —, also bekommt sie die
-- Einheiten-Dimension.
--
-- BEWUSST ADDITIV: Die alte Unique-Bedingung (property_id, date) bleibt in
-- dieser Migration bestehen. Auf dem Server läuft noch die alte Version, die mit
-- `on_conflict=property_id,date` schreibt — würde der Schlüssel jetzt wechseln,
-- kippten dort sofort alle Kalender-Schreibpfade. Solange jedes Objekt genau
-- eine Einheit hat, gelten beide Bedingungen gleichzeitig und niemand merkt
-- etwas. Die alte Bedingung fällt erst in dem Schritt, der das Aufteilen in
-- mehrere Einheiten freischaltet (dann sind alle Schreiber umgestellt).

alter table public.availability
    add column if not exists unit_id uuid
        references public.property_units(id) on delete cascade;

-- Bestand: jede Zeile gehört der (einzigen) Einheit ihres Objekts.
update public.availability a
   set unit_id = u.id
  from public.property_units u
 where u.property_id = a.property_id
   and a.unit_id is null;

-- Kein Bestand ohne Einheit: die Spalte trägt ab jetzt die Wahrheit, wem der Tag
-- gehört. NULL wäre „gilt für alle Einheiten" — eine zweite Bedeutung, die den
-- Unique-Schlüssel und jede Zählung mehrdeutig machte (Wurzel 4: keine
-- Doppelbedeutung, lieber eine Zeile je Einheit).
alter table public.availability
    alter column unit_id set not null;

create unique index if not exists availability_property_unit_date_uidx
    on public.availability(property_id, unit_id, date);

comment on column public.availability.unit_id is
    'Einheit, der dieser Tag gehört (0265/0266). Ein Sperr-Tag des ganzen Typs '
    'steht als je eine Zeile pro Einheit.';
