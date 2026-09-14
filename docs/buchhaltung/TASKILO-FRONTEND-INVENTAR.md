# Inventar – Finanz-/Buchhaltungs-Frontend `taskilo-platform`

Stand: 11.09.2026 · Quelle: `/Users/andystaudinger/taskilo-platform/apps/frontend/app` (Next.js App Router, TypeScript). Nur gelesen, nichts geändert.

## Methode

- **Startmenge (201 Dateien):** `src/components/finance/**`, `src/components/accounting/*`, `src/components/invoices/*`, `src/components/invoice/*`, `src/app/dashboard/company/[uid]/finance/**`, `src/app/dashboard/company/[uid]/datev/**`, `src/app/datev`, `src/app/datev-test` sowie `src/app/print/**` (Druckansicht für Rechnung/Angebot, beim Prüfen der Routen gefunden).
- **Rekursive Import-Verfolgung** (Skript, Alias `@/*` → `src/*` laut `tsconfig.json`; relative Importe; `import()`; alle Endungen inkl. `index.*`). Ergebnis: **325 Dateien**, 0 unaufgelöste Importe.
- **Nutzung:** Für jede erreichte Datei wurden ALLE Importer in `src/**` gezählt. „nur Finanz“ = kein Importer außerhalb der erreichten Menge; „geteilt (n ext.)“ = n Importer außerhalb, mit Beispiel.
- **Zeilen** = physische Zeilen (`wc -l`-äquivalent). Zweck-Sätze stützen sich auf Kopfkommentare, Exporte, sichtbare Titel (`DialogTitle`/`CardTitle`) und verwendete `/api/v1/…`-Endpunkte der jeweiligen Datei.
- **Nicht im Baum:** Workspace-Pakete `@tasko/ui` (`packages/ui`, Design-System, 167 Import-Stellen) und `@tasko/shared` (`packages/shared`: `api-client`, `server-api`, `auth-storage`, `NewAuthContext` – im App-Code nur als 1–8-zeilige Re-Exports vorhanden). Beide sind plattformweit geteilt und kein Finanz-Code.

## Zählung

| Kennzahl | Wert |
|---|---:|
| Dateien gesamt (erreichte Menge) | **325** |
| Zeilen gesamt | **180.892** |
| davon Startmenge (Finanz-/DATEV-/Print-Ordner) | 201 |
| davon per Import erreicht (außerhalb der Ordner) | 124 |
| … davon ausschließlich vom Finanzwerkzeug importiert | 79 |
| … davon auch von anderen Bereichen genutzt | 45 |

| Kategorie | Dateien | Zeilen |
|---|---:|---:|
| Seite/Route | 65 | 69.592 |
| Komponente | 169 | 77.594 |
| Hook | 8 | 1.868 |
| Service | 37 | 18.247 |
| Util | 14 | 3.233 |
| Lib | 11 | 1.288 |
| Typen | 11 | 1.944 |
| Daten/Konstanten/Config | 6 | 6.508 |
| Kontext/Provider | 2 | 181 |
| Doku | 2 | 437 |
| Tests | 0 | 0 |
| Styles (eigene Dateien) | 0 | 0 |

Tests: im gesamten `apps/frontend/app/src` gibt es keine `*.test.*`/`*.spec.*`/`__tests__`. Styles: keine finanzspezifische CSS-Datei; Styling per Tailwind-Klassen und `@tasko/ui`, PDF-Seitenstile als String in `utils/pdf-page-styles.ts`; `src/styles/print-only.css` wird von keiner TS/TSX-Datei importiert.

### Die 10 größten Dateien

| Zeilen | Datei |
|---:|---|
| 5691 | `app/dashboard/company/[uid]/finance/credits/create/page.tsx` |
| 5525 | `app/dashboard/company/[uid]/finance/invoices/recurring/create/page.tsx` |
| 5380 | `app/dashboard/company/[uid]/finance/invoices/create/page.tsx` |
| 5268 | `app/dashboard/company/[uid]/finance/invoices/[invoiceId]/edit/page.tsx` |
| 4785 | `app/dashboard/company/[uid]/finance/quotes/[quoteId]/edit/page.tsx` |
| 4590 | `app/dashboard/company/[uid]/finance/delivery-notes/create/page.tsx` |
| 4580 | `app/dashboard/company/[uid]/finance/order-confirmations/create/page.tsx` |
| 4552 | `app/dashboard/company/[uid]/finance/quotes/create/page.tsx` |
| 3160 | `data/datev-category-mapping-complete.ts` |
| 2904 | `app/dashboard/company/[uid]/finance/reminders/create/page.tsx` |

Auffällig: Die acht Beleg-Editoren (Rechnung create/edit, wiederkehrende Rechnung, Storno/Gutschrift, Angebot create/edit, Lieferschein, Auftragsbestätigung) sind je 4.500–5.700 Zeilen große Kopien desselben Editors (Kopfkommentare „Use InvoiceTemplate type … dynamic templates work for invoices, quotes“, Export `CreateQuotePage` in `invoices/create/page.tsx`). Zusammen ~40.400 Zeilen = 22 % des Werkzeugs.

## Funktionsumfang (aus den Dateien belegt)

| Bereich | Befund | Belegstellen |
|---|---|---|
| **Belegarten** | Rechnung, Angebot, Auftragsbestätigung, Lieferschein, wiederkehrende Rechnung, Mahnung, Stornorechnung/Gutschrift (`credit-note`, `cancellation`) | `lib/document-utils.ts` (`DocumentType`-Union), `DocumentListView.tsx` (Titel „Rechnungen, Angebote, Auftragsbestätigungen, Lieferscheine, Wiederkehrende Rechnungen“), Routen `credits`, `delivery-notes`, `order-confirmations`, `invoices/recurring`, `reminders` |
| **Rechnungsstatus** | `draft / finalized / sent / paid / overdue / cancelled / storno` | `types/invoiceTypes.ts:136` |
| **E-Rechnung** | XRechnung + ZUGFeRD erzeugen/parsen/validieren/importieren (fast-xml-parser), Peppol-Profil `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0`, Übertragungsprotokolle (UStG §14/§14b, EN 16931), Compliance-Dashboards | `services/eInvoiceService.ts`, `xrechnungParserService.ts`, `autoEInvoiceService.ts:65`, `eInvoiceTransmissionService.ts`, `EInvoiceComponent.tsx`, `EInvoiceSendDialog.tsx`, `ImportXRechnungDialog.tsx` |
| **Kunden/Kontakte** | Kunden + Ansprechpartner, Kontaktdetail mit Tabs (Dokumente, Historie, Aufträge, WhatsApp), Kundenabgleich Kundennummer > E-Mail > Name, USt-IdNr.-Validierung EU, CSV-Export | `NewCustomerModal.tsx`, `customer-detail/*`, `customerMatchingService.ts`, `utils/vatValidation.ts`, `finance/contacts/page.tsx` |
| **Lieferanten** | Nur Verweise: `/api/v1/suppliers` in `ExpenseComponent.tsx`; die Route `finance/suppliers` leitet lediglich zur Geschäftspartner-Seite weiter | `ExpenseComponent.tsx`, `finance/suppliers/page.tsx` |
| **Mahnwesen** | 3 Mahnstufen (Standard 5/10/15 € Gebühr, 7/14/21 Tage, „Inkasso-Androhung“), eigener Nummernkreis `M<Stufe>-…`, überfällige-Rechnungen-Alert/Hook, WhatsApp-Automatisierung | `ReminderComponent.tsx:76-78`, `FinanceSettingsTab.tsx`, `ReminderDialog.tsx`, `useOverdueInvoices.ts`, `whatsapp-notifications.service.ts` |
| **Skonto** | Felder `skontoEnabled/skontoDays/skontoPercentage/skontoText` in allen Beleg-Editoren, Skonto-Produkte am Kunden, Summenblock | `invoices/create/page.tsx:262-266`, `AddCustomerModal.tsx` (`SkontoProduct`), `pdf-templates/common/TotalsDisplay.tsx` |
| **Zahlungen** | Zahlungsliste (`/api/v1/payments`), „Als bezahlt markieren“, Bank-Transaktion ↔ Rechnung verknüpfen (finAPI-Transaktionen, Sandbox/Prod-Config), Differenzgrund bei Teilzahlung, Überweisungsmodal, Zahlungskonten/-methoden | `finance/payments/page.tsx`, `InvoiceListView.tsx`, `LinkTransactionModal.tsx`, `SelectBankingTransactionModal.tsx`, `lib/finapi-config.ts`, `DifferenceReasonModal.tsx`, `BankTransferModal.tsx`, `PaymentAccountsTab.tsx` |
| **Kassenbuch** | Kasse eröffnen, Anfangsbestand, Geldbewegungen, Belege zuordnen | `CashbookComponent.tsx`, `OpenCashRegisterModal.tsx`, `OpeningBalanceModal.tsx`, `CashMovementModal.tsx`, `AllocateBookingModal.tsx` |
| **Ausgaben/Belege** | Erfassen, Beleg-Upload (HEIC→JPEG), OCR (`/expenses/extract-receipt`, `/finance/ocr-cloud-storage`), wiederkehrende Ausgaben, XRechnung-Import als Ausgabe | `ExpenseComponent.tsx`, `ExpenseReceiptUpload.tsx`, `ReceiptPreviewUpload.tsx`, `expenses/recurring/page.tsx` |
| **Anlagen** | Anlagenverzeichnis, Anlagenbuchhaltung nach §7 EStG (AfA-Methoden, Abschreibungsplan) | `expenses/assets/page.tsx`, `services/fixedAssetService.ts` |
| **DATEV** | OAuth-Verbindung (PKCE, Token-Manager), Buchungsstapel-CSV-Datei-Export, Export „Rechnungsdaten + Belegbilder“, Buchungsdatenservice-Übertragung (JSZip), Buchungskonten (656+ Konten, Favoriten), Kategorie-/Einnahmen-Mappings, Auswertungen BWA/SuSa | `datev/**`, `components/datev/*`, `lib/datev-token-manager.ts`, `data/complete-datev-accounts.ts`, `datevAuswertungsService.ts`, `datevService.ts` |
| **Kontenrahmen** | Auswahl **SKR03 (Standard) / SKR04** im DATEV-Buchungsdatenservice; Kontobereichslogik SKR03 (Erlöse 4000–4999, Aufwand 5000–7999) | `datev/export/booking-data-service/page.tsx:16,397-398`, `BookingAccountSelectionModal.tsx:56-59` |
| **Kostenstellen / Nummernkreise** | Kostenstellen-Tab; Nummernkreise je Typ (Rechnung, Kunde, Storno, Mahnung …) mit Format/Präfix, Backend `/number-sequences/{company}/next`, Hooks für nächste Rechnungs-/Stornonummer | `CostCentersTab.tsx`, `NumberSequenceModal.tsx`, `numberSequenceService.ts`, `useNextInvoiceNumber.ts`, `useNextStornoNumber.ts` |
| **Umsatzsteuer** | Steuerregel-Katalog (Reverse Charge §13b/§18b, EU, Kleinunternehmer-Hinweise in Editoren), UStVA-Assistent (5 Schritte, ELSTER-Übermittlung oder lokaler Bericht), ELSTER-Zertifikat, Vorsteuer-Echtzeitschätzung, ESt-Vorauszahlungen, Steuerschätzungs-Assistent (`validate-steuernummer`) | `config/taxRules.ts`, `taxes/wizard/**`, `ElsterCertificateSettings.tsx`, `taxes/page.tsx`, `taxes/prepayment/[id]/page.tsx`, `TaxEstimationWizard.tsx` |
| **Berichte** | EÜR-Assistent, BWA, SuSa, GuV, Jahresabschluss-Aktion, monatlicher Geschäftsverlauf, Kennzahlen (Finance/Inventory/HR/TimeTracking/Orders) | `taxes/eur/page.tsx`, `ReportComponent.tsx`, `TaxComponent.tsx`, `taxService.ts`, `businessReportService.ts` |
| **PDF-Erzeugung** | 6 HTML/React-Templates (Standard, Neutral, Elegant, Technical, Geometric, Dynamic) mit A4-Umbruchlogik und Mehrsprachigkeit; serverseitige PDF-API (`/generate-pdf-single`, `/generate-pdf-multi`, `/generate-invoice-pdf`); eigenständige jsPDF-Erzeugung; Vorschau mit react-pdf; Druckroute `app/print` | `pdf-templates/**`, `hooks/pdf/*`, `EmailSendModal.tsx:483-491`, `services/pdf/InvoicePDFTemplate.ts`, `PdfPreview.tsx`, `SimplePDFViewer.tsx` |
| **Mailversand** | `/api/v1/email/send-document`, `/api/v1/send-invoice-email`; Empfänger-Suche über `/finance/customers`; drei überlappende Versandmodale (`SendDocumentModal` 2.763 Z., `EmailSendModal` 1.242 Z., `EmailsendModalnormal` 1.177 Z.) plus `SendInvoiceDialog`/`EmailDialog` | `EmailSendModal.tsx:625`, `SendInvoiceDialog.tsx:156` |
| **Textvorlagen/Platzhalter** | Kopf-/Fußtext-Editoren (TipTap), Textvorlagen-Service, zwei Platzhalter-Systeme (Legacy `placeholderSystem.ts` 800 Z. + modulare `placeholders/*`) | `HeaderTextEditor.tsx`, `FooterTextEditor.tsx`, `TextTemplateService.ts`, `utils/placeholders/**` |
| **GoBD** | Festschreibung automatisch beim Versand/manuell/periodisch, Aktionswarnung, Storno-Manager, Compliance-Dashboard, Audit-Typen | `components/finance/gobd/*`, `services/gobdService.ts`, `types/gobdTypes.ts` |
| **Projekte/Zeiterfassung** | Projekte, Team, Zeiteinträge manuell/Timer, Projektauswertung | `ProjectsComponent.tsx`, `TimeTrackingComponent.tsx`, `timeTrackingService.ts` |
| **Inventar** | Artikel-/Dienstleistungsauswahl in Positionen, Inventar-Komponente, Inventur | `InventoryComponent.tsx`, `InventorySelector.tsx` (2×), `inventoryService.ts`, `inventurService.ts` |
| **WhatsApp** | Click-to-Chat, Meta-API, Kunden-Tab, Automatisierungen | `whatsapp.service.ts`, `CustomerWhatsAppTab.tsx` |
| **Währung** | ISO-4217-Liste (`data/currencies.ts`), `formatCurrency` in `lib/utils.ts` | – |
| **Lieferschein-Integrationen** | UI für DHL/UPS/FedEx/Shopify/WooCommerce/Magento/Amazon/eBay/Post AT+CH mit Platzhalter-Keys (`dhl_****`) – Konfigurationsoberfläche, keine sichtbare Anbindung in den Services | `DeliveryNoteApiIntegrations.tsx` |

**Backend-Kopplung:** 64 verschiedene `/api/v1/<ressource>`-Präfixe in der erreichten Menge, am häufigsten `companies` (126), `invoices` (59), `customers` (58), `expenses` (33), `inventory` (22), `quotes` (17), `number-sequences` (12), `datev` (11), `tax-reports` (10), `fixed-assets` (9), `recurring-invoices` (9), `einvoice` (7), `gobd` (7), `reminders` (6), `cashbook` (4). Kein `firebase`-Import mehr im Baum; Namen wie `firestoreInvoiceService.ts` sind historisch (ruft FastAPI).

## Dateiinventar


### Seiten/Routen – Finanzwerkzeug `app/dashboard/company/[uid]/finance/**`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `app/dashboard/company/[uid]/finance/accounting/page.tsx` | 403 | Buchhaltungs-Einstellungen mit Tabs (Buchungskonten, Kostenstellen, Nummernkreise, Zahlungskonten, Zahlungsmethoden, Finanzeinstellungen, Transaktionszuordnung). | AccountingPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/cashbook/page.tsx` | 39 | Wrapper-Seite, rendert CashbookComponent (Kassenbuch). | CashbookPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/contacts/[contactId]/edit/page.tsx` | 2447 | Kontakt bearbeiten – vollständiges Formular (Adressen, Ansprechpartner, Skonto, Zahlungsbedingungen), Kopie der Create-Seite. | ContactPerson, NewCustomerModalProps, EditContactPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/contacts/[contactId]/page.tsx` | 664 | Kontakt-Detailseite (Stammdaten, Historie). | ContactDetailPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/contacts/new/page.tsx` | 2021 | Neuen Kontakt anlegen – vollständiges Formular, Kopie der Create-Seite (Export heißt irrtümlich ContactsPage). | ContactPerson, NewCustomerModalProps, ContactsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/contacts/page.tsx` | 623 | Kontaktliste (Kunden/Geschäftspartner) mit Umsatz aus Rechnungen/Ausgaben und CSV-Export. | ContactsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/credits/create/page.tsx` | 5691 | Storno-/Gutschrift-Editor (Export CreateStornoPage): kompletter Beleg-Editor mit Positionen, Skonto, Vorlagen, PDF-Vorschau, Versand – größte Datei des Werkzeugs. | CreateStornoPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/credits/page.tsx` | 153 | Liste der Stornorechnungen/Gutschriften via DocumentListView. | CreditsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/customers/create/page.tsx` | 2230 | Neuen Kunden anlegen (Typ, Adresse, Ansprechpartner, Steuer-/Bankdaten). | ContactPerson, Customer, CreateCustomerPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/delivery-notes/create/page.tsx` | 4590 | Lieferschein-Editor (Positionen, Vorlagen, Vorschau, Versand), Kopie des Rechnungs-Editors. | CreateDeliveryNotePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/delivery-notes/page.tsx` | 183 | Liste der Lieferscheine via DocumentListView. | DeliveryNotesPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/einvoices/page.tsx` | 32 | Wrapper-Seite, rendert EInvoiceComponent (XRechnung/ZUGFeRD). | EInvoicesPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/expenses/[expenseId]/edit/page.tsx` | 806 | Ausgabe bearbeiten inkl. Beleg-Upload. | EditExpensePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/expenses/[expenseId]/page.tsx` | 468 | Ausgaben-Detailseite. | ExpenseDetailPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/expenses/assets/page.tsx` | 1008 | Anlagenverzeichnis (Anlagen anlegen/bearbeiten/löschen über /api/v1/inventory). | AssetsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/expenses/create/page.tsx` | 1131 | Ausgabe/Beleg erfassen inkl. PDF-Upload (Supabase Storage via FastAPI) und deutschem Datumsformat. | CreateExpensePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/expenses/page.tsx` | 335 | Ausgaben-Übersicht mit XRechnung-Import-Dialog. | ExpensesPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/expenses/recurring/page.tsx` | 830 | Wiederkehrende Ausgaben verwalten. | RecurringExpensesPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/inventory/page.tsx` | 39 | Wrapper-Seite, rendert InventoryComponent. | InventoryPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/invoices/[invoiceId]/edit/page.tsx` | 5268 | Rechnung bearbeiten – vollständiger Editor, Kopie der Create-Seite. | EditInvoicePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/invoices/[invoiceId]/page.tsx` | 1598 | Rechnungs-Detailseite (Status, Storno, PDF, Versand, Zahlungen). | InvoiceDetailPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/invoices/create/page.tsx` | 5380 | Rechnungs-Editor (Export heißt irrtümlich CreateQuotePage): Positionen, Skonto, Steuerregeln, Textvorlagen, PDF-Vorlagen, Live-Vorschau, Versand. | CreateQuotePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/invoices/page.tsx` | 199 | Rechnungsliste (InvoiceListView) plus XRechnung-Import. | InvoicesPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/invoices/recurring/create/page.tsx` | 5525 | Editor für wiederkehrende Rechnungen (Intervall weekly/monthly/quarterly/yearly), Kopie des Rechnungs-Editors. | CreateRecurringInvoicePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/invoices/recurring/page.tsx` | 193 | Liste wiederkehrender Rechnungen via DocumentListView. | RecurringInvoicesPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/order-confirmations/create/page.tsx` | 4580 | Auftragsbestätigungs-Editor, Kopie des Rechnungs-Editors. | CreateOrderConfirmationPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/order-confirmations/page.tsx` | 150 | Liste der Auftragsbestätigungen via DocumentListView. | OrderConfirmationsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/page.tsx` | 902 | Finanz-Dashboard: lädt Rechnungen/Ausgaben/Mitarbeiter, zeigt Kennzahlen (recharts) und Schnellzugriff; Zugriffsprüfung Owner/Mitarbeiter. | FinancePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/payments/page.tsx` | 113 | Zahlungsliste aus /api/v1/payments. | PaymentsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/projects/page.tsx` | 22 | Wrapper-Seite, rendert ProjectsComponent. | ProjectsPage, metadata | nur Finanz |
| `app/dashboard/company/[uid]/finance/quotes/[quoteId]/edit/page.tsx` | 4785 | Angebot bearbeiten – vollständiger Editor. | EditQuotePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/quotes/[quoteId]/page.tsx` | 7 | Wrapper, rendert QuoteDetailView. | QuoteDetailPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/quotes/accepted/page.tsx` | 37 | Gefilterte Angebotsliste (angenommen). | QuotesAcceptedPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/quotes/create/page.tsx` | 4552 | Angebots-Editor, Kopie des Rechnungs-Editors. | CreateQuotePage | nur Finanz |
| `app/dashboard/company/[uid]/finance/quotes/drafts/page.tsx` | 37 | Gefilterte Angebotsliste (Entwürfe). | QuotesDraftsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/quotes/page.tsx` | 152 | Angebotsliste via DocumentListView. | QuotesPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/quotes/sent/page.tsx` | 37 | Gefilterte Angebotsliste (versendet). | QuotesSentPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/reminders/create/page.tsx` | 2904 | Mahnungs-Editor (Mahnstufe, Gebühr, Vorlage, Versand). | CreateReminderPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/reminders/page.tsx` | 208 | Mahnungsliste via DocumentListView. | RemindersPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/reports/page.tsx` | 32 | Wrapper-Seite, rendert ReportComponent (BWA, SuSa …). | ReportsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/settings/page.tsx` | 24 | Reine Weiterleitung (useRouter/useEffect) – kein eigener Inhalt. | FinanceSettingsPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/suppliers/page.tsx` | 43 | Zugriffsprüfung und Weiterleitung zur Geschäftspartner-Seite – kein eigener Inhalt. | SuppliersPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/eur/page.tsx` | 683 | EÜR-Assistent (Einnahmen-Überschuss-Rechnung) Schritt für Schritt. | EURPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/page.tsx` | 1323 | Steuerzentrale: UStVA-Übersicht mit Echtzeit-Vorsteuer-Schätzung, Vorauszahlungen, ELSTER. | TaxesPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/prepayment/[prepaymentId]/page.tsx` | 954 | Detailseite einer Einkommensteuer-Vorauszahlung mit Schätzung (/api/v1/tax/prepayments). | EstPrepaymentDetailPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/wizard/absenden/page.tsx` | 671 | UStVA-Assistent Schritt 5: Speichern als Bericht oder ELSTER-Übermittlung. | WizardAbsendenPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/wizard/ausgaben/page.tsx` | 318 | UStVA-Assistent Schritt 3: Ausgaben/Vorsteuer prüfen. | WizardAusgabenPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/wizard/einnahmen/page.tsx` | 294 | UStVA-Assistent Schritt 2: Einnahmen/Rechnungen prüfen. | WizardEinnahmenPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/wizard/layout.tsx` | 11 | Layout des UStVA-Assistenten. | WizardLayout | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/wizard/page.tsx` | 259 | UStVA-Assistent Schritt 1: Zeitraum wählen. | WizardStep1Page | nur Finanz |
| `app/dashboard/company/[uid]/finance/taxes/wizard/zusammenfassung/page.tsx` | 330 | UStVA-Assistent Schritt 4: Zusammenfassung. | WizardZusammenfassungPage | nur Finanz |
| `app/dashboard/company/[uid]/finance/time-tracking/page.tsx` | 32 | Wrapper-Seite, rendert TimeTrackingComponent. | TimeTrackingPage | nur Finanz |

*52 Dateien, 65316 Zeilen*

### Seiten/Routen – DATEV `app/dashboard/company/[uid]/datev/**`, `app/datev`, `app/datev-test`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `app/dashboard/company/[uid]/datev/debug/page.tsx` | 128 | DATEV Debug-Tools zur Fehlerbehebung. | DatevDebugPage | nur Finanz |
| `app/dashboard/company/[uid]/datev/export/booking-data-service/page.tsx` | 602 | DATEV Buchungsdatenservice: Einstellungen inkl. Kontenrahmen SKR03/SKR04, Beraternummer etc. | DatevBookingDataServicePage | nur Finanz |
| `app/dashboard/company/[uid]/datev/export/booking-data-service/transfer/page.tsx` | 838 | Übertragung Buchungsstapel an DATEV (JSZip-Paketierung, DATEV-Einstellungen). | DatevBDSTransferPage | nur Finanz |
| `app/dashboard/company/[uid]/datev/export/file-export/page.tsx` | 501 | Buchungsstapel-CSV-Export über /api/v1/datev/export/bookings (Übertragungsart Datei). | DatevFileExportPage | nur Finanz |
| `app/dashboard/company/[uid]/datev/export/invoice-file-export/page.tsx` | 508 | Export „Rechnungsdaten + Belegbilder“ als Datei über /api/v1/datev/export/bookings. | DatevInvoiceFileExportPage | nur Finanz |
| `app/dashboard/company/[uid]/datev/export/page.tsx` | 310 | Export-Übersicht: Datei-Export (Buchungsstapel CSV) vs. Buchungsdatenservice. | DatevExportPage | nur Finanz |
| `app/dashboard/company/[uid]/datev/overview/page.tsx` | 26 | Wrapper, rendert DatevDashboard. | DatevOverviewPage | nur Finanz |
| `app/dashboard/company/[uid]/datev/page.tsx` | 678 | DATEV-Hauptseite „Exporte / Steuerberater“: Exporttyp auswählen, Zugriffsprüfung. | DatevMainPage | nur Finanz |
| `app/dashboard/company/[uid]/datev/setup/page.tsx` | 136 | DATEV-Verbindung einrichten (OAuth), Steuerberater-Zugang, automatischer Rechnungsexport. | DatevSetupPage | nur Finanz |
| `app/datev-test/page.tsx` | 134 | Testseite: DATEV Auth-URL/PKCE-Flow/Credentials-Status. | DatevTestPage | nur Finanz |
| `app/datev/page.tsx` | 158 | Eigenständige DATEV-Integrationsseite außerhalb des Dashboards (Auth-Komponente). | DatevPage | nur Finanz |

*11 Dateien, 4019 Zeilen*

### Seiten/Routen – Druckansicht `app/print/**`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `app/print/[type]/[companyId]/[id]/page.tsx` | 95 | Server Component: lädt Rechnung/Angebot + Firma via serverApi und rendert PrintClient. | PrintPage | nur Finanz |
| `app/print/[type]/[id]/PrintClient.tsx` | 162 | Druckansicht: wählt PDF-Template (STANDARD/NEUTRAL/ELEGANT/TECHNICAL/GEOMETRIC/DYNAMIC) und löst window.print aus. | PrintClient | nur Finanz |

*2 Dateien, 257 Zeilen*

### Komponenten – `components/finance/*` (Wurzel)

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/finance/A4PageComponents.tsx` | 150 | A4-Seitenwrapper/-umbruch/-sektion für PDF-Templates. | A4PageWrapperProps, A4PageWrapper, A4PageBreak, A4SectionProps, A4Section | nur Finanz |
| `components/finance/AddCustomerModal.tsx` | 1045 | Modal Kunde anlegen (Ansprechpartner, Skonto-Produkte). | ContactPerson, SkontoProduct, Customer, default:AddCustomerModal | geteilt (6 ext., z. B. app/dashboard/company/[uid]/inventory/[itemId]/edit/page.tsx) |
| `components/finance/AllocateBookingModal.tsx` | 354 | Rechnung/Beleg einer Kassenbuchung zuordnen. | AllocateBookingModal | nur Finanz |
| `components/finance/AssignTransactionModal.tsx` | 126 | Transaktion einem Dokument zuordnen, mit Storno-Warnung. | AssignTransactionModal | geteilt (1 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `components/finance/BankTransferModal.tsx` | 977 | Überweisung tätigen (Empfänger aus Rechnungen/Ausgaben/Mitarbeitern). | default:BankTransferModal | geteilt (1 ext., z. B. app/dashboard/company/[uid]/banking/accounts/page.tsx) |
| `components/finance/BookingAccountSelectionModal.tsx` | 264 | Buchungskonto wählen (SKR03-Bereiche 4000–4999 Erlöse, 5000–7999 Aufwand). | BookingAccountSelectionModal | nur Finanz |
| `components/finance/CancelInvoiceModal.tsx` | 67 | Bestätigungsmodal Rechnung stornieren. | CancelInvoiceModal | nur Finanz |
| `components/finance/CashMovementModal.tsx` | 321 | Geldbewegung (Kasse) erfassen. | CashMovementModal | nur Finanz |
| `components/finance/CashbookComponent.tsx` | 1346 | Kassenbuch: Kasse eröffnen, Anfangsbestand, Buchungen, Zuordnung von Belegen. | CashbookComponent | geteilt (1 ext., z. B. app/dashboard/company/[uid]/banking/cashbook/page.tsx) |
| `components/finance/CategoryAutocomplete.tsx` | 358 | Autocomplete für Ausgabenkategorien/DATEV-Konten. | CategoryAutocomplete | geteilt (1 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `components/finance/CategorySelectionModal.tsx` | 1120 | Kategorie/DATEV-Konto auswählen inkl. Favoriten. | CategorySelectionModal | geteilt (1 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `components/finance/ConnectedDocumentsModal.tsx` | 258 | Verknüpfte Dokumente anzeigen/öffnen. | default:ConnectedDocumentsModal | geteilt (2 ext., z. B. app/dashboard/company/[uid]/banking/accounts/page.tsx) |
| `components/finance/ContactPersonsSection.tsx` | 147 | Ansprechpartner-Abschnitt (Hauptansprechpartner). | ContactPersonsSection | nur Finanz |
| `components/finance/CreditComponent.tsx` | 446 | Liste der Stornorechnungen. | CreditComponent | nur Finanz |
| `components/finance/CustomerDetailModal.tsx` | 327 | Kunden-Detailmodal (Rechnungen, Ausgaben, Termine). | CustomerDetailModal | nur Finanz |
| `components/finance/CustomerSelect.tsx` | 341 | Kunden-Auswahlfeld mit Suche. | CustomerSelect | nur Finanz |
| `components/finance/DeliveryNoteApiIntegrations.tsx` | 623 | Konfigurierbare Versand-/Shop-Integrationen für Lieferscheine (DHL, UPS, FedEx, Shopify, WooCommerce, Magento, Amazon, eBay, Post AT/CH) – UI mit Platzhalter-Keys. | DeliveryNoteApiIntegrations | nur Finanz |
| `components/finance/DifferenceReasonModal.tsx` | 168 | Differenzgrund bei Teilzahlung/Abweichung wählen. | DifferenceReasonModal | geteilt (1 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `components/finance/DocumentListView.tsx` | 1078 | Generische Belegliste für Rechnungen, Angebote, Auftragsbestätigungen, Lieferscheine, wiederkehrende Rechnungen, Mahnungen, Gutschriften. | DocumentType, DocumentItem, DocumentListView | nur Finanz |
| `components/finance/EInvoiceComplianceDashboard.tsx` | 302 | Übersicht E-Rechnungs-Compliance (deutsche Gesetzgebung). | EInvoiceComplianceDashboard | nur Finanz |
| `components/finance/EInvoiceComplianceOverview.tsx` | 294 | Statusübersicht E-Rechnungspflicht. | EInvoiceComplianceOverview | nur Finanz |
| `components/finance/EInvoiceComponent.tsx` | 1099 | E-Rechnungs-Zentrale: erstellen, hochladen, validieren, Vorschau (XRechnung/ZUGFeRD). | EInvoiceComponent | nur Finanz |
| `components/finance/EInvoiceIntegration.tsx` | 488 | E-Invoice-Integration mit Compliance-Checks. | EInvoiceIntegration | nur Finanz |
| `components/finance/EInvoicePreview.tsx` | 12 | Platzhalter-Komponente für E-Rechnungs-Vorschau. | EInvoicePreview | nur Finanz |
| `components/finance/EInvoiceSendDialog.tsx` | 1155 | E-Rechnung versenden (UStG §14), nutzt jsPDF und Peppol-Option. | EInvoiceSendDialog | nur Finanz |
| `components/finance/EInvoiceStatsDashboard.tsx` | 338 | E-Rechnungs-Statistiken/Trends. | EInvoiceStatsDashboard | nur Finanz |
| `components/finance/EInvoiceTransmissionLogs.tsx` | 403 | Übertragungsprotokolle (UStG §14b Aufbewahrung). | EInvoiceTransmissionLogs | nur Finanz |
| `components/finance/EditCustomerModal.tsx` | 769 | Modal Kunde bearbeiten. | EditCustomerModal | nur Finanz |
| `components/finance/ElsterCertificateSettings.tsx` | 255 | ELSTER-Zertifikat hinterlegen/verwalten. | ElsterCertificateSettings | nur Finanz |
| `components/finance/EmailDialog.tsx` | 171 | Einfacher Mail-Dialog (/api/v1/send-invoice-email). | EmailDialog | nur Finanz |
| `components/finance/EmailSendModal.tsx` | 1242 | Belegversand per E-Mail mit PDF-Erzeugung (generate-pdf-single/-multi) und /api/v1/email/send-document, WhatsApp-Option. | EmailSendModal | nur Finanz |
| `components/finance/EmailsendModalnormal.tsx` | 1177 | Zweite, nahezu gleiche Variante des Mail-Versandmodals (Dublette). | EmailSendModalNormal | nur Finanz |
| `components/finance/ExpenseComponent.tsx` | 1386 | Ausgabenverwaltung: Liste, Beleg-Upload, OCR (/expenses/extract-receipt), Lieferanten. | ExpenseComponent | nur Finanz |
| `components/finance/ExpenseReceiptUpload.tsx` | 646 | Beleg-Upload inkl. HEIC→JPEG-Konvertierung (heic2any). | ExpenseReceiptUpload | nur Finanz |
| `components/finance/FavoritesSystem.tsx` | 184 | Favoriten für DATEV-Konten (Toggle + Sektion). | FavoriteToggle, FavoritesSection | nur Finanz |
| `components/finance/FilteredQuoteComponent.tsx` | 263 | Gefilterte Angebotsliste (Status). | FilteredQuoteComponent | nur Finanz |
| `components/finance/FinanceOverview.tsx` | 387 | Kennzahlen-Kacheln (Umsatz, Ausgaben, Nettogewinn) mit Skeleton. | FinanceOverview | nur Finanz |
| `components/finance/FooterTextEditor.tsx` | 598 | Rich-Text-Editor für Fußtexte (TipTap). | FooterTextEditor | nur Finanz |
| `components/finance/HeaderTextEditor.tsx` | 564 | Rich-Text-Editor für Kopftexte (TipTap). | HeaderTextEditor | nur Finanz |
| `components/finance/ImportXRechnungDialog.tsx` | 458 | XRechnung/ZUGFeRD-XML importieren → Ausgabe anlegen. | ImportXRechnungDialog | nur Finanz |
| `components/finance/InlinePreview.tsx` | 201 | Inline-Belegvorschau (lädt Firma + Rechnung). | InlinePreview | nur Finanz |
| `components/finance/InventorySelector.tsx` | 309 | Artikel aus dem Inventar in Positionen übernehmen. | InventorySelector | nur Finanz |
| `components/finance/InvoiceHeaderTextSection.tsx` | 83 | Betreff/Kopftext-Abschnitt im Editor. | InvoiceHeaderTextSection | nur Finanz |
| `components/finance/InvoiceListView.tsx` | 816 | Rechnungsliste mit Aktionen (als bezahlt markieren, Banking-Transaktion verknüpfen, Storno). | InvoiceListView | nur Finanz |
| `components/finance/InvoiceTaxRuleSelector.tsx` | 112 | Steuerregel-Auswahl für Rechnungen. | InvoiceTaxRuleSelector | nur Finanz |
| `components/finance/InvoiceTemplatePicker.tsx` | 301 | Rechnungs-Template auswählen. | InvoiceTemplatePicker | nur Finanz |
| `components/finance/InvoiceTemplates.tsx` | 144 | Template-Registry (AVAILABLE_TEMPLATES, DOCUMENT_TYPE_TEMPLATES) und Renderer-Wrapper. | InvoiceTemplate, AVAILABLE_TEMPLATES, DEFAULT_INVOICE_TEMPLATE, DOCUMENT_TYPE_TEMPLATES, InvoiceTemplateRendererProps | geteilt (1 ext., z. B. app/dashboard/company/[uid]/settings/templates/page.tsx) |
| `components/finance/LinkTransactionModal.tsx` | 749 | Bank-Transaktion einer Rechnung zuordnen. | LinkTransactionModal | geteilt (2 ext., z. B. app/dashboard/company/[uid]/banking/accounts/page.tsx) |
| `components/finance/LivePreviewModal.tsx` | 1345 | Live-Vorschau des Belegs mit Layout-/Farbanpassung. | LivePreviewModal | nur Finanz |
| `components/finance/ManualTimeEntry.tsx` | 549 | Manuelle Zeiterfassung für Projekte. | ManualTimeEntry | nur Finanz |
| `components/finance/NewCategoryModal.tsx` | 191 | Neue Ausgabenkategorie anlegen. | NewCategoryModalProps, NewCategoryModal | nur Finanz |
| `components/finance/NewCustomerModal.tsx` | 1989 | Großes Kundenanlage-Modal (Kopie der Create-Seite). | ContactPerson, NewCustomerModalProps, NewCustomerModal | geteilt (1 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `components/finance/OpenCashRegisterModal.tsx` | 97 | Kasse eröffnen. | OpenCashRegisterModal | nur Finanz |
| `components/finance/OpeningBalanceModal.tsx` | 162 | Anfangsbestand Kasse setzen. | OpeningBalanceModal | nur Finanz |
| `components/finance/OverdueInvoicesAlert.tsx` | 114 | Header-Alert für überfällige Rechnungen. | OverdueInvoicesAlert | geteilt (1 ext., z. B. components/UserHeader.tsx) |
| `components/finance/OverdueInvoicesNotification.tsx` | 184 | Benachrichtigung/Badge für überfällige Rechnungen. | OverdueInvoicesNotification | nur Finanz |
| `components/finance/PDFTemplates.tsx` | 127 | Legacy-PDF-Template-Komponente (default export PDFTemplate). | default:PDFTemplate | geteilt (1 ext., z. B. services/pdfGenerationService.ts) |
| `components/finance/PaymentComponent.tsx` | 74 | Zahlungen-Übersicht (Platzhalter-Charakter, 74 Zeilen). | PaymentComponent | nur Finanz |
| `components/finance/PdfPreview.tsx` | 239 | PDF-Vorschau mit react-pdf (lazy). | PdfPreview | nur Finanz |
| `components/finance/ProfitEstimationSettings.tsx` | 393 | Gewinnschätzung (aus Rechnungen/Ausgaben) für Steuervorauszahlungen. | ProfitEstimationSettings | nur Finanz |
| `components/finance/ProjectDetailView.tsx` | 887 | Projekt-Detail mit Zeiteinträgen. | Project, TimeEntry, ProjectDetailView | nur Finanz |
| `components/finance/ProjectTeamManagement.tsx` | 382 | Mitarbeiter zu Projektteams zuordnen. | ProjectTeamManagement | nur Finanz |
| `components/finance/ProjectsComponent.tsx` | 1235 | Projektverwaltung (Liste, Anlage, Budget). | ProjectsComponent | nur Finanz |
| `components/finance/QuoteComponent.tsx` | 346 | Angebotsübersicht (Tabs entfernt). | QuoteComponent | nur Finanz |
| `components/finance/QuoteDetailView.tsx` | 992 | Angebots-Detailansicht (Status, Umwandlung, PDF). | QuoteDetailView | nur Finanz |
| `components/finance/QuoteModal.tsx` | 634 | Angebots-Modal (Notizen etc.). | QuoteModal | nur Finanz |
| `components/finance/ReceiptEditForm.tsx` | 335 | Beleg erstellen/bearbeiten (Details, Buchhaltung). | ReceiptEditForm | nur Finanz |
| `components/finance/ReceiptPreviewUpload.tsx` | 400 | Beleg-Upload mit Vorschau und Cloud-OCR (/finance/ocr-cloud-storage). | ReceiptPreviewUpload | geteilt (1 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `components/finance/RecurringInvoiceSettings.tsx` | 466 | Einstellungen wiederkehrender Rechnungen (Intervall, Auto-Versand). | RecurringInvoiceSettingsProps, RecurringInvoiceSettings | nur Finanz |
| `components/finance/ReminderComponent.tsx` | 550 | Mahnwesen: 3 Mahnstufen (5/10/15 € Gebühr, 7/14/21 Tage), Nummernkreis M<Stufe>-…. | ReminderComponent | nur Finanz |
| `components/finance/ReminderDialog.tsx` | 311 | Mahnung für überfällige Rechnung erstellen/versenden. | ReminderDialog | nur Finanz |
| `components/finance/ReminderSettings.tsx` | 193 | Mahnstufen-Einstellungen. | ReminderSettings | nur Finanz |
| `components/finance/ReportComponent.tsx` | 1005 | Auswertungen: BWA, SuSa, monatlicher Geschäftsverlauf, Schnellberichte. | ReportComponent | nur Finanz |
| `components/finance/SelectBankingTransactionModal.tsx` | 839 | finAPI-Transaktion auswählen (Kopie der Banking-Accounts-Seite). | SelectBankingTransactionModal | nur Finanz |
| `components/finance/SendDocumentModal.tsx` | 2763 | Universelles Versandmodal für alle Belegarten (PDF serverseitig, E-Invoice-Daten, GoBD-Festschreibung). | SendDocumentModal | nur Finanz |
| `components/finance/SendInvoiceDialog.tsx` | 328 | Rechnung per Mail senden (/api/v1/send-invoice-email). | SendInvoiceDialog | nur Finanz |
| `components/finance/ServiceSelector.tsx` | 81 | Dienstleistung als Position wählen. | ServiceSelector | nur Finanz |
| `components/finance/SimplePDFViewer.tsx` | 202 | PDF-Viewer mit Einzel-/Mehrseitenmodus, Zoom, Blättern. | SimplePDFViewer | nur Finanz |
| `components/finance/SimpleTaxRuleSelector.tsx` | 41 | Vereinfachte Steuerregel-Auswahl. | SimpleTaxRuleSelector | nur Finanz |
| `components/finance/StornoInvoice.tsx` | 414 | Stornorechnung erzeugen (/api/v1/generate-invoice-pdf). | StornoInvoice | nur Finanz |
| `components/finance/TaxComponent.tsx` | 485 | Steuer-Aktionen: UStVA, EÜR, BWA, GuV, Jahresabschluss. | TaxComponent | nur Finanz |
| `components/finance/TaxEstimationWizard.tsx` | 1589 | Steuerschätzungs-Assistent (validate-steuernummer, Einnahmen/Ausgaben). | TaxEstimationWizard | nur Finanz |
| `components/finance/TaxRuleSelector.tsx` | 202 | Steuerregel-Auswahl (Inland/EU/Drittland). | TaxRuleSelector | nur Finanz |
| `components/finance/TaxWizard.tsx` | 1006 | UStVA-Wizard als Komponente (Zeitraum, Einnahmen, Ausgaben, Zusammenfassung, Absenden). | TaxWizard | nur Finanz |
| `components/finance/TextTemplateSelect.tsx` | 109 | Textvorlage wählen/Standard laden. | TextTemplateSelect | nur Finanz |
| `components/finance/TimeTrackingComponent.tsx` | 990 | Zeiterfassung mit Projektbezug. | TimeTrackingComponent | nur Finanz |

*86 Dateien, 46671 Zeilen*

### Komponenten – `components/finance/customer-detail/*`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/finance/customer-detail/CustomerContactCard.tsx` | 131 | Karte Hauptansprechpartner. | CustomerContactCard | nur Finanz |
| `components/finance/customer-detail/CustomerDetailModal.tsx` | 245 | Kunden-Detailmodal (modular, Tabs). | CustomerDetailModal | nur Finanz |
| `components/finance/customer-detail/CustomerDocumentsTab.tsx` | 1250 | Tab Dokumente des Kunden inkl. Versand. | CustomerDocumentsTab | nur Finanz |
| `components/finance/customer-detail/CustomerHistoryTab.tsx` | 988 | Tab Historie/Aktivitäten. | CustomerHistoryTab | nur Finanz |
| `components/finance/customer-detail/CustomerInfoCard.tsx` | 429 | Karte Kundenstammdaten. | CustomerInfoCard | nur Finanz |
| `components/finance/customer-detail/CustomerInvoiceCard.tsx` | 270 | Karte Rechnungsübersicht des Kunden. | CustomerInvoiceCard | nur Finanz |
| `components/finance/customer-detail/CustomerOrdersTab.tsx` | 450 | Tab Aufträge. | CustomerOrdersTab | nur Finanz |
| `components/finance/customer-detail/CustomerWhatsAppTab.tsx` | 340 | Tab WhatsApp-Kommunikation. | CustomerWhatsAppTab | nur Finanz |
| `components/finance/customer-detail/EditContactPersonModal.tsx` | 264 | Ansprechpartner bearbeiten. | EditContactPersonModal | nur Finanz |
| `components/finance/customer-detail/index.ts` | 9 | Barrel-Export. | CustomerContactCard, CustomerDetailModal, CustomerDocumentsTab, CustomerHistoryTab, CustomerInfoCard | nur Finanz |

*10 Dateien, 4376 Zeilen*

### Komponenten – `components/finance/gobd/*`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/finance/gobd/AutoLockSettings.tsx` | 302 | Automatische Festschreibung konfigurieren. | AutoLockSettings | nur Finanz |
| `components/finance/gobd/ComplianceDashboard.tsx` | 448 | GoBD-Compliance-Übersicht. | ComplianceDashboard | nur Finanz |
| `components/finance/gobd/GoBDActionWarning.tsx` | 285 | Warnung + Hook vor Aktionen an festgeschriebenen Belegen. | GoBDActionWarning, useGoBDActionWarning | nur Finanz |
| `components/finance/gobd/GoBDSystem.tsx` | 155 | GoBD-Einstiegsseite/Container. | GoBDSystem | nur Finanz |
| `components/finance/gobd/ManualLockManager.tsx` | 411 | Manuelle Festschreibung von Zeiträumen/Belegen. | ManualLockManager | nur Finanz |
| `components/finance/gobd/SevDeskLockManager.tsx` | 255 | Festschreibungseinstellungen nach sevDesk-Vorbild (Zeitraum, Dokumenttypen). | SevDeskLockManager | nur Finanz |
| `components/finance/gobd/StornoManager.tsx` | 472 | Storno/Gutschrift für festgeschriebene Belege. | StornoManager | nur Finanz |
| `components/finance/gobd/index.ts` | 24 | Barrel-Export GoBD-Modul. | GoBDService, AutoLockSettings, ComplianceDashboard, GoBDActionWarning, useGoBDActionWarning | nur Finanz |

*8 Dateien, 2352 Zeilen*

### Komponenten – `components/finance/pdf-templates/**`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/finance/pdf-templates/DynamicTemplate.tsx` | 570 | PDF-Template „Dynamic“. | DynamicTemplate | nur Finanz |
| `components/finance/pdf-templates/ElegantTemplate.tsx` | 533 | PDF-Template „Elegant“. | ElegantTemplate | nur Finanz |
| `components/finance/pdf-templates/GeometricTemplate.tsx` | 458 | PDF-Template „Geometric“. | GeometricTemplate | nur Finanz |
| `components/finance/pdf-templates/NeutralTemplate.tsx` | 582 | PDF-Template „Neutral“. | NeutralTemplate | nur Finanz |
| `components/finance/pdf-templates/StandardTemplate.tsx` | 495 | PDF-Template „Standard“. | StandardTemplate | nur Finanz |
| `components/finance/pdf-templates/TechnicalTemplate.tsx` | 437 | PDF-Template „Technical“. | TechnicalTemplate | nur Finanz |
| `components/finance/pdf-templates/common/A4PageBreaks.tsx` | 81 | Echte Seitenumbrüche für PDF-Templates. | A4PageBreakProps, A4PageBreak, A4SectionProps, A4Section, A4PageWrapperProps | nur Finanz |
| `components/finance/pdf-templates/common/FooterText.tsx` | 61 | Fußtext-Block. | FooterText | nur Finanz |
| `components/finance/pdf-templates/common/InvoiceFooter.tsx` | 285 | Rechnungsfuß mit Firmen-/Kontakt-/Rechtsdaten. | InvoiceFooter | nur Finanz |
| `components/finance/pdf-templates/common/ItemsTable.tsx` | 268 | Positionstabelle (mehrsprachig). | ItemsTable | nur Finanz |
| `components/finance/pdf-templates/common/MultiPageWrapper.tsx` | 55 | Seite mit Footer (Mehrseiten-Wrapper). | PageWithFooter | nur Finanz |
| `components/finance/pdf-templates/common/PDFSection.tsx` | 48 | Sektion ohne Footer. | PDFSection | nur Finanz |
| `components/finance/pdf-templates/common/PageFooter.tsx` | 52 | Seitenfuß. | PageFooter | nur Finanz |
| `components/finance/pdf-templates/common/SimpleFooter.tsx` | 57 | Einfacher Footer. | SimpleFooter | nur Finanz |
| `components/finance/pdf-templates/common/TaxRulesInfo.tsx` | 64 | Steuerregel-Hinweistext im PDF. | TaxRulesInfo | nur Finanz |
| `components/finance/pdf-templates/common/TotalsDisplay.tsx` | 194 | Summenblock (Netto/USt/Brutto, Skonto). | TotalsDisplay | nur Finanz |
| `components/finance/pdf-templates/examples.tsx` | 256 | Beispiele/Mock-Daten für Templates. | BasicUsageExample, AdvancedUsageExample, MyCustomTemplate, createMockInvoiceData | nur Finanz |
| `components/finance/pdf-templates/index.ts` | 20 | Barrel-Export Templates + Hooks. | usePDFTemplateData, FooterText, ItemsTable, TaxRulesInfo, TotalsDisplay | nur Finanz |

*18 Dateien, 4516 Zeilen*

### Komponenten – `components/accounting/*`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/accounting/BookingAccountModal.tsx` | 291 | Buchungskonto anlegen/bearbeiten (656+ DATEV-Konten). | BookingAccountModal | nur Finanz |
| `components/accounting/BookingAccountsTab.tsx` | 294 | Tab Buchungskonten. | BookingAccountsTab | nur Finanz |
| `components/accounting/CostCentersTab.tsx` | 103 | Tab Kostenstellen. | CostCenter, CostCentersTab | nur Finanz |
| `components/accounting/DatevAccountCards.tsx` | 308 | DATEV-Buchungskonten als Karten. | DatevAccountCards | nur Finanz |
| `components/accounting/FinanceSettingsTab.tsx` | 412 | Finanzeinstellungen inkl. Mahnstufen-Konfiguration. | FinanceSettingsTab | nur Finanz |
| `components/accounting/NumberSequenceModal.tsx` | 291 | Nummernkreis anlegen/bearbeiten (Format, Präfix, nächste Nummer). | NumberSequenceModal | nur Finanz |
| `components/accounting/NumberSequencesTab.tsx` | 119 | Tab Nummernkreise. | NumberSequencesTab | nur Finanz |
| `components/accounting/PaymentAccountsTab.tsx` | 273 | Tab Zahlungskonten. | PaymentAccount, PaymentAccountsTab | nur Finanz |
| `components/accounting/PaymentMethodsTab.tsx` | 111 | Tab Zahlungsmethoden. | PaymentMethod, PaymentMethodsTab | nur Finanz |
| `components/accounting/TransactionMatchingTab.tsx` | 34 | Tab Transaktionszuordnung (Stub, 34 Zeilen). | TransactionMatchingTab | nur Finanz |

*10 Dateien, 2236 Zeilen*

### Komponenten – `components/invoices/*`, `components/invoice/*`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/invoice/InvoiceItemsCard.tsx` | 89 | Karte Rechnungspositionen. | InvoiceItemsCard | nur Finanz |
| `components/invoices/ServiceSelection.tsx` | 180 | Dienstleistungsauswahl für Positionen. | ExtendedServiceSelectionProps, ServiceSelection | nur Finanz |

*2 Dateien, 269 Zeilen*

### Komponenten – `components/datev/*`

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/datev/DatevAuthComponent.tsx` | 178 | DATEV OAuth-Start (/api/v1/datev/auth-url). | DatevAuthComponent | nur Finanz |
| `components/datev/DatevAuthComponentCookie.tsx` | 577 | DATEV OAuth-Variante mit Cookie-Handling. | DatevAuthComponent | nur Finanz |
| `components/datev/DatevDashboard.tsx` | 416 | DATEV-Übersicht: Verbindung, Konten, Transaktionen. | DatevDashboard | nur Finanz |
| `components/datev/DatevFlowTest.tsx` | 225 | Testkomponente OAuth-Flow/Token-Status. | DatevFlowTest | nur Finanz |
| `components/datev/DatevSandboxTest.tsx` | 381 | Testkomponente Sandbox-Verbindung. | DatevSandboxTest | nur Finanz |

*5 Dateien, 1777 Zeilen*

### Komponenten – außerhalb der Finanzordner, per Import erreicht

Hinweis: `calendar/*`, `workspace/*` und `calendar/views/*` zeigen zwar „nur Finanz“ (kein Importer außerhalb der erreichten Menge), hängen aber an geteilten Elternknoten (`CompanyCalendar`, `WorkspaceManager`, `CalendarGrid` …), die auch von Kalender-/Workspace-Seiten importiert werden – faktisch geteilt.

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/CompanyCalendar.tsx` | 432 | Firmenkalender (Aufträge, Projekte, Rechnungen als Termine). | CompanyCalendarRef, default:CompanyCalendar | geteilt (4 ext., z. B. app/dashboard/company/[uid]/calendar/page.tsx) |
| `components/InventoryComponent.tsx` | 2266 | Inventar-/Artikelverwaltung (auch Dienstleistungen). | InventoryComponent | geteilt (1 ext., z. B. app/dashboard/company/[uid]/inventory/page.tsx) |
| `components/QuickAddService.tsx` | 108 | Schnell eine Dienstleistung anlegen (/api/v1/products). | QuickAddService | nur Finanz |
| `components/avatar.tsx` | 39 | Avatar + Hook Profilbild. | useProfilePicture, Avatar, AvatarFallback, AvatarImage | geteilt (26 ext., z. B. app/dashboard/admin/workspace/[workspaceId]/page.tsx) |
| `components/calendar/BlockedDateModal.tsx` | 263 | Tage blockieren/freigeben. | BlockedDateModal | nur Finanz |
| `components/calendar/CalendarEventModal.tsx` | 1021 | Termin-Detailmodal. | CalendarEvent, CalendarEventModal | geteilt (1 ext., z. B. hooks/useCalendarEventModal.tsx) |
| `components/calendar/CalendarGrid.tsx` | 63 | Kalender-Grid. | CalendarGrid | geteilt (1 ext., z. B. components/calendar/index.ts) |
| `components/calendar/CalendarToolbar.tsx` | 452 | Kalender-Toolbar. | CalendarToolbar | geteilt (1 ext., z. B. components/calendar/index.ts) |
| `components/calendar/EventCreateModal.tsx` | 1058 | Termin anlegen. | EventCreateModal | geteilt (1 ext., z. B. components/calendar/index.ts) |
| `components/calendar/views/AgendaView.tsx` | 76 | Agenda-Ansicht. | AgendaView | nur Finanz |
| `components/calendar/views/DayView.tsx` | 318 | Tagesansicht. | DayView | nur Finanz |
| `components/calendar/views/FourDaysView.tsx` | 338 | 4-Tage-Ansicht. | FourDaysView | nur Finanz |
| `components/calendar/views/MonthView.tsx` | 179 | Monatsansicht. | MonthView | nur Finanz |
| `components/calendar/views/WeekView.tsx` | 643 | Wochenansicht. | WeekView | nur Finanz |
| `components/calendar/views/YearView.tsx` | 194 | Jahresansicht. | YearView | nur Finanz |
| `components/calendar/views/index.ts` | 6 | Barrel-Export Ansichten. | AgendaView, DayView, FourDaysView, MonthView, WeekView | nur Finanz |
| `components/inventory/NewProductModal.tsx` | 504 | Neues Produkt anlegen (aus Positions-Editor). | NewProductValues, NewProductModalProps, NewProductModal | nur Finanz |
| `components/quotes/InventorySelector.tsx` | 355 | Inventar-Auswahl für Angebote (zweite Variante). | InventorySelector | geteilt (1 ext., z. B. components/quotes/QuoteResponseForm.tsx) |
| `components/settings/TextTemplateModal.tsx` | 492 | Textvorlage anlegen/bearbeiten. | TextTemplateModal | geteilt (1 ext., z. B. app/dashboard/company/[uid]/settings/textvorlagen/page.tsx) |
| `components/texteditor/PlaceholderModal.tsx` | 254 | Platzhalter einfügen (Datum, Jahr, Monat …). | PlaceholderModal | nur Finanz |
| `components/workspace/AddTaskSlideOver.tsx` | 276 | Aufgabe anlegen (Workspace). | AddTaskSlideOver | nur Finanz |
| `components/workspace/QuickNoteDialog.tsx` | 291 | Schnellnotiz. | QuickNoteDialog | geteilt (1 ext., z. B. components/UserHeader.tsx) |
| `components/workspace/RichTextEditor.tsx` | 1107 | TipTap-Editor (Workspace). | RichTextEditor | geteilt (1 ext., z. B. components/admin-workspace/AdminTaskDetailSlider.tsx) |
| `components/workspace/TaskDetailSlider.tsx` | 1622 | Aufgaben-Detail. | TaskDetailSlider | nur Finanz |
| `components/workspace/WorkspaceBoard.tsx` | 1028 | Kanban-Board. | WorkspaceBoard | geteilt (1 ext., z. B. app/dashboard/company/[uid]/workspace/[workspaceId]/page.tsx) |
| `components/workspace/WorkspaceCalendar.tsx` | 481 | Workspace-Kalender. | WorkspaceCalendar | nur Finanz |
| `components/workspace/WorkspaceDetailSlider.tsx` | 489 | Workspace-Detail. | WorkspaceDetailSlider | nur Finanz |
| `components/workspace/WorkspaceFilters.tsx` | 238 | Filter. | WorkspaceFilters | nur Finanz |
| `components/workspace/WorkspaceList.tsx` | 418 | Listenansicht. | WorkspaceList | nur Finanz |
| `components/workspace/WorkspaceManager.tsx` | 386 | Workspace-Verwaltung (von ProjectsComponent importiert). | WorkspaceManager | geteilt (1 ext., z. B. app/dashboard/company/[uid]/workspace/page.tsx) |

*30 Dateien, 15397 Zeilen*

### Hooks

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `hooks/pdf/useDocumentTranslation.ts` | 402 | Übersetzungen für Belegtexte (mehrsprachige PDFs). | DocumentTranslations, useDocumentTranslation, translateStandardFooterText | nur Finanz |
| `hooks/pdf/usePDFTemplateData.ts` | 746 | Bereitet Belegdaten für PDF-Templates auf (Adresse, Kundennummer, Settings). | useCustomerNumber, DocumentSettings, PDFTemplateProps, ParsedAddress, ProcessedPDFData | geteilt (1 ext., z. B. services/pdfGenerationService.ts) |
| `hooks/pdf/useSimplePagination.ts` | 34 | Einfache Seitenaufteilung. | SimplePageInfo, useSimplePagination | nur Finanz |
| `hooks/useCompanySettings.ts` | 239 | Firmeneinstellungen laden + calculateVAT. | CompanySettings, useCompanySettings, calculateVAT | geteilt (1 ext., z. B. components/taskilo-advertising/CampaignCreationForm.tsx) |
| `hooks/useNextInvoiceNumber.ts` | 62 | Nächste Rechnungsnummer für Platzhalter. | useNextInvoiceNumber | nur Finanz |
| `hooks/useNextStornoNumber.ts` | 62 | Nächste Stornonummer für Platzhalter. | useNextStornoNumber | nur Finanz |
| `hooks/useOverdueInvoices.ts` | 97 | Überfällige Rechnungen laden (status=sent,overdue). | useOverdueInvoices | nur Finanz |
| `hooks/useTemplatePageDetection.ts` | 226 | Erkennt ein-/mehrseitige Templates. | UseTemplatePageDetectionOptions, UseTemplatePageDetectionResult, useTemplatePageDetection, useTemplatePageType, useTemplateRecommendations | nur Finanz |

*8 Dateien, 1868 Zeilen*

### Services

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `services/TextTemplateService.ts` | 289 | CRUD Textvorlagen (/text-templates). | TextTemplateService | geteilt (2 ext., z. B. app/dashboard/company/[uid]/settings/textvorlagen/page.tsx) |
| `services/WorkspaceService.ts` | 240 | Workspace-API (FastAPI). | WorkspaceMember, Workspace, WorkspaceBoardColumn, WorkspaceTask, WorkspaceService | geteilt (6 ext., z. B. app/dashboard/company/[uid]/workspace/[workspaceId]/edit/page.tsx) |
| `services/autoEInvoiceService.ts` | 302 | Automatische E-Rechnungs-Erzeugung, Peppol-Profil, Compliance-Score. | AutoEInvoiceConfig, AutoEInvoiceService | nur Finanz |
| `services/bookingAccountService.ts` | 132 | Buchungskonten laden (custom + DATEV-Standard). | BookingAccount, BookingAccountData, BookingAccountService | nur Finanz |
| `services/businessReportService.ts` | 1455 | Kennzahlen/Berichte (Finance, Inventory, HR, TimeTracking, Orders). | FinanceKPIs, InventoryKPIs, HRKPIs, TimeTrackingKPIs, OrdersKPIs | nur Finanz |
| `services/customerMatchingService.ts` | 38 | Kundenabgleich: Kundennummer > E-Mail > Name. | CustomerMatchingService | nur Finanz |
| `services/customerService.ts` | 270 | CRUD Kunden. | CustomerService | geteilt (3 ext., z. B. app/dashboard/company/[uid]/inventory/[itemId]/edit/page.tsx) |
| `services/datevAuswertungsService.ts` | 1591 | DATEV-Auswertungen: BWA, SuSa, Buchungen, Kontenrahmen. | DatevKonto, Buchung, BWAZeile, BWAData, SuSaKonto | nur Finanz |
| `services/datevCardService.ts` | 386 | DATEV-Konto-Karten (Anzeigenamen, Kategorien). | DatevCard, DatevCardService | geteilt (2 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `services/datevService.ts` | 309 | DATEV-Integration client-side (Organisation, Konten, Transaktionen, Export-Jobs). | DatevOrganization, DatevAccount, DatevTransaction, DatevDocument, DatevExportJob | geteilt (5 ext., z. B. components/datev/DatevDocumentSync.tsx) |
| `services/deliveryNoteService.ts` | 378 | CRUD Lieferscheine + Vorlagen/Einstellungen. | DeliveryNoteTemplate, DeliveryNote, DeliveryNoteItem, DeliveryNoteLayoutTemplate, DeliveryNoteSettings | nur Finanz |
| `services/eInvoiceService.ts` | 741 | XRechnung/ZUGFeRD erzeugen und parsen (fast-xml-parser), TSE-Daten. | EInvoiceData, EInvoiceSettings, XRechnungMetadata, ZUGFeRDMetadata, TSEData | nur Finanz |
| `services/eInvoiceTransmissionService.ts` | 381 | E-Rechnungs-Übertragung/Protokolle (UStG §14, EN 16931). | EInvoiceTransmissionLog, EInvoiceRecipientSettings, EInvoiceComplianceCheck, EInvoiceTransmissionService | nur Finanz |
| `services/favoriteDatevAccountService.ts` | 82 | Favoriten-DATEV-Konten. | FavoriteDatevAccount, FavoriteDatevAccountService | nur Finanz |
| `services/financeService.ts` | 462 | Finanzstatistik, Payments, Expenses, Orders, PDF-Ablage. | FinanceStats, PaymentRecord, ExpenseRecord, OrderRecord, FinanceService | nur Finanz |
| `services/firestoreInvoiceService.ts` | 50 | Rechnungs-API (Name historisch, ruft heute FastAPI /invoices inkl. Storno, next-number). | InvoiceService, firestoreInvoiceService | nur Finanz |
| `services/fixedAssetService.ts` | 628 | Anlagenbuchhaltung nach §7 EStG (AfA-Methoden, Abschreibungsplan). | DepreciationMethod, AssetStatus, FixedAsset, AssetCategory, DepreciationSchedule | nur Finanz |
| `services/gobdService.ts` | 212 | GoBD-Festschreibung (automatisch beim Versand, Sperren, Audit). | GoBDService | nur Finanz |
| `services/inventoryService.ts` | 544 | Inventar/Artikel, Einheiten, Lagerbewegungen. | WeightVolumeUnit, SalesUnit, PackagingUnit, InventoryItem, InventoryStats | geteilt (7 ext., z. B. app/dashboard/company/[uid]/inventory/[itemId]/edit/page.tsx) |
| `services/inventurService.ts` | 828 | Inventur-Durchführung (Typen, Status, Signaturen). | InventoryType, InventoryStatus, InventoryItemStatus, InventurSignature, Inventur | geteilt (5 ext., z. B. app/dashboard/company/[uid]/inventory/inventur/[inventurId]/drucken/page.tsx) |
| `services/invoice-status.service.ts` | 78 | Rechnungsstatus aktualisieren. | InvoiceStatusUpdate, InvoiceStatusService | geteilt (2 ext., z. B. app/dashboard/company/[uid]/banking/accounts/page.tsx) |
| `services/numberSequenceService.ts` | 183 | Nummernkreise je Typ (Rechnung, Kunde, Storno …) mit Fallback. | NumberSequence, NumberSequenceService | nur Finanz |
| `services/paymentAccountService.ts` | 101 | Zahlungskonten CRUD. | PaymentAccount, PaymentAccountService | nur Finanz |
| `services/pdf/InvoicePDFTemplate.ts` | 1010 | Eigenständige jsPDF-Rechnungserzeugung mit Logo/Footer. | InvoicePDFTemplate | nur Finanz |
| `services/personalService.ts` | 2810 | Personalverwaltung (Mitarbeiter, Urlaub, Feedback, Dokumente) – von Zeiterfassung genutzt. | Employee, VacationRequest, WorkSettings, VacationSettings, EmployeeFeedback | geteilt (35 ext., z. B. app/dashboard/company/[uid]/personal/absence/page.tsx) |
| `services/quoteService.ts` | 632 | CRUD Angebote + Einstellungen. | QuoteItem, Quote, QuoteSettings, QuoteService | nur Finanz |
| `services/recurringInvoiceService.ts` | 316 | Wiederkehrende Rechnungen (Intervall, Generierung, Statistik). | RecurringInvoiceTemplate, RecurringInvoiceItem, CreateRecurringInvoiceData, GeneratedRecurringInvoice, RecurringInvoiceService | nur Finanz |
| `services/serviceUsageTrackingService.ts` | 141 | Nutzungs-Tracking von Dienstleistungen/Paketen. | ServiceUsageRecord, ServiceUsageTrackingService | nur Finanz |
| `services/storageLimitService.ts` | 151 | Speicherlimits (Free 500 MB / Paid). | LimitCheckResult, CancellationConsent, StorageLimitService | geteilt (1 ext., z. B. components/storage/CancelPlanModal.tsx) |
| `services/taxService.ts` | 1097 | Steuermodul: UStVA, EÜR, GuV, BWA, ELSTER-Daten. | TaxReport, TaxCalculation, TaxSettings, TaxPeriod, TaxValidation | geteilt (1 ext., z. B. components/dashboard/VatPreRegistrationCard.tsx) |
| `services/timeTrackingService.ts` | 553 | Zeiterfassung und Projekte (sevdesk-Vorbild). | TimeEntry, Project, Task, TimeTrackingReport, TimeTrackingSettings | nur Finanz |
| `services/transaction-link.service.ts` | 370 | Transaktion↔Dokument-Verknüpfungen. | TransactionLink, TransactionLinkService | geteilt (2 ext., z. B. app/dashboard/company/[uid]/banking/accounts/page.tsx) |
| `services/types.ts` | 34 | Basis-Typen für Service-/Inventar-Items. | BaseItem, ServiceItem, InventoryCategoryExtended | nur Finanz |
| `services/usageTrackingService.ts` | 199 | Storage-/DB-Nutzungs-Tracking. | UsageTrackingService, StorageTrackingService | nur Finanz |
| `services/whatsapp-notifications.service.ts` | 395 | WhatsApp-Automatisierungen (Rechnung/Mahnung). | WhatsAppNotificationService | nur Finanz |
| `services/whatsapp.service.ts` | 419 | WhatsApp Click-to-Chat + Meta API. | WhatsAppMessage, WhatsAppConnection, WhatsAppService, WhatsAppTemplates | geteilt (2 ext., z. B. app/dashboard/company/[uid]/whatsapp/page.tsx) |
| `services/xrechnungParserService.ts` | 440 | XRechnung/ZUGFeRD-XML → InvoiceData. | XRechnungParserService | nur Finanz |

*37 Dateien, 18247 Zeilen*

### Utils

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `utils/a4-page-utils.ts` | 214 | A4-Maße, Seitenzahl/-umbrüche, Zoom. | A4Dimensions, A4_DIMENSIONS, convertA4Dimensions, calculatePageCount, calculatePageBreaks | nur Finanz |
| `utils/api/companyApi.ts` | 195 | Company-/Kunden-/Rechnungs-API-Helfer (ersetzt Firebase-Calls). | getCompanyData, updateCompanyTemplate, getCustomers, createCustomer, updateCustomer | nur Finanz |
| `utils/pdf-page-styles.ts` | 150 | CSS für PDF-Seitenumbrüche. | PDF_PAGE_STYLES, PDF_PAGE_CLASSES | nur Finanz |
| `utils/placeholderSystem.ts` | 800 | Legacy-Platzhalterersetzung für Textvorlagen (800 Zeilen). | replacePlaceholders | nur Finanz |
| `utils/placeholders/aliases.ts` | 144 | Aliase für Platzhalternamen. | PLACEHOLDER_ALIASES, normalizePlaceholderName, createAliasRegistry, validatePlaceholderName, default | nur Finanz |
| `utils/placeholders/categories/company.ts` | 156 | Firmen-Platzhalter. | companyPlaceholders | nur Finanz |
| `utils/placeholders/categories/customer.ts` | 254 | Kunden-Platzhalter. | customerPlaceholders | nur Finanz |
| `utils/placeholders/categories/dateTime.ts` | 192 | Datums-/Zeit-Platzhalter. | dateTimePlaceholders | nur Finanz |
| `utils/placeholders/categories/invoice.ts` | 224 | Rechnungs-Platzhalter. | invoicePlaceholders | nur Finanz |
| `utils/placeholders/categories/quote.ts` | 131 | Angebots-Platzhalter. | quotePlaceholders | nur Finanz |
| `utils/placeholders/index.ts` | 14 | Barrel-Export Platzhalter. | companyPlaceholders, customerPlaceholders, dateTimePlaceholders, invoicePlaceholders, quotePlaceholders | nur Finanz |
| `utils/placeholders/placeholderEngine.ts` | 230 | Platzhalter-Engine (ersetzen, validieren, auflisten). | replacePlaceholders, getAvailablePlaceholders, getPlaceholdersByCategory, validatePlaceholder, isValidPlaceholder | nur Finanz |
| `utils/template-page-detector.ts` | 212 | Template ein-/mehrseitig erkennen. | TemplatePageType, TemplatePageInfo, TEMPLATE_PAGE_DEFINITIONS, getTemplatePageType, isMultiPageTemplate | nur Finanz |
| `utils/vatValidation.ts` | 317 | USt-IdNr.-Validierung für EU-Länder. | VATValidationResult, validateVATNumber, getVATFormat, detectCountryFromVAT, formatVATNumber | nur Finanz |

*14 Dateien, 3233 Zeilen*

### Lib

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `lib/api-client.ts` | 1 | Re-Export api/apiClient aus @tasko/shared. | api, apiClient | geteilt (226 ext., z. B. app/dashboard/admin/chatbot-knowledge/page.tsx) |
| `lib/auth-storage.ts` | 8 | Re-Export Token-Storage aus @tasko/shared. | clearAuth, getTokens, isAuthenticated, refreshAccessToken, StoredTokens | geteilt (24 ext., z. B. app/dashboard/admin/modules/page.tsx) |
| `lib/datev-token-manager.ts` | 335 | DATEV-OAuth-Token-Verwaltung (Client + Server). | DatevTokenManager | geteilt (5 ext., z. B. components/datev/DatevDebugComponent.tsx) |
| `lib/document-utils.ts` | 351 | Belegarten-Konfiguration (invoice, quote, reminder, credit-note, cancellation, delivery-note, order-confirmation), Farben, Zahlungsziele. | DocumentType, DocumentTypeConfig, DocumentTypeMapping, DOCUMENT_TYPE_MAPPINGS, DOCUMENT_TYPE_CONFIGS | nur Finanz |
| `lib/file-upload.ts` | 163 | Datei-Upload über Backend (ersetzt Firebase Storage). | UploadOptions, UploadResult, uploadFile, uploadMultipleFiles, deleteFile | nur Finanz |
| `lib/finapi-config.ts` | 86 | finAPI Sandbox/Production-Konfiguration. | FINAPI_CONFIG, getFinAPICredentialType, getFinApiBaseUrl, getFinApiCredentials, buildFinApiAuthHeader | geteilt (11 ext., z. B. app/dashboard/company/[uid]/banking/accounts/page.tsx) |
| `lib/server-api.ts` | 1 | Re-Export serverApi aus @tasko/shared. | serverApi | geteilt (7 ext., z. B. app/dashboard/company/[uid]/recruiting/[jobId]/page.tsx) |
| `lib/storage.ts` | 48 | Supabase-Storage-Dateien öffnen (public/private). | openStorageFile | nur Finanz |
| `lib/userPreferences.ts` | 198 | Default-Template/Nutzerpräferenzen. | UserPreferences, getCompanyDefaultTemplate, UserPreferencesService | geteilt (1 ext., z. B. app/dashboard/company/[uid]/settings/templates/page.tsx) |
| `lib/utils.ts` | 60 | formatCurrency/formatDate/cn. | formatCurrency, formatDate, formatDateTime, cn | geteilt (31 ext., z. B. app/dashboard/company/[uid]/personal/layout.tsx) |
| `lib/whatsapp.ts` | 37 | WhatsApp Click-to-Chat-Link. | createClickToChatLink | nur Finanz |

*11 Dateien, 1288 Zeilen*

### Typen

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `components/calendar/types.ts` | 41 | Kalender-Typen. | CalendarEvent, AvailabilityOverlay, CalendarViewProps | nur Finanz |
| `types/availability.ts` | 86 | Verfügbarkeits-Typen (Kalender). | BlockedDate, RecurringPattern, WorkingHours, CompanyAvailability, AvailabilityResponse | geteilt (1 ext., z. B. services/availabilityService.ts) |
| `types/banking.ts` | 264 | Banking-Typen (Konten, Transaktionen, Reconciliation). | BankAccount, BankTransaction, ModalTransaction, BankConnection, BankImportSettings | geteilt (1 ext., z. B. types/index.ts) |
| `types/formData.ts` | 39 | CreateInvoiceFormData. | CreateInvoiceFormData | nur Finanz |
| `types/gobdTypes.ts` | 118 | GoBD-Typen (Lock, Audit, Period, Compliance). | GoBDLockStatus, GoBDAuditEntry, GoBDDocument, GoBDPeriodLock, GoBDSettings | nur Finanz |
| `types/invoiceTypes.ts` | 563 | Zentraler Rechnungsdatentyp (Status draft/finalized/sent/paid/overdue/cancelled/storno), Nummerierung, Storno, Status-Helfer. | InvoiceItem, InvoiceData, InvoiceNumbering, StornoInvoiceData, GermanInvoiceService | geteilt (2 ext., z. B. services/invoiceValidation.ts) |
| `types/service.ts` | 96 | Dienstleistungs-/Paket-Typen. | InvoiceService, InvoiceServiceDraft, ServiceSelectionProps, AddonItem, ServicePackage | geteilt (4 ext., z. B. components/service/ServiceCreate.tsx) |
| `types/taxRules.ts` | 41 | Steuerregel-Typen. | TaxRuleCategory, TaxRuleType, TaxRule, TaxCalculation | geteilt (3 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `types/textTemplates.ts` | 359 | Textvorlagen-Typen (sevDesk-ähnlich). | TextTemplateCategory, ObjectType, TextTemplateType, TextTemplate, DOCUMENT_USAGE_OPTIONS | geteilt (3 ext., z. B. app/dashboard/company/[uid]/settings/textvorlagen/page.tsx) |
| `types/types.ts` | 269 | Allgemeine Typen (Profil, Company-API, InvoiceApiResponse). | InvoiceApiResponse, CompanyApiResponse, UserProfileData, SavedAddress, SavedPaymentMethod | geteilt (12 ext., z. B. app/dashboard/company/[uid]/provider/[id]/components/ProviderBookingModal.tsx) |
| `utils/placeholders/types.ts` | 68 | Platzhalter-Typen und Standardnamen. | DocumentType, PlaceholderContext, PlaceholderFunction, PlaceholderRegistry, PlaceholderCategory | nur Finanz |

*11 Dateien, 1944 Zeilen*

### Daten / Konstanten / Config

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `config/taxRules.ts` | 123 | Steuerregel-Katalog (§13b, §18b Reverse Charge, EU, Drittland …). | TAX_RULES, getTaxRule, getCategoryLabel | geteilt (2 ext., z. B. app/dashboard/company/[uid]/banking/receipt/page.tsx) |
| `constants/countries.ts` | 198 | Länderliste. | COUNTRIES, Country | nur Finanz |
| `data/complete-datev-accounts.ts` | 1490 | Vollständige DATEV-Buchungskonten (HTML-Export). | default:COMPLETE_DATEV_ACCOUNTS | nur Finanz |
| `data/currencies.ts` | 198 | ISO-4217-Währungscodes. | CURRENCY_CODES, CurrencyInfo, getAllCurrencies | nur Finanz |
| `data/datev-category-mapping-complete.ts` | 3160 | DATEV-Kategorie-Mappings (generiert). | DatevCategoryMapping, DATEV_CATEGORY_MAPPINGS, findMappingByAccountNumber, getMappingsByCategory, getAllCategories | nur Finanz |
| `data/datev-income-mapping-complete.ts` | 1339 | DATEV-Einnahmen-Mappings. | DatevIncomeMapping, incomeKategorienBeschreibungen, findIncomeMappingByAccountNumber, getIncomeMappingsByCategory, getAllIncomeCategories | nur Finanz |

*6 Dateien, 6508 Zeilen*

### Kontexte / Provider

| Datei (`apps/frontend/app/src/…`) | Zeilen | Zweck | Hauptexport(e) | Nutzung |
|---|---:|---|---|---|
| `contexts/NewAuthContext.tsx` | 6 | Re-Export Auth-Kontext aus @tasko/shared. | NewAuthContextType, NewAuthProvider, ProtectedRoute, useNewAuth | geteilt (127 ext., z. B. app/dashboard/DashboardRedirectClient.tsx) |
| `providers/WebSocketProvider.tsx` | 175 | Authentifizierte WebSocket-Verbindung (Realtime). | WsEvent, useWebSocketContext, WebSocketProvider | geteilt (2 ext., z. B. app/providers.tsx) |

*2 Dateien, 181 Zeilen*

### Doku

| Datei | Zeilen | Zweck |
|---|---:|---|
| `components/finance/customer-detail/README.md` | 175 | Doku der customer-detail-Komponenten. |
| `components/finance/pdf-templates/README.md` | 262 | Doku der modularen PDF-Template-Struktur. |

## `apps/frontend/web` – Einordnung (Marketing-/Marktplatz-App `@taskilo/web`)

Kein Finanzwerkzeug. Die App ist die öffentliche Marketing-/Marktplatz-Seite (Routen `features`, `pricing`, `blog`, `marketplace`, `jobs`, `impressum` …). Finanzbezug nur:

| Datei | Zeilen | Befund |
|---|---:|---|
| `web/src/app/features/accounting/page.tsx` | 641 | Marketing-Feature-Seite „Buchhaltung“ (framer-motion Karten); verlinkt auf `/dashboard/company/demo/finance/{invoices,einvoices,reminders,expenses,accounting,cashbook}` der App, beschreibt XRechnung/ZUGFeRD, Mahnwesen, DATEV, GoBD, Kleinunternehmer. |
| `web/src/components/finance/OverdueInvoicesAlert.tsx` | 114 | Kopie der App-Komponente, im `UserHeader.tsx` der web-App eingebunden. |
| `web/src/components/finance/InvoiceTemplates.ts` | 6 | Rest-Stub. |
| `web/src/hooks/useOverdueInvoices.ts` | 97 | Kopie des App-Hooks; einzige Abweichung: Query-Parameter `companyId/orderBy/order` statt `company_id/order_by/order_dir` (Zeile 49). |
| `web/src/types/invoiceTypes.ts` | 563 | Byte-identisch zur App-Datei (`diff -q` ohne Ausgabe). |
| `web/src/utils/placeholders/categories/invoice.ts` | 230 | Kopie des Platzhalter-Moduls. |
| `web/src/components/subcategory-forms/BuchhaltungForm.tsx` | 298 | Marktplatz-Anfrageformular für die Dienstleistungskategorie „Buchhaltung“ – kein Buchhaltungswerkzeug. |

## Angrenzend, NICHT über Importe aus der Startmenge erreicht (zur Vollständigkeit, nicht im Zähler)

Diese Dateien importieren Finanz-Module (umgekehrte Richtung) oder gehören fachlich dazu, hängen aber unter anderen Routen:

| Datei | Zeilen | Bezug |
|---|---:|---|
| `app/dashboard/company/[uid]/banking/**` (10 Dateien) | 8.557 | Banking-Bereich (Konten, Belege, unvollständige Transaktionen); nutzt `invoice-status.service`, `transaction-link.service`, `taxRules`, `datevCardService`. |
| `services/pdfGenerationService.ts` | 457 | importiert `usePDFTemplateData`, `invoiceTypes`. |
| `services/invoiceValidation.ts` | 134 | importiert `invoiceTypes`, `taxRules`. |
| `utils/datevCategoryMapper.ts` | 655 | importiert `datevCardService`. |
| `hooks/useTaxCalculation.ts` | 41 | importiert `config/taxRules`. |
| `components/dashboard/VatPreRegistrationCard.tsx` | 241 | importiert `taxService`. |
| `hooks/useTextTemplates.ts`, `settings/textvorlagen/page.tsx`, `settings/templates/page.tsx` | 74 / 340 / 235 | Textvorlagen-/Template-Einstellungen außerhalb `finance/`. |
| `services/payment/PlatformFeeInvoiceService.ts`, `MarketplacePublishingFeeInvoiceService.ts` | 521 / 493 | Plattform-Gebührenrechnungen (jsPDF) – Marktplatz-Abrechnung, nicht das Buchhaltungswerkzeug. |

## Externe Abhängigkeiten der erreichten Menge (Import-Stellen)

`react` 236 · `@iconify/react` 174 · `@tasko/ui` 167 · `next` 96 · `sonner` 96 · `date-fns` 34 · `@tiptap/*` ~40 · `@tasko/shared` 5 · `jspdf` 3 · `react-pdf` 2 · `@radix-ui/react-dialog` 2 · je 1: `jszip`, `html2canvas`, `recharts`, `heic2any`, `pdfjs-dist`, `validate-steuernummer`, `fast-xml-parser`, `react-dnd`, `@hello-pangea/dnd`, `@fullcalendar/core`, `react-hot-toast`.
