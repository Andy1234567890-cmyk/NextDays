-- Firmenname des Eigentümers im Kopf-Snapshot der Abrechnung.
--
-- Anlass (Betrieb, 08.09.2026): „wenn eine Firmenadresse hinterlegt ist,
-- warum wird sie nicht angezeigt". `owners.company` ist gefüllt
-- (z. B. „Intentia ApS"), der Beleg zeigte aber nur `owners.name`, also die
-- Privatperson. Adresse, Moms-Nr. und E-Mail waren die der Firma — nur der
-- Name nicht. Auf einem Dokument mit Moms-Nummer ist der Leistungsempfänger
-- die Gesellschaft, nicht die Person.
--
-- Beim AUSSTELLER macht der Code das längst richtig (`legal_name` mit Rückfall
-- auf den Betriebsnamen, service.py:1400); beim Eigentümer fehlte das
-- Gegenstück.
--
-- Eigene Spalte, weil der Kopf ein SNAPSHOT ist: er wird beim Erzeugen aus den
-- Stammdaten gefüllt und danach nie wieder nachgezogen (`**header.model_dump()`
-- schreibt jedes Kopf-Feld als Spalte). Ein später umbenanntes oder verkauftes
-- Unternehmen darf einen bestehenden Beleg nicht rückwirkend umschreiben.
-- Bestandsbelege behalten NULL und zeigen weiterhin nur den Namen — richtig,
-- denn genau das stand damals darauf.
alter table public.owner_statements
    add column if not exists owner_company text;

comment on column public.owner_statements.owner_company is
    'Firmenname des Eigentuemers zum Zeitpunkt der Abrechnung (Snapshot aus owners.company). NULL = Privatperson oder Beleg vor 0610.';
