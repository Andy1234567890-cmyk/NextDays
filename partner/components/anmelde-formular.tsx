"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { anmelden, passwortVergessen } from "@/lib/auth";
import { PasswortFeld } from "./passwort-feld";

export function AnmeldeFormular({ weiter }: { weiter: string }) {
  const t = useTranslations("anmelden");
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  return (
    <form
      className="mt-8 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFehler(null);
        starte(async () => {
          const res = await anmelden(email.trim(), passwort);
          if (res.ok) {
            router.push(weiter);
            router.refresh();
            return;
          }
          if (res.status === 503) setFehler(t("stoerung"));
          else if (res.status === 403) setFehler(t("keinPartnerKonto"));
          else setFehler(t("fehlgeschlagen"));
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("email")}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="rounded-full border border-border bg-transparent px-4 py-2.5 outline-none focus-visible:border-foreground" />
      </label>
      <div className="text-sm">
        <PasswortFeld wert={passwort} setzen={setPasswort} label={t("passwort")} />
      </div>
      {fehler && <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">{fehler}</p>}
      {hinweis && <p className="rounded-xl bg-muted px-3 py-2 text-sm">{hinweis}</p>}
      <button type="submit" disabled={laeuft} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
        {t("anmelden")}
      </button>
      <button
        type="button"
        disabled={laeuft || !email.trim()}
        onClick={() =>
          starte(async () => {
            const res = await passwortVergessen(email.trim());
            setHinweis(res.ok ? t("resetGesendet") : t("stoerung"));
          })
        }
        className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
      >
        {t("passwortVergessen")}
      </button>
    </form>
  );
}
