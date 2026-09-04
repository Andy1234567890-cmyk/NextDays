"use client";

// Tagesansicht des Dienstplans: EINE Spalte je Person, links das Stundenraster
// 0–24 Uhr, die Kacheln proportional zu ihrer Dauer.
//
// WARUM PROPORTIONAL und nicht als Liste: an einem einzelnen Tag ist die Frage
// nicht „wer arbeitet", sondern „wann ist wer da und wo klafft eine Lücke".
// Das sieht man nur, wenn eine Vier-Stunden-Kachel halb so hoch ist wie eine
// Acht-Stunden-Kachel und Überlappungen sich als Nebeneinander zeigen.
//
// ZEITRECHNUNG: Position und Höhe aus der Ortszeit (`minutenInZone`), nicht aus
// UTC — sonst rutscht der ganze Tag um den Zonenversatz und am Tag der
// Zeitumstellung um eine Stunde (personal-zeit.ts).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@nextdays/ui/avatar";
import { initialsOf } from "@/lib/initials";
import type { PlanPersonPlus, SchichtPlus, Verfuegbarkeitstag } from "@/lib/personal-planung-typen";
import type { Abwesenheit, Arbeitsbereich, Konflikt } from "@/lib/personal-typen";
import { stunden } from "@/lib/personal-typen";
import { minutenInZone, uhrzeitInZone } from "@/lib/personal-zeit";

/** Höhe einer Stunde in rem — die ganze Spalte ist 24 × diese Höhe hoch. */
const STUNDE_REM = 2.5;

export function DienstplanTag({
  tag,
  schichten,
  personen,
  abwesenheiten,
  verfuegbarkeiten,
  arbeitsbereiche,
  zone,
  kannPlanen,
  auswahlModus,
  ausgewaehlt,
  onAuswahl,
  onOeffnen,
  onNeu,
  konfliktText,
}: {
  tag: string;
  schichten: SchichtPlus[];
  personen: PlanPersonPlus[];
  abwesenheiten: Abwesenheit[];
  verfuegbarkeiten: Verfuegbarkeitstag[];
  arbeitsbereiche: Arbeitsbereich[];
  zone: string;
  kannPlanen: boolean;
  auswahlModus: boolean;
  ausgewaehlt: Set<string>;
  onAuswahl: (id: string, shift: boolean) => void;
  onOeffnen: (s: SchichtPlus) => void;
  onNeu: (userId: string | null, tag: string) => void;
  konfliktText: (k: Konflikt) => string;
}) {
  const t = useTranslations("personal");

  const bereichFarbe = (id: string | null) =>
    arbeitsbereiche.find((b) => b.id === id)?.farbe ?? "#64748b";
  const bereichKurz = (id: string | null) => arbeitsbereiche.find((b) => b.id === id)?.kurz ?? "";

  const abwesend = new Map<string, Abwesenheit>();
  for (const a of abwesenheiten) {
    if (a.status === "abgelehnt" || a.status === "storniert") continue;
    if (a.von <= tag && tag <= a.bis) abwesend.set(a.user_id, a);
  }

  const offene = schichten.filter((s) => !s.user_id && s.status !== "abgesagt");
  const spalten: { key: string; person: PlanPersonPlus | null }[] = [
    ...(kannPlanen || offene.length > 0 ? [{ key: "__offen__", person: null }] : []),
    ...personen.map((p) => ({ key: p.user_id, person: p })),
  ];

  /** Position und Höhe einer Kachel in rem, geklemmt auf den sichtbaren Tag. */
  function lage(s: SchichtPlus): { top: number; hoehe: number } {
    const startTag = s.datum === tag;
    const vonMin = startTag ? minutenInZone(s.start_at, zone) : 0;
    // Endet die Schicht nach Mitternacht, reicht die Kachel bis 24:00.
    const endeRoh = minutenInZone(s.end_at, zone);
    const uebernacht = endeRoh <= vonMin;
    const bisMin = uebernacht && startTag ? 24 * 60 : endeRoh;
    const dauer = Math.max(15, bisMin - vonMin);
    return { top: (vonMin / 60) * STUNDE_REM, hoehe: (dauer / 60) * STUNDE_REM };
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <div className="flex min-w-fit">
        {/* Stundenleiste */}
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-card">
          <div className="h-14 border-b" />
          <div className="relative" style={{ height: `${24 * STUNDE_REM}rem` }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute w-full border-t text-[10px] tabular-nums text-muted-foreground"
                style={{ top: `${h * STUNDE_REM}rem` }}
              >
                <span className="pl-1">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>
        </div>

        {spalten.map(({ key, person }) => {
          const eigene = schichten.filter(
            (s) =>
              (person ? s.user_id === person.user_id : !s.user_id) &&
              (s.status !== "abgesagt" || s.quelle === "abwesenheit"),
          );
          const abw = person ? abwesend.get(person.user_id) : undefined;
          const wuensche = person
            ? verfuegbarkeiten.filter((v) => v.user_id === person.user_id && v.datum === tag)
            : [];
          const minuten = eigene.reduce((n, s) => n + s.netto_minuten, 0);
          return (
            <div key={key} className="w-40 shrink-0 border-r last:border-r-0">
              {/* Spaltenkopf: Person */}
              <div className="flex h-14 items-center gap-2 border-b px-2">
                {person ? (
                  <>
                    <Avatar className="size-7">
                      <AvatarImage src={person.avatar_url ?? undefined} alt="" />
                      <AvatarFallback className="text-xs">
                        {initialsOf(person.full_name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate text-sm font-medium">
                        <span className="truncate">{person.full_name ?? "—"}</span>
                        {person.ist_schichtleitung && (
                          <span title={t("legende.schichtleitung")}>
                            <Icon icon="ph:key" className="size-3 text-amber-600" />
                          </span>
                        )}
                        {person.geburtstag_am === tag && (
                          <span title={t("legende.geburtstag")}>
                            <Icon icon="ph:cake" className="size-3 text-fuchsia-600" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {stunden(minuten)} h
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon icon="ph:user-plus" className="size-5" />
                    <span className="text-sm font-medium">{t("dienstplan.offen")}</span>
                  </div>
                )}
              </div>

              {/* Tagesspalte */}
              <div
                className={`relative ${abw ? "bg-secondary/50" : ""}`}
                style={{ height: `${24 * STUNDE_REM}rem` }}
                onDoubleClick={() => {
                  if (kannPlanen && !abw) onNeu(person?.user_id ?? null, tag);
                }}
              >
                {/* Stundenlinien */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-border/40"
                    style={{ top: `${h * STUNDE_REM}rem` }}
                  />
                ))}

                {/* Wunsch-/Sperrzeiten als Hintergrundband */}
                {wuensche.map((v) => {
                  const von = v.ganztags || !v.zeit_von ? 0 : Number(v.zeit_von.slice(0, 2)) * 60 + Number(v.zeit_von.slice(3, 5));
                  const bis = v.ganztags || !v.zeit_bis ? 24 * 60 : Number(v.zeit_bis.slice(0, 2)) * 60 + Number(v.zeit_bis.slice(3, 5));
                  return (
                    <div
                      key={`${v.art}-${v.datum}-${v.zeit_von ?? "g"}`}
                      title={t(`verfuegbar.art.${v.art}`)}
                      className={`absolute inset-x-0 ${
                        v.art === "wunsch" ? "bg-emerald-500/10" : "bg-rose-500/10"
                      }`}
                      style={{
                        top: `${(von / 60) * STUNDE_REM}rem`,
                        height: `${(Math.max(15, bis - von) / 60) * STUNDE_REM}rem`,
                      }}
                    />
                  );
                })}

                {abw && (
                  <div className="absolute inset-x-1 top-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {t(`abwesenheitArt.${abw.art}`)}
                  </div>
                )}

                {eigene.map((s) => {
                  const { top, hoehe } = lage(s);
                  const fehler = s.konflikte.some((k) => k.schwere === "fehler");
                  const warnung = s.konflikte.length > 0 && !fehler;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={(e) => {
                        if (auswahlModus) return onAuswahl(s.id, e.shiftKey);
                        onOeffnen(s);
                      }}
                      title={[
                        `${uhrzeitInZone(s.start_at, zone)}–${uhrzeitInZone(s.end_at, zone)}`,
                        s.property_title,
                        s.notiz,
                        ...s.konflikte.map(konfliktText),
                      ]
                        .filter(Boolean)
                        .join("\n")}
                      className={`absolute inset-x-1 overflow-hidden rounded-md border border-l-4 px-1.5 py-0.5 text-left text-xs ${
                        s.status === "entwurf" ? "border-dashed" : ""
                      } ${s.user_id ? "bg-card" : "bg-amber-50"} ${
                        ausgewaehlt.has(s.id) ? "ring-2 ring-primary" : ""
                      } ${s.status === "abgesagt" ? "line-through opacity-50" : ""}`}
                      style={{
                        top: `${top}rem`,
                        height: `${hoehe}rem`,
                        borderLeftColor: bereichFarbe(s.arbeitsbereich_id),
                      }}
                    >
                      <div className="flex items-center gap-1 tabular-nums">
                        {uhrzeitInZone(s.start_at, zone)}–{uhrzeitInZone(s.end_at, zone)}
                        {s.tausch_status && (
                          <Icon icon="ph:arrows-left-right" className="size-3 text-sky-600" />
                        )}
                        {fehler && (
                          <Icon icon="ph:warning-octagon" className="size-3 text-destructive" />
                        )}
                        {warnung && <Icon icon="ph:warning" className="size-3 text-amber-600" />}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {[bereichKurz(s.arbeitsbereich_id), s.property_title]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t("tag.hint", { zone })}</p>
    </div>
  );
}
