# ADR-0028: Miteigentümer je Objekt mit Anteil — ersetzt ADR-0026

- Status: **akzeptiert**
- Datum: 2026-09-07
- Ersetzt: [ADR-0026](0026-ein-eigentuemer-je-objekt.md) („Ein Eigentümer je
  Objekt, Miteigentum bewusst nicht abgebildet", vom selben Tag)
- Migration: 0601
- Betrifft: `owner_properties` (Constraint, Trigger), `owner_statements`
  (`ownership_shares`), `owners/service.assign_property` +
  `assign_properties`, `owner_statements/{service,zeilen,schemas}.py`,
  `web/components/owner-statements/statement-editor.tsx`,
  `web/lib/owner-statements.ts`

## Kontext

ADR-0026 hielt am Morgen des 07.09.2026 fest: ein Objekt gehört genau einem
Eigentümer-Datensatz, Miteigentum (Erbengemeinschaft, Ehepaar) wird über die
Stammdaten DIESES Eigentümers abgebildet (Name = die Gemeinschaft, Bank =
das gemeinsame Konto). Begründung damals: „Der Bedarf beim Beta-Betrieb ist
null."

Diese Annahme war falsch. Ansage des Betriebs am Nachmittag desselben Tages,
zur Etappe 13 des Lastenhefts: *„Ja es muss ein miteigentümer geben."*
Lastenheft §6 hatte es von Anfang an gefordert.

## Entscheidung

Ein Objekt kann mehreren Eigentümern gehören, jeder mit einem ANTEIL.

1. **Der Anteil ist `owner_properties.ownership_share`** — die Spalte existiert
   seit 0063 samt Eingabefeld in der Oberfläche. Sie wird nicht durch eine neue
   ersetzt; ein zweites Prozentfeld am selben Link wäre dauerhaft verwirrend.
2. **`unique (property_id)` aus 0073 fällt** (0601). `unique (owner_id,
   property_id)` aus 0063 bleibt: derselbe Eigentümer darf nicht zweimal am
   selben Objekt hängen, sonst zählte die Abrechnung seinen Anteil doppelt.
3. **Die Summe je Objekt bleibt ≤ 100 %**, erzwungen doppelt: im Service mit
   einer Meldung, die Namen und Anteile nennt, und als DB-Trigger
   `owner_properties_anteile_pruefen` — der Server schreibt mit `service_role`
   und umgeht jede Policy (Wurzel 6).
4. **Der Anteil greift ganz am ENDE der Rechenkette.** Portal-Abzug,
   Verwaltungsprovision, Pauschale und Gebühren werden auf die ganze Buchung
   gerechnet; geteilt wird erst das Ergebnis. Andernfalls bekäme der Betrieb
   seine Provision je Miteigentümer einmal.
5. **Jeder Miteigentümer bekommt seine EIGENE Abrechnung** über seinen Anteil.
   Kein Sammelbeleg, keine anteilige Auszahlung an mehrere Konten aus einem
   Beleg.
6. **Der Anteil wird je Objekt eingefroren**
   (`owner_statements.ownership_shares`, jsonb `{property_id: anteil}`). Ein
   späterer Anteilsverkauf darf einen finalisierten Beleg nicht rückwirkend
   umschreiben — bei fortlaufender Nummer nach §14 UStG wäre das eine
   Falschaussage. JE OBJEKT und nicht ein Wert, weil derselbe Eigentümer an
   einem Haus 60 % und am nächsten 100 % halten kann (live so bei René Dahl
   Nielsen erzeugt und gemessen).
7. **Ein fehlender Anteil ist kein Mangel**: die Spalte ist `not null` mit
   Default 100, ein leerer Wert heißt Alleineigentum. Ein Anteil außerhalb
   0–100 ist dagegen ein harter 422.

## Der Bestand: 80 % war nicht der Anteil

Vor 0601 stand `ownership_share` bei 17 von 22 Zuordnungen auf **80**, und
zwar genau dort, wo `commission_override_pct` **20** war — `share = 100 −
Provision`. Jedes dieser Objekte hatte genau einen Eigentümer. Das Feld trug
also die Auszahlungsquote nach Provision, einen zweiten Ausdruck derselben
20 %.

Hätte die Rechenkette diesen Wert als Anteil übernommen, wäre die Provision
zweimal abgezogen worden: René Dahl Nielsen hätte statt 3.736,00 DKK nur
2.988,80 DKK je Buchung bekommen — ein Fehler von 20 %, der wie eine
Rundungsdifferenz aussieht.

0601 setzt den Anteil deshalb auf 100, wo ein Objekt genau EINEN Eigentümer
hat. Dann ist „100 %" nachweislich richtig, unabhängig davon, wie der Wert
gemeint war. Objekte mit mehreren Eigentümern (damals keine) bleiben
unangetastet — dort wäre jede Änderung eine Behauptung über die Aufteilung.
Freigabe des Nutzers erfolgte, nachdem alle 22 Zeilen vorlagen (MEMORY
„bereinigung-nur-nach-absicht-nicht-etikett").

## Konsequenzen

- Der Portal-Login war nie das Hindernis: `owner_property_assignments` ist
  `unique (user_id, property_id)`, mehrere Eigentümer-Logins je Objekt gehen
  seit 0058. `owner_can_see_property` (0425) prüft die Mitgliedschaft dort und
  bleibt unverändert; 0389 (Familienzugänge, zweistufige Sperrfreigabe) auch.
- Die Mehrfach-Zuordnung (`assign_properties`, Anlege-Dialog) legt weiter
  100 % an und weist ein bereits vergebenes Objekt ab — mit dem Weg zum
  Miteigentum im Text. Anteile werden auf der Detailseite gepflegt, wo das
  Feld steht.
- `co_owners` (0014, DEPRECATED seit 0063) bleibt ungenutzt und wird NICHT
  reaktiviert: Miteigentümer sind vollwertige `owners` mit eigenen Stammdaten,
  eigener Abrechnung, eigener Bankverbindung und eigenem Portalzugang. Eine
  zweite Personentabelle hätte all das nicht.
- Vorschau und Beleg zeigen den Anteil je Zeile (nur unter 100 %) und die
  anderen Eigentümer desselben Objekts mit Namen und Anteil. Ohne diese
  Auskunft wäre ein Anteil von 60 % nachvollziehbar, aber nicht überprüfbar.
- Lastenheft §6 „Miteigentümer" ist damit umgesetzt; `REQUIREMENTS-GAP.md`
  ist entsprechend nachzuziehen.

## Was NICHT entschieden ist

- Anteilige Auszahlung an mehrere Konten aus EINEM Beleg (jeder Eigentümer
  bekommt seinen eigenen).
- Ein Sammelbeleg über alle Miteigentümer eines Objekts.
- Anteile mit mehr als zwei Dezimalstellen (`numeric(5,2)`; 33,33 × 3 = 99,99
  geht durch, der Trigger toleriert bis 100,0001).
