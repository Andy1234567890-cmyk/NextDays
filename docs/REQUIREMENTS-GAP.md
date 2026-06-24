# Anforderungs-Gap-Analyse & Roadmap

> Abgleich des [Lastenhefts](LASTENHEFT.md) mit dem aktuell umgesetzten Stand
> (12 Slices, auth voll, Migrationen 0001–0008). Zweck: Grundlage für
> Datenmodell-Erweiterung und Stundenschätzung (Andy).

## Legende
✅ vorhanden · 🟡 teilweise / Struktur da · 🔴 neu · ⚠️ Widerspruch zur bisherigen Spec

---

## A. Übergreifend (Lastenheft §1)

| Anforderung | Status | Hinweis |
|---|---|---|
| Glatte Beträge, keine Cents/Øre | 🔴 | DB nutzt `numeric(12,2)`. Darstellung muss runden; Rundungs-/Format-Policy als Querschnitt definieren. |
| 3 native Sprachen (DE/DK/EN), Dänisch-Bug | 🔴 | i18n bisher nicht umgesetzt. Frontend-i18n + serverseitige Übersetzungs-Persistenz nötig. |
| Globale Mandantenfähigkeit | ✅ | RLS + `tenant_id` + JWT-Claim stehen. |

## B. Module (Lastenheft §2)

| Modul | Vorhandener Slice | Status | Lücke |
|---|---|---|---|
| 2.1 Custom Dashboard (Drag&Drop, White-Label) | — | 🔴 | Neuer Frontend-Bereich + `dashboard_layouts`-Tabelle, Logo-Storage. |
| 2.2 Multi-/Einzelkalender (Click-and-Hold) | `calendar` | 🟡 | Slice + `availability` da; UI-Interaktion, manuelle Preisüberschreibung im Kalender, Popup-Logik fehlen. |
| 2.3 Saison-/Event-Management | `rates` | 🟡 | `rate_plans.season_rules` jsonb da, aber: taggenaue Saisons, Templates, Farb-Legende, Events (unterbrochene Zeiträume) = neue Tabellen. |
| 2.4 Unified Inbox + Messaging | `inbox` | 🟡 | Slice + `messages` da; Trigger-System, Multi-Channel (SMS/OTA), Übersetzungs-Gateway, Rich-Text, Shortcodes fehlen. |
| 2.5 Aufgaben-/Checklisten | `tasks` | ✅ | Slice mit Logik: create/list/status, auto-Generierung bei Buchung (Anreise-Check + Endreinigung), Checklisten + Foto-Nachweise, Inventar (auch unterkunftslos), Vertretungs-Feature (§4.3). Datenmodell 0012+0019. Capability-geschützt. |
| 2.6 CRM (Leads) + Partner/Deals | — | 🔴 | Neuer `crm`-Slice: `leads`, `partners`/`deals`. |

## C. Schnittstellen (Lastenheft §3)

| Anforderung | Status | Hinweis |
|---|---|---|
| Zwei-Wege-REST-APIs (Airbnb, Booking, Vrbo) | 🟡 | `channel_manager`-Slice + Adapter-Pattern vorbereitet; konkrete Adapter + Webhooks fehlen. |
| Aggregator (Feondi) optional | 🟡 | Durch Adapter-Pattern offen (ADR-0001). |
| **Revolut als primäres Gateway** | ⚠️🔴 | **Bisherige Spec/Code: Stripe.** Entscheidung: **Revolut primär, Stripe sekundär.** `payments`-Slice + Tech-Stack + ADR anpassen. |
| Onboarding/Klonen (bidirektional) | 🔴 | Import/Export Unterkünfte via Channel-APIs — neue Funktion im `channel_manager`/`properties`. |

## D. Rollen (Lastenheft §4)

| Anforderung | Status | Hinweis |
|---|---|---|
| Rollen owner/staff/cleaner + admin/co_admin | ✅ | Enum + granulare Capability-Matrix (auth/permissions.py) bildet §4 vollständig ab: Co-Admin System-Alerts + Staff-Zuweisung, Owner Notification-Prefs, Staff Verfügbarkeit + Vertretung. Tenant-Gründer = admin; invite legt weitere Rollen an (E2E gegen echte DB verifiziert). |
| Eigentümer sieht nur SEINE Objekte | ✅ | `owner_property_assignments` (tenant_id,user_id,property_id; Migration 0058) ordnet einem Eigentümer-Login seine Objekte zu. RLS (0059): RESTRICTIVE SELECT-Policies via `owner_can_see_property()` auf `properties` + allen 23 property_id-Tabellen → owner sieht nur zugeordnete Zeilen, Agentur den ganzen Tenant. Pricing-API setzt den Scope zusätzlich durch (Service-Role umgeht RLS): `overview()` filtert, `update()` → 403 (read-only §4.2). Zuordnungs-API `GET/PUT /auth/owners/{id}/properties` (MANAGE_OWNERS) + UI in Konto → Benutzer. Sidebar reduziert (OWNER_ALLOWED_HREFS). E2E mit echtem owner-Login verifiziert (sieht 1 von 4 Objekten; update=403; owner-ohne-Zuordnung=0). Read-only-Stufe: Schreib-RLS-Policies bei Bedarf später. |
| Eigentümer-Daten-Split (Vorname, Netto/Nacht) | 🟡 | Serverseitig erzwungen über die **feingranulare Permission-Matrix** (`users.permissions`, nicht rollengekoppelt): zentraler `auth/guest_masking.py` maskiert Gastname (nur Vorname ohne `view_guest_name`), Kontakt (`view_guest_contact`), Beträge (`pm_booking_total` & nicht `hide_prices`), Quelle (`view_booking_source`) — genutzt von `reservations.service` (list/get/create/dashboard) und `inbox.service` (list_threads/reservation_detail); fail-closed, admin = alle. Posteingang zusätzlich mit Enterprise-Achsen (Scope/Actions, `inbox/authz.py`). Offen: gleiche Maskierung in weiteren Slices (Finanzen/Reports) + DB-seitige RLS-Spaltenfilter. |
| Sperrung beantragen → Admin-Freigabe | 🔴 | Workflow + `block_requests`-Tabelle. |
| Zählerstände (append-only) | 🔴 | `meter_readings`-Tabelle, RLS verbietet Update/Delete für owner. |
| Mitarbeiter-Smartphone-Portal | 🔴 | Eigene Ansicht, strikte Datentrennung, Vertretungs-Feature. |

## E. Gäste-Portal & Buchung (Lastenheft §5)

| Anforderung | Status | Hinweis |
|---|---|---|
| Gästekarte (Enterprise-Gästeprofil) | ✅ | `guests`-Slice ausgebaut (Migration 0046): Stammdaten + Adressen/Kontakte/Ausweise/Präferenzen/Consents/Notizen/Dokumente + Joins (Reservierungen/Threads/Rechnungen). Zugriff `pm_guest_details`, Feld-Maskierung über zentralen `guest_masking` (inkl. `view_guest_id_docs`), DSGVO-Anonymisierung. Frontend Liste + Detail mit Tabs. Merge (Dubletten) implementiert: Sub-Ressourcen + Reservierungen/Buchungen/WhatsApp-Konvos source→target umhängen, `guest_preferences` (1:1) & `guest_external_ids` (DSGVO) gesondert, Quell-Gast anonymisieren. |
| White-Label-Gäste-Portal | 🟡 | `public_portal`-Slice als Struktur da (Phase 2). |
| Echtzeit-Admin-Push bei Erst-Login | 🔴 | Event/Notification-System. |
| Zentralisierte dreisprachige Standardtexte | 🔴 | `content_blocks`-Tabelle + Zuweisung pro Unterkunft. |
| Buchungs-Widget (einbettbar) | 🟡 | `booking_engine`-Slice da; Widget-Export + Marketing-Einbindung fehlen. |

## F. Onboarding 8-stufig (Lastenheft §6)

| Anforderung | Status | Hinweis |
|---|---|---|
| 8-stufige Objektkartei (BFE, CPR, Boligtype, Bank, Verträge, Technik, Serviceverträge, Handwerker, Marketing, Husmappe, Annoncering) | 🔴 | Große Erweiterung von `properties` + neue verknüpfte Tabellen; PDF-Export/Druck. Viele Felder sind **DK-spezifisch** (BFE, CPR, Boligtype) → nullable, da global einsetzbar. |
| Adress-Split (Straße/Nr./PLZ/Ort/Land) | 🔴 | `properties.address` (heute Freitext) auf strukturierte Felder umstellen. |
| Miteigentümer | 🔴 | `co_owners`-Tabelle. |

## G. Ergänzungs-Modul: Ökosystem (Lastenheft §7)

| Anforderung | Status | Hinweis |
|---|---|---|
| All-Inclusive, kein Feature-Gating | 🔴 | Geschäftsmodell-Policy; technisch: KEINE Feature-Flags zum Sperren von Funktionen. Als ADR-0006 festhalten. |
| 0% Buchungsgebühr (eigenes System) | 🔴 | `commissions` gilt nur fürs Portal (Phase 2), NICHT für PMS-Direktbuchungen. Sicherstellen, dass Vermieter-Buchungen gebührenfrei sind. |
| Preis skaliert über Anzahl Unterkünfte | 🔴 | `subscriptions`/`plans`-Tabelle (unit-basiert), `tenant`-Abrechnung. |
| Beherbergungs-Typ-Dropdown | 🔴 | `properties.property_type` Enum (ferienhaus, glamping, tiny_house, stellplatz, hausboot, …) → steuert Checklisten/Shortcodes/Onboarding. ADR-0007. |
| Typ-spezifische Felder & Templates | 🔴 | Glamping (Whirlpool/Sauna/Brennholz), Stellplatz (QR-Check-in, Stellplatznr., Schranken-Code), Hausboot (Fäkalientank, Liegeplatz) → typgebundene Felder (jsonb `type_attributes` oder Detailtabellen). |
| QR-Check-in / Schranken-Code in SMS | 🔴 | Verknüpft mit Messaging-Trigger (§2.4) + tasks. |

---

## Abgeleitete Datenmodell-Erweiterungen (für die Migrationen)

**Neue Tabellen (Vorschlag):**
`seasons`, `season_templates`, `season_assignments`, `events`, `event_periods`,
`tasks`, `task_rules`, `checklists`, `checklist_items`, `checklist_photos`,
`inventory_items`, `leads`, `partners`, `deals`, `dashboard_layouts`,
`content_blocks`, `content_assignments`, `block_requests`, `meter_readings`,
`co_owners`, `message_templates`, `message_triggers`, `notifications`,
`onboarding_steps` (oder Felder direkt an `properties`),
`subscriptions`/`plans` (unit-basiertes Preismodell), `surcharges` (Reinigung,
Hund, Wäsche, Nebenkosten).

**Änderungen an Bestehendem:**
- `user_role`-Enum: `+ admin, + co_admin`.
- `properties`: Adresse strukturieren; DK-Onboarding-Felder (BFE, CPR-Verweis,
  Boligtype, Bank) nullable ergänzen.
- `payments`: Gateway-Feld (`revolut | stripe`), generisches `gateway_ref` statt
  `stripe_ref`.
- Preisaufschläge (Reinigung, Hund, Wäsche, Nebenkosten) als `surcharges`.
- `properties`: `property_type`-Enum + typ-spezifische Attribute (`type_attributes`
  jsonb), Adress-Split, DK-Onboarding-Felder.

---

## Roadmap (Vorschlag, priorisiert)

> Reihenfolge nach Wert × Fundament-Charakter. Stundenschätzung als Spanne pro
> Block macht Andy auf dieser Basis (Lastenheft fordert Spannen, keine Gesamtzahl).

1. **Scope-Sync** — PROJECT.md (Module, Rollen, Tech: Revolut), Datenmodell-Doku
   und ADRs an Lastenheft angleichen. *(Doku, kein Code)*
2. **Datenmodell-Erweiterung** — neue Migrationen für die o. g. Tabellen + Enum-
   Änderungen, mit RLS. Fundament für alles Weitere.
3. **Rollen & Berechtigungen** — `admin`/`co_admin`, Toggle-Matrix, Daten-Split.
4. **Kalender-Kern** — Click-and-Hold, manuelle Preisüberschreibung, Saison/Event.
5. **Aufgaben & Checklisten** (`tasks`-Slice) + Inventar.
6. **Messaging** — Trigger-System, Multi-Channel, Übersetzung, Editor.
7. **Channel-Adapter** (Airbnb/Booking/Vrbo) + Onboarding/Klonen.
8. **Zahlungen** — Revolut-Adapter (primär), Stripe (sekundär).
9. **CRM & Partner**, **Dashboard-Personalisierung & White-Label**.
10. **Gäste-Portal & Widget**, **i18n DE/DK/EN**, **8-stufiges Onboarding + PDF**.

## Offene Punkte für Andy / Abstimmung

- **i18n-Strategie:** Frontend (next-intl o. ä.) + serverseitige Übersetzungs-
  Persistenz (Google Translate gecacht) — ADR nötig.
- **DK-Spezifika global halten:** BFE/CPR/Boligtype nullable, nicht erzwingen.
- **Rundungs-/Währungs-Policy:** wo runden (DB vs. Darstellung), Banker's Rounding?
- **Stundenschätzung:** pro Roadmap-Block als Spanne.
