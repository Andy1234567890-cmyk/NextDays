"use client";

// Hinweisleiste „Empfohlen von Partner …" (Affiliate-Programm, 0517).
//
// Erscheint nur, wenn die Adresse `?ref=CODE` trägt — also nach einem Klick
// auf einen Partner-Link (`/p/CODE`). Sie macht den Code SICHTBAR und führt
// direkt in die Registrierung, wo er vorbelegt im Formular steht. Das ist der
// cookielose Weg: nichts wird im Browser gespeichert, der Betrieb bestätigt
// den Code selbst durch das Absenden. Wer die Leiste schließt, verliert nur die
// Leiste — der Code bleibt in der Adresse, bis der Besucher weiternavigiert.
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { APP_ERREICHBAR, SIGNUP_URL } from "@/lib/app-url";

export function PartnerHinweis() {
  const params = useSearchParams();
  const t = useTranslations("partnerHinweis");
  const [geschlossen, setGeschlossen] = useState(false);

  const ref = params.get("ref")?.toUpperCase().slice(0, 40) ?? "";
  const klick = params.get("klick")?.slice(0, 64) ?? "";
  if (!ref || geschlossen || !/^[A-Z0-9][A-Z0-9-]{2,30}$/.test(ref)) return null;

  const ziel = new URL(SIGNUP_URL, "https://placeholder.invalid");
  ziel.searchParams.set("ref", ref);
  if (klick) ziel.searchParams.set("klick", klick);
  const href = APP_ERREICHBAR ? `${SIGNUP_URL}${ziel.search}` : SIGNUP_URL;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-accent px-4 py-2.5 text-sm text-accent-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <Icon icon="ph:handshake" className="size-4 shrink-0" />
        {t("text", { code: ref })}
      </span>
      <a
        href={href}
        data-cta="signup"
        className="rounded-full bg-accent-foreground px-3 py-1 font-semibold text-accent underline-offset-4 hover:underline"
      >
        {t("cta")}
      </a>
      <button
        type="button"
        onClick={() => setGeschlossen(true)}
        aria-label={t("schliessen")}
        className="ml-1 rounded-full p-1 hover:bg-accent-foreground/10"
      >
        <Icon icon="ph:x" className="size-4" />
      </button>
    </div>
  );
}
