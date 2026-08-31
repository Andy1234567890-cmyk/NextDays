"use client";

// Die Aufgaben-Tabelle des PM-Moduls — geteilt von „Meine Aufgaben" und
// „Teamaufgaben", weil beide bei Lodgify dieselbe Tabelle sind (Teamaufgaben hat
// nur eine Spalte mehr).
//
// Spalten: Auswahl · Aktionen · Titel · Unterkunft · Buchung · [Zugewiesen] ·
// Status · Start-/Endtermine. Überfällige offene Zeilen sind rot hinterlegt —
// das ist die eigentliche Information der Liste: was hätte längst getan sein
// müssen. Ohne die Einfärbung sieht eine seit Wochen offene Reinigung genauso
// aus wie eine von morgen.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Card } from "@nextdays/ui/card";
import { ZeitfensterBearbeiten } from "@/components/reservierungen/zeitfenster-bearbeiten";
import { AUFGABEN_STATUS } from "@/lib/aufgaben-status";
import type { TaskListItem } from "@/lib/tasks";

export type TabellenAktion = {
  onOpen: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  /** Nach einer Änderung in der Zeile (z. B. verschobenes Zeitfenster) — die
   *  Liste lädt nach. Optional: wo Realtime greift, ist es entbehrlich. */
  onChanged?: () => void;
};

/** Spalten, nach denen sich sortieren laesst. */
type SortSpalte = "title" | "property" | "assignee" | "status" | "dates";
type SortRichtung = "asc" | "desc";

/** Rang eines Status in der Reihenfolge der ARBEIT, nicht im Alphabet.
 *
 *  Alphabetisch stuende „Abgeschlossen" vor „Offen" — die erledigten Zeilen
 *  landeten oben und das Offene, um das es geht, unten. */
const STATUS_RANG: Record<string, number> = {
  open: 0,
  accepted: 1,
  in_progress: 2,
  done: 3,
  cancelled: 4,
};

/** Der Zeitpunkt, nach dem die Datumsspalte sortiert: Start, ersatzweise
 *  Faelligkeit, ersatzweise Ende. Ohne jeden Zeitpunkt ans ENDE — eine Aufgabe
 *  ohne Termin ist nichts, was man zuerst sieht. */
function sortZeit(t: TaskListItem): number {
  const iso = t.start_at ?? t.due_at ?? t.end_at;
  return iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER;
}

function useTermin(): (iso: string | null) => string {
  const locale = useLocale();
  return (iso) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "–";
}

/** Offen UND der Endtermin (ersatzweise Start/Fälligkeit) liegt in der Vergangenheit. */
function istUeberfaellig(task: TaskListItem): boolean {
  if (task.status === "done" || task.status === "cancelled") return false;
  const ende = task.end_at ?? task.due_at ?? task.start_at;
  return Boolean(ende) && new Date(ende as string).getTime() < Date.now();
}

/** Ein sortierbarer Spaltenkopf.
 *
 *  Der Pfeil steht NUR an der aktiven Spalte — ein Pfeil an jeder Spalte
 *  sieht aus wie „hier ist überall sortiert" und nimmt der Anzeige ihren
 *  Zweck. `aria-sort` sagt derselben Sache für die Vorlesefunktion. */
function SortKopf({
  spalte,
  label,
  aktiv,
  richtung,
  onSort,
}: {
  spalte: SortSpalte;
  label: string;
  aktiv: SortSpalte;
  richtung: SortRichtung;
  onSort: (spalte: SortSpalte) => void;
}) {
  const istAktiv = aktiv === spalte;
  return (
    <th
      className="px-4 py-3 font-semibold"
      aria-sort={
        istAktiv ? (richtung === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(spalte)}
        className={`flex items-center gap-1 uppercase transition-colors hover:text-foreground ${
          istAktiv ? "text-foreground" : ""
        }`}
      >
        {label}
        <Icon
          icon={
            istAktiv
              ? richtung === "asc"
                ? "ph:caret-up-fill"
                : "ph:caret-down-fill"
              : "ph:caret-up-down"
          }
          className={`size-3 ${istAktiv ? "text-accent" : "opacity-40"}`}
        />
      </button>
    </th>
  );
}

export function AufgabenTabelle({
  rows,
  selected,
  onSelectedChange,
  aktionen,
  showAssignee,
  emptyLabel,
}: {
  rows: TaskListItem[];
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  aktionen: TabellenAktion;
  showAssignee?: boolean;
  emptyLabel: string;
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const termin = useTermin();

  // Vorgabe: nach Termin, das Naechste zuerst. Das ist die Frage, mit der man
  // eine Aufgabenliste oeffnet — „was steht an?". Der Server liefert bereits
  // nach `start_at` sortiert; diese Vorgabe stimmt damit ueberein, sodass die
  // erste Ansicht sich nicht ploetzlich anders anordnet.
  const [sortSpalte, setSortSpalte] = useState<SortSpalte>("dates");
  const [sortRichtung, setSortRichtung] = useState<SortRichtung>("asc");

  const sortiert = useMemo(() => {
    const vgl = (a: TaskListItem, b: TaskListItem): number => {
      switch (sortSpalte) {
        case "title":
          return a.title.localeCompare(b.title, locale);
        case "property":
          // Zeilen ohne Objekt ans Ende, nicht unter den leeren String.
          return (a.property_title ?? "\uffff").localeCompare(
            b.property_title ?? "\uffff",
            locale,
          );
        case "assignee":
          return (a.assignee_name ?? "\uffff").localeCompare(
            b.assignee_name ?? "\uffff",
            locale,
          );
        case "status":
          return (STATUS_RANG[a.status] ?? 99) - (STATUS_RANG[b.status] ?? 99);
        case "dates":
          return sortZeit(a) - sortZeit(b);
      }
    };
    // Kopie sortieren: `rows` gehoert dem Aufrufer, ein `sort()` darauf wuerde
    // seinen State an Ort und Stelle umstellen.
    const out = [...rows].sort(vgl);
    return sortRichtung === "asc" ? out : out.reverse();
  }, [rows, sortSpalte, sortRichtung, locale]);

  /** Klick auf einen Spaltenkopf: erst diese Spalte, weitere Klicks drehen die
   *  Richtung. */
  const sortieren = (spalte: SortSpalte) => {
    if (spalte === sortSpalte) {
      setSortRichtung((r) => (r === "asc" ? "desc" : "asc"));
      return;
    }
    setSortSpalte(spalte);
    setSortRichtung("asc");
  };

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </Card>
    );
  }

  const alleGewaehlt = rows.every((r) => selected.includes(r.id));
  const toggle = (id: string) =>
    onSelectedChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <th className="w-24 px-4 py-3 font-semibold">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={alleGewaehlt}
                  onChange={() =>
                    onSelectedChange(alleGewaehlt ? [] : rows.map((r) => r.id))
                  }
                  className="size-4 rounded-sm accent-primary"
                  aria-label={t("aufgabenTabelle.selectAll")}
                />
                {t("aufgabenTabelle.columnActions")}
              </span>
            </th>
            <SortKopf
              spalte="title"
              label={t("aufgabenTabelle.columnTitle")}
              aktiv={sortSpalte}
              richtung={sortRichtung}
              onSort={sortieren}
            />
            <SortKopf
              spalte="property"
              label={t("aufgabenTabelle.columnProperty")}
              aktiv={sortSpalte}
              richtung={sortRichtung}
              onSort={sortieren}
            />
            {/* Buchung bleibt unsortiert: die Referenz ist eine Kennung ohne
                fachliche Ordnung — „HM4NP5B2XF" vor „5066692131" zu stellen
                beantwortet keine Frage, die jemand hat. */}
            <th className="px-4 py-3 font-semibold">
              {t("aufgabenTabelle.columnBooking")}
            </th>
            {showAssignee && (
              <SortKopf
                spalte="assignee"
                label={t("aufgabenTabelle.columnAssignee")}
                aktiv={sortSpalte}
                richtung={sortRichtung}
                onSort={sortieren}
              />
            )}
            <SortKopf
              spalte="status"
              label={t("aufgabenTabelle.columnStatus")}
              aktiv={sortSpalte}
              richtung={sortRichtung}
              onSort={sortieren}
            />
            <SortKopf
              spalte="dates"
              label={t("aufgabenTabelle.columnDates")}
              aktiv={sortSpalte}
              richtung={sortRichtung}
              onSort={sortieren}
            />
          </tr>
        </thead>
        <tbody>
          {sortiert.map((row) => {
            const ueberfaellig = istUeberfaellig(row);
            return (
              <tr
                key={row.id}
                className={`border-b last:border-b-0 ${
                  ueberfaellig ? "bg-destructive/10" : "hover:bg-secondary/40"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      className="mr-1 size-4 rounded-sm accent-primary"
                      aria-label={t("aufgabenTabelle.selectRow")}
                    />
                    <button
                      type="button"
                      onClick={() => aktionen.onOpen(row.id)}
                      className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={t("aufgabenTabelle.open")}
                    >
                      <Icon icon="ph:eye" className="size-4" />
                    </button>
                    {aktionen.onComplete && row.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => aktionen.onComplete?.(row.id)}
                        className="flex size-7 items-center justify-center rounded-full text-success hover:bg-success/10"
                        aria-label={t("aufgabenTabelle.complete")}
                      >
                        <Icon icon="ph:check" className="size-4" />
                      </button>
                    )}
                    {aktionen.onDelete && (
                      <button
                        type="button"
                        onClick={() => aktionen.onDelete?.(row.id)}
                        className="flex size-7 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                        aria-label={t("aufgabenTabelle.delete")}
                      >
                        <Icon icon="ph:trash" className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-1.5">
                    {row.needs_inspection && (
                      <Icon
                        icon="ph:magnifying-glass"
                        className="size-3.5 text-warning"
                        aria-label={t("aufgabenTabelle.inspectionNeeded")}
                      />
                    )}
                    {row.title}
                  </span>
                </td>
                <td className="px-4 py-3 uppercase text-muted-foreground">
                  {row.property_title || "–"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.reservation_id && row.reservation_ref ? (
                    <Link
                      href={`/reservierungen/${row.reservation_id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {row.reservation_ref}
                    </Link>
                  ) : (
                    "–"
                  )}
                </td>
                {showAssignee && (
                  <td className="px-4 py-3">
                    {row.assignee_name ?? (
                      <span className="text-muted-foreground">
                        {t("aufgabenTabelle.unassigned")}
                      </span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <StatusChip status={row.status} ueberfaellig={ueberfaellig} />
                </td>
                {/* Termine sind ANKLICKBAR: ein Klick öffnet den Zeitfenster-
                    Bearbeiter (Kalender + Uhrzeit). Vorher stand hier toter
                    Text — gemeldet als „ich kann hier immer noch nicht Uhrzeit
                    ändern", und genau in dieser Liste wird geplant. */}
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  <ZeitfensterBearbeiten
                    taskId={row.id}
                    startAt={row.start_at ?? row.due_at}
                    endAt={row.end_at}
                    onSaved={aktionen.onChanged}
                    trigger={
                      <button
                        type="button"
                        className="group/zeit -mx-1 flex flex-col items-start rounded-(--radius) px-1 py-0.5 text-left transition-colors hover:bg-secondary"
                        title={t("aufgabenTabelle.editTimes")}
                      >
                        <span className="flex items-center gap-1">
                          {termin(row.start_at ?? row.due_at)}
                          <Icon
                            icon="ph:pencil-simple"
                            className="size-3 opacity-0 transition-opacity group-hover/zeit:opacity-60"
                          />
                        </span>
                        <span>{termin(row.end_at)}</span>
                      </button>
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function StatusChip({
  status,
  ueberfaellig,
}: {
  status: TaskListItem["status"];
  ueberfaellig: boolean;
}) {
  const t = useTranslations("reservations");
  const d = AUFGABEN_STATUS[status];
  // Überfällig färbt NUR die noch offenen Zustände rot. Eine erledigte oder
  // abgesagte Aufgabe ist nicht überfällig — sie ist fertig bzw. weg.
  const offen = status !== "done" && status !== "cancelled";
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        ueberfaellig && offen ? "text-destructive" : d.farbe
      }`}
    >
      <Icon
        icon={ueberfaellig && offen ? "ph:warning-circle" : d.icon}
        className="size-4"
      />
      {t(`taskStatus.${d.key}`)}
    </span>
  );
}
