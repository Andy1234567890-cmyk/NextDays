// Der Kennzahlen-Block der Übersicht: vier Werte über EINEN Zeitraum-Umschalter
// (7 T · 30 T · 3 M · 12 M), wie im Web-Dashboard.
//
// Unterschied zum Web bewusst: dort trägt JEDE Kachel ihren eigenen Selektor,
// weil dort vier Selektoren nebeneinander Platz haben. Auf dem Telefon stehen
// die Kacheln übereinander — vier Umschalter wären vier Bedienelemente für
// dieselbe Frage, und der Blockkopf sagt dann nicht mehr, welcher Zeitraum
// gilt. Deshalb EIN Umschalter über allen vier, der alle vier nachlädt.
//
// Betrags-Kacheln (Umsatz, Umsatz je Buchung) erscheinen nur, wenn der erste
// Abruf sie geliefert hat: null heißt „dieser Nutzer darf keine Beträge sehen"
// (§4.2) — dann wird auch nicht nachgeladen, sonst wäre die Umschaltung ein
// zweiter Weg zu demselben Wert (Wurzel 9).
import { useCallback, useEffect, useRef, useState } from "react";

import { Trend } from "@/components/dashboard/Trend";
import {
  ZEITRAEUME,
  ZEITRAUM_TEXT,
  ZeitWahl,
} from "@/components/dashboard/ZeitWahl";
import { Card, Col, Divider, Row, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import {
  getDashboardKpi,
  type Dashboard,
  type DashboardKpi,
  type DashboardKpiMetrik,
  type Zeitraum,
} from "@/lib/dashboard";
import { useTheme } from "@/theme/ThemeProvider";

// Der Zeitraum, in dem die Übersicht ihre Erstwerte liefert (Backend:
// `core.zeitraum.STANDARD_ZEITRAUM`). Steht hier, damit der Umschalter mit dem
// Wert startet, der wirklich angezeigt wird — nicht mit einem geratenen.
const STANDARD_ZEITRAUM: Zeitraum = "30d";

// Eine Kennzahl in ihrem aktuellen Anzeigezustand. `kpi: null` heißt „für
// diesen Zeitraum gibt es den Wert nicht" (keine zahlende Buchung, gemischte
// Währungen) — dann steht „—" da, kein 0-Wert.
type Stand = { kpi: DashboardKpi | null; fehler: boolean };

function standAus(data: Dashboard): Record<DashboardKpiMetrik, Stand> {
  return {
    checkins: { kpi: data.checkins_30d, fehler: false },
    revenue: { kpi: data.revenue_30d, fehler: false },
    revenue_per_booking: { kpi: data.revenue_per_booking_30d, fehler: false },
    confirmed: { kpi: data.confirmed_30d, fehler: false },
  };
}

export function KennzahlenAbschnitt({ data }: { data: Dashboard }) {
  const t = useTheme();
  const [zeitraum, setZeitraum] = useState<Zeitraum>(STANDARD_ZEITRAUM);
  const [laedt, setLaedt] = useState(false);
  const [currency, setCurrency] = useState(data.currency);
  const [stand, setStand] = useState<Record<DashboardKpiMetrik, Stand>>(() =>
    standAus(data),
  );

  // Welche Betrags-Kacheln es für diesen Nutzer überhaupt gibt — aus der
  // Grundantwort, nicht aus dem laufenden Stand: ein Zeitraum ohne zahlende
  // Buchung liefert `null`, und die Kachel darf davon nicht verschwinden.
  const zeigtUmsatz = data.revenue_30d !== null;
  const zeigtUmsatzJeBuchung = data.revenue_per_booking_30d !== null;

  // Nur die JÜNGSTE Anfrage darf schreiben. Zwei Wechsel in Folge (oder ein
  // Realtime-Ereignis mitten im Wechsel) liefern in unbestimmter Reihenfolge —
  // ohne diesen Zähler überschreibt die langsamere Antwort die neuere und die
  // Kachel zeigt Zahlen eines Zeitraums, der nicht mehr gewählt ist (Wurzel 2).
  const lauf = useRef(0);

  // Nach außen synchron: gerufen wird aus einem Ereignis-Handler und aus einem
  // Effekt, die beide mit einem Promise nichts anfangen können. Der Lauf steckt
  // deshalb in einer inneren Funktion, deren Ergebnis niemand braucht — die
  // Abbruchbedingung ist der Zähler oben, nicht ein `await` beim Aufrufer.
  const laden = useCallback(
    (ziel: Zeitraum): void => {
      const lauf_ = async () => {
        const meins = (lauf.current += 1);
        setLaedt(true);
        const metriken: DashboardKpiMetrik[] = [
          "checkins",
          "confirmed",
          ...(zeigtUmsatz ? (["revenue"] as DashboardKpiMetrik[]) : []),
          ...(zeigtUmsatzJeBuchung
            ? (["revenue_per_booking"] as DashboardKpiMetrik[])
            : []),
        ];
        const antworten = await Promise.all(
          metriken.map((m) => getDashboardKpi(m, ziel)),
        );
        if (lauf.current !== meins) return;
        setStand((alt) => {
          const naechster = { ...alt };
          metriken.forEach((m, i) => {
            const a = antworten[i];
            if (!a.ok) {
              // Der Grund gehört protokolliert: in der Kachel steht nur „Nicht
              // geladen" — mehr passt dort nicht, und ohne Log wäre der Fehler
              // damit verschwunden.
              console.warn(
                `[dashboard] Kennzahl "${m}" (${ziel}) nicht geladen: ${a.error}`,
              );
            }
            naechster[m] = a.ok
              ? { kpi: a.data.kpi, fehler: false }
              : // Kein Stehenlassen des alten Werts unter dem neuen Zeitraum:
                // das wäre eine Zahl, die nichts von dem misst, was daneben
                // steht (Wurzel 5 — nicht verschlucken).
                { kpi: null, fehler: true };
          });
          return naechster;
        });
        // Die Währung kommt aus der Antwort mit — ein Betrag ohne die Währung,
        // in der er gerechnet wurde, ist keine Aussage (Wurzel 4). Die erste
        // erfolgreiche Antwort genügt: alle vier rechnen im selben Tenant.
        const mitWaehrung = antworten.find((a) => a.ok && a.data.currency);
        if (mitWaehrung?.ok) setCurrency(mitWaehrung.data.currency);
        setLaedt(false);
      };
      lauf_();
    },
    [zeigtUmsatz, zeigtUmsatzJeBuchung],
  );

  const wechsel = useCallback(
    (neu: Zeitraum) => {
      setZeitraum(neu);
      laden(neu);
    },
    [laden],
  );

  // Neue Grunddaten (Realtime-Ereignis, Herunterziehen): sie tragen NUR den
  // Standard-Zeitraum. Steht der Umschalter woanders, wären sie die falsche
  // Zahl unter der richtigen Überschrift — dann werden die gewählten Werte neu
  // geholt statt die 30-Tage-Zahlen eingesetzt.
  const ersteDaten = useRef(true);
  useEffect(() => {
    if (ersteDaten.current) {
      ersteDaten.current = false;
      return;
    }
    if (zeitraum === STANDARD_ZEITRAUM) {
      lauf.current += 1; // eine noch laufende Anfrage darf nicht mehr schreiben
      setStand(standAus(data));
      setCurrency(data.currency);
      return;
    }
    laden(zeitraum);
    // `zeitraum`/`laden` bewusst NICHT als Auslöser: der Wechsel lädt schon
    // selbst, ein zweiter Lauf hier wäre derselbe Abruf doppelt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const zahl = (s: Stand) => (s.kpi === null ? "—" : `${Math.round(s.kpi.value)}`);
  const betrag = (s: Stand) =>
    s.kpi === null ? "—" : formatCurrency(s.kpi.value, currency);

  return (
    <Card style={{ padding: 16 }}>
      <Col gap={14}>
        <Row style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Txt v="eyebrow" soft numberOfLines={1} style={{ flex: 1 }}>
            {ZEITRAUM_TEXT[zeitraum]}
          </Txt>
          <ZeitWahl
            optionen={ZEITRAEUME}
            wert={zeitraum}
            onWechsel={wechsel}
            laedt={laedt}
            label="Auswertungszeitraum der Kennzahlen"
          />
        </Row>

        {/* Eine Karte, ein Zeitraum, vier Zahlen. Vorher trug jede Zahl ihren
            eigenen Rahmen — vier Kästen übereinander, alle gleich laut, und der
            Zeitraum stand über dem ersten. Die Leitzahl (Umsatz) steht jetzt
            groß, die drei Nebenzahlen in einer Reihe darunter. Fehlt die
            Betrags-Sicht (§4.2), entfallen die Betragszahlen ersatzlos — kein
            0-Betrag. */}
        {zeigtUmsatz && (
          <Col gap={3}>
            <Txt v="xs" soft>
              Umsatz
            </Txt>
            {stand.revenue.fehler ? (
              <Txt v="h2" color={t.palette.accent}>
                Nicht geladen
              </Txt>
            ) : (
              <>
                <Txt v="display" numberOfLines={1}>
                  {betrag(stand.revenue)}
                </Txt>
                <Trend change={stand.revenue.kpi?.change_pct ?? null} />
              </>
            )}
          </Col>
        )}

        <Divider />

        <Row gap={12} style={{ alignItems: "flex-start" }}>
          {zeigtUmsatzJeBuchung && (
            <Nebenzahl
              label="Je Buchung"
              wert={betrag(stand.revenue_per_booking)}
              change={stand.revenue_per_booking.kpi?.change_pct ?? null}
              fehler={stand.revenue_per_booking.fehler}
            />
          )}
          <Nebenzahl
            label="Check-ins"
            wert={zahl(stand.checkins)}
            change={stand.checkins.kpi?.change_pct ?? null}
            fehler={stand.checkins.fehler}
          />
          <Nebenzahl
            label="Bestätigt"
            wert={zahl(stand.confirmed)}
            change={stand.confirmed.kpi?.change_pct ?? null}
            fehler={stand.confirmed.fehler}
          />
        </Row>
      </Col>
    </Card>
  );
}

// Eine der drei Nebenzahlen. Kleiner gesetzt als die Leitzahl und ohne eigenen
// Rahmen: sie gehören zusammen und werden in einem Blick gelesen.
function Nebenzahl({
  label,
  wert,
  change,
  fehler,
}: {
  label: string;
  wert: string;
  change: number | null;
  fehler: boolean;
}) {
  const t = useTheme();
  return (
    <Col gap={2} style={{ flex: 1 }}>
      <Txt v="xs" soft numberOfLines={1}>
        {label}
      </Txt>
      {fehler ? (
        <Txt v="sm" color={t.palette.accent}>
          —
        </Txt>
      ) : (
        <>
          <Txt v="h2" numberOfLines={1}>
            {wert}
          </Txt>
          <Trend change={change} />
        </>
      )}
    </Col>
  );
}
