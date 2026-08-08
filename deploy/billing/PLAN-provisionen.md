# Plan: Buchungs-Provisionen (Portal 8 % + Extern 0,5 %)

> **Status: PLANUNG.** Erstellt 2026-07-07. Ergänzt `PLAN-stripe-preisliste.md`.
> Betrifft NUR die zwei realen Provisionen aus der Preisliste (Abschnitt 2).
> **Jobmarkt-Provision (Modul 5, 2 %) ist NICHT Teil dieses Plans** — das Modul
> ist noch nicht gebaut, es gibt keinen Umsatz. Kommt mit dem Modul selbst.
>
> **Satz-Stand 07.08.2026:** die externe Provision ist einheitlich **0,5 %**
> (`subscriptions.COMMISSION_RATE_STANDARD = 0.005`, vereinheitlicht durch
> `supabase/migrations/0310_provision_einheitlich_0_5_prozent.sql`). Die in
> diesem Plan ursprünglich vorgesehene Staffel nach Objektzahl (1 % bis 100,
> 0,5 % ab 101) ist abgeschafft. Ledger-Zeilen aus der Zeit davor tragen
> weiterhin `rate = 0.01`: der Satz ist ein Snapshot je Zeile und wird NICHT
> nachträglich umgerechnet, sonst verfälscht das gestellte Rechnungen (siehe
> Kopfkommentar von 0310).

## Die zwei Provisionen (Preisliste Abschnitt 2)

| Provision | Satz | Geldfluss | Grundlage im Code |
|---|---|---|---|
| **Eigenes Portal** (Direktbuchung) | **8 % all-in** (inkl. 2,5 % Zahlung) | **Sofort einbehalten** beim Gast-Charge (Stripe `application_fee`) | `payments.create_booking_payment` läuft NUR für eigene Kanäle (`_require_own_channel`) |
| **Externe Kanäle** (Airbnb/Booking/Vrbo) | **0,5 %** (einheitlich, keine Staffel) | **Nachgelagert** — Geld floss NICHT über uns → monatlich in Rechnung stellen | OTA-Buchungen kommen über `channel_manager` mit `total_amount` + `source_channex_booking_id` rein |

Kernunterschied: Portal = **einbehalten** (trivial), Extern = **nachfordern**
(braucht Ledger + Monatsabrechnung).

## Teil A — Portal 8 % (klein, sofort)

`payments._fee_cents` liest schon `stripe_platform_fee_pct` und setzt es als
`application_fee_amount`. Der OTA-Pfad ist bereits ausgeschlossen
(`_require_own_channel`) → **jeder Charge hier IST eine Portal-Buchung**, es gibt
kein Risiko, OTA-Buchungen zu belasten.

**Zu tun:**
1. `STRIPE_PLATFORM_FEE_PCT = 8` in der Env setzen (Coolify/Server).
2. Test: eine Portal-Buchung erzeugt `application_fee_amount = 8 %` (gegen echte
   Stripe-Test-API verifizieren, nicht nur Config lesen).
3. Prüfen, ob der Wert wirklich nur Portal trifft (OTA-Reservierung → 409, kein Charge).

**Offene Frage (global vs. pro Tenant):** `stripe_platform_fee_pct` ist EINE
globale Config. Für Sonderkonditionen pro Kunde bräuchte es
`tenant_billing_profile.portal_commission_pct` (Default 8). Vorschlag: erst global
8 %, pro-Tenant nur wenn wirklich gebraucht (YAGNI).

## Teil B — Externe 0,5 % (Ledger + Monatsabrechnung)

Da wir den Gast bei OTA-Buchungen NICHT kassieren, müssen wir die 0,5 % dem Tenant
monatlich berechnen. Sauber über ein **Provisions-Ledger** + Stripe-Invoice-Item.

### Datenmodell (neue Migration)
`commission_ledger` (die bestehende `commissions`-Tabelle aus 0006 ist ungenutzt,
aber zu dünn — kein Typ/Kanal/Periode; NICHT überladen, eigene Tabelle):
- `tenant_id`, `reservation_id` (FK), `channel` (booking/airbnb/vrbo),
- `gross_amount` (Buchungsumsatz), `rate` (Satz-Snapshot: 0,005 neu — Altbestand
  kann 0,01 tragen), `commission_amount`,
- `status` (pending/invoiced/paid), `period` (YYYY-MM),
- `stripe_invoice_item_id`, UNIQUE(reservation_id) → **Idempotenz-Backstop
  (Wurzel 2)**: eine Buchung erzeugt genau EINE Provisionszeile, auch bei
  Webhook-Redelivery/Re-Import.
- RLS (nur eigener Tenant liest) + Realtime.

### Erfassung (Wurzel 1: Gegenzustand)
Wenn eine OTA-Buchung importiert wird (`bookings_sync`), eine Ledger-Zeile
anlegen (pending). Satz einheitlich 0,5 %, unabhängig von der Objektzahl — er
wird beim Anlegen als Snapshot in `rate` festgeschrieben und danach nicht mehr
angefasst (Altbestand mit 0,01 bleibt stehen). Storno/Änderung der Buchung →
Ledger-Zeile mitpflegen (nicht verwaisen lassen).

### Abrechnung (monatlicher Worker)
Ein Worker-Task summiert am Monatsanfang die `pending`-Provisionen des Vormonats
pro Tenant und bucht sie als **ein** Stripe-Invoice-Item auf das laufende Abo
(`invoiceItems.create` mit `customer` + `subscription`), setzt die Zeilen auf
`invoiced`. Idempotent über `period` + `stripe_invoice_item_id` (kein doppeltes
Berechnen bei Re-Run). Kein Abo → nicht abrechenbar, klar melden (nicht still
verschlucken, Wurzel 5).

### Satz nicht hardcoden (Wurzel 4)
Die 0,5 % stehen als EINE benannte Konstante
(`subscriptions.COMMISSION_RATE_STANDARD`), nicht magisch im Code verstreut.
Keine Objektzahl-Grenze mehr, die irgendwo zweitgepflegt werden müsste.

## Reihenfolge / Entscheidung

- **Teil A (Portal 8 %)** ist in ~30 Min sicher erledigt und sofort nutzbar.
- **Teil B (Extern 0,5 %)** ist ein eigener Bau (~Ledger-Migration + bookings_sync-
  Hook + Monats-Worker + Tests), aber ohne echtes Geldrisiko (Test-Modus).

**Aktueller Stand:** Nutzer will erst klären, nichts scharf schalten. Portal-Fee
bleibt bis zur Freigabe 0. Jobmarkt bewusst ausgeklammert (Modul fehlt).
