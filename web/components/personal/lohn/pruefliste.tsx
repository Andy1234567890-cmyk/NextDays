"use client";

// Das Ergebnis von „Prüfen": Fehler rot, Warnungen amber, je Zeile die Art
// (`personal.lohn.pruefung.<art>`), die Person und ihre Werte — mit dem
// Sprungziel, an dem der Mangel behoben wird (Vertrag §7, `pruefungZiel`).
//
// WARUM DAS SPRUNGZIEL PFLICHT IST: eine Liste „12 Zeiten unbestätigt" ohne
// Weg dorthin ist eine Sackgasse — man weiss, dass etwas fehlt, aber nicht,
// wo. Prüfarten ohne eindeutiges Ziel (`schicht_ohne_zeit`) bekommen deshalb
// KEINEN erfundenen Link, sondern gar keinen.
//
// Die Werte (`werte: dict`) rendert der Server frei — Minuten, Grenzen,
// Monate. Sie werden als `Schlüssel: Wert` gezeigt, statt jedes Feld hier
// nachzubauen; die Prüfart trägt die Bedeutung.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { LohnPruefungen, Pruefung } from "@/lib/personal-berichte-typen";
import { minutenText, pruefungZiel } from "@/lib/personal-berichte-typen";
import { formatDateTime } from "@/lib/utils";

export function Pruefliste({ pruefungen }: { pruefungen: LohnPruefungen }) {
  const t = useTranslations("personal");
  const locale = useLocale();

  const { fehler, warnungen } = pruefungen;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {t("lohn.pruefungKopf", {
          personen: pruefungen.personen,
          zeiten: pruefungen.zeiten,
          zeit: pruefungen.geprueft_am ? formatDateTime(pruefungen.geprueft_am, locale) : "—",
        })}
      </p>

      {fehler.length === 0 && warnungen.length === 0 && (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <Icon icon="ph:check-circle" aria-hidden className="size-5 shrink-0" />
          {t("lohn.pruefungSauber")}
        </p>
      )}

      {fehler.length > 0 && (
        <Block
          art="fehler"
          titel={t("lohn.fehlerTitel", { anzahl: fehler.length })}
          eintraege={fehler}
        />
      )}
      {warnungen.length > 0 && (
        <Block
          art="warnung"
          titel={t("lohn.warnungTitel", { anzahl: warnungen.length })}
          eintraege={warnungen}
        />
      )}
    </div>
  );
}

function Block({
  art,
  titel,
  eintraege,
}: {
  art: "fehler" | "warnung";
  titel: string;
  eintraege: Pruefung[];
}) {
  const t = useTranslations("personal");
  const rot = art === "fehler";
  const rahmen = rot
    ? "border-red-300 bg-red-50 text-red-900"
    : "border-amber-300 bg-amber-50 text-amber-900";
  const trennlinie = rot ? "border-red-200" : "border-amber-200";

  return (
    <div className={`rounded-2xl border ${rahmen}`}>
      <p className="flex items-center gap-2 p-3 text-sm font-semibold">
        <Icon
          icon={rot ? "ph:x-circle" : "ph:warning"}
          aria-hidden
          className="size-5 shrink-0"
        />
        {titel}
      </p>
      <ul className="text-sm">
        {eintraege.map((p, i) => {
          const ziel = pruefungZiel(p);
          const artText = t.has(`lohn.pruefung.${p.art}`) ? t(`lohn.pruefung.${p.art}`) : p.art;
          return (
            <li
              key={`${p.art}-${p.user_id ?? "ohne"}-${i}`}
              className={`flex flex-wrap items-center justify-between gap-2 border-t ${trennlinie} px-3 py-2`}
            >
              <span className="flex flex-col">
                <span className="font-medium">{artText}</span>
                <span className="text-xs opacity-80">
                  {[p.name, werteText(p.werte)].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              {ziel ? (
                <Link
                  href={ziel}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current/30 bg-card/60 px-3 py-1 text-xs font-medium hover:bg-card"
                >
                  {t("lohn.beheben")}
                  <Icon icon="ph:arrow-right" aria-hidden className="size-3" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Die freien `werte` des Servers als „schluessel: wert"-Kette. Minuten-Felder
 *  (Endung `_minuten`) werden als `h:mm` gezeigt, damit „−480" nicht als
 *  Rohzahl steht; alles andere bleibt unverändert — hier wird nichts
 *  interpretiert, was der Server nicht gesagt hat. */
function werteText(werte: Record<string, unknown>): string {
  return Object.entries(werte)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      if (k.endsWith("_minuten") && typeof v === "number") return `${k}: ${minutenText(v)}`;
      if (Array.isArray(v)) return `${k}: ${v.join(", ")}`;
      if (typeof v === "object") return k;
      return `${k}: ${String(v)}`;
    })
    .join(" · ");
}
