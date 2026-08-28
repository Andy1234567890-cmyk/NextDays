"use client";

// Teilen-Knopf (0471).
//
// EIGENE Datei und nicht Teil von `social-blocks.tsx`: „diese Seite teilen"
// braucht `window.location`, das gibt es serverseitig nicht — und
// `"use client"` gilt für eine ganze Datei. Läge dieser Abschnitt bei den
// anderen (allesamt Server-Komponenten, `RssFeedBlock` sogar `async`), würde
// die Direktive die ganze Datei zur Client-Komponente machen, und eine async
// Client-Komponente lässt Next.js nicht zu.
import { useState } from "react";

import { Icon } from "@iconify/react";

import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

function Ueberschrift({ text }: { text: string }) {
  if (!text) return null;
  return (
    <h2 className="pb-6 font-display text-3xl font-extrabold tracking-tight">
      {text}
    </h2>
  );
}

type TeilNetzwerk = {
  key: string;
  icon: string;
  name: string;
  href: (url: string) => string;
};

const TEIL_NETZWERKE: TeilNetzwerk[] = [
  {
    key: "facebook",
    icon: "simple-icons:facebook",
    name: "Facebook",
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "x",
    icon: "simple-icons:x",
    name: "X",
    href: (url) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
  },
  {
    key: "linkedin",
    icon: "simple-icons:linkedin",
    name: "LinkedIn",
    href: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: "whatsapp",
    icon: "simple-icons:whatsapp",
    name: "WhatsApp",
    href: (url) => `https://wa.me/?text=${encodeURIComponent(url)}`,
  },
];

export function ShareButtonBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const [kopiert, setKopiert] = useState(false);

  const label = pickText(content.headline ?? content.label, modus.locale);
  const t = texte(modus.locale);
  const aktiv = (schluessel: string) =>
    content[schluessel] === undefined ? true : content[schluessel] === true;

  const netzwerke = TEIL_NETZWERKE.filter((n) => aktiv(n.key));
  const mitEmail = aktiv("email");
  const mitKopieren = aktiv("copy_link");

  if (netzwerke.length === 0 && !mitEmail && !mitKopieren) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={label || undefined}
        grund={t.leerTeilen}
      />
    );
  }

  const symbolNurStil = content.style !== "icon_label";

  function aktuelleAdresse(): string {
    return typeof window === "undefined" ? "" : window.location.href;
  }

  function oeffnen(fabrik: (url: string) => string) {
    const url = aktuelleAdresse();
    if (!url) return;
    window.open(
      fabrik(url),
      "_blank",
      "noopener,noreferrer,width=600,height=520",
    );
  }

  async function kopieren() {
    const url = aktuelleAdresse();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } catch {
      // Kein Zugriff auf die Zwischenablage — dann bleibt der Knopf ohne
      // Rückmeldung. Kein Absturz, keine Falschaussage.
    }
  }

  function eMailAdresse(): string {
    const url = aktuelleAdresse();
    return url ? `mailto:?body=${encodeURIComponent(url)}` : "mailto:";
  }

  const knopfKlasse =
    "flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/60";

  return (
    <section className="mx-auto max-w-3xl px-6 py-10 text-center">
      <Ueberschrift text={label} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        {netzwerke.map((n) => (
          <button
            key={n.key}
            type="button"
            onClick={() => oeffnen(n.href)}
            aria-label={t.teilenAuf.replace("{netzwerk}", n.name)}
            className={knopfKlasse}
          >
            <Icon icon={n.icon} className="size-4" aria-hidden />
            {symbolNurStil ? null : <span>{n.name}</span>}
          </button>
        ))}
        {mitEmail ? (
          <a
            href={eMailAdresse()}
            aria-label={t.teilenAuf.replace("{netzwerk}", t.teilenEmail)}
            className={knopfKlasse}
          >
            <Icon icon="ph:envelope-simple" className="size-4" aria-hidden />
            {symbolNurStil ? null : <span>{t.teilenEmail}</span>}
          </a>
        ) : null}
        {mitKopieren ? (
          <button
            type="button"
            onClick={kopieren}
            aria-label={t.teilenLinkKopieren}
            className={knopfKlasse}
          >
            <Icon
              icon={kopiert ? "ph:check" : "ph:link-simple"}
              className="size-4"
              aria-hidden
            />
            {symbolNurStil ? null : (
              <span>{kopiert ? t.teilenLinkKopiert : t.teilenLinkKopieren}</span>
            )}
          </button>
        ) : null}
      </div>
    </section>
  );
}
