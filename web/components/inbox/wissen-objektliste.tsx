"use client";

// Ebene 1 der Wissensdatenbank: die Objekte mit ihrer Faktenzahl.
//
// Die Spalte „Fakten" ist die Botschaft dieser Ansicht. Eine `0` steht in
// `text-muted-foreground` und NICHT in Rot: ungepflegt ist kein Fehler,
// sondern ein Hinweis — die KI kennt auch ohne einen einzigen Fakt die ganze
// Gästemappe, die Richtlinien und den Kalender.
import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { WissenObjektListe } from "@/lib/inbox";

import type { WissenAuswahl } from "./wissen-tab";

type Sortierung = "objekt" | "ort" | "geaendert";

export function WissenObjektliste({
  liste,
  fehler,
  suche,
  onSuche,
  sortierung,
  absteigend,
  onSortieren,
  seite,
  proSeite,
  onSeite,
  onProSeite,
  onOeffnen,
}: {
  liste: WissenObjektListe | null;
  fehler: string | null;
  suche: string;
  onSuche: (s: string) => void;
  sortierung: Sortierung;
  absteigend: boolean;
  onSortieren: (s: Sortierung) => void;
  seite: number;
  proSeite: number;
  onSeite: (n: number) => void;
  onProSeite: (n: number) => void;
  onOeffnen: (a: WissenAuswahl) => void;
}) {
  const t = useTranslations("inbox");
  const f = useFormatter();

  const seiten = liste ? Math.max(1, Math.ceil(liste.total / liste.pro_seite)) : 1;

  function datum(wert: string | null) {
    if (!wert) return "—";
    return f.dateTime(new Date(wert), { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{t("tabKnowledge")}</h3>
        <div className="relative">
          <Icon
            icon="ph:magnifying-glass"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={suche}
            onChange={(e) => onSuche(e.target.value)}
            placeholder={t("kiSearch")}
            className="w-64 pl-9"
          />
        </div>
      </div>

      {fehler && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-3xl text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <Kopf
                label={`${t("kiColProperty")} (${liste?.total ?? 0})`}
                aktiv={sortierung === "objekt"}
                absteigend={absteigend}
                onClick={() => onSortieren("objekt")}
              />
              <Kopf
                label={t("kiColCity")}
                aktiv={sortierung === "ort"}
                absteigend={absteigend}
                onClick={() => onSortieren("ort")}
              />
              <th className="px-4 py-3 text-right font-normal">{t("kiColFacts")}</th>
              <Kopf
                label={t("kiColChanged")}
                aktiv={sortierung === "geaendert"}
                absteigend={absteigend}
                onClick={() => onSortieren("geaendert")}
                rechts
              />
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {/* Betriebsweit steht immer vorn und ist optisch abgesetzt: das
                sind die Fakten, die für JEDES Objekt gelten. */}
            <tr
              className="cursor-pointer border-b border-border bg-muted/40 hover:bg-muted"
              onClick={() => onOeffnen({ art: "betriebsweit" })}
            >
              <td className="flex items-center gap-3 px-4 py-3 font-medium">
                <span className="flex size-8 items-center justify-center rounded-(--radius) bg-background">
                  <Icon icon="ph:buildings" className="size-4 text-muted-foreground" />
                </span>
                {t("knowledgeCompanyWide")}
              </td>
              <td className="px-4 py-3 text-muted-foreground">—</td>
              <td className="px-4 py-3 text-right tabular-nums">
                <Zahl wert={liste?.betriebsweit_fakten ?? 0} />
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                {datum(liste?.betriebsweit_geaendert_at ?? null)}
              </td>
              <td className="px-2">
                <Icon icon="ph:caret-right" className="size-4 text-muted-foreground" />
              </td>
            </tr>

            {(liste?.items ?? []).map((o) => (
              <tr
                key={o.property_id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                onClick={() => onOeffnen({ art: "objekt", objekt: o })}
              >
                <td className="flex items-center gap-3 px-4 py-3 font-medium">
                  {o.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.foto_url}
                      alt=""
                      className="size-8 rounded-(--radius) object-cover"
                    />
                  ) : (
                    // Kein erfundenes Bild (Wurzel 4): fehlt das Foto, steht
                    // ein Platzhalter da, kein fremdes Motiv.
                    <span className="flex size-8 items-center justify-center rounded-(--radius) bg-muted">
                      <Icon icon="ph:house" className="size-4 text-muted-foreground" />
                    </span>
                  )}
                  <span className="truncate">{o.titel}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{o.ort ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <Zahl wert={o.fakten} />
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                  {datum(o.geaendert_at)}
                </td>
                <td className="px-2">
                  <Icon icon="ph:caret-right" className="size-4 text-muted-foreground" />
                </td>
              </tr>
            ))}

            {liste && liste.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {suche ? t("kiSearchEmpty", { begriff: suche }) : t("kiNoProperties")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          {t("kiPerPage")}
          <NativeSelect
            value={String(proSeite)}
            onChange={(e) => onProSeite(Number(e.target.value))}
            className="w-20"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={seite <= 1}
            onClick={() => onSeite(seite - 1)}
          >
            <Icon icon="ph:caret-left" className="size-4" />
            {t("kiPrev")}
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {seite} / {seiten}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={seite >= seiten}
            onClick={() => onSeite(seite + 1)}
          >
            {t("kiNext")}
            <Icon icon="ph:caret-right" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Eine `0` ist kein Fehler, sondern ein Hinweis — deshalb gedämpft, nicht rot. */
function Zahl({ wert }: { wert: number }) {
  return <span className={wert === 0 ? "text-muted-foreground" : ""}>{wert}</span>;
}

function Kopf({
  label,
  aktiv,
  absteigend,
  onClick,
  rechts,
}: {
  label: string;
  aktiv: boolean;
  absteigend: boolean;
  onClick: () => void;
  rechts?: boolean;
}) {
  return (
    <th className={`px-4 py-3 font-normal ${rechts ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          aktiv ? "text-foreground" : ""
        }`}
      >
        {label}
        <Icon
          icon={aktiv ? (absteigend ? "ph:caret-down" : "ph:caret-up") : "ph:caret-up-down"}
          className="size-3"
        />
      </button>
    </th>
  );
}
