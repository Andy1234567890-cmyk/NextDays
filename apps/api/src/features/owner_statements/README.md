# Slice: owner_statements

Owner-Statements (Auszahlungsabrechnung, wie Hostaway „Owner Statements") +
Expenses & Extras. Je Eigentümer + Zeitraum eine Abrechnung mit Snapshot der
PM- und Owner-Stammdaten, Summen, Steuer und Status (draft/finalized/cancelled).

Enthält: router.py, service.py, schemas.py, dependencies.py, tax.py, fx.py,
currencies.py, tests/.

## Auszahlungsformel (serverseitig, Decimal, kaufmännisch gerundet)

Pro Reservierung, in der QUELLWÄHRUNG der Buchung (`reservations.currency`):

```
Auszahlung            = total_amount − channel_fee
Provision je Objekt   = owner_properties.commission_override_pct, sonst owners.default_commission_pct
                        (manueller Editor-Override gewinnt, wenn gesetzt)
Owner-Auszahlung      = Auszahlung × (1 − Provision/100)        ← „Buchungssatz"
Verwaltungs-Auszahlung= Auszahlung − Owner-Auszahlung           (bleibt Quellwährung)
```

Owner-Expenses (mit `owner_id == Owner`) mindern die Bemessungsgrundlage VOR
Provision (mit dem effektiven Satz gekürzt).

### Provision je Objekt (Migration 0068)

`owner_statements.commission_pct` ist NULL = Provision je Objekt aus den
Stammdaten; ein gesetzter Wert ist ein manueller, abrechnungsweiter Override.
Bei gemischten Objektsätzen wird je Reservierung mit dem Satz IHRES Objekts
gerechnet; angezeigt wird der effektive (gewichtete) Satz.

## Währungsumrechnung (Migration 0069/0070, fx.py + currencies.py)

Der Eigentümer gibt sein Herkunftsland an → daraus die **Owner-Zielwährung**
(`currencies.COUNTRY_CURRENCY`, Eurozone → EUR, sonst Landeswährung). Nur die
**Owner-Auszahlung** (Buchungssatz) wird in die Owner-Währung umgerechnet — mit
dem **ECB-Tageskurs am Check-out** der jeweiligen Reservierung.

- Kursquelle: Frankfurter-API (ECB, kostenlos, kein Key) — `fx.FxService`.
- Cache: Tabelle `fx_rates` (rate_date, base, quote, rate, source='ECB'). Ein
  Tageskurs ist stabil/reproduzierbar (GoBD). Cache-Miss → einmal holen + speichern.
- **Kein Fallback:** Lässt sich ein Kurs nicht beschaffen → `FxError` → 502, die
  Abrechnung schlägt klar fehl statt mit erfundenem Kurs zu rechnen.
- Verwendeter Kurs + Stichtag stehen je Rental-Zeile (`fx_rate`, `fx_date`) und
  erscheinen auf dem Beleg.
- Beträge verschiedener Währungen werden NICHT addiert: `owner_payout` ist die
  Summe in Owner-Währung; `pm_payout_by_currency`/`totals_by_currency` halten
  Verwaltungsanteil + Roh-Summen je Quellwährung getrennt.

## Steuer (tax.py, Migration 0065)

`compute_tax` bestimmt Kategorie/Satz je EU-Recht: Kleinunternehmer → 'E';
Reverse-Charge (buyer_vat_id + beide EU + seller≠buyer) → 'AE'; sonst 'S' mit
Satz. Nummern fortlaufend über `next_document_number` (Buchhaltungs-Bestand).

## Storno

Eine finalisierte Rechnung wird nicht gelöscht: `POST /{id}/cancel` erzeugt eine
Stornorechnung (eigene Nummer, negierte Beträge, Referenz aufs Original); das
Original bleibt als `cancelled`. Kein automatischer Folgebeleg.

## Realtime (Migration 0071)

Die Eigentümer-Seite aktualisiert sich vollständig per **Supabase-Realtime
(WebSocket, kein Polling)**: `owners`, `owner_properties`, `owner_expenses`,
`owner_statements` (+ vorhandene `reservations`, `properties`) sind in der
Publication `supabase_realtime`. Frontend: `components/eigentuemer/owner-realtime.tsx`
über `lib/use-realtime.ts`; bei jeder Änderung `router.refresh()` + Vorschau/
Statement neu laden.

## Endpunkte (`/api/v1/owner-statements`, `OWNER_REPORTING`, tenant-gescoped)

- `GET /` (`?owner_id=`) — Liste · `POST /` — erzeugen (Owner+Zeitraum+Filter).
- `POST /preview` — Live-Auswertung OHNE DB-Insert (Owner-Seite, id='').
- `GET /{id}` · `PATCH /{id}` (Kopf, Provision, Filter, Zeitraum) · `DELETE /{id}` (nur draft).
- `POST /{id}/finalize` — Summen einfrieren (danach unveränderlich, 409 bei Update).
- `POST /{id}/cancel` — Stornorechnung erzeugen.
- `POST /expenses` · `PATCH /expenses/{id}` · `DELETE /expenses/{id}` — Expenses CRUD.
- `POST /auto-run?period_from&period_to` — interner Cron (Secret-Header), 1/Monat je
  Owner mit `statement_frequency='monthly'`, künftige-only, Expenses auto-zugeordnet.

## Daten

- `owner_statements` (0064 + 0065 + 0068 + 0070): tenant/owner, Zeitraum, basis,
  reservation_statuses, status, kind (invoice/cancellation), cancels_*-Referenzen,
  Snapshot PM+Owner, invoice_number/invoice_date/due_date, commission_pct (nullable),
  Steuer (supply_country/buyer_vat_id/tax_category/tax_rate/net/tax/gross/exemption),
  Summen-Snapshot, owner_currency. RLS via tenant.
- `owner_expenses` (0064): concept/date/category, Zuweisung listing_id/reservation_id/
  owner_id (optional), amount (±), attachment_url, hidden_from_owner. RLS via tenant.
- `fx_rates` (0069): gecachte ECB-Tageskurse (rate_date, base, quote, rate, source).

## PDF/Vorschau

Echtes A4-PDF über den Playwright-Render-Dienst (`/api/v1/generate-pdf-single`,
Next-Node-Route): `lib/statement-pdf.ts` baut das Beleg-HTML (Logo, Parteien,
Aktivität, Steuer, Mehrwährung mit Kurszeile), `components/owner-statements/
statement-preview-modal.tsx` zeigt es als Vorschau vor Download.
