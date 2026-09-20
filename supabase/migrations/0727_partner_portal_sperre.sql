-- 0727 — zweiter Schalter: das Partner-Dashboard (partner.mynextdays.com) sperren.
--
-- Gleiche Bauart wie 0726 fuer das Eigentuemer-Portal, gleiche Zeile, zwei neue
-- Spalten. Bewusst KEIN generisches Schluessel/Wert-Feld: benannte Spalten sind
-- nachlesbar, und jeder neue Schalter bleibt als Migration sichtbar.
--
-- WAS GESPERRT WIRD und was ausdruecklich NICHT:
--
-- Gesperrt sind die 34 DATEN-Routen der Partner-Welt — alles, was hinter
-- `require_approved_affiliate` haengt (Dashboard, Kunden, Provisionen,
-- Auszahlungen, Links, Beitraege, Team).
--
-- OFFEN bleiben mit Absicht:
--   /affiliates/clicks       Die Marketing-Seite meldet hier jeden Klick auf
--                            einen Partner-Link. Waere das zu, verlaere die
--                            Zuordnung STILL — der Partner bekaeme spaeter kein
--                            Geld fuer Kunden, die er gebracht hat, und niemand
--                            saehe einen Fehler. Eine Sperre darf keine
--                            Abrechnungsdaten vernichten (Wurzel 1: der
--                            Gegenzustand laesst sich nicht nachtraeglich
--                            herstellen).
--   /affiliates/auth/*       Anmeldung, Erneuern, Passwort. Ohne sie koennte die
--                            Oberflaeche den Hinweis gar nicht anzeigen, weil
--                            sie ohne Sitzung nicht weiss, wer da klopft.
--   /affiliates/me           Eigener Status — dieselbe Begruendung.
--   /affiliates/apply        Bewerbungen laufen weiter ein; sie zu verlieren
--                            waere teurer als sie liegen zu lassen.
--   /affiliates/tiers        Oeffentliche Stufenliste, steht auch auf der
--                            Marketing-Seite.
--   /platform/affiliates/*   Das BACKOFFICE. Der Betreiber muss waehrend einer
--                            Sperre weiterarbeiten koennen — sonst kann er sie
--                            nicht einmal begruenden.

alter table public.plattform_schalter
    add column if not exists partner_portal_gesperrt_seit timestamptz,
    add column if not exists partner_portal_hinweis text;

comment on column public.plattform_schalter.partner_portal_gesperrt_seit is
    'Stichtag der Sperre des Partner-Dashboards. NULL = offen. Durchgesetzt in '
    'core.security.require_approved_affiliate, nicht hier.';

comment on column public.plattform_schalter.partner_portal_hinweis is
    'Freier Text fuer den Partner. NULL = die Oberflaeche zeigt ihren '
    'uebersetzten Standardtext (Wurzel 4: keine erfundene Begruendung).';
