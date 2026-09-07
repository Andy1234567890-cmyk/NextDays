# Slice: crm — Eigentümer-Akquise & Partner/Deals (Lastenheft §2.6)

Vertical Slice. Enthält: `router.py`, `service.py` (CrmService = `LeadsMixin` +
`PartnersMixin`), `leads.py`, `partners.py`, `dateien.py` (Magic Bytes, SVG,
QR), `common.py` (Fehler, Wertelisten, Zustandsgraph), `schemas.py`, `tests/`.

Regeln: explizite Pydantic-Typisierung, kein direkter DB-Zugriff aus Routern,
kein Exception-Swallowing. Siehe PROJECT.md / docs/LASTENHEFT.md.

Status: **implementiert** (Etappe 7, Migrationen 0596–0598).

- Guard: Capability `MANAGE_CRM` (admin, co_admin). staff/cleaner/owner → 403;
  auf DB-Ebene sehen sie NICHTS (restriktive Rollen-Policies, 0596/0597).
- Leads: Status-Workflow `new → contacted → visit_scheduled → offer_sent →
  contract_sent → won | lost` (`common.LEAD_TRANSITIONS`), `lost` verlangt
  `lost_reason`, `won` gibt es nur über `POST /crm/leads/{id}/convert`.
- Notizen: `lead_notes`, append-only (kein Update/Delete-Pfad).
- Konvertierung: wiederverwendet `OwnersService.create`/`assign_property` und
  `PropertiesService.create`; idempotent über `converted_owner_id` /
  `converted_property_id` (bedingtes Update = Claim, Verlierer räumt ab).
  Fehlende Pflichtangaben → 422 mit `fehlende_felder`.
- Deals: `discount_kind` percent|fixed, `currency` Pflicht bei fixed (nie aus
  dem Tenant geraten), `discount_code` eindeutig je Tenant (23505 → 409),
  QR-Upload in den privaten Bucket `partner-deals` (Magic Bytes, SVG per nh3
  gesäubert), Ausgabe nur als signierte URL; `GET …/qr.png` erzeugt einen QR
  aus dem Code.
