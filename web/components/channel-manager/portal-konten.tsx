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
  kanalNachtragen,
  listChannelAccounts,
  renameChannelAccount,
  startAirbnbUebernahme,
} from "@/lib/channex";

export function PortalKontenPanel({
  offen,
  onOffenChange,
  portalCode,
  portalLabel,
  connectionType,
  onGeaendert,
}: {
  offen: boolean;
  onOffenChange: (o: boolean) => void;
  portalCode: string;
  portalLabel: string;
  // Wie ein weiteres Konto dieses Portals verbunden wird. "oauth" = der
  // Vermieter autorisiert beim Portal (Airbnb), "credential" = Hotel-ID
  // eintragen (Booking.com & Co.).
  //
  // Ohne diese Unterscheidung startete der Knopf für JEDES Portal den
  // Airbnb-Weg: auf der Booking.com-Seite hieß das Panel „Booking.com-Konten",
  // schickte den Betrieb aber zu einer Airbnb-Autorisierung und legte im
  // Hintergrund ein Airbnb-Gerüstobjekt an.
  connectionType: "oauth" | "credential";
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

  // Den Kanal abholen, den Channex nach der Autorisierung selbst angelegt hat.
  //
  // Bei einer neuen Verbindung entsteht der Kanal auf Channex' Seite, sobald
  // der Vermieter bei Airbnb bestätigt — wir erfahren davon nichts (Channex
  // schickt keine Kanal-Webhooks). Ohne dieses Nachziehen stünde das Konto
  // dauerhaft auf „Verbindung läuft", obwohl beim Portal längst alles verbunden
  // ist: live am 07.08.2026 trug Kanal 21ec5429 Torstens Host-ID 226976381 und
  // gültige Tokens, während die Kontoliste „Ohne Namen / Verbindung läuft"
  // zeigte.
  //
  // Ausgelöst wird es von der Kontoliste selbst: jedes Konto ohne Kanal ist ein
  // wartender Verbindungsversuch. Das deckt beide Wege ab — den Rücksprung von
  // Airbnb und ein später wieder geöffnetes Panel.
  useEffect(() => {
    if (!offen) return;
    const wartend = konten.filter((k) => !k.channel_id);
    if (wartend.length === 0) return;
    let aktiv = true;
    void Promise.all(
      wartend.map((k) => kanalNachtragen(k.id, portalCode)),
    ).then((ergebnisse) => {
      // Nur neu laden, wenn wirklich etwas nachgetragen wurde — sonst löst
      // jedes Rendern eine weitere Runde aus (die Liste ändert sich ja).
      const etwasNeu = ergebnisse.some((r) => r.ok && r.data.neu);
      if (aktiv && etwasNeu) laden();
    });
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen, portalCode, konten.map((k) => k.channel_id ?? "").join()]);

  // KEIN Realtime-Abo mehr auf `ota_account` und `channex_channel_connection`
  // (vorher 0305): beide Tabellen sind seit Migration 0337 für
  // `authenticated` gesperrt (Wurzel 6 — Vertriebsdaten des Portal-Anschlusses
  // samt Kontokennungen). Ohne SELECT-Grant passt keine Policy mehr; die Abos
  // wären stumme Attrappen.
  //
  // Eine erlaubte Ersatzquelle gibt es nicht: weder das Autorisieren eines
  // Portal-Kontos noch das Trennen einer Verbindung berührt eine offene
  // Tabelle. `properties` wäre ein stiller Ersatz und damit falsch.
  //
  // WAS DADURCH ENTFÄLLT: Kehrt der Kunde von der Portal-Autorisierung
  // zurück, während dieses Panel offen steht, aktualisiert es sich nicht mehr
  // von selbst. Das Panel lädt bei jedem Öffnen frisch (Effekt oben) und nach
  // jeder eigenen Aktion (Umbenennen, Trennen, Nachtragen) — einmal schließen
  // und wieder öffnen zeigt den aktuellen Stand.

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
    // Nur OAuth-Portale haben diesen Weg. Bei allen anderen läuft das
    // Verbinden über den Assistenten (Hotel-ID + Zimmerzuordnung) — der Knopf
    // wird dort gar nicht erst angeboten; diese Prüfung ist der Riegel dahinter.
    if (connectionType !== "oauth") return;
    const fenster = window.open("", "_blank");
    // Rücksprungziel ist diese Seite. Es wird HIER gelesen, nicht in der
    // Server-Action: dort gibt es kein `window`, und die öffentliche Adresse
    // der Anwendung kennt das Backend nicht.
    const ziel = window.location.href;
    start(async () => {
      // Das begonnene Konto MITGEBEN, falls dieser Klick eine Wiederholung ist
      // (Fenster geschlossen, Autorisierung abgebrochen, erneut versucht).
      //
      // Ohne diesen Bezug wählte der Server erneut selbst — und griff zum
      // bereits autorisierten Kanal des ERSTEN Zugangs. Da Channex je
      // Verbindung nur den zuletzt erzeugten `state` kennt, machte jeder solche
      // Klick den vorherigen, richtigen Link ungültig. Live am 07.08.2026: ein
      // Link für Konto B, danach drei für Konto A — Konto B blieb dauerhaft
      // ohne Tokens, obwohl der Betrieb dreißigmal bestätigte.
      const begonnen =
        konten.find((k) => !k.channel_id)?.id ?? null;
      const res = await startAirbnbUebernahme(true, ziel, begonnen);
      if (!res.ok) {
        fenster?.close();
        toast.error(res.error);
        return;
      }
      if (fenster) fenster.location.href = res.data.oauth_url;
      else window.location.href = res.data.oauth_url;
      // Die Liste zeigt das neue Konto sofort — sonst wirkt der Klick folgenlos,
      // während im anderen Fenster längst Airbnb steht.
      await laden();
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
                <li key={k.id} className="flex flex-wrap items-center gap-3">
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
              legt sie dafür selbst an. Das gehört nicht in die Oberfläche.

              Nur für OAuth-Portale. Bei Booking.com & Co. gibt es kein „Konto
              autorisieren": dort ist ein Zugang eine Hotel-ID, die im
              Verbinde-Assistenten samt Zimmerzuordnung eingetragen wird. Ein
              Knopf, der hier den Airbnb-Weg startet, führte in die Irre — er
              tat sogar etwas: er legte ein Airbnb-Gerüstobjekt an. */}
          {connectionType === "oauth" ? (
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
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("accountConnectCredentialHint", { portal: portalLabel })}
            </p>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Kopfknopf, der das Panel öffnet — zeigt die Zahl der verbundenen Konten. */
export function PortalKontenButton({
  portalCode,
  portalLabel,
  connectionType,
  onGeaendert,
}: {
  portalCode: string;
  portalLabel: string;
  connectionType: "oauth" | "credential";
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
        connectionType={connectionType}
        onGeaendert={onGeaendert}
      />
    </>
  );
}
