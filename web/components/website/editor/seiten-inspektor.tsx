"use client";

// Der Inspektor OHNE Auswahl — Framers Breakpoint-Wurzel („Desktop"), Stand
// der zweiten Live-Lesung vom 05.09.2026 (`docs/FRAMER-STYLE-PANEL-LIVE-
// 2026-09-05.md` §5, DOM eines leeren Breakpoints):
//
//   Ausrichtungsreihe (ohne Wirkung an der Wurzel)
//   Template +            → unsere Vorlagen
//   Haltepunkt            Position X · Y, Breite 1200 · Fest, Höhe · Inhalt
//   Layout +              (der Stapel der Seite SIND die Abschnitte)
//   Typography            Base
//   Overlays + · Cursor + · Effects +
//   Stile +               Füllen (Seitenhintergrund) · Überlauf
//   Codeüberschreibungen +
//
// Die Werte selbst werden NICHT hier ein zweites Mal geführt: der
// Seitenhintergrund und die Schrift liegen im Design-Panel (`DesignPanel`,
// eigener Entwurfsstand mit Autospeichern), die Vorlage im Vorlagen-Panel,
// Titel/Adresse/SEO im Dialog `SeitenEinstellungen`. Die Zeilen hier ZEIGEN
// den Wert und führen mit einem Klick dorthin — zwei Formulare für dieselbe
// Site-Konfiguration wären zwei Wahrheiten.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { Geraet } from "@nextdays/baukasten-stil";

import type { Branding } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";

import type { DesignUnterseite } from "../design-ansicht";
import { GERAET_SYMBOL } from "../vorschau";
import { AusrichtungsLeiste } from "./ausrichtungs-leiste";
import { RAHMEN_BREITE, RAHMEN_REIHE, rahmenUrsprung } from "./buehne";
import { SpaeterKopf } from "./stil-inspektor";

export function SeitenInspektor({
  seite,
  sprachen,
  sichtbar,
  aktiv,
  hoehen,
  branding,
  onAktiv,
  onRahmen,
  onEinstellungen,
  onDesign,
  onVorlagen,
}: {
  seite: Page;
  /** Sprachen, in denen die Seite geführt wird. */
  sprachen: readonly string[];
  /** Breakpoints, die als Rahmen auf der Fläche stehen. */
  sichtbar: readonly Geraet[];
  aktiv: Geraet;
  /** Die gemessene Inhaltshöhe je Rahmen (aus der Brücke, `seitenHoehe`). */
  hoehen: Readonly<Record<Geraet, number>>;
  /** Für Füllen (Seitenhintergrund) und Typografie — nur gelesen. */
  branding: Branding;
  onAktiv: (geraet: Geraet) => void;
  onRahmen: (geraet: Geraet, sichtbar: boolean) => void;
  onEinstellungen: () => void;
  /** Öffnet das Design-Panel auf der genannten Unterseite. */
  onDesign: (unterseite: DesignUnterseite) => void;
  /** Öffnet das Vorlagen-Panel. */
  onVorlagen: () => void;
}) {
  const t = useTranslations("website");
  const ursprung = rahmenUrsprung(sichtbar, aktiv);
  const hintergrund = branding.background_color;

  return (
    <div className="flex flex-col pb-8">
      {/* Framer zeigt die Reihe auch an der Wurzel — ohne Ziel, also ohne
          Wirkung. `laeuft` sperrt die Knöpfe. */}
      <AusrichtungsLeiste settings={{}} laeuft onSetzen={() => undefined} />

      <Kopf titel={t("canvas.vorlage")} onPlus={onVorlagen} plusLabel={t("canvas.zurVorlage")}>
        <Zeile label={t("canvas.seite")}>
          <Wert>{seite.title}</Wert>
        </Zeile>
        <Zeile label={t("canvas.adresse")}>
          <Wert mono>{seite.slug ? `/${seite.slug}` : "/"}</Wert>
        </Zeile>
        <Zeile label={t("canvas.sprachen")}>
          <Wert>{sprachen.map((s) => s.toUpperCase()).join(" · ") || "—"}</Wert>
        </Zeile>
        <Zeile label={t("canvas.status")}>
          <Wert>{seite.is_published ? t("canvas.veroeffentlicht") : t("canvas.entwurf")}</Wert>
        </Zeile>
        <SprungKnopf icon="ph:gear" onClick={onEinstellungen}>
          {t("seiten.einstellungen")}
        </SprungKnopf>
      </Kopf>

      {/* Haltepunkt: als EINZIGER Kopf ohne „+" und ohne „−" (nicht
          einklappbar) — so gemessen. */}
      <Kopf titel={t("canvas.haltepunkt")}>
        <Zeile label={t("stil.position.titel")}>
          <Zahl wert={ursprung.x} suffix="X" />
          <Zahl wert={ursprung.y} suffix="Y" />
        </Zeile>
        <Zeile label={t("stil.groesse.breite")}>
          <Zahl wert={RAHMEN_BREITE[aktiv]} />
          <Modus>{t("stil.groesse.modus.fest")}</Modus>
        </Zeile>
        <Zeile label={t("stil.groesse.hoehe")} hinweis={t("canvas.hoeheGemessen")}>
          <Zahl wert={Math.round(hoehen[aktiv])} />
          <Modus>{t("stil.groesse.modus.inhalt")}</Modus>
        </Zeile>
        <ul className="mt-1 flex flex-col gap-0.5">
          {RAHMEN_REIHE.map((g) => {
            const drin = sichtbar.includes(g);
            return (
              <li key={g} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!drin) onRahmen(g, true);
                    onAktiv(g);
                  }}
                  aria-pressed={aktiv === g}
                  className={
                    "flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs transition hover:bg-secondary " +
                    (aktiv === g ? "bg-secondary" : "") +
                    (drin ? "" : " text-muted-foreground")
                  }
                >
                  <Icon icon={GERAET_SYMBOL[g]} className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t(`canvas.geraet.${g}`)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{RAHMEN_BREITE[g]}</span>
                  {g === "desktop" ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground">{t("canvas.primaer")}</span>
                  ) : null}
                </button>
                {g !== "desktop" ? (
                  <button
                    type="button"
                    onClick={() => onRahmen(g, !drin)}
                    aria-pressed={drin}
                    aria-label={drin ? t("canvas.rahmenWeg") : t("canvas.rahmenHinzu")}
                    title={drin ? t("canvas.rahmenWeg") : t("canvas.rahmenHinzu")}
                    className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-foreground"
                  >
                    <Icon icon={drin ? "ph:eye" : "ph:eye-slash"} className="size-3.5" />
                  </button>
                ) : (
                  <span aria-hidden className="size-[1.375rem] shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-[0.6875rem] leading-snug text-muted-foreground">
          {t("canvas.breakpointsHinweis")}
        </p>
      </Kopf>

      {/* Layout: Framers „+" schaltet hier den Stack ein. Bei uns SIND die
          Abschnitte der Stapel — ihr Layout steht am Abschnitt (Wurzel 4:
          kein zweiter Stack, der nichts steuert). */}
      <Kopf titel={t("stil.layout.titel")} hinweis={t("canvas.layoutHinweis")} />

      <Kopf titel={t("canvas.typografie")}>
        <Zeile label={t("canvas.basis")}>
          <SprungWert onClick={() => onDesign("text")} title={t("canvas.imDesign")}>
            <Icon icon="ph:text-aa" className="size-3.5 shrink-0" />
            <span className="truncate">{branding.font_family ?? t("stil.automatisch")}</span>
          </SprungWert>
        </Zeile>
      </Kopf>

      <SpaeterKopf name="overlays" />
      <SpaeterKopf name="cursor" />
      <SpaeterKopf name="effekte" />

      <Kopf titel={t("stil.stil.titel")}>
        <Zeile label={t("stil.stil.fuellung")}>
          <SprungWert onClick={() => onDesign("farben")} title={t("canvas.imDesign")}>
            <span
              aria-hidden
              className="size-[22px] shrink-0 rounded-[5px] border border-border"
              style={
                hintergrund
                  ? { backgroundColor: hintergrund }
                  : {
                      backgroundImage:
                        "linear-gradient(45deg,rgba(127,127,127,.35) 25%,transparent 25%,transparent 75%,rgba(127,127,127,.35) 75%),linear-gradient(45deg,rgba(127,127,127,.35) 25%,transparent 25%,transparent 75%,rgba(127,127,127,.35) 75%)",
                      backgroundSize: "8px 8px",
                      backgroundPosition: "0 0,4px 4px",
                    }
              }
            />
            <span className="truncate font-mono uppercase">
              {hintergrund ? hintergrund.replace(/^#/, "") : t("stil.automatisch")}
            </span>
          </SprungWert>
        </Zeile>
      </Kopf>

      <SpaeterKopf name="code" />
    </div>
  );
}

// --- Bausteine im Framer-Maß (Kopf 40 px, Zeile 30 px, Beschriftung 88 px) --

function Kopf({
  titel,
  onPlus,
  plusLabel,
  hinweis,
  children,
}: {
  titel: string;
  onPlus?: () => void;
  plusLabel?: string;
  /** Kopf ohne Rumpf: der Grund steht als Tooltip und graut den Titel aus. */
  hinweis?: string;
  children?: ReactNode;
}) {
  const leer = !children;
  return (
    <div className="border-b border-border last:border-b-0" title={hinweis}>
      <div className="flex h-10 items-center gap-2 px-2.5">
        <span
          className={
            "min-w-0 flex-1 truncate text-[0.8125rem] font-semibold " +
            (leer ? "text-muted-foreground" : "")
          }
        >
          {titel}
        </span>
        {onPlus ? (
          <button
            type="button"
            onClick={onPlus}
            aria-label={plusLabel}
            title={plusLabel}
            className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:plus" className="size-3.5" />
          </button>
        ) : leer ? (
          <span className="shrink-0 rounded p-1 text-muted-foreground/40">
            <Icon icon="ph:plus" className="size-3.5" />
          </span>
        ) : null}
      </div>
      {children ? <div className="flex flex-col gap-1 px-2.5 pb-2.5">{children}</div> : null}
    </div>
  );
}

/** Framers Zeile: Beschriftung 80 px, dann die Felder über die volle Restbreite
 *  (kein Platzhalter für einen Knopf — hier gibt es nichts zu löschen). */
function Zeile({ label, hinweis, children }: { label: string; hinweis?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[30px] items-center gap-2" title={hinweis}>
      <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

function Wert({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <span className={"min-w-0 flex-1 truncate text-xs " + (mono ? "font-mono" : "")}>{children}</span>
  );
}

/** Zahlfeld wie Framers `input` mit Kürzel rechts — hier nur lesend: Breite
 *  und Höhe der Rahmen sind Konstanten bzw. Messwerte, keine Eingaben. */
function Zahl({ wert, suffix }: { wert: number; suffix?: string }) {
  return (
    <span className="flex h-[30px] min-w-0 flex-1 items-center rounded-md bg-secondary px-1.5 text-xs tabular-nums">
      <span className="min-w-0 flex-1 truncate">{wert}</span>
      {suffix ? <span className="shrink-0 text-[10px] text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

function Modus({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-[30px] min-w-0 flex-1 items-center justify-between gap-0.5 rounded-md bg-secondary px-1.5 text-xs text-muted-foreground">
      <span className="truncate">{children}</span>
      <Icon icon="ph:caret-down" className="size-3 shrink-0 opacity-60" aria-hidden />
    </span>
  );
}

/** Wert, der zu seinem Formular springt (Framers Popout-Knopf mit Kachel). */
function SprungWert({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-md bg-secondary px-1 pr-2 text-left text-xs transition hover:bg-secondary/70"
    >
      {children}
      <Icon icon="ph:arrow-square-out" className="ml-auto size-3 shrink-0 opacity-60" aria-hidden />
    </button>
  );
}

function SprungKnopf({ icon, onClick, children }: { icon: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 flex h-[30px] w-full items-center justify-center gap-1.5 rounded-md bg-secondary text-xs font-medium transition hover:bg-secondary/70"
    >
      <Icon icon={icon} className="size-3.5" />
      {children}
    </button>
  );
}
