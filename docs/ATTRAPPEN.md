# Attrappen-Bestand — Codebase-Suche vom 27.08.2026

Eine **Attrappe** ist Code, der nach Funktion aussieht, aber keine hat: ein Knopf
ohne Handler, ein Endpunkt, der immer leer antwortet, eine Kennzahl, die niemand
gemessen hat. Sie ist gefährlicher als ein Fehler, weil niemand sie meldet — die
Oberfläche wirkt vollständig.

Gesucht wurde über alle 13 Teilprojekte (`web`, `plattform`, `gastgeber`,
`marketing`, `builder`, `admin`, `storybook`, `apps/api`, `apps/public-api`,
`mobile-bestdays`, `mobile-nextdays`, `packages`, `scripts`) nach neun Mustern:
leere/fehlende Event-Handler, tote Links, Stub-Endpunkte, Mock-Daten im
Produktionspfad, unerreichbare Komponenten, funktionslose Eingabefelder,
Prüfgates ohne Zähne, erfundene Kennzahlen, Realtime-Attrappen.

Tests, Storybook-Stories und Übersetzungsdateien sind ausgeschlossen — dort sind
Fakes der Zweck, keine Attrappe.

---

## A — Schwerwiegend: falsche Aussage nach außen

### A1 · Erfundene Kundenstimmen, Kennzahlen und Bewertungssiegel
**`web/app/(public)/marketing/`** (Route `/marketing` in der PMS-App)

| Stelle | Behauptung | Beleg |
|---|---|---|
| `components/marketing/marketing-testimonials.tsx:5-18` | Zwei namentliche Kundenstimmen („French Bay House, Neuseeland", „Country Dome Suites, Houston, USA") mit 5 Sternen | keiner — fest im Code |
| `components/marketing/marketing-intro.tsx:71` | „Wir betreuen über 53.000 Unterkünfte weltweit." | keiner |
| `components/marketing/marketing-hero.tsx:28` | „Empfohlen von 53.000+ Gastgebern" | keiner |
| `components/marketing/marketing-stats.tsx:15-21` | „140+ Länder", „450+ Kanäle", „96 % Zufriedenheit", „19+ Jahre Erfahrung als Branchenführer" | keiner |
| `components/marketing/marketing-stats.tsx:7-12` | Logos von HotelTechReport, Software Advice, Capterra, Trustpilot neben 4 Sternen | keine dort hinterlegte Bewertung |

Das ist keine gewöhnliche Attrappe, sondern eine Falschaussage mit rechtlichem
Gewicht (irreführende Werbung, fremde Marken als Gütesiegel). „19+ Jahre
Erfahrung" ist bei einem Unternehmen dieses Alters nachweislich falsch.

Erschwerend: Diese Seite ist ein **Doppelgänger**. Die echte Marketing-Seite ist
das eigene Projekt `marketing/` (24-sprachig, Live-Preise aus Stripe). Die Seite
unter `web/app/(public)/marketing/` ist ein Figma-Nachbau
(`Soj052u1PbHfASB2RMsOba`) aus einer früheren Phase und liefert unter derselben
Domäne eine zweite, unübersetzte, unwahre Fassung aus.

**Empfehlung:** Route und `web/components/marketing/*` ersatzlos entfernen. Kein
Ersetzen der Zahlen durch andere Zahlen (Wurzel 4) — die Sektionen haben ohne
belegte Daten keinen Inhalt.

### A2 · Buchhaltungs-Endpunkte, die Erfolg quittieren ohne zu speichern
**`apps/api/src/features/buchhaltung/router.py`**

| Zeile | Endpunkt | Verhalten |
|---|---|---|
| 296 | `GET /companies/{id}/transaction-links` | immer `[]` |
| 318 | `GET /booking-accounts/{company_id}` | immer `[]` |
| 388 | `POST /inline-invoice-services` | **No-Op mit Erfolgsantwort** |
| 397 | `GET /inline-invoice-services` | immer `[]` |
| 403 | `GET /text-templates/{company_id}` | immer `[]` |
| 414 | `GET /text-templates/{company_id}/default` | immer `null` |
| 455 | `GET /users/{user_id}/preferences` | immer `{}` |
| 466 | `PATCH /users/{user_id}/preferences` | **bestätigt den Schreibvorgang, persistiert nicht** |
| 474 | `POST /text-templates/{company_id}/initialize` | **No-Op mit Erfolgsantwort** |

Dazu `service.py:484-499` — drei Methoden mit `return []` nach `_require_tenant`.

Die vier Lese-Stubs sind vertretbar (sie verhindern laut Docstring einen
404-Render-Loop) — die **drei Schreib-Stubs sind es nicht**: Sie melden dem
Nutzer „gespeichert", während nichts gespeichert wird. Das ist genau der
verschluckte Kontrollpfad aus Wurzel 5, nur an der Oberfläche statt im `except`.

**Empfehlung:** Schreib-Stubs auf `501 Not Implemented` umstellen, damit das
Frontend den Fehlschlag zeigt — oder die aufrufende UI abschalten.

---

## B — Toter Code, der als Funktion im Baum steht

### B1 · GoBD-Modul: sieben Komponenten, null Aufrufer, Mock-Daten
**`web/components/finance/gobd/`** — `GoBDSystem`, `ComplianceDashboard`,
`AutoLockSettings`, `SevDeskLockManager`, `StornoManager`, `ManualLockManager`,
`GoBDActionWarning`.

Keiner dieser sieben Namen kommt außerhalb des Ordners vor. Das Modul ist
vollständig unerreichbar. Zusätzlich arbeitet es mit hartkodierten Fantasiedaten:

- `GoBDSystem.tsx:15-29` — `mockDocument` mit `RE-MOCK-001`, 1190,00 €
- `ManualLockManager.tsx:53-81` — `loadDocuments()` lädt nichts, sondern setzt
  zwei erfundene Rechnungen (`RE-MOCK-001`, `RE-MOCK-002`) in den State

Würde jemand `GoBDSystem` einbinden, sähe er ein funktionierendes
GoBD-Compliance-Modul, das Fantasie-Rechnungen „festschreibt".

Ebenfalls Fremdkörper aus einem anderen Projekt: der ganze Ordner arbeitet mit
`companyId`, `sevDesk` und `@tasko/ui`, nicht mit dem NextDays-Datenmodell
(Tenant/Objekt/Einheit).

**Empfehlung:** Ordner löschen.

### B2 · `builder/components/checkout-steps.tsx`
Unreferenziert. Enthält zusätzlich einen „Weiter"-Knopf ohne Handler
(`:44`) — eine Attrappe in einer Leiche.

---

## C — Knöpfe ohne Wirkung (bestätigt, kein Popover-/Dialog-Auslöser)

### C1 · `gastgeber` — Objekt-Editor
| Stelle | Verspricht | Tut |
|---|---|---|
| `components/objekt-editor/foto-tour.tsx:44` | „Alle Fotos" | nichts |
| `components/objekt-editor/foto-tour.tsx:51` | „Foto hinzufügen" (+) | nichts |
| `components/objekt-editor/foto-tour.tsx:62` | „Offene Aufgaben ›" | nichts |
| `components/objekt-editor/objekt-editor.tsx:625` | Reiter „Dein Objekt" | nichts (fest als aktiv gestylt) |
| `components/objekt-editor/objekt-editor.tsx:631` | Reiter „Anreise-Guide" | nichts |
| `components/objekt-editor/raum-detail.tsx:362` | **„Raum löschen"** | nichts |
| `components/konto/konto-nav.tsx:92` | „E-Mail bestätigen" | nichts |
| `components/host-topnav.tsx:174` | Glocke „Benachrichtigungen" | nichts |
| `components/wizard/wizard-shell.tsx:43` | „Hilfe" | nichts |

Die beiden Reiter in `objekt-editor.tsx` sind besonders irreführend: Der erste
trägt dauerhaft das Aktiv-Styling, der zweite ist damit für den Nutzer ein
sichtbarer, aber unerreichbarer Bereich.

### C2 · `plattform` — Filterleiste des Marktplatzes
| Stelle | Verspricht | Tut |
|---|---|---|
| `components/plattform-nav.tsx:91` | Kategorie-Reiter (Desktop), `TABS.map` | nichts; `i === 0` immer aktiv |
| `components/plattform-nav.tsx:169` | dieselben Reiter als wischbare Chips (mobil) | nichts |

Das ist der Airbnb-Kategoriefilter — er sieht bedienbar aus, filtert aber nie.

### C3 · `web` — Marketing-Doppelgänger (siehe A1)
| Stelle | Verspricht | Tut |
|---|---|---|
| `components/marketing/marketing-nav.tsx:44` | Sprachwahl „🌐 Deutsch" | nichts |
| `components/marketing/marketing-footer.tsx:124` | Sprachwahl „🌐 Deutsch" | nichts |
| `components/marketing/marketing-intro.tsx:77` | Objekttyp-Filterchips | nichts; `i === 0` immer aktiv |

### C4 · `mobile-nextdays`
| Stelle | Verspricht | Tut |
|---|---|---|
| `screens/HostListings.tsx:87` | „+ Neues Objekt" | kein `onPress` |

### C5 · Leere Handler mit Kommentar statt Körper
`web/components/finance/AddCustomerModal.tsx`

| Zeile | Beschriftung | Handler-Körper |
|---|---|---|
| 499 | „Bestehende Person auswählen" | `/* Bestehende Person auswählen */` |
| 507 | „Neue Person anlegen" | `/* Neue Person anlegen */` |
| 520 | „Bearbeiten" | `/* Bearbeiten Funktion */` |

Dazu zwei Knöpfe ganz ohne Handler in derselben Datei (`:491`, `:531` —
„Person hinzufügen", „Optionen"). Diese Datei ist über
`web/app/(dashboard)/buchhaltung/` erreichbar, also **im Produktivpfad**.

### C6 · Tote Social-Links
| Stelle | Zahl | Ziele |
|---|---|---|
| `web/components/marketing/marketing-footer.tsx:135` | 4 | Facebook, Instagram, YouTube, LinkedIn → `href="#"` |
| `plattform/components/site-footer.tsx:127` | 3 | Facebook, X, Instagram → `href="#"` |

`plattform/components/site-footer.tsx` ist ansonsten schon bereinigt (Kommentar
Zeile 13 dokumentiert 15 entfernte `href="#"`); die Social-Reihe wurde dabei
übersehen.

---

## D — Halbe Funktion, ehrlich benannt (kein Handlungszwang, aber Bestand)

Diese Stellen sind **keine** Attrappen im engeren Sinn: Sie benennen ihre Grenze
im Code. Sie stehen hier, damit sie nicht in Vergessenheit geraten.

| Stelle | Grenze |
|---|---|
| `admin/lib/auth.ts:75-82` | 2FA-Anmeldung im Backoffice nicht gebaut — Konto mit MFA kommt nicht hinein, Meldung ist ehrlich |
| `builder/app/api/v1/[...path]/route.ts:19` | Proxy leitet **ohne Authorization-Header** weiter (`// TODO Auth`) — trägt, solange nur öffentliche Endpunkte gehen; jeder geschützte Endpunkt hinter diesem Proxy wäre sofort ein Loch |
| `apps/api/src/features/guest_auth/service.py:112` | `email_confirm=True` beim Gast-Selbstanlegen — dokumentierter Verstoß gegen Wurzel 7 |
| `apps/api/src/features/guest_auth/service.py:271` | E-Mail-Wechsel ohne Re-Auth/Doppel-Opt-in |
| `web/services/customerService.ts:250-268` | `subscribeToCustomers` heißt „subscribe", ist aber 5-Sekunden-Polling; `console.warn` sagt es — die **Signatur** verspricht Realtime |
| `web/components/finance/SendDocumentModal.tsx:1699` | „Post-Operation (noch nicht implementiert)" — der Zweig läuft trotzdem durch |
| `web/components/finance/SendDocumentModal.tsx:1825` | `await new Promise(r => setTimeout(r, 2000))` — zwei Sekunden Wartezeit ohne Arbeit dahinter |
| `apps/api/src/features/pricing/market/factory.py` | Ohne `MARKET_DATA_PROVIDER`/`airdna_api_key` liefert der `NullProvider` **immer `{}`**, der Markt-Faktor bleibt 1.0. Sauber gebaut und dokumentiert — aber jede UI, die „Marktdaten" verspricht, zeigt im Auslieferungszustand ein neutrales Signal |
| `web/app/(dashboard)/layout.tsx:95` | Rolle/Berechtigungen „vorerst leer" |

---

## E — Prüfgates, die existieren, aber nicht greifen

Die `CLAUDE.md` verlangt eine Reihe von Prüfläufen vor „fertig". Alle geprüften
Skripte haben einen echten Fehlerausgang (`exit 1`) — **keines ist eine
Attrappe im Code**. Aber 23 davon laufen in **keinem CI-Workflow**, hängen also
allein an der Disziplin des Menschen:

**Rein statisch, könnten sofort in CI:**
`scripts/i18n/deutsche-restwerte-pruefen.mjs` ·
`scripts/i18n/pruefe-rechtstexte.mjs` ·
`scripts/i18n/uebersetzungs-luecken-pruefen.mjs` ·
`scripts/i18n/gate.sh` ·
`scripts/diagnose/meta-pixel-verdrahtung-pruefen.mjs` ·
`scripts/mobile/ueberlauf-pruefen.mjs` ·
`scripts/diagnose/app-icons-pruefen.py`

**Brauchen Live-DB oder Live-Domäne (CI-Einbindung nur mit Zugang möglich):**
`db-spalten-pruefen.py` · `db-trigger-pruefen.sh` · `realtime/abos-pruefen.sh` ·
`security/direktpfad-pruefen.sh` · `mail-umgebung-pruefen.sh` ·
`ga4-treffer-pruefen.mjs` · `stop-sell-echo-pruefen.sh` ·
`nachberechnung-pruefen.sh` · `erstattung-und-einlage-pruefen.sh` ·
`addon-storno-pruefen.sh` · `aufgaben-agenda-pruefen.sh` ·
`buchung-einheit-pruefen.sh` · `gaestemappe-pruefen.sh` ·
`mcp/connector-pruefen.sh` · `tasks/aufgaben-luecken-pruefen.sh` ·
`messung-einwilligung-pruefen.sh`

Eine Regel, die nur greift, wenn jemand daran denkt, ist die Gate-Variante einer
Attrappe: Sie steht geschrieben und wirkt nicht.

---

## Nicht gefunden (bewusst geprüft, sauber)

- **Leere Event-Handler** `onClick={() => {}}` — keine, außer C5.
- **Tote Eingabefelder** (`value` ohne `onChange`/`readOnly`) — vier Treffer,
  alle uncontrolled Formulare mit `defaultValue`/`type="hidden"`, korrekt.
- **Tote Schalter** (`Switch`/`Checkbox` ohne Change-Handler) — keine im
  Produktivcode.
- **Prüfskripte ohne Fehlerausgang** — keine.
- **`href="#"` im `builder`, `marketing`, `admin`, `gastgeber`** — keine.
- **Realtime-Abos** — `scripts/realtime/abos-pruefen.sh` prüft Grant und
  Publikation gegen die Live-DB und war nicht ohne DB-Zugang ausführbar; hier
  statisch nichts Auffälliges. **Dieser Punkt ist offen**, nicht freigegeben.

---

## Reihenfolge zur Abarbeitung

1. **A1** — Falschaussagen und fremde Gütesiegel aus dem Auslieferungsstand
   nehmen. Rechtliches Risiko, nicht nur Kosmetik.
2. **A2** — die drei Schreib-Stubs auf `501` heben oder die UI abschalten.
3. **B1 · B2** — toten Code löschen.
4. **C5 · C1** — Attrappen im Produktivpfad (Buchhaltung, Objekt-Editor);
   „Raum löschen" ist die gefährlichste, weil der Nutzer eine Löschung annimmt.
5. **C2 · C6 · C4 · C3** — Filter, Social-Links, mobile Aktion.
6. **E** — die sieben statischen Gates in `ci.yml` aufnehmen.
7. **D** — bei der nächsten Berührung des jeweiligen Bereichs schließen.
