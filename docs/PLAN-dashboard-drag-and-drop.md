# Plan — Dashboard-Startseite frei anordnbar (Drag & Drop)

Stand: 16.08.2026. **Planungsdokument, noch nichts gebaut.**

Auftrag: die Startseite (`/`) so umbauen, dass **alle Abschnitte frei mischbar**
sind (Reservierungs-, KPI-, Nachrichten- und Objektkarten in EINEM Raster), und
die Anordnung **pro Benutzer im Backend** speichern, **plus einen vom Admin
gesetzten Rollen-Standard**, den neue Benutzer erben und auf den sie
zurücksetzen können.

---

## 0. Zwei Befunde vorweg, die den Auftrag berühren

Beides ändert nichts daran, dass der Auftrag wie beschlossen gebaut wird — es
gehört nur benannt, bevor Aufwand hineinfließt.

### 0.1 Der Rollen-Standard hat real nur zwei Adressaten

Die Startseite erreichen heute **nur `admin` und `co_admin`**:

- `staff` und `cleaner` haben kein `VIEW_CALENDAR` und werden auf
  `/reservierungen/aufgaben` umgeleitet — [page.tsx:34-36](web/app/(dashboard)/page.tsx#L34-L36).
- `owner` wird vom Layout auf `/portal` umgeleitet — [layout.tsx:9-15](web/app/(dashboard)/layout.tsx#L9-L15).

Von fünf Rollen sehen also zwei das Dashboard. Ein „Rollen-Standard" ist damit
faktisch „ein Standard für admin + ein Standard für co_admin". Das ist baubar
und im Plan enthalten (Stufe 4), trägt aber deutlich weniger als es klingt.
Wenn der eigentliche Wunsch „ein Standard, den der Betrieb für sein Team setzt"
war, müsste zuerst die Startseite für weitere Rollen geöffnet werden — das ist
ein anderer Auftrag und steht hier ausdrücklich **nicht** drin.

### 0.2 „Alle Abschnitte frei mischbar" kostet die Abschnittsköpfe

Ein gemeinsames Raster für alle 19 Kacheln bedeutet: die vier
`SectionHeader`-Leisten („Reservierungen", „Nachrichten", „Objekte") entfallen,
weil eine KPI-Kachel dann über einer Reservierungskarte liegen darf. Die
Zuordnung „welcher Bereich ist das" muss stattdessen an der Kachel selbst
sichtbar werden (Icon + Titel tragen sie bereits; zusätzlich ein dezentes
Bereichs-Label im Bearbeiten-Modus). Das ist der Preis der Entscheidung und
hier bewusst eingeplant.

---

## 1. Recherche-Ergebnis: was gebaut wird und warum

### 1.1 Bibliothek: `react-grid-layout` 2.2.4

Verglichen wurden RGL, dnd-kit, gridstack, muuri, react-mosaic, swapy
(Registry-Stand 16.08.2026):

| Paket | Version | Letzter Release | Lizenz | Resize | Urteil |
|---|---|---|---|---|---|
| react-grid-layout | **2.2.4** | 29.07.2026 | MIT | ✅ | **gewählt** |
| @dnd-kit/core | 6.3.1 | 05.12.2024 | MIT | ❌ | kann kein Resize (Issues #445, #1127 ohne Feature geschlossen) |
| @dnd-kit/react | 0.5.0 | 11.06.2026 | MIT | ❌ | pre-1.0 |
| gridstack | 13.0.2 | 26.07.2026 | MIT | ✅ | React-Wrapper ist kein npm-Paket, dokumentiertes Next.js-Init-Problem |
| muuri | 0.9.5 | 09.07.2021 | MIT | ❌ | tot |
| swapy | 1.0.5 | 19.01.2025 | **GPL-3.0** | ❌ | Copyleft — für myNextDays ausgeschlossen |

Ausschlaggebend: RGL v2 ist ein TypeScript-Rewrite mit eigenen Typen, enthält
**kein `findDOMNode`** mehr und reicht intern `nodeRef` durch — das oft zitierte
React-19-Risiko betrifft nur die 1.x-Linie. MIT-Lizenz, aktiv gepflegt.

Risiken, die damit eingekauft werden:
- RGL zieht `react-draggable`, `react-resizable`, `prop-types` und
  `resize-observer-polyfill` (2016er Polyfill) nach.
- **Null ARIA/Keyboard im Kern** → siehe 1.3, das ist keine Kür.
- `motion` v12 (bereits im Projekt) und RGL kollidieren, wenn beide dieselbe
  Kachel transformieren: `layout`-Animationen auf Kacheln während des Ziehens aus.
- Kein SSR ohne Layout-Shift, solange die Spaltenbreite gemessen wird.

### 1.2 Kein freies Resize, sondern Größen-Presets

Grafana ist mit „Dynamic Dashboards" (GA 08.04.2026) vom freien Raster als
Standard weggegangen und bietet „Auto grid" als empfohlene Variante. Notions
Home-Seite lässt sich gar nicht umsortieren, nur ein-/ausblenden. Datadog nutzt
12 Spalten mit Snapping und explizitem Edit-Modus.

Bei den PMS-Wettbewerbern (Hostaway, Cloudbeds, Mews, Lodgify) wurde **kein
DnD-anpassbares Haupt-Dashboard belegt** — alle vier haben eine feste
Startseite. Wo überhaupt Anpassbarkeit existiert, liegt sie in getrennten
BI-/Analytics-Produkten:

- **Hostaway:** Drag & Drop nur unter Financial Reporting > Analytics, und dort
  als eindimensionale Reihenfolge ohne x/y/w/h. Die Startseite nach dem Login
  ist in 708 Help-Center-Artikeln nicht als Widget-Seite dokumentiert.
- **Cloudbeds:** PMS-Dashboard fest (Top bar / Occupancy / Reservations /
  Forecast); Ausblenden nur über das Rollen-Privileg „Revenue on Dashboard".
- **Mews:** neun feste Sektionen, einzige Personalisierung ist ein
  Service-Filter; freies Layout erst im kostenpflichtigen BI **Pro**.
- **Lodgify:** einspaltig; der eine ausblendbare Block ist **unwiderruflich**
  („cannot be undone") — das Gegenteil eines „Zurücksetzen auf Standard".

**Was diesen Negativbefund trägt, ist die Cloudbeds-Gegenprobe:** Cloudbeds
beschreibt Drag & Drop dort, wo es existiert, sehr wohl — bei den Insights Hubs
(„Fully resizable and movable by drag & drop", Resize an der Kartenecke,
expliziter Save-Button, max. 15 Charts). Dasselbe Muster bei Mews (BI Pro wird
als Customization-Weg benannt, der Home screen nicht) und Lodgify
(Website-Builder-Widgets dokumentiert, PMS-Dashboard nicht). Das Schweigen zum
Haupt-Dashboard ist also aussagekräftige Abwesenheit, keine Doku-Lücke.

Einschränkung, die nicht wegformuliert werden soll: das sind
Abwesenheitsbefunde aus offizieller Doku und Release-Notes, kein
Hersteller-Dementi. Die drei Help-Center blocken WebFetch mit HTTP 403 und
wurden über die Zendesk-JSON-API gelesen — rein bildlich dokumentierte
UI-Funktionen wären dabei nicht erfasst.

Ein anpassbares Dashboard mit Bearbeiten-Modus und Reset ist im Segment damit
ein **Unterscheidungsmerkmal, kein Gleichzug**. Und wo die Wettbewerber
Personalisierung anbieten, lösen sie sie über speicherbare Views und
Settings-Dialoge statt über ein freies Raster — was den Aufwand in Abschnitt 4
und die Gegenzustände aus 3.2 (verschobene Nachbarkacheln, verwaiste
Positionen) erklärt, nicht entwertet.

Daher: **12 Spalten, Größen-Presets S/M/L statt frei ziehbarer Kanten.**
Vorhersagbar auf jeder Breite, und die Presets sind zugleich die Tastatur- und
Touch-Bedienung (1.3).

### 1.3 Barrierefreiheit ist Bedingung, nicht Zugabe

Die WAI-ARIA APG hat **kein** Drag-and-Drop-Pattern; `aria-grabbed`/
`aria-dropeffect` sind seit ARIA 1.1 deprecated und ersatzlos. Verbindlich ist
**WCAG 2.2 SC 2.5.7 „Dragging Movements" (AA)**: jede Ziehen-Funktion braucht
eine Zeiger-Alternative **ohne** Ziehen — die Norm nennt ausdrücklich
„arrow buttons or adjacent controls for list reordering". Als EU-SaaS ist das
über den European Accessibility Act nicht optional.

Konsequenz: **Das Kachel-Menü („nach oben/unten/links/rechts", „Größe S/M/L",
„ausblenden") ist Pflichtbestandteil der ersten Stufe.** Ohne es entsteht eine
Funktion, die nicht ausgeliefert werden darf.

### 1.4 Persistenz-Muster: Katalog im Code, gespeichertes Layout nur als Overlay

Grafana/Datadog speichern `{id, x, y, w, h}` je Breakpoint mit einem
`schemaVersion`-Feld und verketteten Migrationen beim Laden.

Für neu hinzukommende und entfernte Kacheln gilt: **der Code-seitige Katalog ist
die Wahrheit.** Beim Laden werden unbekannte IDs verworfen, im Katalog
vorhandene aber nicht gespeicherte Kacheln ans Ende angehängt. Das ist zugleich
die Wurzel-4-konforme Antwort: eine fehlende Kachel im gespeicherten Layout ist
kein Anlass für einen erfundenen Wert, sondern für den Katalog-Default.

---

## 2. Ist-Stand (erhoben, mit Fundstellen)

### 2.1 Die 19 Kacheln

Alle in [reservations-dashboard.tsx](web/components/dashboard/reservations-dashboard.tsx):

**Reservierungen** (Grid `lg:grid-cols-2`, [:206](web/components/dashboard/reservations-dashboard.tsx#L206)) — 5 × `ListenKarte`:
`checkouts` [:207](web/components/dashboard/reservations-dashboard.tsx#L207), `checkins` [:217](web/components/dashboard/reservations-dashboard.tsx#L217), `freigabe` [:227](web/components/dashboard/reservations-dashboard.tsx#L227), `upcoming` [:237](web/components/dashboard/reservations-dashboard.tsx#L237), `im_haus` [:249](web/components/dashboard/reservations-dashboard.tsx#L249). Alle unbedingt.

**KPI** (Grid `xl:grid-cols-4`, [:261](web/components/dashboard/reservations-dashboard.tsx#L261)) — 4 × `KpiKachel`:
`checkins` [:262](web/components/dashboard/reservations-dashboard.tsx#L262) unbedingt, `revenue_per_booking` [:276](web/components/dashboard/reservations-dashboard.tsx#L276) nur bei `data.revenue_per_booking_30d`, `revenue` [:287](web/components/dashboard/reservations-dashboard.tsx#L287) nur bei `data.revenue_30d`, `confirmed` [:298](web/components/dashboard/reservations-dashboard.tsx#L298) unbedingt.

**Nachrichten** ([:48-186](web/components/dashboard/reservations-dashboard.tsx#L48-L186), nur wenn `nachrichten !== null`) — 6 × `NachrichtenKachel` aus der `paare`-Schleife ([:51-87](web/components/dashboard/reservations-dashboard.tsx#L51-L87), je Summe + Schnitt für `gesendet`/`empfangen`/`automation`) + 1 × „ungelesene Konversationen" ([:117-182](web/components/dashboard/reservations-dashboard.tsx#L117-L182)).

**Objekte** (Grid `md:grid-cols-3`, [:314](web/components/dashboard/reservations-dashboard.tsx#L314)) — 3 × `ObjektKachel`: `objekte_gesamt`, `objekte_inaktiv`, `objekte_entwurf`.

**Zwei Kennungs-Fallen:**
1. `checkins` existiert **doppelt** — als `DashboardListe` und als
   `DashboardKpiMetrik`. Das Layout-Schema braucht deshalb zwingend ein Präfix:
   `liste:checkins` vs. `kpi:checkins`.
2. `ObjektKachel` ([:341-373](web/components/dashboard/reservations-dashboard.tsx#L341-L373)) ist lokal und **nicht exportiert**; die
   Ungelesen-Karte ist **inline gebautes JSX ohne eigene Komponente**. Beide
   müssen vor dem Raster-Umbau extrahiert werden.

### 2.2 Client/Server-Grenze

- [page.tsx](web/app/(dashboard)/page.tsx) ist Server Component (`force-dynamic`), lädt `getDashboard()` + `getNachrichtenKennzahlen()`.
- [kpi-kachel.tsx:1](web/components/dashboard/kpi-kachel.tsx#L1) und [listen-karte.tsx:1](web/components/dashboard/listen-karte.tsx#L1) sind `"use client"`.
- Jede Kachel hält eigenen `useState`/`useTransition` für ihren Zeitraum-Selektor. **Kein globaler Store** → eine Umordnung zerstört den Kachel-State nicht, solange stabile `key`s verwendet werden.
- Nachladepfade: `getDashboardListe`, `getDashboardKpi`, `getNachrichtenKennzahlen` (Server Actions in [lib/reservations.ts](web/lib/reservations.ts) / [lib/inbox.ts](web/lib/inbox.ts)).

### 2.3 Vorhandene Muster zum Abschauen

- **Reorder + Persistenz, optimistisch mit Rollback:** [photos-manager.tsx:267-281](web/components/objekte/photos-manager.tsx#L267-L281) (`persistOrder`) und [:603-628](web/components/objekte/photos-manager.tsx#L603-L628) (natives HTML5-DnD). Das Rollback-Muster wird übernommen.
- **craftjs ist ungeeignet** — baumbasierter Page-Editor mit eigenem Serialisierungsformat; alle Kacheln müssten craftjs-Nodes werden.
- **Per-User-Settings-Slice:** [privacy_settings](apps/api/src/features/privacy_settings/) (Router + Service + Schemas + Deps, ~230 Zeilen). Besonders [service.py:80-92](apps/api/src/features/privacy_settings/service.py#L80-L92) — ein einzelnes Feld verlangt zusätzlich eine Capability. Genau das Muster für den Rollen-Standard.
- **Tests:** [test_onboarding_guard.py:63-99](apps/api/src/features/dashboard/tests/test_onboarding_guard.py#L63-L99) prüft per Router-Introspektion, dass Endpunkte wirklich am Guard hängen und nicht nur an `get_current_user`. Gehört in den neuen Slice.
- **Migrations-Vorlagen:** user-scoped [0193_privacy_settings.sql](supabase/migrations/0193_privacy_settings.sql), tenant-scoped [0384_reservation_notes.sql](supabase/migrations/0384_reservation_notes.sql). Nächste freie Nummer: **0402**.

### 2.4 Was fehlt

Keine DnD-Bibliothek, keine Layout-Tabelle, keine Rollen-Standard-Tabelle, keine
Frontend-Tests in `web/` (kein `test`-Script, kein vitest/jest).

---

## 3. Datenmodell

### 3.1 Kachel-Katalog (Code, eine Quelle)

Neue Datei `web/lib/dashboard-katalog.ts` — **keine** `"use server"`-Datei
(sie exportiert Werte, nicht nur async functions; das bricht sonst erst in
„Collecting page data").

```ts
export type KachelId =
  | "liste:checkouts" | "liste:checkins" | "liste:freigabe"
  | "liste:upcoming" | "liste:im_haus"
  | "kpi:checkins" | "kpi:revenue_per_booking" | "kpi:revenue" | "kpi:confirmed"
  | "nachricht:gesendet:summe" | "nachricht:gesendet:schnitt"
  | "nachricht:empfangen:summe" | "nachricht:empfangen:schnitt"
  | "nachricht:automation:summe" | "nachricht:automation:schnitt"
  | "nachricht:ungelesen"
  | "objekt:gesamt" | "objekt:inaktiv" | "objekt:entwurf";
```

Je Eintrag: `id`, `bereich` ("reservierungen" | "kpi" | "nachrichten" | "objekte"),
`titelKey` (i18n), `standardGroesse` ("s" | "m" | "l"), `standardPosition`
(x/y im 12-Spalten-Raster, = heutige Reihenfolge) und `verfuegbar(data, nachrichten)`
— die Bedingungsfunktion, die die heutigen `&&`-Prüfungen ersetzt.

Größen-Presets: **S = 3 Spalten, M = 6, L = 12.** Höhe je Bereich fest
(Listen-Karten höher als KPI-Kacheln).

### 3.2 Gespeichertes Layout

```ts
{
  schemaVersion: 1,
  kacheln: [{ id: KachelId, x: number, y: number, groesse: "s"|"m"|"l" }],
  ausgeblendet: KachelId[]
}
```

Kein `w`/`h` — die Größe ergibt sich aus dem Preset. Kein Breakpoint-Array:
unter `lg` fällt das Raster auf **eine Spalte** zurück, Reihenfolge = `y` dann `x`.

**Zusammenführung beim Laden** (`layoutAufloesen()`, reine Funktion, testbar):
1. `schemaVersion` prüfen; unbekannt/größer → gespeichertes Layout verwerfen, Standard nehmen.
2. Gespeicherte IDs, die nicht im Katalog sind → verwerfen.
3. Katalog-IDs ohne gespeicherte Position → **ans Ende anhängen**, nicht ausblenden. Eine neue Kachel soll sichtbar werden.
4. Kacheln, deren `verfuegbar()` false ist → nicht rendern (unabhängig vom Layout; das ist Datenlage, keine Präferenz).
5. Reihenfolge der Quellen: **Benutzer-Layout → Rollen-Standard → Katalog-Standard.**

### 3.3 Migration 0402

Zwei Tabellen in einer Migration, idempotent (`create table if not exists`,
`drop policy if exists` vor `create policy`):

```sql
-- Layout des einzelnen Benutzers
create table if not exists public.dashboard_layouts (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    layout     jsonb not null,
    updated_at timestamptz not null default now()
);

-- Standard je Rolle, gesetzt von der Betriebsleitung
create table if not exists public.dashboard_role_defaults (
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    role       public.user_role not null,
    layout     jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (tenant_id, role)
);
```

**Wurzel 6** — für beide Tabellen:
- `revoke all on public.<tabelle> from anon, authenticated;`
- restriktive Policy `as restrictive for all` (nicht nur `for select`):
  `dashboard_layouts` über `user_id = auth.uid()`,
  `dashboard_role_defaults` über `tenant_id = public.current_tenant_id()`.
- `enable row level security` auf beiden.

Prüffrage vor „fertig": *Was kann ein eingeloggter co_admin mit dem anon-Key per
`curl` gegen `/rest/v1/dashboard_role_defaults` lesen UND schreiben?* Antwort
muss „nichts" sein — der Schreibpfad läuft ausschließlich über FastAPI mit
`MANAGE_TENANT`.

`layout` ist `jsonb` und kommt von einem Client. Deshalb (Wurzel 8):
**serverseitige Validierung mit harter Obergrenze** — max. 40 Einträge, jede
`id` gegen ein Pydantic-`Literal` der Katalog-IDs, `x`/`y` als `int` mit
`ge=0, le=200`, `groesse` als `Literal["s","m","l"]`. Alles andere → 422.
Kein „unbekanntes Feld still schlucken".

### 3.4 Realtime

`dashboard_layouts` bekommt **kein** Realtime-Abo. Der Grant an `authenticated`
ist bewusst entzogen (3.3), ein Abo wäre also eine stumme Attrappe — genau der
Fehler, den die Projektregel benennt. Das eigene Layout ändert man ohnehin im
eigenen Tab; ein zweiter Tab zieht beim nächsten Aufruf nach.
`bash scripts/realtime/abos-pruefen.sh` muss danach weiterhin grün sein.

---

## 4. Umsetzung in fünf Stufen

### Stufe 1 — Kacheln vereinzeln (kein sichtbares Verhalten)

1. `ObjektKachel` in eigene Datei `web/components/dashboard/objekt-kachel.tsx` und exportieren.
2. Ungelesen-Karte aus dem Inline-JSX in `web/components/dashboard/ungelesen-karte.tsx` extrahieren.
3. `web/lib/dashboard-katalog.ts` anlegen (3.1) — mit den heutigen Positionen als Standard.
4. `reservations-dashboard.tsx` rendert weiter das **heutige feste Grid**, aber die Kachelmenge kommt aus dem Katalog statt aus handgeschriebenem JSX.

Ergebnis: Seite sieht identisch aus, ist aber datengetrieben. `tsc --noEmit` +
`bun run lint` in `web` grün.

### Stufe 2 — Backend-Slice `dashboard_layout`

Neuer Slice `apps/api/src/features/dashboard_layout/` nach dem
`privacy_settings`-Muster (Router, Service, Schemas, Dependencies, Tests).

| Endpunkt | Guard | Zweck |
|---|---|---|
| `GET /dashboard-layout` | `CurrentUser` | eigenes Layout + geerbter Rollen-Standard + `quelle` ("benutzer"/"rolle"/"standard") |
| `PUT /dashboard-layout` | `CurrentUser` | eigenes Layout speichern (upsert auf `user_id`) |
| `DELETE /dashboard-layout` | `CurrentUser` | zurücksetzen → Zeile löschen, Rollen-Standard greift wieder |
| `GET /dashboard-layout/rollen-standard/{role}` | `require_permission(MANAGE_TENANT)` | Standard einer Rolle lesen |
| `PUT /dashboard-layout/rollen-standard/{role}` | `require_permission(MANAGE_TENANT)` | Standard setzen |
| `DELETE /dashboard-layout/rollen-standard/{role}` | `require_permission(MANAGE_TENANT)` | Standard entfernen |

Wichtig:
- **Wurzel 3:** `dashboard_role_defaults` immer über `load_scoped(db, ..., tenant_id=ctx.tenant_id)` bzw. explizite `.eq("tenant_id", ctx.tenant_id)` — service_role umgeht RLS.
- **Wurzel 9:** die `{role}`-Endpunkte prüfen denselben Scope wie ein Listenpfad; zusätzlich muss `role` ein gültiger `user_role`-Wert sein → sonst 422, kein freier String in die DB.
- Die neue Capability-Prüfung hängt an `MANAGE_TENANT`, **keine neue PM-Capability** — sonst kostet jeder Layout-Load eine zusätzliche DB-Abfrage (`_guard_pm`).
- Fehlt eine Zeile → **Defaults, kein 404** (wie `privacy_settings.get()`).

Tests: Guard-Matrix über alle fünf Rollen + `None`/`""`/Phantasie-Rolle
(fail-closed), Validierungs-Grenzen (41 Einträge → 422, unbekannte ID → 422),
Zusammenführungs-Reihenfolge, und der Verdrahtungstest aus
`test_onboarding_guard.py`.

`uv run pytest src/features/dashboard_layout -q` — nur dieser Slice.

### Stufe 3 — Frontend-Raster mit Bearbeiten-Modus

1. `bun add react-grid-layout@2.2.4` in `web`.
2. Neue Client-Komponente `web/components/dashboard/kachel-raster.tsx`:
   - Lesemodus: `isDraggable={false} isResizable={false}` → kein versehentliches Verschieben.
   - Bearbeiten-Modus über einen Umschalter in der Kopfzeile.
   - RGL per `next/dynamic` mit `ssr: false` nachladen; serverseitig zunächst ein einfaches CSS-Grid aus denselben Positionen rendern, damit kein Layout-Shift entsteht.
   - `measureBeforeMount` + `initialWidth` setzen.
   - 12 Spalten; unter `lg` eine Spalte, DnD dort **aus**.
   - `motion`-`layout`-Animationen auf Kacheln im Bearbeiten-Modus deaktivieren (Kollision mit RGL-Transforms).
3. **Kachel-Menü (WCAG 2.5.7, Pflicht):** je Kachel ein Menü mit „nach oben/unten/links/rechts", „Größe S/M/L", „ausblenden". Vollständig per Tastatur bedienbar, auf Touch die einzige Bedienart.
4. Persistenz nach dem `photos-manager`-Muster: optimistisches lokales Update → Server Action → bei Fehler Rollback + `toast.error`. **Kein stilles Verschlucken** (Wurzel 5).
5. Panel „Kacheln verwalten": ausgeblendete Kacheln wieder einschalten, „Auf Standard zurücksetzen".

### Stufe 4 — Rollen-Standard-UI

In `/konto` (nicht als neue Tab-Flut — die Projektregel will alles gebündelt):
Abschnitt „Dashboard-Standard", sichtbar nur mit `MANAGE_TENANT`. Rolle wählen
(realistisch: `admin`, `co_admin` — siehe 0.1; die übrigen Rollen erreichen die
Seite nicht und werden im UI als solche gekennzeichnet, statt sie stumm
anzubieten), Layout aus dem eigenen aktuellen übernehmen oder zurücksetzen.

### Stufe 5 — i18n + Gate

Neue Schlüssel unter `reservations.dashboard.layout.*` in **allen 24 Sprachen**
(`web/messages/*.json`): Bearbeiten-Modus an/aus, die vier Bewegungsrichtungen,
Größen S/M/L, ausblenden/einblenden, „Kacheln verwalten", „Auf Standard
zurücksetzen", „Dashboard-Standard für Rolle", Fehlermeldung beim Speichern,
plus je Kachel ein Katalog-Titel für die Verwalten-Liste.

Danach `scripts/i18n/gate.sh web` — **ohne** dessen `next build`-Schritt, der auf
diesem Rechner nicht laufen darf; die Schritte werden einzeln aufgerufen
(`pruefe-uebersetzungen.mjs`, `pruefe-locales-vollstaendig.mjs`,
`pruefe-feld-labels.mjs`, `tsc --noEmit`).

---

## 5. Qualitätsgate vor „fertig"

- `uv run pytest src/features/dashboard_layout -q` grün; voller Lauf **einmal** vor dem Commit.
- `ruff check` sauber, `pylint` 10.00/10 **nur auf den geänderten Dateien**.
- `tsc --noEmit` in `web` und `builder`; `bun run lint` in `web` fehlerfrei.
- **Kein `next build` lokal.** Die Direktiven-Regel (`"use server"` exportiert nur async functions) wird im Kopf geprüft — `dashboard-katalog.ts` ist deshalb bewusst keine Server-Datei.
- Migration 0402 via `bash supabase/apply-migrations.sh` einspielen (nicht automatisch), danach der anon-Key-`curl`-Gegentest aus 3.3 — lesend **und** schreibend.
- `bash scripts/realtime/abos-pruefen.sh` grün (keine neue Attrappe).
- `uv pip-audit` und `npm audit` ohne offene CVE — insbesondere die vier transitiven RGL-Abhängigkeiten.
- Tastatur-Durchgang: Layout vollständig ohne Maus änderbar (SC 2.5.7).

## 6. Reihenfolge und Schnitt

Stufe 1 und 2 sind unabhängig und können parallel laufen. Stufe 3 braucht beide.
Stufe 4 braucht Stufe 2 und 3. Stufe 5 läuft mit Stufe 3 und 4 mit.

Nach Stufe 3 ist die Funktion für den einzelnen Benutzer vollständig nutzbar —
das ist der sinnvollste Punkt für eine Zwischenabnahme, bevor Stufe 4 die
Rollen-Standards mit ihren zwei realen Adressaten obendrauf setzt.
