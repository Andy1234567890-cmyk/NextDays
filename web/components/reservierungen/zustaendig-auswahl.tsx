"use client";

// „Wer ist zuständig?" an einer BESTEHENDEN Aufgabe.
//
// Bis 17.08.2026 gab es diesen Weg nicht: ein Zuständiger ließ sich nur beim
// ANLEGEN setzen, danach war das Feld eingefroren. Eine Fehlzuweisung war nur
// zu beheben, indem man die Aufgabe löschte und neu anlegte — mitsamt
// Checkliste, Fotos und Historie. Gleichzeitig mahnte der Aufgaben-Kalender
// unzugewiesene Aufgaben rot an, ohne einen Weg anzubieten, das zu ändern.
//
// Warum ein natives `<select>`: es ist per Tastatur bedienbar, öffnet auf dem
// Telefon die System-Auswahl und braucht kein Overlay in einer Karte, die
// ohnehin scrollt — dieselbe Begründung wie beim Zeitraum-Selektor der
// Startseite.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import {
  type MitarbeiterOption,
  mitarbeiterOptionen,
} from "@/lib/mitarbeiter-optionen";
import { listTaskAssignees } from "@/lib/tasks";

// Eigener Wert für „niemand" im Aktionsmodus: der leere String ist dort der
// Platzhalter und darf keine Aktion auslösen.
const NIEMAND = "__niemand__";

export function ZustaendigAuswahl({
  wert,
  onWechsel,
  laedt = false,
  kompakt = false,
  propertyId = null,
  aktionsModus = false,
}: {
  wert: string | null;
  /** Bekommt `null`, wenn die Zuweisung abgezogen wird. */
  onWechsel: (neu: string | null) => void;
  laedt?: boolean;
  /** Tabellenzelle statt Formularfeld: ohne sichtbares Label, schmaler. */
  kompakt?: boolean;
  /** Objekt der Aufgabe. Gesetzt = die Liste zeigt nur Personen, die für
   *  dieses Objekt freigegeben sind — sonst böte sie eine Wahl an, die der
   *  Server anschließend mit 422 ablehnt. */
  propertyId?: string | null;
  /** Der Selektor ist ein Befehl, kein Zustand (Massenaktion): er springt nach
   *  jeder Wahl zurück auf den Platzhalter und meldet auch „Niemand". */
  aktionsModus?: boolean;
}) {
  const t = useTranslations("reservations");
  const id = useId();
  const [users, setUsers] = useState<MitarbeiterOption[]>([]);

  useEffect(() => {
    // `abgebrochen` statt AbortController: `call()` gibt ein Result zurück
    // und wirft nicht. Ohne den Riegel schriebe ein spät eintreffendes
    // `.then()` in eine bereits geschlossene Karte (Popover, Modal, FAB).
    let abgebrochen = false;
    void listTaskAssignees(propertyId).then((r) => {
      if (!abgebrochen && r.ok) {
        setUsers(
          mitarbeiterOptionen(r.data, { eigentuemer: t("zustaendig.eigentuemer") }),
        );
      }
    });
    return () => {
      abgebrochen = true;
    };
  }, [propertyId, t]);

  // Der aktuelle Wert MUSS wählbar bleiben, auch wenn er nicht in der Liste
  // steht — etwa weil der Zuständige inzwischen gesperrt wurde. Sonst spränge
  // das Feld beim Öffnen stumm auf „niemand" und der nächste Speichervorgang
  // zöge eine Zuweisung ab, die niemand anfassen wollte (Wurzel 1).
  const fehlt = wert !== null && !users.some((u) => u.value === wert);

  const select = (
    <span className="relative inline-flex">
      <select
        id={id}
        // Im Aktionsmodus steht der Wert IMMER auf dem Platzhalter (""), damit
        // jede Auswahl eine Änderung ist und `onChange` feuert.
        value={aktionsModus ? "" : (wert ?? "")}
        disabled={laedt}
        onChange={(e) => {
          const gewaehlt = e.target.value;
          if (aktionsModus && gewaehlt === "") return; // Platzhalter selbst
          onWechsel(gewaehlt === NIEMAND || gewaehlt === "" ? null : gewaehlt);
          if (aktionsModus) e.target.value = "";
        }}
        className={
          kompakt
            ? "cursor-pointer appearance-none rounded-full bg-secondary py-1 pl-3 pr-7 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
            : "w-full cursor-pointer appearance-none rounded-xl border border-border bg-background py-2 pl-3 pr-9 text-sm transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
        }
      >
        {aktionsModus ? (
          <>
            <option value="">{t("zustaendig.aktion")}</option>
            <option value={NIEMAND}>{t("zustaendig.niemand")}</option>
          </>
        ) : (
          <option value="">{t("zustaendig.niemand")}</option>
        )}
        {fehlt && (
          <option value={wert}>{t("zustaendig.unbekannt")}</option>
        )}
        {users.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
      <Icon
        icon={laedt ? "ph:circle-notch" : "ph:caret-down"}
        className={`pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground ${
          laedt ? "animate-spin" : ""
        }`}
        aria-hidden
      />
    </span>
  );

  if (kompakt) {
    return (
      <>
        <label className="sr-only" htmlFor={id}>
          {t("zustaendig.label")}
        </label>
        {select}
      </>
    );
  }

  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className="text-sm font-semibold">{t("zustaendig.label")}</span>
      {select}
    </label>
  );
}
