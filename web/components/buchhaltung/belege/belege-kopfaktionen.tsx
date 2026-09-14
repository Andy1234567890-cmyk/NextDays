"use client";

// Kopfzeile der Belegliste: „Neuer Beleg" (eine Editor-Hülle je Belegart) und
// auf dem Tab „Wiederkehrend" der Knopf „Fällige jetzt erzeugen" (idempotent —
// ein zweiter Klick legt nichts doppelt an, Unique-Index 0661).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { runRecurring } from "@/lib/buchhaltung-belege";
import { EDITOR_BELEGARTEN, type Belegart } from "@/lib/buchhaltung-belege-typen";

export function BelegeKopfaktionen({
  art,
  labels,
}: {
  art: Belegart;
  labels: Record<Belegart, string>;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [, starten] = useTransition();

  async function lauf() {
    setBusy(true);
    const res = await runRecurring();
    setBusy(false);
    if (res.ok) {
      setMeldung({
        ok: true,
        text: t("belegePage.runDone", {
          created: res.data.created,
          skipped: res.data.skipped,
          completed: res.data.completed,
        }),
      });
      starten(() => router.refresh());
    } else {
      setMeldung({ ok: false, text: res.error });
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {art === "recurring" && (
          <Button variant="outline" onClick={lauf} disabled={busy} className="gap-2">
            <Icon icon={busy ? "ph:spinner" : "ph:play"} className={`size-4 ${busy ? "animate-spin" : ""}`} />
            {t("belegePage.runNow")}
          </Button>
        )}
        {art === "quote" ? (
          <Button asChild className="gap-2">
            <Link href="/buchhaltung/angebote">
              <Icon icon="ph:plus" className="size-4" />
              {t("belegePage.newQuote")}
            </Link>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Icon icon="ph:plus" className="size-4" />
                {t("belegePage.newDocument")}
                <Icon icon="ph:caret-down" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EDITOR_BELEGARTEN.map((a) => (
                <DropdownMenuItem key={a} asChild>
                  <Link href={`/buchhaltung/belege/${a}/neu`}>{labels[a]}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {meldung && (
        <p
          role={meldung.ok ? "status" : "alert"}
          className={`text-sm ${meldung.ok ? "text-accent" : "text-destructive"}`}
        >
          {meldung.text}
        </p>
      )}
    </div>
  );
}
