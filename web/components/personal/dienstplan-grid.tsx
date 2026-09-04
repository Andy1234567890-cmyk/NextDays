"use client";

// Wochenraster des Dienstplans: Personen × Tage, gruppiert nach Arbeitsbereich.
//
// WARUM EIGENE DATEI: `dienstplan.tsx` führt seit dem Ausbau (Vertrag §5) drei
// Ansichten, zwei Darstellungen, Filter, Kennzahlen, Mehrfachauswahl und
// Tausch — der Zustand gehört dort zusammen, die 300 Zeilen Tabellen-Markup
// des Wochenrasters nicht. Diese Datei ist deshalb rein darstellend: sie
// bekommt fertige Daten und meldet Ereignisse nach oben, hält KEINEN eigenen
// Zustand außer dem, was das Markup selbst braucht (Popover).
//
// Drag & Drop bleibt unverändert das Muster des Aufgabenkalenders: der
// `dragstart`-Handler setzt eine Ref und einen `setTimeout(0)`, nie synchron
// State (Chrome bricht den Drag sonst ab) — die Ref lebt im Elternteil, hier
// werden nur die Handler durchgereicht.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@nextdays/ui/avatar";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@nextdays/ui/popover";
import { initialsOf } from "@/lib/initials";
import type {
  KennzahlBereichTag,
  KennzahlTag,
  KennzahlZeile,
  PlanPersonPlus,
  SchichtPlus,
  Verfuegbarkeitstag,
} from "@/lib/personal-planung-typen";
import type { Arbeitsbereich, Konflikt, Schichtvorlage } from "@/lib/personal-typen";
import { stunden } from "@/lib/personal-typen";
import { tagInZone, tagKurz, uhrzeitInZone, wochentagKurz } from "@/lib/personal-zeit";

import { BereichKopf, BereichKpiZeilen } from "./dienstplan-bereich";

export const OFFEN = "__offen__";

/** Eine Zeile des Rasters: eine Person oder die Sammelzeile „offen". */
export type Rasterzeile = { key: string; user: PlanPersonPlus | null };

/** Ein Block des Rasters: ein Arbeitsbereich (oder `null` = ohne Bereich). */
export type Rasterblock = {
  /** `null` = Sammelblock „ohne Arbeitsbereich"; `OFFEN` = die offene Zeile. */
  bereich: Arbeitsbereich | null;
  zeilen: Rasterzeile[];
};

export function DienstplanGrid({
  woche,
  tage,
  heute,
  wochenende,
  zone,
  blocks,
  gruppiert,
  offeneZeile,
  zellen,
  abwesend,
  verfuegbarkeiten,
  feiertage,
  arbeitsbereiche,
  vorlagen,
  minutenJePerson,
  lesebestaetigungen,
  offeneAnzahl,
  kwLabel,
  kannPlanen,
  regelnBestaetigt,
  auswahlModus,
  ausgewaehlt,
  eingeklappt,
  kennzahlZeilen,
  kennzahlBereiche,
  kennzahlTage,
  currency,
  drag,
  ziel,
  onZiel,
  onBereichToggle,
  onAuswahl,
  onOeffnen,
  onTausch,
  onNeu,
  onSchnellAnlegen,
  onDragStart,
  onDragEnde,
  onDrop,
  konfliktText,
}: {
  woche: string;
  tage: string[];
  heute: string;
  wochenende: (index: number) => boolean;
  zone: string;
  /** Blöcke in Anzeigereihenfolge (leer = flach, dann zählt `offeneZeile`). */
  blocks: Rasterblock[];
  /** Ist die Gruppierung nach Arbeitsbereich aktiv? */
  gruppiert: boolean;
  /** Die Sammelzeile „offen" — steht immer über den Blöcken. */
  offeneZeile: Rasterzeile | null;
  /** `user|datum` → Schichten dieser Zelle. */
  zellen: Map<string, SchichtPlus[]>;
  /** `user|datum` → Abwesenheit dieser Zelle. */
  abwesend: Map<string, { art: string; status: string }>;
  /** `user|datum` → Wunsch-/Sperrzeiten dieser Zelle. */
  verfuegbarkeiten: Map<string, Verfuegbarkeitstag[]>;
  feiertage: Record<string, string>;
  arbeitsbereiche: Arbeitsbereich[];
  vorlagen: Schichtvorlage[];
  minutenJePerson: Record<string, number>;
  lesebestaetigungen: Record<string, string>;
  offeneAnzahl: number;
  kwLabel: string;
  kannPlanen: boolean;
  regelnBestaetigt: boolean;
  auswahlModus: boolean;
  ausgewaehlt: Set<string>;
  eingeklappt: Set<string>;
  kennzahlZeilen: readonly KennzahlZeile[];
  /** `arbeitsbereich_id` → (`datum` → Kennzahl). */
  kennzahlBereiche: Map<string, Map<string, KennzahlBereichTag>>;
  kennzahlTage: Map<string, KennzahlTag>;
  currency: string;
  drag: { schichtId: string } | null;
  ziel: string | null;
  onZiel: (key: string | null) => void;
  onBereichToggle: (id: string) => void;
  onAuswahl: (id: string, shift: boolean) => void;
  onOeffnen: (s: SchichtPlus) => void;
  onTausch: (s: SchichtPlus) => void;
  onNeu: (userId: string | null, tag: string) => void;
  onSchnellAnlegen: (userId: string | null, tag: string, vorlageId: string) => void;
  onDragStart: (e: React.DragEvent, s: SchichtPlus) => void;
  onDragEnde: () => void;
  onDrop: (userId: string | null, tag: string) => void;
  konfliktText: (k: Konflikt) => string;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();

  const bereichFarbe = (id: string | null) =>
    arbeitsbereiche.find((b) => b.id === id)?.farbe ?? "#64748b";
  const bereichKurz = (id: string | null) => arbeitsbereiche.find((b) => b.id === id)?.kurz ?? "";

  /** Eine Personen- bzw. Offen-Zeile des Rasters.
   *  `bereichId` schränkt ein, welche Schichten dieser Block zeigt: seinen
   *  eigenen Bereich; `null` = der Sammelblock (alles ohne aktiven Bereich).
   *  `undefined` = ungruppiert, dann zeigt die Zeile alles. */
  function zeile({ key, user }: Rasterzeile, bereichId?: string | null) {
    return (
      <tr key={key} className="border-b last:border-b-0">
        <td className="p-2 align-top">
          {user ? (
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarImage src={user.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="text-xs">
                  {initialsOf(user.full_name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1 truncate font-medium">
                  <span className="truncate">{user.full_name ?? "—"}</span>
                  {user.ist_schichtleitung && (
                    <span title={t("legende.schichtleitung")}>
                      <Icon icon="ph:key" className="size-3 text-amber-600" />
                    </span>
                  )}
                  {user.geburtstag_am && tage.includes(user.geburtstag_am) && (
                    <span title={t("legende.geburtstag")}>
                      <Icon icon="ph:cake" className="size-3 text-fuchsia-600" />
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {user.arbeitsbereiche
                    .map((b) => arbeitsbereiche.find((x) => x.id === b)?.kurz ?? "")
                    .filter(Boolean)
                    .join(" ")}
                  {lesebestaetigungen[user.user_id] && (
                    <span title={t("dienstplan.gelesen")}>
                      <Icon
                        icon="ph:check-circle"
                        className="ml-1 inline size-3 text-emerald-600"
                      />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon icon="ph:user-plus" className="size-5" />
              <span className="font-medium">{t("dienstplan.offen")}</span>
            </div>
          )}
        </td>
        {tage.map((tag, tagIndex) => {
          // Nachschlagen immer über `user|datum`; der Block-Schlüssel (`key`)
          // unterscheidet nur die Drop-Ziele, wenn eine Person in mehreren
          // Bereichen steht.
          const datenKey = `${user?.user_id ?? OFFEN}|${tag}`;
          const zellKey = `${key}|${tag}`;
          const alle = zellen.get(datenKey) ?? [];
          const inhalt =
            bereichId === undefined
              ? alle
              : bereichId === null
                ? alle.filter(
                    (s) =>
                      !s.arbeitsbereich_id ||
                      !arbeitsbereiche.some(
                        (x) => x.id === s.arbeitsbereich_id && !x.archived_at,
                      ),
                  )
                : alle.filter((s) => s.arbeitsbereich_id === bereichId);
          const abw = user ? abwesend.get(datenKey) : undefined;
          const wuensche = user ? (verfuegbarkeiten.get(datenKey) ?? []) : [];
          const istZiel = ziel === zellKey && drag;
          return (
            <td
              key={tag}
              className={`h-16 p-1 align-top ${
                tag === heute ? "bg-primary/5" : wochenende(tagIndex) ? "bg-secondary/20" : ""
              } ${abw ? (abw.status === "genehmigt" ? "bg-secondary/60" : "bg-amber-50/60") : ""} ${
                istZiel ? "outline outline-2 outline-primary" : ""
              }`}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                if (ziel !== zellKey) onZiel(zellKey);
              }}
              onDragLeave={() => onZiel(null)}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(user?.user_id ?? null, tag);
              }}
              onDoubleClick={() => {
                if (!kannPlanen || !regelnBestaetigt) return;
                onNeu(user?.user_id ?? null, tag);
              }}
            >
              {/* Wunsch-/Sperrzeiten als Punkte (Vertrag §5). */}
              {wuensche.length > 0 && (
                <div className="mb-0.5 flex gap-0.5">
                  {wuensche.map((v) => (
                    <span
                      key={`${v.art}-${v.zeit_von ?? "g"}`}
                      title={`${t(`verfuegbar.art.${v.art}`)}${
                        v.ganztags ? "" : ` ${v.zeit_von ?? ""}–${v.zeit_bis ?? ""}`
                      }`}
                      className={`inline-block size-2 rounded-full ${
                        v.art === "wunsch" ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                  ))}
                </div>
              )}
              {abw && (
                <div className="mb-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {t(`abwesenheitArt.${abw.art}`)}
                  {abw.status === "beantragt" ? ` (${t("abwesenheit.status.beantragt")})` : ""}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {inhalt.map((s) => (
                  <SchichtPille
                    key={s.id}
                    s={s}
                    zone={zone}
                    farbe={bereichFarbe(s.arbeitsbereich_id)}
                    kurz={bereichKurz(s.arbeitsbereich_id)}
                    ziehbar={kannPlanen && !auswahlModus && s.status !== "abgesagt"}
                    ziehend={drag?.schichtId === s.id}
                    auswahlModus={auswahlModus}
                    gewaehlt={ausgewaehlt.has(s.id)}
                    kannPlanen={kannPlanen}
                    onDragStart={(e) => onDragStart(e, s)}
                    onDragEnd={onDragEnde}
                    onAuswahl={(shift) => onAuswahl(s.id, shift)}
                    onClick={() => onOeffnen(s)}
                    onTausch={() => onTausch(s)}
                    konfliktText={konfliktText}
                  />
                ))}
                {kannPlanen && regelnBestaetigt && !auswahlModus && !abw && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("dienstplan.schnellAnlegen")}
                        className={`w-full rounded-md text-xs text-muted-foreground/0 hover:bg-secondary hover:text-muted-foreground ${
                          inhalt.length === 0 ? "h-6" : "h-4"
                        }`}
                      >
                        +
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-1.5">
                      <div className="px-1.5 pb-1 text-xs font-medium text-muted-foreground">
                        {t("dienstplan.schnellAnlegen")}
                      </div>
                      {vorlagen
                        .filter((v) => !v.archived_at)
                        .map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => onSchnellAnlegen(user?.user_id ?? null, tag, v.id)}
                            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-secondary"
                          >
                            <span
                              className="rounded px-1 font-mono text-[10px] text-white"
                              style={{ backgroundColor: v.farbe }}
                            >
                              {v.kurz}
                            </span>
                            <span className="flex-1 truncate">{v.name}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {v.start_zeit.slice(0, 5)}–{v.end_zeit.slice(0, 5)}
                            </span>
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => onNeu(user?.user_id ?? null, tag)}
                        className="mt-1 flex w-full items-center gap-2 rounded-md border-t px-1.5 py-1.5 text-left text-xs hover:bg-secondary"
                      >
                        <Icon icon="ph:clock" className="size-3" />
                        {t("dienstplan.eigeneZeit")}
                      </button>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </td>
          );
        })}
        <td className="p-2 text-right align-top text-xs text-muted-foreground">
          {user ? (
            <>
              <div>
                {user.wochenstunden_soll !== null ? `${user.wochenstunden_soll} h` : "—"}
              </div>
              <div className="font-medium text-foreground">
                {stunden(minutenJePerson[user.user_id] ?? 0)} h
              </div>
              {user.azk_minuten !== null && user.azk_minuten !== undefined && (
                <div title={t("berichte.spalten.azk_saldo_minuten")}>{stunden(user.azk_minuten)}</div>
              )}
              {user.zuschlaege_minor !== null && user.zuschlaege_minor !== undefined && (
                <div title={t("berichte.namen.zuschlaege.titel")}>
                  {(user.zuschlaege_minor / 100).toFixed(2)}
                </div>
              )}
              {user.verdienstgrenze && <Verdienstbalken g={user.verdienstgrenze} />}
            </>
          ) : (
            <div>{offeneAnzahl}</div>
          )}
        </td>
      </tr>
    );
  }

  const alleZeilen = [
    ...(offeneZeile ? [offeneZeile] : []),
    ...blocks.flatMap((b) => b.zeilen),
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b bg-secondary/40">
            <th className="w-48 p-2 text-left font-medium">
              <div className="font-display text-base font-extrabold">{kwLabel}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {woche.slice(0, 4)} · {t("dienstplan.person")}
              </div>
            </th>
            {tage.map((tag, i) => (
              <th
                key={tag}
                className={`p-2 text-left font-medium ${
                  tag === heute ? "bg-primary/5" : wochenende(i) ? "bg-secondary/30" : ""
                }`}
              >
                <div className="flex items-baseline gap-1">
                  <span>{wochentagKurz(tag, locale)}</span>
                  <span className="text-xs text-muted-foreground">{tagKurz(tag, locale)}</span>
                </div>
                {feiertage[tag] && (
                  <div
                    className="truncate text-xs font-normal text-rose-700"
                    title={feiertage[tag]}
                  >
                    {feiertage[tag]}
                  </div>
                )}
              </th>
            ))}
            <th className="w-24 p-2 text-right font-medium">
              {t("dienstplan.soll")}/{t("dienstplan.ist")}
            </th>
          </tr>
        </thead>
        {gruppiert ? (
          <>
            {offeneZeile && <tbody>{zeile(offeneZeile)}</tbody>}
            {blocks.map((b) => {
              const id = b.bereich?.id ?? OFFEN;
              const offen = !eingeklappt.has(id);
              return (
                <tbody key={id}>
                  <BereichKopf
                    bereich={b.bereich}
                    offen={offen}
                    onToggle={() => onBereichToggle(id)}
                    anzahlPersonen={b.zeilen.length}
                    spalten={tage.length}
                  />
                  {offen && (
                    <>
                      {b.zeilen.map((z) => zeile(z, b.bereich?.id ?? null))}
                      <BereichKpiZeilen
                        bereichId={b.bereich?.id ?? null}
                        zeilen={kennzahlZeilen}
                        tage={tage}
                        bereichTage={
                          kennzahlBereiche.get(b.bereich?.id ?? "") ??
                          new Map<string, KennzahlBereichTag>()
                        }
                        gesamtTage={kennzahlTage}
                        currency={currency}
                        heute={heute}
                        wochenende={wochenende}
                      />
                    </>
                  )}
                </tbody>
              );
            })}
          </>
        ) : (
          <tbody>
            {alleZeilen.map((z) => zeile(z))}
            {alleZeilen.length === 0 && (
              <tr>
                <td colSpan={tage.length + 2} className="p-6 text-center text-muted-foreground">
                  {t("dienstplan.keinePersonen")}
                </td>
              </tr>
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}

/** Verbrauchsbalken der Verdienstgrenze — nur die Leitung bekommt die Werte. */
function Verdienstbalken({
  g,
}: {
  g: NonNullable<PlanPersonPlus["verdienstgrenze"]>;
}) {
  const t = useTranslations("personal");
  const anteil = g.minor > 0 ? (g.verbraucht_minor + g.geplant_minor) / g.minor : 0;
  const ueber = anteil > 1;
  return (
    <div
      className="mt-0.5 h-1 rounded bg-secondary"
      title={`${t("akte.verdienstgrenze.titel")}: ${(
        (g.verbraucht_minor + g.geplant_minor) / 100
      ).toFixed(0)} / ${(g.minor / 100).toFixed(0)}`}
    >
      <div
        className={`h-1 rounded ${ueber ? "bg-rose-500" : "bg-emerald-500"}`}
        style={{ width: `${Math.min(100, Math.max(0, Math.round(anteil * 100)))}%` }}
      />
    </div>
  );
}

function SchichtPille({
  s,
  zone,
  farbe,
  kurz,
  ziehbar,
  ziehend,
  auswahlModus,
  gewaehlt,
  kannPlanen,
  onDragStart,
  onDragEnd,
  onAuswahl,
  onClick,
  onTausch,
  konfliktText: kt,
}: {
  s: SchichtPlus;
  zone: string;
  farbe: string;
  kurz: string;
  ziehbar: boolean;
  ziehend: boolean;
  auswahlModus: boolean;
  gewaehlt: boolean;
  kannPlanen: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onAuswahl: (shift: boolean) => void;
  onClick: () => void;
  onTausch: () => void;
  konfliktText: (k: Konflikt) => string;
}) {
  const t = useTranslations("personal");
  const fehler = s.konflikte.some((k) => k.schwere === "fehler");
  const warnung = s.konflikte.length > 0 && !fehler;
  const rahmen = s.status === "entwurf" ? "border-dashed" : "border-solid";
  const titel = [
    `${tagInZone(s.start_at, zone)} ${uhrzeitInZone(s.start_at, zone)}–${uhrzeitInZone(s.end_at, zone)}`,
    s.property_title,
    s.notiz,
    ...s.konflikte.map(kt),
  ]
    .filter(Boolean)
    .join("\n");

  // Im Auswahlmodus ist die Kachel eine Checkbox-Zeile, sonst ein Knopf: ein
  // Element, das beides gleichzeitig wäre, verschluckt je nach Klickziel die
  // andere Absicht.
  return (
    <div
      className={`flex w-full items-center gap-1 rounded-md border-l-4 border px-1.5 py-0.5 text-left text-xs ${rahmen} ${
        ziehend ? "opacity-40" : ""
      } ${s.status === "abgesagt" ? "line-through opacity-50" : ""} ${
        s.user_id ? "bg-card" : "bg-amber-50"
      } ${gewaehlt ? "ring-2 ring-primary" : ""}`}
      style={{ borderLeftColor: farbe }}
      draggable={ziehbar}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {auswahlModus && (
        <Checkbox
          checked={gewaehlt}
          onClick={(e) => onAuswahl(e.shiftKey)}
          aria-label={t("mehrfach.auswaehlen")}
        />
      )}
      <button
        type="button"
        onClick={(e) => (auswahlModus ? onAuswahl(e.shiftKey) : onClick())}
        title={titel}
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
      >
        <span className="font-medium tabular-nums">
          {uhrzeitInZone(s.start_at, zone)}–{uhrzeitInZone(s.end_at, zone)}
        </span>
        {kurz && <span className="text-muted-foreground">{kurz}</span>}
        {s.property_title && (
          <span className="truncate text-muted-foreground">{s.property_title}</span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          {s.quelle === "bedarf_aufgabe" && (
            <Icon icon="ph:list-checks" className="size-3 text-muted-foreground" />
          )}
          {s.status === "bestaetigt" && <Icon icon="ph:check" className="size-3 text-emerald-600" />}
          {s.tausch_status && (
            <Icon icon="ph:arrows-left-right" className="size-3 text-sky-600" />
          )}
          {!s.user_id && s.bewerbungen > 0 && (
            <span className="rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {s.bewerbungen}
            </span>
          )}
          {fehler && <Icon icon="ph:warning-octagon" className="size-3 text-destructive" />}
          {warnung && <Icon icon="ph:warning" className="size-3 text-amber-600" />}
        </span>
      </button>
      {kannPlanen && !auswahlModus && s.user_id && s.status !== "abgesagt" && (
        <button
          type="button"
          onClick={onTausch}
          aria-label={t("tausch.anfragen")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Icon icon="ph:arrows-left-right" className="size-3" />
        </button>
      )}
    </div>
  );
}
