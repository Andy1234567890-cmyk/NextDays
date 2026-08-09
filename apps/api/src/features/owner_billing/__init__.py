"""owner_billing — Fundament der konfigurierbaren Eigentümer-Abrechnung.

Zwei Konfigurationsebenen, die zusammen die Abrechnung eines Betriebs
beschreiben, ohne dass eine einzige Zahl im Code steht:

* ``fee_classification`` — welche Gebührenart wem gehört und ob sie
  provisionspflichtig ist (zwei unabhängige Achsen).
* ``owner_billing_terms`` — der Abrechnungsvertrag je Eigentümer/Objekt mit
  Zeitachse, Mindestprovision und optionaler Pauschale.

Dieser Slice PFLEGT diese Konfiguration; er RECHNET nicht. Die Auszahlungs-
formel liegt weiterhin allein in ``owner_statements.common`` und ist in dieser
Etappe unverändert führend. Der Umstieg der Rechenkette auf diese Daten ist
eine eigene, abgegrenzte Etappe (siehe README).
"""
