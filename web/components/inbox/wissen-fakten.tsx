"use client";

// Ebene 2 der Wissensdatenbank: die Fakten eines Objekts (oder die
// betriebsweiten).
//
// Die Kategorie steht als WORT da, nicht als Farbpunkt: sieben Farben kann
// niemand auseinanderhalten, und ein Farbpunkt ohne Beschriftung ist für
// Screenreader gar nichts.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import {
  type KnowledgeFact,
  deleteKnowledge,
  deleteKnowledgeBulk,
  listKnowledge,
} from "@/lib/inbox";
import {
  WISSEN_KATEGORIEN,
  WISSEN_QUELLEN,
  type WissenKategorie,
  type WissenQuelle,
} from "@/lib/inbox-wissen-typen";

import { WissenFaktPanel } from "./wissen-fakt-panel";
import { WissenImportPanel } from "./wissen-import-panel";
import type { WissenAuswahl } from "./wissen-tab";

type Sortierung = "titel" | "kategorie" | "quelle" | "geaendert";

export function WissenFakten({
  auswahl,
  onZurueck,
}: {
  auswahl: Exclude<WissenAuswahl, null>;
  onZurueck: () => void;
}) {
  const t = useTranslations("inbox");
  const f = useFormatter();

  const objektId = auswahl.art === "objekt" ? auswahl.objekt.property_id : null;
  const betriebsweit = auswahl.art === "betriebsweit";

  const [items, setItems] = useState<KnowledgeFact[]>([]);
  const [gesamt, setGesamt] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [suche, setSuche] = useState("");
  const [kategorien, setKategorien] = useState<WissenKategorie[]>([]);
  const [quellen, setQuellen] = useState<WissenQuelle[]>([]);
  const [filterOffen, setFilterOffen] = useState(false);
  const [sortierung, setSortierung] = useState<Sortierung>("geaendert");
  const [absteigend, setAbsteigend] = useState(true);
  const [seite, setSeite] = useState(1);
  const [proSeite, setProSeite] = useState(20);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [bearbeiten, setBearbeiten] = useState<KnowledgeFact | "neu" | null>(null);
  const [importOffen, setImportOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const laden = useCallback(async () => {
    const res = await listKnowledge({
      propertyId: objektId ?? undefined,
      nurDiesesObjekt: !!objektId,
      betriebsweit,
      suche: suche || undefined,
      kategorien: kategorien.length ? kategorien : undefined,
      quellen: quellen.length ? quellen : undefined,
      sortierung,
      absteigend,
      seite,
      proSeite,
    });
    if (res.ok) {
      setItems(res.data.items);
      setGesamt(res.data.total);
      // Auswahl bereinigen: was nicht mehr in der Liste steht, kann auch nicht
      // mehr gelöscht werden — sonst zählt die Leiste unten Zeilen mit, die
      // niemand sieht (Wurzel 1).
      setGewaehlt((alt) => {
        const da = new Set(res.data.items.map((x) => x.id));
        return new Set([...alt].filter((id) => da.has(id)));
      });
    } else {
      setFehler(res.error);
    }
  }, [objektId, betriebsweit, suche, kategorien, quellen, sortierung, absteigend, seite, proSeite]);

  useEffect(() => {
    void laden();
  }, [laden]);

  useEffect(() => {
    const id = setTimeout(() => {
      setSuche(eingabe);
      setSeite(1);
    }, 300);
    return () => clearTimeout(id);
  }, [eingabe]);

  const seiten = Math.max(1, Math.ceil(gesamt / proSeite));
  const alleGewaehlt = items.length > 0 && gewaehlt.size === items.length;

  function sortieren(s: Sortierung) {
    if (s === sortierung) setAbsteigend((v) => !v);
    else {
      setSortierung(s);
      setAbsteigend(s === "geaendert");
    }
    setSeite(1);
  }

  function umschalten(id: string) {
    setGewaehlt((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  function loeschen(id: string) {
    if (!window.confirm(t("kiFactDeleteConfirm"))) return;
    start(async () => {
      await deleteKnowledge(id);
      await laden();
    });
  }

  function sammelLoeschen() {
    if (!window.confirm(t("kiFactBulkDeleteConfirm", { count: gewaehlt.size }))) return;
    start(async () => {
      const res = await deleteKnowledgeBulk([...gewaehlt]);
      if (!res.ok) setFehler(res.error);
      setGewaehlt(new Set());
      await laden();
    });
  }

  const filterAktiv = kategorien.length + quellen.length;

  return (
    <div className="flex flex-col gap-4 p-6">
      <button
        type="button"
        onClick={onZurueck}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <Icon icon="ph:arrow-left" className="size-4" />
        {t("kiBackToKnowledge")}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {auswahl.art === "objekt" && auswahl.objekt.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={auswahl.objekt.foto_url}
              alt=""
              className="size-10 rounded-(--radius) object-cover"
            />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-(--radius) bg-muted">
              <Icon
                icon={betriebsweit ? "ph:buildings" : "ph:house"}
                className="size-5 text-muted-foreground"
              />
            </span>
          )}
          <div>
            <h3 className="font-semibold">
              {betriebsweit ? t("knowledgeCompanyWide") : auswahl.objekt.titel}
            </h3>
            <p className="flex items-center gap-3 text-xs text-muted-foreground">
              {auswahl.art === "objekt" && auswahl.objekt.ort && (
                <span className="flex items-center gap-1">
                  <Icon icon="ph:map-pin" className="size-3" />
                  {auswahl.objekt.ort}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Icon icon="ph:list" className="size-3" />
                {t("kiFactCount", { count: gesamt })}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setImportOffen(true)}>
            <Icon icon="ph:file-text" className="size-4" />
            {t("kiUploadFacts")}
          </Button>
          <Button type="button" size="sm" onClick={() => setBearbeiten("neu")}>
            <Icon icon="ph:plus" className="size-4" />
            {t("kiAddFact")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilterOffen((v) => !v)}
          >
            <Icon icon="ph:funnel" className="size-4" />
            {t("kiFilter")}
            {filterAktiv > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-xs text-accent-foreground tabular-nums">
                {filterAktiv}
              </span>
            )}
          </Button>
          {kategorien.map((k) => (
            <Chip
              key={k}
              label={t(`kiCategory_${k}` as never)}
              onWeg={() => setKategorien((a) => a.filter((x) => x !== k))}
            />
          ))}
          {quellen.map((q) => (
            <Chip
              key={q}
              label={t(`knowledgeSource_${q}` as never)}
              onWeg={() => setQuellen((a) => a.filter((x) => x !== q))}
            />
          ))}
          {filterAktiv > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => {
                setKategorien([]);
                setQuellen([]);
              }}
            >
              {t("kiFilterReset")}
            </button>
          )}
        </div>

        <div className="relative">
          <Icon
            icon="ph:magnifying-glass"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            placeholder={t("kiSearch")}
            className="w-64 pl-9"
          />
        </div>
      </div>

      {filterOffen && (
        <div className="flex flex-wrap gap-8 rounded-2xl border border-border bg-card p-4">
          <Filtergruppe
            titel={t("kiColCategory")}
            werte={WISSEN_KATEGORIEN}
            gewaehlt={kategorien}
            beschriften={(k) => t(`kiCategory_${k}` as never)}
            onToggle={(k) => {
              setKategorien((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
              setSeite(1);
            }}
          />
          <Filtergruppe
            titel={t("kiColSource")}
            werte={WISSEN_QUELLEN}
            gewaehlt={quellen}
            beschriften={(q) => t(`knowledgeSource_${q}` as never)}
            onToggle={(q) => {
              setQuellen((a) => (a.includes(q) ? a.filter((x) => x !== q) : [...a, q]));
              setSeite(1);
            }}
          />
        </div>
      )}

      {fehler && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-3xl text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={alleGewaehlt}
                  onCheckedChange={(an) =>
                    setGewaehlt(an ? new Set(items.map((x) => x.id)) : new Set())
                  }
                  aria-label={t("kiSelectAll")}
                />
              </th>
              <Kopf
                label={`${t("kiColFact")} (${gesamt})`}
                aktiv={sortierung === "titel"}
                absteigend={absteigend}
                onClick={() => sortieren("titel")}
              />
              <Kopf
                label={t("kiColCategory")}
                aktiv={sortierung === "kategorie"}
                absteigend={absteigend}
                onClick={() => sortieren("kategorie")}
              />
              <Kopf
                label={t("kiColSource")}
                aktiv={sortierung === "quelle"}
                absteigend={absteigend}
                onClick={() => sortieren("quelle")}
              />
              <Kopf
                label={t("kiColChanged")}
                aktiv={sortierung === "geaendert"}
                absteigend={absteigend}
                onClick={() => sortieren("geaendert")}
                rechts
              />
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((fakt) => (
              <tr key={fakt.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 align-top">
                  <Checkbox
                    checked={gewaehlt.has(fakt.id)}
                    onCheckedChange={() => umschalten(fakt.id)}
                    aria-label={fakt.titel ?? fakt.fact}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="block text-left font-medium hover:underline"
                    onClick={() => setBearbeiten(fakt)}
                  >
                    {/* Ohne Titel (Altbestand aus 0260) steht der Textanfang
                        da — nie ein erfundener Titel. */}
                    {fakt.titel ?? fakt.fact.slice(0, 60)}
                  </button>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {fakt.fact}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t(`kiCategory_${fakt.kategorie}` as never)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t(`knowledgeSource_${fakt.source}` as never)}
                  {fakt.quelle_datei && (
                    <span className="block text-xs opacity-70">{fakt.quelle_datei}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                  {fakt.updated_at
                    ? f.dateTime(new Date(fakt.updated_at), {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="px-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t("kiRowMenu")}
                      >
                        <Icon icon="ph:dots-three-vertical" className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setBearbeiten(fakt)}>
                        <Icon icon="ph:pencil-simple" className="size-4" />
                        {t("knowledgeEdit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => loeschen(fakt.id)}
                        className="text-destructive"
                      >
                        <Icon icon="ph:trash" className="size-4" />
                        {t("kiDelete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {suche || filterAktiv
                    ? t("kiSearchEmpty", { begriff: suche || t("kiFilter") })
                    : /* Wichtig: „keine Fakten" heisst NICHT „die KI weiss
                         nichts". Ohne diesen Satz hält der Betrieb sie für
                         ahnungslos, dabei kennt sie die ganze Gästemappe. */
                      t("kiFactsEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {gewaehlt.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <span>{t("kiSelectedCount", { count: gewaehlt.size })}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={sammelLoeschen}
            disabled={pending}
          >
            <Icon icon="ph:trash" className="size-4" />
            {t("kiDelete")}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          {t("kiPerPage")}
          <NativeSelect
            value={String(proSeite)}
            onChange={(e) => {
              setProSeite(Number(e.target.value));
              setSeite(1);
            }}
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
            onClick={() => setSeite(seite - 1)}
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
            onClick={() => setSeite(seite + 1)}
          >
            {t("kiNext")}
            <Icon icon="ph:caret-right" className="size-4" />
          </Button>
        </div>
      </div>

      {bearbeiten && (
        <WissenFaktPanel
          fakt={bearbeiten === "neu" ? null : bearbeiten}
          objektId={objektId}
          onSchliessen={() => setBearbeiten(null)}
          onGespeichert={() => {
            setBearbeiten(null);
            void laden();
          }}
        />
      )}

      {importOffen && (
        <WissenImportPanel
          objektId={objektId}
          onSchliessen={() => setImportOffen(false)}
          onFertig={() => {
            setImportOffen(false);
            void laden();
          }}
        />
      )}
    </div>
  );
}

function Chip({ label, onWeg }: { label: string; onWeg: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
      {label}
      <button type="button" onClick={onWeg} className="hover:text-destructive">
        <Icon icon="ph:x" className="size-3" />
      </button>
    </span>
  );
}

function Filtergruppe<T extends string>({
  titel,
  werte,
  gewaehlt,
  beschriften,
  onToggle,
}: {
  titel: string;
  werte: readonly T[];
  gewaehlt: T[];
  beschriften: (w: T) => string;
  onToggle: (w: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{titel}</span>
      {werte.map((w) => (
        <label key={w} className="flex items-center gap-2 text-sm">
          <Checkbox checked={gewaehlt.includes(w)} onCheckedChange={() => onToggle(w)} />
          {beschriften(w)}
        </label>
      ))}
    </div>
  );
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
