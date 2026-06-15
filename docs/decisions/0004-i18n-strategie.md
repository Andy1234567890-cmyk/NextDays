# ADR-0004: Internationalisierung (i18n) — DE / DK / EN nativ

- Status: **akzeptiert**
- Datum: 2026-06-15

## Kontext

Das Lastenheft (§1) verlangt UI und alle automatisierten Kommunikationskanäle
vollständig und fehlerfrei in **Deutsch, Dänisch, Englisch**, inklusive Fix des
bestehenden Dänisch-Bugs. Das System ist global einsetzbar (weitere Sprachen
später denkbar).

## Entscheidung

**Zwei getrennte Übersetzungs-Ebenen:**

1. **Statische UI-Texte (Frontend):** Standard-i18n-Bibliothek für Next.js
   (z. B. `next-intl`), Sprachdateien pro Locale (`de`, `da`, `en`). Locale-Routing
   und Fallback-Kette `da → en`, `de → en`.

2. **Dynamische/nutzergenerierte Inhalte (Backend):** Listings, Nachrichten,
   Standardtexte werden **serverseitig übersetzt und persistiert** (nicht bei jedem
   Request neu). Übersetzungen liegen in der DB (z. B. `*_translations` oder
   `jsonb`-Felder pro Locale). Maschinelle Übersetzung (Google Translate) nur
   einmalig beim Erstellen/Ändern, Ergebnis gecacht.

## Optionen

- **A) Nur Frontend-i18n** — deckt dynamische Inhalte (Nachrichten, Listings) nicht ab.
- **B) Übersetzung bei jedem Request** — Kosten/Latenz, verworfen.
- **C) Frontend-i18n + serverseitige Persistenz (gewählt)** — sauber getrennt,
  performant, kostenkontrolliert.

## Konsequenz

- Frontend: `next-intl` + `messages/{de,da,en}.json`.
- Backend: Übersetzungs-Service im Slice (oder `content`-Slice), DB-Persistenz,
  Google-Translate-Adapter mit Cache.
- **Dänisch-Bug:** dedizierter Testfall je Locale (Sonderzeichen æ/ø/å), damit der
  Bug nicht wiederkehrt.
- Glatte Beträge & Datums-/Zahlenformate locale-abhängig (siehe ADR-0005).
