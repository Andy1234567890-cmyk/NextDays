"use client";

// Löschen eines BILDES — mit der Verwendungsprüfung davor (Wurzel 1).
//
// Der Ordner-Löschdialog steht dagegen in `ordner-baum.tsx`: er braucht eine
// andere Vorschau (Unterordner + Bilder, die in die Wurzel rutschen) und hängt
// eng an der Baumzeile, die ihn auslöst. Zwei Vorschauen, zwei Dialoge — eine
// gemeinsame Komponente hätte nur eine `if`-Verzweigung ohne echten Nutzen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { Medium } from "@/lib/site-pages";
import { type MediaVerwendung, mediumVerwendung } from "@/lib/site-medien";

import { MedienVorschau } from "./medien-vorschau";

export function LoeschenDialog({
  medium,
  onAbbrechen,
  onBestaetigen,
}: {
  medium: Medium;
  onAbbrechen: () => void;
  onBestaetigen: () => void;
}) {
  const t = useTranslations("website.mediathek");
  const [verwendung, setVerwendung] = useState<
    MediaVerwendung[] | null | "fehler"
  >(null);

  useEffect(() => {
    let lebt = true;
    void mediumVerwendung(medium.id).then((res) => {
      if (!lebt) return;
      setVerwendung(res.ok ? res.data.items : "fehler");
    });
    return () => {
      lebt = false;
    };
  }, [medium.id]);

  const verwendet = Array.isArray(verwendung) && verwendung.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("loeschDialog.titel")}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4"
      onClick={onAbbrechen}
    >
      <div
        className="w-full max-w-md rounded-(--radius) border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-extrabold">
          {t("loeschDialog.titel")}
        </h3>

        <div className="mt-3 flex items-center gap-3">
          {/* Vorschau über das gemeinsame Bauteil: seit die Mediathek Videos,
              Audio und Dateien trägt, wäre ein <img src> auf eine MP4 ein
              zerbrochenes Bild im Löschdialog — genau dort, wo man sicher sein
              will, was man löscht. */}
          <span className="size-14 shrink-0 overflow-hidden rounded-(--radius) border border-border">
            <MedienVorschau medium={medium} className="size-full" />
          </span>
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {medium.filename ?? medium.url}
          </p>
        </div>

        <div className="mt-4">
          {verwendung === null ? (
            <p className="text-sm text-muted-foreground">{t("ordner.laedt")}</p>
          ) : verwendung === "fehler" ? (
            <p className="text-sm text-muted-foreground">
              {t("loeschDialog.pruefungFehlgeschlagen")}
            </p>
          ) : verwendet ? (
            <div className="rounded-(--radius) border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                <Icon icon="ph:warning" className="size-4 shrink-0" />
                {t("loeschDialog.verwendetWarnung", { anzahl: verwendung.length })}
              </p>
              <ul className="mt-1.5 flex flex-col gap-0.5 pl-5 text-xs text-muted-foreground">
                {verwendung.slice(0, 6).map((v, i) => (
                  <li key={i} className="list-disc">
                    {v.kind === "block"
                      ? t("details.verwendungBlock", {
                          typ: v.block_type ?? "",
                          seite: v.page_title || t("details.verwendungOhneTitel"),
                        })
                      : v.kind === "page"
                        ? t("details.verwendungSeite", {
                            seite: v.page_title || t("details.verwendungOhneTitel"),
                          })
                        : v.kind === "branding"
                          ? t("details.verwendungBranding", { feld: v.field ?? "" })
                          : t("details.verwendungCode", { feld: v.field ?? "" })}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("loeschDialog.unverwendet")}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAbbrechen}
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-secondary"
          >
            {t("ordner.abbrechen")}
          </button>
          <button
            type="button"
            onClick={onBestaetigen}
            className="rounded-full bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground transition hover:opacity-90"
          >
            {t("loeschDialog.bestaetigen")}
          </button>
        </div>
      </div>
    </div>
  );
}
