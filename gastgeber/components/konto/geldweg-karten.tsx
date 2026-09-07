"use client";

// Der Weg des Geldes als vier Flip-Karten (Reiter „Kontostand").
//
// Vorn eine Illustration aus gestapelten Icon-Kacheln (keine Fremdfotos —
// dieselbe Anmutung wie die Promo-Kachel im Menü), hinten der Satz, was an
// dieser Station passiert. Gedreht wird per Hover UND per Klick/Tastatur
// (Touch hat kein Hover; `aria-pressed` trägt den Zustand), Tailwind-v4-3D-
// Utilities ohne eigenes CSS. Mit „Bewegung reduzieren" wird nicht gedreht,
// sondern hart umgeschaltet.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Station = {
  key: "1" | "2" | "3" | "4";
  /** Hauptkachel + kleine Begleitkachel: was an dieser Station passiert. */
  gross: string;
  klein: string;
  ton: string;
  tonKlein: string;
};

const STATIONEN: Station[] = [
  {
    key: "1",
    gross: "solar:card-bold-duotone",
    klein: "solar:user-rounded-bold-duotone",
    ton: "from-rose-100 to-rose-50 text-rose-600",
    tonKlein: "from-rose-200 to-rose-100 text-rose-700",
  },
  {
    key: "2",
    gross: "solar:safe-square-bold-duotone",
    klein: "solar:clock-circle-bold-duotone",
    ton: "from-amber-100 to-amber-50 text-amber-700",
    tonKlein: "from-amber-200 to-amber-100 text-amber-800",
  },
  {
    key: "3",
    gross: "solar:transfer-horizontal-bold-duotone",
    klein: "simple-icons:stripe",
    ton: "from-violet-100 to-violet-50 text-violet-600",
    tonKlein: "from-violet-200 to-violet-100 text-violet-700",
  },
  {
    key: "4",
    gross: "solar:buildings-2-bold-duotone",
    klein: "solar:wallet-money-bold-duotone",
    ton: "from-emerald-100 to-emerald-50 text-emerald-700",
    tonKlein: "from-emerald-200 to-emerald-100 text-emerald-800",
  },
];

export function GeldwegKarten({ karenzTage }: { karenzTage: number }) {
  const t = useTranslations("konto");
  const [gedreht, setGedreht] = useState<Record<string, boolean>>({});

  return (
    <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {STATIONEN.map((s, i) => {
        const offen = !!gedreht[s.key];
        return (
          <li key={s.key} className="perspective-distant">
            <button
              type="button"
              aria-pressed={offen}
              aria-label={`${i + 1}. ${t(`ksWegTitel${s.key}`)} — ${t("ksWegUmdrehen")}`}
              onClick={() => setGedreht({ ...gedreht, [s.key]: !offen })}
              className="group relative block h-52 w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 rounded-2xl"
            >
              <span
                className={`relative block size-full transform-3d transition-transform duration-500 motion-reduce:transition-none group-hover:rotate-y-180 ${
                  offen ? "rotate-y-180" : ""
                }`}
              >
                {/* Vorderseite: Illustration + Titel */}
                <span className="absolute inset-0 flex flex-col rounded-2xl border border-border bg-background p-4 backface-hidden">
                  <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <span className="relative mx-auto my-3 h-24 w-28">
                    <span
                      className={`absolute left-1 top-3 flex size-20 -rotate-6 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md ring-1 ring-black/5 ${s.ton}`}
                    >
                      <Icon icon={s.gross} className="size-10" />
                    </span>
                    <span
                      className={`absolute right-0 top-0 flex size-11 rotate-6 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ring-1 ring-black/5 ${s.tonKlein}`}
                    >
                      <Icon icon={s.klein} className="size-5" />
                    </span>
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <span className="font-semibold">{t(`ksWegTitel${s.key}`)}</span>
                    <Icon
                      icon="ph:arrows-clockwise"
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </span>
                </span>

                {/* Rückseite: der Satz */}
                <span className="absolute inset-0 flex flex-col rounded-2xl border border-foreground bg-foreground p-4 text-background rotate-y-180 backface-hidden">
                  <span className="text-xs font-semibold opacity-60">{i + 1}</span>
                  <span className="mt-2 text-[0.9375rem] leading-snug">
                    {t(`ksWeg${s.key}`, { tage: karenzTage })}
                  </span>
                  <span className="mt-auto text-xs opacity-60">{t(`ksWegTitel${s.key}`)}</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
