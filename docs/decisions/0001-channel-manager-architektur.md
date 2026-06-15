# ADR-0001: Channel-Manager-Architektur — Direkt vs. Aggregator

- Status: **offen** (Entscheidung im/nach Call)
- Datum: TBD

## Kontext
NextDays muss Verfügbarkeit/Preise/Buchungen mit externen Portalen synchronisieren
(Booking.com, Airbnb, Vrbo/FeWo-direkt, regionale Portale).

## Optionen
### A) Direkt-Anbindung (Connectivity-Partnerprogramme)
- Pro: volle Kontrolle, keine laufenden Aggregator-Gebühren, bessere Marge, unabhängig.
- Contra: mehr Aufwand, Zertifizierung je Portal nötig, längere Time-to-Market.

### B) Aggregator / Zwischenschicht (z.B. Feondi)
- Pro: schneller (eine API statt vieler), viele kleine Portale gebündelt.
- Contra: laufende Kosten, Abhängigkeit, weniger Kontrolle, Marge sinkt.

## Empfehlung (vorläufig)
MVP ggf. mit Aggregator starten (Time-to-Market), langfristig Direkt-Anbindung der
großen Kanäle (Marge bei "billig + Masse"-Modell entscheidend). Adapter-Pattern hält
beide Wege offen → Entscheidung reversibel.

## Konsequenz
`channel_manager`-Slice mit einheitlichem Adapter-Interface; konkrete Adapter austauschbar.
