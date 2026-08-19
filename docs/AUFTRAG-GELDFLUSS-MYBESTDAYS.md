# Auftrag — Geldfluss myBestDays: Treuhand bis zur Abreise, dann Auszahlung

Dieser Text ist als Prompt für eine neue Claude-Code-Sitzung gedacht.
Er ist selbsttragend: alle Befunde sind am Code verifiziert und mit Pfad +
Zeile belegt. Nichts davon muss neu recherchiert werden.

---

## Worum es geht (in einem Satz)

Bucht ein Gast über den eigenen Marktplatz myBestDays, soll **das gesamte
Geld bis nach der Abreise bei uns liegen**; erst danach — nach einer
Karenzzeit — geht der Nettoanteil an das Stripe-Verbundkonto des Betriebs,
und die 8 % Provision bleiben bei uns.

Storno ist ein **Sonderfall davon**, nicht der Kern: Solange das Geld sofort
weitergereicht wird, kann über die Provision gar nicht mehr entschieden
werden — sie ist dann schon weg.

---

## Der Kern: was sich am Geldweg ändert

### Heute (Destination Charge, aktiv)

```
Gast zahlt 1.000 DKK
  → Stripe: transfer_data.destination = Verbundkonto des Betriebs
  → application_fee_amount = 80 DKK bleibt bei uns
  → 920 DKK sind SOFORT beim Betrieb — vor der Anreise
```

Wir sehen also nur die Provision. Der Buchungsbetrag läuft durch, ohne je
auf unserem Saldo zu liegen. Belegt in
`apps/api/src/features/payments/stripe_client.py:204-208`.

### Danach (Separate Charges, Ziel)

```
Gast zahlt 1.000 DKK
  → volle 1.000 DKK auf UNSEREM Plattform-Saldo (transfer_group gesetzt)
  → Aufenthalt läuft
  → Abreise + Karenz
  → Transfer von 920 DKK an das Verbundkonto
  → 80 DKK bleiben bei uns
```

Der Code beschreibt das bereits wörtlich
(`stripe_client.py:226-231`): *„Der volle Betrag landet auf dem
Plattform-Saldo, und der Auszahlungslauf transferiert nur den Nettoanteil
weiter — die Provision bleibt dadurch bei uns, ohne dass Stripe sie separat
verbuchen muss."*

### Was das bedeutet, und im bisherigen Auftrag fehlte

1. **Zwischen Zahlung und Auszahlung liegt fremdes Geld auf unserem
   Saldo.** Das ist buchhalterisch KEINE Einnahme, sondern eine
   Verbindlichkeit gegenüber dem Betrieb. Nur die 8 % sind Ertrag.
   Wer das als Umsatz bucht, bilanziert falsch.
2. **Storno vor Anreise braucht kein Zurückholen mehr** — das Geld war nie
   beim Betrieb. Das ist der eigentliche Gewinn der Umstellung und der
   Grund, warum diese Etappe VOR dem Storno-Entscheid kommt.
3. **Rückforderungen werden verrechnet, nicht eingezogen** (Airbnb-Modell,
   `faelligkeit.verrechne()`): offene Posten mindern die NÄCHSTE Auszahlung,
   nie ein Bankeinzug, nie ein negativer Betrag.
4. **Die Abzugsreihenfolge steht fest** (`faelligkeit.berechne_aufteilung()`):
   Plattform-Provision zuerst (fest und unantastbar), dann Spende und
   Co-Gastgeber — beide zulasten des Gastgebers. Was bleibt, ist seine
   Auszahlung. Übersteigen die Abzüge den Bruttobetrag → Fehler, kein
   negativer Betrag (Wurzel 5).

---

## Ausgangslage — verifiziert, bitte nicht neu recherchieren

### A. Die zwei Wege der Objektanlage sind DERSELBE Code

Die verbreitete Annahme „`gastgeber/` und `web/` sind zwei Welten" ist falsch.

| | `gastgeber/` | `web/` (PMS) |
|---|---|---|
| Endpunkt | `POST /api/v1/properties` | derselbe |
| Service | `PropertiesService.create` | derselbe |
| Tenant | echter Tenant | echter Tenant |
| Stripe-Verbundkonto | `tenant_billing_profile.stripe_account_id` | dieselbe Spalte |

- Router `apps/api/src/features/properties/router.py:76-90`
- Service `apps/api/src/features/properties/service.py:360-408`
- Einziger Unterschied: `tenants.account_type` (`marketplace` vs. `pms`),
  gesetzt bei der Registrierung (`gastgeber/lib/auth.ts:168`)
- Es gibt **kein** `portal_hosts`, **kein** `host_id`, **kein**
  `properties.owner_id` (Eigentümer ist n:m über `owner_properties`)
- Das PMS-Frontend liegt unter `web/`, nicht `apps/web/`

**Konsequenz:** Es braucht KEINE Fallunterscheidung nach Anlageweg.

### B. Die 8 % hängen am KANAL, nicht am Kontotyp

- `_PORTAL_CHANNELS = frozenset({"portal"})` —
  `apps/api/src/features/payments/service.py:1012`
- `_ist_portal_buchung()` — `service.py:1014-1025`, fail-closed:
  fehlt der Kanal, gilt die Buchung NICHT als Portal-Buchung
- `_platform_fee_bps()` — `service.py:1052-1093`, Satz ausschließlich aus
  `tenants.platform_fee_bps` (Default 800 bps,
  `supabase/migrations/0180_tenant_account_type.sql:29-30`).
  Fehlt der Satz bei einer Portal-Buchung → 500, kein stiller Default.
- `_fee_cents()` — `service.py:1095-1104`,
  Ganzzahl-Arithmetik `amount_cents * bps // 10000`
- `_traegt_haftung()` — `service.py:1027-1039`: nur wo wir verdienen,
  haften wir. Portal → unser Konto; sonst Direct Charge, Betrieb ist
  Merchant of Record.

Derselbe Betrieb verkauft über Marktplatz (8 %), eigene Website (0 %) und
OTAs (0,5 % monatlich über `commission_ledger`). Beabsichtigt, deckt sich
mit ADR-0018.

Der einzige hartcodierte `800` steht in
`apps/api/src/features/subscriptions/schemas.py:50-56` als
`MARKETPLACE_FEE_BPS_STANDARD` — NUR für die Marketing-Preisseite. Ein Test
liest den Spalten-Default per Regex aus der Migration und vergleicht
(`subscriptions/tests/test_public_pricing.py:65`).

### C. Der Auszahlungsapparat ist FERTIG GEBAUT, aber abgeschaltet

Slice `apps/api/src/features/payouts/`:

- **`faelligkeit.py`** — reine Rechenlogik, DB-frei, importfrei.
  Docstring Z. 3-6: *„Die Auszahlung wird durch die ABREISE ausgelöst,
  nicht durch den Zahlungseingang und nicht durch die Anreise. Zum
  Zeitpunkt der Abreise steht der Aufenthalt fest — Schäden, verkürzte
  Aufenthalte und Beschwerden sind bekannt, BEVOR Geld fließt."*
  - Konstanten Z. 16-25: `NACHTRAGEFRIST_TAGE = 1`,
    `WOECHENTLICH_WOCHENTAG = 3` (Donnerstag), `MONATLICH_STICHTAG = 15`
  - `transfer_group()` Z. 28-40 — `f"reservation:{reservation_id}"`,
    EINE Quelle für Charge und Transfer
  - `basis_faelligkeit()` Z. 76-97 — `checked_out_at` hat Vorrang,
    Fallback `check_out + NACHTRAGEFRIST_TAGE`
  - `faellig_ab()` Z. 117-142 — `daily` / `weekly` / `monthly`
  - `berechne_aufteilung()` Z. 145-179 — mit Summen-Invariante
  - `verrechne()` Z. 182-194 — Airbnb-Modell, nie negativ
- Tabellen `supabase/migrations/0217_payouts.sql`: `payouts`,
  `payout_settings`, `payout_adjustments`, `payout_holds`.
  Zustände `scheduled|due|held|paid|withheld|failed`,
  Hold-Gründe `chargeback|dispute|fraud_review|bank_changed|manual`.
- Planung läuft SCHON: `payments/webhook.py:752-830` `_plane_auszahlung`,
  aufgerufen Z. 157 bei `payment_intent.succeeded`. Kautionen ausgenommen
  (Z. 776-778). Beträge werden aus den festgeschriebenen Ledgern gelesen,
  NICHT neu gerechnet (Z. 761-765) — sonst verschöbe ein geänderter Satz
  die Aufteilung.
- Ausführung: `apps/api/src/worker.py:1224-1225`

**Warum es still steht:** `_trennt_charge_und_transfer()` —
`payouts/service.py:508-516` — gibt `get_settings().stripe_separate_transfers`
zurück. Nirgends gesetzt → Default `false` (`apps/api/src/core/config.py:214`).

**Doppelzahlungsschutz ist eingebaut und darf NICHT angefasst werden:**
`payouts.charge_modell` (`supabase/migrations/0220_payouts_charge_modell.sql`)
mit `.eq("charge_modell", "separate")` in `fuehre_lauf_aus()`
(`payouts/service.py:359`). Altzeilen aus der Destination-Charge-Ära werden
nie ein zweites Mal ausgezahlt. Das Schadensszenario steht ausgerechnet in
`payouts/service.py:384-410`:
```
Marktplatz  1000 → 920 (Charge) + 920 (hier)  =  920 Verlust
PMS         1000 → 1000 (Charge) + 1000 (hier) = 1000 Verlust
```

### D. Provisions-Ledger und Rückbuchung

- `platform_fees` — `supabase/migrations/0182_platform_fees.sql:33-71`.
  `fee_bps` ist ein **eingefrorener Snapshot** aus
  `tenants.platform_fee_bps`. `reversed_amount_cents` als Gegenzustand,
  CHECK `reversed_amount_cents <= fee_amount_cents`,
  UNIQUE auf `reservation_id` als Idempotenz-Backstop.
  RLS restrictive + harter `revoke` für anon/authenticated.
- `_reverse_platform_fee()` — `payments/service.py:2236-2300`,
  anteilig `refunded_cents * fee // gross`.
- **Bei Stripe wird sie bewusst NICHT aufgerufen**
  (`payments/service.py:1830-1834`): `refund_application_fee` bleibt
  ungesetzt, weil das Flag die Provision an den GASTGEBER schieben würde
  statt sie uns zu erhalten. Die 8 % bleiben heute IMMER bei uns.
  Nur PayPal bucht real zurück.
- Refund setzt `reverse_transfer=False` (`service.py:1781`) — *„DER GAST
  GEHT VOR"*: mit `True` scheitert der ganze Refund, wenn der Betrieb kein
  Guthaben hat.
- Dreistufige Rückholung `_hole_zurueck_oder_verrechne()`
  (`service.py:~1855-1955`): (1) Separate Charge ohne Transfer → Geld liegt
  bei uns, `payouts.storniere()`; (2) Destination Charge → `verrechne_storno()`;
  (3) `reverse_transfer()` versuchen, sonst Verrechnungsforderung.
  **Nie ein Bankeinzug.**

### E. Storno heute

`ReservationsService.cancel()` — `apps/api/src/features/reservations/writes.py:1068-1313`

Gegenzustände, die bereits gepflegt werden (NICHT neu bauen):
Nächte nur für ZUKÜNFTIGE Tage freigeben über `_release_nights`
(`reservations/_base.py:652-769`, unit-genau, fail-closed);
Channex/`ari_outbox` über `_release_channex`; Aufgaben
(`remove_on_cancellation`); Dynamic-Pricing-Meldung; `commission_ledger`
nur `pending` löschen (`subscriptions/service.py:1249-1257`);
append-only `reservation_cancellation_log`.

Guards: bereits storniert → 409; nach Check-out → 409;
**OTA-Buchungen (`source_channex_booking_id`) lokal gar nicht stornierbar
→ 409** (`writes.py:1140-1153`).

Refund nur wenn Betriebs-Flag `auto_refund_on_cancel` gesetzt ist
(`payments/service.py:2027`), NIE nach `checked_in_at`.

Stornobedingungen existieren: `booking_conditions` mit
`cancellation_mode` (`non_refundable|refundable|partial`) und
`booking_condition_refund_rules` (gestaffelt), Auswertung
`payments/service.py:1994-2012` `_refund_percent_for`.

**Die Lücke:** `reservations.cancelled_by` ist eine nackte User-UUID **ohne
Rollenkategorie**, und ein **Gast-Storno schreibt `NULL`**
(`writes.py:1091-1094`), weil ein Portal-Gast keine `users`-Zeile ist.
Gast-Storno und „Auslöser unbekannt" sind NICHT unterscheidbar. Es gibt
kein `cancelled_by_role` und kein Grund-Enum (repoweit gesucht, null Treffer).
Vorbild für die Typisierung:
`supabase/migrations/0397_addon_storno_grund_protokoll.sql:43-54`.

Vier Aufrufer von `cancel()`:
1. PMS `reservations/router.py:437-457`
2. Gast `guest_bookings/service.py:328-365` (ruft mit `by_user_id=None`)
3. Eigennutzung `owners/eigennutzungen.py:108`
4. Absichts-Rollback `booking_engine/absicht.py:346`

### F. Das Admin-Backoffice

- Slice `apps/api/src/features/platform_admin/`, Prefix `/api/v1/platform`
- Guard `get_current_platform_admin()` — `apps/api/src/core/security.py:337-424`:
  JWT + frischer DB-Lookup gegen `platform_admins` mit `active=true`
  (bewusst kein `app_metadata`-Flag, damit Entzug sofort greift) + MFA/AAL2
- Rollen `platform_admin` (voll) / `platform_support` (nur lesend).
  Schreib-Guard `require_platform_write(ctx)` — `security.py:433ff.`
- **Vorbild für neue Queues:** Objekt-Moderation.
  Backend `platform_admin/router.py:306-397`,
  Frontend `admin/app/(backoffice)/freigaben/page.tsx`,
  `admin/components/freigabe-karte.tsx`,
  `admin/lib/moderation-actions.ts`
- Finanzen heute nur lesend: `GET /platform/finanzen` (`router.py:404`,
  Service `service.py:496-545`) liest `platform_fees`, aggregiert je Währung
  OHNE Umrechnung. Frontend `admin/app/(backoffice)/finanzen/page.tsx`.
- **Kein Buchungs-Storno, keine Auszahlungsaktion im Admin.**
  Buchungen nur lesbar (`router.py:800/837`).

### G. Wie die Portale es machen (recherchiert, belegt)

**Booking.com** — Provision wird NACH ABREISE fakturiert: Rechnung in der
ersten Woche des Folgemonats für alle Reservierungen mit Check-out im
Vormonat. Bei Storno: *„You PAY commission on any fees you collect from a
cancellation or no-show."* KEINE Provision, wenn der Gastgeber die Gebühr
erlässt oder korrekt über „Request to cancel a reservation" storniert.

**Airbnb** — Gast storniert → Airbnb behält die Servicegebühr.
GASTGEBER storniert → Gast bekommt alles zurück inkl. Gebühr, UND der
Gastgeber zahlt Strafe: 10 % (>30 Tage), 25 % (48 h–30 Tage), 50 % (<48 h),
mindestens 50 USD, *„typically withheld from the next payout(s) to the
host"* — Verrechnung, kein Einzug. Entspricht `faelligkeit.verrechne()`.
Quelle: airbnb.com/help/article/990.

**Gemeinsames Prinzip:** Wer den Vertrag bricht, trägt die Kosten.

---

## Der Plan — vier Etappen

### Etappe 1 — Geld bleibt bis nach der Abreise bei uns

**Das ist der Kern des Auftrags und der riskanteste Schritt: er verschiebt
echtes Geld.**

**1a. Karenzzeit einbauen** (`payouts/faelligkeit.py`)

Der Betrieb bekommt sein Geld nicht sofort nach der Abreise, sondern nach
einer Karenz — Puffer für Chargebacks und Gastbeschwerden, bevor das Geld
raus ist.

- Neue Konstante neben `NACHTRAGEFRIST_TAGE` (Z. 16-19), z. B.
  `KARENZ_TAGE`. Der Wert gehört in `payout_settings` je Betrieb, mit der
  Konstante als Default — nicht hart im Code, damit Sonderkonditionen
  möglich bleiben.
- Die Karenz greift in `basis_faelligkeit()` (Z. 76-97), NICHT in
  `faellig_ab()` — sonst wirkt sie je Rhythmus unterschiedlich.
  Wichtig: Sie muss AUCH auf den `checked_out_at`-Pfad wirken, nicht nur
  auf den Fallback, sonst zahlt ein eingetragener Checkout ohne Karenz aus.
- Migration: `payout_settings` um die Karenz-Spalte erweitern, mit CHECK
  auf einen sinnvollen Bereich (z. B. 0–30 Tage).
- Tests in `payouts/tests/`: Karenz auf beiden Pfaden
  (`checked_out_at` gesetzt und nicht gesetzt), Zusammenspiel mit allen drei
  Rhythmen, Grenzwert 0.

**1b. Vorbedingung prüfen, BEVOR das Flag fällt**

Laut ADR-0018 (`docs/decisions/0018-zahlungsfluss-separate-charges.md`
Z. 79-81) darf danach **kein** Zahlungspfad mehr `transfer_data` setzen —
sonst laufen Destination und Separate Charge gleichzeitig. Alle Aufrufer
von `create_payment_intent` durchgehen:
`payments/service.py:1204, 1305, 1409, 1565, 1651`.

**1c. Flag umlegen**

`STRIPE_SEPARATE_TRANSFERS=true` als Coolify-Variable, **nicht im Repo**.
`payouts.charge_modell` dabei NICHT anfassen — es ist der
Doppelzahlungsschutz für Altzeilen.

**1d. Gegenprüfen (Pflicht, kein „200 reicht")**

Eine echte Marktplatz-Buchung durchlaufen lassen und belegen:
- Der PaymentIntent trägt **kein** `transfer_data`, aber die
  `transfer_group` `reservation:<id>`
- Der volle Betrag liegt auf dem Plattform-Saldo
- `payouts` hat eine Zeile `scheduled` mit `charge_modell='separate'`
- Die Fälligkeit liegt nach `check_out + Karenz`
- Nach Fälligkeit: Transfer über den Nettoanteil, 8 % bleiben

**Warnung, die stehen bleiben muss:** Die lokale `.env` hält einen
`rk_live_`-Schlüssel — der lokale Server spricht mit dem ECHTEN
Stripe-Konto. Dieser Weg ist lokal nicht testbar, ohne Produktion zu
berühren. **AirSmil ist ein Kundenkonto und tabu.** Demo-Betrieb wäre
erlaubt, hat aber kein Stripe-Konto (`stripe_charges_enabled` leer).
Also: entweder ein Stripe-Testschlüssel für die lokale Entwicklung, oder
ausdrückliche Freigabe für einen kontrollierten Durchlauf.
**Vorher NICHT umlegen.**

---

### Etappe 2 — Storno-Partei erfassen

Voraussetzung für Etappe 3: Ohne sie wüsste die Freigabemaske nicht, wer
storniert hat.

**Migration** (nächste freie Nummer nach 0409):
- `reservations.cancelled_by_party` als Enum:
  `gast | eigentuemer | agentur | betrieb | portal | system`
- `reservations.cancel_reason_code` als Enum (kategorisiert; der Freitext
  `cancel_reason` bleibt daneben bestehen)
- Dieselben zwei Spalten in `reservation_cancellation_log`
- Bestandszeilen bekommen **keinen erfundenen Wert** — sie bleiben `null`,
  und die UI benennt das als „nicht erfasst" (Wurzel 4)

**Code:** `cancel()` bekommt einen Pflichtparameter. Alle **vier** Aufrufer
setzen ihn explizit:
- `reservations/router.py:437` → aus der Rolle des `ctx` ableiten
  (`admin`/`co_admin` → `betrieb`, Co-Gastgeber → `agentur`)
- `guest_bookings/service.py:363` → `gast` (löst das `NULL`-Problem)
- `owners/eigennutzungen.py:108` → `eigentuemer`
- `booking_engine/absicht.py:346` → `system`

Kein Default im Service: fehlt die Partei, ist das ein Programmierfehler →
klar fehlschlagen, nie „unbekannt" einsetzen (Wurzel 4/5).

**Tests:** je Aufrufer einer, besonders der Gast-Pfad.

---

### Etappe 3 — Storno-Freigabe und Provisionsentscheid im Admin

**Backend** (`platform_admin/`), Muster wie Objekt-Moderation:
- `GET /platform/stornos` — Queue offener Entscheide mit Buchung, Betrieb,
  Partei (aus Etappe 2), Bruttobetrag, Provisionsanteil aus
  `platform_fees`, bereits erstattetem Betrag, Regelwerk-Vorschlag
- `POST /platform/stornos/{reservation_id}/entscheiden` mit
  `provision_behalten: bool` + Pflicht-Begründung (422 wenn leer)
- Jeder schreibende Endpunkt: `require_platform_write(ctx)` +
  `service.log_action(...)` — beides Pflicht im Slice
  (`platform_admin/router.py:1-9`)
- Wirkung über `_reverse_platform_fee()` (`payments/service.py:2236`).
  Bei „Provision zurück" muss zusätzlich der echte Geldfluss stimmen —
  heute setzt der Stripe-Refund `refund_application_fee` bewusst NICHT
  (`service.py:1773-1776`). **Das ist der eigentliche Eingriff:** Ledger
  und Geldfluss dürfen nicht auseinanderlaufen (Wurzel 1).
- Neue Audit-Tabelle (append-only) mit RLS + `revoke all ... from anon,
  authenticated` + restriktiver Policy — Finanzdaten (Wurzel 6)

**Frontend** (`admin/`): Seite `app/(backoffice)/stornos/page.tsx`,
Karte und Server Actions nach den genannten Vorbildern, Navigation in
`admin/components/backoffice-nav.tsx` mit `nurAdmin: true` (wie
`/freigaben`) — `platform_support` darf das nicht entscheiden.

---

### Etappe 4 — Regelwerk als Vorschlag, nicht als Automatik

| Partei storniert | Vorschlag | Vorbild |
|---|---|---|
| `gast` | Provision bleibt bei uns | Booking.com, Airbnb |
| `betrieb` / `eigentuemer` | Provision zurück | Airbnb Host-Cancellation |
| `agentur` | Provision zurück | wie Betrieb |
| `portal` / `system` | Provision zurück | kein Verschulden |

- Satz aus `platform_fees.fee_bps` (eingefrorener Snapshot), NICHT neu aus
  `tenants.platform_fee_bps` — sonst verschiebt ein geänderter Satz alte Fälle
- Rein anzeigend, kein Auto-Vollzug ohne Admin-Klick

---

## Qualitätsgate (aus CLAUDE.md, gilt unverändert)

- `uv run pytest src/features/<slice> -q` für den BERÜHRTEN Slice.
  Voller Lauf EINMAL vor dem Commit, nie im Hintergrund.
- `ruff check` sauber, `pylint` 10.00/10 NUR auf geänderten Dateien.
- Frontend: `tsc --noEmit` + `bun run lint` in jeder berührten App.
  **NIE `next build` lokal.**
- Migration via `supabase/apply-migrations.sh`, nie automatisch.
- Neue Tabelle → RLS + `revoke` + restriktive Policy, gedanklich per
  anon-Key-`curl` gegengeprüft (lesen UND schreiben).
- Neuer `{id}`-Endpunkt → derselbe Scope wie der List-Pfad (Wurzel 9).
- Nichts committen/pushen/deployen ohne ausdrückliche Ansage.

## Die Wurzeln, die hier besonders greifen

- **Wurzel 1 (Gegenzustand):** Jede Provisionsentscheidung hat eine
  Gegenbuchung. Ledger und echter Geldfluss müssen zusammenpassen.
- **Wurzel 2 (Idempotenz):** Stripe stellt Webhooks mehrfach zu. Der
  Auszahlungslauf darf eine Buchung nie zweimal transferieren —
  `charge_modell` und die Status-Guards sind der Schutz.
- **Wurzel 4 (keine Fallbacks):** Keine erfundene Storno-Partei für
  Bestandszeilen, kein EUR-Default, Währung aus der Buchung.
- **Wurzel 5 (fail-closed):** Fehlende Partei → Fehler. Abzüge über
  Brutto → Fehler statt negativem Betrag.
- **Wurzel 6 (RLS-Direktpfad):** Neue Finanztabelle → `revoke` +
  restriktive Policy, nicht nur `enable rls`.

## Was ausdrücklich NICHT gebaut wird

- Keine Fallunterscheidung nach Anlageweg — es ist derselbe Code
- Kein neues Provisionsmodell; die 8 % bleiben kanalgebunden
- Keine Änderung an `payouts.charge_modell` — Doppelzahlungsschutz
- Kein lokaler Auszahlungs-Testlauf gegen das Live-Stripe-Konto
- Kein Auto-Vollzug des Regelwerks ohne Admin-Entscheid
- Kein Bankeinzug beim Betrieb — Rückforderungen werden verrechnet

---

## Einstieg

Mit **Etappe 1a** beginnen (Karenzzeit in `faelligkeit.py` +
`payout_settings`). Sie ist reine Rechenlogik, verschiebt kein Geld und ist
vollständig testbar. Erst danach 1b/1c — und die nur nach ausdrücklicher
Freigabe und geklärter Testumgebung.
