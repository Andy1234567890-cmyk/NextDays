"use client";

// Kundenstimmen als Karussell.
//
// Referenz-UX (hostaway.com, Sektion „Trusted worldwide"): Eyebrow über einer
// zentrierten Überschrift, darunter drei Karten nebeneinander — die mittlere
// größer und angehoben, die äußeren zurückgenommen. Runde Pfeile links und
// rechts blättern durch, auf schmalen Bildschirmen wird daraus eine
// wischbare Reihe.
//
// Inhalt kommt aus `content/stimmen.ts`. Ist dort nichts hinterlegt, rendert
// diese Sektion NICHTS — kein Skelett und keine erfundenen Namen. Zum
// Beurteilen des Layouts gibt es `?vorschau=stimmen`; die Karten sind dort
// sichtbar als Beispiel markiert.
import { useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { Icon } from "@/components/ui/icon";
import { STIMMEN, STIMMEN_VORSCHAU, type Stimme } from "@/content/stimmen";

export function MarketingStimmen() {
  const t = useTranslations("stimmen");
  const params = useSearchParams();
  const vorschau = params.get("vorschau") === "stimmen";

  const stimmen = vorschau && STIMMEN.length === 0 ? STIMMEN_VORSCHAU : STIMMEN;

  // Index der mittleren, hervorgehobenen Karte.
  const [aktiv, setAktiv] = useState(0);

  // Drei sichtbare Karten, zyklisch um `aktiv` herum. Hervorgehoben ist immer
  // die MITTLERE Spalte — bei genau drei Stimmen also die zweite, unabhängig
  // davon, welcher Index gerade aktiv ist. Bei weniger als drei Stimmen wird
  // nicht aufgefüllt; dann steht eine bzw. stehen zwei Karten da.
  const sichtbar = useMemo(() => {
    const n = stimmen.length;
    if (n === 0) return [];
    if (n <= 3) {
      const mitteIndex = Math.floor((n - 1) / 2);
      return stimmen.map((s, i) => ({ stimme: s, mitte: i === mitteIndex }));
    }
    return [-1, 0, 1].map((versatz) => ({
      stimme: stimmen[(aktiv + versatz + n) % n],
      mitte: versatz === 0,
    }));
  }, [stimmen, aktiv]);

  if (stimmen.length === 0) return null;

  const blaettern = (richtung: -1 | 1) =>
    setAktiv((i) => (i + richtung + stimmen.length) % stimmen.length);

  const mehrAlsSichtbar = stimmen.length > 3;

  return (
    <section id="stimmen" className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} />

        {vorschau && STIMMEN.length === 0 ? (
          <p className="mx-auto mt-6 max-w-xl rounded-full bg-foreground/5 px-5 py-2 text-center text-sm text-muted-foreground">
            {t("vorschauHinweis")}
          </p>
        ) : null}

        <div className="relative mt-14">
          {/* Pfeile: nur, wenn es mehr Stimmen gibt, als gleichzeitig passen. */}
          {mehrAlsSichtbar ? (
            <>
              <BlaetterKnopf
                richtung="zurueck"
                label={t("zurueck")}
                onClick={() => blaettern(-1)}
              />
              <BlaetterKnopf
                richtung="vor"
                label={t("vor")}
                onClick={() => blaettern(1)}
              />
            </>
          ) : null}

          {/* Karten: auf kleinen Bildschirmen wischbare Reihe, ab md drei
              nebeneinander mit angehobener Mitte. */}
          <ul
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:items-center md:overflow-visible md:pb-0"
            style={{ scrollbarWidth: "none" }}
          >
            {sichtbar.map(({ stimme, mitte }) => (
              <li
                key={stimme.id}
                className={
                  "min-w-[85%] snap-center sm:min-w-[60%] md:min-w-0 " +
                  (mitte ? "md:z-10" : "")
                }
              >
                <StimmenKarte stimme={stimme} hervorgehoben={mitte} />
              </li>
            ))}
          </ul>

          {/* Punkte als Standortanzeige, wenn geblättert werden kann. */}
          {mehrAlsSichtbar ? (
            <div className="mt-8 flex justify-center gap-2">
              {stimmen.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={t("zeigeStimme", { nummer: i + 1 })}
                  aria-current={i === aktiv}
                  onClick={() => setAktiv(i)}
                  className={
                    "h-2 rounded-full transition-all " +
                    (i === aktiv ? "w-6 bg-accent" : "w-2 bg-foreground/20")
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// --- Bausteine --------------------------------------------------------------

function StimmenKarte({
  stimme,
  hervorgehoben,
}: {
  stimme: Stimme;
  hervorgehoben: boolean;
}) {
  return (
    <figure
      className={
        "flex h-full flex-col gap-4 rounded-3xl bg-card p-7 transition-all " +
        (hervorgehoben
          ? "shadow-float-lg md:z-10 md:scale-[1.06] md:p-8"
          : "border border-border/60 md:my-4 md:opacity-80")
      }
    >
      <div className="flex items-center gap-4">
        <Avatar stimme={stimme} />
        <figcaption className="min-w-0">
          <span className="block truncate font-semibold">{stimme.name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {stimme.betrieb}
          </span>
        </figcaption>
      </div>

      {/* Sterne nur, wenn die Person wirklich bewertet hat (Wurzel 4). */}
      {stimme.sterne ? <Sterne anzahl={stimme.sterne} /> : null}

      <blockquote className="text-pretty leading-relaxed text-muted-foreground">
        {stimme.zitat}
      </blockquote>
    </figure>
  );
}

function Avatar({ stimme }: { stimme: Stimme }) {
  if (stimme.foto) {
    return (
      <span className="relative size-12 shrink-0 overflow-hidden rounded-full">
        <Image
          src={stimme.foto}
          alt={stimme.name}
          fill
          sizes="3rem"
          className="object-cover"
        />
      </span>
    );
  }
  // Ohne Foto die Initialen — kein generisches Fremdbild und kein Fantasie-
  // Portrait, das eine Person suggeriert, die es nicht gibt.
  const initialen = stimme.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((teil) => teil[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
    >
      {initialen}
    </span>
  );
}

function Sterne({ anzahl }: { anzahl: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${anzahl} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon
          key={i}
          icon="ph:star-fill"
          aria-hidden
          className={i < anzahl ? "size-4 text-accent" : "size-4 text-foreground/15"}
        />
      ))}
    </div>
  );
}

function BlaetterKnopf({
  richtung,
  label,
  onClick,
}: {
  richtung: "zurueck" | "vor";
  label: string;
  onClick: () => void;
}) {
  const zurueck = richtung === "zurueck";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={
        "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-float-lg transition hover:brightness-110 md:flex " +
        (zurueck ? "-left-5" : "-right-5")
      }
    >
      <Icon
        icon={zurueck ? "ph:caret-left-bold" : "ph:caret-right-bold"}
        className="size-5"
      />
    </button>
  );
}
