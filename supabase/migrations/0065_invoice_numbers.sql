-- 0065_invoice_numbers.sql — EU-/ViDA-konforme Rechnungen: fortlaufende Nummern,
-- Steuerprofil, EN-16931-Felder und Stornorechnungen.
--
-- Rechtlicher Rahmen (recherchiert, nicht angenommen):
--   * Fortlaufende Nummer: Art. 226 Nr. 2 RL 2006/112/EG — EU-weit harmonisiert.
--     Erlaubt sind EINE ODER MEHRERE Serien ("based on one or more series"),
--     daher serien-fähiger Zähler (z. B. je Land/Belegart). Lücken sind zulässig,
--     wenn erklärbar (z. B. Storno); wir vergeben dennoch lückenlos pro Serie.
--   * Rechnungsregeln-Jurisdiktion: Art. 219a — bei grenzüberschreitenden
--     Leistungen gilt das Recht des Leistungsorts → supply_country je Rechnung.
--   * Reverse Charge: Art. 196 — B2B-Leistung an im EU-Ausland USt-registrierten
--     Empfänger → ohne USt, Pflichthinweis; EN-16931-Steuerkategorie 'AE'.
--   * §19 UStG-Äquivalent (Kleinunternehmer/Steuerbefreiung): EN-Kategorie 'E'.
--   * E-Rechnung EN 16931 (ViDA, ab 1.7.2030 für innergem. B2B Pflicht): die
--     Steueraufschlüsselung (Netto/USt/Brutto/Satz/Kategorie) wird strukturiert
--     gespeichert, damit später XRechnung/ZUGFeRD generierbar ist.
--   * Stornorechnung: eigenes Dokument, eigene Nummer, negierte Beträge, Verweis
--     auf das Original; Original bleibt unverändert (GoBD).

-- ── Drei mögliche Länder, die für die Besteuerung relevant sind ─────────────
-- Agentur (Aussteller), Owner (Empfänger) und Objekt (Leistungsort) können in
-- DREI verschiedenen EU-Ländern liegen. Daraus leitet sich ab: welches Rechnungs-
-- recht gilt (Art. 219a) und ob Reverse Charge greift (Art. 196, Agentur-Land ≠
-- Owner-Land bei B2B). Quellen der drei Länder:
--   * Agentur-Land:  public.tenants.country        (bereits vorhanden, /konto)
--   * Owner-Land:    public.owners.country          (bereits vorhanden, Stammdaten)
--   * Objekt-Land:   public.properties.country      (NEU, Leistungsort)
-- Property hatte bisher nur eine Freitext-Adresse → strukturiertes Land ergänzen.
alter table public.properties
    add column if not exists country text;   -- ISO-3166-1 alpha-2 (Leistungsort)

-- ── Steuerprofil je Mandant (Aussteller = Property Manager/Agentur) ──────────
-- KEINE neuen Spalten auf tenants. Das Steuerprofil existiert bereits in
-- public.tenant_billing_profile (0023): tax_number, vat_id, is_kleinunternehmer
-- (§19), default_tax_rate, e_invoice_format. Das Owner-Statement-Modul liest von
-- dort. Lediglich das Aussteller-LAND fehlt dort (für Art. 219a / Reverse-Charge)
-- — es kommt aus public.tenants.country (0002), das bereits vorhanden ist.

-- ── Rechnungsnummern ────────────────────────────────────────────────────────
-- KEIN eigener Zähler. Die fortlaufende, lückenlose Vergabe (GoBD / Art. 226)
-- übernimmt die VORHANDENE Buchhaltungs-Funktion public.next_document_number()
-- aus 0025_buchhaltung_nummernkreise.sql (Row-Lock, je tenant + doc_type). Owner-
-- Statements nutzen sie mit doc_type 'owner_statement' bzw. 'owner_statement_storno',
-- damit beide Module denselben, konsistenten Nummernkreis-Mechanismus teilen.

-- ── owner_statements: Beleg-Art, Storno-Verweise, EN-16931-Steuerfelder ─────
alter table public.owner_statements
    -- Beleg-Art: normale Rechnung oder Stornorechnung.
    add column if not exists kind text not null default 'invoice'
        check (kind in ('invoice', 'cancellation')),
    -- Storno-Verknüpfung (beidseitig): welches Original storniert diese Storno-
    -- rechnung / durch welche Stornorechnung wurde dieses Original aufgehoben.
    add column if not exists cancels_statement_id     uuid references public.owner_statements (id),
    add column if not exists cancelled_by_statement_id uuid references public.owner_statements (id),
    -- Beleg-Metadaten (EN 16931 BT-2 / BT-9).
    add column if not exists invoice_date date,
    add column if not exists due_date     date,
    -- Jurisdiktion der anzuwendenden Rechnungsregeln (Art. 219a), ISO-3166-1.
    add column if not exists supply_country text,
    -- Empfänger-USt-IdNr. (EN BT-48) — Voraussetzung für Reverse-Charge.
    add column if not exists buyer_vat_id text,
    -- Steuerkategorie (EN BT-118): 'S' Standard, 'AE' Reverse Charge,
    -- 'E' steuerbefreit (z. B. §19/Kleinunternehmer), 'Z' Nullsatz.
    add column if not exists tax_category text not null default 'S'
        check (tax_category in ('S', 'AE', 'E', 'Z')),
    add column if not exists tax_rate numeric(5, 2) not null default 0
        check (tax_rate >= 0 and tax_rate <= 100),
    -- Steueraufschlüsselung (EN BG-23) — eingefroren bei Finalisierung.
    add column if not exists net_amount   numeric(14, 2) not null default 0,
    add column if not exists tax_amount   numeric(14, 2) not null default 0,
    add column if not exists gross_amount numeric(14, 2) not null default 0,
    -- Steuerbefreiungsgrund-Text (EN BT-120), z. B. §19-Hinweis / Reverse-Charge.
    add column if not exists tax_exemption_reason text;

-- 'cancelled' als dritter Status (storniertes Original). Der vorhandene CHECK
-- (status in ('draft','finalized')) wird ersetzt.
alter table public.owner_statements drop constraint if exists owner_statements_status_check;
alter table public.owner_statements
    add constraint owner_statements_status_check
    check (status in ('draft', 'finalized', 'cancelled'));

create index if not exists owner_statements_cancels_idx
    on public.owner_statements (cancels_statement_id);
