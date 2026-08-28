"use client";

// Die Regel-Liste des Baukastens (0440).
//
// Aufbau wie bei Duda (live abgelesen 24.08.2026): links die Regeln als Karten
// mit Symbol, Name, Aktionsart und Status-Chip, rechts die Zusammenfassung der
// gewählten Regel. Die REIHENFOLGE ist der Vorrang — deshalb lässt sie sich
// ziehen, und deshalb steht der Hinweis darauf über der Liste und nicht in
// einer Hilfe, die niemand öffnet.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteRegel,
  ordneRegeln,
  updateRegel,
  type Regel,
  type RegelStatus,
} from "@/lib/site-regeln";

import { RegelZusammenfassung } from "./regel-zusammenfassung";

const SYMBOL: Record<string, string> = {
  popup: "ph:browser",
  top_bar: "ph:bell-simple",
  effect: "ph:sparkle",
  script: "ph:code",
};

export function RegelListe({
  regeln,
  seiten,
  ortVerfuegbar,
  onBearbeiten,
}: {
  regeln: Regel[];
  /** Slug und Titel der Seiten — für die Seitenauswahl und die Zusammenfassung. */
  seiten: Array<{ slug: string; title: string }>;
  ortVerfuegbar: boolean;
  onBearbeiten: (regel: Regel) => void;
}) {
  const t = useTranslations("website");
  const [aktiv, setAktiv] = useState<string | null>(regeln[0]?.id ?? null);
  const [reihenfolge, setReihenfolge] = useState<Regel[]>(regeln);
  const [gezogen, setGezogen] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const gewaehlt = reihenfolge.find((r) => r.id === aktiv) ?? null;

  function statusSetzen(regel: Regel, status: RegelStatus) {
    start(async () => {
      const res = await updateRegel(regel.id, { status });
      if (!res.ok) toast.error(res.error);
      else {
        setReihenfolge((alt) =>
          alt.map((r) => (r.id === regel.id ? { ...r, status } : r)),
        );
        toast.success(t("regeln.gespeichert"));
      }
    });
  }

  function loeschen(regel: Regel) {
    start(async () => {
      const res = await deleteRegel(regel.id);
      if (!res.ok) toast.error(res.error);
      else {
        setReihenfolge((alt) => alt.filter((r) => r.id !== regel.id));
        if (aktiv === regel.id) setAktiv(null);
        toast.success(t("regeln.geloescht"));
      }
    });
  }

  /** Nach dem Ziehen: die neue Reihenfolge sofort zeigen, dann speichern.
   *
   *  Erst zeigen, dann speichern — nicht umgekehrt: eine Liste, die nach dem
   *  Loslassen kurz zurückspringt und dann erneut umsortiert, sieht kaputt aus.
   *  Schlägt das Speichern fehl, wird die alte Reihenfolge wiederhergestellt
   *  und der Fehler benannt. */
  function ablegen(zielId: string) {
    if (!gezogen || gezogen === zielId) return;
    const vorher = reihenfolge;
    const von = reihenfolge.findIndex((r) => r.id === gezogen);
    const nach = reihenfolge.findIndex((r) => r.id === zielId);
    if (von < 0 || nach < 0) return;
    const neu = [...reihenfolge];
    const [element] = neu.splice(von, 1);
    neu.splice(nach, 0, element!);
    setReihenfolge(neu);
    setGezogen(null);
    start(async () => {
      const res = await ordneRegeln(neu.map((r) => r.id));
      if (!res.ok) {
        setReihenfolge(vorher);
        toast.error(res.error);
      }
    });
  }

  if (reihenfolge.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {t("regeln.leer")}
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{t("regeln.vorrang")}</p>
        {reihenfolge.map((regel) => (
          <div
            key={regel.id}
            draggable
            onDragStart={() => setGezogen(regel.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => ablegen(regel.id)}
            className={
              "flex items-center gap-3 rounded-2xl border p-3 transition " +
              (aktiv === regel.id
                ? "border-foreground bg-secondary/60"
                : "border-border hover:bg-secondary/30")
            }
          >
            <Icon
              icon="ph:dots-six-vertical"
              className="size-4 shrink-0 cursor-grab text-muted-foreground"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setAktiv(regel.id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Icon
                  icon={SYMBOL[regel.action_type] ?? "ph:sliders-horizontal"}
                  className="size-4"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {regel.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t(`regeln.aktion.${regel.action_type}`)}
                </span>
              </span>
            </button>
            {regel.status === "active" ? null : (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`regeln.status.${regel.status}`)}
              </span>
            )}
          </div>
        ))}
      </div>

      {gewaehlt ? (
        <RegelZusammenfassung
          regel={gewaehlt}
          seiten={seiten}
          ortVerfuegbar={ortVerfuegbar}
          pending={pending}
          onBearbeiten={() => onBearbeiten(gewaehlt)}
          onStatus={(s) => statusSetzen(gewaehlt, s)}
          onLoeschen={() => loeschen(gewaehlt)}
        />
      ) : (
        <p className="self-start rounded-2xl border border-border p-6 text-sm text-muted-foreground">
          {t("regeln.keineGewaehlt")}
        </p>
      )}
    </div>
  );
}
