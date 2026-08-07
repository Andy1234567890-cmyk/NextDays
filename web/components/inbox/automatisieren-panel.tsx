"use client";

// „Nachrichten automatisieren" — das Panel aus dem Posteingang-Kopf, in der
// Form, die Lodgify dafür gefunden hat (live abgelesen 07.08.2026):
//
//   Stufe 1: Menü mit drei Einstiegen (Geplante Nachrichten · Schnellantworten
//            · Sprachen).
//   Stufe 2: die Regeln, gruppiert nach Lebenszyklus, je Zeile Name, Reichweite
//            und Status; lange Gruppen hinter „Mehr anzeigen (n)".
//   Stufe 3: eine Regel im Detail — aufklappbare Abschnitte statt einer langen
//            Maske.
//
// Warum ein Panel und kein Tab: die Regeln beantworten „was geht automatisch
// raus?", während man einen Verlauf liest. Als eigener Tab reißt es einen aus
// dem Posteingang; als Panel legt es sich darüber und man ist mit einem Klick
// zurück.
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  PHASEN,
  istZeitplanRegel,
  phaseVon,
  zeitachse,
} from "@/lib/automation-phasen";
import { channelLogoLoose } from "@/lib/channel-logos";
import {
  type Automation,
  deleteAutomation,
  listAutomations,
  updateAutomation,
} from "@/lib/inbox";

// So viele Regeln zeigt ein Abschnitt sofort; der Rest steckt hinter
// „Mehr anzeigen (n)" — wie bei Lodgify, damit ein Betrieb mit 15 Regeln je
// Phase nicht scrollen muss, um die nächste Überschrift zu sehen.
const SOFORT_SICHTBAR = 4;

type Ansicht = "menu" | "liste" | { regel: Automation };

export function AutomatisierenPanel({
  offen,
  onOffenChange,
}: {
  offen: boolean;
  onOffenChange: (o: boolean) => void;
}) {
  const t = useTranslations("inbox");
  const [ansicht, setAnsicht] = useState<Ansicht>("menu");
  const [items, setItems] = useState<Automation[]>([]);
  const [geladen, setGeladen] = useState(false);

  async function load() {
    const res = await listAutomations();
    if (res.ok) setItems(res.data.items);
    setGeladen(true);
  }

  useEffect(() => {
    if (offen) load();
    else setAnsicht("menu");
  }, [offen]);

  const titel =
    ansicht === "menu"
      ? t("autoPanelTitle")
      : ansicht === "liste"
        ? t("autoScheduledTitle")
        : ansicht.regel.name;

  return (
    <Sheet open={offen} onOpenChange={onOffenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="flex-row items-center gap-2 border-b border-border p-4">
          {ansicht !== "menu" && (
            <button
              type="button"
              onClick={() => setAnsicht(ansicht === "liste" ? "menu" : "liste")}
              aria-label={t("autoBack")}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Icon icon="ph:arrow-left" className="size-5" />
            </button>
          )}
          <SheetTitle className="flex-1 text-center">{titel}</SheetTitle>
        </SheetHeader>

        {ansicht === "menu" ? (
          <MenuAnsicht onGeplante={() => setAnsicht("liste")} />
        ) : ansicht === "liste" ? (
          <ListenAnsicht
            items={items}
            geladen={geladen}
            onOeffnen={(r) => setAnsicht({ regel: r })}
          />
        ) : (
          <DetailAnsicht
            regel={ansicht.regel}
            onGeaendert={async () => {
              await load();
              setAnsicht("liste");
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Stufe 1 — die drei Einstiege. */
function MenuAnsicht({ onGeplante }: { onGeplante: () => void }) {
  const t = useTranslations("inbox");
  const eintraege = [
    {
      icon: "ph:calendar-dots",
      titel: t("autoScheduledTitle"),
      text: t("autoScheduledHint"),
      onClick: onGeplante,
    },
    {
      icon: "ph:lightning",
      titel: t("autoQuickTitle"),
      text: t("autoQuickHint"),
      onClick: null,
    },
    {
      icon: "ph:translate",
      titel: t("autoLanguagesTitle"),
      text: t("autoLanguagesHint"),
      onClick: null,
    },
  ];
  return (
    <ul className="flex flex-col gap-1 overflow-y-auto p-4">
      {eintraege.map((e) => (
        <li key={e.titel}>
          <button
            type="button"
            onClick={e.onClick ?? undefined}
            disabled={!e.onClick}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <Icon icon={e.icon} className="size-6 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{e.titel}</span>
              <span className="block text-sm text-muted-foreground">{e.text}</span>
            </span>
            {e.onClick && (
              <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Stufe 2 — Regeln nach Lebenszyklus gruppiert. */
function ListenAnsicht({
  items,
  geladen,
  onOeffnen,
}: {
  items: Automation[];
  geladen: boolean;
  onOeffnen: (a: Automation) => void;
}) {
  const t = useTranslations("inbox");
  // Aufgeklappte Abschnitte („Mehr anzeigen" gedrückt).
  const [offeneGruppen, setOffeneGruppen] = useState<string[]>([]);

  const gruppen = useMemo(() => {
    const zeitplan = items.filter(istZeitplanRegel);
    const nachEingang = items.filter((a) => !istZeitplanRegel(a));
    const map = new Map<string, Automation[]>();
    for (const p of PHASEN) map.set(p, []);
    for (const a of zeitplan) map.get(phaseVon(a))?.push(a);
    for (const liste of map.values()) liste.sort((x, y) => zeitachse(x) - zeitachse(y));
    if (nachEingang.length > 0) map.set("reply", nachEingang);
    return [...map.entries()].filter(([, liste]) => liste.length > 0);
  }, [items]);

  if (!geladen) {
    return <p className="p-6 text-sm text-muted-foreground">{t("autoLoading")}</p>;
  }
  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">{t("autoEmpty")}</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {gruppen.map(([phase, liste]) => {
          const offen = offeneGruppen.includes(phase);
          const sichtbar = offen ? liste : liste.slice(0, SOFORT_SICHTBAR);
          const rest = liste.length - sichtbar.length;
          return (
            <section key={phase}>
              <h3 className="px-1 pb-2 pt-5 text-sm font-semibold text-muted-foreground">
                {t(`autoPhase_${phase}` as never)}
              </h3>
              <ul className="flex flex-col gap-2">
                {sichtbar.map((a) => (
                  <li key={a.id}>
                    <RegelZeile regel={a} onClick={() => onOeffnen(a)} />
                  </li>
                ))}
              </ul>
              {(rest > 0 || offen) && (
                <button
                  type="button"
                  onClick={() =>
                    setOffeneGruppen((prev) =>
                      offen ? prev.filter((p) => p !== phase) : [...prev, phase],
                    )
                  }
                  className="mt-2 px-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  {offen ? t("autoShowLess") : t("autoShowMore", { count: rest })}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Eine Regel als Zeile: Zeitplan-Zeile darüber, darunter Name, Kanal-Logos,
 * Reichweite und Status — die Verdichtung, die Lodgify zeigt.
 */
function RegelZeile({ regel, onClick }: { regel: Automation; onClick: () => void }) {
  const t = useTranslations("inbox");
  return (
    <>
      <p className="px-1 pb-1 text-xs text-muted-foreground">{zeitplanText(regel, t)}</p>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left hover:border-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{regel.name}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <KanalLogos kanaele={regel.channels} />
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {regel.property_ids.length === 0
                ? t("autoAllHouses")
                : `${regel.property_ids.length} ${t("autoHousesCount")}`}
            </span>
            <StatusChip aktiv={regel.is_active} />
          </span>
        </span>
        <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </>
  );
}

/**
 * Kanal-Logos wie im Kanalmanager (echte Marken, `lib/channel-logos`). Eine
 * Regel ohne Kanal-Einschränkung gilt für alle — dann steht hier nichts, statt
 * fünf Logos zu zeigen, die eine Auswahl behaupten, die niemand getroffen hat.
 */
function KanalLogos({ kanaele }: { kanaele: string[] }) {
  if (kanaele.length === 0) return null;
  return (
    <>
      {kanaele.map((k) => {
        const logo = channelLogoLoose(k);
        return logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={logo} alt={k} title={k} className="size-4 rounded-sm object-contain" />
        ) : (
          <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {k}
          </span>
        );
      })}
    </>
  );
}

function StatusChip({ aktiv }: { aktiv: boolean }) {
  const t = useTranslations("inbox");
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-xs font-medium " +
        (aktiv
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400")
      }
    >
      {aktiv ? t("autoActive") : t("autoPaused")}
    </span>
  );
}

/** Stufe 3 — eine Regel im Detail, in aufklappbaren Abschnitten. */
function DetailAnsicht({
  regel,
  onGeaendert,
}: {
  regel: Automation;
  onGeaendert: () => void;
}) {
  const t = useTranslations("inbox");
  const [pending, start] = useTransition();

  function umschalten() {
    start(async () => {
      await updateAutomation(regel.id, { ...regel, is_active: !regel.is_active });
      onGeaendert();
    });
  }

  function loeschen() {
    start(async () => {
      await deleteAutomation(regel.id);
      onGeaendert();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <label className="flex items-center justify-between rounded-2xl border border-border p-3">
          <span className="text-sm font-medium">{t("autoEnableMessage")}</span>
          <input
            type="checkbox"
            checked={regel.is_active}
            onChange={umschalten}
            disabled={pending}
            className="size-4 accent-[var(--accent)]"
          />
        </label>

        <Abschnitt titel={t("autoSectionContent")}>
          {regel.message ? (
            <p className="whitespace-pre-wrap break-words text-sm">{regel.message}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("autoFromTemplate")}</p>
          )}
        </Abschnitt>

        <Abschnitt titel={t("autoSectionSchedule")}>
          <p className="text-sm text-muted-foreground">{zeitplanText(regel, t)}</p>
        </Abschnitt>

        <Abschnitt titel={t("autoSectionChannels")}>
          {regel.channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("autoAllChannels")}</p>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <KanalLogos kanaele={regel.channels} />
              <span className="text-sm text-muted-foreground">
                {regel.channels.join(", ")}
              </span>
            </span>
          )}
        </Abschnitt>

        <Abschnitt titel={t("autoSectionHouses")}>
          <p className="text-sm text-muted-foreground">
            {regel.property_ids.length === 0
              ? t("autoAllHouses")
              : `${regel.property_ids.length} ${t("autoHousesCount")}`}
          </p>
        </Abschnitt>
      </div>

      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button type="button" variant="outline" onClick={loeschen} disabled={pending}>
          <Icon icon="ph:trash" className="size-4" />
          {t("autoDelete")}
        </Button>
      </div>
    </div>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  const [offen, setOffen] = useState(false);
  return (
    <article className="rounded-2xl border border-border">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        <span className="flex-1 font-semibold">{titel}</span>
        <Icon
          icon={offen ? "ph:caret-up" : "ph:caret-down"}
          className="size-4 text-muted-foreground"
        />
      </button>
      {offen && <div className="border-t border-border p-3">{children}</div>}
    </article>
  );
}

/**
 * Der Zeitplan als Satz: „3 Tage vor der Ankunft des Gastes".
 *
 * Dieselbe Regel wie im Automatisierungen-Tab — hier NICHT neu erfunden,
 * sondern aus den vorhandenen Bausteinen zusammengesetzt, damit dieselbe Regel
 * an beiden Stellen gleich heißt.
 */
function zeitplanText(
  a: Automation,
  t: (k: string, v?: Record<string, string | number | Date>) => string,
): string {
  if (!istZeitplanRegel(a)) {
    const fenster =
      a.window_from && a.window_to ? `${a.window_from}–${a.window_to}` : t("autoAlways");
    return `${t("autoTrigger_message_received")} · ${fenster}`;
  }
  const abs = Math.abs(a.offset_value);
  const anker = t(`autoAnchor_${a.anchor}`);
  const zeit = a.send_time ? ` · ${a.send_time}` : "";
  if (abs === 0) return `${t("autoOnDayOf", { anchor: anker })}${zeit}`;
  const richtung = a.offset_value < 0 ? t("autoBefore") : t("autoAfter");
  return `${abs} ${t(`autoUnit_${a.offset_unit}`)} ${richtung} ${anker}${zeit}`;
}
