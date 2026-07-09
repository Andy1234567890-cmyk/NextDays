# Analyse: Gäste-Infos, Gastmodul, Gästemappe & Nachrichten-Bausteine

**Stand:** 2026-07-09 · verifiziert gegen Code UND Live-DB (Server 65.21.144.136,
`db-cdqxi7d0w34sxzr4wr8jy8um`). Ausgelöst durch die berechtigte Frage: *„Nicht dass
wir 10 000 Tabellen haben und die nicht zusammenarbeiten."*

Ziel: EINE bewusste Entscheidung, wo Gäste-Info-Texte (WLAN, Hausordnung, Türzugang,
Reiseführer …) und Gastmodul-Schalter (Self-Check-in, Türcode-Regeln, Kopfbild) leben,
BEVOR für den PM-Objektbereich „Gastmodul" + „Gästemappe" gebaut wird.

---

## 1. Ist-Stand: die konkurrierenden Töpfe (alle verifiziert)

### Für Info-TEXTE (WLAN / Hausordnung / Reiseführer / …)

| Struktur | Typ | Angebunden? | Live-DB-Daten | Reichweite |
|---|---|---|---|---|
| **`properties.type_attributes.messaging`** | jsonb-Feld | ✅ UI vorhanden (`messaging-form.tsx` → `updateProperty()`) | **0 von 35 Objekten** haben `messaging` gesetzt | pro Objekt |
| **`content_blocks` + `content_assignments`** | eigene Tabellen (Mig. 0014) | ❌ kein Code liest/schreibt | **0 Zeilen** | tenant-weit, Block→viele Objekte |

- `messaging`: 8 feste Felder (`checkIn, checkOut, directions, doorInstructions, rules,
  wifi, localGuide, emergency`), mehrsprachig, je mit Shortcode (`{{WifiInformation}}` …).
  Definition: `apps/web/lib/messaging-meta.ts`. **Aber:** die Shortcodes werden aktuell
  **nirgends real ersetzt** — im inbox-scheduler kein `{{…}}`-Replacing gefunden.
- `content_blocks`: generisch (`kind` = house_rules/checkin/guide/…, `body_i18n` jsonb).
  Hat RLS + Realtime + `set_updated_at`. Der `content`-Slice macht aber **nur `translate`**
  (`apps/api/src/features/content/service.py`), keine content_blocks-Verwaltung.

**→ Beide Modelle decken dieselben Inhalte ab. Beide sind praktisch DATENLEER.** Es gibt
nichts zu migrieren — die Entscheidung ist billig, JETZT ist der richtige Zeitpunkt.

### Für Gastmodul-SCHALTER (Self-Check-in, Türcode-Regeln, Kopfbild, Kontaktperson)

- **Existiert nirgends.** Weder Tabelle noch Feld. `properties` hat nur Basisspalten
  (title, address, max_guests, base_price); kein wifi/door/checkin-Feld. Verifiziert per
  `\d properties` + Migrationsscan.
- Das sind strukturierte Werte/Toggles + Anzeige-Regeln (Türcode nur wenn bezahlt / erst
  ab Check-in / ab Uhrzeit) — **keine** Freitexte. Passen NICHT in `messaging` (Texte) und
  auch nicht sauber in `content_blocks` (Texte).

### Öffentliches Gästeportal (wo der Gast das alles SIEHT)

- **Existiert nicht.** Kein `guest-portal`/self-checkin-Route im Frontend. Der
  `public_portal`-Slice ist das **Eigentümer**-Self-Service-Portal (§4.2), NICHT das
  Gast-Portal. D. h. selbst wenn Texte/Schalter gepflegt werden, gibt es heute keine
  Gast-sichtbare Fläche — das ist ein separates, späteres Feature.

### Nebenbefund: tote Parallel-Tabellen bei Nachrichten (dieselbe Krankheit)

| Tabelle | Code-Referenzen | Live-Zeilen | Status |
|---|---|---|---|
| `message_template` (Singular) | 1 | 1 | **genutzt** |
| `message_templates` (Plural) | 0 | 0 | tot (Dublette) |
| `message_automation` | 1 | 0 | angebunden, leer |
| `message_triggers` | 0 | 0 | tot |
| `content_blocks` / `content_assignments` | 0 | 0 | tot |

→ Bestätigt die Sorge: es gibt bereits mehrere ungenutzte Parallel-Tabellen. Diese sollten
in einem eigenen Aufräum-Schritt entfernt werden (nicht Teil des PM-Baus, aber dokumentiert).

---

## 2. Empfehlung (klare Zusammenarbeit statt neuer Insel)

### A) Gäste-Info-TEXTE → EINE Wahrheit: `properties.type_attributes.messaging`
- **Nutzen, was lebt.** `messaging` ist bereits angebunden (UI + `updateProperty`), pro
  Objekt, mit den exakt passenden Feldern (rules/wifi/localGuide/doorInstructions …).
- Der PM-Reiter **„Gästemappe"** editiert genau diese `messaging`-Felder — er ist eine
  zweite, gästemappen-artige Ansicht auf dieselben Daten (nicht ein neues Datenmodell).
  Damit arbeiten der Objekt-Reiter „Nachrichten" (bestehend) und der PM-Reiter „Gästemappe"
  auf **einer** Quelle — keine Divergenz.
- **`content_blocks`/`content_assignments` bleiben ungenutzt** und kommen auf die
  Aufräumliste (§4). Sie werden NICHT reaktiviert (mächtiger, aber leer → kein Mehrwert
  jetzt, nur Doppelpflege-Risiko).

### B) Gastmodul-SCHALTER → EINE neue, schlanke Tabelle `property_guest_portal`
- Die Toggles/Regeln (enabled, self_checkin, door_code + Anzeige-Regeln, contact_*,
  maintenance_phone, header_image_path) existieren nirgends → eine neue Tabelle ist KEINE
  Doppelung (verifiziert). Migration `0121` (bereits geschrieben, guidebook-Teil entfernt).
- Warum eigene Tabelle statt `type_attributes`: der **Türcode ist sensibel** (gehört
  maskiert, wie WiFi-PW) und braucht eigenes RLS/Realtime — im properties-jsonb läge er
  unmaskiert im Sammelblob. Klare Grenze: **Schalter/sensible Werte = Tabelle; Freitexte =
  messaging.**
- Der WLAN-/Türzugang-**Text** bleibt in `messaging` (`wifi`, `doorInstructions`); die
  Tabelle hält nur, was messaging nicht kann (strukturierter Code + Regeln + Toggles).
  Das Gastmodul-Formular liest/schreibt beide Quellen zusammen und zeigt sie als eine Fläche.

### C) Gästeportal (Gast-Sicht) = ausdrücklich späterer, eigener Auftrag
- Weder bauen noch andeuten. Der PM-Bereich pflegt nur die Daten; die Gast-sichtbare
  Portalseite ist ein separates Feature (wie das Pre-Check-in-Formular).

---

## 3. Konsequenz für den laufenden PM-Bau

- **Gästemappe-Reiter:** KEINE neue Tabelle. UI setzt auf `messaging` (bestehende
  `readMessaging`/`updateProperty`, `MESSAGING_FIELDS`). Reiner Frontend-Bau.
- **Gastmodul-Reiter:** neue Tabelle `property_guest_portal` (Mig. 0121, nur dieser Teil)
  + kleiner `property_portal`-Slice (GET/PUT, tenant-scoped, Türcode/WiFi-PW maskiert) +
  Formular. Das Formular bündelt Schalter (Tabelle) + WLAN/Türzugang-Text (messaging).
- **Migration 0121** ist bereits um den `property_guidebook`-Teil bereinigt → legt nur
  `property_guest_portal` an. Wird NICHT automatisch eingespielt (via
  `supabase/apply-migrations.sh`, nach Freigabe).

## 4. Aufräum-Backlog (separat, nicht jetzt)
- Tote Tabellen entfernen/zusammenführen: `message_templates` (Plural-Dublette von
  `message_template`), `message_triggers`, ggf. `content_blocks`/`content_assignments`
  (falls Entscheidung A bestätigt). Erst nach Live-Check „wirklich 0 Zeilen & 0 Nutzung".
- Shortcode-Auflösung: `messaging`-Shortcodes (`{{WifiInformation}}` …) werden derzeit
  nicht ersetzt → beim Gästeportal/Auto-Nachrichten-Ausbau nachziehen.

---

## 5. Zu klärende Entscheidung (Nutzer)
1. **Info-Texte:** Bestätigung „auf `messaging` aufsetzen, `content_blocks` NICHT
   reaktivieren"? (Empfehlung A)
2. **Gastmodul-Schalter:** Bestätigung „neue schlanke `property_guest_portal`-Tabelle"?
   (Empfehlung B)
3. **Aufräumen der toten Tabellen** jetzt mitnehmen oder als eigenes Ticket?
