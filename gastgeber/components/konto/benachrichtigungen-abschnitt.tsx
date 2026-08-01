"use client";

// Abschnitt „Benachrichtigungen" der Kontoeinstellungen (Airbnb-Vorbild).
// Zwei Tabs: „Angebote und Updates" (Marketing, frei abwählbar) und „Konto"
// (Betrieb — dort ist die E-Mail bei Richtlinien/Aktivität gesperrt-an).
// Je Kategorie eine Zeile mit den aktiven Kanälen und „Bearbeiten"; der Klick
// öffnet ein Modal mit den Kanal-Schaltern.
//
// Die Kategorien kommen VOM SERVER (GET /notification-settings) — diese Datei
// pflegt keine eigene Liste, damit Backend und UI nicht auseinanderlaufen
// (Wurzel 4). Auch ob ein Schalter gesperrt ist, entscheidet der Server.
//
// Kein Realtime: notification_settings ist streng per-User und liegt bewusst
// NICHT in der Realtime-Publication (Sicherheitsgrenze). Nach jedem Schalten
// übernimmt die UI die vom Server zurückgegebene Übersicht.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Dialog, DialogContent } from "@nextdays/ui/dialog";
import { Switch } from "@nextdays/ui/switch";

import type {
  KategorieInfo,
  NotificationOverview,
} from "@/lib/benachrichtigungen";
import { spaltenName } from "@/lib/benachrichtigungen";
import { setzeBenachrichtigung } from "@/lib/konto-actions";

type TabKey = "angebote" | "konto";

// Reihenfolge der Gruppen je Tab (Airbnb-Reihenfolge aus den Screenshots).
const GRUPPEN_REIHENFOLGE: Record<TabKey, string[]> = {
  angebote: ["insights", "hosting", "travel", "platform"],
  konto: ["aktivitaet", "erinnerungen", "nachrichten"],
};

/** i18n-Key aus einem snake_case-Schlüssel: insights_tips → bnTitel_insightsTips. */
function key(prefix: string, schluessel: string): string {
  const camel = schluessel.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return `${prefix}_${camel}`;
}

export function BenachrichtigungenAbschnitt({
  uebersicht,
}: {
  uebersicht: NotificationOverview | null;
}) {
  const t = useTranslations("konto");
  const [daten, setDaten] = useState(uebersicht);
  const [tab, setTab] = useState<TabKey>("angebote");
  const [offen, setOffen] = useState<KategorieInfo | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);

  if (!daten) {
    return (
      <p className="text-sm text-muted-foreground">{t("bnNichtVerfuegbar")}</p>
    );
  }

  async function schalte(schluessel: string, kanal: string, wert: boolean) {
    const spalte = spaltenName(schluessel, kanal);
    setLaeuft(spalte);
    setFehler(null);
    const res = await setzeBenachrichtigung(spalte, wert);
    setLaeuft(null);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setDaten(res.uebersicht);
    // Das offene Modal mit den frischen Serverwerten nachziehen — sonst zeigt
    // es den geklickten statt den tatsächlich gespeicherten Zustand.
    setOffen((vorher) =>
      vorher
        ? res.uebersicht.kategorien.find((k) => k.schluessel === vorher.schluessel) ??
          null
        : null,
    );
  }

  const sichtbar = daten.kategorien.filter((k) => k.tab === tab);
  const gruppen = GRUPPEN_REIHENFOLGE[tab].filter((g) =>
    sichtbar.some((k) => k.gruppe === g),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-2xl font-extrabold">{t("bnTitel")}</h2>
      </div>

      {/* Tab-Leiste (Airbnb: unterstrichener aktiver Tab) */}
      <div className="flex gap-8 border-b border-border">
        {(["angebote", "konto"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 pb-3 text-[0.9375rem] transition-colors ${
              tab === k
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(k === "angebote" ? "bnTabAngebote" : "bnTabKonto")}
          </button>
        ))}
      </div>

      {fehler && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <Icon icon="solar:danger-triangle-line-duotone" className="size-4" />
          {fehler}
        </p>
      )}

      {gruppen.map((gruppe) => (
        <section key={gruppe} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-xl font-bold">
              {t(key("bnGruppe", gruppe))}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(key("bnGruppeText", gruppe))}
            </p>
          </div>

          {sichtbar
            .filter((k) => k.gruppe === gruppe)
            .map((kategorie) => (
              <div key={kategorie.schluessel} className="flex flex-col gap-1">
                <p className="text-[0.9375rem] text-foreground">
                  {t(key("bnTitel", kategorie.schluessel))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {aktiveKanaele(kategorie, t)}
                </p>
                <button
                  type="button"
                  onClick={() => setOffen(kategorie)}
                  className="self-start text-sm font-medium text-foreground underline underline-offset-4"
                >
                  {t("bnBearbeiten")}
                </button>
              </div>
            ))}
        </section>
      ))}

      {tab === "angebote" && (
        <div className="border-t border-border pt-6">
          <Schalter
            label={t("bnAbmeldenAlle")}
            aktiv={daten.marketing_unsubscribed_all}
            aenderbar
            laedt={laeuft === "marketing_unsubscribed_all"}
            onChange={async (wert) => {
              setLaeuft("marketing_unsubscribed_all");
              setFehler(null);
              const res = await setzeBenachrichtigung(
                "marketing_unsubscribed_all",
                wert,
              );
              setLaeuft(null);
              if (res.ok) setDaten(res.uebersicht);
              else setFehler(res.error);
            }}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("bnSmsHinweis")}</p>

      <Dialog open={offen !== null} onOpenChange={(o) => !o && setOffen(null)}>
        <DialogContent className="max-w-[26rem] rounded-3xl p-8">
          {offen && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl font-bold">
                  {t(key("bnTitel", offen.schluessel))}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(key("bnText", offen.schluessel))}
                </p>
              </div>
              {offen.kanaele.map((kanal) => (
                <Schalter
                  key={kanal.kanal}
                  label={t(`bnKanal_${kanal.kanal}`)}
                  aktiv={kanal.aktiv}
                  aenderbar={kanal.aenderbar}
                  laedt={laeuft === spaltenName(offen.schluessel, kanal.kanal)}
                  onChange={(wert) =>
                    schalte(offen.schluessel, kanal.kanal, wert)
                  }
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** „An: E-Mail und SMS" — nennt die aktiven Kanäle, oder „Aus". */
function aktiveKanaele(
  kategorie: KategorieInfo,
  t: (k: string) => string,
): string {
  const an = kategorie.kanaele
    .filter((k) => k.aktiv)
    .map((k) => t(`bnKanal_${k.kanal}`));
  if (an.length === 0) return t("bnKanaeleAus");
  const liste =
    an.length === 1
      ? an[0]
      : `${an.slice(0, -1).join(", ")} ${t("bnUnd")} ${an[an.length - 1]}`;
  return `${t("bnKanaeleAn")}: ${liste}`;
}

function Schalter({
  label,
  aktiv,
  aenderbar,
  laedt,
  onChange,
}: {
  label: string;
  aktiv: boolean;
  aenderbar: boolean;
  laedt: boolean;
  onChange: (wert: boolean) => void | Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`text-[0.9375rem] ${
          aenderbar ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <Switch
        checked={aktiv}
        disabled={!aenderbar || laedt}
        onCheckedChange={(wert) => void onChange(wert)}
      />
    </div>
  );
}
