"use client";

// Kopf- und Fußzeile als EBENEN im Baum (0570, Framer-Parität 05.09.2026).
//
// Framer führt Header und Footer im Layers-Panel als aufklappbare Frames mit
// Kindern; bei uns kommen beide aus dem Theme, ihre Teile sind fest
// programmiert (Logo, Navigation, Buchen-Knopf …). Der Baum zeigt sie trotzdem
// als Ebenen: aufklappen, Teil wählen (der Canvas rahmt es, der Inspektor
// zeigt seine Einstellungen), Auge je Gerät, Schloss, Ziehen innerhalb der
// Gruppe. Gespeichert wird site-weit im Branding (`header_teile`/`footer_teile`),
// gelesen über `regionLesen` aus `@nextdays/baukasten-stil` — dieselbe Funktion,
// die der Renderer nutzt.
//
// Was hier NICHT geht, und warum es nicht als toter Knopf dasteht: Umbenennen
// (die Namen sind Übersetzungen, kein Kundenname), Löschen/Duplizieren (ein
// Teil ist Theme-Code) und Ziehen von Logo/Slogan (im Theme fest verortet).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type DragEvent, useState } from "react";

import {
  KOPF_GRUPPE,
  type Region,
  type RegionStand,
  teilStand,
} from "@nextdays/baukasten-stil";

import { EINRUECKUNG_REM, GRUND_REM, ZEILE } from "./ebenen-masse";
import { protokoll } from "./editor/protokoll";
import { umgeschaltet } from "./editor/sichtbarkeit";
import type { Geraet } from "./vorschau";

/** Die gewählte Ebene in einer Region: `teil === null` = die Region selbst. */
export type RegionAuswahl = { region: Region; teil: string | null };

const DRAG_TYP = "application/x-nextdays-regionteil";

/** Symbol je Teil — wie `symbolFuer` im Block-Baum: Bild-, Text-, Knopf-Zeichen,
 *  damit man den Teil erkennt, bevor man den Namen liest. */
const SYMBOL: Record<string, string> = {
  logo: "ph:image-square",
  slogan: "ph:text-aa",
  navigation: "ph:list",
  sprachwaehler: "ph:translate",
  buchen: "ph:cursor-click",
  social: "ph:share-network",
  bildnachweise: "ph:camera",
  copyright: "ph:copyright",
};

/** Welche Teile sich ziehen lassen: in der Kopfzeile nur die rechte Gruppe. */
export function beweglicheTeile(region: Region): readonly string[] | undefined {
  return region === "kopfzeile" ? KOPF_GRUPPE : undefined;
}

export function RegionBaum({
  region,
  stand,
  geraet,
  auswahl,
  onWaehle,
  onVersteckt,
  onSperren,
  onZiehen,
}: {
  region: Region;
  stand: RegionStand;
  geraet: Geraet;
  auswahl: RegionAuswahl | null;
  onWaehle: (auswahl: RegionAuswahl) => void;
  onVersteckt?: (auswahl: RegionAuswahl, geraete: Geraet[]) => void;
  onSperren?: (auswahl: RegionAuswahl, locked: boolean) => void;
  /** `teil` VOR `vorTeil` stellen — nur innerhalb der beweglichen Gruppe. */
  onZiehen?: (region: Region, teil: string, vorTeil: string) => void;
}) {
  const t = useTranslations("website");
  const [zu, setZu] = useState(false);
  const [zieht, setZieht] = useState<string | null>(null);
  const [ueberZiel, setUeberZiel] = useState<string | null>(null);
  const beweglich = beweglicheTeile(region);

  const regionGewaehlt = auswahl?.region === region && auswahl.teil === null;
  const teilGewaehlt = (teil: string) =>
    auswahl?.region === region && auswahl.teil === teil;
  const imTeilbaum = regionGewaehlt;

  function zeile(teil: string | null, tiefe: number) {
    const st = teil === null ? stand : teilStand(stand, teil);
    const gewaehlt = teil === null ? regionGewaehlt : teilGewaehlt(teil);
    const versteckt = st.hidden_on;
    const auswahlHier: RegionAuswahl = { region, teil };
    const label =
      teil === null ? t(`ebenen.${region}`) : t(`ebenen.teile.${teil}`);
    const ziehbar =
      teil !== null &&
      Boolean(onZiehen) &&
      !st.locked &&
      (!beweglich || beweglich.includes(teil));
    const ablageErlaubt =
      teil !== null &&
      zieht !== null &&
      zieht !== teil &&
      (!beweglich || beweglich.includes(teil));

    return (
      <div
        key={teil ?? region}
        role="treeitem"
        aria-selected={gewaehlt}
        aria-expanded={teil === null ? !zu : undefined}
        aria-level={tiefe + 1}
        draggable={ziehbar}
        onDragStart={(e: DragEvent) => {
          if (!ziehbar || teil === null) return;
          e.stopPropagation();
          e.dataTransfer.setData(DRAG_TYP, teil);
          e.dataTransfer.effectAllowed = "move";
          setZieht(teil);
          protokoll("klick", "Regionsteil ziehen: Start", { region, teil });
        }}
        onDragEnd={() => {
          setZieht(null);
          setUeberZiel(null);
        }}
        onDragOver={(e: DragEvent) => {
          if (!ablageErlaubt || !e.dataTransfer.types.includes(DRAG_TYP)) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          setUeberZiel(teil);
        }}
        onDragLeave={() => setUeberZiel((z) => (z === teil ? null : z))}
        onDrop={(e: DragEvent) => {
          if (!ablageErlaubt || !zieht || teil === null) return;
          e.preventDefault();
          e.stopPropagation();
          protokoll("klick", "Regionsteil ziehen: Abwurf", {
            region,
            quelle: zieht,
            vor: teil,
          });
          onZiehen?.(region, zieht, teil);
          setZieht(null);
          setUeberZiel(null);
        }}
        onClick={() => {
          protokoll("klick", "Regionsebene gewählt", auswahlHier);
          onWaehle(auswahlHier);
        }}
        style={{ paddingLeft: `${GRUND_REM + tiefe * EINRUECKUNG_REM}rem` }}
        className={
          `group/zeile relative flex ${ZEILE} cursor-default items-center gap-1.5 pr-2 text-xs transition ` +
          (zieht !== null && zieht === teil ? "opacity-40 " : "") +
          (gewaehlt
            ? `bg-(--brand) text-white ${teil === null && !zu ? "rounded-t-lg" : "rounded-lg"}`
            : imTeilbaum && teil !== null
              ? "bg-(--brand)/10 text-foreground"
              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground")
        }
      >
        {ueberZiel === teil && teil !== null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded-full bg-(--brand)"
          />
        ) : null}

        <span className="flex w-4 shrink-0 justify-center">
          {teil === null ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZu((z) => !z);
              }}
              aria-label={t(zu ? "ebenen.aufklappen" : "ebenen.zuklappen")}
              className={
                "rounded p-0.5 transition " +
                (gewaehlt
                  ? "text-white/80 hover:text-white"
                  : "text-muted-foreground/70 hover:text-foreground")
              }
            >
              <Icon icon={zu ? "ph:caret-right" : "ph:caret-down"} className="size-3" />
            </button>
          ) : null}
        </span>

        <Icon
          icon={teil === null ? "ph:layout" : (SYMBOL[teil] ?? "ph:square")}
          className={
            "size-3.5 shrink-0 " +
            (gewaehlt ? "text-white" : teil === null ? "text-orange-500" : "text-muted-foreground")
          }
        />

        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className={"truncate " + (teil === null ? "font-medium" : "")}>{label}</span>
          {teil === null ? (
            <span
              className={
                "min-w-0 truncate text-[0.6875rem] " +
                (gewaehlt ? "text-white/70" : "text-muted-foreground/70")
              }
            >
              · {t("ebenen.ausTheme")}
            </span>
          ) : null}
        </span>

        {st.locked ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSperren?.(auswahlHier, false);
            }}
            aria-label={t("ebenen.entsperren")}
            title={t("ebenen.entsperren")}
            className={"shrink-0 rounded p-0.5 " + (gewaehlt ? "text-white" : "text-muted-foreground")}
          >
            <Icon icon="ph:lock-simple-fill" className="size-3.5" />
          </button>
        ) : null}

        {onVersteckt ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const neu = umgeschaltet(versteckt, geraet);
              protokoll("klick", "Regionsteil je Gerät", { region, teil, geraet, versteckt: neu });
              onVersteckt(auswahlHier, neu);
            }}
            aria-label={
              versteckt.includes(geraet)
                ? t("arbeitsflaeche.einblenden", { geraet: t(`arbeitsflaeche.${geraet}`) })
                : t("arbeitsflaeche.ausblendenAuf")
            }
            title={
              versteckt.includes(geraet)
                ? t("arbeitsflaeche.einblenden", { geraet: t(`arbeitsflaeche.${geraet}`) })
                : t("ebenen.verstecktAufGeraet", { geraet: t(`arbeitsflaeche.${geraet}`) })
            }
            className={
              "shrink-0 rounded p-0.5 transition " +
              (versteckt.includes(geraet)
                ? gewaehlt
                  ? "text-white"
                  : "text-orange-500 hover:text-orange-600"
                : (gewaehlt ? "text-white/80 " : "text-muted-foreground ") +
                  "opacity-0 group-hover/zeile:opacity-100 focus:opacity-100")
            }
          >
            <Icon icon={versteckt.includes(geraet) ? "ph:eye-slash" : "ph:eye"} className="size-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {zeile(null, 1)}
      {!zu ? (
        <div className={regionGewaehlt ? "rounded-b-lg bg-(--brand)/10" : ""}>
          {stand.reihenfolge.map((teil) => zeile(teil, 2))}
        </div>
      ) : null}
    </div>
  );
}
