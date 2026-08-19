// Aktionen am Vorgang: zuweisen, interne Notiz, Merker, Snooze, Archiv,
// Papierkorb, endgültig löschen (Etappe 3).
//
// WARUM ALS SHEET und nicht als Leiste im Kopf: Auf einem Telefon konkurriert
// jede Kopfzeilen-Schaltfläche mit dem Namen des Gastes und dem Zurück-Weg. Die
// Aktionen sind selten (einmal je Vorgang), der Verlauf ist das Häufige — also
// ein Zugang über „Mehr" und darin ausgeschriebene Beschriftungen statt vier
// Symbolen, die man raten muss.
//
// Die Rechte kommen von aussen (`access`): zuweisen darf nur, wer
// `inbox_assign` hat, und ohne `inbox_reply` gibt es auch keine interne Notiz —
// sie landet als Nachricht im Verlauf.
import { useEffect, useState } from "react";
import { Alert, Pressable, TextInput } from "react-native";

import { Btn, Col, Divider, Txt } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/patterns";
import type { InboxAccess } from "@/lib/inbox-access";
import {
  addNote,
  assignThread,
  listTeam,
  setInboxStatus,
  updateThreadFlags,
  type InboxThread,
  type TeamMember,
} from "@/lib/inbox";
import { useTheme } from "@/theme/ThemeProvider";

/** Snooze-Ziele — dieselbe Überlegung wie beim geplanten Senden. */
export function snoozeZiele(jetzt: Date = new Date()): { label: string; at: Date }[] {
  const spaeterHeute = new Date(jetzt.getTime() + 3 * 60 * 60 * 1000);
  const morgen = new Date(jetzt);
  morgen.setDate(morgen.getDate() + 1);
  morgen.setHours(9, 0, 0, 0);
  const naechsteWoche = new Date(jetzt);
  naechsteWoche.setDate(naechsteWoche.getDate() + 7);
  naechsteWoche.setHours(9, 0, 0, 0);
  return [
    { label: "In 3 Stunden", at: spaeterHeute },
    { label: "Morgen früh", at: morgen },
    { label: "Nächste Woche", at: naechsteWoche },
  ];
}

export function VorgangSheet({
  open,
  onClose,
  thread,
  access,
  hatDetails,
  onDetails,
  onGeaendert,
}: {
  open: boolean;
  onClose: () => void;
  thread: InboxThread;
  access: InboxAccess;
  /** Es gibt Buchungsdetails (Anfragen haben keine). */
  hatDetails: boolean;
  /** Buchungsdetails im Verlauf ein-/ausklappen. */
  onDetails: () => void;
  /** Liste neu laden und (bei Status-Wechsel) den Thread verlassen. */
  onGeaendert: (verlassen: boolean) => void;
}) {
  const t = useTheme();
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [notiz, setNotiz] = useState("");
  const [ansicht, setAnsicht] = useState<"haupt" | "zuweisen" | "notiz" | "snooze">(
    "haupt",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setAnsicht("haupt");
  }, [open]);

  useEffect(() => {
    if (ansicht !== "zuweisen" || team) return;
    listTeam().then((res) => setTeam(res.ok ? res.data.items : []));
  }, [ansicht, team]);

  const melde = (res: { ok: boolean; error?: string }, verlassen = false) => {
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht übernommen", res.error ?? "Aktion fehlgeschlagen.");
      return;
    }
    onGeaendert(verlassen);
    onClose();
  };

  const zuweisen = async (userId: string | null) => {
    setBusy(true);
    melde(await assignThread(thread.id, userId));
  };

  const notizSpeichern = async () => {
    const text = notiz.trim();
    if (!text) return;
    setBusy(true);
    const res = await addNote(thread.id, text);
    setNotiz("");
    melde(res);
  };

  const status = async (
    ziel: "active" | "archived" | "trashed" | "deleted",
  ) => {
    setBusy(true);
    // Status-Wechsel heisst: der Thread gehört nicht mehr in diese Ansicht —
    // also zurück zur Liste, statt einen Verlauf zu zeigen, der dort nicht
    // mehr auftaucht.
    melde(await setInboxStatus(thread.id, ziel), true);
  };

  const snooze = async (at: Date) => {
    setBusy(true);
    melde(await updateThreadFlags(thread.id, { remind_at: at.toISOString() }));
  };

  const zeile = (
    label: string,
    onPress: () => void,
    hinweis?: string,
    ton?: string,
  ) => (
    <Pressable
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}
    >
      <Txt v="body" color={ton}>
        {label}
      </Txt>
      {hinweis && (
        <Txt v="xs" soft>
          {hinweis}
        </Txt>
      )}
      <Divider style={{ marginTop: 12 }} />
    </Pressable>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      header={
        <Txt v="title">
          {ansicht === "zuweisen"
            ? "Zuweisen"
            : ansicht === "notiz"
              ? "Interne Notiz"
              : ansicht === "snooze"
                ? "Später erinnern"
                : "Vorgang"}
        </Txt>
      }
    >
      {ansicht === "haupt" && (
        <Col>
          {/* Erste Zeile, weil am häufigsten gebraucht: der Kopf hatte dafür ein
              eigenes „i"-Symbol neben dem „…" — zwei Knöpfe für eine Sache. */}
          {hatDetails &&
            zeile("Buchungsdetails", () => {
              onDetails();
              onClose();
            })}
          {zeile(
            thread.is_starred ? "Favorit entfernen" : "Als Favorit merken",
            async () => {
              setBusy(true);
              melde(
                await updateThreadFlags(thread.id, {
                  is_starred: !thread.is_starred,
                }),
              );
            },
          )}
          {zeile("Als ungelesen markieren", async () => {
            setBusy(true);
            melde(await updateThreadFlags(thread.id, { is_read: false }), true);
          })}
          {access.canAssign &&
            zeile(
              "Zuweisen",
              () => setAnsicht("zuweisen"),
              thread.assigned_user_name
                ? `Derzeit: ${thread.assigned_user_name}`
                : "Derzeit niemandem zugewiesen",
            )}
          {access.canReply && zeile("Interne Notiz", () => setAnsicht("notiz"))}
          {zeile("Später erinnern", () => setAnsicht("snooze"))}
          <Divider style={{ marginVertical: 4 }} />
          {thread.inbox_status === "active"
            ? zeile("Archivieren", () => status("archived"))
            : zeile("Zurück in den Posteingang", () => status("active"))}
          {thread.inbox_status !== "trashed"
            ? zeile("In den Papierkorb", () => status("trashed"))
            : zeile(
                "Endgültig löschen",
                () =>
                  // Nur aus dem Papierkorb heraus, und nur nach Rückfrage: ein
                  // Fehlgriff wäre nicht behebbar.
                  Alert.alert(
                    "Endgültig löschen?",
                    "Der Verlauf dieser Konversation ist danach weg.",
                    [
                      { text: "Abbrechen", style: "cancel" },
                      {
                        text: "Löschen",
                        style: "destructive",
                        onPress: () => status("deleted"),
                      },
                    ],
                  ),
                undefined,
                t.palette.accent,
              )}
        </Col>
      )}

      {ansicht === "zuweisen" && (
        <Col>
          {!team ? (
            <Txt v="sm" soft>
              Lädt …
            </Txt>
          ) : (
            <>
              {thread.assigned_user_id &&
                zeile("Zuweisung aufheben", () => zuweisen(null))}
              {team.map((m) =>
                zeile(
                  m.name,
                  () => zuweisen(m.id),
                  m.id === thread.assigned_user_id ? "aktuell zugewiesen" : m.email ?? undefined,
                ),
              )}
              {team.length === 0 && (
                <Txt v="sm" soft>
                  Keine weiteren Benutzer im Betrieb.
                </Txt>
              )}
            </>
          )}
        </Col>
      )}

      {ansicht === "notiz" && (
        <Col gap={12}>
          <Txt v="sm" soft>
            Die Notiz steht im Verlauf und ist nur für das Team sichtbar.
          </Txt>
          <TextInput
            value={notiz}
            onChangeText={setNotiz}
            placeholder="Notiz …"
            placeholderTextColor={t.palette.faint}
            multiline
            autoFocus
            style={{
              backgroundColor: t.palette.surface,
              borderWidth: 1,
              borderColor: t.palette.line,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              minHeight: 90,
              fontSize: 16,
              color: t.palette.ink,
              textAlignVertical: "top",
            }}
          />
          <Btn
            variant="dark"
            block
            onPress={busy || !notiz.trim() ? undefined : notizSpeichern}
          >
            {busy ? "Speichert …" : "Notiz anlegen"}
          </Btn>
        </Col>
      )}

      {ansicht === "snooze" && (
        <Col gap={10}>
          <Txt v="sm" soft>
            Der Vorgang meldet sich zum gewählten Zeitpunkt wieder.
          </Txt>
          {snoozeZiele().map((z) => (
            <Btn
              key={z.label}
              variant="outline"
              block
              onPress={busy ? undefined : () => snooze(z.at)}
            >
              {z.label}
            </Btn>
          ))}
        </Col>
      )}
    </Sheet>
  );
}
