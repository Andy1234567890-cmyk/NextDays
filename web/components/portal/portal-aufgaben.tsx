"use client";

// Eigentümer-Portal · Meine Aufgaben — Liste und Rückmeldung.
//
// Zwei Handlungen über den Portal-Slice (`/public-portal/tasks/...`), denselben
// Weg, den auch die Eigentümer-App nimmt: „Anfangen" (→ in_progress) und
// „Erledigt melden" (Foto-Pflicht serverseitig, 422 im Klartext). Zeitfenster,
// Zuständigen oder Objekt ändert der Eigentümer NICHT — das ist Einsatzplanung
// der Verwaltung (§4.2 read-only), und die Routen dafür verlangen MANAGE_TASKS.
//
// KEIN Realtime-Abo auf `tasks` — bewusst, wie in `portal-realtime.tsx`
// begründet: `postgres_changes` liefert die VOLLE Zeile inkl. `assignee_id`
// jeder Aufgabe an seinen Objekten, also wer beim Betrieb putzt. RLS begrenzt
// die Zeilen auf seine Objekte, nicht die Spalten. Die eigene Aktion schreibt
// stattdessen die Antwort des Servers in die Liste zurück, ein Fremd-Update
// kommt beim nächsten Öffnen.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import {
  type PortalTask,
  completeOwnerTask,
  getOwnerTasks,
  startOwnerTask,
} from "@/lib/portal";

const ABGESCHLOSSEN = new Set(["done", "cancelled"]);

const STATUS_KEY: Record<string, string> = {
  open: "tasks.statusOpen",
  in_progress: "tasks.statusInProgress",
  done: "tasks.statusDone",
};

export function PortalAufgaben() {
  const t = useTranslations("portal");
  const locale = useLocale();
  const [offen, setOffen] = useState<PortalTask[]>([]);
  const [erledigt, setErledigt] = useState<PortalTask[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  // Je Aufgabe höchstens eine laufende Aktion (Doppelklick-Schutz, Wurzel 2).
  const [aktiv, setAktiv] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await getOwnerTasks();
    if (res.ok) {
      // Ein Aufruf, zwei Gruppen: erledigt/storniert unten, alles andere oben.
      setOffen(res.data.items.filter((x) => !ABGESCHLOSSEN.has(x.status)));
      setErledigt(res.data.items.filter((x) => ABGESCHLOSSEN.has(x.status)));
      setFehler(null);
    } else {
      // „leer" und „konnte nicht laden" sind zwei Aussagen (Wurzel 5).
      setFehler(t("tasks.loadFailed"));
    }
    setLaedt(false);
  }, [t]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const zeitfenster = (a: PortalTask): string => {
    if (!a.start_at) return t("tasks.noWindow");
    const von = fmt.format(new Date(a.start_at));
    if (!a.end_at) return von;
    return `${von} – ${fmt.format(new Date(a.end_at))}`;
  };

  /** Antwort des Servers in die Liste zurückschreiben — kein Nachladen. */
  const uebernehmen = (neu: PortalTask) => {
    if (ABGESCHLOSSEN.has(neu.status)) {
      setOffen((l) => l.filter((x) => x.id !== neu.id));
      setErledigt((l) => [neu, ...l.filter((x) => x.id !== neu.id)]);
      return;
    }
    setOffen((l) => l.map((x) => (x.id === neu.id ? neu : x)));
  };

  const anfangen = async (id: string) => {
    setAktiv(id);
    const res = await startOwnerTask(id);
    setAktiv(null);
    if (!res.ok) return toast.error(res.error);
    uebernehmen(res.data);
    toast.success(t("tasks.started"));
  };

  const abschliessen = async (id: string) => {
    setAktiv(id);
    const res = await completeOwnerTask(id);
    setAktiv(null);
    // Die Foto-Pflicht kommt als 422 mit Klartext — der Eigentümer sieht,
    // WARUM es nicht ging, statt eines stummen Nichts.
    if (!res.ok) return toast.error(res.error);
    uebernehmen(res.data);
    toast.success(t("tasks.completed"));
  };

  const karte = (a: PortalTask, offenAufgabe: boolean) => (
    <Card key={a.id}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{a.title}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {t(STATUS_KEY[a.status] ?? "tasks.statusOpen")}
            </span>
          </div>
          <dl className="mt-1 grid gap-x-6 gap-y-0.5 text-sm text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="sr-only">{t("tasks.property")}</dt>
              <dd className="flex items-center gap-1">
                <Icon icon="ph:house-line" className="size-3.5 shrink-0" />
                {a.property_title ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t("tasks.window")}</dt>
              <dd className="flex items-center gap-1">
                <Icon icon="ph:clock" className="size-3.5 shrink-0" />
                {zeitfenster(a)}
              </dd>
            </div>
            {a.reservation_ref && (
              <div>
                <dt className="sr-only">{t("tasks.booking")}</dt>
                <dd className="flex items-center gap-1">
                  <Icon icon="ph:ticket" className="size-3.5 shrink-0" />
                  {a.reservation_ref}
                </dd>
              </div>
            )}
          </dl>
        </div>
        {offenAufgabe && (
          <div className="flex shrink-0 gap-2">
            {a.status === "open" && (
              <Button
                variant="outline"
                size="sm"
                disabled={aktiv === a.id}
                onClick={() => void anfangen(a.id)}
              >
                {t("tasks.start")}
              </Button>
            )}
            <Button
              size="sm"
              disabled={aktiv === a.id}
              onClick={() => void abschliessen(a.id)}
            >
              <Icon icon="ph:check" className="size-4" />
              {t("tasks.complete")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("tasks.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("tasks.hint")}</p>
      </header>

      {fehler && (
        <p role="alert" className="text-sm text-destructive">
          {fehler}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("tasks.openTitle")}
        </h2>
        {laedt ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : offen.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tasks.empty")}</p>
        ) : (
          offen.map((a) => karte(a, true))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("tasks.doneTitle")}
        </h2>
        {!laedt && erledigt.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tasks.emptyDone")}</p>
        ) : (
          erledigt.map((a) => karte(a, false))
        )}
      </section>
    </div>
  );
}
