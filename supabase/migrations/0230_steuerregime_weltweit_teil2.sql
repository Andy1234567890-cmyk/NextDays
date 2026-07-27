-- Steuerregime weltweit, Teil 2: Asien-Pazifik und Afrika.
--
-- Ergänzt `tax_country_rules` (0229) um die Märkte, die für einen weltweiten
-- Launch fehlten. Jede Zeile ist einzeln belegt; wo eine Quelle fehlte, steht
-- NULL statt eines plausiblen Ersatzwerts (Wurzel 4) — ein erfundener
-- Einbehaltssatz würde echtes Geld vom Gastgeber wegnehmen.
--
-- Zur DPI-Frage: Die OECD-Unterzeichnerliste (dpi-mcaa-signatories.pdf, Stand
-- 01.04.2026, 35 Unterzeichner) enthält aus Asien-Pazifik NUR Neuseeland und
-- aus Afrika KEIN Land. `oecd_dpi` ist für alle Zeilen hier daher ausgeschlossen
-- — das ist geprüft, nicht angenommen.

begin;

-- Korea trennt zwei Nummern, die man nicht in ein Regime pressen darf: Die
-- Personen-ID (주민등록번호) darf nach PIPA Art. 24-2 ohne gesetzliche
-- Ermächtigung nicht verarbeitet werden, die Gewerbe-ID (사업자등록번호) sehr
-- wohl. Ein Regime `id_collection_prohibited` hätte auch die zulässige
-- Erhebung bei gewerblichen Gastgebern blockiert.
alter table public.tax_country_rules
  add column if not exists personal_id_collection_prohibited boolean
    not null default false;

comment on column public.tax_country_rules.personal_id_collection_prohibited is
  'Die Personen-Steuer-ID darf nicht erhoben werden, eine Gewerbe-ID schon. '
  'Beispiel Korea: PIPA Art. 24-2 verbietet die RRN, nicht die BRN.';

insert into public.tax_country_rules (
  country, regime, reporting_authority, required_ids,
  birthplace_substitutes_id,
  withholding_bps_with_id, withholding_bps_without_id,
  threshold_amount_minor, threshold_currency, threshold_transactions,
  personal_id_collection_prohibited,
  valid_from, legal_basis, notes
) values

-- === Afrika ================================================================

-- Kenia: der einzige afrikanische Markt mit echtem Plattform-Einbehalt.
-- Airbnb setzt ihn seit 01.01.2026 produktiv um (Hilfeartikel 4076): mit
-- hinterlegter KRA-PIN 5 %, ohne PIN 20 %. Bemessung ist die BRUTTO-Auszahlung.
-- Keine Freigrenze belegt — der Einbehalt greift ab dem ersten Schilling.
('KE', 'national', 'Kenya Revenue Authority',
 array['tin']::public.tax_id_kind[], false,
 500, 2000,
 null, null, null, false,
 '2024-12-27',
 'Income Tax Act Cap. 470 s.35 + Third Schedule (Tax Laws (Amendment) Act 2024); Quellenregel Finance Act 2025',
 'KRA PIN, Format ^[AP][0-9]{9}[A-Z]$. Gilt für JEDES Inserat in Kenia, '
 'unabhängig von der Ansässigkeit des Gastgebers. Plattform-Praxis ab '
 '2026-01-01. Die genaue Third-Schedule-Ziffer ist unbelegt, die Saetze 5/20 % '
 'sind dreifach belegt (Airbnb 4076 + zwei Kanzleianalysen).'),

-- Südafrika: KEIN Plattform-Meldegesetz. Die s26-Public-Notice 3631 zaehlt die
-- meldepflichtigen Stellen abschliessend auf — Buchungsplattformen fehlen dort,
-- und zwar bewusst: fuer Krypto hat ZA sehr wohl ein Meldegesetz erlassen.
-- Section 35A (Einbehalt bei Immobilienverkauf durch Nicht-Ansaessige) ist der
-- klassische Fehlgriff und gilt hier NICHT — Verkauf, nicht Vermietung.
('ZA', 'registration', 'South African Revenue Service',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2014-06-01',
 'VAT Act 89/1991 s.23(1A) + Electronic Services Regulations',
 'Income Tax Reference Number, 10-stellig mit Modulus-10-Pruefziffer '
 '(SARS PAYE BRS V20.0.0 Appendix B). Steuer-ID optional — keine gesetzliche '
 'Pflicht verlangt sie. Kein Einbehalt auf Vermieter-Auszahlungen.'),

-- Nigeria: VAT-Deemed-Supplier (7,5 % auf den vollen Buchungswert, nicht auf
-- die Provision) — Airbnb setzt das live um. Der nigerianische Miet-Einbehalt
-- von 10 % trifft NUR inlaendische Zahler, nicht eine auslaendische Plattform.
-- Die Verdopplung ohne Steuer-ID gilt ausdruecklich nur fuer non-passive
-- income; Miete ist passiv, also KEIN 20-%-Satz.
('NG', 'registration', 'Nigeria Revenue Service',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2026-01-01',
 'Nigeria Tax Administration Act 2025 ss.4/6/7/8; Nigeria Tax Act 2025 s.17 (SEP)',
 'Behoerde heisst ab 2026-01-01 NRS, nicht mehr FIRS. Tax ID 13-stellig; '
 'ab 2026 NIN (Person) bzw. CAC RC/BN (Unternehmen). Der Gazette-Volltext '
 'des NTAA enthaelt keine Plattform-Meldepflicht (s.29 nur Banken/Versicherer).'),

-- Ghana, Tansania, Uganda, Ruanda: alle vier nur VAT-/DST-Registrierung der
-- Plattform fuer EIGENE Umsaetze. Kein Einbehalt auf Vermieter-Auszahlungen.
-- Ghana s.115(1) Act 896 bindet ausdruecklich nur eine "resident person".
('GH', 'registration', 'Ghana Revenue Authority',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2022-09-12',
 'VAT (Amendment) Act 2022 (Act 1082); Income Tax Act 2015 (Act 896) s.115',
 'Ghana Card PIN GHA-XXXXXXXXX-X fuer Privatpersonen (seit 2021-04-01), '
 'TIN fuer juristische Personen. Schwelle fuer Nicht-Ansaessige aufgehoben.'),

-- Tansania: §§83B/83C zwingen auch Nicht-Ansaessige zum Einbehalt — aber nur
-- bei Content-Creators und Digital Assets, NICHT bei Beherbergung. Der
-- wahrscheinlichste Kandidat, falls sich das kuenftig ausweitet.
('TZ', 'registration', 'Tanzania Revenue Authority',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2022-07-01',
 'Income Tax Act Cap. 332 s.90A + s.68A (Finance Act 2022)',
 '2 % Digital Service Tax auf die PLATTFORM, kein Vermieter-Einbehalt. '
 'VAT-Registrierung ohne Schwelle. TIN-Format unbelegt.'),

('UG', 'registration', 'Uganda Revenue Authority',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2023-07-01',
 'Income Tax Act Cap. 340 s.86A (Income Tax (Amendment) Act 2023)',
 '5 % Digital Services Tax auf die PLATTFORM. Einbehaltspflicht nur fuer '
 'per Gazette designierte Agenten — auslaendische Plattformen sind das nicht.'),

('RW', 'registration', 'Rwanda Revenue Authority',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2023-09-05',
 'Law N° 049/2023; Ministerial Order N° 004/26/10/TC (Gazette 2026-04-29)',
 'Intermediation platforms ausdruecklich erfasst; Registrierung oder lokaler '
 'Vertreter binnen drei Monaten ab Gazettierung. Vermieter veranlagt selbst.'),

-- === Asien-Pazifik =========================================================

-- Vietnam: der teuerste Fall weltweit. Unterkunft faellt unter
-- "Dienstleistungen" → 5 % VAT + 2 % PIT = 700 bps beim inlaendischen
-- Vermieter, 5 % + 5 % beim auslaendischen. KEINE Schwelle. Ausloeser ist
-- ausdruecklich die Zahlungsfunktion der Plattform — die haben wir.
-- Doppelt belegt (EY und BDO unabhaengig).
('VN', 'national', 'Tax Department (Cục Thuế)',
 array['tin']::public.tax_id_kind[], false,
 700, 700,
 null, null, null, false,
 '2025-07-01',
 'Decree 117/2025/ND-CP (auf Basis Decree 91/2022, Circular 40/2021)',
 'Einbehalt im Moment der bestaetigten Zahlung, monatliche Deklaration, '
 'jaehrliche Einbehaltsbescheinigung an den Vermieter. Bei nicht bestimmbarem '
 'Transaktionstyp gilt der HOECHSTE Satz. Vor Scharfschaltung anwaltlich '
 'pruefen lassen — 7 % bewegen echtes Geld.'),

-- Philippinen: RR 16-2023 nennt Unterkunft woertlich ("a platform for booking
-- of resort, hotel, motel, inn, house, condominium unit, bed space, room for
-- rent"). Das "located in the Philippines" bezieht sich sprachlich auf die
-- UNTERKUNFT, nicht auf die Plattform. 1 % auf 50 % der Bruttoueberweisung
-- = effektiv 50 bps. Ob auslaendische Betreiber erfasst sind: unbelegt.
('PH', 'national', 'Bureau of Internal Revenue',
 array['tin']::public.tax_id_kind[], false,
 50, null,
 50000000, 'PHP', null, false,
 '2024-01-11',
 'Revenue Regulations No. 16-2023 (ergaenzt RR 2-98); RMC 8-2024, 55-2024, 79-2024',
 'Schwelle PHP 500.000 kumuliert ueber ALLE Plattformen. Durchsetzung ab '
 '2024-07-15. Erhoehter Satz ohne TIN nicht auffindbar — daher NULL.'),

-- China: Dekret 810 erfasst auslaendische Plattformen ausdruecklich,
-- quartalsweise Meldung, Sanktionen bis 500.000 RMB. Entlastend: die Daten
-- AUSLAENDISCHER Anbieter muessen nicht gemeldet werden — betroffen sind nur
-- in China ansaessige Vermieter. Der Einbehaltssatz ist ausdruecklich
-- unbelegt und bleibt deshalb NULL.
('CN', 'national', 'State Taxation Administration (国家税务总局)',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2025-06-20',
 'State Council Decree No. 810; STA Announcement [2025] No. 15 und No. 16',
 'Ohne inlaendische Einheit ist ein inlaendischer Agent (境内代理人) ZWINGEND '
 '— das ist eine Rechtstraeger-, keine Softwarefrage. Quartalsmeldung binnen '
 'eines Monats nach Quartalsende. Befreit: Quartalsumsatz je Privatkaeufer '
 'bis 5.000 RMB.'),

-- Pakistan: Finance Act 2025. §6A zielt auf "locally operated online
-- platforms" — ob Unterkunftsvermietung erfasst ist, ist unbelegt. Der Satz
-- ist belegt, die Anwendbarkeit auf uns nicht.
('PK', 'national', 'Federal Board of Revenue',
 array['tin']::public.tax_id_kind[], false,
 100, null,
 null, null, null, false,
 '2025-07-01',
 'Income Tax Ordinance 2001 s.6A, s.165C (Finance Act 2025)',
 'NTN bzw. CNIC (13-stellig). 100 bps digital, 200 bps bei Nachnahme. '
 'Anwendbarkeit auf Beherbergung unbelegt — vor Scharfschaltung pruefen.'),

-- Indonesien: gilt nur fuer FOERMLICH BENANNTE Plattformen (bislang vier
-- inlaendische). Ob Unterkunftsvermietung ueberhaupt erfasst ist oder unter
-- die Ausnahme "Immobilientransaktionen" faellt, ist unbelegt. Der Satz ohne
-- NPWP war nicht auffindbar. Beide Felder daher NULL.
('ID', 'national', 'Direktorat Jenderal Pajak',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 500000000000, 'IDR', null, false,
 '2025-07-14',
 'PMK 37/2025, PPh Pasal 22',
 'NPWP ODER NIK zulaessig. Pflicht entsteht erst mit foermlicher Benennung — '
 'wir sind nicht benannt. Schwelle Rp 500 Mio. nur gegen gestempelte '
 'Eigenerklaerung. Satz 50 bps erst nach Klaerung setzen.'),

-- Thailand: Zwei Dinge, die oft verwechselt werden. Das Royal Decree von 2022
-- ist Aufsichtsrecht der ETDA, KEIN Steuerrecht. Nur die
-- Revenue-Department-Notification vom 27.12.2023 begruendet die Meldepflicht —
-- und laut Tilleke & Gibbins nur fuer IN THAILAND REGISTRIERTE Plattformen.
('TH', 'registration', 'The Revenue Department (กรมสรรพากร)',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2021-09-01',
 'Revenue Code (e-Service VAT); Notification vom 2023-12-27 (special account)',
 'Kein Einbehalt. Meldepflicht erst ab 1 Mrd. THB Plattformumsatz UND nur '
 'fuer in Thailand registrierte Plattformen (Sekundaerquelle) — fuer uns '
 'daher registration, nicht national.'),

-- Malaysia: die TIN-Erhebung folgt aus der e-Invoice-Pflicht, nicht aus einem
-- Meldegesetz. Deemed-Supplier-Regel betrifft die Service Tax der Plattform.
('MY', 'registration', 'Lembaga Hasil Dalam Negeri / Royal Malaysian Customs',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, false,
 '2020-01-01',
 'Service Tax Act 2018 (Service Tax on Digital Services)',
 'Generische Fremd-TIN EI00000000030, wenn die TIN fehlt. e-Invoice-Pflicht '
 'fuer auslaendische Plattformen ohne Betriebsstaette unbelegt.'),

-- Korea: NICHT id_collection_prohibited als Regime — siehe Spaltenkommentar.
-- Keine proaktive Meldepflicht; der NTS kann Transaktionsaufzeichnungen nur
-- ANFORDERN (5 Jahre Aufbewahrung). Ein Gesetzentwurf zur Quartalsmeldung fuer
-- Unterkunftsplattformen liegt vor, ist aber nicht verabschiedet.
('KR', 'registration', 'National Tax Service (국세청)',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 null, null, null, true,
 '2024-01-01',
 '부가가치세법 제53조의2 (VAT Act Art. 53-2)',
 'Personen-ID (주민등록번호) nach PIPA Art. 24-2 gesperrt, Gewerbe-ID '
 '(사업자등록번호, XXX-XX-XXXXX) zulaessig. Vereinfachte Registrierung binnen '
 '20 Tagen ab Geschaeftsaufnahme.'),

('TW', 'registration', 'Ministry of Finance (財政部)',
 array['tin']::public.tax_id_kind[], false,
 null, null,
 60000000, 'TWD', null, false,
 '2017-05-01',
 'Value-added and Non-value-added Business Tax Act (Aenderung 2016-12)',
 'Unified Business Number, 8-stellig. Schwelle seit 2025-04-07 von '
 'NT$ 480.000 auf NT$ 600.000 angehoben. Keine Meldepflicht ueber Vermieter.'),

-- Hongkong, Macau, Mongolei: keine plattformspezifische Pflicht.
-- Mongolei bewusst `none` und NICHT `registration`: Reverse Charge auf den
-- mongolischen Empfaenger (VAT Law Art. 11.1) macht die Registrierung gerade
-- entbehrlich. Die 20 % Quellensteuer zeigen in die Gegenrichtung — sie
-- treffen Zahlungen AN Nicht-Ansaessige, also unsere Provision, nicht die
-- Auszahlung an einen mongolischen Vermieter.
('HK', 'none', 'Inland Revenue Department',
 array[]::public.tax_id_kind[], false,
 null, null, null, null, null, false,
 '2024-01-01',
 'Territoriale Besteuerung; IRD implementiert nur CARF und CRS 2.0',
 'Kein MRDP/DPI. Property Tax traegt der Eigentuemer selbst.'),

('MO', 'none', 'Direcção dos Serviços de Finanças',
 array[]::public.tax_id_kind[], false,
 null, null, null, null, null, false,
 '2024-01-01',
 'Urban Property Tax; Complementary Tax',
 'Keine Plattform-Meldepflicht in der Steuerreform 2025 ersichtlich.'),

('MN', 'none', 'General Department of Taxation',
 array[]::public.tax_id_kind[], false,
 null, null, null, null, null, false,
 '2020-01-01',
 'VAT Law Art. 11.1 (Reverse Charge); CIT Law Art. 4.1.7.a',
 'Reverse Charge auf den Empfaenger — daher KEINE Registrierungspflicht. '
 'Die 20 % WHT treffen Zahlungen an Nicht-Ansaessige, nicht den Vermieter.'),

('FJ', 'none', 'Fiji Revenue & Customs Service',
 array[]::public.tax_id_kind[], false,
 null, null, null, null, null, false,
 '2024-01-01',
 'Income Tax Act 2015',
 'Keine Plattform-Meldepflicht. VAT-Registrierung des Vermieters ab '
 'FJD 100.000 — dessen Pflicht, nicht unsere.')

on conflict (country) do update set
  regime = excluded.regime,
  reporting_authority = excluded.reporting_authority,
  required_ids = excluded.required_ids,
  withholding_bps_with_id = excluded.withholding_bps_with_id,
  withholding_bps_without_id = excluded.withholding_bps_without_id,
  threshold_amount_minor = excluded.threshold_amount_minor,
  threshold_currency = excluded.threshold_currency,
  threshold_transactions = excluded.threshold_transactions,
  personal_id_collection_prohibited = excluded.personal_id_collection_prohibited,
  valid_from = excluded.valid_from,
  legal_basis = excluded.legal_basis,
  notes = excluded.notes,
  updated_at = now();

commit;
