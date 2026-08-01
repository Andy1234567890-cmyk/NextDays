# Integrations-Analyse: Taskilo-Buchhaltung → NextDays („My Next")

**Stand:** 2026-06-18 · **Status:** Analyse (noch nichts verschoben)
**Ziel:** Die Buchhaltungs-/Finanz-Module aus
[`Andy54411/taskilo-platform`](https://github.com/Andy54411/taskilo-platform)
ins lokale **NextDays**-Monorepo integrieren (alles unter „My Next"),
**ohne Webmailer** (Mail/Drive/Meet/Chat/Photos/Notes/KI bleiben draußen).
Git-Historie beider Projekte soll erhalten bleiben (subtree). DB-Ziel: Buchhaltungs-Schema
ins **bestehende NextDays-Supabase** mergen.

---

## 1. Was Taskilo an Buchhaltung mitbringt

Taskilo enthält eine **produktionsreife, deutschland-spezifische Buchhaltung** —
deutlich umfangreicher als ein „Finanzen"-Tab. Kernbausteine:

### Backend (`apps/backend/api/src/features/`, FastAPI, Python 3.12)

| Feature                        | Zweck                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `invoices`                     | Rechnungen (Draft→Sent→Paid), Storno, Kleinunternehmer §19, GoBD-Lock, PDF (WeasyPrint)     |
| `recurring_invoices`           | Serienrechnungen (Templates, Intervall, Auto-Versand, APScheduler)                          |
| `invoice_validation`           | Steuerregel-Validierung (8 Typen: §19, Reverse Charge 13b/18b, §4 UStG, EU-OSS, Export)     |
| `einvoice`                     | E-Rechnung: ZUGFeRD + XRechnung (EN16931/UBL), XML-Generator + Validator, Peppol/Leitweg-ID |
| `tax`                          | Steuerberichte UStVA/EÜR/GuV/BWA + ELSTER-Anbindung (vorbereitet)                           |
| `datev`                        | DATEV-Export (OAuth2, ASCII/CSV), aktuell Mock — echte API ausstehend                       |
| `finance`                      | Beleg-OCR (Taskilo-KI), Order→Invoice-Sync, Kunden/Adressen                                 |
| `transaction_links` + `finapi` | Bankabgleich (FinAPI XS2A/FinTS), Transaktion↔Beleg-Zuordnung                               |

**Buchhaltungs-Python-Deps:** `weasyprint` (PDF), `defusedxml` (E-Invoice),
`apscheduler` (Serienrechnungen), `httpx` (OCR/FinAPI/DATEV), `orjson`, `python-dateutil`.

### Frontend (`apps/frontend/app` = `@taskilo/app`, **Next.js 16**, React 19)

- Routen: `/datev`, `/datev-test`, `/print/[type]/[companyId]/[id]` (PDF-Druck),
  `/payment`, `/revolut/oauth-success`, `/dashboard/admin/storno-management`.
- Features: Rechnungserstellung, E-Rechnung-Dashboard, DATEV-Export, GoBD-Lock/Audit,
  Bankabgleich (FinAPI + Revolut), OCR-Belegerfassung, Steuer-Wizard, Mahnwesen,
  Kassenbuch, Angebote, Lieferscheine, Anlagevermögen/AfA.
- **Workspace-Abhängigkeiten:** `@tasko/business`, `@tasko/shared`, `@tasko/ui`,
  `@tasko/ts-conf` — müssen mitkommen.
- Buchhaltungs-npm-Deps: `@react-pdf/renderer`, `jspdf`, `pdf-lib`, `pdfjs-dist`,
  `finapi-client`, `validate-steuernummer`, `@tanstack/react-table`, `recharts`,
  `fast-xml-parser`, `jszip` (DATEV-Export), `zod`, `jose`.

### Datenbank (Supabase) — **~26 Buchhaltungs-Tabellen**

`invoices`, `invoice_line_items`, `quotes`, `customers`, `expenses`, `fixed_assets`,
`booking_accounts` (Kontenplan SKR03/04), `payment_accounts`, `tax_settings`,
`tax_reports`, `transaction_links`, `processed_revolut_transactions`,
`e_invoices` (+ `_settings`, `_recipient_settings`, `_transmission_logs`),
`gobd_settings`/`gobd_audit_log`/`gobd_period_locks`, `datev_tokens`,
`receipt_categorization_logs`, u. a. Zentrale Mandanten-Tabelle: **`companies`**.

---

## 2. Die zentralen Konflikte (warum kein simples Kopieren)

| Thema                 | NextDays                                                                    | Taskilo                                                                       | Auswirkung                                                                     |
| --------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Frontend Next.js**  | **15** (`apps/web`)                                                         | **16** (`apps/frontend/app`)                                                  | Buchhaltung **nicht** in `apps/web` mergebar → als **eigene App** ins Monorepo |
| **Mandanten-Konzept** | `tenant_id` (Vermieter = Tenant)                                            | `company_id` (Firma, `companies.owner_id`)                                    | **Schlüssel-Entscheidung** — siehe §4                                          |
| **Build-System**      | einfaches bun-Setup                                                         | Turbo + bun-Workspaces + `@tasko/*`                                           | Workspace-Pakete + ggf. Turbo nötig                                            |
| **Backend**           | FastAPI Vertical Slices, eigene `users`/`tenants`                           | FastAPI, `companies`-zentriert                                                | Beide FastAPI/3.12 → gut kombinierbar, aber 2 getrennte Slices-Welten          |
| **Supabase**          | 22 Migrationen, RLS auf `tenant_id`                                         | 22+ Migrationen, RLS auf `company_id` (via `companies.owner_id = auth.uid()`) | Schema-Merge nötig (gewünscht) — Konflikt bei `customers`, `payments` möglich  |
| **Auth**              | Supabase-JWT, `tenant_id`/`role` in app_metadata, Capability+..-Permissions | Supabase-JWT, `auth.uid()`→`companies`                                        | JWT-Quelle gleich (Supabase) → vereinbar                                       |

**Namens-/Überlappungs-Risiken beim DB-Merge:** Taskilo bringt eigene `customers`-
und (im finance-Slice) `invoices`-Strukturen mit; NextDays hat bereits `payments`
und einen `marketplace`-Bereich. Vor dem Merge muss tabellenweise auf Namens-
kollisionen geprüft werden.

---

## 3. Empfohlene Ziel-Struktur im NextDays-Monorepo

```
NextDays/  (→ „My Next")
├── apps/
│   ├── api/            (bestehend — NextDays-PMS-Backend, FastAPI)
│   ├── web/            (bestehend — Next 15, PMS-Dashboard)
│   ├── mobile-bestdays/ · mobile-nextdays/   (bestehend — React Native, 2 Apps)
│   ├── storybook/      (bestehend)
│   ├── buchhaltung/    ← NEU: @taskilo/app (Next 16), nur Buchhaltungs-Routen
│   └── buchhaltung-api/← NEU: Taskilo-Backend, nur Finanz-Slices
├── packages/
│   ├── (bestehend)
│   ├── tasko-ui/       ← NEU (aus @tasko/ui), von buchhaltung benötigt
│   ├── tasko-shared/   ← NEU (aus @tasko/shared)
│   └── tasko-business/ ← NEU (aus @tasko/business)
└── supabase/
    └── migrations/     ← Buchhaltungs-Migrationen eingegliedert (Nummern 0023+)
```

Begründung: Wegen Next 15↔16 laufen die zwei Frontends **getrennt** (eigene Ports),
aber im selben Monorepo. Verschmelzung der UI kommt später; zuerst „beide unter
einem Dach, lauffähig".

---

## 4. Mandanten-Konzept: **ENTSCHIEDEN → Vereinheitlichen**

**Entscheidung (2026-06-18):** Ein gemeinsames Mandanten-Konzept — `tenant` = `company`.
Die Taskilo-Buchhaltungs-Tabellen werden von `company_id` auf **`tenant_id`** umgestellt,
inkl. aller Fremdschlüssel und RLS-Policies (statt `companies.owner_id = auth.uid()`
künftig die NextDays-Tenant-Logik).

Konsequenzen für den Merge:

- `companies` → wird auf NextDays-`tenants` abgebildet; firmenspezifische
  Buchhaltungs-Felder (`tax_number`, `vat_id`, `iban`, `is_kleinunternehmer`,
  `e_invoice_format`, `leitweg_id`, Skonto …) wandern als Spalten/JSONB an `tenants`
  oder in eine `tenant_billing_profile`-1:1-Tabelle.
- Jede Buchhaltungs-Tabelle: `company_id uuid` → `tenant_id uuid` (FK auf `tenants`),
  RLS auf NextDays-Tenant-Zugehörigkeit umschreiben.
- `customers` (Taskilo) ggf. mit bestehenden NextDays-Strukturen abgleichen.

---

## 5. Migrationsplan (Vorschlag, schrittweise & jederzeit lauffähig)

1. **Subtree-Import** (Historie erhalten): `taskilo-platform` als `git subtree` unter
   einem temporären Pfad einhängen → `apps/buchhaltung`, `apps/buchhaltung-api`,
   `packages/tasko-*` herausschälen, Rest (Webmail/Drive/Meet/…) **nicht** übernehmen.
2. **Workspace verdrahten:** `@tasko/*`-Pakete ins NextDays-Workspace aufnehmen,
   Paketnamen ggf. anpassen, Abhängigkeiten installieren, isoliert builden.
3. **Buchhaltungs-Backend** als zweites FastAPI (eigener Port) starten; nur Finanz-
   Slices behalten (Mail/KI/Webmail-Slices entfernen).
4. **DB-Merge** (nach Entscheidung §4): Buchhaltungs-Migrationen als `0023+` ins
   NextDays-Supabase übernehmen, Kollisionen (`customers`, `invoices`, `payments`)
   auflösen, RLS auf gewähltes Mandanten-Konzept umstellen.
5. **Auth-Brücke:** Buchhaltung nutzt dieselbe Supabase-Session; `company`↔`tenant`
   gemäß §4 verbinden.
6. **UI-Einstieg:** Aus dem NextDays-Dashboard auf die Buchhaltungs-App verlinken
   (später echte Verschmelzung).
7. **Doku/Diagramme** (ARCHITECTURE.md, API.md) nachziehen.

---

## 6. Aufwand & Risiko (grob)

- **Subtree + Pakete lauffähig machen:** mittel (Workspace-/Turbo-Verdrahtung, Next-16-Build).
- **Backend-Slices isolieren:** mittel (Abhängigkeiten zu Mail/KI kappen).
- **DB-Merge:** **hoch** (26 Tabellen, RLS, Mandanten-Konzept, Kollisionen) — der
  kritischste, am sorgfältigsten zu planende Schritt.
- **Webmailer-Ausschluss:** Klar abgrenzbar — Mail/Drive/Meet/Photos/Notes/KI bleiben
  komplett draußen; nur `finance/invoices/tax/datev/einvoice`-Pfad kommt mit.

---

## 7. Roadmap & Fortschritt

**Strategie (REVIDIERT):** Die echten Taskilo-Komponenten werden **1:1 übernommen**
(unveränderter Inhalt/Logik/JSX), nicht nachgebaut — der frühere Neuaufbau-Ansatz
lieferte nur dünne Attrappen ohne GoBD-Logik. Möglich wird das, weil `@tasko/ui`
reines Radix + Tailwind v4 ist (identische Basis wie NextDays `components/ui`).

**Einbindungs-Mechanik:**

- `@tasko/ui` liegt als Vendor-Paket unter `apps/web/vendor/tasko-ui/` (48 Radix-
  Komponenten, 1:1), eingebunden per tsconfig-Alias `@tasko/ui`. Die Finance-
  Komponenten importieren `from '@tasko/ui'` unverändert.
- Bestands-Services reden über `apps/web/lib/api-client.ts` (signaturgleich zum
  Tasko-Client). Dieser zeigt auf den **eigenen Origin** und trifft den
  **Next.js-Proxy** `app/api/v1/[...path]/route.ts`, der server-seitig das
  httpOnly-Session-Token (`currentToken()`, FastAPI-Cookie **oder** Supabase-OAuth)
  injiziert und an FastAPI weiterreicht. Pfade werden im api-client gemappt
  (`/api/v1/invoices` → `/api/v1/buchhaltung/invoices`, ebenso customers,
  companies, booking-accounts, quotes, number-sequences, inline-invoice-services).
- `contexts/NewAuthContext.tsx` ist ein dünner Adapter: `useNewAuth().user.uid`
  liefert die `tenant_id` aus der Session (Provider von einer Server-Hülle gefüllt).
  Bestandskomponenten bleiben unverändert; einzige Adaption in der Erstellen-Seite
  ist die `uid`-Herkunft (Session statt `[uid]`-Route, 1 Zeile).
- Hartcodiertes Taskilo-Türkis (`#14ad9f`, 333× in 37 Dateien) → NextDays-`accent`
  (Logo-Rot `#b82028`); PDF-Templates nutzen den konkreten Hex. „Taskilo"-Branding
  durchgängig auf „NextDays" umgestellt.

- [x] **Schritt 1 — DB-Fundament** (`0023`, `0024`, `0025`):
      `tenant_billing_profile`, `customers`, `invoices`, `invoice_line_items`, `quotes`,
      `number_sequences` + `next_document_number()` (GoBD-lückenlose Nummernkreise,
      Row-Lock). Tenant-scoped, RLS via `current_tenant_id()`. Angewendet & verifiziert.
- [x] **Schritt 2 — Backend-Slice `buchhaltung`** (`apps/api/src/features/buchhaltung/`):
      Rechnungen-Liste im `InvoiceData`-Format, `POST /invoices` (reiches camelCase-
      Payload → GoBD-Tabelle, **Beträge serverseitig** aus Positionen, Decimal/
      Kleinunternehmer), `PATCH /invoices/{id}` (GoBD-Lock-Schutz, E-Rechnung-Nachtrag),
      `POST /number-sequences/next`, `GET/PATCH /companies/{id}` (Firmenprofil),
      Read-Stubs (transaction-links, booking-accounts), Schreibrechte via
      `owner_reporting`.
- [x] **Schritt 3 — Frontend Rechnungen 1:1** (`apps/web`, Next 15):
      Echte `InvoiceListView` (816 Z., Tabs/Filter/Storno/Banking), `ImportXRechnung`,
      komplette **Rechnungserstellung** (`create-invoice-page.tsx`, 5380 Z.) mit
      Live-Vorschau, Steuerregeln, Footer/Header-Editor (TipTap), GoBD-Festschreibung,
      E-Rechnung (ZUGFeRD/XRechnung via `fast-xml-parser`/`pdf-lib`). Route
      `/buchhaltung` + `/buchhaltung/rechnungen/neu`. Sidebar `owner_reporting`-Gating.
- [ ] **Schritt 4+ — weitere Module** (gleiches 1:1-Muster):
      Angebote, Ausgaben, Kassenbuch, Mahnwesen, Steuer (UStVA/EÜR), DATEV-Export,
      Bankabgleich (FinAPI), Kontenplan, OCR-Belegerfassung — dann HR, Jobs, Marktplatz.

Webmailer/Drive/Meet/Chat/Photos/Notes/KI/WhatsApp/Admin/SEO bleiben **draußen**.
