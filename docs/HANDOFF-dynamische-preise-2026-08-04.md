# Handoff — myNextDays, 04.08.2026 (Fortsetzung „Dynamische Preise")

## Auftrag
„Dynamische Preise" (0,5 % vom Buchungsumsatz) als eigenes buchbares Modul, UI nach
`app.lodgify.com/dynamic-pricing/settings`. Die UI war der offene Punkt des
Vorgänger-Handoffs — sie ist gebaut.

## Wie Lodgify es macht (live abgelesen, entscheidet die Struktur)
Zusatzmodule werden im **Marktplatz** verkauft (`/marketplace`), nicht in der
Abrechnung. Kachel-Raster, eigene Module mit Preis-Badge (`Buchbare Einheiten €42`,
Kategorie „Lodgify Extensions"), Detailseite mit „Aktivieren", Meta-Zeile
`Preis · Regionen · Kategorien`, 3-Schritt-Einrichtung, Hilfe-Links. `/billing` zeigt
nur Tarif + Zahlungsmethoden. Die Einstellungs-Fläche „Dynamic Pricing" zeigt bis zur
Aktivierung eine Verkaufsseite mit gezeichneten Illustrationen.

## Fertig und verifiziert

**Fläche** — `/erweiterungen` (Raster, Preis-Badge, „Aktiv"-Badge, Realtime auf
`tenant_module_entitlement` + `tenant_subscription`), `/erweiterungen/[slug]`
(Aktivieren/Kündigen über `POST|DELETE /subscriptions/modules`, Preis aus
`getPricing()`). Sidebar-Gruppe „Werkzeuge → Erweiterungen" (`req: manage_billing`),
nav-Keys in allen 24 Sprachen.

**Gate — eine Quelle, fail-closed** `subscriptions/entitlements.py::modul_aktiv`,
genutzt von drei Stellen: `pricing/recompute` (rechnet nicht),
`settings_service.update` (**402** beim Einschalten), `GET /pricing/overview` →
`module_active` (UI zeigt Verkaufsseite). Vorher lag dieselbe Abfrage doppelt im Code.
Buchen ohne laufendes Abo → **422** (ohne Stripe-Kunden wäre die Nutzung nie
fakturierbar, `bill_pending_dynpricing` → 409).

**Verkaufsseite** `components/erweiterungen/modul-verkaufsseite.tsx` +
`illustrationen.tsx`: Hero mit Preisverlauf-Motiv (Kurve zwischen Mindest-/
Höchstpreis), Vorteils-Band, drei Schritte mit eigenen Line-Art-SVGs, „Was in den
Preis einfließt", Abschluss-CTA. Alles Inline-SVG über Farb-Tokens → hell und dunkel
geprüft. Lodgifys Bilddateien wurden **nicht** kopiert.

**Korrektur** „Dynamische Preise" stand im Tarifrechner als enthaltene Funktion —
raus, stattdessen Verweis auf /erweiterungen.

**Nebenaufträge dieser Session**

- Sprach-Assistent („Andy") im Dashboard-Layout **abgeschaltet** (Code bleibt,
  Rückweg im Kommentar); an seiner Stelle
  `components/support/support-chat-button.tsx` — runder Knopf unten rechts,
  Ungelesen-Badge, öffnet den Live-Chat (geprüft).
- `/konto` → Karte „Betriebsart" brach in der schmalen Spalte: `sm:grid-cols-2`
  kannte die Containerbreite nicht. Jetzt `@container` + `@md:grid-cols-2`, Häkchen
  absolut in der Ecke, `break-words`.

**Doku** `docs/API.md` (`module_active`, 402), `docs/ARCHITECTURE.md` (Modul, Fläche,
drei Gates), Hilfeartikel „Dynamische Preise" in 24 Sprachen mit Hinweis
„kostenpflichtiges Zusatzmodul, buchbar unter Erweiterungen" (ohne Prozentzahl —
Preis bleibt eine Quelle).

**Qualitätsgate** 1454 pytest grün, `ruff` sauber, `pylint` 10.00/10, `tsc`
fehlerfrei, ESLint 0 Fehler (292 Altwarnungen),
`scripts/realtime/abos-pruefen.sh` grün.

## Dateien

Neu:

- `apps/api/src/features/subscriptions/entitlements.py`
- `web/lib/erweiterungen.ts`
- `web/components/erweiterungen/{erweiterungen-liste,erweiterung-detail,modul-verkaufsseite,illustrationen}.tsx`
- `web/app/(dashboard)/erweiterungen/{page.tsx,[slug]/page.tsx}`
- `web/components/support/support-chat-button.tsx`

Geändert:

- `apps/api`: `subscriptions/{dynpricing,service}.py`,
  `pricing/{recompute,schemas,settings_service}.py`,
  `subscriptions/tests/test_subscriptions.py` (+2 Tests)
- `web`: `app/(dashboard)/{layout.tsx,dynamic-pricing/page.tsx,dynamic-pricing/[id]/page.tsx}`,
  `components/app-sidebar.tsx`,
  `components/konto/{tarif-rechner,konto-betriebsart-section}.tsx`,
  `lib/dynamic-pricing.ts`, `messages/*.json` (24),
  `content/help/*/preise-raten.ts` (24)
- `docs/{API,ARCHITECTURE}.md`

## Nachtrag 04.08.2026 — offene Punkte 1 und 2 geschlossen

**Das Modul war live nicht buchbar.** Der CHECK auf
`tenant_module_entitlement.module_key` (0117, letzter Stand 0256) kennt nur die
vier Abo-Module; `dynamische_preise` lief in einen 23514, „Aktivieren" hätte einen
500 geworfen. Die 1454 Tests blieben grün, weil der DB-Fake keine CHECKs kennt —
genau die Klasse, die 0254 für WhatsApp schon einmal beschrieben hat.

- `supabase/migrations/0278_modul_dynamische_preise_buchbar.sql` — CHECK erweitert,
  live eingespielt (`pg_get_constraintdef` gegengeprüft).
- `scripts/subscriptions/e2e_modul_dynamische_preise.py` — spielt den ganzen Weg
  gegen die Server-DB: 402 ohne Modul → `add_module` → `module_active = true` →
  `enabled = true` speicherbar → Kündigen → wieder aus. **12/12 grün**, räumt
  Entitlement und `dp_settings` auf den Vorzustand zurück (DB danach 0 Zeilen).
  Keine Stripe-Berührung: nutzungsabhängige Module haben keine Abo-Position.
- `apps/api/src/features/subscriptions/tests/test_modul_keys_migration.py` — hält
  `MODULE_KEYS` und die jüngste Constraint-Definition deckungsgleich, damit der
  nächste neue `module_key` nicht wieder nur live auffällt.
- Hilfeartikel „Dynamische Preise" in 24 Sprachen: Aktivierung jetzt über
  Erweiterungen → „Vertrieb → Dynamic Pricing" → Stift-Symbol → Aktiv-Schalter,
  Labels wörtlich aus `messages/<lang>.json`. Zusätzlich der fehlende Satz, dass
  ein manueller Tagespreis im Kalender die Automatik schlägt (so entscheidet der
  Resolver). `updated` auf August 2026.

Qualitätsgate danach: 1455 pytest grün, `ruff` sauber, `pylint` 10.00/10 auf den
neuen Dateien, `tsc` fehlerfrei, ESLint 0 Fehler (292 Altwarnungen).

## Offen

1. **Die Fläche `/dynamic-pricing` ist nicht übersetzt.** Deutsch fest im Code:
   Seitenbeschreibung beider Seiten, Status-Badges („Aktiv"/„Entwurf"/„Inaktiv"),
   alle Spalten-Hinweise der Tabelle, `aria-label="Bearbeiten"`, „← Dynamic
   Pricing" und „— Vorschau" auf der Detailseite. Ein englischer Nutzer sieht eine
   deutsche Tabelle. Eigener i18n-Durchgang (~20 Keys × 24 Sprachen).
2. **modul3/4/6** haben Stripe-Preise, aber **kein** Feature-Gate — deshalb bewusst
   nicht im Erweiterungs-Katalog. Erst Gate, dann Kachel, sonst verkauft man
   Vorhandenes.
3. Sprachsteuerung bleibt aus, bis sie fertig ist.
4. Aus dem Vorgänger-Handoff unverändert offen: Stripe-Meter stillgelegt (Ledger ist
   der Weg), Dispute-Events im Webhook fehlen.

## Warnungen für den Nachfolger

- **Modul-Verkauf nie in die Abrechnung zurückbauen.** Vier Anläufe, drei davon in
  Abrechnung/Tarifkarte, alle verworfen; Lodgify trennt es genauso.
- **Preis nur aus Stripe bzw. dem Server-Satz.** Keine zweite Zahl in Frontend,
  Katalog oder Hilfe.
- **Gate an allen drei Stellen halten.** Fällt eine weg, verkauft oder verschenkt man
  das Modul: Toggle ohne Wirkung, Rechnung ohne Leistung oder Leistung ohne Rechnung.
- Illustrationen nicht gegen fremde Assets tauschen; sie sind Tokens-basiert und
  deshalb dark-mode-fest.
- **Neuer `module_key` heißt neue Migration.** Der CHECK auf
  `tenant_module_entitlement.module_key` fängt alles ab, was der Code kennt und die
  DB nicht — und zwar erst beim zahlenden Kunden. Grüne Tests beweisen hier nichts.

## Nicht committet

Alles aus dieser Session plus die Reste früherer Aufträge; Migrationen `0277` und
`0278` sind live in der DB, aber uncommitted. Kein Commit ohne ausdrückliche Ansage.
