# Taskilo-Finanzwerkzeug — Bestand und Abgleich, Stand 11.09.2026

Drei unabhängige Erhebungen über das alte Projekt
`/Users/andystaudinger/taskilo-platform`, jede mit Fundort je Aussage.
Stichproben (Zeilenzahlen der acht Editoren, `@tasko/ui`-Alias, ein Aufruf
ins Leere, die `ComingSoon`-Routen) wurden am 11.09.2026 unabhängig
nachgemessen und stimmen.

| Bericht | Inhalt | Umfang |
|---|---|---|
| [TASKILO-FRONTEND-INVENTAR.md](TASKILO-FRONTEND-INVENTAR.md) | jede Frontend-Datei des Finanzwerkzeugs mit Pfad, Zeilen, Zweck, Exporten, Nutzung | 325 Dateien, 19 Tabellen |
| [TASKILO-BIBLIOTHEKEN-BACKEND.md](TASKILO-BIBLIOTHEKEN-BACKEND.md) | Workspace-Pakete, genutzte Abhängigkeiten, fehlende im neuen Projekt, Backend-Slices, Endpunkte, Datenmodell | 8 Pakete, 61 + 72 Endpunkte |
| [TASKILO-ABGLEICH-NEXTDAYS.md](TASKILO-ABGLEICH-NEXTDAYS.md) | Datei für Datei: was übernommen, was verändert, was fehlt; Aufrufe ins Leere | 63 neue gegen 325 alte Dateien |

Die Vorgänger-Doku vom 18.06.2026 ([TASKILO-INVENTAR.md](../TASKILO-INVENTAR.md),
[INTEGRATION-TASKILO-BUCHHALTUNG.md](../INTEGRATION-TASKILO-BUCHHALTUNG.md),
[ADR-0009](../decisions/0009-taskilo-integration-architektur.md)) beschreibt
den PLAN. Dieses Dokument beschreibt den STAND.

## Die Zahlen

| | alt (`taskilo-platform`) | neu (`NextDays/web`) |
|---|---:|---:|
| Frontend-Dateien des Finanzwerkzeugs | **325** (180 892 Zeilen) | **63** |
| davon Komponenten | 169 (77 594 Z.) | — |
| Seiten/Routen | 65 (69 592 Z.) | 2 portiert + 13 `ComingSoon` |
| Services | 37 (18 247 Z.) | — |
| Tests | **0** | — |
| Backend-Finanz-Slices | 6 angefragt (30 Dateien, 61 Endpunkte) + 11 angrenzende (72 Endpunkte) | 1 (`buchhaltung`, 38 Routen) |

**Acht Beleg-Editoren sind Kopien desselben Editors** — 40 371 Zeilen, 22 % des
Werkzeugs (nachgemessen: 5 691 · 5 525 · 5 380 · 5 268 · 4 785 · 4 590 · 4 580 ·
4 552). Wer sie portiert, portiert EINEN Editor mit acht Belegarten, nicht acht
Editoren.

## Was übernommen ist

| Zustand | Dateien | Beispiele |
|---|---:|---|
| byte-identisch | 5 | `PDFTemplates`, `FooterText`, `TaxRulesInfo`, `numberSequenceService` |
| angepasst | 40 | i18n (`useTranslations('finance')`), `formatCurrency(x, currency)` statt EUR-Hardcode, Taskilo-Türkis → `text-accent`, `'19'`-Steuersatz-Fallbacks entfernt, Testdaten aus `PageFooter` entfernt |
| stark umgebaut | 14 | die 5 380-Zeilen-Seite `invoices/create/page.tsx` → `create-invoice/` (container, items-card, use-invoice-actions, use-invoice-loaders …) |
| NextDays-eigen | 4 | `components/buchhaltung/*` |

Übernommen sind damit: **Rechnungsliste** und **Rechnung erstellen** — samt
Live-Vorschau, Steuerregeln, TipTap-Kopf/Fuß, GoBD-Festschreibung, E-Rechnung
(ZUGFeRD/XRechnung, im Browser erzeugt). Sonst nichts.

## Was fehlt

**123 Komponenten/Services (58 276 Zeilen) und 61 von 63 Seiten (63 756
Zeilen).** Vollständige Liste mit Zeilenzahlen im Abgleich. Nach Bereich:

| Bereich | alte Dateien | Zeilen | neue Route |
|---|---:|---:|---|
| Angebote, Auftragsbestätigung, Lieferschein, Gutschrift/Storno, wiederkehrende Rechnung | 5 Editoren + Listen | ~25 000 | `buchhaltung/angebote` ist eine **Neuentwicklung** (152 Z.), kein Port |
| Kunden-Detail (`customer-detail/`) + Kontakte-Seiten | 11 + 4 | 4 501 + 5 755 | — |
| Ausgaben (Beleg-Upload, OCR, HEIC, wiederkehrend) | `ExpenseComponent` u. a. + 6 Seiten | ~6 600 | `ausgaben` = `ComingSoon` |
| Kassenbuch | `CashbookComponent` u. a. | ~2 000 | `kassenbuch` = `ComingSoon` |
| Mahnwesen (3 Stufen) | `ReminderComponent`, `ReminderDialog`, `ReminderSettings` + 2 Seiten | ~4 200 | `mahnwesen` = `ComingSoon` |
| Steuer (UStVA-Assistent, ELSTER, EÜR, Vorsteuerschätzung) | `TaxEstimationWizard`, `TaxWizard`, `TaxComponent` + 9 Seiten | ~8 000 | `steuer` = `ComingSoon` |
| Berichte (BWA, SuSa, GuV) | `ReportComponent` + Seite | ~1 000 | `berichte` = `ComingSoon` |
| Zahlungen / Bankabgleich (finAPI) | `BankTransferModal`, `LinkTransactionModal`, `AllocateBookingModal` … | ~3 000 | `bank`, `zahlungen` = `ComingSoon` |
| Kontenplan, Nummernkreise, Zahlungskonten (`accounting/`) | 10 | 2 236 | `kontenplan` = `ComingSoon` |
| E-Rechnung (Compliance, Versand, Protokolle) | 8 Komponenten | ~4 100 | `e-rechnung` = `ComingSoon` |
| **DATEV komplett** | 10 Komponenten, 3 Datendateien, 7 Libs, 7 Services | **17 428** | `datev` = `ComingSoon` |
| Projekte / Zeiterfassung | 5 | ~4 000 | — |

**DATEV ist alt nur zur Hälfte echt:** alle 14 Backend-Endpunkte sind
Platzhalter (`sandbox.datev.invalid`, Mock-Tokens, `/validate` antwortet immer
`true`). Echte DATEV-Logik gibt es ausschließlich als Buchungsstapel-CSV-Export
(SKR03/SKR04, EXTF) — im KI-Backend, nicht im API-Backend. Wer „DATEV
portieren" plant, portiert den CSV-Export und baut die Anbindung neu.

## Aufrufe ins Leere — zur Bauzeit grün, zur Laufzeit 404

> **Stand der Behebung (11.09.2026, Modul Kunden):** die ersten drei Zeilen der
> Tabelle sind geschlossen — `GET /customers` filtert jetzt serverseitig
> (`search`, `name`, `email`, `isSupplier`, `limit ≤ 200`), `GET /customers/{id}`
> existiert (über `load_scoped`, Wurzel 3), `/finance/customers` wird im Client
> abgebildet, und die zwei `{items}`-Aufrufer lesen das Array. Der
> Semantik-Verlust darunter ist damit ebenfalls behoben. 14 Tests in
> `test_customers_search.py`.
>
> **Modul Nummernkreise (11.09.2026):** die vier `numberSequenceService`-Zeilen
> sind geschlossen, aber nicht durch neue Routen — der `POST …/next` bleibt zu
> Recht weg (GoBD). Stattdessen vergibt der **Server** die Nummer beim Anlegen
> (`create_customer` zieht atomar, wenn keine Nummer oder genau die Vorschau
> mitkommt; eine von Hand geänderte bleibt und muss frei sein → 409;
> Unique-Index 0631 als Backstop). `GET /number-sequences/{c}` liefert die
> Bestands-Form (`type: 'Kunde'` …) für alle acht Typen, `GET
> /customers/next-number/{c}` existiert. Der Frontend-Dienst liest nur noch;
> alle vier Zeitstempel-Ersatzwerte (`KD-091119`, `AG-1234`, `KD-001`) sind
> entfernt. Nebenbei behoben: `create_quote` schrieb NIE eine `quote_number`.
> 12 Tests in `test_kunden_anlegen.py`.
>
> **Dabei gefunden und behoben — schwerer als jedes Loch:** `CustomerCreate`
> kannte keine camelCase-Aliase und verlangte `address` als Objekt. Das Modal
> schickt camelCase und `address` als Text → **422 bei jedem „Kunde anlegen"**;
> ohne den Text überlebten nur `name`, `email`, `phone`. Jetzt Aliase plus
> Zusammenführung der flachen Anschrift (`street`, `postalCode`, `city`,
> `country`) in `address`.
>
> Offen: Mail (2 Zeilen), `users/{id}`, `expenses`, `reminders`, `finapi`,
> `einvoices/{id}/xml`.

`tsc` und ESLint sehen davon nichts: alle 49 Import-Ziele existieren (per `ls`
belegt). Die Löcher liegen in den HTTP-Pfaden. `web/lib/api-client.ts`
schreibt neun Präfixe auf `/api/v1/buchhaltung/…` um; alles andere geht 1:1 an
FastAPI und dort ins 404.

| Pfad | Aufrufer | Warum leer |
|---|---|---|
| `GET /api/v1/finance/customers?search=` | `EmailSendModal` :563 :573 :719 :765 | der Client ersetzt `/api/v1/customers`, nicht `/api/v1/finance/customers` — kein Teilstring-Treffer |
| `GET /api/v1/customers/{id}` | `use-invoice-loaders` :235 | neu gibt es nur PATCH/DELETE → 405 |
| `GET /api/v1/users/{id}` | `useCompanySettings` :98 | neu nur `/preferences` |
| `POST /api/v1/send-invoice-email` | `EmailDialog` :60 | keine Route |
| `POST /api/v1/email/send-document` | `EmailSendModal` :648 | keine Route |
| `POST /api/v1/expenses` | `ImportXRechnungDialog` :156 | kein `expenses`-Slice |
| `GET/PATCH /api/v1/reminders/{id}` | `SendDocumentModal` (4 Stellen) | kein `reminders`-Slice |
| `POST …/number-sequences/{c}/next`, `PATCH …/{seq}`, `POST …/sync`, `POST …/create-defaults` | `numberSequenceService` :33 :106 :114 :156 | `router.py:330`: *„bewusst KEINEN öffentlichen POST /number-sequences/next mehr"* — neu nur zwei GETs |
| `GET /api/finapi/accounts-enhanced\|transactions` | `SelectBankingTransactionModal` :206 :225 | keine Next-Route `app/api/finapi` |
| `/api/einvoices/{id}/xml` (als Link) | `SendDocumentModal` :721, `use-invoice-actions` :797 | keine Route |

Dazu ein **Semantik-Verlust ohne 404**: `GET /customers?name=…&limit=1`
(`LivePreviewModal` :186, `InvoiceListView` :306) — `list_customers` nimmt
keine Query-Parameter und liefert immer alle Kunden. Der erste wird dann als
Treffer behandelt.

Zweite Ebene, in importierten Services: 23 weitere Stellen (`booking-accounts`
PUT/DELETE, `quote-settings`, `transaction-links/{id}`, `gobd/settings`, alle
sieben `inventory/*`, `invoices/{c}/{id}/status`, `notifications/whatsapp` 6×,
`text-templates` PUT/DELETE).

## Bibliotheken

`@tasko/ui` ist belegt der Ursprung des Alias im neuen Projekt:
`web/tsconfig.json` → `web/vendor/tasko-ui/` (48 Komponenten, `button`/`dialog`/
`table`/`form` byte-identisch mit dem alten Paket). Daneben existiert das
reguläre `@nextdays/ui` — zwei Design-System-Kopien in einer App.

Vom Finanzwerkzeug real genutzt, **im neuen `web/package.json` fehlend**:

| Paket | alt | wofür |
|---|---|---|
| `react-pdf` + `pdfjs-dist` | 10.2.0 / 5.4.296 | PDF-Vorschau |
| `jspdf` + `html2canvas` | 4.2.1 / 1.4.1 | eigenständiges PDF-Template |
| `heic2any` | 0.0.4 | Beleg-Upload vom iPhone |
| `validate-steuernummer` | 1.6.0 | Steuernummer-Prüfung |
| `@tiptap/extension-underline` | 3.4.2 | Kopf-/Fußzeilen-Editor |
| `@tasko/shared` | Workspace | API-Client, Auth-Kontext — neu durch `lib/api-client.ts` + `contexts/NewAuthContext.tsx` ersetzt |

Versionssprünge bei Vorhandenem: `date-fns` 3→4, `recharts` 2→3,
`react-day-picker` 8→9, `@tiptap/*` 3.4→3.27. **Nicht** genutzt (auch wenn im
alten `package.json`): Stripe, Firebase-/Supabase-SDK, tanstack, react-hook-form,
zod, `@react-pdf/renderer`, `finapi-client`. Keine Währungs-, keine
E-Rechnungs-Bibliothek — XRechnung/ZUGFeRD sind selbst geschrieben
(`fast-xml-parser` + `pdf-lib`).

## Altes Datenmodell — und seine Abweichungen vom eigenen Code

Eine einzige Finanz-Migration (`20260221100000_live_schema.sql`, 137 Tabellen,
**RLS-Policies `USING (true)` — nicht mandantenscharf**). Kern `invoices`
(`invoice_type` invoice|credit_note|storno|recurring, `line_items jsonb`,
`tax_rate DEFAULT 19`, `gobd_status`, `is_locked`), `e_invoices`,
`number_sequences`, `gobd_*`, `expenses`, `quotes`, `fixed_assets`,
`booking_accounts`, `payment_accounts` (`currency DEFAULT 'EUR'`).

Der alte Code passt an mehreren Stellen nicht zu seinem eigenen Schema — wer
ihn portiert, portiert diese Fehler mit:

- `einvoice/repository.py` schreibt in `einvoices`/`einvoice_settings`; das Schema kennt nur `e_invoices`/`e_invoice_settings`.
- `recurring_invoices` filtert auf `is_recurring_template`/`recurring_status` — in `invoices` nicht vorhanden.
- `finance/sync_service.py` filtert camelCase (`companyId`) auf snake_case-Tabellen.
- `reminders` und `quote_items` haben Repositories, aber kein `CREATE TABLE`.
- Das alte Frontend ruft `next-number`, `create-defaults`, `convert-to-invoice`, `/execute`, `POST /{id}/storno` — im alten Backend nicht vorhanden. Die Aufrufe ins Leere sind also **geerbt**, nicht bei der Übernahme entstanden.

Die Vorgaben `DEFAULT 19` und `DEFAULT 'EUR'` verstoßen gegen Wurzel 4.
`tax_rate` ist im neuen Fundament ohne Vorgabe angelegt — **`currency text not
null default 'EUR'` steht in `0023_buchhaltung_fundament.sql` aber weiterhin**
(nachgelesen am 11.09.2026; die erste Fassung dieses Absatzes behauptete das
Gegenteil). Zu beheben per neuer Migration: Vorgabe entfernen, Währung aus
`tenants`/der Buchung übernehmen, fehlende Währung klar fehlschlagen lassen.

## Freischaltung: nur der Vorführbetrieb (11.09.2026)

Anweisung: „das buchhaltung tool muss nur bei theresa.gruber frei geschaltet
sein bei niemandem sonst". theresa.gruber = Vorführbetrieb Nordstrand (0630).

**Vorher war es genau umgekehrt.** `buchhaltung/layout.tsx` und die
Sidebar-Gruppe hingen an `is_internal` (0505, die Fotomodell-Konten). Live
gelesen: Nordstrand `is_internal=false` → theresa bekam **404**; Nordlys (die
öffentliche Live-Vorschau, merle.ahrens) und Hotel Seeblick `is_internal=true`
→ sie sahen die Buchhaltung. Dazu hatten alle drei ein aktives, unbezahltes
Kauf-Entitlement `modul3_buchhaltung`.

Jetzt drei Ebenen, alle am selben Modul `buchhaltung` (Mechanik aus 0572):

| Ebene | Stelle | Wirkung |
|---|---|---|
| API | `auth/modul_freischaltung.py`: `MODUL_PRAEFIXE["buchhaltung"] = ("/buchhaltung",)` | 404 für jeden Betrieb ohne Modul — **außer** `companies/`, `vat-check`, `health` (Firmenstammdaten, die /konto jedes Betriebs braucht) |
| Seite | `app/(dashboard)/buchhaltung/layout.tsx` | `notFound()` ohne Modul |
| Sidebar | `app-sidebar.tsx`: Gruppe und `MODUL_PFADE["/buchhaltung"]` | ausgeblendet ohne Modul |
| Daten | 0633: `enabled_modules += 'buchhaltung'` nur bei `ist_vorfuehrbetrieb`; 0632: Kauf-Entitlements der anderen deaktiviert | Wächter: genau ein Betrieb, kein bezahltes Entitlement berührt |

Der Erweiterungen-Katalog führt das Modul nicht — niemand kann es sich selbst
buchen. 15 Tests in `auth/tests/test_modul_freischaltung.py` (der Riegel hatte
vorher keinen).

## Doku-Drift

Drei Dokumente vom 18.06.2026 widersprechen einander und dem Stand:

| Dokument | sagt | Stand |
|---|---|---|
| ADR-0009 (Status **akzeptiert**) | „ins NextDays-Muster überführt, **nicht 1:1 kopiert** … **Kein `@tasko/ui`**" | 63 Dateien 1:1, `@tasko/ui` als Vendor-Alias |
| INTEGRATION §7 | „Strategie **REVIDIERT**: 1:1 übernommen" | stimmt — aber der ADR wurde nicht nachgezogen |
| INTEGRATION §7, Schritt 2 | „`POST /number-sequences/next`" als erledigt | Backend hat ihn **bewusst entfernt** (`router.py:330`); `numberSequenceService` ruft ihn weiter |
| INTEGRATION §7, Schritt 3 | „`InvoiceListView` (816 Z.)" | 824 Z., Komplexität 42 in einer Funktion, eingefroren in `eslint-suppressions.json` |

Der ADR braucht einen Nachtrag „revidiert am … zugunsten der 1:1-Übernahme,
Begründung: der Neuaufbau lieferte dünne Attrappen ohne GoBD-Logik" — sonst
liest jeder Nächste die falsche Entscheidung als gültig.

## Was das für den Weiterbau heißt

1. **Erst die Aufrufe ins Leere schließen**, dann Neues portieren. 13 Pfade in
   den zwei portierten Modulen laufen heute ins 404 — die Rechnungserstellung
   ist damit nur zur Bauzeit fertig.
2. **Einen Editor portieren, nicht acht.** Die 40 371 Zeilen der Beleg-Editoren
   sind eine Datei mit acht Belegarten; `create-invoice/` ist bereits der
   zerlegte Kern und sollte parametrisiert werden, nicht siebenmal kopiert.
3. **DATEV als CSV-Export planen**, nicht als API-Anbindung — die alte
   API-Anbindung war Attrappe.
4. **Komplexität nicht mitnehmen.** Der Altbestand hat 0 Tests, Funktionen bis
   5 691 Zeilen und Komplexität bis 146 (`use-invoice-actions.ts`, bereits
   portiert). Der Ratchet friert das ein, heilt es aber nicht.
