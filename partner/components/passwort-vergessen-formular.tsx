"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { passwortVergessen } from "@/lib/auth";

// Antwort ist immer dieselbe („falls ein Konto existiert …") — ob die Adresse
// ein Partnerkonto hat, verrät die Seite nicht.
export function PasswortVergessenFormular() {
  const t = useTranslations("anmelden");
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [email, setEmail] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  return (
    <form
      className="mt-8 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFehler(null);
        starte(async () => {
          const res = await passwortVergessen(email.trim());
          if (res.ok) {
            // Direkt zur Eingabe des Codes: die Mail enthält ihn, und ohne
            // diesen Schritt wüsste der Partner nicht, wohin damit. Die
            // Adresse wandert als Vorbelegung mit — geprüft wird sie
            // serverseitig gegen den Code.
            router.push(`/passwort-neu?email=${encodeURIComponent(email.trim())}`);
            return;
          }
          setFehler(t("stoerung"));
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("email")}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-full border border-border bg-transparent px-4 py-2.5 outline-none focus-visible:border-foreground"
        />
      </label>
      {fehler && <p className="text-sm text-accent">{fehler}</p>}
      <button
        type="submit"
        disabled={laeuft || !email.trim()}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
      >
        {t("passwortVergessen")}
      </button>
    </form>
  );
}
