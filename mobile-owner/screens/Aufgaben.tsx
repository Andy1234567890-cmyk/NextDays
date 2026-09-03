// Meine Aufgaben — was die Verwaltung dem Eigentümer zugewiesen hat
// (`GET /public-portal/tasks`, `POST …/start`, `POST …/complete`).
//
// WARUM ES DIESEN SCREEN GIBT (03.09.2026): Manche Eigentümer reinigen oder
// empfangen selbst. Die Verwaltung wählt sie dafür im Aufgaben-Popup unter
// „Zuständig" aus — und der Eigentümer muss das SEHEN und zurückmelden können,
// im Portal UND in dieser App. Ohne diesen Screen wäre die Zuweisung eine ins
// Nichts; genau deshalb waren Eigentümer bis heute bewusst aus der Auswahl
// entfernt (11 Aufgaben lagen auf Konten, die sie nie öffnen konnten).
//
// Der Server liefert AUSSCHLIESSLICH Aufgaben, die dem Eigentümer zugewiesen
// sind und an seinen Objekten hängen — nicht die des Personals an seinem Haus
// (§4.3). Kein Zuständiger, keine Kosten im Contract (§4.2).
//
// IDEMPOTENZ (Wurzel 2): je Aufgabe höchstens eine laufende Aktion; der Knopf
// sperrt, solange die Anfrage läuft.
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Btn, Kachel, KachelKopf, Spinner, Txt } from "@/components/ui/kit";
import {
  completeOwnerTask,
  getOwnerTasks,
  type PortalTask,
  startOwnerTask,
} from "@/lib/ownerPortal";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

const ABGESCHLOSSEN = new Set(["done", "cancelled"]);

// Die Arbeitszustände des Servers. Ein neuer Code gehört HIER dazu, sonst
// steht er roh in der Liste.
const STATUS: Record<string, string> = {
  open: "Offen",
  accepted: "Angenommen",
  in_progress: "In Arbeit",
  done: "Erledigt",
  cancelled: "Storniert",
};

export function statusName(code: string): string {
  return STATUS[code] ?? code;
}

function zwei(n: number): string {
  return String(n).padStart(2, "0");
}

/** „13.09., 10:00 – 14:00" in der Zeit des Geräts; über Mitternacht mit
 *  zweitem Datum. Kein `toLocaleString`: das liefert je Gerät andere Formen. */
export function zeitfensterText(start: string | null, ende: string | null): string {
  if (!start) return "Kein Zeitfenster";
  const a = new Date(start);
  const tag = (d: Date) => `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.`;
  const uhr = (d: Date) => `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
  const von = `${tag(a)}, ${uhr(a)}`;
  if (!ende) return von;
  const b = new Date(ende);
  const gleicherTag =
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  return gleicherTag ? `${von} – ${uhr(b)}` : `${von} – ${tag(b)}, ${uhr(b)}`;
}

/** Offene oben, erledigte darunter — aus EINER Antwort. */
export function aufteilen(items: PortalTask[]): {
  offen: PortalTask[];
  erledigt: PortalTask[];
} {
  return {
    offen: items.filter((x) => !ABGESCHLOSSEN.has(x.status)),
    erledigt: items.filter((x) => ABGESCHLOSSEN.has(x.status)),
  };
}

export default function Aufgaben() {
  const t = useTheme();
  const [items, setItems] = useState<PortalTask[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await getOwnerTasks();
    if (res.ok) {
      setItems(res.data.items);
      setFehler(null);
    } else {
      // „leer" und „konnte nicht laden" sind zwei Aussagen (Wurzel 5).
      setFehler(res.error);
    }
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const uebernehmen = (neu: PortalTask) =>
    setItems((l) => l.map((x) => (x.id === neu.id ? neu : x)));

  const anfangen = async (id: string) => {
    setAktiv(id);
    setMeldung(null);
    const res = await startOwnerTask(id);
    setAktiv(null);
    if (!res.ok) return setMeldung(res.error);
    uebernehmen(res.data);
  };

  const abschliessen = async (id: string) => {
    setAktiv(id);
    setMeldung(null);
    const res = await completeOwnerTask(id);
    setAktiv(null);
    // Die Foto-Pflicht kommt als 422 mit Klartext — sichtbar, nicht stumm.
    if (!res.ok) return setMeldung(res.error);
    uebernehmen(res.data);
  };

  const { offen, erledigt } = aufteilen(items);

  const karte = (a: PortalTask, offenAufgabe: boolean) => (
    <Kachel key={a.id}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt v="title" style={{ flex: 1 }}>
          {a.title}
        </Txt>
        <Txt v="xs" soft>
          {statusName(a.status)}
        </Txt>
      </View>
      <View style={{ marginTop: 6, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon n="home" s={14} c={t.palette.faint} />
          <Txt v="xs" soft>
            {a.property_title ?? "—"}
          </Txt>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon n="clock" s={14} c={t.palette.faint} />
          <Txt v="xs" soft>
            {zeitfensterText(a.start_at, a.end_at)}
          </Txt>
        </View>
        {a.checklist_total > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon n="list" s={14} c={t.palette.faint} />
            <Txt v="xs" soft>
              Checkliste {a.checklist_done}/{a.checklist_total}
            </Txt>
          </View>
        ) : null}
      </View>
      {offenAufgabe ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {a.status === "open" || a.status === "accepted" ? (
            <Btn
              variant="outline"
              onPress={() => void anfangen(a.id)}
              disabled={aktiv === a.id}
              style={{ flex: 1 }}
            >
              Anfangen
            </Btn>
          ) : null}
          <Btn
            onPress={() => void abschliessen(a.id)}
            disabled={aktiv === a.id}
            style={{ flex: 1 }}
          >
            Erledigt melden
          </Btn>
        </View>
      ) : null}
    </Kachel>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => void laden()} />
      }
    >
      <Txt v="xs" soft>
        Aufgaben, die die Verwaltung Ihnen an Ihren Objekten zugewiesen hat.
        Melden Sie zurück, wenn Sie anfangen und wenn Sie fertig sind.
      </Txt>

      {fehler ? (
        <Kachel>
          <Txt v="xs" style={{ color: t.palette.accent }}>
            {fehler}
          </Txt>
        </Kachel>
      ) : null}
      {meldung ? (
        <Kachel>
          <Txt v="xs" style={{ color: t.palette.accent }}>
            {meldung}
          </Txt>
        </Kachel>
      ) : null}

      <Kachel pad={0}>
        <KachelKopf titel="Offen" />
      </Kachel>
      {laedt ? (
        <Spinner />
      ) : offen.length === 0 ? (
        <Kachel>
          <Txt v="xs" soft>
            Ihnen ist aktuell keine Aufgabe zugewiesen.
          </Txt>
        </Kachel>
      ) : (
        offen.map((a) => karte(a, true))
      )}

      <Kachel pad={0}>
        <KachelKopf titel="Erledigt" />
      </Kachel>
      {!laedt && erledigt.length === 0 ? (
        <Kachel>
          <Txt v="xs" soft>
            Noch nichts erledigt.
          </Txt>
        </Kachel>
      ) : (
        erledigt.map((a) => karte(a, false))
      )}
    </ScrollView>
  );
}
