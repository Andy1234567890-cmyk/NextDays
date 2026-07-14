# Slice: travel_agencies

Reisebüro-/Partner-Kartei (B2B): Reisebüros, Reiseveranstalter, Firmen und
Vermittler als Profile (OPERA-„Sales Account/Travel Agent"-Muster) mit
Kontaktpersonen, **Verträgen nach Jahren** (Allotment/Garantie/Free Sale,
Gültigkeit von–bis, Kommission, Release-Frist, Dokument im privaten Bucket
`agency-contracts`) und **Saison-Preiszeilen** (Rate-Sheet: Zeitraum × Objekt ×
Preis/Nacht, Netto/Brutto, Min-Stay) je Vertrag.

- Router: `/api/v1/travel-agencies` — alle Endpunkte hinter der
  Berechtigung `MANAGE_PARTNERS`.
- Tabellen (Migration 0088, RLS + Realtime): `travel_agencies`,
  `travel_agency_contacts`, `travel_agency_contracts`, `travel_agency_rates`;
  zusätzlich `stop_sell.agency_id` (Adressat der Stop-Sale-Meldung, 0088/0089).
- Vertragsdateien: Upload multipart (`core/uploads.read_upload`), Download
  ausschließlich über zeitlich begrenzte signierte URLs (Bucket ist privat).
- Jede Query trägt den expliziten Tenant-Scope (Service-Role umgeht RLS).

Frontend: `/reisebueros` (Liste + Kartei mit Jahres-Accordion),
`apps/web/lib/travel-agencies.ts`; Partner-Auswahl im Verkaufsstopp-Panel
(`/stop-sell`).
