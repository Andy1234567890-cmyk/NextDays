// Eine Aufgabe als Karte — EINE Darstellung für Liste und Aufgaben-Kalender.
//
// Aufbau nach der Referenz-App (Breezeway „Tasks"): Kopfzeile mit Zeitfenster
// links und Statusfeld rechts, darunter der vollständige Titel, dann Objekt und
// Buchungsreferenz, der Zuständige, der Checklisten-Fortschritt und — sofern
// bekannt — der Wechsel des Tages („Abreise · Anreise"). Der linke Farbstreifen
// trägt die Bedeutung (`lib/aufgabenstatus`), wie der Statusbalken in Turno.
//
// §4.3: hier steht NIE ein Gastname, eine Adresse oder ein Betrag — die Karte
// sieht auch die Reinigungskraft. `reservation_ref` ist die Portal-Referenz,
// die das Backend bewusst dafür mitgibt.
import { Pressable, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Chip, Col, Progress, Row, Txt } from "@/components/ui/kit";
import { istUeberfaellig, zeitfenster } from "@/lib/aufgaben-agenda";
import {
  AUFGABE_STATUS_LABEL,
  AUFGABE_TONE,
  AUFGABE_TON_HINWEIS,
  aufgabeTon,
} from "@/lib/aufgabenstatus";
import type { TaskListItem, TaskStatus } from "@/lib/tasks";
import { useTheme } from "@/theme/ThemeProvider";

/** Der Wechsel am Tag der Aufgabe — je Richtung, ob er auf diesen Tag fällt. */
export type Wechsel = { abreise: boolean; anreise: boolean };

export function AufgabeKarte({
  task,
  heuteIso,
  wechsel,
  zeigeZustaendige,
  aktion,
}: {
  task: TaskListItem;
  heuteIso: string;
  wechsel?: Wechsel;
  /** Team-Sicht zeigt, WER zuständig ist; in „Meine" ist das immer man selbst. */
  zeigeZustaendige?: boolean;
  /** Statuswechsel (nur MANAGE_TASKS). Ohne Recht bleibt die Karte Anzeige. */
  aktion?: { label: string; onPress: () => void; busy: boolean } | null;
}) {
  const t = useTheme();
  const ton = aufgabeTon(task, heuteIso);
  const tonFarbe = AUFGABE_TONE[ton];
  const hinweis = AUFGABE_TON_HINWEIS[ton];
  const ueberfaellig = istUeberfaellig(task, heuteIso);
  const fenster = zeitfenster(task);
  const pct = task.checklist_total
    ? Math.round((task.checklist_done / task.checklist_total) * 100)
    : 0;
  // Der Streifen macht die Bedeutung auf einen Blick lesbar; „plain" bekommt
  // die Linienfarbe, damit die Karte nicht ohne Kante dasteht.
  const streifen = ton === "plain" ? t.palette.line : tonFarbe.fg || t.palette.line;

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.palette.surface,
        borderRadius: t.radius.card,
        borderWidth: 1,
        borderColor: t.palette.line,
        overflow: "hidden",
      }}
    >
      <View style={{ width: 4, backgroundColor: streifen }} />
      <Col gap={10} style={{ flex: 1, padding: 14 }}>
        <Row style={{ justifyContent: "space-between", gap: 10 }}>
          {fenster ? (
            <Row gap={6} style={{ flexShrink: 1 }}>
              <Icon n="clock" s={14} sw={2} c={t.palette.soft} />
              <Txt v="sm" soft numberOfLines={1}>
                {fenster}
              </Txt>
            </Row>
          ) : (
            <Txt v="sm" faint>
              Ohne Zeit
            </Txt>
          )}
          <StatusFeld status={task.status} ton={ton} />
        </Row>

        {/* Der Titel darf umbrechen. Vorher stand er in einer 2-Zeilen-Zelle
            neben einem Status-Chip und war nach vier Zeichen abgeschnitten
            („Reng…" statt „Rengøring 3 Zimmer"). */}
        <Txt v="title">{task.title}</Txt>

        <Col gap={4}>
          <Row gap={6}>
            <Icon n="home" s={14} sw={2} c={t.palette.faint} />
            <Txt v="sm" soft numberOfLines={1} style={{ flex: 1 }}>
              {task.property_title ?? "Ohne Objekt"}
            </Txt>
          </Row>
          {task.reservation_ref && (
            <Row gap={6}>
              <Icon n="suitcase" s={14} sw={2} c={t.palette.faint} />
              <Txt v="sm" soft numberOfLines={1} style={{ flex: 1 }}>
                {task.reservation_ref}
              </Txt>
            </Row>
          )}
          {zeigeZustaendige && (
            <Row gap={6}>
              <Icon n="user" s={14} sw={2} c={t.palette.faint} />
              <Txt v="sm" soft numberOfLines={1} style={{ flex: 1 }}>
                {task.assignee_name ?? "Niemand zugewiesen"}
              </Txt>
            </Row>
          )}
        </Col>

        {(wechsel?.abreise || wechsel?.anreise || ueberfaellig || hinweis || task.needs_inspection) && (
          <Row gap={6} style={{ flexWrap: "wrap" }}>
            {/* Der Wechsel des Tages — ohne Uhrzeit, weil das Backend nur
                Kalendertage der Buchung kennt. Eine Zeit dazuzuschreiben wäre
                erfunden (Wurzel 4). */}
            {wechsel?.abreise && <Merker icon="logout" text="Abreise" />}
            {wechsel?.anreise && <Merker icon="key" text="Anreise" />}
            {ueberfaellig && (
              <Merker
                icon="clock"
                text="Überfällig"
                bg={AUFGABE_TONE.unassigned.bg}
                fg={AUFGABE_TONE.unassigned.fg}
              />
            )}
            {hinweis && !ueberfaellig && (
              <Merker icon="info" text={hinweis} bg={tonFarbe.bg} fg={tonFarbe.fg} />
            )}
            {task.needs_inspection && <Merker icon="eye" text="QA-Freigabe" />}
          </Row>
        )}

        {task.checklist_total > 0 && (
          <Col gap={5}>
            <Progress pct={pct} />
            <Txt v="xs" soft>
              {task.checklist_done} von {task.checklist_total} Punkten erledigt
            </Txt>
          </Col>
        )}

        {aktion && (
          <Pressable
            accessibilityRole="button"
            onPress={aktion.busy ? undefined : aktion.onPress}
            disabled={aktion.busy}
            style={{
              paddingVertical: 11,
              borderRadius: t.radius.pill,
              borderWidth: 1,
              borderColor: t.palette.line,
              alignItems: "center",
              opacity: aktion.busy ? 0.5 : 1,
            }}
          >
            <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
              {aktion.busy ? "…" : aktion.label}
            </Txt>
          </Pressable>
        )}
      </Col>
    </View>
  );
}

function StatusFeld({ status, ton }: { status: TaskStatus; ton: keyof typeof AUFGABE_TONE }) {
  const t = useTheme();
  const { bg, fg } = AUFGABE_TONE[ton];
  const eingefaerbt = ton === "done" || ton === "cancelled";
  return (
    <Chip
      variant=""
      style={
        eingefaerbt
          ? { backgroundColor: bg, borderColor: bg, paddingVertical: 6, paddingHorizontal: 12 }
          : { paddingVertical: 6, paddingHorizontal: 12 }
      }
      textColor={eingefaerbt ? fg : t.palette.ink}
    >
      {AUFGABE_STATUS_LABEL[status]}
    </Chip>
  );
}

function Merker({
  icon,
  text,
  bg,
  fg,
}: {
  icon: IconName;
  text: string;
  bg?: string;
  fg?: string;
}) {
  const t = useTheme();
  return (
    <Row
      gap={5}
      style={{
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: t.radius.pill,
        backgroundColor: bg ?? t.palette.surface2,
      }}
    >
      <Icon n={icon} s={12} sw={2} c={fg ?? t.palette.soft} />
      <Txt v="xs" color={fg ?? t.palette.soft}>
        {text}
      </Txt>
    </Row>
  );
}
