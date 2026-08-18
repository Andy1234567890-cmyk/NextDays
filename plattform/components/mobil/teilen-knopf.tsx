// Teilen-Knopf über der mobilen Galerie. Nutzt die Web-Share-API des Geräts
// (dieselbe Freigabe-Auswahl wie in jeder App); wo es sie nicht gibt — jeder
// Desktop-Browser außer Safari — wird die URL in die Zwischenablage gelegt und
// das kurz bestätigt. Kein stiller Fehlschlag: ein Knopf, der nichts sichtbar
// tut, wird als kaputt gelesen.
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function TeilenKnopf({
  titel,
  className = "",
}: {
  titel: string;
  className?: string;
}) {
  const t = useTranslations("mobil");
  const [kopiert, setKopiert] = useState(false);

  async function teilen() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: titel, url });
        return;
      } catch {
        // Abbruch durch den Nutzer ist kein Fehler — auf die Zwischenablage
        // zurückfallen wäre hier falsch, er wollte gerade NICHT teilen.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      setKopiert(false);
    }
  }

  return (
    <button
      type="button"
      onClick={teilen}
      aria-label={t("teilen")}
      className={
        "flex size-11 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/40 " +
        className
      }
    >
      <Icon
        icon={kopiert ? "ph:check" : "ph:share-network"}
        className="size-5"
      />
    </button>
  );
}
