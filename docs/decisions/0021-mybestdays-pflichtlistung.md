# ADR-0021: myBestDays ist Pflichtkanal für jedes Objekt

- Status: **ANGENOMMEN** (2026-09-02)
- Grundlage: Master-Strategieplan des Nutzers (02.09.2026), Abschnitt 1
  („automatisch und nicht abwählbar"), Entscheidung 1 in
  `docs/AFFILIATE-PROGRAMM-PLAN.md` Abschnitt 7.2
- Betrifft: `properties.listed_on_marketplace`, Migration `0527`,
  `apps/api/src/features/properties`, `channel_manager/objekt_verkauf.py`,
  `web/components/objekte/property-channels.tsx`,
  `web/components/channel-manager/marketplace-detail.tsx`, Open API v1
  (`channels.marketplace`), `CLAUDE.md` Abschnitt „Vertriebskanäle"
- Ersetzt: die Regel „Kanal-Sichtbarkeit ist PRO KANAL schaltbar" aus
  Migration `0159` FÜR DEN MARKTPLATZ. Für Website (`0162`) und Portale gilt
  sie weiter.

## Frage

Seit 0159 war der eigene Marktplatz myBestDays ein Vertriebskanal, den der
Betrieb pro Objekt ein- und ausschalten konnte — nach dem Industriestandard
(Channex, SiteMinder, Cloudbeds, Shopify). Die Master-Strategie macht den
Marktplatz zum Kern des Partnerprogramms: Partner erhalten 0,5 % jeder
myBestDays-Buchung geworbener Betriebe (Markt-Turbo). Ein abwählbarer Kanal
untergräbt dieses Versprechen. Soll der Marktplatz Pflicht werden, und wie
wird das durchgesetzt?

## Entscheidung

**Jedes über myNextDays verwaltete Objekt ist auf myBestDays gelistet. Der
Betrieb kann diesen Kanal nicht abwählen.** Sichtbar ist ein Objekt dort,
wenn es aktiv ist (`status='active'`) UND myBestDays es als Anbieter
freigegeben hat (`moderation_status='approved'`, 0203). Die Moderation bleibt
die einzige Achse neben dem Lebenszyklus.

Durchsetzung an drei Stellen:

1. **Datenbank (Wurzel 6).** `properties` ist für `authenticated` schreibbar;
   ein Client könnte per PostgREST `listed_on_marketplace=false` setzen. Der
   Trigger `properties_marktplatz_pflicht` (0527) korrigiert jeden solchen
   Schreibversuch still auf `true`. Die eine Ausnahme ist eine offene
   „Verkauf pausieren"-Pause (`property_sales_pause`, portal_code
   `myBestDays`, `beendet_at is null`, 0375): Pausieren nimmt ein Objekt bei
   ALLEN Kanälen aus dem Verkauf, und das Flag ist dort der Hebel. Der
   Rückweg setzt es wieder auf `true` und schließt die Pause.
2. **API (Wurzel 3).** `PropertyUpdate.listed_on_marketplace=false` → 422 mit
   Klartext; `PropertyCreate` und `duplicate()` setzen `true`, egal was der
   Client schickt. Der Channex-Reverse-Import setzt nicht mehr `false`.
   Die Open API v1 liefert `channels.marketplace` weiterhin (lesend, immer
   `true` außer in der Pause) — keine Abkündigung nötig.
3. **Oberfläche.** Die Schalter in `property-channels.tsx`,
   `marketplace-detail.tsx` und im Anlege-Dialog sind entfernt; sichtbar
   bleibt der Zustand („gelistet · Freigabe ausstehend/erteilt").

## Folgen

- Die Regel „Kanal-Sichtbarkeit pro Kanal" in `CLAUDE.md` gilt nur noch für
  Website und Portale. Der Marktplatz ist ein Vertragsbestandteil des Abos,
  kein Wahlkanal — die Betriebs-AGB brauchen die Klausel (Anwalt, offen).
- Verkauf pausieren bleibt der Weg, ein Objekt vollständig aus dem Verkauf zu
  nehmen; die Pause-Tabelle ist damit die einzige legitime Quelle für
  `listed_on_marketplace=false`.
- Alte Clients (mobile-nextdays, Integratoren), die den Schalter noch senden,
  bekommen bei `false` eine 422 statt eines stillen Ignorierens.

## Verworfen

- **Spalte entfernen.** Sie ist die eine Filterstelle aller Marktplatz-
  Abfragen (`schaufenster`, `guest_wishlist`, Kanal-Karte) und der Hebel der
  Verkaufs-Pause. Entfernen hätte drei Slices umgebaut, ohne etwas zu
  gewinnen.
- **Nur in der API sperren.** Schützt den Direktpfad nicht (Wurzel 6).
- **Pflicht mit Opt-out über den Support.** Widerspricht der Entscheidung
  „nicht abwählbar" und wäre ein Sonderweg ohne Datenmodell.
