# Plan: 8-stufige Objektkartei (Lastenheft §6) — auf bestehendem Fundament

> Grundlage: Vollanalyse Eigentümer-/Objekte-Domäne, Konventionen UND i18n-Architektur,
> gegen die Live-DB verifiziert. Nutzer-Entscheidungen eingearbeitet. Dieses Dokument ist
> die verbindliche Bau-Vorlage; es verhindert die Fehler der ersten Versuche
> (parallele Eigentümer-Tabelle statt `owners`; dänische Wörter als DB-Werte/Labels).

## Status: WARTET AUF FREIGABE — noch kein Code, keine Migration.

---

## 0. Was bei den ersten Versuchen falsch war (Lehre)

| Fehler | Verifizierte Realität |
|---|---|
| Neue Tabelle `property_owner_details` (Name/Bank/CPR) | Es gibt `owners` (3 Einträge live) + `owner_properties` (2 Zuordnungen) mit Stammdaten, IBAN/BIC, Steuer, Provision, `ownership_share`. UI unter `/eigentuemer`. |
| `co_owners` als Miteigentümer wiederbelebt | DB-Kommentar **„DEPRECATED (0063)"**, 0 Zeilen, KEIN Code liest sie. |
| **Dänische Wörter als DB-Werte/Stufennamen** (`PROCES`, `HÅNDVÆRKERE`, `fritidshus`) | Projekt deployt in 27 EU-Länder / **24 Sprachen** (next-intl). Eine Sprache in DB-Werte/Labels zu hardcoden ist ein i18n-Verstoß (analog Wurzel 4 für Währung). |
| i18n nicht analysiert | `next-intl` + 24 Locale-Kataloge + `LocalizedText`-Muster (de/en/da) + Google-Translate-Gateway existieren bereits. |

**Grundregeln:**
1. Kartei besitzt KEINE Eigentümer-Stammdaten/Zugangscodes/Info-Texte — sie zeigt/verlinkt
   bestehende Quellen und ergänzt nur echt Fehlendes.
2. **Kein deutsches/dänisches Wort als DB-Wert oder UI-Label.** DB-Enums = sprachneutrale
   englische Keys. UI-Labels = next-intl. Freitexte = `LocalizedText`.

---

## 1. VORAB-CHECKLISTE (verbindlich, für JEDES Feld VOR dem Bau)

Jedes geplante Feld muss diese Prüfungen bestehen, sonst nicht bauen:

1. **Existiert es schon?** Grep in `apps/api` + `apps/web` UND `\d tabelle` gegen Live-DB.
   → Vorhanden = anbinden, nicht neu bauen.
2. **Ist die Zieltabelle deprecatet?** `obj_description('public.x'::regclass)` prüfen.
3. **Gehört das Feld zu einer bestehenden Entität?** Eigentümer→`owners`; Objekt-Stammfeld→
   `properties`-Spalte; Zugangscode/Info-Text→`property_guest_portal`/`type_attributes.messaging`.
4. **Löst ein Objekt-Update OTA/Channex-Sync aus?** `_CONTENT_FIELDS`
   (`apps/api/src/features/properties/service.py:44`). Kartei-Felder dürfen KEINEN Sync triggern.
5. **Spalte vs. type_attributes vs. eigene Tabelle?** (Regel aus Migration 0051.)
6. **i18n:** Ist es ein Freitext (Nutzer tippt) → `LocalizedText`. Ist es ein Enum/Status
   → sprachneutraler englischer Key + Label im next-intl-Namespace. Ist es ein UI-Label
   → next-intl-Namespace. NIE hart deutsch/dänisch.

---

## 2. i18n-Regeln für dieses Feature (verbindlich)

Das Projekt hat ZWEI getrennte Sprachwelten (beide bestehend, nicht neu erfinden):

**A) UI-Labels (24 Sprachen) → next-intl**
- Alle Reiternamen, Feldbeschriftungen, Buttons, Enum-Anzeigen der Kartei kommen aus einem
  **neuen Namespace `dossier`** in `apps/web/messages/*.json`.
- Zugriff via `useTranslations("dossier")`. KEINE hart-deutschen Strings im JSX, KEINE
  `*_LABELS`-Map mit deutschen Werten (das ist die Altschuld aus `property-meta.ts`).
- Mindestens `de` + `en` pflegen (en = Vollständigkeits-Referenz); restliche 22 leer/ge-seeded,
  können über den bestehenden Katalog-Prozess nachgezogen werden.

**B) Inhalts-Freitexte (de/en/da) → `LocalizedText`**
- Freitextfelder, die der Nutzer eintippt (Begrüßungstext, Geheimtipps, Notizen), NICHT als
  `text`-Spalte, sondern als `LocalizedText` (`Record<"de"|"en"|"da", string>`,
  `apps/web/lib/policy-meta.ts:23`) im jsonb — mit `LocalizedTextEditor`
  (`components/objekte/localized-text-editor.tsx`) + Translate-Gateway (`/content/translate`).
- ABER: Laut Entscheidung binden Stufe 7 (Husmappe-Texte) ohnehin an `type_attributes.messaging`
  an — dort ist `LocalizedText` schon in Nutzung. Also entstehen KAUM neue Freitexte in der Kartei.

**C) DB-Enum-Werte = sprachneutrale englische Keys**
- Boligtype: DB-Wert `flex` / `year_round` / `holiday` (NICHT `flexbolig`/`helaarsbolig`/`fritidshus`).
- service_type: `caretaker` / `window_cleaning` / `lawn_mowing`.
- trade: `electrician` / `plumbing` / `carpenter` / `locksmith`.
- platform: `native` / `airbnb` / `booking` / `vrbo`.
- authority_mode: `up_to_amount` / `always_owner`. key_status: `agency_extra` / `owner_only`.
- welcome_text_status: `received` / `open`.
- Die menschenlesbaren Labels dazu leben im next-intl-Namespace `dossier`, NICHT in der DB.

**D) Datum/Zahl:** Kartei-Frontend nutzt die aktive Locale (`useLocale`/next-intl-Format),
  NICHT hart `de-DE`. (Bestehende Altschuld nicht neu einschleppen.)

---

## 3. Datenmodell je Stufe (Stufennamen = neutrale Keys; Anzeige via i18n)

Interne/DB-Bezeichnung neutral englisch. Der dem Nutzer gezeigte Reitertitel kommt aus
`messages.dossier.step.<key>`.

### Stufe 1 — `object_info`
- **[properties]** neue nullable Spalten: `internal_house_no`, `house_name`,
  `capacity_persons`, `capacity_sqm`.
- **[properties]** `bfe_number`, `boligtype` existieren (0009) → an properties-Contract
  anschließen, **NICHT** in `_CONTENT_FIELDS`. boligtype-Werte = neutrale Keys (s. §2C).
- **[owners]** Eigentümer read-only aus dem via `owner_properties` verknüpften Owner + Link
  `/eigentuemer/{id}`. CPR fehlt → **eine** nullable Spalte `owners.cpr_number`.
- Miteigentümer: ENTFÄLLT (Entscheidung: ein Eigentümer je Objekt).

### Stufe 2 — `process` (1:1, neu)
- **[NEU 1:1]** `property_process`: first_meeting_at, contract_sent_at, contract_signed_at,
  onboarding_invoice_sent_at, onboarding_invoice_paid_at (date).

### Stufe 3 — `access` (an Bestehendes anbinden)
- door_code/self_checkin → **[property_guest_portal]**; WLAN/Türtext → **[messaging]**.
- Neu nur: **[NEU 1:1]** `property_access` mit `key_status` (Key), `key_placement` (Freitext,
  ggf. LocalizedText falls gästesichtbar — hier intern, daher einfacher text ok).

### Stufe 4 — `service_agreements` (1:n, neu)
- **[NEU 1:n]** `property_service_agreements`: service_type (Key), frequency, price, currency, notes.
  currency aus den Daten, kein Default (Wurzel 4).

### Stufe 5 — `tradespeople` (1:n) + `emergency_authority` (1:1, neu)
- **[NEU 1:n]** `property_tradespeople`: trade (Key), name, phone, notes.
- **[NEU 1:1]** `property_emergency_authority`: authority_mode (Key), authority_limit, currency.

### Stufe 6 — `marketing` (1:1, neu)
- **[NEU 1:1]** `property_marketing`: photographer_booked_at, media_received_at,
  site_walkthrough_at, defects_list_sent_at (date).

### Stufe 7 — `housebook` (an Bestehendes anbinden)
- Begrüßungstext/Geheimtipps → **[type_attributes.messaging]** (schon LocalizedText).
- Neu nur STATUS: **[NEU 1:1]** `property_housebook`: welcome_text_status (Key),
  physical_folder_placed (bool).

### Stufe 8 — `listing` (an Bestehendes anbinden + Status)
- Grundpreis→`property_pricing_config`/`rate_plans`; Sperrungen→`availability`/`stop_sell`;
  Portal→`channex_*`. Kartei dupliziert KEINE Preis-/Sperr-Wahrheit.
- Neu nur: **[NEU 1:n]** `property_platform_launches`: platform (Key), launch_at, status.

---

## 4. API — neuer Slice `property_dossier`
- `apps/api/src/features/property_dossier/` (router/service/schemas/tests). Muster property_portal
  + guests. NICHT in properties-Service (Channex-Sync/God-Service meiden).
- Jeder Zugriff `_require_own_property(tenant_id, property_id)`, Tenant aus `ctx` (Wurzel 3).
- Permission: `MANAGE_PROPERTIES` schreiben, `VIEW_CALENDAR` lesen.
- Enum-Felder speichern nur die neutralen Keys; keine Labels im Backend.
- `GET /{id}/full`: Aggregat + verknüpfter `owners`-Datensatz read-only. Mount in main.py.

## 5. Web-UI + PDF
- Route `/objekte/[id]/kartei` + Subnav-Punkt „Kartei" — **Label aus next-intl** (`nav`/`dossier`).
- 8-Stufen-Stepper. ALLE sichtbaren Texte über `useTranslations("dossier")`. Enum-Dropdowns:
  Wert = Key, angezeigtes Label = `t("boligtype." + key)` etc.
- Stufe 1: Eigentümer read-only + Link `/eigentuemer/{id}`; kein Owner → i18n-Hinweis.
  Zugang/Texte (3/7): vorhandene Gastmodul-/messaging-Werte anzeigen, Bearbeiten dort verlinken.
- `lib/property-dossier.ts` (Server-Actions, `Result<T>`, `"use server"`).
- Neuer next-intl-Namespace `dossier` in `messages/de.json` + `messages/en.json` (mind.),
  Struktur wie bestehende Namespaces.
- Realtime: neue Tabellen in Publication (`replica identity full` + Loop, Muster 0052).
- PDF: `lib/dossier-pdf.ts` + Button → `/api/v1/generate-pdf-single`. Labels aus i18n
  (nicht hart), Owner-Block aus `owners`, Datum über aktive Locale.
- Styling: rem, Iconify, Theme-Tokens, rounded-full, leere/maskierte Felder als „—".

## 6. Reihenfolge (je Schritt ein Qualitätsgate)
1. Migration: `owners.cpr_number` + properties-Basisspalten + neue Tabellen (nur ohne Bestand),
   alle Enum-Spalten mit neutralen Keys. RLS (0015) + owner-scope (0059) + Realtime (0052).
2. properties-Contract erweitern — OHNE `_CONTENT_FIELDS`. Tests.
3. Slice property_dossier Stufe für Stufe, je Tests (pylint 10/10).
4. next-intl-Namespace `dossier` (de+en) + Web Stufe 1, dann restliche Stufen.
5. PDF-Export (Labels aus i18n).
6. Doku (API.md, REQUIREMENTS-GAP.md), Migration via apply-migrations.sh einspielen.

## 7. Qualitätsgate (CLAUDE.md + i18n)
pytest grün · ruff clean · pylint 10.00/10 · tsc web+builder · Migration manuell eingespielt ·
jede neue Tabelle RLS + Realtime · **kein hart-deutsches/dänisches UI-Label — alles i18n** ·
DB-Enums = neutrale Keys · Doku aktuell · kein Commit/Deploy ohne Ansage.

## 8. Was NICHT gebaut wird (bewusst)
- Keine Eigentümer-Stammdaten-Tabelle (nutzt `owners`), kein co_owners (deprecated).
- Kein zweites door_code/WLAN/Begrüßungstext-Feld (nutzt Gastmodul/messaging).
- Keine Preis-/Sperr-Wahrheit in Stufe 8.
- Kein Miteigentum.
- **Keine hart-deutschen/dänischen Wörter als DB-Wert oder Label** — neutrale Keys + next-intl.
