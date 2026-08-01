# NOTES.md — Live-Session-Status NextDays

> Bei jeder neuen Session ZUERST diese Datei lesen. Nach jeder Session aktualisieren.
> Historie: docs/history/

## Stand: 01.08.2026 · Branch: main · alles committet und gepusht (`ac8b71e`)

## Was läuft

- API: `pytest` 1353 passed / 100 deselected, `ruff` sauber, `pylint` 10.00/10 auf den
  geänderten Modulen. CI auf main grün.
- web + builder: `tsc --noEmit` ohne Fehler. Keine Testsuite vorhanden (kein `test`-Skript).
- mobile-bestdays: Jest 2 Suites / 7 Tests. mobile-nextdays: Jest 3 Suites / 14 Tests.
  Runner ist Jest (`npx jest`), NICHT `bun test`.
- DB: Migrationen bis `0251_channex_ari_shadow` live angewendet (gegen Server-DB geprüft).
- Channel-Manager: ARI-Push, Buchungs-Feed, Storno-/Modifikations-Diff, Voll-Abgleich,
  Mapping-Assistent, Portal-Katalog — **push-only, ohne jeden Lesezugriff auf die ARI**.

## Zuletzt erledigt (01.08.2026)

1. **ARI-Readback abgestellt** (Beschwerde des Portal-Aggregators per Mail, „push only
   changes … you are the source of truth"). Ursachen waren: `get_restrictions` über
   365 Tage je Objekt im Preis-Abgleich, periodischer `import_ari_for_property` im Cron,
   15-Minuten-Tick und ein Enqueue bei jedem Seitenaufruf der Kanäle-Liste.
   Neu: `channex_ari_shadow` (0251) hält den zuletzt erfolgreich gepushten Preis/Min-Stay
   je lokalem Rate-Plan und Tag; der Abgleich diffed Soll gegen diesen Schatten und pusht
   nur die Differenz. Reconcile-Tick täglich, eigener 5-Minuten-Tick für Outbox-Retry +
   nächtlichen Full-Sync. Umstellung gelaufen über
   `POST /api/v1/channel-manager/internal/seed-ari-shadow` (27 Objekte, 9 Rate-Pläne,
   3886 Werte, 0 externe Requests); anschließender voller Reconcile über 4 Tenants:
   0 Lesezugriffe, 0 Pushes. Regeln dazu in `docs/CHANNEX-FELDER.md` unten.
   Antwortmail an den Aggregator ist raus.
2. **Zimmer als eigene Entität** (0245–0250) samt Slice `properties/rooms.py`,
   Objekt-Übersicht, Kartei-Stepper, Kanal-Matrix und Übersetzungen — committet.
   `count_of_rooms` geht jetzt fest als 1 nach außen (1 property = 1 buchbare Einheit).

## Angefangen, unfertig

- **`docs/PLAN-buchungskonditionen.md` — wartet auf Freigabe durch Andy.** Vollständiger
  Plan, Buchungskonditionen zu vereinheitlichen: heute existieren ZWEI unverbundene
  Modelle — `booking_conditions` (0165/0168, wirkt auf Zahlungen/Storno/Kaution, UI unter
  `/einstellungen`) und ein JSON-Blob `type_attributes.policies` am Objekt
  (`/objekte/<id>/richtlinien`, Lodgify-Nachbau, **ohne jede Wirkung**). Der Plan enthält
  die live geprüften Aggregator-Felder (`/cancellation_policies`, `hotel_policies`),
  Airbnb-/Booking.com-Grenzen und die EU-Pflichtangaben. Vier offene Entscheidungen in
  Kapitel 9 sind noch unbeantwortet.
- Aus dem Plan bereits belegt und noch offen: unser `hotel_policies`-Sync sendet
  `checkin_time`/`checkout_time`, die API verlangt real das Zeitfenster
  `checkin_from_time`/`checkin_to_time`/`checkout_from_time`/`checkout_to_time`
  (`content_sync._build_hotel_policy_attrs`). Vor dem Umbau mit einem echten Call prüfen.
- `docs/CHANNEL-MANAGER-AUSBAU.md`: 12 Pakete, offen ab Paket 2. Paket 2
  (Ereignis-/Fehler-Center) hat noch keine Route unter `web/app/(dashboard)/channels/`.
- `apps/api/src/features/crm` und `.../ocr`: je 38 LOC, reine Health-Stubs.
- 13 Slices ohne `tests/`-Ordner, überwiegend die Gast-Slices: guest_auth, guest_blocks,
  guest_bookings, guest_messages, guest_reviews, guest_stay, guest_wishlist,
  host_messages, host_profiles, login_devices, privacy_settings,
  property_custom_fields, property_discounts.
- `guest_auth/service.py:103,234` — Gast-Signup bestätigt E-Mail selbst
  (`email_confirm=True`), E-Mail-Wechsel ohne Re-Auth (Wurzel 7, dokumentiert offen).

## Bekannte Probleme

- Doppelte Migrationsnummern: 0238 und 0242 je zweimal vergeben (0246 wurde bereinigt,
  der ARI-Schatten liegt jetzt auf 0251). Alle sind live angewendet, der Runner trackt
  Dateinamen — ein frischer Deploy auf leere DB reproduziert die ursprüngliche
  Reihenfolge aber nicht mehr.
- (erledigt 01.08.2026) Die 8 toten Realtime-Abos in web hängen jetzt auf
  `reservations`. Gegen die Live-DB geprüft: payments, invoices, invoice_line_items,
  commission_ledger und owner_statements haben für `authenticated` KEIN SELECT
  (Grant-Entzug ist gewollt, Wurzel 6), `reservations` hat SELECT und liegt in der
  Publikation `supabase_realtime`. Umgehängt: konto-abo-section, guest-detail
  (Rechnungen-Reiter, `guest_id`), booking-timeline (`payments` → `payment_status`
  an der Reservierung), owner-realtime (Abo entfernt, `reservations` war schon da),
  my-statements, invoices-client (zwei Abos → eines auf `tenant_id`),
  use-reservation-detail (`invoices`-Abo entfernt).
  Bewusste Lücke: rein manuell angelegte Rechnungen ohne Reservierungsbezug und
  frisch erzeugte Eigentümer-Abrechnungen lösen kein Event aus — sie erscheinen
  erst beim nächsten Laden.
  Dauerhafter Schutz gegen die Bug-Klasse (01.08.2026): `RealtimeDebugPanel` war
  seit seiner Entstehung toter Code (Import im Dashboard-Layout, JSX nie —
  `git log -S "<RealtimeDebugPanel"` findet keinen Treffer; `web` hat keine
  ESLint-Config und kein `noUnusedLocals`, deshalb still). Beim Einhängen kam ein
  echter Fehler hoch: `getServerSnapshot` lieferte jedes Mal ein neues Array.
  Behoben: Konstante `KEINE_ABOS`, Overlay jetzt oben rechts (unten rechts sitzen
  Andy + Support-Chat), gerendert nur bei `NODE_ENV !== "production"` oder
  `NEXT_PUBLIC_REALTIME_DEBUG=1`, und das Debug-Register baut seinen Snapshot
  lazy statt bei jedem Event. Neu: `scripts/realtime/abos-pruefen.sh` prüft alle
  67 abonnierten Tabellen aus den sechs Frontends live auf Grant + Publikation;
  fand dabei eine 9. Attrappe — `tenant_billing_profile` in
  `gastgeber/components/konto/unternehmen-tab.tsx` (0169 entzieht die Grants
  bewusst). Dort gibt es keine erlaubte Ersatzquelle, das Abo ist ersatzlos
  raus. Skript läuft jetzt grün (Exit 0).
  Live im Browser bewiesen (zwei Tabs, `/buchhaltung` + `/kalender`): Abo
  `reservations · tenant_id=eq.<tenant>` steht auf SUBSCRIBED mit Token, und eine
  im Kalender angelegte und wieder stornierte Testreservierung erzeugte 2 Events;
  `performance.getEntriesByType('resource')` im Buchhaltungs-Tab zeigt genau dazu
  zwei zusätzliche `/invoices/company/<tenant>`-Requests (bei 492 s und 683 s nach
  Seitenaufbau, ohne Reload, ohne Polling).

## Nächster Schritt

1. Freigabe zu `docs/PLAN-buchungskonditionen.md` einholen (Kapitel 9) und danach bauen.

## Regel, die aus der Aggregator-Beschwerde folgt

Vor jeder Änderung am Channel-Manager prüfen: *Löst das einen Lesezugriff auf
ARI/Verfügbarkeit/Preise aus?* Wenn ja: nicht bauen. Erlaubt bleiben der einmalige
Import beim Verbinden eines Objekts, der Buchungs-Webhook samt Revisions-Feed und der
nächtliche Full-Sync-Push.
