# ADR-0026: Ein Eigentümer je Objekt — Miteigentümer bewusst nicht abgebildet

- Status: **ERSETZT** durch [ADR-0028](0028-miteigentuemer-mit-anteil.md)
  (2026-09-07, wenige Stunden später)
- Datum: 2026-09-07 (Entscheidung faktisch seit Migration 0073, 07/2026)

> **Diese Entscheidung gilt nicht mehr.** Die Annahme „Der Bedarf beim
> Beta-Betrieb ist null" war falsch: der Betrieb forderte Miteigentümer noch am
> selben Tag ausdrücklich ein (*„Ja es muss ein miteigentümer geben"*), und
> Lastenheft §6 hatte sie von Anfang an verlangt. Migration 0601 löst die
> Exklusiv-Sperre aus 0073; der Anteil steht in
> `owner_properties.ownership_share`. Der Text unten bleibt als Beleg, WARUM
> die Sperre bestand und was an ihr hing — jede der dort genannten Ketten
> (Abrechnung, Owner-Scope, Portal-Login) musste für 0601 einzeln geprüft
> werden. Ergebnis: nur die Abrechnung war betroffen, der Portal-Login konnte
> mehrere Eigentümer je Objekt schon immer.

## Kontext

Lastenheft §6 fordert „Miteigentümer mit identischen Stammdaten-Feldern".
Migration 0014 legte dafür `co_owners` an (name/email/phone/share_percent).
Migration 0073 setzte `unique (property_id)` auf `owner_properties`: ein
Objekt gehört genau einem Eigentümer; `owners/service.assign_property` weist
eine zweite Zuordnung mit 409 ab. `co_owners` wurde nie angebunden und ist seit
0063 als DEPRECATED markiert.

## Entscheidung

Ein Objekt hat GENAU EINEN Eigentümer-Datensatz. Miteigentum (mehrere
natürliche Personen, Erbengemeinschaft, Ehepaar) wird über die Stammdaten
DIESES Eigentümers abgebildet (Name des Eigentümers = die Gemeinschaft, Bank-
verbindung = das gemeinsame Konto). Anteilige Auszahlungen an mehrere Konten
sind kein Systemmerkmal.

Gründe: die Eigentümer-Abrechnung (`owner_statements`), der Eigentümer-Scope
(RLS `owner_can_see_property`, 0059) und der Portal-Login hängen an genau
einem Owner je Objekt; ein zweiter Owner würde jede dieser Ketten verdoppeln
(Abrechnung teilen, Sperranträge doppelt genehmigen, Zählerstände zuordnen).
Der Bedarf beim Beta-Betrieb ist null.

## Konsequenzen

- `co_owners` bleibt ungenutzt (kein Löschen ohne Auftrag), keine API, keine UI.
- Lastenheft §6 „Miteigentümer" wird als „nicht umgesetzt, bewusst" geführt.
- Wird Miteigentum doch nötig, ist der Weg ein zweiter Portal-Login auf
  DENSELBEN Eigentümer-Datensatz (Familienzugang, 0389), nicht ein zweiter Owner.
