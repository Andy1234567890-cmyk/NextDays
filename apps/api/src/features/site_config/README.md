# Slice: site_config

Page-Builder-Backend: pro Mandant **Branding** (`tenant_site_config`:
Name, Logo, Farben, Schrift, Texte, Buchungsmodus), **Custom-Domains**
(`tenant_custom_domains`, TLS über Cloudflare for SaaS Custom Hostnames,
`cloudflare_client.py`), **Seiten und Blöcke** (`site_pages`/`site_blocks`,
Migrationen 0086/0087) sowie **Start-Templates** (`templates.py`: bergchalet,
kueste, stadt).

- `manage_router`: `/api/v1/site-config` — JWT + Capability
  `MANAGE_SITE_CONFIG`; CRUD für Branding, Domains (anlegen/syncen/löschen),
  Seiten (inkl. `publish`/`unpublish`/`home`), Blöcke (inkl. `reorder`),
  `templates/apply`, `pages/{id}/draft-token`.
- `public_router`: `/api/v1/site` — JWT-los (service-role + explizites
  Tenant-Scope): `by-domain` (Host→Tenant-Resolver für `builder/`), `page`
  (nur veröffentlichte Blöcke), `page/draft` (HMAC-Token, signiert mit
  `site_draft_secret`, TTL 1 h).
- Block-`content` wird pro Typ (12 Block-Typen) strikt gegen Pydantic-Schemas
  validiert; generische `settings` (Hintergrund, Padding, …) separat.
- **SEO/AEO (0430)**: site-weite Meta-Angaben als Rückfall, `noindex`,
  Google-Tag (`gtag_id`, Format per CHECK erzwungen), vier Schalter für
  JSON-LD (Organization/Lodging/Breadcrumbs/FAQ) und zwei für Core Web Vitals.
  Je Seite zusätzlich `seo_keywords`, `canonical_url`, `head_html`, `noindex`.
  Die Hierarchie „Seite schlägt Website" löst `_seo_meta` im Resolver auf —
  EINE Stelle, nicht drei. `noindex` ist dabei eine ODER-Verknüpfung, kein
  Vorrang: der site-weite Schalter darf nicht durch eine einzelne Seite
  aufgehoben werden.
  `seo.py` liefert die Datengrundlage für `sitemap.xml`, `robots.txt` und
  `llms.txt` (die Dateien selbst baut der Renderer); `organization` kommt aus
  dem FIRMENPROFIL (`konto_daten.firmen_schema_daten`), nicht aus einem zweiten
  Formular.
- **URL-Weiterleitungen (0430)**: `site_redirects` + `weiterleitungen.py`
  (Liste/Anlegen/Ändern/Löschen/CSV-Import, 301 oder 302, Deckel 1000 je
  Betrieb, Import max. 200 Zeilen). Anlegen ist idempotent gegen Doppelklick
  (UNIQUE auf `(tenant_id, lower(source_path))`, Konflikt wird ausgewertet).
  Eine Weiterleitung greift NUR, wenn unter dem Quellpfad keine Seite
  existiert. Öffentlich: `GET /site/redirect?host=&path=` (200 mit
  `target: null`, wenn keine da ist — „keine Weiterleitung" ist der Normalfall
  und kein Fehler) und `GET /site/sitemap?host=`.
- RLS auf allen Tabellen (`current_tenant_id()`), Realtime-Publication
  aktiv; das Dashboard abonniert `site_pages`, `tenant_site_config`,
  `site_redirects`. `site_redirects` trägt zusätzlich DREI restriktive Policies
  (je Schreibrichtung) statt einer `for all` — eine for-all-Policy mit
  `using (false)` hätte den Lesepfad mitgesperrt und das Abo zur Attrappe
  gemacht (Wurzel 6).
- **Mediathek (0422/0460/0461/0479)**: `site_media` + `site_media_folders`,
  Mixins `mediathek.py`/`mediathek_ordner.py`, Routen in `router_mediathek.py`.
  Seit 0479 trägt sie FÜNF Medienarten in EINER Tabelle
  (`kind`: image · icon · video · audio · file) — Ordner, Alt-Text,
  Verwendungsnachweis, Ersetzen und die Bestandsgrenze (500 je Betrieb) gelten
  damit für jede Art. Die Art kommt IMMER aus der Signaturprüfung
  (`medien.datei_typ`), nie aus dem `content_type` des Clients; ein CHECK hält
  `kind` und `mime` deckungsgleich.
  Was nicht hochgeladen werden kann: SVG (Stored-XSS im öffentlichen Bucket)
  sowie `.txt`/`.csv` (keine Signatur → fail-closed). Symbole kommen deshalb
  als HOTLINK von Iconify (`icons.py`, `source='iconify'`, Satzname + Lizenz
  als Pflicht-Nachweis) — dieselbe Bauart wie die Stock-Fotos.
  Ausgehende Abrufe (Alt-Text-Bild, Bild-Import per Adresse, Symbolsuche)
  laufen über EINEN Weg: `medien_holen.datei_holen` (IP geprüft und gepinnt,
  keine Weiterleitungen, Byte-Deckel beim Lesen). Eigene Rate-Limit-Eimer:
  Symbolsuche im `stock`-Eimer, `/media/import` im `ai`-Eimer.
- Ohne `CLOUDFLARE_*`-Konfiguration antworten die Domain-Endpunkte mit 503
  (kein stiller Fallback).

Frontend: Editor `apps/web` (`/website`, craft.js; Server-Actions in
`lib/site-pages.ts`, `lib/site-config.ts`, `lib/site-medien.ts` +
`lib/site-weiterleitungen.ts`; der Media Manager hat mit `/website/mediathek`
eine eigene Seite und einen Leisteneintrag) ·
öffentlicher Renderer `builder/`. Der SEO-Reiter liegt unter `/website/seo`
(Übersicht · Seiten · Strukturierte Daten · Messung · Weiterleitungen).

`node scripts/i18n/blocktypen-pruefen.mjs` hält die Abschnitts-Typen über alle
sieben Stellen gleich (DB-CHECK, `BlockType`, `_CONTENT_MODEL`, beide
TypeScript-Unions, Editor-Katalog, Renderer-`switch`) plus Label und Hinweis in
24 Sprachen.
Siehe [ADR-0013](../../../../../docs/decisions/0013-page-builder-renderer-editor-trennung.md).
