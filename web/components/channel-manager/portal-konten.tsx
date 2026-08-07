"use client";

// „Kontoverbindung verwalten" — Slide-over eines Portals (0304).
//
// Ein Betrieb kann je Portal MEHRERE Zugänge führen: eine Agentur betreut
// hunderte Vermieter mit je eigenem Airbnb- oder Booking-Konto. Vorher gab es
// dafür keine Fläche — Host-ID und Kanal standen nur verstreut in den
// Objektzeilen, und ein zweites Konto ließ sich gar nicht erst verbinden.
//
// Form nach dem Vorbild (Lodgify, live abgelesen): Panel von rechts, Zähler in
// der Überschrift, je Konto eine Zeile mit Bild, Name und „Trennen", darunter
// der Hinweis zur Portal-Seite und „+ Konto verbinden".
//
// Getrennt wird je KONTO, nicht je Portal — ein Klick darf nicht alle
// Vermieter mitnehmen.
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  type OtaAccount,
  disconnectChannel,
  listChannelAccounts,
  renameChannelAccount,
  startAirbnbUebernahme,
} from "@/lib/channex";
import { useRealtime } from "@/lib/use-realtime";

export function PortalKontenPanel({
  offen,
  onOffenChange,
  portalCode,
  portalLabel,
  onGeaendert,
}: {
  offen: boolean;
  onOffenChange: (o: boolean) => void;
  portalCode: string;
  portalLabel: string;
  onGeaendert?: () => void;
}) {
  const t = useTranslations("channels");
  const [konten, setKonten] = useState<OtaAccount[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState("");
  const [pending, start] = useTransition();

  async function laden() {
    const res = await listChannelAccounts(portalCode);
    if (res.ok) setKonten(res.data.items);
    setGeladen(true);
  }

  useEffect(() => {
    if (offen) laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen, portalCode]);

  // Realtime (0305): Beim Verbinden läuft der Kunde ZU AIRBNB und kommt
  // zurück — der Zustand ändert sich also, WÄHREND dieses Panel offen steht.
  // Ohne Abo bliebe hier der alte Stand stehen, und eine gelungene
  // Autorisierung sähe aus wie eine gescheiterte.
  useRealtime({
    table: "ota_account",
    enabled: offen,
    onChange: laden,
  });
  // Auch die Verbindungen: sie tragen `is_active` und damit die Objektzahl je
  // Konto. Ein Trennen an anderer Stelle muss hier sofort ankommen.
  useRealtime({
    table: "channex_channel_connection",
    enabled: offen,
    onChange: laden,
  });

  function speichern(konto: OtaAccount) {
    const name = entwurf.trim();
    setBearbeitet(null);
    start(async () => {
      const res = await renameChannelAccount(konto.id, name || null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await laden();
    });
  }

  /**
   * Ein weiteres Konto verbinden: OAuth-Link holen und öffnen.
   *
   * Das neue Fenster wird VOR dem `await` geöffnet — ein `window.open` nach
   * einer asynchronen Antwort gilt dem Browser nicht mehr als Nutzerklick und
   * landet im Popup-Blocker.
   */
  function verbinden() {
    const fenster = window.open("", "_blank");
    start(async () => {
      const res = await startAirbnbUebernahme(true);
      if (!res.ok) {
        fenster?.close();
        toast.error(res.error);
        return;
      }
      if (fenster) fenster.location.href = res.data.oauth_url;
      else window.location.href = res.data.oauth_url;
    });
  }

  function trennen(konto: OtaAccount) {
    if (!konto.channel_id) return;
    // Der Name in der Rückfrage, damit bei hundert Konten klar ist, WELCHES
    // gleich getrennt wird.
    const bezeichnung = konto.display_name || konto.hotel_id || portalLabel;
    if (!window.confirm(t("accountDisconnectConfirm", { name: bezeichnung }))) {
      return;
    }
    start(async () => {
      const res = await disconnectChannel(konto.channel_id as string);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("accountDisconnectDone", { name: bezeichnung }));
      await laden();
      onGeaendert?.();
    });
  }

  return (
    <Sheet open={offen} onOpenChange={onOffenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="gap-1 p-6 pb-4">
          <SheetTitle className="font-display text-xl font-extrabold">
            {t("accountsPanelTitle", { portal: portalLabel })}
          </SheetTitle>
          <SheetDescription>{t("accountsPanelIntro")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6">
          <h3 className="font-semibold">
            {t("accountsTitle")} {geladen ? konten.length : ""}
          </h3>

          {geladen && konten.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("accountsEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {konten.map((k) => (
                <li key={k.id} className="flex items-center gap-3">
                  {/* Kein Portal liefert ein Kontobild über Channex — statt
                      eines geratenen Avatars ein neutrales Zeichen (Wurzel 4). */}
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon
                      icon="ph:user-circle"
                      className="size-6 text-muted-foreground"
                    />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    {bearbeitet === k.id ? (
                      <Input
                        autoFocus
                        value={entwurf}
                        onChange={(e) => setEntwurf(e.target.value)}
                        onBlur={() => speichern(k)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") speichern(k);
                          if (e.key === "Escape") setBearbeitet(null);
                        }}
                        placeholder={t("accountNamePlaceholder")}
                        className="h-8"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setBearbeitet(k.id);
                          setEntwurf(k.display_name ?? "");
                        }}
                        className="flex items-center gap-1.5 self-start text-left font-semibold hover:text-accent"
                      >
                        {/* Ohne Namen die Kennung — kein erfundener Platzhalter. */}
                        {k.display_name || k.hotel_id || t("accountUnnamed")}
                        <Icon
                          icon="ph:pencil-simple"
                          className="size-3.5 opacity-60"
                        />
                      </button>
                    )}
                    {/* Die Kennung steht unter dem Namen — bei gleichnamigen
                        Konten ist sie das Unterscheidungsmerkmal. */}
                    {k.hotel_id && (
                      <span className="truncate text-sm text-muted-foreground">
                        {k.hotel_id}
                      </span>
                    )}
                    {/* Nur wenn etwas zu TUN ist: abgelaufene Tokens oder eine
                        Autorisierung, die noch aussteht. Ein „verbunden" an
                        jeder Zeile wäre Rauschen. */}
                    {(k.token_invalid || !k.hotel_id) && (
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        {k.token_invalid
                          ? t("accountReauth")
                          : t("accountPending")}
                      </span>
                    )}
                  </div>
                  {k.channel_id && (
                    <button
                      type="button"
                      onClick={() => trennen(k)}
                      disabled={pending}
                      className="shrink-0 rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                    >
                      {t("accountDisconnect")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Der Hinweis stammt aus der Sache selbst: Airbnb erlaubt je Konto
              nur EINE verbundene Software, und ein im Browser angemeldetes
              Konto wird beim Verbinden automatisch genommen. Ohne diesen Satz
              verbindet man zweimal dasselbe Konto und wundert sich. */}
          <p className="text-sm text-muted-foreground">
            {t("accountsCheckPortalHint")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("accountsLogoutHint")}
          </p>

          {/* Ein KONTO verbinden, kein Objekt. Deshalb NICHT der
              Verbinde-Assistent: der fragt „Welches Objekt soll mit dem Portal
              verbunden werden?" — eine Frage, die hier nichts zu suchen hat.
              Airbnb autorisiert das Konto, die Objekte kommen danach von selbst
              aus den Listings.

              Dass Channex für den Autorisierungs-Link trotzdem eine Property
              braucht (live: sonst 422), ist ein technischer Zwang — der Server
              legt sie dafür selbst an. Das gehört nicht in die Oberfläche. */}
          <Button
            type="button"
            variant="outline"
            onClick={verbinden}
            disabled={pending}
            className="self-start"
          >
            <Icon
              icon={pending ? "ph:spinner" : "ph:plus"}
              className={"size-4 " + (pending ? "animate-spin" : "")}
            />
            {t("accountConnect")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Kopfknopf, der das Panel öffnet — zeigt die Zahl der verbundenen Konten. */
export function PortalKontenButton({
  portalCode,
  portalLabel,
  onGeaendert,
}: {
  portalCode: string;
  portalLabel: string;
  onGeaendert?: () => void;
}) {
  const t = useTranslations("channels");
  const [offen, setOffen] = useState(false);
  const [anzahl, setAnzahl] = useState<number | null>(null);

  useEffect(() => {
    let aktiv = true;
    listChannelAccounts(portalCode).then((res) => {
      if (aktiv && res.ok) setAnzahl(res.data.total);
    });
    return () => {
      aktiv = false;
    };
  }, [portalCode, offen]);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOffen(true)}>
        <Icon icon="ph:user-circle-gear" className="size-4" />
        {t("manageAccounts")}
        {anzahl !== null && anzahl > 0 && (
          <span className="rounded-full bg-muted px-1.5 text-xs">{anzahl}</span>
        )}
      </Button>
      <PortalKontenPanel
        offen={offen}
        onOffenChange={setOffen}
        portalCode={portalCode}
        portalLabel={portalLabel}
        onGeaendert={onGeaendert}
      />
    </>
  );
}
