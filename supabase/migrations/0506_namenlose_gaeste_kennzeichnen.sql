-- 0506 — Gäste ohne echten Namen als prüfbedürftig kennzeichnen (Bestand).
--
-- BEFUND (live gemessen am 30.08.2026, Beta-Betrieb AirSmil): 150 von 293
-- Gästen tragen als Namen den Gedankenstrich '—', und ALLE 293 stehen auf
-- `needs_review = false`. Die Kennzeichnung, an der die Kartei Unvollständiges
-- erkennen soll, hat nie einen Datensatz getroffen.
--
-- URSACHE: `_create_guest` schreibt `name or email or '—'`, weil `guests.name`
-- NOT NULL ist. `create_placeholder_guest` setzt `needs_review = true` —
-- erreicht wird dieser Pfad aber nur ohne JEDES Merkmal. Airbnb liefert über
-- Channex eine stabile Gast-ID (`stable_external_ref`), aber keinen Namen:
-- damit greift der REGELPFAD `resolve_or_create_guest` mit `needs_review`
-- unverändert `false`, und der Strich entsteht still als Fallback.
-- 148 der 150 Fälle sind genau diese Airbnb-Buchungen.
--
-- Der Code ist in derselben Änderung an der Wurzel korrigiert
-- (`identity.py::_create_guest` leitet `needs_review` aus dem Namen ab, statt
-- dem Aufrufer zu vertrauen). Diese Migration zieht nur den BESTAND nach —
-- ohne sie blieben die 150 vorhandenen Zeilen unmarkiert, weil sie nie wieder
-- durch den Insert-Pfad laufen.
--
-- KEIN Datenverlust: `needs_review` ist eine Markierung, kein Inhalt. Der
-- Name bleibt unangetastet — was Airbnb nicht liefert, können wir nicht
-- erfinden (Wurzel 4). Die Oberfläche zeigt statt des nackten Strichs künftig
-- den Kanal samt Buchungsbezug.

update public.guests
   set needs_review = true
 where needs_review = false
   and (
     name is null
     or btrim(name) = ''
     or btrim(name) = '—'
   );

-- Teilindex für den Filter „Unvollständig" der Gästekartei: gefragt wird nach
-- den wenigen `true`-Zeilen, ein voller Index brächte nichts.
create index if not exists guests_needs_review_idx
  on public.guests (tenant_id, name)
  where needs_review;

comment on column public.guests.needs_review is
  'Gast ist unvollständig und braucht manuelle Pflege: kein echter Name (der '
  'Kanal liefert keinen — Airbnb etwa nie), oder E-Mail und Telefon zeigten '
  'beim Anlegen auf verschiedene Bestandsgäste. Wird in `_create_guest` aus '
  'dem Ergebnis abgeleitet, nicht vom Aufrufer gesetzt.';
