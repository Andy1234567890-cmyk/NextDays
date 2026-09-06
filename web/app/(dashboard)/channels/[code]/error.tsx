"use client";

// Fehlerfläche der Kanal-Detailseite.
//
// Warum es sie gibt: Die Seite trennt seit dem 06.09.2026 einen fehlgeschlagenen
// Katalog-Abruf von einem unbekannten Kanal (Wurzel 5) und WIRFT im ersten Fall,
// statt einen 404 zu behaupten. Ohne diese Datei sähe der Betrieb dann die nackte
// Next.js-Fehlerseite — ausgerechnet im Moment direkt nach der Airbnb-
// Autorisierung, wo er wissen muss, ob seine Verbindung steht.
//
// Die Aussage hier ist deshalb bewusst eng: die VERBINDUNG ist nicht das Problem,
// nur diese Ansicht. Nichts muss erneut autorisiert werden.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";

export default function ChannelDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("channels");
  return (
    <div className="flex w-full flex-col items-start gap-4 p-6">
      <div className="flex items-center gap-2">
        <Icon icon="ph:warning-circle" className="size-5 text-destructive" />
        <h1 className="text-lg font-semibold">{t("detailErrorTitle")}</h1>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        {t("detailErrorIntro")}
      </p>
      {/* Der echte Grund, nicht weggeblendet: ohne ihn ist ein abgelaufener
          Channex-Schlüssel von einem Netzfehler nicht zu unterscheiden. */}
      <p className="max-w-prose rounded-(--radius) border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
        {error.message}
        {error.digest ? ` (${error.digest})` : ""}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={reset}>
        <Icon icon="ph:arrow-clockwise" className="size-4" />
        {t("detailErrorRetry")}
      </Button>
    </div>
  );
}
