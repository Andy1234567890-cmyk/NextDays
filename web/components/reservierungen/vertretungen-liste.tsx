"use client";

// Vertretungen: offene Anfragen von Kolleginnen und Kollegen — übernehmen oder
// ablehnen.
//
// WARUM DIESE SEITE: Das Vertretungs-Feature existiert seit Migration 0019 mit
// vier Endpunkten, hatte aber nie eine Oberfläche. Eine Anfrage landete in
// `task_substitutions`, dazu kam eine Log-Zeile — niemand erfuhr davon. Wer
// ausfiel, fragte ins Leere; die Aufgabe blieb bei ihm, während er annahm,
// jemand übernehme sie. Seit 0415 geht zusätzlich eine Benachrichtigung raus
// (Mail/SMS/Push, Kategorie `task_substitution`), und dieser Bildschirm ist das
// Ziel, auf das sie zeigt.
//
// Was hier NICHT steht: Gastnamen oder Beträge. Die Liste sieht auch eine
// Reinigungskraft (§4.3) — sie zeigt Aufgabe, Objekt, Zeitfenster und wer
// gefragt hat.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fehlerMelden } from "@/lib/fehler-melden";

import { Button } from "@nextdays/ui/button";
import {
  acceptSubstitution,
  declineSubstitution,
  listSubstitutions,
  type Vertretung,
} from "@/lib/tasks";
import { useRealtime } from "@/lib/use-realtime";

export function VertretungenListe() {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const [rows, setRows] = useState<Vertretung[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Still nachladen wie in `team-tasks`: ein Realtime-Ereignis tauscht die
  // Liste aus, ohne sie durch einen Ladezustand zu ersetzen.
  const load = useCallback(async (stillLaden = false) => {
    if (!stillLaden) setLoading(true);
    const res = await listSubstitutions();
    if (res.ok) setRows(res.data);
    // Fehler NIE verschlucken: eine leere Liste sähe aus wie „keine Anfragen",
    // und genau darauf verlässt sich jemand, der einspringen würde (Wurzel 5).
    else fehlerMelden(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stillNachladen = useCallback(() => {
    void load(true);
  }, [load]);

  useRealtime({ table: "task_substitutions", onChange: stillNachladen });

  const entscheiden = async (v: Vertretung, uebernehmen: boolean) => {
    if (busy) return; // Doppelklick-Sperre (Wurzel 2)
    setBusy(v.id);
    const res = uebernehmen
      ? await acceptSubstitution(v.id)
      : await declineSubstitution(v.id);
    setBusy(null);
    if (!res.ok) {
      // 409 heißt „schon entschieden" — ein Kollege war schneller.
      fehlerMelden(res);
      stillNachladen();
      return;
    }
    toast.success(
      uebernehmen
        ? t("substitutions.taken")
        : t("substitutions.declined"),
    );
    stillNachladen();
  };

  // Zeitfenster der Aufgabe in der Sprache der Oberfläche. Das JAHR steht dabei,
  // sobald es nicht das laufende ist — ohne diese Regel liest sich eine Aufgabe
  // zum 01.01.2027 wie „in ein paar Tagen".
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const jahr =
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric";
    return d.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      year: jahr,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">
            {t("substitutions.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("substitutions.intro")}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-muted-foreground">
          {t("substitutions.loading")}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-(--radius) border border-dashed p-10 text-center">
          <Icon
            icon="ph:hand-heart"
            className="mx-auto size-8 text-muted-foreground"
          />
          <p className="mt-3 text-sm font-medium">{t("substitutions.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("substitutions.emptyHint")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((v) => {
            const zeit = [fmt(v.start_at), fmt(v.end_at)]
              .filter(Boolean)
              .join(" – ");
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-(--radius) border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{v.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[v.property_title, zeit || null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {v.requested_by_name && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t("substitutions.requestedBy", {
                        name: v.requested_by_name,
                      })}
                    </p>
                  )}
                  {v.note && (
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      {v.note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void entscheiden(v, true)}
                  >
                    {t("substitutions.take")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void entscheiden(v, false)}
                  >
                    {t("substitutions.decline")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
