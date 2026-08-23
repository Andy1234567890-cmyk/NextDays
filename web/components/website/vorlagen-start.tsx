"use client";

// Start mit einer Vorlage — der Einstieg für ein leeres Konto.
//
// Ein Klick legt Startseite, „Über uns" und „Kontakt" mit echten Texten und
// Bildern an UND setzt Theme, Farben und Schriften. Der Kunde beginnt also nicht
// auf einer weißen Fläche, sondern auf einer fertigen Seite, die er anpasst.
//
// Die IDs müssen zu den Backend-Vorlagen passen (`templates.py`). Vorher standen
// hier `klassik`/`vermittler`/`minimal`, während das Backend
// `bergchalet`/`kueste`/`stadt` kannte — jeder Klick lief in ein 404
// „Unbekanntes Template", und niemandem fiel es auf, weil der Fehler nur als
// Toast erschien.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { applyTemplate } from "@/lib/site-pages";

const VORLAGEN = ["bergchalet", "kueste", "stadt"] as const;

export function VorlagenStart() {
  const t = useTranslations("website");
  const router = useRouter();
  const [pending, start] = useTransition();

  function anwenden(id: string) {
    start(async () => {
      const res = await applyTemplate(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("vorlagen.angewendet"));
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-display text-sm font-extrabold">
          {t("vorlagen.titel")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("vorlagen.hinweis")}</p>
      </div>
      {/* Einspaltig: auch in der breiteren Leiste sind drei Kacheln
          nebeneinander unlesbar — untereinander liest man den Hinweis. */}
      <div className="flex flex-col gap-2">
        {VORLAGEN.map((id) => (
          <button
            key={id}
            type="button"
            disabled={pending}
            onClick={() => anwenden(id)}
            className="flex flex-col items-start gap-0.5 rounded-(--radius) border border-border px-3 py-2 text-left transition hover:border-foreground hover:bg-secondary/50 disabled:opacity-60"
          >
            <span className="text-sm font-medium">{t(`vorlagen.${id}`)}</span>
            <span className="text-xs leading-snug text-muted-foreground">
              {t(`vorlagen.${id}Hinweis`)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
