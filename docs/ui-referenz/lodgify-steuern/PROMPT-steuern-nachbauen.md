# Auftrag: Steuern-Bereich im Preise-Tab auf Lodgify-Niveau ausbauen

Wir haben die Sektion „Steuern" im Preise-Tab bereits — aber nur als Rumpf
(Name, Prozent/Betrag, „im Preis enthalten"). Lodgify hat dort ein deutlich
vollständigeres Modell, das die Portale tatsächlich brauchen (Kurtaxe pro Gast
pro Nacht, Steuerart nach Airbnb-Taxonomie, Bemessungsgrundlage, gastseitiger
Name je Sprache, Anwenden auf mehrere Objekte). **Baue unseren Bereich auf
dieses Niveau aus.**

Referenz ist eine Live-Begehung von `app.lodgify.com/pricing/<id>`,
`/pricing/<id>/sales-tax` und `/pricing/<id>/new-tax` (03.08.2026). Screenshots
liegen neben dieser Datei:

| Datei | Inhalt |
|---|---|
| `01-steuern-sektion-menu.png` | Sektion „Steuern" + Hinzufügen-Menü |
| `02-lokale-steuer-pauschalbetrag.png` | Drawer, Variante Pauschalbetrag |
| `03-lokale-steuer-prozent.png` | Drawer, Variante Prozent |
| `04-steuerbemessungsgrundlage.png` | Multiselect mit Suche + Zähler |
| `05-name-auf-website.png` | Sprach-Tabs + Rich-Text |
| `06-zu-anderen-objekten.png` | Objekt-Mehrfachauswahl |
| `07-mwst-drawer.png` | MwSt.-Drawer |

**Nicht 1:1 kopieren.** Struktur und Interaktionsmuster übernehmen, Branding auf
myNextDays angleichen: unsere Tokens, `rounded-full`-Buttons, rem statt px, keine
Hex-Arbitraries. Kundentext: nie „Channex", immer „Portale". Und **nie ein
zweites Drawer-System** — es gibt bereits `EditorShell`.

---

## 1. Was wir heute haben (Bestand, verifiziert)

**Frontend**
- Seite: `web/app/(dashboard)/objekte/[id]/preise/page.tsx` → `<PricingForm/>`
- Alles in einer Datei: `web/components/objekte/pricing-form.tsx` (1525 Z.)
  - Sektion „Steuern": Z. ~361–420, Liste über `ListRow`, Anlegen über ein
    `DropdownMenu` mit den zwei Arten `vat` / `local` — **das Lodgify-Menü
    existiert bei uns also schon im Prinzip.**
  - `TaxEditor`: Z. 1187–1249 — Felder: `name`, `mode` (`percent|amount`),
    `value`, Switch `includedInPrice`. Das ist der Rumpf, der wächst.
  - `FeeEditor`: Z. 1114–1185, hat pro Gebühr ein `taxRate`-Feld (0–100).
  - `TaxInfoEditor`: Z. 1343 (`businessTaxId`, `totRegistrationId`) — entspricht
    Lodgifys „Steuerinformationen" unter „Andere Informationen". Bleibt wie es ist.
  - Lokale Bausteine: `ListSection` Z. 531, `ListRow` Z. 577, `BlockCard` Z. 618,
    `MoneyInput` Z. 658, `BasisSelect` Z. 1404.
- Drawer-Muster: **Radix Sheet**, nicht Dialog — `EditorShell` in
  `web/components/objekte/editor-primitives.tsx:52-101` (sticky Header, Body
  `min-h-0 overflow-y-auto p-5`, Footer-Leiste). Dazu `useSaver`, `Footer`,
  `Field`, `Hint`, `Pill`, `ChannelIcons`. UI-Primitives kommen aus dem
  Monorepo-Paket `@nextdays/ui/*` (sheet, select, switch, input, button,
  dropdown-menu, card, label), **nicht** aus `@/components/ui`.
- Labels: `web/lib/pricing-meta.ts` → `TAX_KIND_LABELS`, `CURRENCY_OPTIONS`,
  `currencySymbol`, `fmtPrice(amount, currency, locale)`. In der Preis-UI ist
  `fmtPrice` das etablierte Muster (das globale `formatCurrency` aus
  `@nextdays/currency` gibt es parallel — hier nicht neu mischen).

**Datenmodell**
- TS-Wahrheit: `web/lib/pricing-meta.ts`
  ```ts
  type Tax = { id, kind: "vat"|"local", name, mode: "percent"|"amount",
               value: number, includedInPrice: boolean }
  type Fee = { id, name, amount, basis: FeeBasis, optional, taxRate?: number|null }
  type FeeBasis = "per_stay"|"per_night"|"per_guest_stay"|"per_guest_night"
  ```
- Persistenz: `properties.type_attributes.pricing` (JSON) — `PricingForm`
  speichert über `updateProperty(p.id, { type_attributes: {…, pricing: next} })`.
- Spiegelung nach `public.property_pricing_config` (Migration
  `0051_property_pricing_config.sql`, Spalte `taxes jsonb`) über
  `apps/api/src/features/properties/service.py:577-612` (`_sync_pricing_config`,
  best-effort Upsert on `property_id`). RLS über `properties.tenant_id`,
  Write-Lockdown in `0229_write_lockdown_restbestand.sql:97`, Realtime in
  `0052_pricing_realtime.sql`.
- Resolver (Single Source of Truth für Preise):
  `apps/api/src/features/pricing/resolver.py` — `_PricingConfig` Z. 123-160
  (`self.taxes` Z. 146), **Steuerberechnung Z. 854-863**: `includedInPrice` →
  übersprungen, sonst `_tax_amount(tax, subtotal)` als `QuoteLine(kind="tax")`
  mit `label = tax["name"]`.
- Rechnung: `apps/api/src/features/buchhaltung/reservation_invoice.py:73-105` —
  `_property_vat_rate()` nimmt den **ersten** Eintrag mit `kind=="vat"`,
  `mode=="percent"`, `includedInPrice==True`; `_additive_tax_labels()` sammelt
  die Namen nicht-inkludierter Steuern (mit 0 % USt fakturiert).

**Channex**
- `apps/api/src/features/channel_manager/content_sync.py:1186-1296` `_sync_taxes`,
  aufgerufen im Content-Sync Z. 306-308 (Trace-Step `"taxes"`). Quelle ist
  `type_attributes.pricing.taxes`, **nicht** `property_pricing_config`.
  - `_TAX_LOGIC = {"percent": "percent", "amount": "per_night"}` (Z. 1188)
  - `_TAX_TYPE  = {"vat": "tax", "local": "city tax"}` (Z. 1190)
  - Tax-Felder Z. 1217-1226: `title`, `logic`, `type`, `rate`, `is_inclusive`,
    `property_id`, plus `currency` wenn `logic != "percent"`.
  - Tax-Set Z. 1259-1265: `title:"Standard"`, `property_id`, `currency`,
    `taxes:[{id, level:0}]`, `associated_rate_plan_ids`.
  - Idempotenz über `public.channex_tax_map` (Migration
    `0034_channex_tax_map.sql`, unique `(property_id, local_tax_id)`; Grants
    gehärtet in `0154` und `0187_harden_sensitive_grants.sql:73-77`).
- Client: `channex_client.py:580-591` — `create_tax`, `update_tax`,
  `create_tax_set`, `update_tax_set`.

**i18n**
- `next-intl`, 24 Locales in `web/messages/`. Namespace `objects.pricingForm.*`
  (132 Keys in `de.json`). Bestehende Steuer-Keys: `taxesTitle`, `taxesHint`,
  `taxesEmpty`, `vatLabel/Desc/Placeholder`, `localTaxLabel/Desc/Placeholder`,
  `taxModeLabel/taxModePercent/taxModeAmount`, `taxRateFieldLabel/Placeholder/Suffix`,
  `includedInPriceLabel/Suffix`, `taxEditorSubtitle`. Konvention: camelCase,
  Suffixe `…Title/Hint/Empty/Label/Desc/Placeholder/Pill/Suffix`, ICU-Platzhalter.

---

## 2. Was Lodgify hat — die Lücke

### 2.1 Sektion + Hinzufügen-Menü (`01-…png`)

Überschrift „Steuern", Untertitel „Berechnen Sie Umsatzsteuer/Mehrwertsteuer auf
Ihre Preise und konfigurieren Sie andere zusätzliche Steuern.", rechts
`+ Hinzufügen` → Popover mit zwei Einträgen, jeweils Titel + Erklärzeile:
- **MwSt.** — „Im Preis inbegriffen oder nicht." → Route `…/sales-tax`
- **Lokale Steuer** — „Richten Sie zusätzliche Steuern ein." → Route `…/new-tax`

Angelegte Einträge erscheinen als Karten im Muster der Sektionen
„Gebühren"/„Extras": Titel fett, optionaler Badge (`Aktiviert` grün /
`Eingeschränkt` grau), darunter graue Zusammenfassungs-Chips
(z. B. `kr 25 Einmaliger Betrag Pro Nacht`), rechts Kebab-Menü.

**Bei uns fehlt:** die Erklärzeilen im Menü, die Zusammenfassungs-Chips mit der
vollen Basis (heute steht dort nur Name + Wert).

### 2.2 Drawer-Chrome

Rechter Drawer, **393 px** (≈ 24.5 rem) breit, Radius 24 px rundum (schwebend),
Shadow `0 8px 36px rgba(51,51,51,.17)`. Kopf: zentrierter Titel 14 px/600,
Untertitel 12 px/400 grau, `×` rechts. Körper scrollbar, Abschnittsüberschriften
`h2` 20 px/700 in der Display-Schrift. Fuß sticky: `Abbrechen` links,
`Speichern` rechts (schwarze Pill). Felder 13 px, Pflicht mit rotem `*`.
Info-Boxen hellblau (`#ECF1FE`), Radius 8, Padding 16, mit Link-Button.

→ Das deckt `EditorShell` schon weitgehend ab. Nachziehen: die
Abschnittsüberschriften im Body (`h2`-Blöcke statt einer flachen Feldliste) und
den Info-Callout (bei uns mit Link ins **eigene** Hilfe-Center `/hilfe`, nie zu
einer fremden Knowledge Base).

### 2.3 MwSt.-Drawer (`07-…png`)

Genau zwei Felder:
- Prozentfeld, Platzhalter `0.00`, Suffix `%`
- Select mit zwei Optionen (echte DOM-Values):
  `included` → „Preis inkl. Umsatz-/MwSt." · `excluded` → „Der Preis enthält
  keine Umsatzsteuer / MwSt."

Untertitel: „Geben Sie den Prozentsatz der Umsatz-/Mehrwertsteuer an und wählen
Sie, ob diese bereits im Preis inkludiert ist. Sollte dies nicht der Fall sein,
wird die Steuer als Prozentsatz auf den Preis aufgeschlagen."

Es gibt **genau eine** MwSt. je Objekt. Bei uns ist `vat` heute ein normaler
Listeneintrag, der mehrfach anlegbar ist — und `_property_vat_rate()` nimmt still
den ersten Treffer. Das ist ein echter Defekt: **MwSt. auf max. eins begrenzen**
(im Menü ausgrauen wenn vorhanden, serverseitig erzwingen) und den Namen dort
weglassen, statt ihn eingeben zu lassen.

### 2.4 Drawer „Neue lokale Steuer" (`02`–`06`)

Blöcke in dieser Reihenfolge:

**0 · Info-Box** — Hinweis auf den Hilfe-Artikel.

**1 · Lokale Steuerart** (Pflicht-Select). Echte Values aus dem DOM — das ist die
Airbnb-Taxonomie und geht so an die Portale:

| Value | Label (DE) |
|---|---|
| `HotelTax` | Hotelsteuer |
| `LodgingTax` | Beherbergungssteuer |
| `RoomTax` | Zimmersteuer |
| `TourismAssessment` | Tourismusabgabe |
| `TouristTax` | Kurtaxe |
| `TransientOccupancyTax` | Übernachtungssteuer |
| `Unknown` | Unbekannt |

**2 · „Betrag"** — Segmented Control (Pill, aktive Hälfte schwarz):
`Pauschalbetrag` | `Prozent`.

*Pauschalbetrag* (`02-…png`):
- `Wert *` (Zahl, Platzhalter `0`) + `Währung`-Select. Lodgify listet ~90
  Währungen. **Bei uns nicht:** die Währung kommt aus dem Objekt
  (`properties.currency`, 0161 → Fallback `rate_plans.currency` →
  `pricing.currency`) und wird read-only als Symbol/Chip angezeigt. Kein
  `|| 'EUR'` (Wurzel 4); fehlt sie, symbollos rendern.
- Zwei Selects nebeneinander:
  - `SingleCharge` = „Einmaliger Betrag" · `PerPerson` = „Pro Gast"
  - `PerStay` = „Pro Aufenthalt" · `PerNight` = „Pro Nacht"
  → die vier Kombinationen sind genau das Kurtaxen-Modell („2,50 € pro Gast pro
  Nacht"). **Das fehlt uns komplett** — unser `mode:"amount"` hat keine Basis und
  wird im Channex-Sync hart auf `per_night` gemappt.

*Prozent* (`03-…png`):
- Nur `Wert *`, Platzhalter „0% des Grundpreises inkl. Werbeaktionen", Suffix `%`.
- Hilfetext: „Steuer wird als einmalige Gebühr berechnet, wenn sie prozentual
  basiert ist, und richtet sich nach dem Zimmerpreis einschließlich Promotions."
- schaltet Block 3 frei.

**3 · „Steuerbemessungsgrundlage"** (nur bei Prozent, `04-…png`):
- Text: „Die steuerpflichtige Grundlage gilt nur für Gebühren, die an Airbnb
  übermittelt werden. Für alle anderen Kanäle gelten Steuern nur auf den
  Basispreis." → bei uns: „…die an die Portale übermittelt werden."
- Multiselect-Dropdown mit Suchfeld und Checkboxen, oben `0/7` als
  Alles-auswählen-Schalter mit Zähler. Optionen sind die **Gebührenarten des
  Objekts** plus „Grundpreis" — bei Lodgify: Gemeinschaftsgebühr, Grundpreis,
  Haustiergebühr, Reinigungsgebühr, Resort, Verwaltungsgebühr, Wäscheservice.
  → Bei uns aus `pricing.fees[]` + fixem Eintrag `base_price` speisen.
- Danach Info-Box „Zusätzliche Gebühren können der Steuer unterliegen".

**4 · „Name auf der Website"** (`05-…png`):
- Sprach-Tabs (Flagge + Sprachname), darunter `⚙ Sprachen` → `+ Sprache
  hinzufügen`. Pro Sprache eigene Felder.
- `Name der lokalen Steuer *` — gastseitig sichtbar.
- Beschreibungs-Rich-Text mit Toolbar **B / I / U / S̶**, Platzhalter „Geben Sie
  eine Beschreibung an (nur für den internen Gebrauch)."
  ⚠️ Wurzel 8: serverseitig beim **Speichern** mit `nh3`-Allowlist sanitisieren,
  nie per Regex.

**5 · „Zu anderen Unterkünften hinzufügen"** (`06-…png`):
- Suchfeld „Unterkünfte durchsuchen…", Zähler `0/19 ausgewählte`, Link
  `Alle auswählen`, scrollbare Liste mit Thumbnail (32 px), Name fett, Referenz
  grau, Checkbox rechts, Hover-Highlight.
- Bei uns: dieselbe Steuer auf mehrere **Objekte** anwenden. Jede Objekt-ID aus
  dem Request einzeln auf den Tenant scopen (Wurzel 3) — fremde ID → 403, nicht
  still überspringen.

---

## 3. Umsetzung

### 3.1 Datenmodell erweitern

`web/lib/pricing-meta.ts` — `Tax` erweitern, **abwärtskompatibel** (Altbestand hat
weder `taxKind` noch `chargeBasis`):

```ts
type Tax = {
  id: string
  kind: "vat" | "local"
  // neu, nur bei kind==="local":
  taxKind?: "HotelTax" | "LodgingTax" | "RoomTax" | "TourismAssessment"
          | "TouristTax" | "TransientOccupancyTax" | "Unknown"
  name: string                    // Fallback / interner Name
  names?: Record<string, string>  // gastseitig je Locale
  descriptionHtml?: string | null // sanitisiert gespeichert
  mode: "percent" | "amount"
  value: number
  // neu, nur bei mode==="amount":
  chargeBasis?: "SingleCharge" | "PerPerson"
  period?: "PerStay" | "PerNight"
  // neu, nur bei mode==="percent":
  taxableBase?: string[]          // Fee-IDs + "base_price"
  includedInPrice: boolean
}
```

Beim Lesen defaulten: fehlt `chargeBasis`/`period` bei `mode==="amount"`, gilt
`SingleCharge` + `PerNight` — das ist exakt das heutige Channex-Verhalten
(`_TAX_LOGIC["amount"] = "per_night"`), also kein Bedeutungswechsel bei
Altdatensätzen. **Das ist die einzige erlaubte Vorbelegung** und gehört
kommentiert; alles andere fehlschlagen lassen statt raten (Wurzel 4).

Migration: `property_pricing_config.taxes` ist `jsonb` — kein Schemazwang. Aber
**prüfe** `_sync_pricing_config` (`properties/service.py:577-612`) auf
camelCase→snake_case-Mapping der neuen Felder und zieh es nach. Neue Tabelle nur
anlegen, wenn du wirklich eine brauchst — dann RLS + `revoke` für
`anon, authenticated` + restriktive Rollen-Policy, Schreiben nur `service_role`
(Wurzel 6), und über `supabase/apply-migrations.sh` einspielen.

### 3.2 Resolver + Rechnung

- `resolver.py:854-863` rechnet Steuern heute pauschal auf den `subtotal`.
  Erweitern:
  - `mode="amount"` × `chargeBasis`/`period` → Betrag × (Gäste?) × (Nächte?).
    Die Gästezahl kommt aus dem Quote-Request; fehlt sie, ist das ein 422, kein
    angenommener Default.
  - `mode="percent"` × `taxableBase` → Bemessungsgrundlage aus den zutreffenden
    Zeilen bilden (Grundpreis und/oder einzelne Fees), statt blind `subtotal`.
  - Unbegrenzte Nächte-Loops kappen (Wurzel 8: harte Obergrenze → 422).
- `reservation_invoice.py:73-105`: `_property_vat_rate()` darf nicht mehr „ersten
  Treffer" nehmen, sobald MwSt. auf eins begrenzt ist — anpassen und die
  Annahme im Code benennen. `_additive_tax_labels()` soll den gastseitigen Namen
  (`names[locale] ?? name`) verwenden.
- Tests in `apps/api/src/features/pricing/tests/test_pricing.py` erweitern:
  Kurtaxe pro Gast pro Nacht, Prozentsteuer auf ausgewählte Fees, Altdatensatz
  ohne die neuen Felder.

### 3.3 Channex

`content_sync.py:_sync_taxes` (Z. 1186-1296):
- `_TAX_LOGIC` ersetzen durch eine Ableitung aus `mode` + `chargeBasis` +
  `period` auf die Channex-`logic`-Werte (`percent`, `per_night`, `per_person`,
  `per_person_per_night`, `per_booking`/`per_room` je nach Channex-Vokabular —
  **gegen die Channex-Doku verifizieren, nicht raten**; Leseweg wie üblich beim
  Nutzer erfragen, keine `.md` im Repo).
- `_TAX_TYPE` um die neue `taxKind`-Achse erweitern (`TouristTax` → „city tax"
  etc.), Fallback `Unknown` sauber behandeln.
- Mapping in `channex_tax_map` bleibt idempotent: `local_tax_id` ist die stabile
  UI-ID, unique `(property_id, local_tax_id)` — bei Retry/Doppelklick updaten,
  nicht duplizieren (Wurzel 2).
- **Löschen einer Steuer** muss den Gegenzustand pflegen: Mapping-Zeile
  `deleted_at` setzen und die Steuer bei den Portalen entfernen bzw. aus dem
  Tax-Set nehmen (Wurzel 1).
- `ChannexBudgetExhausted` und Konflikte (23505) nicht in einem breiten
  `except Exception` verschlucken (Wurzel 5).

### 3.4 Frontend

`pricing-form.tsx` ist mit 1525 Zeilen schon zu groß — den Steuerteil beim
Ausbau in eigene Dateien ziehen (`web/components/objekte/pricing/steuern-*.tsx`),
`EditorShell`/`useSaver`/`Footer`/`Field` weiterverwenden, keine neuen Primitives
erfinden wo es welche gibt.

Zu bauen:
1. **Sektion**: Erklärzeilen im `DropdownMenu`, MwSt.-Eintrag deaktiviert wenn
   schon vorhanden. Zusammenfassungs-Chips je Karte:
   `2,50 € · Pro Gast · Pro Nacht` bzw. `5 % · Grundpreis, Reinigungsgebühr`.
2. **MwStEditor** — abgespeckt: Prozentfeld + `included`/`excluded`-Select, kein
   Namensfeld.
3. **LokaleSteuerEditor** — Blöcke 1–5, Segmented Control schaltet die Feldsätze,
   Block 3 nur bei Prozent.
4. **Multiselect mit Suche + Zähler + „Alle auswählen"** — als
   wiederverwendbares Primitive in `@nextdays/ui` bzw. `editor-primitives.tsx`,
   weil Block 3 und Block 5 dasselbe Verhalten brauchen.
5. **Sprach-Tabs** für den gastseitigen Namen (Flagge + Sprache, `⚙ Sprachen` →
   Sprache hinzufügen) — an die 24 Locales aus `web/messages/` koppeln.

Frontend-Regeln:
- Beträge über `fmtPrice`/`currencySymbol` aus `lib/pricing-meta.ts` (das dort
  etablierte Muster) — kein `€`-Hardcode, keine vierte Kopie.
- rem statt px, Pill-Buttons, semantische Tokens statt `bg-[#xxx]`.
- Alle Texte als i18n-Keys unter `objects.pricingForm.*` in der bestehenden
  Namenskonvention, **alle 24 Sprachen** bedienen.
- Realtime: die Steuerliste hängt an `properties` bzw.
  `property_pricing_config` (Realtime dafür in `0052_pricing_realtime.sql`) —
  vor „fertig" mit `bash scripts/realtime/abos-pruefen.sh` gegen die Live-DB
  prüfen, dass Grant **und** Publikation stehen. Kein manuelles `load()` nach
  eigener Aktion.
- Optional, aber näher an der Referenz: Drawer als eigene Route
  (`…/preise/mwst`, `…/preise/steuer/neu`, `…/preise/steuer/[taxId]`), damit die
  URL teilbar ist und Zurück schließt. Heute ist es lokaler `Section`-State
  (`pricing-form.tsx:78-90`) — wenn du umstellst, alle Editoren gleich behandeln,
  nicht nur Steuern.

### 3.5 API / Sicherheit

Wenn du dedizierte Endpunkte baust (statt weiter alles über `updateProperty`):
- `PUT /api/pricing/{property_id}/vat`, `POST|PATCH|DELETE
  /api/pricing/{property_id}/taxes[/{tax_id}]`, `apply_to_property_ids` im Body
  für Block 5.
- Zugriff per ID ausschließlich über `core.supabase.load_scoped(...)` oder eine
  `_require_own_*`-Methode (Wurzel 3). Item-Endpunkte prüfen denselben Scope wie
  die Liste, `require_permission` statt nur `get_current_user` (Wurzel 9).
- `descriptionHtml` beim Speichern mit `nh3`-Allowlist sanitisieren (Wurzel 8).
- Anlegen idempotent: Client-`id` als Schlüssel + UNIQUE-Backstop (Wurzel 2).

### 3.6 Abnahme

- `pytest` grün, `ruff check` sauber, `pylint` 10.00/10 auf allen geänderten Modulen.
- `tsc --noEmit` und `bun run lint` in `web` fehlerfrei.
- Migration (falls nötig) eingespielt, RLS/`revoke` gesetzt und per
  anon-Key-`curl` gegengeprüft — lesen UND schreiben.
- Realtime-Abo live verifiziert, nicht angenommen.
- Channex-Sync gegen die Sandbox verifiziert (nicht nur „200"): die Steuer taucht
  mit korrekter `logic` im Tax-Set auf, ein zweiter Sync erzeugt kein Duplikat.
- Architektur-/API-Doku und Diagramme nachziehen.
- Nichts committen, pushen oder deployen ohne ausdrückliche Ansage.

---

## 4. Offene Punkte, die du selbst entscheiden musst

- **Gerenderte Steuer-Karte bei Lodgify ist nicht direkt belegt** — im geprüften
  Account war keine Steuer angelegt. Das Kartenmuster (Badge, Chips) stammt aus
  den identisch gebauten Sektionen „Gebühren"/„Extras". Halte dich an unser
  `ListRow`, nicht an eine Rekonstruktion.
- **MwSt. pro Objekt oder pro Betrieb?** Lodgify führt sie pro Objekt, wir
  heute auch. Prüfe, ob es daneben schon einen Tenant-Steuersatz gibt
  (`buchhaltung`, `web/types/taxRules.ts`) — nicht doppelt führen; im Zweifel
  den Nutzer fragen statt eine dritte Ebene zu erfinden.
- **Sprach-Tabs vs. unsere i18n**: Lodgify übersetzt den gastseitigen
  Steuernamen manuell je Sprache. Prüfe, ob wir das bei Gebühren/Add-ons schon
  irgendwo tun — wenn ja, dasselbe Muster; wenn nein, ist das ein neues Konzept
  und gehört bewusst entschieden, nicht nebenbei eingeführt.
