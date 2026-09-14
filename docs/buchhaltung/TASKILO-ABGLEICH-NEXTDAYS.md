# Abgleich Finanz-/Buchhaltungswerkzeug: taskilo-platform (alt) → NextDays (neu)

Stand 11.09.2026. Nur gelesen, nichts geändert. Alle Zeilenzahlen per `wc -l`,
Zustände per `cmp`/`diff`, Existenz per `ls`/`find`. Basis alt:
`/Users/andystaudinger/taskilo-platform/apps/frontend/app/src` (kurz `ALT/`),
Basis neu: `/Users/andystaudinger/NextDays/web` (kurz `NEU/`).

## Zusammenfassung in Zahlen

| Kategorie | Anzahl |
|---|---|
| Neue Dateien im Untersuchungsbereich (finance/**, buchhaltung/**, inventory/**, 3 Services/Utils/Hooks) | **63** |
| davon byte-**identisch** mit dem alten Gegenstück | **5** |
| davon **angepasst** (namensgleiches Gegenstück, Diff) | **40** |
| davon **stark umgebaut** (aus alter Seite/Komponente herausgelöst, anderer Dateiname) | **14** |
| davon **kein Gegenstück** (NextDays-eigene Neuentwicklung) | **4** |
| Alte Finanz-/DATEV-Komponenten/Services/Libs OHNE Gegenstück im neuen Projekt | **123 Dateien, 58 276 Zeilen** |
| Alte Finanz-/DATEV-**Seiten** (page.tsx/layout.tsx) ohne Gegenstück | **61 Seiten, 63 756 Zeilen** (2 von 63 Seiten sind portiert) |
| Frontend-Aufrufe **ins Leere** (direkt in den Finanzdateien) | **13 Pfade / 21 Aufrufstellen** |
| Aufrufe ins Leere in den davon importierten Services (zweite Ebene) | **9 Pfadfamilien / 23 Aufrufstellen** |
| **Tote Importe** (Modul existiert nicht) | **0** von 49 geprüften Zielen + 2 Aliassen |

Was sich durchgängig geändert hat (in allen 40 „angepasst"-Dateien dieselben Muster):
1. **i18n**: jeder feste deutsche Text → `useTranslations('finance')`/`useLocale()` (next-intl); `de-DE` in `toLocaleDateString`/`Intl.NumberFormat` → `locale`.
2. **Währung** (Wurzel 4): lokale `formatCurrency`-Kopien mit `currency: 'EUR'` entfernt → `formatCurrency(betrag, data.currency)`/`currencySymbol` aus `@/lib/currency`; Vorgaben `currency: 'EUR'` → `''`.
3. **Branding**: Taskilo-Grün `#14ad9f` → `#b82028`/`text-accent`/`var(--accent)`; „Taskilo" aus Kommentaren gestrichen; Test-Fallbacks („andy staudinger", „Sellin", „Köln") aus PageFooter entfernt.
4. **Steuersatz** (Wurzel 4): `'19'`-Ersatzwerte entfernt (useCompanySettings, NewProductModal).
5. **NICHT geändert**: UI-Quelle bleibt `@tasko/ui` (alt wie neu; im neuen Repo per tsconfig-Alias auf `web/vendor/tasko-ui/index.ts`, NICHT auf `@nextdays/ui`). Kein Firebase→Supabase-Umbau nötig: die übernommenen Komponenten riefen schon im alten Projekt den `api-client` auf; die einzigen „firestore"-Treffer sind der Modulname `services/firestoreInvoiceService.ts` (existiert neu).

---

## 1. Neue Dateien → altes Gegenstück

Diff-Zahl = geänderte Zeilen (`diff | grep -c '^[<>]'`). „i18n n" = Zahl neuer Zeilen mit `t(`/`useTranslations`.

### 1a. `web/components/finance/*.tsx` (oberste Ebene)

| Neue Datei | Alte Datei | Zeilen neu | Zeilen alt | Zustand | Was geändert wurde |
|---|---|---|---|---|---|
| AddCustomerModal.tsx | components/finance/AddCustomerModal.tsx | 1130 | 1045 | angepasst (diff 329) | Reine i18n-Umstellung (101 t()-Zeilen); Logik unverändert. |
| BookingAccountSelectionModal.tsx | components/finance/BookingAccountSelectionModal.tsx | 268 | 264 | angepasst (84) | i18n; 2 EUR/de-DE-Hardcodes → `formatCurrency` aus lib/currency. |
| EmailDialog.tsx | components/finance/EmailDialog.tsx | 182 | 171 | angepasst (71) | i18n; EUR-Hardcode raus. Ruft weiter `fetch('/api/v1/send-invoice-email')` (existiert nicht, s. §3). |
| EmailSendModal.tsx | components/finance/EmailSendModal.tsx | 1275 | 1242 | angepasst (313) | i18n (87); 7 Diff-Zeilen an API-Aufrufen (Pfade unverändert, weiterhin `/api/v1/finance/customers`, `/api/v1/email/send-document` — beide ins Leere). |
| FooterTextEditor.tsx | components/finance/FooterTextEditor.tsx | 621 | 598 | angepasst (123) | Nur i18n (36). |
| HeaderTextEditor.tsx | components/finance/HeaderTextEditor.tsx | 578 | 564 | angepasst (96) | Nur i18n (26). |
| ImportXRechnungDialog.tsx | components/finance/ImportXRechnungDialog.tsx | 489 | 458 | angepasst (115) | i18n (40); `fetch('/api/v1/expenses')` unverändert (ins Leere). |
| InvoiceHeaderTextSection.tsx | components/finance/InvoiceHeaderTextSection.tsx | 85 | 83 | angepasst (8) | i18n (2 Labels), `text-[#14ad9f]` → `text-accent`. |
| InvoiceListView.tsx | components/finance/InvoiceListView.tsx | 824 | 816 | angepasst (168) | i18n (65 Status-/Spaltentexte); lokale `formatCurrency` mit `EUR`/`de-DE` entfernt → `@/lib/currency`. |
| InvoiceTemplates.tsx | components/finance/InvoiceTemplates.tsx | 144 | 144 | angepasst (4) | Nur Standardfarbe `#14ad9f` → `var(--accent)` (2 Stellen). |
| LivePreviewModal.tsx | components/finance/LivePreviewModal.tsx | 1470 | 1345 | angepasst (377) | i18n (83); sonst gleich. |
| NewCategoryModal.tsx | components/finance/NewCategoryModal.tsx | 193 | 191 | angepasst (66) | i18n (20); `/api/v1/categories`-Aufruf entfernt (Kommentar: lief immer in 404). |
| NewCustomerModal.tsx | components/finance/NewCustomerModal.tsx | 2090 | 1989 | angepasst (615) | i18n (180); `currency: 'EUR'` → `''`, `currencySymbol/formatCurrency` + `WAEHRUNGS_CODES`; `/api/v1/categories`-Laden entfernt; Farben → `text-accent`; Typen nach `kunde-anlegen/typen.ts` ausgelagert (Ringschluss). |
| PDFTemplates.tsx | components/finance/PDFTemplates.tsx | 127 | 127 | **identisch** | — |
| SelectBankingTransactionModal.tsx | components/finance/SelectBankingTransactionModal.tsx | 894 | 839 | angepasst (241) | i18n (58); neue Prop `invoiceCurrency` (kein Cross-Currency-Match); Transaktionswährung mitgeführt statt €; 18 `console.log` entfernt. finapi-Pfade unverändert (ins Leere). |
| SendDocumentModal.tsx | components/finance/SendDocumentModal.tsx | 2859 | 2763 | angepasst (452) | i18n (120); 1 EUR-Hardcode raus. `collectionName='reminders'` → `/api/v1/reminders/...` ins Leere. |
| SimplePDFViewer.tsx | components/finance/SimplePDFViewer.tsx | 207 | 202 | angepasst (33) | i18n (14); `NativeSelect` aus `@nextdays/ui/native-select` (einzige Datei, die @nextdays/ui nutzt). |
| StornoInvoice.tsx | components/finance/StornoInvoice.tsx | 469 | 414 | angepasst (269) | i18n (60); EUR/de-DE raus; neuer Status `finalized`; `stornoPreviewRef` für PDF-Download über `/api/v1/generate-pdf-single`. |
| TaxRuleSelector.tsx | components/finance/TaxRuleSelector.tsx | 201 | 202 | angepasst (57) | Nur i18n (22). |
| create-invoice-page.tsx | app/dashboard/company/[uid]/finance/invoices/create/page.tsx | 6 | 5380 | **stark umgebaut** | Fassade `export { default } from './create-invoice/container'`; die 5380-Zeilen-Seite wurde in 11 Module zerlegt (s. 1b). Nachweis: `CreateQuotePage`, `isManualDateChangeRef`, `handleValidUntilChange`, `CompanyDocument`, `getStepValue`, `PreviewTemplateData` stehen in der alten Seite (Z. 85/148/171/299/1144/1191). |
| invoices-client.tsx | app/dashboard/company/[uid]/finance/invoices/page.tsx | 157 | 199 | **stark umgebaut** | Client-Wrapper um InvoiceListView + ImportXRechnungDialog (wie alte Seite); `companyId` als Prop aus NextDays-Session statt URL-`uid`; `useRealtime`-Abo hinzu; UI `@tasko/ui`. |
| kunde-anlegen/typen.ts | components/finance/NewCustomerModal.tsx (Inline-Typen) | 201 | — | **stark umgebaut** | `ExtendedFormData`, `SubTabType`, `createDefaultAddress` … aus dem alten Modal herausgelöst (dort inline, per grep belegt). |

### 1b. `web/components/finance/create-invoice/` — Zerlegung der alten Seite `finance/invoices/create/page.tsx` (5380 Z.)

| Neue Datei | Zeilen | Herkunft laut Kopfkommentar + Belegen |
|---|---|---|
| calc.ts | 124 | `generateNumberPreview`, `syncGrossFromNet` (alt Z. 709/722), `computeTotals` |
| container.tsx | 759 | `export default function CreateQuotePage()` (alt Z. 299); 39 statt 67 `useState` |
| general-info-card.tsx | 870 | Kopfbereich/„Allgemeine Angaben" |
| invoice-modals.tsx | 756 | Banner, Compliance-Sheet, Modals |
| items-card.tsx | 789 | Positionen-Card |
| preview-data.ts | 472 | `buildPreviewData`/`buildInvoiceDataForPreview` |
| secondary-cards.tsx | 307 | Fußtext, Mehr-Optionen, Summen, Notizen |
| types.ts | 201 | `CompanyDocument`, `getStepValue`, `PreviewTemplateData` (alt Z. 85–171). Hinweis: namensgleich `ALT/types/types.ts` (269 Z.) ist inhaltlich unverwandt (diff 452 = komplett). |
| use-invoice-actions.ts | 1232 | Handler inkl. `isManualDateChangeRef` (alt Z. 1144) |
| use-invoice-loaders.ts | 547 | Lade-Effekte |
| use-item-popovers.ts | 160 | Popover-Cluster |
| **Summe** | **6217** | vs. 5380 alt (Aufteilungs-Overhead + i18n) — Zustand: **stark umgebaut**, 11 Dateien |

### 1c. `web/components/finance/gobd/`

| Neue Datei | Alte Datei | Neu | Alt | Zustand | Änderung |
|---|---|---|---|---|---|
| AutoLockSettings.tsx | gobd/AutoLockSettings.tsx | 305 | 302 | angepasst (67) | i18n (28) |
| ComplianceDashboard.tsx | gobd/ComplianceDashboard.tsx | 485 | 448 | angepasst (123) | i18n (44) |
| GoBDActionWarning.tsx | gobd/GoBDActionWarning.tsx | 273 | 285 | angepasst (96) | statisches `actionConfig` (deutsche Titel) → i18n-Funktion (19) |
| GoBDSystem.tsx | gobd/GoBDSystem.tsx | 149 | 155 | angepasst (44) | i18n (16) |
| ManualLockManager.tsx | gobd/ManualLockManager.tsx | 430 | 411 | angepasst (101) | i18n (28); 2 EUR-Hardcodes → lib/currency |
| SevDeskLockManager.tsx | gobd/SevDeskLockManager.tsx | 259 | 255 | angepasst (54) | i18n (25) |
| StornoManager.tsx | gobd/StornoManager.tsx | 485 | 472 | angepasst (153) | i18n (54); 4 EUR-Hardcodes → lib/currency |
| index.ts | gobd/index.ts | 24 | 24 | angepasst (2) | Kommentar „für Taskilo" gestrichen |

### 1d. `web/components/finance/pdf-templates/`

| Neue Datei | Alte Datei | Neu | Alt | Zustand | Änderung |
|---|---|---|---|---|---|
| DynamicTemplate.tsx | pdf-templates/DynamicTemplate.tsx | 572 | 570 | angepasst (22) | i18n (8) |
| ElegantTemplate.tsx | pdf-templates/ElegantTemplate.tsx | 535 | 533 | angepasst (18) | i18n (7) |
| GeometricTemplate.tsx | pdf-templates/GeometricTemplate.tsx | 460 | 458 | angepasst (24) | i18n (10) |
| NeutralTemplate.tsx | pdf-templates/NeutralTemplate.tsx | 580 | 582 | angepasst (28) | i18n (3) |
| StandardTemplate.tsx | pdf-templates/StandardTemplate.tsx | 497 | 495 | angepasst (20) | i18n (2) |
| TechnicalTemplate.tsx | pdf-templates/TechnicalTemplate.tsx | 451 | 437 | angepasst (88) | `'use client'` + i18n (38: CLIENT_INFO/ADDR1/… als Schlüssel), `formatDate(…, locale)` |
| common/FooterText.tsx | …/common/FooterText.tsx | 61 | 61 | **identisch** | — |
| common/InvoiceFooter.tsx | …/common/InvoiceFooter.tsx | 285 | 285 | angepasst (2) | Farbe `#14ad9f` → `#b82028` |
| common/ItemsTable.tsx | …/common/ItemsTable.tsx | 293 | 268 | angepasst (73) | `formatCurrency(x, data.currency)` (7), i18n (4) |
| common/PageFooter.tsx | …/common/PageFooter.tsx | 52 | 52 | angepasst (16) | Farbe; Test-Fallbacks („andy/staudinger/Siedlung am Wald/Sellin/Köln") → `''` |
| common/SimpleFooter.tsx | …/common/SimpleFooter.tsx | 62 | 57 | angepasst (57) | i18n (4), umgeschrieben |
| common/TaxRulesInfo.tsx | …/common/TaxRulesInfo.tsx | 64 | 64 | **identisch** | — |
| common/TotalsDisplay.tsx | …/common/TotalsDisplay.tsx | 197 | 194 | angepasst (61) | Farbe; `formatCurrency(x, data.currency)` (15); Steuerzeilen-Filter `> 0` → `!== 0` (negative MwSt im Storno-PDF); Skonto-Datum über `t('dateLocale')` |
| index.ts | pdf-templates/index.ts | 20 | 20 | **identisch** | — |

### 1e. `web/components/buchhaltung/` — NextDays-eigen, **kein Gegenstück** (grep nach `LineItemsEditor|useLineItemRows|NewQuoteButton|NewCustomerButton|PortalAbzugssaetze|Abzugssatz` in ALT: 0 Treffer)

| Neue Datei | Zeilen | Bemerkung |
|---|---|---|
| line-items-editor.tsx | 202 | Gemeinsamer Positions-Editor (Rechnung+Angebot), `@nextdays/ui`, `@/lib/buchhaltung` |
| new-customer-button.tsx | 187 | Anlage-Sheet Kunden → `createCustomer` aus `@/lib/buchhaltung` (Server-Action → `/buchhaltung/customers` POST) |
| new-quote-button.tsx | 177 | Anlage-Sheet Angebote |
| portal-abzugssaetze.tsx | 421 | Portal-Provisionen/Zahlungsgebühren je OTA (Domäne PMS, gab es alt nicht) |

### 1f. Inventory, Services, Utils, Hooks

| Neue Datei | Alte Datei | Neu | Alt | Zustand | Änderung |
|---|---|---|---|---|---|
| components/inventory/NewProductModal.tsx | components/inventory/NewProductModal.tsx | 527 | 504 | angepasst (73) | i18n (20, Namensraum `inventory`); `taxRate: 19` → `0` + Betriebssatz aus `useCompanySettings`/`steuersatz()` (`@/lib/steuer-waehrung`), Effekt-Dependency `betriebsSatz` |
| services/numberSequenceService.ts | services/numberSequenceService.ts | 183 | 183 | **identisch** | — (ruft 4 nicht existierende Routen, s. §3) |
| utils/vatValidation.ts | utils/vatValidation.ts | 333 | 317 | angepasst (16) | Nur ergänzt: `export function laendernameDeutsch(code)` (ISO → deutscher Klarname, Rückweg zu `lib/laender`) |
| hooks/useCompanySettings.ts | hooks/useCompanySettings.ts | 250 | 239 | angepasst (17) | `defaultTaxRate` von Literal `'0'|'7'|'19'` → `string`; `|| '19'`-Fallbacks (2) entfernt, `parseFloat` statt `parseInt` |

---

## 2. Alte Dateien OHNE Gegenstück im neuen Projekt

Methode: für jede alte Datei per `find NEU -name <basename>` (ohne node_modules/.next/vendor) gesucht; nur Treffer = vorhanden. Zusätzlich inhaltlich geprüft, wo der Name abweicht (s. §1).

**Vorhanden (namensgleich oder umgebaut) sind nur:** die 42 in §1 gelisteten Komponenten + `components/finance/InventorySelector.tsx` → `NEU/components/quotes/InventorySelector.tsx` (309 Z., anderer Ordner) sowie die zwei Seiten `finance/invoices/page.tsx` und `finance/invoices/create/page.tsx`.

### 2a. Komponenten / Services / Libs / Daten — **123 Dateien, 58 276 Zeilen** fehlen

(120 per Skript + 3 händisch ergänzt, die das Basename-Matching fälschlich als vorhanden zählte: `customer-detail/README.md` 175, `customer-detail/index.ts` 9, `pdf-templates/README.md` 262.)

| Alte Datei (ALT/…) | Zeilen |
|---|---|
| `components/DatevAuthComponent.tsx` |      185 |
| `components/accounting/BookingAccountModal.tsx` |      291 |
| `components/accounting/BookingAccountsTab.tsx` |      294 |
| `components/accounting/CostCentersTab.tsx` |      103 |
| `components/accounting/DatevAccountCards.tsx` |      308 |
| `components/accounting/FinanceSettingsTab.tsx` |      412 |
| `components/accounting/NumberSequenceModal.tsx` |      291 |
| `components/accounting/NumberSequencesTab.tsx` |      119 |
| `components/accounting/PaymentAccountsTab.tsx` |      273 |
| `components/accounting/PaymentMethodsTab.tsx` |      111 |
| `components/accounting/TransactionMatchingTab.tsx` |       34 |
| `components/datev/DatevAuthComponent.tsx` |      178 |
| `components/datev/DatevAuthComponentCookie.tsx` |      577 |
| `components/datev/DatevDashboard.tsx` |      416 |
| `components/datev/DatevDebugComponent.tsx` |      487 |
| `components/datev/DatevDocumentSync.tsx` |      527 |
| `components/datev/DatevExport.tsx` |      489 |
| `components/datev/DatevFlowTest.tsx` |      225 |
| `components/datev/DatevOverview.tsx` |      339 |
| `components/datev/DatevSandboxTest.tsx` |      381 |
| `components/datev/SteuerberaterPortal.tsx` |      663 |
| `components/finance/A4PageComponents.tsx` |      150 |
| `components/finance/AllocateBookingModal.tsx` |      354 |
| `components/finance/AssignTransactionModal.tsx` |      126 |
| `components/finance/BankTransferModal.tsx` |      977 |
| `components/finance/CancelInvoiceModal.tsx` |       67 |
| `components/finance/CashMovementModal.tsx` |      321 |
| `components/finance/CashbookComponent.tsx` |     1346 |
| `components/finance/CategoryAutocomplete.tsx` |      358 |
| `components/finance/CategorySelectionModal.tsx` |     1120 |
| `components/finance/ConnectedDocumentsModal.tsx` |      258 |
| `components/finance/ContactPersonsSection.tsx` |      147 |
| `components/finance/CreditComponent.tsx` |      446 |
| `components/finance/CustomerDetailModal.tsx` |      327 |
| `components/finance/CustomerSelect.tsx` |      341 |
| `components/finance/DeliveryNoteApiIntegrations.tsx` |      623 |
| `components/finance/DifferenceReasonModal.tsx` |      168 |
| `components/finance/DocumentListView.tsx` |     1078 |
| `components/finance/EInvoiceComplianceDashboard.tsx` |      302 |
| `components/finance/EInvoiceComplianceOverview.tsx` |      294 |
| `components/finance/EInvoiceComponent.tsx` |     1099 |
| `components/finance/EInvoiceIntegration.tsx` |      488 |
| `components/finance/EInvoicePreview.tsx` |       12 |
| `components/finance/EInvoiceSendDialog.tsx` |     1155 |
| `components/finance/EInvoiceStatsDashboard.tsx` |      338 |
| `components/finance/EInvoiceTransmissionLogs.tsx` |      403 |
| `components/finance/EditCustomerModal.tsx` |      769 |
| `components/finance/ElsterCertificateSettings.tsx` |      255 |
| `components/finance/EmailsendModalnormal.tsx` |     1177 |
| `components/finance/ExpenseComponent.tsx` |     1386 |
| `components/finance/ExpenseReceiptUpload.tsx` |      646 |
| `components/finance/FavoritesSystem.tsx` |      184 |
| `components/finance/FilteredQuoteComponent.tsx` |      263 |
| `components/finance/FinanceOverview.tsx` |      387 |
| `components/finance/InlinePreview.tsx` |      201 |
| `components/finance/InvoiceTaxRuleSelector.tsx` |      112 |
| `components/finance/InvoiceTemplatePicker.tsx` |      301 |
| `components/finance/LinkTransactionModal.tsx` |      749 |
| `components/finance/ManualTimeEntry.tsx` |      549 |
| `components/finance/OpenCashRegisterModal.tsx` |       97 |
| `components/finance/OpeningBalanceModal.tsx` |      162 |
| `components/finance/OverdueInvoicesAlert.tsx` |      114 |
| `components/finance/OverdueInvoicesNotification.tsx` |      184 |
| `components/finance/PaymentComponent.tsx` |       74 |
| `components/finance/PdfPreview.tsx` |      239 |
| `components/finance/ProfitEstimationSettings.tsx` |      393 |
| `components/finance/ProjectDetailView.tsx` |      887 |
| `components/finance/ProjectTeamManagement.tsx` |      382 |
| `components/finance/ProjectsComponent.tsx` |     1235 |
| `components/finance/QuoteComponent.tsx` |      346 |
| `components/finance/QuoteDetailView.tsx` |      992 |
| `components/finance/QuoteModal.tsx` |      634 |
| `components/finance/ReceiptEditForm.tsx` |      335 |
| `components/finance/ReceiptPreviewUpload.tsx` |      400 |
| `components/finance/RecurringInvoiceSettings.tsx` |      466 |
| `components/finance/ReminderComponent.tsx` |      550 |
| `components/finance/ReminderDialog.tsx` |      311 |
| `components/finance/ReminderSettings.tsx` |      193 |
| `components/finance/ReportComponent.tsx` |     1005 |
| `components/finance/SendInvoiceDialog.tsx` |      328 |
| `components/finance/ServiceSelector.tsx` |       81 |
| `components/finance/SimpleTaxRuleSelector.tsx` |       41 |
| `components/finance/TaxComponent.tsx` |      485 |
| `components/finance/TaxEstimationWizard.tsx` |     1589 |
| `components/finance/TaxWizard.tsx` |     1006 |
| `components/finance/TextTemplateSelect.tsx` |      109 |
| `components/finance/TimeTrackingComponent.tsx` |      990 |
| `components/finance/customer-detail/CustomerContactCard.tsx` |      131 |
| `components/finance/customer-detail/CustomerDetailModal.tsx` |      245 |
| `components/finance/customer-detail/CustomerDocumentsTab.tsx` |     1250 |
| `components/finance/customer-detail/CustomerHistoryTab.tsx` |      988 |
| `components/finance/customer-detail/CustomerInfoCard.tsx` |      429 |
| `components/finance/customer-detail/CustomerInvoiceCard.tsx` |      270 |
| `components/finance/customer-detail/CustomerOrdersTab.tsx` |      450 |
| `components/finance/customer-detail/CustomerWhatsAppTab.tsx` |      340 |
| `components/finance/customer-detail/EditContactPersonModal.tsx` |      264 |
| `components/finance/pdf-templates/common/A4PageBreaks.tsx` |       81 |
| `components/finance/pdf-templates/common/MultiPageWrapper.tsx` |       55 |
| `components/finance/pdf-templates/common/PDFSection.tsx` |       48 |
| `components/finance/pdf-templates/examples.tsx` |      256 |
| `components/invoice/InvoiceItemsCard.tsx` |       89 |
| `components/invoices/ServiceSelection.tsx` |      180 |
| `data/complete-datev-accounts.ts` |     1490 |
| `data/datev-category-mapping-complete.ts` |     3160 |
| `data/datev-income-mapping-complete.ts` |     1339 |
| `lib/datev-api-client.ts` |      452 |
| `lib/datev-auth-middleware.ts` |      164 |
| `lib/datev-config-correct.ts` |      127 |
| `lib/datev-config.ts` |      287 |
| `lib/datev-cookie-manager.ts` |      191 |
| `lib/datev-server-utils.ts` |      214 |
| `lib/datev-token-manager.ts` |      335 |
| `services/datev-user-auth-service.ts` |      330 |
| `services/datevAuswertungsService.server.ts` |     1270 |
| `services/datevAuswertungsService.ts` |     1591 |
| `services/datevCardService.ts` |      386 |
| `services/datevExportService.ts` |      764 |
| `services/datevService.ts` |      309 |
| `services/favoriteDatevAccountService.ts` |       82 |
| `utils/datevCategoryMapper.ts` |      655 |
| `components/finance/customer-detail/README.md` | 175 |
| `components/finance/customer-detail/index.ts` | 9 |
| `components/finance/pdf-templates/README.md` | 262 |

Gruppiert: `components/accounting/*` (10 Dateien, 2 236 Z.: Buchungskonten, Kostenstellen, Nummernkreise-UI, Zahlungskonten/-arten, DATEV-Kontenkarten, Finanz-Einstellungen) · `components/finance/*` Einzelkomponenten (Kassenbuch, Ausgaben, E-Rechnung ×8, Projekte ×3, Zeiterfassung ×2, Mahnwesen ×3, Steuer ×4 inkl. TaxEstimationWizard 1 589 Z., Angebote ×4, Gutschriften, Berichte, Banking/Transaktions-Verknüpfung ×4, Kundendetail ×10, Lieferschein-API, Elster-Zertifikat, Wiederkehrende Rechnungen, Überfällig-Hinweise ×2, InlinePreview/PdfPreview/A4PageComponents, Favoriten, TextTemplateSelect, Service-/CustomerSelect, EmailsendModalnormal, SendInvoiceDialog, EditCustomerModal, CategoryAutocomplete/-SelectionModal, DocumentListView 1 078 Z.) · `pdf-templates/common/{A4PageBreaks,MultiPageWrapper,PDFSection}` + `examples.tsx` · `components/invoice/InvoiceItemsCard.tsx`, `components/invoices/ServiceSelection.tsx` · **DATEV komplett** (`components/datev/*` 10 Dateien 4 282 Z., `components/DatevAuthComponent.tsx`, `data/*datev*` 3 Dateien 5 989 Z., `lib/datev-*` 7 Dateien 1 770 Z., `services/datev*` 7 Dateien 4 732 Z., `utils/datevCategoryMapper.ts` 655 Z.).

### 2b. Seiten (`app/dashboard/company/[uid]/finance/**`, `…/datev/**`, `app/datev*/`) — **63 Seiten, 65 316 + 292 Zeilen**; davon **2 portiert**, **61 fehlen (63 756 Z.)**

| Alte Seite (ALT/…) | Zeilen |
|---|---|
| `app/dashboard/company/[uid]/datev/debug/page.tsx` |      128 |
| `app/dashboard/company/[uid]/datev/export/booking-data-service/page.tsx` |      602 |
| `app/dashboard/company/[uid]/datev/export/booking-data-service/transfer/page.tsx` |      838 |
| `app/dashboard/company/[uid]/datev/export/file-export/page.tsx` |      501 |
| `app/dashboard/company/[uid]/datev/export/invoice-file-export/page.tsx` |      508 |
| `app/dashboard/company/[uid]/datev/export/page.tsx` |      310 |
| `app/dashboard/company/[uid]/datev/overview/page.tsx` |       26 |
| `app/dashboard/company/[uid]/datev/page.tsx` |      678 |
| `app/dashboard/company/[uid]/datev/setup/page.tsx` |      136 |
| `app/dashboard/company/[uid]/finance/accounting/page.tsx` |      403 |
| `app/dashboard/company/[uid]/finance/cashbook/page.tsx` |       39 |
| `app/dashboard/company/[uid]/finance/contacts/[contactId]/edit/page.tsx` |     2447 |
| `app/dashboard/company/[uid]/finance/contacts/[contactId]/page.tsx` |      664 |
| `app/dashboard/company/[uid]/finance/contacts/new/page.tsx` |     2021 |
| `app/dashboard/company/[uid]/finance/contacts/page.tsx` |      623 |
| `app/dashboard/company/[uid]/finance/credits/create/page.tsx` |     5691 |
| `app/dashboard/company/[uid]/finance/credits/page.tsx` |      153 |
| `app/dashboard/company/[uid]/finance/customers/create/page.tsx` |     2230 |
| `app/dashboard/company/[uid]/finance/delivery-notes/create/page.tsx` |     4590 |
| `app/dashboard/company/[uid]/finance/delivery-notes/page.tsx` |      183 |
| `app/dashboard/company/[uid]/finance/einvoices/page.tsx` |       32 |
| `app/dashboard/company/[uid]/finance/expenses/[expenseId]/edit/page.tsx` |      806 |
| `app/dashboard/company/[uid]/finance/expenses/[expenseId]/page.tsx` |      468 |
| `app/dashboard/company/[uid]/finance/expenses/assets/page.tsx` |     1008 |
| `app/dashboard/company/[uid]/finance/expenses/create/page.tsx` |     1131 |
| `app/dashboard/company/[uid]/finance/expenses/page.tsx` |      335 |
| `app/dashboard/company/[uid]/finance/expenses/recurring/page.tsx` |      830 |
| `app/dashboard/company/[uid]/finance/inventory/page.tsx` |       39 |
| `app/dashboard/company/[uid]/finance/invoices/[invoiceId]/edit/page.tsx` |     5268 |
| `app/dashboard/company/[uid]/finance/invoices/[invoiceId]/page.tsx` |     1598 |
| `app/dashboard/company/[uid]/finance/invoices/create/page.tsx` |     5380 |
| `app/dashboard/company/[uid]/finance/invoices/page.tsx` |      199 |
| `app/dashboard/company/[uid]/finance/invoices/recurring/create/page.tsx` |     5525 |
| `app/dashboard/company/[uid]/finance/invoices/recurring/page.tsx` |      193 |
| `app/dashboard/company/[uid]/finance/order-confirmations/create/page.tsx` |     4580 |
| `app/dashboard/company/[uid]/finance/order-confirmations/page.tsx` |      150 |
| `app/dashboard/company/[uid]/finance/page.tsx` |      902 |
| `app/dashboard/company/[uid]/finance/payments/page.tsx` |      113 |
| `app/dashboard/company/[uid]/finance/projects/page.tsx` |       22 |
| `app/dashboard/company/[uid]/finance/quotes/[quoteId]/edit/page.tsx` |     4785 |
| `app/dashboard/company/[uid]/finance/quotes/[quoteId]/page.tsx` |        7 |
| `app/dashboard/company/[uid]/finance/quotes/accepted/page.tsx` |       37 |
| `app/dashboard/company/[uid]/finance/quotes/create/page.tsx` |     4552 |
| `app/dashboard/company/[uid]/finance/quotes/drafts/page.tsx` |       37 |
| `app/dashboard/company/[uid]/finance/quotes/page.tsx` |      152 |
| `app/dashboard/company/[uid]/finance/quotes/sent/page.tsx` |       37 |
| `app/dashboard/company/[uid]/finance/reminders/create/page.tsx` |     2904 |
| `app/dashboard/company/[uid]/finance/reminders/page.tsx` |      208 |
| `app/dashboard/company/[uid]/finance/reports/page.tsx` |       32 |
| `app/dashboard/company/[uid]/finance/settings/page.tsx` |       24 |
| `app/dashboard/company/[uid]/finance/suppliers/page.tsx` |       43 |
| `app/dashboard/company/[uid]/finance/taxes/eur/page.tsx` |      683 |
| `app/dashboard/company/[uid]/finance/taxes/page.tsx` |     1323 |
| `app/dashboard/company/[uid]/finance/taxes/prepayment/[prepaymentId]/page.tsx` |      954 |
| `app/dashboard/company/[uid]/finance/taxes/wizard/absenden/page.tsx` |      671 |
| `app/dashboard/company/[uid]/finance/taxes/wizard/ausgaben/page.tsx` |      318 |
| `app/dashboard/company/[uid]/finance/taxes/wizard/einnahmen/page.tsx` |      294 |
| `app/dashboard/company/[uid]/finance/taxes/wizard/layout.tsx` |       11 |
| `app/dashboard/company/[uid]/finance/taxes/wizard/page.tsx` |      259 |
| `app/dashboard/company/[uid]/finance/taxes/wizard/zusammenfassung/page.tsx` |      330 |
| `app/dashboard/company/[uid]/finance/time-tracking/page.tsx` |       32 |
| `app/datev-test/page.tsx` |      134 |
| `app/datev/page.tsx` |      158 |

Zuordnung zu den neuen Routen unter `NEU/app/(dashboard)/buchhaltung/`:

| Alte Seite | Neu | Zustand |
|---|---|---|
| `finance/invoices/page.tsx` (199) | `buchhaltung/page.tsx` (38) + `components/finance/invoices-client.tsx` (157) | **portiert** |
| `finance/invoices/create/page.tsx` (5380) | `buchhaltung/rechnungen/neu/page.tsx` (35) + `create-invoice/*` (6217) | **portiert (zerlegt)** |
| `finance/quotes/page.tsx` (152) | `buchhaltung/angebote/page.tsx` (152) | **Neuentwicklung**, kein Port (gemeinsame Bezeichner: 0; nutzt `listQuotes`/`NewQuoteButton` aus `@/lib/buchhaltung`) |
| `finance/customers/create/page.tsx` (2230), `finance/contacts/**` (4 Seiten, 5 755) | `buchhaltung/kunden/page.tsx` (94) + `new-customer-button.tsx` | **Neuentwicklung** (Liste + Sheet); die 2 230-Zeilen-Anlageseite und Kontakt-Detail/-Bearbeiten fehlen |
| — | `buchhaltung/abrechnungsregeln/page.tsx` (49) | NextDays-eigen (Portal-Abzugssätze, Gebühren-Zuordnung) |
| `finance/expenses/**` (6 Seiten, 4 578), `cashbook`, `payments`, `reports`, `taxes/**` (9 Seiten, 4 843), `einvoices`, `datev/**` (9 Seiten, 3 727), `accounting` (403) u. a. | `ausgaben`, `kassenbuch`, `zahlungen`, `berichte`, `steuer`, `e-rechnung`, `datev`, `kontenplan`, `bank`, `listen`, `mahnwesen`, `statistik`, `umsatz` | **13 × `ComingSoon`-Platzhalter** (13–17 Zeilen, per grep belegt) |
| `finance/page.tsx` (902, Übersicht), `credits/**`, `delivery-notes/**`, `order-confirmations/**`, `invoices/recurring/**`, `invoices/[invoiceId]/**` (Detail 1 598 + Edit 5 268), `quotes/[quoteId]/**` + `create`, `reminders/**`, `projects`, `time-tracking`, `suppliers`, `settings`, `inventory` | — | **fehlen ganz** (keine Route) |

---

## 3. Backend

### 3a. Alte Feature-Slices → neues Backend (`NextDays/apps/api/src/features/`)

Neu gibt es genau EINEN Buchhaltungs-Slice: `features/buchhaltung/` (4 709 Z.: service.py 1 967, reservation_invoice.py 1 074, router.py 587, doc_i18n.py 271, storno.py 256, stripe_legal_form.py 243, schemas.py 227, vat_check.py 67), gemountet als `/api/v1/buchhaltung` (main.py Z. 47/129, `api_v1 = APIRouter(prefix="/api/v1")` Z. 549). 38 Routen:
`GET/POST /customers`, `GET /customers/company/{id}`, `PATCH/DELETE /customers/{id}`, `GET/POST /invoices`, `GET /invoices/company/{id}`, `GET/PATCH/DELETE /invoices/{id}`, `POST /invoices/{id}/storno`, `GET /invoices/next-number/{id}`, `GET /invoice-preview`, `GET /billable-reservations`, `GET/POST /quotes`, `GET/PATCH/DELETE /quotes/{id}`, `POST /quotes/{id}/convert`, `GET/PATCH /companies/{id}`, `POST /companies/{id}/logo`, `POST /companies/{id}/stripe-sync`, `GET /companies/{id}/transaction-links`, `GET /booking-accounts/{id}`, `GET/POST /inline-invoice-services`, `GET /text-templates/{id}`, `GET /text-templates/{id}/default`, `POST /text-templates/{id}/initialize`, `GET /number-sequences`, `GET /number-sequences/{id}`, `GET/PATCH /users/{id}/preferences`, `GET /vat-check`, `GET /health`.

| Alter Slice (`taskilo-platform/apps/backend/api/src/features/`) | Zeilen | Alte Routen | Gegenstück neu |
|---|---|---|---|
| `finance/` (router 550, german_extraction 664, ocr_service 228, sync_service 144, schemas 134) | 1 721 | `/finance/customers` CRUD + `/address`, `/contact`; `/finance/invoices` CRUD + `/status`; `POST /finance/ocr/extract-receipt`; `POST /finance/sync/order-to-invoice[/{order_id}]` | **teilweise**: Kunden/Rechnungen-CRUD in `buchhaltung` (anderer Präfix, kein `/address`/`/contact`, kein `/status`). **OCR-Belegerkennung, Order→Invoice-Sync: kein Gegenstück** (es gibt `features/ocr`, aber keine Belegextraktion für die Buchhaltung — nicht geprüft, ob es dasselbe ist). |
| `invoices/` (router 351, repository 485, pdf_service 343, pdf_router 90, domain 223, schemas 220) | 1 713 | `/invoices` list/get/patch/delete, `/company/{id}`, `/customer/{id}`, `GET /{id}/storno`, `POST /{id}/generate`, `/invoices/pdf/*` | **teilweise**: list/get/patch/delete/company in `buchhaltung`; Storno ist neu `POST` (Storno anlegen) statt `GET` (Storno lesen); **`/customer/{id}`, `/{id}/generate`, PDF-Service serverseitig: kein Gegenstück** (PDF läuft neu als Next-Route `web/app/api/v1/generate-pdf-single/route.ts` mit playwright-core). |
| `recurring_invoices/` | 652 | `/recurring-invoices` CRUD, `/stats`, `/{id}/generated`, `/{id}/status` | **kein Gegenstück** (`grep -r recurring-invoices features/`: 0) |
| `invoice_validation/` | 211 | `POST /invoice-validation/validate-tax-rate`, `/validate-tax-rules` | **kein Gegenstück** (0 Treffer) |
| `einvoice/` (xml_generator 488, router 265, schemas 240, validator 137, repository 126) | 1 257 | `/einvoice` POST, `/generate/xrechnung`, `/generate/zugferd`, `/validate`, `/validate/xml`, `/settings` GET/PUT, `/company/{id}`, `/{id}` | **kein Gegenstück** (`einvoice|xrechnung|zugferd`: 0 Treffer in features/) |

Ebenfalls im alten Backend vorhanden, im neuen ohne Ordner (per `ls`): `gobd`, `number_sequences` (neu nur 2 GETs in buchhaltung), `expenses`, `inventory`, `reminders`, `datev`, `finapi`, `tax`, `delivery_notes`, `fixed_assets`, `transaction_links` (neu nur GET-Liste), `quotes` (neu in buchhaltung enthalten).

### 3b. Verdrahtung Frontend → Backend

`NEU/lib/api-client.ts`: `API_URL = ""` (eigener Origin) → Next-Catch-all `app/api/v1/[...path]/route.ts` proxyt an `${NEXT_PUBLIC_API_URL}/api/v1/<path>` mit Bearer aus httpOnly-Cookie. Davor `mapEndpoint()` schreibt `/api/v1/{invoices,customers,booking-accounts,quotes,companies,number-sequences,inline-invoice-services,text-templates,users}` → `/api/v1/buchhaltung/…` um. **Nicht gemappt** (gehen 1:1 ans FastAPI und dort ins 404): `/api/v1/finance/*`, `/api/v1/email/*`, `/api/v1/send-invoice-email`, `/api/v1/expenses`, `/api/v1/reminders/*`, `/api/v1/gobd/*`, `/api/v1/inventory/*`, `/api/v1/notifications/*`, `/api/v1/categories`. Plain `fetch('/api/…')` ohne `/v1/` (finapi, einvoices) trifft gar keine Route: `ls web/app/api` = `diagnose google-fonts sitzung-debug v1`.

### 3c. Aufrufe INS LEERE — direkt in den neuen Finanzdateien (13 Pfade, 21 Stellen)

| # | Pfad (Methode) | Aufrufstelle | Warum leer |
|---|---|---|---|
| 1 | `GET /api/v1/finance/customers?search=` | EmailSendModal.tsx:563, :573, :719, :765 | kein `/finance`-Router; mapEndpoint mappt nicht |
| 2 | `GET /api/v1/customers/{prefillCustomerId}?company_id=` | create-invoice/use-invoice-loaders.ts:235 | buchhaltung hat `PATCH`/`DELETE /customers/{id}`, aber **kein GET** → 405 |
| 3 | `GET /api/v1/users/{userId}` | hooks/useCompanySettings.ts:98 | nur `/users/{id}/preferences` existiert |
| 4 | `POST /api/v1/send-invoice-email` (fetch) | EmailDialog.tsx:60 | weder Backend- noch Next-Route |
| 5 | `POST /api/v1/email/send-document` (fetch) | EmailSendModal.tsx:648 | weder Backend- noch Next-Route |
| 6 | `POST /api/v1/expenses` (fetch) | ImportXRechnungDialog.tsx:156 | kein `expenses`-Feature (`/owner-statements/expenses` ist ein anderer Pfad) |
| 7 | `GET/PATCH /api/v1/reminders/{id}?company_id=` (collectionName='reminders') | SendDocumentModal.tsx:1323, :1509, :1749, :1811 | kein `reminders`-Router (für `invoices`/`quotes` existieren die Routen) |
| 8 | `POST /api/v1/number-sequences/{companyId}/next` | services/numberSequenceService.ts:33 | buchhaltung: nur `GET /number-sequences`, `GET /number-sequences/{id}` |
| 9 | `PATCH /api/v1/number-sequences/{companyId}/{sequenceId}` | numberSequenceService.ts:106 | s. o. |
| 10 | `POST /api/v1/number-sequences/{companyId}/sync` | numberSequenceService.ts:114 | s. o. |
| 11 | `POST /api/v1/number-sequences/{companyId}/create-defaults` | numberSequenceService.ts:156 | s. o. |
| 12 | `GET /api/finapi/accounts-enhanced`, `GET /api/finapi/transactions` (fetch) | SelectBankingTransactionModal.tsx:206, :225 | `web/app/api/finapi` existiert nicht |
| 13 | `/api/einvoices/{id}/xml` (nur als URL erzeugt, an Gast/Mail gegeben) | SendDocumentModal.tsx:721, create-invoice/use-invoice-actions.ts:797 | `web/app/api/einvoices` existiert nicht → toter Link |

Bereits entschärft (nur noch Kommentar): `/api/v1/categories` (NewCustomerModal.tsx:332, NewCategoryModal.tsx:72); `utils/api/companyApi.ts` auf `createCustomer` reduziert (Kopfkommentar belegt die früheren 404).

Nicht leer, aber **Semantik verloren**: `GET /api/v1/customers?company_id=&name=…&limit=1` (LivePreviewModal.tsx:186) und `…&email=…&limit=1` (InvoiceListView.tsx:306) — die Route existiert, `list_customers(ctx, service)` (router.py Z. 146–155) nimmt aber **keine Query-Parameter** an: es kommt immer die volle Liste, nie der gesuchte Treffer.

Existieren und passen: `GET/PATCH /companies/{id}`, `GET/POST /customers`, `GET/POST /inline-invoice-services`, `GET /invoices?company_id`, `GET /invoices/company/{id}`, `GET/PATCH /invoices/{id}`, `GET/PATCH /quotes/{id}`, `GET /number-sequences(?company_id | /{id})`, `POST /api/v1/generate-pdf-single` (Next-Route lokal, Playwright).

### 3d. Aufrufe ins Leere in den importierten Services (zweite Ebene, 23 Stellen)

| Pfad | Service | Befund |
|---|---|---|
| `PUT/DELETE /api/v1/booking-accounts/{companyUid}/{accountId}` | services/bookingAccountService.ts:60, :72 | nur `GET /booking-accounts/{company_id}` |
| `/api/v1/companies/{id}/quote-settings` | services/quoteService.ts:524 | keine Route |
| `/api/v1/companies/{id}/transaction-links/{linkId}` | services/transaction-link.service.ts:237 | nur GET-Liste (:144 ok) |
| `/api/v1/gobd/settings` | services/gobdService.ts:186 | kein gobd-Feature |
| `/api/v1/inventory/{companyId}/…` (7 Pfade: item, adjust-stock, images, reserve, release-reservation, sell-reserved) | services/inventoryService.ts:240–478 | kein inventory-Feature |
| `/api/v1/invoices/{companyId}/{invoiceId}/status` | services/invoice-status.service.ts:28 | kein 3-Segment-Pfad unter /invoices |
| `/api/v1/notifications/whatsapp` (6×) | services/whatsapp-notifications.service.ts:142–391 | whatsapp-Router hat `/whatsapp/send`, `/send-template`… — kein `/notifications/whatsapp` |
| `PUT/DELETE /api/v1/text-templates/{companyId}/{templateId}` | services/TextTemplateService.ts:63, :75 | nur GET/`default`/`initialize` |

---

## 4. Tote Importe

Alle 49 unterschiedlichen `@/…`-Importziele der 63 Dateien wurden per `ls` (mit `.ts`/`.tsx`/`index.ts`) geprüft: **alle vorhanden** — u. a. `lib/api-client.ts`, `contexts/NewAuthContext.tsx`, `hooks/pdf/usePDFTemplateData.ts`, `services/{quoteService,gobdService,firestoreInvoiceService,bookingAccountService,TextTemplateService,inventoryService,xrechnungParserService,invoice-status.service,transaction-link.service,whatsapp-notifications.service}.ts`, `types/{invoiceTypes,taxRules,formData,gobdTypes,textTemplates,banking}.ts`, `utils/{pdf-page-styles,a4-page-utils}.ts`, `lib/{document-utils,currency,steuer-waehrung,buchhaltung,buchhaltung-bookings,owner-billing,laender,invoice-document,finapi-config,channel-logos,marketing-url,userPreferences,use-realtime,use-country-options,utils}.ts`, `hooks/{useCompanySettings,useTemplatePageDetection,useNextInvoiceNumber}.ts`, `hooks/pdf/{useDocumentTranslation,useSimplePagination,document-translations}.ts`, `data/currencies.ts`, `components/{quotes/InventorySelector,texteditor/PlaceholderModal,settings/TextTemplateModal,inventory/NewProductModal}.tsx`.
Dynamischer Import `@/utils/api/companyApi` (NewCustomerModal.tsx:2032) → `utils/api/companyApi.ts` vorhanden.
Aliasse: `@tasko/ui` → tsconfig `paths` → `web/vendor/tasko-ui/index.ts` (vorhanden, 29 Importe); `@nextdays/ui/*` → `packages/ui` (`"name": "@nextdays/ui"`, workspace).

**Ergebnis: 0 tote Importe.** Die „Löcher" liegen nicht bei den Modulen, sondern bei den HTTP-Routen (§3c/3d) — zur Bauzeit ist alles grün, zur Laufzeit antworten 21 + 23 Aufrufstellen mit 404/405.

---

## Belege / Hilfsdateien
- `scratchpad/fehlend-komponenten.md` — generierte 120 Zeilen der fehlenden Komponenten
- `scratchpad/alte-seiten.md` — alle 63 alten Seiten mit Zeilenzahl
