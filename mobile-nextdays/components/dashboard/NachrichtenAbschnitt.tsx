// Der Nachrichten-Block der Übersicht: gesendet, empfangen und Automation,
// jeweils Summe und Tagesschnitt — dieselben sechs Kacheln, die das
// Web-Dashboard unter `nachricht:*` führt.
//
// Bis zum 15.09.2026 gab es ihn hier nicht, und in `lib/inbox.ts` stand das
// ausdrücklich als Entscheidung („eine Auswertung, kein Handlungsobjekt am
// Telefon"). Die Entscheidung ist umgekehrt: Die App soll die Kacheln des
// Web-Dashboards tragen. Der Hinweis dort ist mitgeändert, damit niemand
// diesen Block später als Versehen wieder entfernt.
//
// EIN Zeitraum-Umschalter über dem ganzen Block, nicht einer je Zahl —
// dieselbe Abwägung wie im `KennzahlenAbschnitt`: Auf dem Telefon stehen die
// Zahlen untereinander, und sechs Umschalter wären sechs Bedienelemente für
// dieselbe Frage.
//
// NUR mit `pm_chat`. Ohne die Berechtigung antwortet `/inbox/kennzahlen` mit
// 403; der Aufrufer fragt dann gar nicht erst, statt einen erwartbaren Fehler
// zu erzeugen und ihn als Ergebnis anzuzeigen (Wurzel 5). Die Prüfung steht
// im Dashboard, wo `me` ohnehin liegt — hier nicht doppelt.
import { useCallback, useEffect, useRef, useState } from "react";

import { StatGitter, type Stat } from "@/components/dashboard/Statzahl";
import { Icon } from "@/components/ui/Icon";
import { ZEITRAEUME, ZeitWahl } from "@/components/dashboard/ZeitWahl";
import { Card, Col, Divider, Row, Txt } from "@/components/ui/kit";
import {
  getNachrichtenKennzahlen,
  type NachrichtenKennzahl,
  type NachrichtenKennzahlen,
} from "@/lib/inbox";
import type { Zeitraum } from "@/lib/dashboard";
import { useTheme } from "@/theme/ThemeProvider";

const STANDARD_ZEITRAUM: Zeitraum = "30d";

/**
 * Der Tagesschnitt mit einer Nachkommastelle.
 *
 * Gerundet wird NUR für die Anzeige; gerechnet hat der Server. „0,4 Ø/Tag" ist
 * eine andere Aussage als „0" — auf ganze Zahlen zu runden hiesse, seltenen
 * Verkehr als gar keinen auszugeben (Wurzel 4).
 */
function schnitt(wert: number): string {
  return wert.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function zahl(wert: number): string {
  return wert.toLocaleString("de-DE");
}

export function NachrichtenAbschnitt() {
  const t = useTheme();
  const [zeitraum, setZeitraum] = useState<Zeitraum>(STANDARD_ZEITRAUM);
  const [daten, setDaten] = useState<NachrichtenKennzahlen | null>(null);
  const [fehler, setFehler] = useState(false);
  const [laedt, setLaedt] = useState(true);

  // Nur die JÜNGSTE Anfrage darf schreiben. Zwei Wechsel in Folge liefern in
  // unbestimmter Reihenfolge — ohne diesen Zähler überschreibt die langsamere
  // Antwort die neuere, und der Block zeigt Zahlen eines Zeitraums, der nicht
  // mehr gewählt ist (Wurzel 2). Dieselbe Sperre wie im KennzahlenAbschnitt.
  const lauf = useRef(0);

  const laden = useCallback(async (z: Zeitraum) => {
    const meins = ++lauf.current;
    setLaedt(true);
    const res = await getNachrichtenKennzahlen(z);
    if (meins !== lauf.current) return;
    setLaedt(false);
    if (res.ok) {
      setDaten(res.data);
      setFehler(false);
    } else {
      setFehler(true);
    }
  }, []);

  useEffect(() => {
    laden(zeitraum);
  }, [laden, zeitraum]);

  // Beim ersten Laden KEINE Platzhalterzahlen: Nullen wären von einem echten
  // ruhigen Zeitraum nicht zu unterscheiden (Wurzel 4).
  if (!daten && laedt) return null;

  // Ein Fehler wird benannt, nicht als leerer Block verschwiegen — sonst sieht
  // ein Ausfall aus wie „keine Nachrichten".
  if (!daten) {
    return (
      <Card style={{ padding: 16 }}>
        <Col gap={6}>
          <Txt v="eyebrow" soft>
            NACHRICHTEN
          </Txt>
          <Txt v="sm" color={t.palette.accent}>
            {fehler ? "Nicht geladen." : "Keine Angaben."}
          </Txt>
        </Col>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 16 }}>
      <Col gap={14}>
        <Row style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Icon n="chat" s={16} sw={2} c={t.palette.faint} />
          <Txt v="eyebrow" soft style={{ flex: 1 }}>
            NACHRICHTEN
          </Txt>
          <ZeitWahl
            optionen={ZEITRAEUME}
            wert={zeitraum}
            onWechsel={setZeitraum}
            laedt={laedt}
            label="Zeitraum der Nachrichten-Kennzahlen"
          />
        </Row>

        <StatGitter
          stats={[
            durchsatz("Gesendet", daten.gesendet),
            durchsatz("Empfangen", daten.empfangen),
            durchsatz("Automation", daten.automation),
          ]}
        />

        <Divider />

        {/* Die offenen Konversationen stehen als LETZTES, ohne Trend und in
            einer Zeile statt als vierte Spalte: Sie sind ein Ist-Stand, keine
            Durchsatzzahl — ein „+40 % ungelesen" gegenüber der Vorperiode wäre
            eine Aussage, die der Server für diesen Wert gar nicht liefert.
            Als Zeile, weil eine einzelne große Zahl unter drei Spalten eine
            halbe leere Karte hinterließ. */}
        <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <Txt v="sm" soft>
            Offene Konversationen
          </Txt>
          <Txt v="title">{zahl(daten.ungelesen)}</Txt>
        </Row>
      </Col>
    </Card>
  );
}

/** Eine Durchsatzzahl als `Stat`: Summe, Tagesschnitt, Vergleich. */
function durchsatz(label: string, k: NachrichtenKennzahl): Stat {
  return {
    label,
    wert: zahl(k.value),
    neben: `${schnitt(k.per_day)} Ø/Tag`,
    trend: k.change_pct,
  };
}
