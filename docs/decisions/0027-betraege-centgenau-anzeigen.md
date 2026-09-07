# ADR-0027: Beträge werden centgenau angezeigt — glatte Beträge nur im Raster

- Status: **akzeptiert**
- Datum: 2026-09-07
- Ersetzt: [ADR-0005](0005-waehrungs-rundungs-policy.md) (glatte Beträge überall)

## Kontext

Lastenheft §1 und ADR-0005 verlangen systemweit glatte Beträge ohne Cent/Øre.
Umgesetzt wurde das nie flächig: `packages/currency` formatiert mit zwei
Nachkommastellen, nur 11 von 235 Aufrufstellen runden. Der Kalender rundet
seit `calendar-board.tsx` bewusst NICHT mehr — ein gerundetes „119 €" neben
„118,68 €" im Rate-Grid las sich als Fehler in der Preisführung. Die Portale
(Airbnb, Booking.com über Channex), Stripe und die Eigentümer-Abrechnung
rechnen und zeigen centgenau; ein gerundeter Anzeigewert neben dem exakten
Portal-Wert erzeugt Rückfragen, keine Klarheit.

## Entscheidung

- **Beträge (Preise, Rechnungen, Auszahlungen, Provisionen, Gebühren) werden
  centgenau angezeigt**, mit `formatCurrency(..., 2)` aus `packages/currency`
  bzw. `lib/currency`; Speicherung bleibt `numeric(12,2)`.
- **Glatte Zahlen nur in kompakten Rastern**, in denen die Zahl eine Orientierung
  und kein Betrag ist: Tagespreis in der Kalender-/Dynamic-Pricing-Zelle
  (`fractionDigits: 0`, ohne Währungssymbol). Der Tooltip/Detail daneben zeigt
  den exakten Wert.
- **Eingabe** von Preisen erlaubt Nachkommastellen; ein Betrieb, der glatte
  Preise will, gibt sie glatt ein (Saison-/Grundpreise sind ohnehin ganze
  Beträge in der Praxis).
- Rundung an Schnittstellen: der exakte Wert wird übertragen, nie ein gerundeter
  Anzeigewert (unverändert aus ADR-0005).

## Konsequenzen

- Lastenheft §1 „Verbot von Cent-Darstellungen" ist aufgehoben; bei der nächsten
  Lastenheft-Revision streichen.
- Keine dritte Formatierungskopie; wer rundet, tut es über den
  `fractionDigits`-Parameter, nicht über eigene `toFixed`-Logik.
