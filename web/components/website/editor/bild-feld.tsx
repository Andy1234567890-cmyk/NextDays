"use client";

// Ein Bildfeld: Vorschau + „Aus Mediathek wählen".
//
// Der Weg über die Mediathek ist der HAUPTWEG, nicht die Ausnahme: ein
// Vermieter hat seine Fotos auf dem Rechner, nicht unter einer Adresse im Netz.
// Deshalb steht der Knopf oben und das URL-Feld darunter — und zwar eingeklappt,
// weil eine fremde Adresse der seltene Fall ist (ein Bild, das schon auf einer
// anderen Seite des Betriebs liegt).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Mediathek } from "../mediathek";

export function BildFeld({
  label,
  wert,
  onWert,
}: {
  label: string;
  wert: string | null;
  onWert: (v: string | null) => void;
}) {
  const t = useTranslations("website");
  const [mediathekOffen, setMediathekOffen] = useState(false);
  const [adresseOffen, setAdresseOffen] = useState(false);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-xs font-medium">{label}</span>

      {wert ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={wert}
            alt=""
            className="h-24 w-full rounded-(--radius) border border-border bg-secondary/40 object-cover"
          />
          <button
            type="button"
            aria-label={t("bildFeld.entfernen")}
            title={t("bildFeld.entfernen")}
            onClick={() => onWert(null)}
            className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm transition hover:text-destructive"
          >
            <Icon icon="ph:x" className="size-3.5" />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setMediathekOffen(true)}
        className="flex items-center justify-center gap-1.5 rounded-(--radius) border border-border px-3 py-2 text-sm font-medium transition hover:bg-secondary"
      >
        <Icon icon="ph:images" className="size-4" />
        {wert ? t("bildFeld.aendern") : t("bildFeld.waehlen")}
      </button>

      {/* Fremde Adresse: der seltene Fall, deshalb eingeklappt. */}
      {adresseOffen ? (
        <input
          value={wert ?? ""}
          placeholder="https://…"
          spellCheck={false}
          onChange={(e) => onWert(e.target.value || null)}
          className="w-full rounded-(--radius) border border-border bg-transparent px-2 py-1.5 font-mono text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdresseOffen(true)}
          className="self-start text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
        >
          {t("bildFeld.adresseStattdessen")}
        </button>
      )}

      {mediathekOffen ? (
        <Mediathek
          onWaehle={(url) => {
            onWert(url);
            setMediathekOffen(false);
          }}
          onSchliesse={() => setMediathekOffen(false)}
        />
      ) : null}
    </div>
  );
}
