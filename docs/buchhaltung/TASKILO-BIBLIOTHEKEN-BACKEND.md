# Taskilo-Finanzwerkzeug — Inventar Bibliotheken & Backend

Quelle: `/Users/andystaudinger/taskilo-platform` (nur gelesen, Stand 11.09.2026).
Vergleichsziel: `/Users/andystaudinger/NextDays/web/package.json`.
Alle Angaben stammen aus den genannten Dateien; wo etwas NICHT gefunden wurde, steht es ausdrücklich.

---

## TEIL A — Komponenten-Bibliotheken und Abhängigkeiten

### A1. `packages/` — 8 Workspace-Pakete

Root `package.json`: `taskilo-platform`, Bun 1.3.9, Turborepo, Workspaces `apps/frontend/*`, `apps/backend/*`, `apps/baas`, `packages/*`.

| Ordner | Paketname | Zweck (aus package.json / Inhalt) | Exporte |
|---|---|---|---|
| `packages/ui` | **`@tasko/ui`** 0.1.0 | „Reusable UI component library built on Radix UI and Tailwind CSS" — shadcn (`components.json`: style `new-york`, baseColor `stone`, iconLibrary `lucide`, cssVariables). Kein Build-Schritt, Quelltext wird direkt importiert. | `.` → `src/index.ts` (Barrel über 48 Komponenten + `cn`), `./cn`, `./styles/theme.css`, `./styles/globals.css`, `./components/*` |
| `packages/shared` | **`@tasko/shared`** 0.1.0 | „Shared utilities, API client, auth middleware, and cross-app contexts" | `.`, `./lib/api-client`, `./lib/server-api`, `./lib/auth-storage`, `./lib/auth-middleware`, `./lib/constants`, `./lib/date-utils`, `./lib/gtm-dsgvo`, `./lib/gtm-dataLayer`, `./lib/gtm-events`, `./lib/auth-urls`, `./contexts/NewAuthContext`, `./contexts/CookieConsentContext`, `./hooks/use-auth`, `./components/AlertProvider`. Deps: `@iconify-json/lucide`, `@iconify/react`, `js-cookie`. Zusätzlich im Ordner (nicht exportiert): `src/email/emailUtils.ts`, `src/types/`. |
| `packages/business` | **`@tasko/business`** 0.1.0 | „Shared business logic, domain models, and validation rules" — real nur `index.ts` (71 Zeilen): Typen `User`, `BusinessError`, `CreateCompanyInput`, `UpdateProfileInput`, `TaskiloLevel`, `PayoutConfig` + Konstante `PAYOUT_CONFIG` (Marktplatz-Auszahlungsstufen, Plattformgebühr 10–15 %). Kein Finanz-/Rechnungsbezug. | `./index.ts` |
| `packages/tokens` | **`@tasko/tokens`** 1.1.0 | Design-Tokens via style-dictionary 4.3.2; Quelle `src/tokens/{color,shadow,spacing,typography}.json`, Build `node sd.config.js` → `dist/{css,js,ts,json}` | `./css`, `./js`, `./ts`, `./json`, `./src/tokens/*.json` |
| `packages/ts-conf` | **`@tasko/ts-conf`** 1.1.0 | Geteilte tsconfig-Presets | `base.json`, `nextjs.json`, `react-library.json` |
| `packages/webmail-shared` | **`@taskilo/webmail-shared`** 0.1.0 | Komponenten/Hooks/Kontexte der Webmail-Apps (MailHeader, AppLauncher, WebSocketProvider, tenant-session …). Deps u. a. `date-fns 3.6.0`, `framer-motion 12.23.12`, `qrcode.react 4.2.0`, `next-themes 0.3.0`. Kein Finanzbezug. | `./components/*`, `./contexts/*`, `./hooks/*`, `./lib/*`, `./providers/*`, `./config/*` |
| `packages/plop` | (kein package.json) | Handlebars-Vorlagen für den Feature-Generator: `backend/{__init__,domain,errors,repository,router,schemas,service}.py.hbs`, `frontend/{api,index,schemas,use-feature}.ts.hbs` | — |
| `packages/python-auth` | **`taskilo-auth`** 0.1.0 (Poetry) | „Shared HMAC tenant_session cookie auth for Taskilo backends"; `taskilo_auth/{cookie,dependencies}.py`; wird in `apps/backend/api/pyproject.toml` als Pfad-Abhängigkeit eingebunden | — |

#### `@tasko/ui` im Detail — Ursprung von `@tasko/ui` im neuen Projekt: JA, belegt

- 48 Komponentendateien in `packages/ui/src/components`: accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, multi-select, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, tag-input, textarea, toggle-group, toggle, tooltip, visually-hidden. Dazu `lib/cn.ts`, `styles/{globals,theme}.css`.
- **Im neuen Projekt** löst `NextDays/web/tsconfig.json` (Zeile 29–36) `@tasko/ui` → `./vendor/tasko-ui/index.ts`, `@tasko/ui/cn` → `./vendor/tasko-ui/lib/cn.ts`, `@tasko/ui/*` → `./vendor/tasko-ui/*` auf. `NextDays/web/vendor/tasko-ui/` enthält dieselbe Struktur (`components/` mit 48 Dateien, `index.ts`, `lib/cn.ts`, `styles/`). `diff` der Komponentenlisten: einziger Unterschied `chart.tsx` (alt) ↔ `chart.tsx.bak` (neu). `cmp` byte-identisch für `button`, `dialog`, `table`, `form`; `select.tsx` ist im neuen Projekt verändert.
- Das reguläre Design-System des neuen Projekts heißt **`@nextdays/ui`** (`NextDays/packages/ui`, eigenes Paket, `./*`-Exporte). `@tasko/ui` liegt dort also als zweite, eingefrorene vendor-Kopie neben `@nextdays/ui` — verwendet von den bereits kopierten Finanz-Komponenten (`NextDays/web/components/finance/*`, `quotes/InventorySelector.tsx`, `inventory/NewProductModal.tsx`, `texteditor/PlaceholderModal.tsx`, `settings/TextTemplateModal.tsx`, `QuickAddService.tsx`).
- `@tasko/ui` dependencies (42): `@hookform/resolvers 5.2.0`, `@iconify-json/lucide 1.2.92`, `@iconify/react 6.0.2`, 23 × `@radix-ui/react-*` (accordion 1.2.12, alert-dialog 1.1.14, avatar 1.1.10, checkbox 1.3.2, collapsible 1.1.12, dialog 1.1.14, dropdown-menu 2.1.15, hover-card 1.1.14, label 2.1.7, navigation-menu 1.2.14, popover 1.1.14, progress 1.1.7, radio-group 1.3.8, scroll-area 1.2.9, select 2.2.5, separator 1.1.7, slider 1.3.6, slot 1.2.3, switch 1.2.5, tabs 1.1.12, toggle 1.1.9, toggle-group 1.1.10, tooltip 1.2.7), `class-variance-authority 0.7.1`, `clsx 2.1.1`, `cmdk 1.1.1`, `embla-carousel-react ^8.6.0`, `input-otp ^1.4.2`, `next-themes ^0.4.6`, `radix-ui ^1.4.3`, `react-day-picker 9.13.0`, `react-hook-form ^7.68.0`, `react-resizable-panels ^4`, `recharts 2.15.3`, `sonner ^2.0.7`, `tailwind-merge 3.3.0`, `tw-animate-css 1.3.0`, `vaul 1.1.2`, `zod ^4.1.0`.
- Vom Finanzwerkzeug (inkl. transitiver Module) tatsächlich importierte `@tasko/ui`-Exporte (Häufigkeit über alle Importzeilen): Button, Card/CardHeader/CardTitle/CardContent/CardDescription, Input, Label, Dialog (+Content/Header/Title/Description/Footer/Trigger/Close), Badge, Select (+Trigger/Value/Content/Item/Group/Label), Textarea, DropdownMenu (+Trigger/Content/Item/Separator/Label), Table (+Header/Head/Body/Row/Cell), Checkbox, Switch, Tooltip (+Trigger/Content/Provider), Tabs (+List/Trigger/Content), Popover (+Trigger/Content/Anchor), Alert/AlertDescription, Progress, Command (+Input/Group/Item/Empty), Calendar, Separator, Sheet (+Content/Header/Title/Footer/Description), AlertDialog (+Content/Header/Title/Description/Footer/Action/Cancel/Trigger), ScrollArea, RadioGroup/RadioGroupItem.

### A2. `apps/frontend/app/package.json` (`@taskilo/app`, Next 16.2.3, React 19.2.4)

135 `dependencies`, 22 `devDependencies`. Vollständige Liste der dependencies (Version):

`@dnd-kit/core 6.3.1`, `@dnd-kit/modifiers 9.0.0`, `@dnd-kit/sortable 10.0.0`, `@dnd-kit/utilities 3.2.2`, `@emotion/react 11.14.0`, `@emotion/styled 11.14.1`, `@fullcalendar/core|daygrid|interaction|react|timegrid 6.1.15`, `@google/genai 1.34.0`, `@googlemaps/js-api-loader 1.16.8`, `@headlessui/react 2.2.4`, `@hello-pangea/dnd 18.0.1`, `@hookform/resolvers 5.2.0`, `@iconify-json/lucide 1.2.92`, `@iconify/react 6.0.2`, `@jitsi/react-sdk 1.4.4`, `@mui/material 7.2.0`, `@radix-ui/react-dialog 1.1.14`, `@radix-ui/react-menu 2.1.16`, `@radix-ui/react-slot 1.2.3`, `@react-google-maps/api 2.20.7`, `@react-pdf/renderer 4.3.0`, `@sparticuz/chromium 123.0.1`, `@supabase/supabase-js 2.95.3`, `@tanstack/react-query 5.90.20`, `@tanstack/react-table 8.21.3`, `@tasko/business|shared|ui workspace:*`, `@tiptap/core 3.4.2` + 24 `@tiptap/extension-*` (3.1.0–3.4.2), `@tiptap/react 3.4.2`, `@tiptap/starter-kit 3.4.2`, `@vis.gl/react-google-maps 1.5.3`, `bcryptjs 3.0.3`, `cheerio 1.1.2`, `class-variance-authority 0.7.1`, `compromise 14.14.4`, `crypto-js 4.2.0`, `date-fns 3.6.0`, `dompurify 3.4.0`, `dotenv 17.2.3`, `fast-xml-parser 5.7.0`, `finapi-client 1.0.3`, `framer-motion 12.23.12`, `gantt-task-react 0.3.9`, `geofire-common 6.0.0`, `google-ads-api 23.0.0`, `google-auth-library 9.15.1`, `googleapis 148.0.0`, `he 1.2.0`, `heic2any 0.0.4`, `html-entities 2.6.0`, `html-to-text 9.0.5`, `html2canvas 1.4.1`, `imap 0.8.19`, `imap-simple 5.1.0`, `imapflow 1.2.1`, `isomorphic-dompurify 2.28.0`, `jose 6.0.12`, `jsonwebtoken 9.0.2`, `jspdf 4.2.1`, `jszip 3.10.1`, `juice 11.0.3`, `lodash 4.18.1`, `mailparser 3.9.3`, `moment 2.30.1`, `natural 8.1.0`, `next 16.2.3`, `next-themes 0.3.0`, `node-fetch 2.7.0`, `nodemailer 8.0.5`, `pdf-lib 1.17.1`, `pdfjs-dist 5.4.296`, `pdfkit 0.17.1`, `qrcode 1.5.4`, `qrcode.react 4.2.0`, `react 19.2.4`, `react-beautiful-dnd 13.1.1`, `react-big-calendar 1.19.4`, `react-calendar 6.0.0`, `react-date-range 2.0.1`, `react-day-picker 8.10.1`, `react-dnd 16.0.1`, `react-dnd-html5-backend 16.0.1`, `react-dom 19.2.4`, `react-dropzone 14.3.8`, `react-hook-form 7.71.2`, `react-hot-toast 2.5.2`, `react-markdown 10.1.0`, `react-pdf 10.2.0`, `react-qr-code 2.0.15`, `react-signature-canvas 1.1.0-alpha.2`, `react-use-measure 2.1.7`, `react-world-flags 1.6.0`, `recharts 2.15.3`, `resend 4.8.0`, `sharp 0.34.4`, `socket.io 4.8.1`, `sonner 2.0.7`, `swiper 12.1.2`, `turndown 7.2.1`, `twilio 5.5.1`, `uuid 14.0.0`, `validate-steuernummer 1.6.0`, `whatsapp-web.js 1.34.1`, `ws 8.17.1`, `xml2js 0.6.2`, `zod 3.25.76`, `zustand 5.0.9`.

**Was das Finanzwerkzeug davon wirklich nutzt.** Gemessen über alle `import … from` / `import()` in `src/components/{finance,accounting,invoices,invoice}` (136 Dateien, 60 857 Zeilen) und `src/app/dashboard/company/[uid]/finance/**` (52 Seiten), zusätzlich die 72 transitiv referenzierten `@/`-Module (services, hooks, lib, types, utils, data, 9 Komponenten außerhalb; 30 658 Zeilen).

| Kategorie | Bibliothek (Version im alten Projekt) | Wo importiert |
|---|---|---|
| **UI-Basis** | `@tasko/ui` (workspace) | 135 Importzeilen in den Finanz-Ordnern + 9 transitiv |
| | `@iconify/react 6.0.2` | 142 (+7) — einziges Icon-Set (lucide via Iconify) |
| | `sonner 2.0.7` | 86 (+6) — Toasts |
| | `@radix-ui/react-dialog 1.1.14` direkt | `SendDocumentModal.tsx`, `LivePreviewModal.tsx` |
| | `next/navigation`, `next/link`, `next/image`, `next/dynamic`, `next/script` | Framework |
| **Charts** | `recharts 2.15.3` | nur `finance/page.tsx` (Übersicht) |
| **Rich-Text** | `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-{underline,text-style,text-align,table,table-row,table-header,table-cell,link,color}` 3.4.2 | `FooterTextEditor.tsx`, `HeaderTextEditor.tsx` |
| **PDF** | `react-pdf 10.2.0` + `pdfjs-dist 5.4.296` (Viewer) | `PdfPreview.tsx` (dynamischer Import) |
| | `jspdf 4.2.1` | `EInvoiceSendDialog.tsx`, `invoices/[invoiceId]/edit/page.tsx` (dynamisch) |
| | `html2canvas 1.4.1` | `invoices/[invoiceId]/edit/page.tsx` (dynamisch) |
| | `pdf-lib 1.17.1` | `services/eInvoiceService.ts` (ZUGFeRD: XML in PDF einbetten) |
| | `react-dom/server` | `EmailsendModalnormal.tsx` (HTML-Render für Mail) |
| | **NICHT** genutzt im Finanzwerkzeug: `@react-pdf/renderer`, `pdfkit` (PDF-Vorlagen sind reine React/HTML-Komponenten unter `finance/pdf-templates/`) |
| **Tabellen** | keine `@tanstack/react-table`-Importe in den Finanz-Ordnern — Tabellen sind `@tasko/ui`-`Table` |
| **Formulare** | keine `react-hook-form`/`zod`-Importe in den Finanz-Ordnern (nur innerhalb `@tasko/ui/form`) |
| **Datum** | `date-fns 3.6.0` + `date-fns/locale` (de) | 17 + 15 Importzeilen |
| | `react-day-picker 8.10.1` (App) / 9.13.0 (`@tasko/ui`) | transitiv `components/calendar/CalendarEventModal.tsx` |
| | `@fullcalendar/core 6.1.15` | transitiv `components/CompanyCalendar.tsx` (importiert von `finance/projects`) |
| **Zahl/Währung** | keine Bibliothek — eigene `data/currencies.ts` (198 Z.), `Intl`-Formatierung |
| **E-Rechnung** | `fast-xml-parser 5.7.0` (XMLBuilder/XMLParser) + `pdf-lib` | `services/eInvoiceService.ts` — XRechnung/ZUGFeRD werden **im Frontend selbst gebaut**, keine externe E-Rechnungs-Bibliothek |
| | `validate-steuernummer 1.6.0` | `TaxEstimationWizard.tsx` |
| **Bilder** | `heic2any 0.0.4` | `ExpenseReceiptUpload.tsx` (HEIC → JPEG bei Belegen) |
| **Mail** | keine Bibliothek im Finanz-Frontend; Versand über Backend-Endpunkte (`/api/v1/send-invoice-email`, `/api/v1/email/send-document`) |
| **Zahlungsanbieter** | **kein Stripe** im Finanzwerkzeug. Banking über eigene Clients: `lib/finapi*.ts` (finAPI, 7 Dateien), `lib/revolut*.ts` (3 Dateien) — `finapi-client 1.0.3` aus package.json wird in den Finanz-Ordnern NICHT importiert |
| **Datenbank/Auth** | **kein** `@supabase/supabase-js`, **kein** Firebase im Finanz-Frontend. Zugriff ausschließlich über `@/lib/api-client` (→ `@tasko/shared/lib/api-client`, 60 Importzeilen) und `@/contexts/NewAuthContext` (→ `@tasko/shared`, 55). `services/firestoreInvoiceService.ts` heißt nur so — spricht `/api/v1/invoices` |
| **DATEV-Stammdaten** | keine Bibliothek — Datenlisten `data/complete-datev-accounts.ts` (1 490 Z.), `data/datev-category-mapping-complete.ts` (3 160 Z.), `data/datev-income-mapping-complete.ts` (1 339 Z.) |

### A3. Im neuen Projekt (`NextDays/web/package.json`, 87 dependencies) FEHLENDE Bibliotheken

Vergleich der vom Finanzwerkzeug genutzten Pakete gegen `dependencies` von `nextdays-web`:

| Fehlt im neuen Projekt | Version alt | Genutzt in | Bemerkung |
|---|---|---|---|
| **`react-pdf`** | 10.2.0 | `finance/PdfPreview.tsx` | PDF-Viewer (wojtekmaj) |
| **`pdfjs-dist`** | 5.4.296 | `finance/PdfPreview.tsx` | Worker für react-pdf |
| **`jspdf`** | 4.2.1 | `EInvoiceSendDialog.tsx`, `invoices/[invoiceId]/edit/page.tsx` | HTML→PDF clientseitig |
| **`html2canvas`** | 1.4.1 | `invoices/[invoiceId]/edit/page.tsx` | zusammen mit jspdf |
| **`heic2any`** | 0.0.4 | `ExpenseReceiptUpload.tsx` | HEIC-Belegfotos |
| **`validate-steuernummer`** | 1.6.0 | `TaxEstimationWizard.tsx` | deutsche Steuernummer-Prüfung |
| **`@fullcalendar/core`** (+ `daygrid`, `interaction`, `react`, `timegrid`) | 6.1.15 | nur transitiv: `components/CompanyCalendar.tsx` ← `finance/projects/page.tsx` | entfällt, wenn Projekte-Seite nicht übernommen wird |
| **`@tasko/shared`** | workspace | `lib/api-client`, `lib/auth-storage`, `contexts/NewAuthContext` | API-Client + Auth-Kontext; im neuen Projekt kein Äquivalent unter diesem Namen (dort `@nextdays/auth`) |
| **`@tiptap/extension-underline`** | 3.4.2 | `FooterTextEditor.tsx`, `HeaderTextEditor.tsx` | die übrigen Tiptap-Erweiterungen (color, link, table, table-row/-header/-cell, text-align, text-style) sind in 3.27.1 vorhanden |

Vorhanden, aber mit **anderer Hauptversion**: `date-fns` 3.6.0 → 4.4.0 (Locale-Importpfad `date-fns/locale` bleibt), `recharts` 2.15.3 → 3.8.1, `react-day-picker` 8.10.1 (App) → 9.14.0, `@tiptap/*` 3.4.2 → 3.27.1, `next` 16.2.3 → 15.5.19 (Rückschritt!), `@radix-ui/react-dialog` 1.1.14 → 1.1.17, `fast-xml-parser` 5.7.0 → 5.9.3.
Vorhanden, gleiche Version: `@iconify/react 6.0.2`, `sonner 2.0.7`, `pdf-lib 1.17.1`.
`@tasko/ui` selbst: im neuen Projekt als `web/vendor/tasko-ui` per tsconfig-Alias vorhanden (siehe A1) — kein npm-Paket nötig; seine Radix-Abhängigkeiten sind in `nextdays-web` alle gelistet (neuere Patch-Versionen).

---

## TEIL B — Backend

### B4. FastAPI-Backend `apps/backend/api` (Poetry `tasko-api`, Python ^3.12)

Kern-Abhängigkeiten (`pyproject.toml`): `fastapi 0.115.14`, `pydantic 2.12.5`, `supabase 2.27.2`, `asyncpg 0.30.0`, `PyJWT 2.10.1`, `httpx 0.28.1`, `apscheduler 3.10.4`, `defusedxml 0.7.1`, **`weasyprint 68.0`** (PDF), `taskilo-auth` (Pfad `packages/python-auth`). **Keine** DATEV-, XRechnung-, ZUGFeRD-, Stripe- oder Mail-SDKs — Mail läuft über `smtplib` (`src/shared/notifications/email.py`).
Alle Router hängen unter `prefix="/api/v1"` (`src/main.py` Z. 317–342). Auth: `AccessToken`/`CurrentUserId` aus `src/shared/security/jwt.py` (Bearer-JWT); `src/config/supabase_client.get_supabase(access_token)` → mit Token ANON_KEY + User-JWT (RLS greift), ohne Token SERVICE_ROLE (RLS umgangen). Tests: `apps/backend/api/tests/` enthält nur `test_health.py`, `test_phase2_dual_auth.py`, `conftest.py` — **keine Tests für Finanz-Slices**.

#### Dateien der angefragten Slices (30 Dateien, 5 864 Zeilen)

| Pfad (`apps/backend/api/src/features/…`) | Zeilen | Zweck |
|---|---|---|
| `finance/__init__.py` | 1 | — |
| `finance/router.py` | 550 | Prefix `/finance`: OCR, Rechnungs-CRUD (camelCase-Spalten), Kunden-CRUD, Auftrag→Rechnung-Sync |
| `finance/schemas.py` | 134 | `InvoiceStatus`, `TaxBreakdown` (0/7/19 %), `ExtractedInvoiceData`, `OCRRequest/Response`, `InvoiceSearchParams`, `SyncOptions`, `BatchSyncRequest`, `AddressType`, `ContactType`, `AddAddressRequest`, `AddContactRequest` |
| `finance/ocr_service.py` | 228 | ruft die eigene **Taskilo-KI** (`http://taskilo-ki:8000`, httpx, 60 s, 20 MB) für OCR/Extraktion |
| `finance/german_extraction.py` | 664 | Regex-Extraktion deutscher Rechnungen (Nummer, Beträge, Datum, USt-Aufschlüsselung) — „portiert aus Firebase finance-http.ts" |
| `finance/sync_service.py` | 144 | `sync_order_to_invoice`, Batch — liest `orders`/`invoices` mit camelCase-Filtern (`companyId`, `orderId`) |
| `invoices/__init__.py` | 1 | — |
| `invoices/domain.py` | 223 | Dataclasses `Invoice`, `LineItem`, `CreateInvoiceInput`, `UpdateInvoiceInput`, `CancelInvoiceInput`, IDs |
| `invoices/schemas.py` | 220 | `LineItemInput`, `CreateInvoiceRequest`, `UpdateInvoiceRequest`, `CancelInvoiceRequest`, `LineItemResponse`, `InvoiceResponse` (≈55 Felder, siehe unten), `InvoiceWithItemsResponse` |
| `invoices/repository.py` | 485 | `InvoiceRepository` auf Tabelle `invoices` (snake_case), Storno-Erzeugung |
| `invoices/router.py` | 351 | Prefix `/invoices` |
| `invoices/pdf_service.py` | 343 | `InvoicePdfService`: HTML-Vorlage → **WeasyPrint** → Upload in Supabase Storage |
| `invoices/pdf_router.py` | 90 | Prefix `/invoices/pdf` (in main.py zusätzlich unter `/api/v1/invoices` eingehängt → effektiv `/api/v1/invoices/invoices/pdf/…`) |
| `recurring_invoices/__init__.py` | 1 | — |
| `recurring_invoices/schemas.py` | 149 | `RecurringInterval`, `RecurringStatus`, `RecurringInvoiceItem`, `RecurringInvoiceTemplate`, Create/Update/Status-Requests, `RecurringInvoiceStats`, List/Generated-Responses |
| `recurring_invoices/repository.py` | 192 | speichert Vorlagen **in `invoices`** mit Filter `is_recurring_template = true`, `recurring_status` |
| `recurring_invoices/router.py` | 310 | Prefix `/recurring-invoices` |
| `invoice_validation/__init__.py` | 1 | — |
| `invoice_validation/schemas.py` | 56 | `TaxRuleType`, `ReverseChargeInfo`, `InvoiceValidationRequest`, `ValidationResult`, `TaxRateValidationRequest/Result` |
| `invoice_validation/router.py` | 154 | Prefix `/invoice-validation` — reine Regelprüfung, keine DB |
| `einvoice/__init__.py` | 1 | — |
| `einvoice/schemas.py` | 240 | Enums `EInvoiceFormat`, `EInvoiceStandard`, `ValidationStatus`, `TransmissionStatus`, `TransmissionMethod`, `RecipientType`, `ConformanceLevel`; Modelle `EInvoiceData`, `PeppolSettings`, `XRechnungSettings`, `ValidationSettings`, `TSESettings`, `EInvoiceSettings`, `XRechnungMetadata`, `ZUGFeRDMetadata`, `TSEData`, Requests/Responses |
| `einvoice/repository.py` | 126 | `EInvoiceRepository` auf Tabellen **`einvoices`** und **`einvoice_settings`** |
| `einvoice/xml_generator.py` | 488 | ZUGFeRD-/XRechnung-XML per String-Templates (kein Paket) |
| `einvoice/validator.py` | 137 | Struktur-/Pflichtfeldprüfung mit `defusedxml` — **kein** externer Validierungsdienst (kein KoSIT-Validator, kein Mustang) |
| `einvoice/router.py` | 265 | Prefix `/einvoice` |
| `datev/__init__.py` | 1 | — |
| `datev/schemas.py` | 113 | Enums `DatevAccountType`, `DatevOrganizationType`, `DatevExportType` (MOVEMENTS/ACCOUNTS/CUSTOMERS/VENDORS), `DatevExportFormat` (DATEV_ASCII/DATEV_XML/CSV), `DatevExportStatus`; `DatevAddress`, `DatevOrganization`, `DatevAccount`, `DatevAccountsResponse`, `DatevExportJobRequest`, `DatevExportJob` |
| `datev/router.py` | 196 | Prefix `/datev` — **vollständig Platzhalter**: jede Funktion trägt „placeholder", Auth-URL zeigt auf `https://sandbox.datev.invalid`, Tokens sind `mock_access_…`, `/validate` gibt immer `{"valid": true}`; keine DB, kein HTTP-Aufruf |

#### Endpunkte (61 in den sechs Slices)

**`/api/v1/finance` (16)** — Auth `CurrentUserId`
- `POST /ocr/extract-receipt` `extract_receipt` — Beleg-OCR über Taskilo-KI
- `GET /invoices` `list_invoices` — Filter+Pagination · `GET /invoices/{id}` `get_invoice` · `POST /invoices` `create_invoice` · `POST /invoices/{id}/status` `update_invoice_status` · `PUT /invoices/{id}` `update_invoice` · `DELETE /invoices/{id}` `delete_invoice`
- `GET /customers` `list_customers` · `GET /customers/{id}` `get_customer` · `POST /customers` `create_customer` · `PUT /customers/{id}` `update_customer` · `DELETE /customers/{id}` `delete_customer` · `POST /customers/{id}/address` `add_customer_address` · `POST /customers/{id}/contact` `add_customer_contact`
- `POST /sync/order-to-invoice/{order_id}` `sync_single_order` · `POST /sync/order-to-invoice` `sync_batch_orders`

**`/api/v1/invoices` (9) + PDF (1)** — Auth `AccessToken` + `CurrentUserId`, RLS über User-Token
- `GET ""` `get_invoices_by_query` · `GET /company/{company_id}` `get_company_invoices` · `GET /customer/{customer_id}` `get_customer_invoices` · `GET /{invoice_id}` `get_invoice`
- `POST /company/{company_id}` `create_invoice` (201) · `PATCH /{invoice_id}` `update_invoice` · `GET /{invoice_id}/storno` `get_storno_for_invoice` · `POST /{invoice_id}/cancel` `cancel_invoice` (erzeugt Storno-Rechnung, 201) · `DELETE /{invoice_id}` (204)
- `POST /invoices/pdf/{invoice_id}/generate` `generate_invoice_pdf` (WeasyPrint → Storage → `pdf_url`)

**`/api/v1/recurring-invoices` (10)** — Auth `AccessToken`
- `GET ""` `get_recurring_invoices` · `GET /{template_id}` · `POST ""` `create_recurring_invoice` · `PUT /{template_id}` · `PUT /{template_id}/status` · `DELETE /{template_id}` (soft) · `DELETE /{template_id}/hard` · `GET /customer/{customer_id}` · `GET /{template_id}/generated` · `GET /stats` (steht NACH `/{template_id}` — wird von diesem verschattet)

**`/api/v1/invoice-validation` (2)** — keine Auth-Dependency
- `POST /validate-tax-rules` `validate_tax_rules` · `POST /validate-tax-rate` `validate_tax_rate`

**`/api/v1/einvoice` (9)** — Auth `AccessToken` bei DB-Endpunkten; `generate/*` und `validate*` ohne Auth
- `POST ""` `create_einvoice` · `GET /company/{company_id}` · `GET /{einvoice_id}` · `POST /generate/zugferd` · `POST /generate/xrechnung` · `POST /validate` · `POST /validate/xml` · `GET /settings/{company_id}` · `PUT /settings`

**`/api/v1/datev` (14, alle Platzhalter, keine Auth)**
- `GET /accounts` (leere Liste) · `POST /export` (Job PENDING, nicht persistiert) · `GET /export/{job_id}` (statischer Job) · `POST /auth` · `POST /auth-url` · `GET /callback` · `GET /debug` · `POST /debug` · `POST /disconnect` · `POST /refresh` · `POST /refresh-token` · `GET /test-sandbox-connection` · `GET /userinfo-test` · `GET /validate`

#### Angrenzende Finanz-Slices (nicht angefragt, aber vom Finanz-Frontend aufgerufen) — 72 weitere Endpunkte

| Slice | Prefix | Dateien/Zeilen | Endpunkte |
|---|---|---|---|
| `gobd` | `/gobd` | repository 452, router 221, schemas 213 | `POST /lock/auto`, `POST /lock/manual`, `POST /lock/period`, `POST /storno`, `GET /settings/{company_id}`, `PUT /settings`, `GET /compliance-report` (7); Tabellen `invoices`, `gobd_settings`, `gobd_period_locks` |
| `fixed_assets` | `/fixed-assets` | domain 96, repository 247, router 196, schemas 88 | CRUD 5 (`GET /company/{id}`, `GET/{id}`, `POST`, `PATCH`, `DELETE`); Spalten `datev_account_number`, `afa_account_number`, `is_gwg`, `is_sammelposten` |
| `tax` | `/tax` | domain 103, repository 166, router 205, schemas 67 | CRUD 5 auf `tax_reports` |
| `number_sequences` | `/number-sequences` | domain 79, repository 153, router 267, schemas 94 | `POST`, `GET /company/{id}`, `GET /company/{id}/type/{sequence_type}`, `GET /{seq_id}`, `POST /{seq_id}/increment`, `PATCH`, `DELETE` (7) |
| `expenses` | `/expenses` | domain 105, repository 248, router 307, schemas 74 | 6 (Query, `/company/{id}`, `/{id}`, POST, PATCH, DELETE) |
| `quotes` | `/quotes` | domain 101, repository 244, router 299, schemas 88, `settings/` | 7; Tabellen `quotes`, `quote_items` |
| `reminders` | `/reminders` | repository 77, router 210 | `GET`, `POST`, `PATCH /{id}/status` (3) — Response `dict[str, Any]` |
| `delivery_notes` | `/delivery-notes` | domain 146, repository 129, router 226, schemas 160 | 6 |
| `transaction_links` | (ohne Prefix) | router 333 | `GET/POST /companies/{id}/transaction-links`, `DELETE /companies/{id}/transaction-links/{link_id}`, `PATCH …/booking-status`, `GET /transaction-links`, `DELETE /transaction-links/{link_id}` (6) |
| `finapi` | `/finapi` (auch unter `/api`) | router 167, service 339 | `GET /transactions`, `GET /accounts-enhanced`, `GET /bank-connections`, `GET /banks`, `POST /webform`, `POST /disconnect` (6) — finAPI-Banking |
| `revolut` | `/revolut` | router 224, schemas 198, service 394 | 14 (OAuth, accounts, transactions, payments, counterparties, webhooks) — Revolut Business API |

#### Datenmodell — DB-Tabellen (Live-Schema)

Migrationen: `apps/baas/supabase/migrations/20260221100000_live_schema.sql` (11 596 Zeilen, 137 `CREATE TABLE`, 136 `ENABLE ROW LEVEL SECURITY`) ist die einzige Finanz-Migration; die 21 späteren Migrationen betreffen Storage, Webmail, KI, Drive, Notes, Tasks. Ältere Einzelmigrationen liegen nur noch in `migrations_backup/` (`…create_reminders_table.sql`, `…create_transaction_links_table.sql`, `…create_products_table.sql`, `…add_tax_and_profit_estimation.sql`, `…add_invoice_status_to_orders.sql`). `apps/backend/api/migrations/` enthält 6 SQL-Dateien, keine davon Finanz. Generierte Typen: `apps/baas/supabase/database.types.ts` (6 483 Z.).
RLS-Policies der Finanztabellen sind **nicht mandantenscharf**: z. B. `CREATE POLICY "Access invoices" ON public.invoices TO authenticated USING (true) WITH CHECK (true)` (ebenso `customers`, `expenses`, `e_invoices`).

Finanz-Tabellen im Live-Schema (Auswahl der 137): `invoices`, `invoice_line_items`, `e_invoices`, `e_invoice_settings`, `e_invoice_transmission_logs`, `e_invoice_recipient_settings`, `datev_tokens`, `number_sequences`, `gobd_settings`, `gobd_period_locks`, `gobd_audit_log`, `expenses`, `fixed_assets`, `quotes`, `delivery_notes`, `delivery_note_settings`, `delivery_note_templates`, `tax_reports`, `tax_settings`, `transaction_links`, `booking_accounts`, `payment_accounts`, `customers`, `customer_addresses`, `customer_contacts`, `customer_activities`, `products`, `inventory`, `inventory_snapshots`, `inventory_count_items`, `bank_verifications`, `processed_revolut_transactions`, `module_invoices` (Plattform-Abos), `platform_fee_invoices`, `marketplace_publishing_fee_invoices`, `escrow_transactions`, `order_time_tracking`, `time_tracking_settings`.

**`invoices`** (Kern): `id, company_id, customer_id, invoice_number, invoice_prefix, invoice_year, invoice_sequence, invoice_type (invoice|credit_note|storno|recurring), status (draft|sent|paid|…), original_invoice_id, storno_reason, customer_name/email/address/vat_id/tax_number, invoice_date, due_date, delivery_date, line_items jsonb, net_amount, tax_amount, gross_amount numeric(15,2), tax_rate numeric(5,2) DEFAULT 19, is_kleinunternehmer, kleinunternehmer_text, payment_terms_text/days, e_invoice_format, e_invoice_xml, leitweg_id, pdf_url, pdf_generated_at, paid_amount, paid_at, reminder_count, last_reminder_at, internal_notes, customer_notes, sent_at, deleted_at, gobd_status jsonb, is_locked, locked_at, locked_by, document_type, storno_document_id, metadata jsonb, order_id, synced_from_order, sync_metadata jsonb, created_at, updated_at`.
**`invoice_line_items`**: `invoice_id, position, description, quantity, unit ('Stück'), unit_price, tax_rate, discount_percent, net/tax/gross_amount, sku, notes`.
**`e_invoices`**: `company_id, invoice_id, format (xrechnung|zugferd|factur…), xml_content, pdf_url, status (pending|generated|sent…), leitweg_id, buyer_reference, error_message, generated_at`. **`e_invoice_settings`**: `default_format, leitweg_id, auto_generate, auto_send, email_template`. **`e_invoice_transmission_logs`**: `e_invoice_id, transmission_type (email|…), recipient, status, sent_at, delivered_at`. **`e_invoice_recipient_settings`**: `customer_id, preferred_format, leitweg_id, email, peppol_id, auto_send`.
**`datev_tokens`**: `user_id, access_token, refresh_token, expires_at bigint, token_type, organization_id, is_revoked, revoked_at`.
**`number_sequences`**: `company_id, sequence_type, current_year, current_number, prefix, suffix, format_pattern ('{PREFIX}{YEAR}-{NUMBER}'), number_padding 4, firebase_company_id, can_edit, can_delete`.
**`gobd_settings`**: `auto_lock_on_send, lock_delay_days, auto_lock_on_export, lock_deadline_days, allow_storno_after_lock, require_approval_for_unlock, notification_settings jsonb`. **`gobd_period_locks`**: `year, month, locked_at, locked_by, period, document_count, total_amount, document_types, audit_trail`. **`gobd_audit_log`**: `document_type, document_id, action, old_data, new_data, user_id, ip_address`.
**`expenses`**: `supplier_id, category, subcategory, supplier_name, net/tax/gross_amount, tax_rate, expense_date, booking_date, receipt_url, receipt_number, expense_type (one_time|recurring|asset), recurring_interval, booking_account, cost_center, status, paid_at`.
**`quotes`**: wie invoices (quote_number/prefix/year/sequence, valid_until, converted_invoice_id, line_items jsonb). **`fixed_assets`**: `purchase_value, current_value, salvage_value, depreciation_method, useful_life_years, is_gwg, is_sammelposten, datev_account_number, afa_account_number, disposal_*`. **`tax_reports`**: `type, period, year, data jsonb, status, submitted_at`. **`transaction_links`**: `transaction_id, document_id/type/number/date/amount, booking_status, booking_account jsonb, transaction_data jsonb, document_data jsonb, amount_difference(_reason)`. **`booking_accounts`**: `number, name, type, category, automatic_booking, tax_relevant, is_favorite, usage_count`. **`payment_accounts`**: `name, iban, bic, bank_name, type, balance, currency DEFAULT 'EUR', is_default`. **`customers`**: `customer_number, name, email, phone, street, house_number, city, postal_code, country DEFAULT 'DE', tax_number, vat_id, vat_validated, is_supplier, customer_type, contact_persons jsonb, default_payment_days 14, credit_limit, open_balance`.

**Beobachtete Abweichungen Code ↔ Schema (nur Befund, nicht bewertet):**
- `einvoice/repository.py` schreibt in `einvoices`/`einvoice_settings`; im Live-Schema existieren nur `e_invoices`/`e_invoice_settings` (kein `CREATE TABLE public.einvoice…`).
- `recurring_invoices/repository.py` filtert `invoices` auf `is_recurring_template`/`recurring_status`; beide Spalten kommen im Live-Schema nicht vor.
- `finance/sync_service.py` und `finance/router.py` filtern `invoices`/`orders` mit camelCase (`companyId`, `orderId`); `invoices` ist snake_case.
- Das Frontend ruft `/api/v1/invoices/next-number/{companyId}`, `/api/v1/customers/next-number/{id}`, `/api/v1/number-sequences/{id}/create-defaults`, `/api/v1/quotes/{id}/convert-to-invoice`, `/api/v1/recurring-invoices/{id}/execute`, `/api/v1/invoices/{id}/storno` (POST) auf — keiner dieser Pfade existiert im Backend (`grep` ohne Treffer).
- `reminders` und `quote_items` haben Repositories, aber im Live-Schema kein `CREATE TABLE` (die alte `create_reminders_table.sql` liegt nur in `migrations_backup/`).

#### Externe Dienste

| Dienst | Wo | Stand |
|---|---|---|
| **Taskilo-KI** (eigener Dienst, `apps/backend/ki`) | `finance/ocr_service.py` → `http://taskilo-ki:8000` | produktiv angebunden (OCR/Extraktion) |
| **Supabase** (PostgREST + Storage) | alle Repositories, `pdf_service.py` | produktiv |
| **WeasyPrint** | `invoices/pdf_service.py` | PDF-Erzeugung im Backend |
| **DATEV** | `datev/router.py` | nur Attrappe (`sandbox.datev.invalid`, Mock-Tokens); echte Sandbox-URLs (`login.datev.de/openidsandbox`, `sandbox-api.datev.de`) stehen nur im **Frontend** (`lib/datev-config.ts`, `lib/datev-api-client.ts`, 452 Z.: cashregister:import, master-clients, extf-files, dxso-jobs, documents), und `services/datevService.ts` ruft `/api/datev…` (Next-Route) — ein Ordner `app/api` existiert in `apps/frontend/app/src` nicht mehr |
| **XRechnung/ZUGFeRD-Validierung** | `einvoice/validator.py` | eigene Pflichtfeldprüfung mit defusedxml, kein externer Validator |
| **finAPI**, **Revolut Business** | `features/finapi`, `features/revolut` | eigene httpx-Clients (Banking, Zahlungsabgleich) |
| **Stripe** | nur Feld `stripeAccountId` in `features/general/router.py` (Company-Profil) | kein Stripe-SDK, keine Zahlungslogik im Finanzbereich |
| **Mail** | `src/shared/notifications/email.py` (smtplib) | — |

### B5. Finanz-Anteile in anderen Backend-Apps

- **`apps/baas`** (`@taskilo/baas`): reine Supabase-Konfiguration — `config.toml`, `migrations/` (s. o.), `migrations_backup/`, `schema_live.sql` (Duplikat des Live-Schemas), `database.types.ts`, `seed.sql`, `ki-integrations.sql` (nur `gsc_connections`, `ga4_connections`). Kein Code, aber es ist der **Ort aller Finanz-Tabellen** (137 Tabellen im Live-Schema).
- **`apps/backend/ki`** (`taskilo-ki-app`, Python ≥3.11): deutlicher Finanzanteil, 11 269 Zeilen:
  - `src/features/tax/router.py` (691 Z., Prefix `/api/v1/steuer`): `POST /chat`, `POST /berechnung`, **`POST /datev-export`** (echter CSV-Export SKR03/SKR04 über `DATEVClient`), `GET /voranmeldung/{unternehmen_id}`, `GET /fristen`, `GET /optimierung/{id}`, `GET /kleinunternehmer-check/{id}`.
  - `src/shared/integrations/datev_client.py` (665 Z.): `DATEVKontenrahmen`, `DATEVBuchungstyp`, `DATEVBuchung.to_datev_row`, `DATEVExport`, `DATEVClient` (Konten-Mapping, Steuerschlüssel, `exportiere_csv`, EXTF-Header, `validiere_buchung`). Dazu `src/integrations/datev.py` (112 Z., kleinere CSV-Variante).
  - `src/features/documents/` (Prefix `/api/v1/dokumente`): `router.py` 1 071 Z. (classify, upload, batch-upload, korrektur, `ocr/extract`, `ocr/learn`, `ocr/ml/train|status`), `service.py` 967, `bwa_processor.py` 686, `finance_brain.py` 378, `steuerbescheid*.py` (5 Dateien, ≈6 100 Z. — Steuerbescheid-Extraktion).
  - `main.py` bindet außerdem `eric_router` unter `/api/v1/eric` (ERiC/ELSTER) ein.
- **`apps/backend/webmail-api`**: kein Finanzanteil (einziger Treffer „Slot-Berechnung" in `booking/service.py`).

### B6. Frontend → Backend

- **Ein zentraler Wrapper**: `packages/shared/src/lib/api-client.ts` (re-exportiert als `apps/frontend/app/src/lib/api-client.ts`, 1 Zeile). `apiClient<T>(endpoint, options)` hängt `API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'` voran, setzt `Authorization: Bearer <accessToken>` (`requiresAuth` Standard `true`), lässt FormData ohne Content-Type durch, versucht bei 401 einmal `refreshAccessToken()` und wiederholt, sonst `clearAuth()` + Redirect `/`; Fehler werden aus `detail` (String/Array) oder `message` gebaut. Convenience-Objekt `api.get/post/put/patch/delete`. Server-Variante `server-api.ts` (`serverApi`, `cache: 'no-store'`, ohne Token).
- **Token-Speicher**: `packages/shared/src/lib/auth-storage.ts` — `localStorage['tasko_tokens']` + Cookies `tasko_access_token`/`tasko_refresh_token` (js-cookie), Ablauf über `expiresAt`.
- **Auth-Kontext**: `@tasko/shared/contexts/NewAuthContext` (`NewAuthProvider`, `useNewAuth`, `ProtectedRoute`) über `hooks/use-auth.ts`; 55 Finanzdateien lesen daraus `user`/`company`.
- **Pfad-Präfix**: durchgehend `/api/v1/…` im Endpoint-String (Backend `include_router(..., prefix="/api/v1")`). Häufigste Pfade aus dem Finanzcode: `/api/v1/companies/{uid}` (71), `/api/v1/invoices` (25) und `/api/v1/invoices/{id}` (21), `/api/v1/expenses` (22), `/api/v1/customers` (19) und `/{id}` (16), `/api/v1/quotes/{id}` (12), `/api/v1/inline-quote-services` (12), `/api/v1/inline-invoice-services` (11), `/api/v1/generate-pdf-single` (8), `/api/v1/tax-reports` (6), `/api/v1/number-sequences` (4), `/api/v1/finance/customers` (4), `/api/v1/gobd/*`, `/api/v1/einvoice/*`, `/api/v1/recurring-invoices/*`, `/api/v1/fixed-assets/*`, `/api/v1/delivery-notes/*`, `/api/v1/payment-accounts/*`, `/api/v1/booking-accounts/*`, `/api/v1/companies/{uid}/transaction-links`.
- **Service-Schicht** (`apps/frontend/app/src/services/`, Klassen mit statischen Methoden über `api.*`): `financeService.ts` 462, `firestoreInvoiceService.ts` (Rechnungen), `eInvoiceService.ts` 741 (baut XRechnung/ZUGFeRD-XML mit fast-xml-parser, bettet mit pdf-lib ein), `eInvoiceTransmissionService.ts` 381, `autoEInvoiceService.ts` 302, `xrechnungParserService.ts` 440, `gobdService.ts` 212, `numberSequenceService.ts` 183, `recurringInvoiceService.ts` 316, `taxService.ts` 1 097 (UStVA/EÜR/GuV/BWA), `quoteService.ts` 632, `customerService.ts` 270, `deliveryNoteService.ts` 378, `fixedAssetService.ts` 628, `invoiceValidation.ts` 134, `paymentAccountService.ts` 101, `bookingAccountService.ts` 132, `datevService.ts` 309, `datevExportService.ts` 764 (EXTF/DTVF im Browser), `datevCardService.ts` 386, `datevAuswertungsService.ts`, `favoriteDatevAccountService.ts`, `inventoryService.ts`, `TextTemplateService.ts`, `timeTrackingService.ts`, `transaction-link.service.ts`, `invoice-status.service.ts`, `businessReportService.ts`, `usageTrackingService.ts`, `whatsapp-notifications.service.ts`.
- **Ausnahme vom Wrapper**: `datevService.ts` nutzt rohes `fetch('/api/datev' + endpoint)` gegen eine Next-Route, die im Repo nicht (mehr) existiert; `lib/datev-*.ts` (7 Dateien, 1 770 Z.) und `lib/finapi*.ts` (8 Dateien, 2 370 Z.), `lib/revolut*.ts` (3 Dateien, 958 Z.) sind eigene OAuth-/API-Clients.
- Kommentare in mehreren Services („Migriert zu: Frontend → FastAPI → Supabase", „Keine Firebase/Firestore SDK-Abhängigkeiten") belegen die Umstellung von Firebase auf FastAPI; Reste sind nur Namen (`firestoreInvoiceService`, Spalte `firebase_company_id`).

---

## Kurzfassung

- **Pakete**: 8 unter `packages/` (`@tasko/ui`, `@tasko/shared`, `@tasko/business`, `@tasko/tokens`, `@tasko/ts-conf`, `@taskilo/webmail-shared`, `plop`-Vorlagen, `taskilo-auth` Python). `@tasko/ui` ist nachweislich der Ursprung des gleichnamigen Alias im neuen Projekt (`web/vendor/tasko-ui`, byte-identische Komponenten).
- **Frontend-App**: 135 dependencies; das Finanzwerkzeug nutzt davon real 25 (plus Framework): `@tasko/ui`, `@tasko/shared`, `@iconify/react`, `sonner`, `date-fns`, `recharts`, 12 × `@tiptap/*`, `@radix-ui/react-dialog`, `react-pdf`, `pdfjs-dist`, `jspdf`, `html2canvas`, `pdf-lib`, `fast-xml-parser`, `heic2any`, `validate-steuernummer`; transitiv `react-day-picker`, `@fullcalendar/core`. Kein Stripe, kein Supabase-/Firebase-SDK, kein tanstack, kein react-hook-form/zod im Finanzcode.
- **Fehlt in `NextDays/web`**: `react-pdf 10.2.0`, `pdfjs-dist 5.4.296`, `jspdf 4.2.1`, `html2canvas 1.4.1`, `heic2any 0.0.4`, `validate-steuernummer 1.6.0`, `@tiptap/extension-underline 3.4.2`, `@tasko/shared` (API-Client/Auth), transitiv `@fullcalendar/* 6.1.15`.
- **Backend**: 6 angefragte Slices = 30 Dateien, 5 864 Zeilen, 61 Endpunkte (finance 16, invoices 10, recurring 10, validation 2, einvoice 9, datev 14 — alle 14 DATEV-Endpunkte sind Platzhalter); angrenzend weitere 11 Slices mit 72 Endpunkten. Datenmodell: eine Live-Schema-Migration (137 Tabellen), Kern `invoices` mit `line_items jsonb` + `invoice_line_items`, E-Rechnung in `e_invoices`/`e_invoice_settings`/`…_transmission_logs`/`…_recipient_settings`, `datev_tokens`, `number_sequences`, `gobd_*`, `expenses`, `quotes`, `fixed_assets`, `tax_reports`, `transaction_links`, `booking_accounts`, `payment_accounts`, `customers`. Externe Dienste: eigene Taskilo-KI (OCR), Supabase, WeasyPrint, finAPI, Revolut; DATEV echt nur im KI-Backend als CSV-Export.
