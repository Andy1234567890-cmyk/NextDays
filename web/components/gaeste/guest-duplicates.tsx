"use client";

// Dubletten-Vorschlag der Gästekartei.
//
// WARUM ES DAS BRAUCHT: Der Gast-Resolver (apps/api/.../guests/identity.py)
// mergt bewusst NIE über den Namen — zwei echte „Andreas Müller" dürfen nicht
// zu einer Person verschmelzen. Kommt dieselbe Person aber einmal MIT und
// einmal OHNE Kontaktdaten herein (CSV-Import, Portal-Feed ohne E-Mail), fehlt
// jeder Schlüssel und es entstehen zwei Zeilen.
//
// Live am 03.09.2026 in der Kartei: „Andreas Dumler" zweimal — eine Zeile ohne
// jeden Kontakt (Aufenthalt 2026-08-16), eine mit Booking-Alias-Mail und
// Rufnummer (2027-07-31). Der Betrieb sah zwei Zeilen und hatte keinen Weg,
// sie zusammenzuführen: `POST /guests/merge` gab es im Backend, aber keinen
// Knopf dafür in irgendeiner Oberfläche.
//
// Es bleibt ein VORSCHLAG: nur der Betrieb weiß, ob es dieselbe Person ist.
// Deshalb nennt jede Gruppe den Grund („gleiche E-Mail" / „gleicher Name"),
// zeigt beide Zeilen mit Aufenthalt und Kontakt nebeneinander, und das
// Zusammenführen verlangt eine ausdrückliche Bestätigung — es ist nicht
// umkehrbar.
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import {
  type DuplicateCandidate,
  type DuplicateGroup,
  listDuplicates,
  mergeGuests,
} from "@/lib/guests";

export function GuestDuplicates({
  canEdit,
  onMerged,
}: {
  canEdit: boolean;
  onMerged: () => void;
}) {
  const t = useTranslations("guests.duplicates");
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const laden = () =>
    start(async () => {
      const res = await listDuplicates();
      if (res.ok) {
        setGroups(res.data.groups);
        setError(null);
      } else {
        setError(res.error);
      }
    });

  // Einmal beim Aufbau prüfen: der Hinweis muss von selbst erscheinen, sonst
  // findet ihn niemand. Ein Betrieb sucht nicht nach einem Knopf für ein
  // Problem, von dem er nichts weiß.
  useEffect(() => {
    laden();
  }, []);

  // Kein Befund → gar nichts anzeigen. Ein leerer Kasten „keine Dubletten"
  // kostet jeden Tag Platz für eine Aussage, die niemand braucht.
  if (error) {
    return (
      <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!groups || groups.length === 0) return null;

  const anzahlGaeste = groups.reduce((n, g) => n + g.guests.length, 0);

  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Icon
          icon="ph:users-three"
          className="size-5 shrink-0 text-amber-700 dark:text-amber-400"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {t("title", { count: groups.length })}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t("subtitle", { guests: anzahlGaeste })}
          </span>
        </span>
        <Icon
          icon={open ? "ph:caret-up" : "ph:caret-down"}
          className="size-4 shrink-0 text-muted-foreground"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-amber-300/50 px-4 py-3 dark:border-amber-500/20">
          {groups.map((g) => (
            <DuplicateRow
              key={`${g.reason}:${g.key}`}
              group={g}
              canEdit={canEdit}
              onMerged={() => {
                laden();
                onMerged();
              }}
            />
          ))}
          {pending && (
            <p className="text-xs text-muted-foreground">{t("loading")}</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Eine Dubletten-Gruppe: der Grund, die Kandidaten, der Knopf. */
function DuplicateRow({
  group,
  canEdit,
  onMerged,
}: {
  group: DuplicateGroup;
  canEdit: boolean;
  onMerged: () => void;
}) {
  const t = useTranslations("guests.duplicates");
  const [confirm, setConfirm] = useState(false);

  // Ziel-Vorschlag: der Gast MIT Kontaktdaten, bei Gleichstand der mit den
  // meisten Aufenthalten. Begründung: nach dem Merge wird die Quelle
  // anonymisiert (Kontakt genullt) — würde man in die kontaktlose Zeile
  // mergen, wäre die E-Mail hinterher weg. `has_contact` kommt vom Server aus
  // den Rohspalten, weil `email`/`phone` hier maskiert sein können.
  const sortiert = [...group.guests].sort(
    (a, b) =>
      Number(b.has_contact) - Number(a.has_contact) ||
      b.stays_count - a.stays_count,
  );
  const ziel = sortiert[0];
  const quellen = sortiert.slice(1);

  return (
    <div className="rounded-(--radius) border border-border bg-background p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t(`reason.${group.reason}`)}
      </p>
      <div className="flex flex-col gap-2">
        {sortiert.map((g) => (
          <Candidate key={g.id} g={g} isTarget={g.id === ziel.id} />
        ))}
      </div>

      {canEdit && quellen.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {confirm ? (
            <MergeConfirm
              target={ziel}
              sources={quellen}
              onCancel={() => setConfirm(false)}
              onDone={onMerged}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirm(true)}
            >
              <Icon icon="ph:arrows-merge" className="size-4" />
              {t("mergeAction")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Eine Gast-Zeile im Vorschlag — mit Kontakt, Aufenthalten, Ziel-Markierung. */
function Candidate({
  g,
  isTarget,
}: {
  g: DuplicateCandidate;
  isTarget: boolean;
}) {
  const t = useTranslations("guests.duplicates");
  const format = useFormatter();
  const letzter = g.last_stay_at
    ? format.dateTime(new Date(g.last_stay_at), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  // Was der Betrieb zum Unterscheiden braucht: Kontakt und letzter Aufenthalt.
  // Bei maskierten Rollen sind die Kontaktwerte null — dann steht dort der
  // Hinweis, DASS Kontakt vorliegt, nicht welcher (§4.3).
  const kontakt =
    g.email ?? g.phone ?? (g.has_contact ? t("contactHidden") : t("noContact"));

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <a
        href={`/gaeste/${g.id}`}
        className="font-medium underline-offset-2 hover:underline"
      >
        {g.name ?? "—"}
      </a>
      {isTarget && (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
          {t("targetBadge")}
        </span>
      )}
      <span className="text-muted-foreground">{kontakt}</span>
      <span className="text-xs text-muted-foreground/70">
        {t("stays", { count: g.stays_count })}
        {letzter ? ` · ${letzter}` : ""}
      </span>
    </div>
  );
}

/** Bestätigung vor dem Zusammenführen. Nicht umkehrbar → keine stille Aktion.
 *
 *  Bei mehr als zwei Kandidaten werden alle Quellen NACHEINANDER ins Ziel
 *  gemergt. Nacheinander und nicht parallel, weil jeder Merge Reservierungen
 *  umhängt und die Quelle anonymisiert — zwei gleichzeitige Läufe auf dasselbe
 *  Ziel würden sich in die Quere kommen. Schlägt einer fehl, bricht die Kette
 *  ab und meldet das (Wurzel 5: kein stilles „fertig").
 */
function MergeConfirm({
  target,
  sources,
  onCancel,
  onDone,
}: {
  target: DuplicateCandidate;
  sources: DuplicateCandidate[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("guests.duplicates");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const merge = () =>
    start(async () => {
      setError(null);
      for (const quelle of sources) {
        const res = await mergeGuests(quelle.id, target.id);
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      onDone();
    });

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm">
        {t("confirmText", {
          target: target.name ?? "—",
          count: sources.length,
        })}
      </p>
      <p className="text-xs text-muted-foreground">{t("confirmHint")}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={merge} disabled={pending}>
          {pending ? t("merging") : t("confirmMerge")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
