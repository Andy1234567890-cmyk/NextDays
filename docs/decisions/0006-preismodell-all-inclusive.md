# ADR-0006: Preismodell — All-Inclusive, 0% Buchungsgebühr, unit-basiert

- Status: **ersetzt durch [ADR-0025](0025-preismodell-module-staffel-provisionen.md)** (07.09.2026)
- Datum: 2026-06-15

## Kontext

Lastenheft-Ergänzung (§7.1): NextDays positioniert sich als „vOffice-/..-
Killer" über ein radikal einfaches, faires Preismodell:

- kein Feature-Versteckspiel (voller Funktionsumfang für alle),
- 0% Buchungsgebühr im eigenen System (vs. vOffice 4 %),
- Skalierung nur über die Anzahl verwalteter Unterkünfte.

## Entscheidung

1. **Kein Feature-Gating:** Es werden **keine** Feature-Flags eingebaut, die
   Funktionen hinter Preisstufen sperren. Alle Tenants haben denselben
   Funktionsumfang.
2. **0% Buchungsgebühr:** NextDays erhebt **keine** prozentuale Provision auf
   PMS-/Direktbuchungen der Vermieter. Die `commissions`-Tabelle gilt
   ausschließlich für **Portal-Buchungen** (eigener Marktplatz, Phase 2) — nicht für
   den PMS-/Vermieter-Betrieb.
3. **Unit-basiertes Abo:** Die Abrechnung skaliert über die Anzahl aktiver
   Unterkünfte pro Tenant. Modell: `plans` (Staffel, z. B. 1–5 / 6–10 / 10+) +
   `subscriptions` (Tenant ↔ Plan, aktive Einheiten, Abrechnungszeitraum).

## Konsequenz

- Datenmodell: `plans`, `subscriptions`; Zähllogik „aktive Unterkünfte pro Tenant".
- **Keine** Funktions-Sperren im Code — Konvention für alle Slices: niemals
  Features per Plan deaktivieren.
- Klare Trennung: Plattform-**Abo-Gebühr** (an NextDays) vs. **0% Buchungsgebühr**
  (auf Vermieter-Umsätze) vs. **Portal-Provision** (nur Phase-2-Marktplatz).
- Abo-Zahlungen laufen über dasselbe Gateway-Adapter-Pattern (ADR-0003).
