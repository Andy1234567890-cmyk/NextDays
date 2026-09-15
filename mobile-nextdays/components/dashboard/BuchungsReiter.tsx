// EIN Listenbereich mit Reitern statt fünf gestapelter Blöcke.
//
// Vorher stand auf der Übersicht fünfmal derselbe Aufbau untereinander
// (Freigabe, Anreisen, Abreisen, Im Haus, Anstehend) — jeder mit Überschrift,
// Zähler, Zeitfenster und Liste. Das ist die Web-Seite eins zu eins übertragen
// und am Telefon eine Kachelwand ohne Hierarchie: man scrollt an vier Blöcken
// vorbei, um den fünften zu sehen, und weiß nie, wie viel noch kommt.
//
// Lodgify löst dasselbe in seiner App mit Reitern über EINER Liste
// („Next arrivals · Next departures · Currently staying"), Hostaway ebenso in
// Posteingang und Aufgaben. Der Reiter trägt seinen Zähler mit — welche Liste
// Arbeit enthält, ist damit ohne Scrollen zu sehen.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { BuchungsZeile } from "@/components/dashboard/BuchungsZeile";
import { FENSTER, ZeitWahl } from "@/components/dashboard/ZeitWahl";
import { Icon } from "@/components/ui/Icon";
import { Card, Col, Divider, Row, Txt } from "@/components/ui/kit";
import {
  getDashboardListe,
  type Dashboard,
  type DashboardEntry,
  type DashboardFenster,
  type DashboardListe,
} from "@/lib/dashboard";
import { useTheme } from "@/theme/ThemeProvider";

// Wie viele Zeilen je Reiter sichtbar sind. „Anstehend" umfasst beim echten
// Betrieb dreistellig viele Buchungen — die alle zu rendern ist weder lesbar
// noch flüssig. Der Rest führt in die Buchungsliste.
const MAX_ZEILEN = 6;

type ReiterDef = {
  liste: DashboardListe;
  titel: string;
  standardFenster: DashboardFenster;
  datumsfeld: "check_in" | "check_out";
  leer: string;
};

// Reihenfolge nach dem Tagesablauf: wer geht, wer kommt, wer da ist, was noch
// aussteht. „Freigabe nötig" steht NICHT hier — offene Anfragen sind eine
// Handlung, keine Tagesliste, und stehen als Hinweis über diesem Bereich.
const REITER: ReiterDef[] = [
  {
    liste: "checkins",
    titel: "Anreisen",
    standardFenster: "heute",
    datumsfeld: "check_in",
    leer: "Heute reist niemand an.",
  },
  {
    liste: "checkouts",
    titel: "Abreisen",
    standardFenster: "heute",
    datumsfeld: "check_out",
    leer: "Heute reist niemand ab.",
  },
  {
    liste: "im_haus",
    titel: "Im Haus",
    standardFenster: "heute",
    datumsfeld: "check_out",
    leer: "Aktuell ist niemand im Haus.",
  },
  {
    liste: "upcoming",
    titel: "Anstehend",
    standardFenster: "alle",
    datumsfeld: "check_in",
    leer: "Nichts Anstehendes.",
  },
];

/** Der Stand eines Reiters: was gezeigt wird, wie viele es sind, welches Fenster. */
type Stand = {
  zeilen: DashboardEntry[];
  gesamt: number;
  fenster: DashboardFenster;
  fehler: string | null;
};

function standAus(data: Dashboard): Record<DashboardListe, Stand> {
  return {
    // Die Heute-Listen liefert die Grundabfrage ungedeckelt — dort IST die Länge
    // die Anzahl. `upcoming`/`im_haus`/`freigabe` schneiden bei 50 ab und
    // schicken ihre echte Zahl getrennt mit (Wurzel 4: `length` wäre dort das
    // Limit und nicht der Bestand).
    checkins: {
      zeilen: data.checkins_today,
      gesamt: data.checkins_today.length,
      fenster: "heute",
      fehler: null,
    },
    checkouts: {
      zeilen: data.checkouts_today,
      gesamt: data.checkouts_today.length,
      fenster: "heute",
      fehler: null,
    },
    im_haus: {
      zeilen: data.im_haus,
      gesamt: data.im_haus_gesamt,
      fenster: "heute",
      fehler: null,
    },
    upcoming: {
      // Chronologisch, nicht in Antwortreihenfolge — sonst steht in „die
      // nächsten sechs" irgendetwas aus dem Herbst.
      zeilen: [...data.upcoming].sort((a, b) => a.check_in.localeCompare(b.check_in)),
      gesamt: data.upcoming_gesamt,
      fenster: "alle",
      fehler: null,
    },
    freigabe: {
      zeilen: data.freigabe_noetig,
      gesamt: data.freigabe_gesamt,
      fenster: "alle",
      fehler: null,
    },
  };
}

export function BuchungsReiter({
  data,
  // Wechselt der Zähler, hat die Übersicht neue Grunddaten geliefert. Ohne
  // dieses Signal zeigten die Reiter den Stand ihres Erstabrufs weiter,
  // während die Zahlen darüber sich ändern.
  datenVersion,
  onZeile,
  onNachrichten,
  onAlle,
}: {
  data: Dashboard;
  datenVersion: number;
  onZeile: (reservationId: string) => void;
  onNachrichten: (threadId: string) => void;
  onAlle: () => void;
}) {
  const t = useTheme();
  const [aktiv, setAktiv] = useState<DashboardListe>("checkins");
  const [stand, setStand] = useState<Record<DashboardListe, Stand>>(() =>
    standAus(data),
  );
  const [laedt, setLaedt] = useState(false);

  // Nur die jüngste Anfrage darf schreiben: zwei Fensterwechsel in Folge
  // liefern in unbestimmter Reihenfolge, und die langsamere Antwort würde die
  // neuere überschreiben (Wurzel 2).
  const lauf = useRef(0);

  const laden = useCallback(
    (liste: DashboardListe, fenster: DashboardFenster): void => {
      const lauf_ = async () => {
        const meins = (lauf.current += 1);
        setLaedt(true);
        const antwort = await getDashboardListe(liste, fenster);
        if (lauf.current !== meins) return;
        setStand((alt) => ({
          ...alt,
          [liste]: antwort.ok
            ? {
                zeilen: antwort.data.items,
                gesamt: antwort.data.gesamt,
                fenster,
                fehler: null,
              }
            : // Gesagt statt verschluckt: den alten Inhalt unter dem neuen
              // Fenster stehen zu lassen wäre die plausible Falschaussage
              // (Wurzel 5).
              { zeilen: [], gesamt: 0, fenster, fehler: antwort.error },
        }));
        if (!antwort.ok) {
          console.warn(
            `[dashboard] Liste "${liste}" (${fenster}) nicht geladen: ${antwort.error}`,
          );
        }
        setLaedt(false);
      };
      lauf_();
    },
    [],
  );

  // Frische Grunddaten: Reiter, die noch auf ihrem Standard-Fenster stehen,
  // übernehmen sie direkt; wer ein anderes Fenster gewählt hat, holt es neu —
  // die Grundabfrage kennt nur den Standard.
  const ersteDaten = useRef(true);
  useEffect(() => {
    if (ersteDaten.current) {
      ersteDaten.current = false;
      return;
    }
    const frisch = standAus(data);
    lauf.current += 1; // laufende Anfragen dürfen nicht mehr schreiben
    setStand((alt) => {
      const naechster = { ...frisch };
      (Object.keys(alt) as DashboardListe[]).forEach((k) => {
        const eigenes = alt[k];
        if (eigenes.fenster !== frisch[k].fenster) {
          // Fenster abweichend → alten Stand halten und neu holen, statt
          // stillschweigend die Heute-Zahlen unter „Nächste 30 Tage" zu setzen.
          naechster[k] = eigenes;
          laden(k, eigenes.fenster);
        }
      });
      return naechster;
    });
    // Nur die Datenversion löst aus: `data` ist bei jedem Elternrender neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datenVersion]);

  const s = stand[aktiv];
  const def = REITER.find((r) => r.liste === aktiv) as ReiterDef;
  const sichtbar = s.zeilen.slice(0, MAX_ZEILEN);
  const rest = s.gesamt - sichtbar.length;

  return (
    <Col gap={12}>
      {/* Reiter mit Zähler. Waagerecht scrollbar, damit auch auf schmalen
          Geräten kein Titel abgeschnitten wird. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {REITER.map((r) => {
          const an = r.liste === aktiv;
          const zahl = stand[r.liste].gesamt;
          return (
            <Pressable
              key={r.liste}
              accessibilityRole="tab"
              accessibilityState={{ selected: an }}
              accessibilityLabel={`${r.titel}, ${zahl}`}
              onPress={() => setAktiv(r.liste)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: t.radius.pill,
                // Der aktive Reiter trägt die MARKENFARBE, nicht Schwarz.
                // Vorher war er schwarz auf weißem Grund: Auf dem ganzen
                // Bildschirm kam die Marke damit nur im Logo und am aktiven
                // Tab-Symbol vor, und die Übersicht las sich als reine
                // Graustufen-Seite. Die inaktiven liegen jetzt auf `surface`
                // (Weiß) statt auf „transparent" — seit der Grund getönt ist,
                // wäre transparent eine graue, eingedrückt wirkende Pille.
                backgroundColor: an ? t.palette.accent : t.palette.surface,
                borderWidth: an ? 0 : 1,
                borderColor: t.palette.line,
                opacity: pressed && !an ? 0.6 : 1,
              })}
            >
              <Txt
                v="sm"
                color={an ? t.palette.accentInk : t.palette.ink}
                style={{ fontFamily: t.fonts.semibold }}
              >
                {r.titel}
              </Txt>
              {/* Die Zahl gehört an den Reiter: sonst muss man jeden einzeln
                  antippen, um zu sehen, wo Arbeit liegt. */}
              <Txt v="xs" color={an ? t.palette.accentInk : t.palette.soft}>
                {stand[r.liste].fehler ? "—" : zahl}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Nur der Umschalter, keine zweite Zeitangabe daneben: „Nur heute" links
          und „Heute" rechts wäre dieselbe Aussage doppelt. */}
      <Row style={{ justifyContent: "flex-end" }}>
        <ZeitWahl
          optionen={FENSTER}
          wert={s.fenster}
          onWechsel={(neu) => laden(aktiv, neu)}
          laedt={laedt}
          label={`Zeitfenster für ${def.titel}`}
        />
      </Row>

      {s.fehler ? (
        <Col gap={2}>
          <Txt v="body" color={t.palette.accent}>
            Liste nicht geladen.
          </Txt>
          <Txt v="xs" soft>
            {s.fehler}
          </Txt>
        </Col>
      ) : sichtbar.length === 0 ? (
        <Txt v="body" soft>
          {def.leer}
        </Txt>
      ) : (
        <Card>
          {sichtbar.map((e, i) => (
            <View key={e.reservation_id}>
              {i > 0 && <Divider />}
              <BuchungsZeile
                eintrag={e}
                datumsfeld={def.datumsfeld}
                onPress={() => onZeile(e.reservation_id)}
                onNachrichten={onNachrichten}
              />
            </View>
          ))}
          {rest > 0 && (
            <>
              <Divider />
              <Pressable
                accessibilityRole="button"
                onPress={onAlle}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Row gap={6} style={{ alignItems: "center", justifyContent: "center" }}>
                  <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                    Weitere {rest} in den Buchungen
                  </Txt>
                  <Icon n="fwd" s={14} sw={2} c={t.palette.ink} />
                </Row>
              </Pressable>
            </>
          )}
        </Card>
      )}
    </Col>
  );
}
