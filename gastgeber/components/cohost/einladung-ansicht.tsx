"use client";

// Die Einladung, wie der Eingeladene sie sieht.
//
// Zwei Dinge müssen hier unmissverständlich sein, bevor jemand zustimmt:
// WER einlädt und WORAUF die Person danach Zugriff hat. Deshalb steht die
// vollständige Rechteliste auf der Seite — nicht hinter einem „mehr erfahren".
import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BriefIllustration } from "@/components/objekt-editor/brief-illustration";
import { stufeVon } from "@/components/objekt-editor/cohost-katalog";
import type { PendingInvitation } from "@/lib/cohost-einladung";
import {
  lehneEinladungAb,
  nimmEinladungAn,
} from "@/lib/cohost-einladung-actions";

export function EinladungAnsicht({
  token,
  einladung,
}: {
  token: string;
  einladung: PendingInvitation;
}) {
  const router = useRouter();
  const reduziert = useReducedMotion();
  const [laeuft, setLaeuft] = useState(false);
  const [erledigt, setErledigt] = useState<"an" | "ab" | null>(null);

  const stufe = stufeVon(einladung.access);

  async function annehmen() {
    setLaeuft(true);
    const res = await nimmEinladungAn(token);
    setLaeuft(false);
    if (res.ok) {
      setErledigt("an");
      toast.success("Einladung angenommen.");
      router.refresh();
    } else {
      // Die Backend-Meldung ist fachlich („Bitte bestätige zuerst deine
      // Identität") und hilft mehr als ein generischer Text.
      toast.error(res.fehler);
    }
  }

  async function ablehnen() {
    setLaeuft(true);
    const res = await lehneEinladungAb(token);
    setLaeuft(false);
    if (res.ok) {
      setErledigt("ab");
    } else {
      toast.error(res.fehler);
    }
  }

  if (erledigt) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <div
          className={`flex size-16 items-center justify-center rounded-full ${
            erledigt === "an" ? "bg-foreground" : "bg-muted"
          }`}
        >
          <Icon
            icon={erledigt === "an" ? "ph:check" : "ph:x"}
            className={`size-8 ${
              erledigt === "an" ? "text-background" : "text-muted-foreground"
            }`}
          />
        </div>
        <h1 className="mt-6 font-sans text-[2rem] font-bold tracking-tight">
          {erledigt === "an" ? "Du bist dabei" : "Einladung abgelehnt"}
        </h1>
        <p className="mt-3 text-[0.9375rem] text-muted-foreground">
          {erledigt === "an"
            ? `Du bist jetzt Co-Gastgeber für „${einladung.property_title ?? "das Objekt"}". Der Gastgeber wurde informiert.`
            : "Wir haben dem Gastgeber Bescheid gegeben."}
        </p>
        {erledigt === "an" && (
          <a
            href="/objekte"
            className="mt-8 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Zu den Objekten
          </a>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <motion.div
        initial={reduziert ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduziert ? 0 : 0.35 }}
      >
        <div className="flex justify-center">
          <BriefIllustration className="max-w-[13rem]" />
        </div>

        <h1 className="mt-8 text-center font-sans text-[2rem] font-bold leading-tight tracking-tight">
          {einladung.inviter_name
            ? `${einladung.inviter_name} lädt dich als Co-Gastgeber ein`
            : "Du wurdest als Co-Gastgeber eingeladen"}
        </h1>
        {einladung.property_title && (
          <p className="mt-3 text-center text-[0.9375rem] text-muted-foreground">
            für „{einladung.property_title}"
          </p>
        )}

        {einladung.note && (
          <blockquote className="mt-8 rounded-2xl bg-muted/50 p-5 text-[0.9375rem] leading-relaxed">
            {einladung.note}
          </blockquote>
        )}

        {/* Die vollständige Rechteliste — nicht eingeklappt. Wer zustimmt, soll
            wissen, worauf. */}
        <div className="mt-8 rounded-2xl border border-border p-6">
          <p className="flex items-center gap-2 font-semibold">
            <Icon icon={stufe.icon} className="size-5 shrink-0" />
            {stufe.label}
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Du kannst dann
          </p>
          <ul className="mt-2 space-y-1.5">
            {stufe.darf.map((d) => (
              <li key={d} className="flex gap-2 text-sm text-muted-foreground">
                <Icon icon="ph:check" className="mt-0.5 size-4 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
          {stufe.darfNicht.length > 0 && (
            <>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nicht möglich
              </p>
              <ul className="mt-2 space-y-1.5">
                {stufe.darfNicht.map((d) => (
                  <li key={d} className="flex gap-2 text-sm text-muted-foreground">
                    <Icon icon="ph:x" className="mt-0.5 size-4 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Zum Annehmen brauchst du ein myNextDays-Konto mit derselben
          E-Mail-Adresse und eine bestätigte Identität.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void ablehnen()}
            className="rounded-full px-6 py-3 text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-50"
          >
            Ablehnen
          </button>
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void annehmen()}
            className="rounded-full bg-foreground px-8 py-3 text-sm font-semibold text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-50"
          >
            {laeuft ? "Einen Moment …" : "Einladung annehmen"}
          </button>
        </div>
      </motion.div>
    </main>
  );
}
