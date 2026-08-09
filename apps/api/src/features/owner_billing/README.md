# owner_billing — Fundament der konfigurierbaren Eigentümer-Abrechnung

Dieser Slice **pflegt Konfiguration, er rechnet nicht.** Die Auszahlungsformel
liegt weiterhin allein in `owner_statements/common.py` und ist unverändert
führend. Der Umstieg der Rechenkette auf diese Daten ist eine eigene,
abgegrenzte Etappe (siehe unten).

## Warum es das gibt

Die Auszahlung der Plattform ist das Brutto des Betriebs. Ihre Bestandteile
gehören aber nicht alle derselben Partei:

```
Auszahlung der Plattform                    = Brutto des Betriebs
  − Reinigungsgebühr   → bleibt beim BETRIEB (er erbringt die Leistung)
  − Haustiergebühr     → bleibt beim BETRIEB
  − Nebenkosten        → 100 % an den EIGENTÜMER, provisionsfrei
  = bereinigte Basis
bereinigte Basis × Provisionssatz           = Provision des Betriebs
bereinigte Basis × (1 − Satz) + Nebenkosten = Eigentümer-Betrag
  − Pauschale je Buchung                    = Auszahlung
```

Diese Kette ist die Vereinbarung **eines** Betriebs. Sie steht deshalb nicht im
Code, sondern in zwei Tabellen, die jede Agentur selbst einstellt.

## A) Gebühren-Klassifikation (`fee_classification`, 0343)

Jede Gebührenart trägt **zwei unabhängige Kennzeichen** — so machen es OwnerRez
und Guesty:

| Achse | Werte | Frage |
|---|---|---|
| `gehoert_zu` | `betrieb` · `eigentuemer` · `durchlauf` | Wem gehört der Betrag? |
| `provisionspflichtig` | `true` · `false` | Fließt er in die Provisionsbemessung? |

Dass beide Achsen nötig sind, zeigen die drei realen Fälle:

| Gebühr | `gehoert_zu` | `provisionspflichtig` |
|---|---|---|
| Miete | `eigentuemer` | `true` |
| Nebenkosten | `eigentuemer` | **`false`** |
| Reinigung | **`betrieb`** | `false` |

Mit nur einer Achse ließen sich Nebenkosten und Reinigung nicht trennen: beide
sind provisionsfrei, aber das Geld geht an zwei verschiedene Parteien.
`durchlauf` ist die dritte Eigentümerschaft — Kurtaxe gehört der Gemeinde, die
Kaution dem Gast; beides ist weder Ertrag des Betriebs noch des Eigentümers.

**Zugeordnet wird je Gebühren*art*, nicht je Gebühren*zeile*.** Live stehen im
Kundenbestand 43 Gebühren-Zeilen, aber nur drei Arten (`cleaning_fee` 19×,
`resort` 15×, `pet_fee` 9×). Eine Zuordnung je Zeile wären 43 identische
Entscheidungen, die bei jedem neuen Objekt erneut anfielen. Braucht ein
einzelnes Objekt eine Abweichung, trägt die Zeile `property_id` — **Objekt
schlägt Betriebsregel**, dasselbe Vorrangprinzip wie `commission_override_pct`
vor `default_commission_pct`.

### Keine geratenen Bestandswerte

Die Migration füllt die Tabelle **nicht**. Es wäre naheliegend, `cleaning_fee`
per `insert` auf `betrieb` zu setzen — aber das ist die Vereinbarung *dieses*
Betriebs, und ein geratener Wert wäre in der Maske nicht als Rateergebnis
erkennbar. Die Agentur ordnet die vorhandenen Arten einmalig in der
Zuordnungsmaske zu. Die Maske **darf Vorschläge anzeigen**; die Bestätigung ist
die Entscheidung.

Fehlt eine Zuordnung, wirft `klassifikation_aufloesen` die Ausnahme
`KlassifikationFehlt` mit dem Namen der Gebührenart — gebaut nach dem Muster von
`owner_statements.common.PayoutUnbekannt`. Es gibt **keinen** Rückfall auf
„gehört wohl dem Eigentümer, ist wohl provisionspflichtig" (Wurzel 4).

## B) Abrechnungsvertrag (`owner_billing_terms`, 0343)

Eine eigene Konfigurationsebene neben `owners.default_commission_pct` und
`owner_properties.commission_override_pct`. Beide bleiben in dieser Etappe
führend und werden nicht angefasst.

* **Geltung**: `owner_id`, optional `property_id`. Objekt schlägt Eigentümer.
* **Zeitachse** `gueltig_ab` / `gueltig_bis`, halb offen `[ab, bis)`. Ohne sie
  rechnete ein im September erzeugtes Juli-Statement mit dem September-Satz —
  jede Vertragsänderung wäre ein rückwirkender Eingriff. Eine Ablösung ist
  deshalb ein **neuer** Vertrag, kein Überschreiben; die Historie bleibt
  sichtbar. Das halb offene Intervall macht den lückenlosen Anschluss
  eindeutig: der Nachfolger beginnt am Endtag des Vorgängers, kein Tag gehört
  zu beiden.
* **`provisions_pct`** — `not null` ohne Default.
* **Mindestprovision je Buchung** (`min_provision_betrag` + `_currency`).
  Unterschreitet die berechnete Provision den Betrag, gilt der Mindestbetrag.
  Anlass ist messbar: in den Echtdaten gibt es zwei Buchungen mit **negativer**
  bereinigter Basis, weil die pauschale Reinigungsgebühr bei einem
  Kurzaufenthalt größer ist als der Übernachtungsertrag. Ohne Mindestprovision
  ergäbe die Formel dort eine negative Provision.
* **Pauschale je Buchung** — **optional**, aber alles-oder-nichts: Betrag,
  Währung, `pauschale_basis` (`je_buchung` | `je_nacht`) und
  `pauschale_zeitpunkt` (`vor_provision` | `nach_provision`). Der Zeitpunkt ist
  keine Formalie: `vor_provision` verkleinert die Bemessungsgrundlage und damit
  auch die Provision.

Währungen stehen **explizit am Vertrag** und werden nicht vom Objekt abgeleitet:
50 DKK sind 50 DKK, auch wenn ein Objekt in EUR verkauft (Wurzel 4).

Überlappende Zeiträume sind auf DB-Ebene ausgeschlossen (`exclude using gist`
über `daterange`, je ein Constraint für Eigentümer- und Objekt-Verträge). Der
Service prüft zusätzlich vorab, um eine verständliche Meldung zu liefern; der
Constraint ist der Backstop für zwei gleichzeitige Anlagen (Wurzel 2).

## Sicherheit (Wurzel 6)

Beide Tabellen sind Finanztabellen: der Provisionssatz ist die Kernkondition
des Geschäfts, die Klassifikation sagt, welche Erträge der Betrieb behält.

* `enable rls` + permissive Tenant-Policy **und** `as restrictive for all`
* `revoke all … from anon, authenticated` — alle vier Rechte, beide Rollen
* **kein** Realtime-Abo; die Tabellen sind nicht in `supabase_realtime`

Gelesen und geschrieben wird ausschließlich per `service_role` durch die API.
Belegt durch `scripts/security/direktpfad-pruefen.sh` (acht Kombinationen je
Tabelle per echtem `set local role`).

## Endpunkte

| Methode | Pfad | Capability |
|---|---|---|
| GET | `/api/v1/owner-billing/fee-classification` | `MANAGE_PROPERTIES` |
| PUT | `/api/v1/owner-billing/fee-classification` | `MANAGE_PROPERTIES` |
| DELETE | `/api/v1/owner-billing/fee-classification/{id}` | `MANAGE_PROPERTIES` |
| GET | `/api/v1/owner-billing/owners/{owner_id}/terms` | `MANAGE_OWNERS` |
| POST | `/api/v1/owner-billing/owners/{owner_id}/terms` | `MANAGE_OWNERS` |
| PATCH | `/api/v1/owner-billing/terms/{terms_id}` | `MANAGE_OWNERS` |
| DELETE | `/api/v1/owner-billing/terms/{terms_id}` | `MANAGE_OWNERS` |

## Der spätere Umstieg der Rechenkette

Er ist bewusst **ein** Schritt und berührt diesen Slice nicht mehr. Die beiden
Auflösungs-Funktionen liegen fertig bereit:

```python
service.klassifikation_aufloesen(tenant_id, fee_type, property_id)
    -> (gehoert_zu, provisionspflichtig)     # oder KlassifikationFehlt
service.vertrag_aufloesen(tenant_id, owner_id, property_id, stichtag)
    -> Vertragszeile | None
```

`vertrag_aufloesen` bekommt den **Stichtag vom Aufrufer** (Check-out der
Buchung bzw. Ende des Abrechnungszeitraums) und benutzt nie `date.today()` —
sonst ergäbe dieselbe Abrechnung je nach Erzeugungstag eine andere Zahl.

Offen, bewusst nicht in dieser Etappe entschieden: ob die Reinigungsgebühr beim
Betrieb bleibt. Genau deshalb rät die Migration nichts.

### Nebenbefund `owners.default_commission_pct`

Die Spalte ist `numeric not null default 0`. Wer einen Eigentümer anlegt, ohne
einen Satz einzugeben, bekommt still 0 % Provision — der Eigentümer erhält
100 %, der Betrieb nichts. Ein bestehender Wurzel-4-Verstoß:
`common.effektive_provision_pct` würde bei `NULL` korrekt
`PayoutUnbekannt("provision")` werfen, nur kommt dort nie `NULL` an.

Nicht in dieser Etappe gefixt, weil sich die vorhandene `0` nicht deuten lässt
— sie kann „bewusst 0 % vereinbart" **oder** „nie ausgefüllt" heißen; ein
pauschales `update … set … = null where … = 0` zerstörte bewusste Nullsätze.
Die Bereinigung gehört an den Umstieg und läuft in drei Schritten, **ohne eine
einzige Bestandszeile zu ändern**:

1. `owner_billing_terms` wird führend. Dort ist `provisions_pct` `not null`
   ohne Default — die Lücke kann gar nicht erst entstehen.
2. Für jeden Eigentümer ohne Vertrag legt die Agentur in der Oberfläche einen
   an und bestätigt dabei den Satz (auch eine 0). Damit wird aus jeder unklaren
   `0` eine bestätigte Entscheidung.
3. Erst wenn jeder Eigentümer eines Betriebs einen Vertrag hat, verliert
   `owners.default_commission_pct` seine Rolle: Spalte auf nullable, Default
   entfernt, als Altbestand kommentiert.
