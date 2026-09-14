# Taskilo-Inventar — Kompletter Bestand

**Stand:** 2026-06-18 · Grundlage für die Portierung ins NextDays-Dashboard
(`apps/web/app/(dashboard)/`).

> **Architektur entschieden:** [ADR-0009](decisions/0009-taskilo-integration-architektur.md)
> — NextDays-Paradigma (Server Actions + `components/ui`), ein Backend mit Vertical
> Slices (`tenant_id`), eine große Sidebar. Komponenten werden **neu geschrieben**,
> nicht 1:1 kopiert.

**Gesamtumfang:** 612 Komponenten (47 Ordner + 103 Root-Dateien) · 242 Routen ·
9 Backend-Finanz-Slices + `employees`-Slice · ~26 Finanz-DB-Tabellen.

**Rein soll:** Buchhaltung/Finanzen · Marktplatz · HR/Personal · Career/Jobs/Recruiting · gemeinsame Basis.
**Raus bleibt:** Chat · Admin-Dashboard · SEO/Marketing · WhatsApp-Marketing · Taskilo-Advertising.

> Hinweis Stack: Taskilo = Next 16 + `@tasko/ui`. NextDays-Dashboard = Next 15 +
> eigene Tokens. Komponenten werden ans NextDays-Design angepasst (rem,
> rounded-full, Farben, Schrift), nicht 1:1 kopiert. Mandant: `company_id` →
> `tenant_id` (vereinheitlicht).

---

## Komponenten-Ordner nach Bereich (Anzahl)

### ✅ A) BUCHHALTUNG / FINANZEN — 153
| Ordner | # | Inhalt |
| --- | --- | --- |
| `finance/` | 119 | Rechnungen, Angebote, Ausgaben, Kunden, Mahnwesen, Kassenbuch, Steuer, E-Rechnung, Bank, Reports, GoBD (Unterordner: `customer-detail/` 9, `gobd/` 7, `pdf-templates/` 7 + `common/` 10) |
| `accounting/` | 10 | Kontenplan, Nummernkreise, Kostenstellen, Zahlungskonten, DATEV-Konten, Transaktions-Matching |
| `datev/` | 10 | DATEV-Export, Auth, Dashboard, Sync, Steuerberater-Portal |
| `quotes/` | 5 | Angebots-Formulare (zeitbasiert, Antwort, Inventar) |
| `finapi/` | 2 | Banking-Debug, Task-Manager |
| `storno/` | 2 | Storno-Button, Provider-Warnung |
| `steuerberater/` | 2 | Steuerberater-Upload + Portal |
| `invoice/` `invoices/` | 2 | InvoiceItemsCard, ServiceSelection |
| `storage/` | 2 | Speicher-Upgrade/Plan (Billing) |

### ✅ B) MARKTPLATZ — ~110
| Ordner | # | Inhalt |
| --- | --- | --- |
| `subcategory-forms/` | 89 | Service-Kategorie-Formulare (Maler, Elektriker, Buchhaltung, Catering … 1 pro Gewerk) |
| `dashboard/` | 17 | Company-Dashboard-Karten (Sidebar, Umsatz, Top-Kunden, Verträge, offene Rechnungen) |
| `service/` | 8 | Service anlegen/bearbeiten/verwalten + Pakete (Basic/Standard/Premium) + KI-Addons |
| `orders/` | 3 | Auftragsabschluss, Rechnungs-Sektion, Kunden-Billing |
| `services/` | 3 | ProviderCard, ServiceFilters, CategoryFAQ |
| `projects/` | 2 | GanttChart, ResourceHistogram |
| `marketplace/` | 1 | MarketplaceProposalCard |
| `inventory/` | 1 | NewProductModal |
| `level/` | 1 | TaskiloLevelBadge |
| `modals/` | 1 | CompleteOrderModal |

### ✅ C) HR / PERSONAL — 27
| Ordner | # | Inhalt |
| --- | --- | --- |
| `personal/` | 20 | Mitarbeiter-Tabelle, Verträge, Abwesenheit, Qualifikation, Compliance, Disziplinar, Dokumente, Zeiterfassung, Berechtigungen (Unterordner `tabs/` 4: Urlaub/Arbeitszeit) |
| `schedule/` | 3 | Schichtplan (Wochen-/Monats-/Modern-View) |
| `workspace/` | 11 | Arbeitsbereich/Team (s. unten — teils HR, teils Admin-nah → prüfen) |

### ✅ D) GEMEINSAME BASIS (UI/Infra) — wird gebraucht
| Ordner | # | Inhalt |
| --- | --- | --- |
| `dashboard_setting/` | 11 | Firmen-Stammdaten (Bankverbindung, Buchhaltung&Steuern, Logo, Portfolio, Zahlungsziele) |
| `settings/` | 3 | Bank-Verifizierung, Text-Vorlagen |
| `contacts/` | 3 | Kontakt-Detail/Formular/Labels |
| `calendar/` | 14 | Kalender-Komponenten (Termine — prüfen ob HR/Marktplatz) |
| `texteditor/` | 1 | Platzhalter-Modal (Rechnungstexte) |
| `modern-maps/` | 1 | Adress-Autocomplete |
| `guards/` | 1 | ModuleGuard (Feature-Gating) |
| `ki/` | 6 | KI-UI-Bausteine (für KI-Planung/OCR) |
| 103 Root-`.tsx` | 103 | Header, Sidebar, Modals, Provider, Charts, PDF-Viewer u. v. m. (gemischt — pro Datei einordnen) |

> **Auth & Onboarding raus:** `auth/` (LoginForm, RegisterForm, ProtectedRoute)
> und `onboarding/` (12, Firmen-Erstanlage über `companyUid`) gehören NICHT rein —
> NextDays hat eigene Auth (Login, Google-OAuth, `nd_access`, Dashboard-Gate) und
> eigenes Tenant-/Konto-Modell. Würden kollidieren. Onboarding ggf. später als
> Vorlage für ein Buchhaltungs-Onboarding.

### ✅ E) CAREER / JOBS / RECRUITING — 23
| Ordner | # | Inhalt |
| --- | --- | --- |
| `career/` | 12 | Bewerber-Sicht: Profil (Erfahrung, Bildung, Qualifikation, Sprachen, Dokumente), JobCard, Bewerbungs-Dialog/Formular/Button |
| `jobs/` | 7 | Job-Board, Jobfinder-Formular, Suche-Header, Filter-Sidebar |
| `recruiting/` | 4 | Arbeitgeber-Sicht: Stellen erstellen, Bewerbungsliste, Job-Vorschau, Mitarbeiter-Anlage |
- **Routen Bewerber (`dashboard/user/[uid]/career/`):** `/career` · `/jobfinder` · `/profile` · `/applications` · `/jobs` (+ `[jobId]`, `[jobId]/apply`)
- **Routen Arbeitgeber (`dashboard/company/[uid]/recruiting/`):** `/recruiting` · `/profile` · `/applications` (+ `[applicationId]`) · `/[jobId]` · `/create`
- **Backend-Slices:** `jobs`, `job_applications`

### ❌ F) RAUS — wird NICHT portiert — ~112
| Ordner | # | Grund |
| --- | --- | --- |
| `whatsapp/` | 44 | WhatsApp-Marketing-Integration |
| `taskilo-advertising/` | 27 | Google/Meta-Ads-Werbung |
| `admin/` | 19 | Admin-Dashboard |
| `admin-workspace/` | 13 | Admin-Workspace |
| `onboarding/` | 12 | Firmen-Erstanlage (companyUid) — kollidiert mit NextDays-Konto/Tenant |
| `logos/` | 6 | Marketing-Logos |
| `auth/` | 3 | Login/Register/ProtectedRoute — NextDays hat eigene Auth |
| `chat/` | 2 | Chat |
| `seo/` `support/` `newsletter/` `hilfe/` `debug/` | je 1 | SEO/Marketing/Support/Debug |

---

## Routen (242 page.tsx) — Geschäftsbereiche

### Buchhaltung (`dashboard/company/[uid]/`)
- **Rechnungen:** `/finance/invoices` (+ create, [id], [id]/edit, recurring, recurring/create)
- **Angebote:** `/finance/quotes` (+ create, [id], [id]/edit, drafts, sent, accepted)
- **Ausgaben:** `/finance/expenses` (+ create, [id], [id]/edit, recurring, assets=Anlagevermögen)
- **Kunden/Kontakte:** `/finance/customers/create`, `/finance/contacts` (+ new, [id], edit), `/finance/suppliers`
- **Mahnwesen:** `/finance/reminders` (+ create)
- **Kontenplan:** `/finance/accounting` (Tabs)
- **Kassenbuch:** `/finance/cashbook`, `/banking/cashbook`
- **Steuer:** `/finance/taxes` (+ eur, prepayment, wizard mit 5 Schritten)
- **E-Rechnung:** `/finance/einvoices`
- **Lieferscheine:** `/finance/delivery-notes` (+ create)
- **Berichte:** `/finance/reports`
- **Weitere:** `/finance/payments`, `/projects`, `/credits`, `/order-confirmations`, `/inventory`, `/time-tracking`, `/settings`
- **DATEV:** `/datev` (+ overview, setup, export/*, debug), Top-Level `/datev`, `/datev-test`
- **Bank:** `/banking` (+ accounts, transactions, incomplete-transactions, reconciliation, connect, import, receipt, webform), `/revolut/oauth-success`
- **PDF-Druck:** `/print/[type]/[companyId]/[id]`

### Marktplatz
- **Kunde (`dashboard/user/[uid]`):** `/projects` (+ create, [id]), `/orders` (+ overview, [id]), `/quotes` (+ received, [id]), `/provider/[id]`
- **Anbieter (`dashboard/company/[uid]`):** `/marketplace/projects` (+ [id], proposals, quotes, project-quotes), `/orders` (+ overview/incoming/created/completed/cancelled, [id]), `/quotes` (incoming, received), `/provider`, `/services/[cat]/[subcat]`

### HR (`dashboard/company/[uid]/personal/`) — 18 Routen
`/personal` · `/employees` (+ [id]) · `/edit/[id]` · `/add` · `/absence` · `/schedule`
(+ wish-times) · `/costs` · `/auswertung` · `/ai-planning` · `/eau` · `/gps-check` ·
`/integrations` · `/timesheet` · `/payroll` · `/analytics` · `/mobile`
- Backend-Slice: `employees`

### Career/Jobs/Recruiting
- **Bewerber (`dashboard/user/[uid]/career/`):** `/career` · `/jobfinder` · `/profile` · `/applications` · `/jobs` (+ `[jobId]`, `[jobId]/apply`)
- **Arbeitgeber (`dashboard/company/[uid]/recruiting/`):** `/recruiting` · `/profile` · `/applications` (+ `[applicationId]`) · `/[jobId]` · `/create`
- Backend-Slices: `jobs`, `job_applications`

### ❌ Raus: `dashboard/admin/*`, Chat-Routen, SEO/Landingpages, whatsapp, advertising

---

## Backend (FastAPI-Slices)
**Finanz:** `invoices`, `recurring_invoices`, `invoice_validation`, `einvoice`,
`tax`, `datev`, `finance`, `transaction_links`, `finapi`
**HR:** `employees`
**Marktplatz:** (in `dashboard/company`+`user`-APIs — noch zu kartieren)

## DB — Finanz (~26 Tabellen)
`invoices`, `invoice_line_items`, `quotes`, `customers`, `expenses`, `fixed_assets`,
`booking_accounts`, `payment_accounts`, `tax_settings`, `tax_reports`,
`transaction_links`, `processed_revolut_transactions`, `e_invoices` (+ settings,
recipient_settings, transmission_logs), `gobd_settings`/`audit_log`/`period_locks`,
`datev_tokens`, `receipt_categorization_logs`, `companies` (→ `tenants`)
+ HR-Tabellen (employees, absences, contracts, …) + Marktplatz (projects, orders,
proposals, …) — noch zu kartieren.

---

## Status & nächste Schritte

> **Stand vom 11.09.2026:** Der tatsächliche Übernahmestand (63 von 325 Dateien,
> 13 Aufrufe ins Leere, fehlende Bibliotheken, Doku-Drift) steht in
> [buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md](buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md).
> Dieses Dokument beschreibt den Plan vom 18.06.2026.

- [x] Komplett-Inventur Frontend-Komponenten (612) + Routen (242)
- [ ] Root-`.tsx` (103) einzeln einordnen (Buchhaltung/Marktplatz/HR/Basis/raus)
- [ ] HR- + Marktplatz-DB-Tabellen kartieren
- [ ] Dashboard-Navigation (Sidebar) für alle Bereiche entwerfen
- [ ] Portierungsreihenfolge festlegen → erstes Modul anpassen
