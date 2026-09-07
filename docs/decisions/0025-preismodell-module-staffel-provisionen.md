# ADR-0025: Preismodell — Grundtarif-Staffel, buchbare Module, drei Provisionswege

- Status: **akzeptiert**
- Datum: 2026-09-07
- Ersetzt: [ADR-0006](0006-preismodell-all-inclusive.md) (All-Inclusive, kein
  Feature-Gating, 0 % Buchungsgebühr)

## Kontext

ADR-0006 (15.06.2026) legte fest: kein Feature-Gating, 0 % Provision auf
Vermieter-Buchungen, Skalierung nur über die Objektzahl. Das gelebte Modell hat
sich seitdem in Migrationen, Code und Preisliste anders entwickelt, ohne dass
die Entscheidung nachgezogen wurde — der Gap-Abgleich vom 07.09.2026
(`docs/REQUIREMENTS-GAP.md` §7.1) fand fünf Modul-Gates über
`subscriptions/entitlements.modul_aktiv()`, drei Provisionssätze und
Modul-Festpreise, alle begründet, aber nur in Kommentaren.

Dieses ADR beschreibt den IST-Zustand als Entscheidung. Es ändert keinen Satz.

## Entscheidung

1. **Grundtarif skaliert über Objekte** (graduated, `deploy/billing/
   seed_stripe_prices.py`): bis 1 Objekt Festpreis, danach je Objekt
   gestaffelt (bis 50 / bis 100 / darüber). Zähler `tenant_subscription.
   reported_property_count` (Migration 0117). 14 Tage Testphase.
2. **Buchbare Module mit Feature-Gate** (`tenant_module_entitlement`, 0117;
   `MODULE_KEYS` in `subscriptions/schemas.py`): Buchhaltung (Modul 3),
   Mitarbeiter (Modul 4, flat oder je Nutzer), Jobmarkt (Modul 5, 2 % vom
   Umsatz, nachgelagert), Hotel (Modul 6, flat oder je Zimmer), Avatar
   (Modul 7), Dynamische Preise (0,5 % vom Umsatz der betroffenen Buchungen),
   Schlösser je Hersteller (fester Preis je Gerät und Monat, je Währung
   festgelegt, 0574). Verkaufsfläche `/erweiterungen`. Kern-PMS, Kalender,
   Kanalmanager, Posteingang, Aufgaben, Eigentümer- und Gästeportal bleiben im
   Grundtarif — ein Gate darf NUR an einem Modul aus `MODULE_KEYS` hängen.
   `modul_aktiv()` ist fail-closed.
3. **Drei Provisionswege, maßgeblich ist der KANAL** (`payments/service.py`):
   - eigene Website / Buchungs-Widget: **0 %** (unverändert aus ADR-0006);
   - OTA-Buchungen über den Kanalmanager: **0,5 %** einheitlich
     (`COMMISSION_RATE_STANDARD`, Migration 0310), monatlich fakturiert über
     `commission_ledger`;
   - myBestDays-Marktplatz: **8 %** all-in (`tenants.platform_fee_bps`,
     Default 800, Migration 0180; ADR-0021 Pflichtlistung).
   Der Satz kommt immer aus den Tenant-Daten, nie aus Client-Input (Wurzel 3/4).
4. **Preisliste ist Code**: `subscriptions/preisliste.py` und die Marketing-
   Preisseite lesen dieselben Konstanten; `tests/test_public_pricing.py`
   prüft den Marktplatz-Satz gegen den Spalten-Default.

## Konsequenzen

- Lastenheft §7.1 („kein Feature-Gating", „0 % Buchungsgebühr") gilt in dieser
  Form nicht mehr; das Lastenheft ist bei der nächsten Revision anzupassen.
- Neue Gates brauchen einen Eintrag in `MODULE_KEYS` UND einen Stripe-Preis
  (`MODULE_PRICE_LOOKUP`); ein Gate ohne buchbares Modul ist ein Fehler.
- Neue Provisionssätze nur als Konstante in `subscriptions/schemas.py` plus
  Migration des Spalten-Defaults, nie inline.
