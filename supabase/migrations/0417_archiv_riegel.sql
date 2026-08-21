-- 0417 — Archivierte Objekte fallen ÜBERALL heraus, ohne Filter je Abfrage.
--
-- WARUM DIESE MIGRATION EXISTIERT: 0416 hat `archived_at` eingeführt, und der
-- Filter wurde dort gesetzt, wo er dem Autor gerade auffiel — in der
-- Objektliste. Live zeigte sich sofort, was das wert ist: das archivierte
-- Objekt stand weiter in der Zuordnungsliste von Booking.com UND Airbnb, mit
-- einem „Verbinden"-Knopf, der es neu angelegt (und neue Kosten erzeugt) hätte.
--
-- Der Code hat 219 Leseabfragen auf `properties`. Fünf davon kannten den
-- Filter. Jede einzeln nachzuziehen behebt den HEUTIGEN Stand und nichts
-- weiter: die nächste neue Abfrage vergisst ihn wieder, und der Fehler ist
-- unsichtbar — ein archiviertes Objekt sieht wie ein normales aus.
--
-- DESHALB EIN RIEGEL AN DER QUELLE: Die Datenbank filtert selbst. Anwendungen
-- lesen weiterhin `properties`, sehen dort aber nur das Geführte. Wer das
-- Archiv WILL, sagt es ausdrücklich (`archived_at is not null` bzw. die
-- Archiv-Sicht) — die Vollständigkeit ist damit nicht mehr von Disziplin
-- abhängig.
--
-- WARUM KEIN VIEW-UMBAU: Eine `properties_aktiv`-Sicht hätte 219 Aufrufstellen
-- umzubenennen — dasselbe Problem in anderer Form, nur mit mehr Bewegung. Der
-- RLS-Riegel wirkt ohne eine einzige Änderung am Leseweg.

-- 1) Der Riegel für die Client-Wege (anon/authenticated über PostgREST).
--
-- RESTRICTIVE, nicht permissive: er UND-verknüpft mit den bestehenden
-- Policies, statt eine weitere Erlaubnis daneben zu stellen. Eine permissive
-- Policy hätte die Sperre wirkungslos gemacht (Wurzel 6).
drop policy if exists properties_archiv_verbergen on public.properties;
create policy properties_archiv_verbergen on public.properties
  as restrictive
  for select
  to anon, authenticated
  using (archived_at is null);

comment on policy properties_archiv_verbergen on public.properties is
  'Archivierte Objekte (0416) sind über die Client-Wege unsichtbar. Der Server '
  '(service_role) sieht sie weiter — er braucht sie für die Archiv-Ansicht und '
  'für die Historie der Buchungen, die daran hängen.';

-- 2) Der Server (service_role) bleibt ausgenommen — bewusst.
--
-- Er MUSS das Archiv lesen können: die Archiv-Ansicht (`?archiviert=true`), das
-- Zurückholen, der Channex-Wächter (`_channex_verwaiste_abraeumen`) und jede
-- Auswertung über die Buchungshistorie eines gekündigten Objekts laufen
-- darüber. Ein Riegel auch für service_role hätte genau die Wege abgeschnitten,
-- die das Archiv erst benutzbar machen.
--
-- Der Schutz für die Server-Seite ist deshalb NICHT die Sichtbarkeit, sondern
-- die Absicht: dort wird `archiviert=` explizit übergeben. Was der Server ohne
-- diese Angabe listet, filtert er selbst (`PropertiesService.list`).

-- 3) Damit der Riegel nicht in einen Full-Scan läuft.
create index if not exists properties_aktiv_idx
  on public.properties (tenant_id)
  where archived_at is null;
