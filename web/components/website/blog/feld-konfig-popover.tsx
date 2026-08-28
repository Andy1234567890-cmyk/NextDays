"use client";

// DIE FELDKONFIGURATION (0481) — Framer-Analyse Abschnitt C1.
//
//     ┌─ Anriss ──────────────────── × ─┐
//     │ Name          [Anriss        ]  │
//     │ Beschreibung  [              ]  │
//     │ Erforderlich   Ja │ Nein        │
//     │ Textbereich    Ja │ Nein        │
//     │ Platzhalter   [              ]  │
//     │ Max. Zeichen  [   ] Zurücksetzen│
//     └─────────────────────────────────┘
//
// Abschnitt G hält fest, warum das ins PRODUKT gehört und nicht in eine
// Migration: Name, Beschreibung, Pflichtfeld, ein-/mehrzeilig, Platzhalter und
// Maximallänge sind pro Feld einstellbar — es ist eine Entscheidung des
// Betriebs, keine Struktur.
//
// WELCHE ZEILEN ERSCHEINEN, HÄNGT VOM TYP AB
// ==========================================
// Genau wie im Vorbild (C1-Tabelle): ein Bildfeld hat keinen „Textbereich",
// ein Schalter hat keinen Platzhalter. Zeilen zu zeigen, die für diesen Typ
// nichts tun, wären Attrappen — der Kunde stellt etwas ein, und nichts
// passiert.
//
// EINE SPRACHE PRO OBERFLÄCHE
// ===========================
// Abschnitt C1 nennt einen Fehler des Vorbilds ausdrücklich: dasselbe Popover
// heißt dort bei einem Feld `Name / Beschreibung / Erforderlich`, beim
// nächsten `Name / Description / Required`. Framers Übersetzung ist lückenhaft.
// Bei uns kommt JEDE Beschriftung aus `next-intl` — 24 Sprachen, eine Quelle.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Input } from "@nextdays/ui/input";
import { cn } from "@nextdays/ui/utils";

import {
  type FeldDef,
  type FeldKonfig,
  NICHT_VERSTECKBAR,
  OHNE_VORGABE,
} from "./felder";

/** Ein Ja/Nein-Segment wie im Vorbild (E3: 68 × 28, aktiv in der Primärfarbe). */
function JaNein({
  wert,
  gesperrt,
  gesperrtGrund,
  onWert,
}: {
  wert: boolean;
  gesperrt?: boolean;
  gesperrtGrund?: string;
  onWert: (v: boolean) => void;
}) {
  const t = useTranslations("website");
  return (
    <div
      title={gesperrt ? gesperrtGrund : undefined}
      className={cn(
        "inline-flex overflow-hidden rounded-(--radius) border border-border",
        gesperrt && "opacity-50",
      )}
    >
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          disabled={gesperrt}
          onClick={() => onWert(v)}
          aria-pressed={wert === v}
          className={cn(
            "px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed",
            wert === v
              ? "bg-(--brand)/10 font-semibold text-(--brand)"
              : "text-muted-foreground hover:bg-secondary/60",
          )}
        >
          {v ? t("blog.feld.ja") : t("blog.feld.nein")}
        </button>
      ))}
    </div>
  );
}

export function FeldKonfigPopover({
  def,
  konfig,
  name,
  quellfelder,
  onAendern,
  onZuruecksetzen,
  onSchliessen,
}: {
  def: FeldDef;
  /** Der GELTENDE Stand: gespeicherte Abweichung oder die Katalog-Vorgabe. */
  konfig: FeldKonfig;
  /** Der eingebaute Name — er steht als Platzhalter im Namensfeld, damit man
   *  sieht, wie das Feld ohne Abweichung heißt. */
  name: string;
  /** Die Felder, aus denen sich eine Vorgabe ABLEITEN lässt (Framers
   *  „Based on"). Sie kommen von aussen, weil dazu auch die EIGENEN Felder
   *  des Betriebs gehören — der Katalog allein kennt sie nicht. */
  quellfelder: readonly { key: string; name: string }[];
  onAendern: (neu: FeldKonfig) => void;
  onZuruecksetzen: () => void;
  onSchliessen: () => void;
}) {
  const t = useTranslations("website");
  const huelle = useRef<HTMLDivElement>(null);
  const [stand, setStand] = useState<FeldKonfig>(konfig);

  // Ein Klick daneben schließt. Kein Speichern-Knopf: jede Zeile schreibt
  // sofort, wie im Vorbild — dort gibt es im Feld-Popover ebenfalls keinen.
  useEffect(() => {
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) onSchliessen();
    }
    function aufTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
    }
    document.addEventListener("mousedown", aufKlick);
    document.addEventListener("keydown", aufTaste);
    return () => {
      document.removeEventListener("mousedown", aufKlick);
      document.removeEventListener("keydown", aufTaste);
    };
  }, [onSchliessen]);

  function setzen<K extends keyof FeldKonfig>(key: K, wert: FeldKonfig[K]) {
    const neu = { ...stand, [key]: wert };
    setStand(neu);
    onAendern(neu);
  }

  // Welche Zeilen dieser Typ hat — die C1-Tabelle in Code.
  const istText = def.art === "text" || def.art === "richtext";
  const zeigtPlatzhalter = istText;
  const zeigtMax = def.art === "text";
  const zeigtMehrzeilig = def.art === "text";
  const zeigtPflicht = def.art !== "schalter";
  // Nur Felder, in die man wirklich etwas TIPPT, bekommen eine Vorgabe —
  // dieselbe Liste wie im Backend (`OHNE_VORGABE`). Ein Schalter hat schon
  // einen Grundzustand, ein Bild ist keine Eingabe, die man vorschreiben
  // könnte.
  const zeigtVorgabe = !OHNE_VORGABE.has(def.key);
  const vorgabeArt = stand.standard_feld !== null
    ? "feld"
    : stand.standard_wert !== null
      ? "wert"
      : "keine";

  const zeile = "flex items-center justify-between gap-3 py-1.5";
  const label = "text-xs text-muted-foreground";

  return (
    <div
      ref={huelle}
      role="dialog"
      aria-label={name}
      className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-border bg-background p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="truncate text-sm font-semibold">{name}</p>
        <button
          type="button"
          aria-label={t("blog.cm.close")}
          onClick={onSchliessen}
          className="inline-flex size-6 items-center justify-center rounded-(--radius) text-muted-foreground hover:bg-secondary"
        >
          <Icon icon="ph:x" className="size-3.5" />
        </button>
      </div>

      <div className={zeile}>
        <span className={label}>{t("blog.feld.name")}</span>
        <Input
          value={stand.label ?? ""}
          // Der eingebaute Name als Platzhalter: so sieht man, wie das Feld
          // ohne Abweichung heißt, statt ein leeres Feld zu raten.
          placeholder={name}
          onChange={(e) => setzen("label", e.target.value || null)}
          className="h-8 w-40"
        />
      </div>

      <div className={zeile}>
        <span className={label}>{t("blog.feld.beschreibung")}</span>
        <Input
          value={stand.beschreibung ?? ""}
          onChange={(e) => setzen("beschreibung", e.target.value || null)}
          className="h-8 w-40"
        />
      </div>

      {zeigtPflicht ? (
        <div className={zeile}>
          <span className={label}>{t("blog.feld.pflicht")}</span>
          <JaNein
            wert={stand.pflicht}
            onWert={(v) => {
              // Pflicht UND versteckt wäre ein Dialog, den man nicht
              // abschicken kann, ohne zu sehen warum — das Backend lehnt es
              // mit 422 ab. Hier wird es gar nicht erst einstellbar: ein
              // Fehler, den die Oberfläche verhindern kann, gehört nicht in
              // eine Fehlermeldung (Wurzel 5).
              const neu = { ...stand, pflicht: v, versteckt: v ? false : stand.versteckt };
              setStand(neu);
              onAendern(neu);
            }}
          />
        </div>
      ) : null}

      {zeigtMehrzeilig ? (
        <div className={zeile}>
          <span className={label}>{t("blog.feld.mehrzeilig")}</span>
          <JaNein
            wert={stand.mehrzeilig}
            onWert={(v) => setzen("mehrzeilig", v)}
          />
        </div>
      ) : null}

      {zeigtPlatzhalter ? (
        <div className={zeile}>
          <span className={label}>{t("blog.feld.platzhalter")}</span>
          <Input
            value={stand.platzhalter ?? ""}
            onChange={(e) => setzen("platzhalter", e.target.value || null)}
            className="h-8 w-40"
          />
        </div>
      ) : null}

      {zeigtMax ? (
        <div className={zeile}>
          <span className={label}>{t("blog.feld.maxZeichen")}</span>
          <Input
            type="number"
            min={1}
            max={10000}
            value={stand.max_zeichen ?? ""}
            onChange={(e) => {
              const roh = e.target.value.trim();
              // Leer heißt „keine Grenze" — NICHT 0. Eine 0 wäre ein Feld,
              // das nichts annimmt; DB und Backend lehnen sie deshalb ab.
              const zahl = roh ? Number.parseInt(roh, 10) : NaN;
              setzen(
                "max_zeichen",
                Number.isFinite(zahl) && zahl >= 1 ? zahl : null,
              );
            }}
            className="h-8 w-40"
          />
        </div>
      ) : null}

      {/* VORGABEWERT (0486, Framers `Default` / `Based on`).
          Zwei Arten, aber nie beide: ein fester Text ODER ein anderes Feld,
          dem dieses folgt. Genau darauf stellt der `Zurücksetzen`-Knopf im
          Beitragsdialog zurück — ohne Vorgabe gäbe es dort nichts
          zurückzustellen, und der Knopf wäre eine Attrappe. */}
      {zeigtVorgabe ? (
        <>
          <div className={zeile}>
            <span className={label}>{t("blog.feld.vorgabe")}</span>
            <select
              value={vorgabeArt}
              onChange={(e) => {
                const art = e.target.value;
                // Beim Umschalten wird die ANDERE Art geleert: beide zugleich
                // wären zwei Wahrheiten darüber, was die Vorgabe ist — der
                // Server lehnt es mit 422 ab, und ein Fehler, den die
                // Oberfläche verhindern kann, gehört nicht in eine Meldung.
                const neu: FeldKonfig = {
                  ...stand,
                  standard_wert: art === "wert" ? (stand.standard_wert ?? "") : null,
                  standard_feld: art === "feld" ? (stand.standard_feld ?? "") : null,
                };
                setStand(neu);
                // Ein leerer Zwischenstand wird NICHT gesendet: „Aus Feld"
                // ohne gewähltes Feld ist noch keine Einstellung.
                if (art === "keine") onAendern(neu);
              }}
              className="h-8 w-40 rounded-(--radius) border border-border bg-transparent px-2 text-xs"
            >
              <option value="keine">{t("blog.feld.vorgabeKeine")}</option>
              <option value="wert">{t("blog.feld.vorgabeWert")}</option>
              <option value="feld">{t("blog.feld.vorgabeFeld")}</option>
            </select>
          </div>

          {vorgabeArt === "wert" ? (
            <div className={zeile}>
              <span className={label}>{t("blog.feld.vorgabeWert")}</span>
              <Input
                value={stand.standard_wert ?? ""}
                onChange={(e) => setzen("standard_wert", e.target.value || null)}
                className="h-8 w-40"
              />
            </div>
          ) : null}

          {vorgabeArt === "feld" ? (
            <div className={zeile}>
              <span className={label}>{t("blog.feld.vorgabeFeld")}</span>
              <select
                value={stand.standard_feld ?? ""}
                onChange={(e) =>
                  setzen("standard_feld", e.target.value || null)
                }
                className="h-8 w-40 rounded-(--radius) border border-border bg-transparent px-2 text-xs"
              >
                <option value="">{t("blog.feld.vorgabeFeldWaehlen")}</option>
                {quellfelder.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </>
      ) : null}

      <div className={zeile}>
        <span className={label}>{t("blog.feld.versteckt")}</span>
        <JaNein
          wert={stand.versteckt}
          gesperrt={NICHT_VERSTECKBAR.has(def.key) || stand.pflicht}
          gesperrtGrund={
            NICHT_VERSTECKBAR.has(def.key)
              ? t("blog.feld.nichtVersteckbar")
              : t("blog.feld.pflichtNichtVersteckbar")
          }
          onWert={(v) => setzen("versteckt", v)}
        />
      </div>

      <button
        type="button"
        onClick={onZuruecksetzen}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-(--radius) border border-border py-1.5 text-xs text-muted-foreground transition hover:bg-secondary/60"
      >
        <Icon icon="ph:arrow-counter-clockwise" className="size-3.5" />
        {t("blog.feld.zuruecksetzen")}
      </button>
    </div>
  );
}
