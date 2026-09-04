"use client";

// Wochenvorlagen (Vertrag §1.4): ein Zeitgerüst einer Woche speichern und auf
// eine andere Woche legen.
//
// ZWEI SCHALTER, EINE BEDEUTUNG — „mit Personen". Beim SPEICHERN entscheidet
// er, ob die Vorlage die Zuordnung mitnimmt oder nur Zeiten/Bereiche; beim
// ANWENDEN, ob sie sie auch setzt. Beides ist bewusst getrennt: eine Vorlage
// MIT Personen lässt sich ohne sie anwenden (Gerüst für eine neue Besetzung),
// eine Vorlage OHNE Personen kann sie nie liefern — deshalb ist der Schalter
// beim Anwenden dann aus und gesperrt, statt eine Wirkung zu versprechen, die
// die Daten nicht haben.
//
// Der Server prüft Regeln und antwortet 409 mit Konflikten; die Rückfrage
// („trotzdem?") führt der Dienstplan, weil er denselben Fluss auch für die
// Einzelschicht und die Mehrfachaktion hat — EIN Konfliktfluss, nicht drei.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import type { Wochenvorlage } from "@/lib/personal-planung-typen";
import { tagKurz } from "@/lib/personal-zeit";

type Modus = "liste" | "speichern";

export function WochenvorlagenDialog({
  woche,
  vorlagen,
  laden,
  laeuft,
  kannPlanen,
  onClose,
  onSpeichern,
  onUmbenennen,
  onLoeschen,
  onAnwenden,
}: {
  /** Montag der angezeigten Woche — Quelle beim Speichern, Ziel beim Anwenden. */
  woche: string;
  vorlagen: Wochenvorlage[];
  laden: boolean;
  laeuft: boolean;
  kannPlanen: boolean;
  onClose: () => void;
  onSpeichern: (werte: { name: string; notiz: string; mit_personen: boolean }) => void;
  onUmbenennen: (id: string, werte: { name: string; notiz: string }) => void;
  onLoeschen: (id: string) => void;
  onAnwenden: (id: string, mitPersonen: boolean) => void;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();

  const [modus, setModus] = useState<Modus>("liste");
  const [name, setName] = useState("");
  const [notiz, setNotiz] = useState("");
  const [mitPersonen, setMitPersonen] = useState(true);
  // Pro Vorlage ein eigener „mit Personen"-Zustand fürs Anwenden.
  const [anwendenMit, setAnwendenMit] = useState<Record<string, boolean>>({});
  const [umbenennen, setUmbenennen] = useState<string | null>(null);
  const [neuerName, setNeuerName] = useState("");
  const [neueNotiz, setNeueNotiz] = useState("");

  // Vorbelegung des Namens beim Wechsel in die Speichern-Maske.
  useEffect(() => {
    if (modus === "speichern") setName(t("wochenvorlagen.namensVorschlag", { woche: tagKurz(woche, locale) }));
  }, [modus, woche, locale, t]);

  function speichernAbsenden(e: React.FormEvent) {
    e.preventDefault();
    const sauber = name.trim();
    if (!sauber) return;
    onSpeichern({ name: sauber, notiz: notiz.trim(), mit_personen: mitPersonen });
  }

  function umbenennenAbsenden(e: React.FormEvent, id: string) {
    e.preventDefault();
    const sauber = neuerName.trim();
    if (!sauber) return;
    onUmbenennen(id, { name: sauber, notiz: neueNotiz.trim() });
    setUmbenennen(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold">{t("wochenvorlagen.titel")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("schliessen")}
            className="text-muted-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("wochenvorlagen.hint", { woche: tagKurz(woche, locale) })}
        </p>

        {modus === "speichern" ? (
          <form onSubmit={speichernAbsenden} className="grid gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("name")}</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("notiz")}</span>
              <Textarea rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} />
            </label>
            <label className="flex items-start justify-between gap-3 rounded-xl border p-3 text-sm">
              <span>
                <span className="font-medium">{t("wochenvorlagen.mitPersonen")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("wochenvorlagen.mitPersonenSpeichernHint")}
                </span>
              </span>
              <Switch checked={mitPersonen} onCheckedChange={setMitPersonen} />
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setModus("liste")}
                disabled={laeuft}
              >
                {t("abbrechen")}
              </Button>
              <Button type="submit" className="rounded-full" disabled={laeuft || !name.trim()}>
                <Icon icon="ph:floppy-disk" className="mr-1 size-4" />
                {t("speichern")}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {kannPlanen && (
              <Button
                variant="outline"
                className="mb-3 w-full rounded-full"
                onClick={() => setModus("speichern")}
                disabled={laeuft}
              >
                <Icon icon="ph:bookmark-simple" className="mr-1 size-4" />
                {t("wochenvorlagen.ausDieserWoche")}
              </Button>
            )}

            {laden && (
              <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Icon icon="ph:circle-notch" className="size-4 animate-spin" />
                {t("wochenvorlagen.laden")}
              </p>
            )}

            {!laden && vorlagen.length === 0 && (
              <div className="rounded-2xl border border-dashed p-6 text-center">
                <Icon icon="ph:bookmarks-simple" className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 font-medium">{t("wochenvorlagen.leerTitel")}</p>
                <p className="text-sm text-muted-foreground">{t("wochenvorlagen.leerText")}</p>
              </div>
            )}

            <ul className="divide-y">
              {vorlagen.map((v) => {
                const mit = anwendenMit[v.id] ?? false;
                return (
                  <li key={v.id} className="py-3">
                    {umbenennen === v.id ? (
                      <form onSubmit={(e) => umbenennenAbsenden(e, v.id)} className="grid gap-2">
                        <Input
                          value={neuerName}
                          onChange={(e) => setNeuerName(e.target.value)}
                          aria-label={t("name")}
                          required
                        />
                        <Textarea
                          rows={2}
                          value={neueNotiz}
                          onChange={(e) => setNeueNotiz(e.target.value)}
                          aria-label={t("notiz")}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-full"
                            onClick={() => setUmbenennen(null)}
                          >
                            {t("abbrechen")}
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            className="rounded-full"
                            disabled={laeuft || !neuerName.trim()}
                          >
                            {t("speichern")}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{v.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {t("wochenvorlagen.anzahlSchichten", { anzahl: v.anzahl_schichten })}
                              {v.created_at ? ` · ${tagKurz(v.created_at.slice(0, 10), locale)}` : ""}
                            </div>
                            {v.notiz && (
                              <p className="mt-1 text-xs text-muted-foreground">{v.notiz}</p>
                            )}
                          </div>
                          {kannPlanen && (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full"
                                aria-label={t("wochenvorlagen.umbenennen")}
                                title={t("wochenvorlagen.umbenennen")}
                                disabled={laeuft}
                                onClick={() => {
                                  setUmbenennen(v.id);
                                  setNeuerName(v.name);
                                  setNeueNotiz(v.notiz ?? "");
                                }}
                              >
                                <Icon icon="ph:pencil-simple" className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-destructive"
                                aria-label={t("loeschen")}
                                title={t("loeschen")}
                                disabled={laeuft}
                                onClick={() => {
                                  if (window.confirm(t("wochenvorlagen.loeschenFrage", { name: v.name }))) {
                                    onLoeschen(v.id);
                                  }
                                }}
                              >
                                <Icon icon="ph:trash" className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {kannPlanen && (
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <Button
                              size="sm"
                              className="rounded-full"
                              disabled={laeuft}
                              onClick={() => onAnwenden(v.id, mit)}
                            >
                              <Icon icon="ph:calendar-plus" className="mr-1 size-4" />
                              {t("wochenvorlagen.anwenden")}
                            </Button>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Switch
                                checked={mit}
                                onCheckedChange={(v2) =>
                                  setAnwendenMit((s) => ({ ...s, [v.id]: v2 }))
                                }
                              />
                              {t("wochenvorlagen.mitPersonen")}
                            </label>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" className="rounded-full" onClick={onClose}>
                {t("schliessen")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
