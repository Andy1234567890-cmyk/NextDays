# Slice: owners

Vertical Slice für die verwaltete **Eigentümer-Partei** (Agentur verwaltet Objekte
für fremde Eigentümer). Getrennt vom Owner-Login-User (`owner_property_assignments`,
auth-Slice) und von der reinen Kontaktliste `co_owners` (deprecated ab 0063).

Enthält: router.py, service.py, schemas.py, dependencies.py, tests/.
Regeln: explizite Pydantic-Typisierung, kein DB-Zugriff aus Routern, kein
Exception-Swallowing. Siehe PROJECT.md.

## Endpunkte (`/api/v1/owners`, alle `MANAGE_OWNERS`, tenant-gescoped)

- `GET /` — Eigentümer-Liste (Stammdaten + Objekt-Anzahl).
- `POST /` — anlegen, optional mit `property_ids` (Objekte SOFORT zuordnen) und
  `portalzugang`. Alles-oder-nichts: scheitert die Zuordnung oder der Zugang,
  wird die Anlage zurückgenommen — kein Eigentümer ohne seine Objekte und kein
  Eigentümer mit Objekten, aber ohne den angeforderten Zugang.
- `GET /free-properties` — Objekte OHNE Eigentümer; die Auswahl im Anlege-Dialog
  (dort gibt es noch keine `owner_id`). Steht VOR `GET /{id}`, sonst wäre der
  feste Pfad hinter der Platzhalter-Route unerreichbar.
- `GET /{id}` — Detail inkl. Objekt-Zuordnungen.
- `PATCH /{id}` — Stammdaten/Bank/Provision/Statement-Frequenz aktualisieren.
- `DELETE /{id}` — löschen.
- `GET /{id}/available-properties` — Objekte, die diesem Owner zugeordnet werden
  dürfen: frei (keinem Owner) oder bereits sein. Objekte anderer Eigentümer fehlen.
  Liefert zusätzlich `subtitle` (Adresse) und `photo` für die Mehrfachauswahl.
- `POST /{id}/properties` — Objekt zuordnen / Anteil + Provisions-Override setzen.
  **Exklusiv:** ist das Objekt schon einem anderen Eigentümer zugeordnet → `409`.
- `POST /{id}/properties/batch` — MEHRERE Objekte auf einmal zuordnen
  (Mehrfachauswahl der Detailseite), ohne Anteil/Override. Jede ID wird gegen den
  Mandanten geprüft, bevor eine geschrieben wird; ein bereits vergebenes Objekt
  ergibt `409` und wird im Fehlertext NAMENTLICH genannt — kein stilles
  Überspringen.
- `DELETE /{id}/properties/{property_id}` — Zuordnung entfernen.

## Daten (Migration 0063)

- `owners`: verwaltete Eigentümer-Partei — Stammdaten, Adresse, Steuer-/USt-ID,
  Bankverbindung, `default_commission_pct`, `default_payout_method`,
  `statement_frequency` (none/monthly), optionale `user_id` (Owner-Login fürs Portal).
  RLS via tenant.
- `owner_properties`: Link owner↔property mit `ownership_share` (%) und
  `commission_override_pct` (überschreibt Default je Objekt). RLS via owner→tenant.
  **`unique (property_id)` (Migration 0073): ein Objekt gehört genau einem
  Eigentümer** — keine Mehrfachzuordnung (Owner 2/3 verboten).
- `reservations.channel_fee`: explizite Kanalgebühr; Total Payout = total_amount −
  channel_fee (Owner-Statements, Teil B).
- Backfill aus `co_owners` (share_percent → ownership_share). `co_owners` bleibt als
  Kontaktliste, ist aber deprecated.

Verknüpft ein Owner einen Login-User (`user_id`, Rolle `owner`), steuert das
zusammen mit `owner_property_assignments` (auth-Slice) das Portal-Scoping.

### Zwei Tabellen, zwei Aufgaben — beide müssen gepflegt werden

- `owner_properties` — wem gehört das Objekt (Abrechnung, Provision).
- `owner_property_assignments` (0058) — was sieht dieser LOGIN im Portal; genau
  darauf setzt `owner_can_see_property` und die RLS aus 0059 auf.

Der Slice schrieb lange nur die ERSTE. Ein Eigentümer, dem Objekte gehörten und
der einen Portalzugang bekam, loggte sich ein und sah NICHTS. Deshalb ziehen
`create`, `portalzugang_einladen`, `assign_property` und `assign_properties` die
Portal-Sicht über `_portalsicht_nachziehen` mit (idempotent, ERGÄNZEND — eine
über den auth-Slice gesetzte Zusatz-Sichtbarkeit bleibt erhalten), und
`unassign_property` entzieht sie wieder (Wurzel 1: mit dem Eigentum endet der
Einblick, sonst sieht der Eigentümer ein Objekt weiter, das ihm nicht mehr
gehört). Live gegen die Staging-DB geprüft: `owner_can_see_property` liefert
`true` für zugeordnete und `false` für entzogene Objekte.

## Portalzugang (Stammdaten + Login in einem Zug)

Die Eigentümer-PARTEI (`owners`) und der Portal-LOGIN (`users`) sind zwei
Dinge, die auseinanderlaufen dürfen: ein Eigentümer bekommt Abrechnungsmails
auch ganz ohne Zugang. Bis dahin gab es aber gar keinen Weg, ihm einen Zugang
zu geben, ohne dieselbe Person unter `/konto/nutzer` ein ZWEITES Mal anzulegen
— und `owners.user_id` hatte überhaupt keine UI. Ergebnis: wer im UI einen
Eigentümer anlegte, erzeugte einen Datensatz, von dem der Eigentümer nie
erfuhr, und ohne den Link sah er im Portal auch keine Abrechnungen.

Zwei Wege, beide optional und beide über denselben Mechanismus:

- `POST /owners` mit `portalzugang: true` — Stammdaten + Login + Einladung.
- `POST /owners/{id}/portalzugang` — Zugang für einen BESTEHENDEN Eigentümer.

Beide delegieren an `AuthService.invite`, also an den Weg, den auch
`/konto/nutzer` fährt (0334): Zufallspasswort, das niemand kennt, Einmal-Token
als SHA-256, Sprachauflösung des Empfängers und der Alles-oder-nichts-Rollback
bei Mailfehler. Ein eigener Mailweg hier wäre eine Kopie, die beim nächsten
Sicherheitsfix vergessen würde.

Regeln:
- **Rechte:** Stammdaten = `MANAGE_OWNERS`; das Vergeben eines ZUGANGS
  verlangt zusätzlich `MANAGE_STAFF` (Wurzel 9). Beim Anlegen hängt der
  Zusatz-Guard am Flag, nicht an der Route — sonst wäre auch das reine
  Anlegen gesperrt.
- **Ohne `email` kein Zugang** → 422, geprüft VOR dem Insert. Kein stilles
  Überspringen (Wurzel 4/5).
- **Idempotenz (Wurzel 2):** existiert im Tenant bereits ein Login zu der
  Adresse, wird DIESER verknüpft — kein zweiter Nutzer, keine zweite Mail. Die
  Rolle muss trotzdem `owner` sein.
- **Sprache:** `owners.language` wird zu `users.preferred_language` und damit
  zur Sprache der Einladungsmail. Fehlt sie, greift die Kette Betrieb →
  Englisch (`core.mail_sprache`) — kein erfundenes „de".
