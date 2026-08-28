"use client";

// Der Regeln-Reiter des Baukastens (0440) — Liste, Assistent und der Knopf,
// der ihn öffnet.
//
// Client-Teil, weil der Assistent ein Zustand ist: welcher Schritt, welche
// Vorbelegung, welche Regel wird bearbeitet. Die DATEN kommen vom Server
// (`page.tsx`) und werden nach dem Speichern über `router.refresh()` neu
// geholt — kein zweiter Abrufweg im Browser, der irgendwann von der
// Server-Fassung abweicht.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BaukastenRahmen } from "@/components/website/rahmen";
import type { CustomDomain } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";
import type { Regel } from "@/lib/site-regeln";

import { RegelDialog } from "./regel-dialog";
import { RegelListe } from "./regel-liste";
import { useBaukastenRealtime } from "../baukasten-realtime";

export function RegelAnsicht({
  regeln,
  pages,
  domains,
  sprachen,
  ortVerfuegbar,
}: {
  regeln: Regel[];
  pages: Page[];
  domains: CustomDomain[];
  sprachen: string[];
  ortVerfuegbar: boolean;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [dialog, setDialog] = useState<{ offen: boolean; regel: Regel | null }>(
    { offen: false, regel: null },
  );

  // Nur normale Seiten als Ziel — ein Pop-up auf einem Pop-up ist keine
  // sinnvolle Angabe, ein Ordner hat keinen Inhalt, und ein externer Link
  // gehört nicht uns.
  const seiten = pages
    .filter((p) => (p.page_type ?? "normal") === "normal")
    .map((p) => ({ slug: p.slug, title: p.title || t("seiten.startseite") }));
  const popups = pages
    .filter((p) => p.page_type === "popup")
    .map((p) => ({ id: p.id, title: p.title }));

  // Fremde Änderungen bemerken (Realtime). Die Personalisierungs-Regeln.
  // Welche Tabellen der Baukasten abonnieren darf und warum die übrigen
  // NICHT, steht an einer Stelle: `baukasten-realtime.ts`.
  useBaukastenRealtime({ tabellen: ["site_rules"] });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <BaukastenRahmen
        pages={pages}
        domains={domains}
        breit
        inhalt={
          <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold">{t("regeln.titel")}</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {t("regeln.einleitung")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ offen: true, regel: null })}
                className="flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                <Icon icon="ph:plus" className="size-4" />
                {t("regeln.neueRegel")}
              </button>
            </div>

            <RegelListe
              regeln={regeln}
              seiten={seiten}
              ortVerfuegbar={ortVerfuegbar}
              onBearbeiten={(r) => setDialog({ offen: true, regel: r })}
            />
          </div>
        }
      />

      {dialog.offen ? (
        <RegelDialog
          regel={dialog.regel}
          seiten={seiten}
          popups={popups}
          sprachen={sprachen}
          onFertig={() => {
            setDialog({ offen: false, regel: null });
            router.refresh();
          }}
          onAbbruch={() => setDialog({ offen: false, regel: null })}
        />
      ) : null}
    </div>
  );
}
