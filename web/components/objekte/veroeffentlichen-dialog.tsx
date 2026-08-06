"use client";

// Veröffentlichen-Dialog: Kanäle wählen → Änderungen prüfen → freigeben.
//
// Warum drei Schritte statt eines Knopfes: „Veröffentlichen" schickt Inhalte an
// fremde Portale, wo sie für Gäste sichtbar werden. Vorher soll der Betrieb
// sehen, WOHIN es geht und WAS sich dort ändert — bisher war beides unsichtbar,
// und der Statuswechsel auf „Aktiv" erreichte die Portale überhaupt nicht.
//
// Deaktivieren geht bewusst NICHT durch denselben Ablauf: dort gibt es nichts
// zu prüfen, nur zu bestätigen. Ein Objekt vom Markt zu nehmen ist die
// folgenschwerere Richtung — deshalb eine ausdrückliche Rückfrage.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { CHANNEL_LOGO } from "@/lib/channel-logos";
import {
  type Kanal,
  type KanalUebersicht,
  type Vorschau,
  kanaeleLaden,
  vorschauLaden,
} from "@/lib/veroeffentlichen";

type Schritt = "kanaele" | "pruefen";

export function VeroeffentlichenDialog({
  propertyId,
  open,
  onClose,
  onPublish,
  busy,
  fehler: sendeFehler,
}: {
  propertyId: string;
  open: boolean;
  onClose: () => void;
  /** Führt das eigentliche Veröffentlichen aus (bestehender publish-Aufruf). */
  onPublish: (kanaele: string[]) => Promise<void>;
  busy: boolean;
  /**
   * Fehler des Veröffentlichen-Aufrufs (z. B. „kein aktives Abo", 422). Muss
   * HIER stehen: der Dialog bleibt offen, eine Meldung auf der Seite dahinter
   * sieht niemand — für den Betrieb passiert dann scheinbar nichts.
   */
  fehler?: string | null;
}) {
  const t = useTranslations("objects.veroeffentlichen");
  const [schritt, setSchritt] = useState<Schritt>("kanaele");
  const [uebersicht, setUebersicht] = useState<KanalUebersicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [aktiverTab, setAktiverTab] = useState<string | null>(null);
  const [vorschauen, setVorschauen] = useState<Record<string, Vorschau>>({});
  const [laedt, setLaedt] = useState(false);

  // Beim Öffnen frisch laden: zwischen zwei Aufrufen kann ein Kanal verbunden
  // oder getrennt worden sein — ein gemerkter Stand wäre eine Falschaussage.
  useEffect(() => {
    if (!open) return;
    setSchritt("kanaele");
    setVorschauen({});
    setFehler(null);
    setLaedt(true);
    void kanaeleLaden(propertyId).then((res) => {
      setLaedt(false);
      if ("fehler" in res) {
        setFehler(res.fehler);
        return;
      }
      setUebersicht(res);
      // Vorauswahl: alles, was geht. Der Normalfall ist „überall verkaufen";
      // wer einzelne Kanäle nicht will, hakt sie ab — außer den Pflichtkanal
      // (myBestDays), der bleibt in jedem Fall drin.
      setGewaehlt(res.kanaele.filter((k) => k.waehlbar).map((k) => k.code));
    });
  }, [open, propertyId]);

  async function weiterZuPruefen() {
    setSchritt("pruefen");
    setAktiverTab(gewaehlt[0] ?? null);
    // Vorschauen parallel holen — nacheinander würde bei drei Portalen
    // spürbar dauern, und keine hängt von einer anderen ab.
    const offen = gewaehlt.filter((c) => !vorschauen[c]);
    if (!offen.length) return;
    setLaedt(true);
    const ergebnisse = await Promise.all(
      offen.map(async (code) => [code, await vorschauLaden(propertyId, code)] as const),
    );
    setLaedt(false);
    setVorschauen((alt) => {
      const neu = { ...alt };
      for (const [code, res] of ergebnisse) {
        if (!("fehler" in res)) neu[code] = res;
      }
      return neu;
    });
  }

  const kanaele = uebersicht?.kanaele ?? [];
  const gesperrt = kanaele.filter((k) => !k.waehlbar);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t("titel")}</DialogTitle>
        <DialogDescription>
          {schritt === "kanaele" ? t("untertitelKanaele") : t("untertitelPruefen")}
        </DialogDescription>

        {(fehler || sendeFehler) && (
          <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
            <Icon
              icon="ph:warning-circle-fill"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>{sendeFehler || fehler}</span>
          </p>
        )}

        {schritt === "kanaele" ? (
          <div className="flex flex-col gap-2">
            {kanaele.filter((k) => k.waehlbar).map((k) => (
              <KanalZeile
                key={k.code}
                kanal={k}
                gewaehlt={gewaehlt.includes(k.code)}
                // Pflichtkanal: kein onToggle → angehakt und nicht klickbar.
                onToggle={
                  k.pflicht
                    ? undefined
                    : () =>
                        setGewaehlt((alt) =>
                          alt.includes(k.code)
                            ? alt.filter((c) => c !== k.code)
                            : [...alt, k.code],
                        )
                }
              />
            ))}
            {/* Nicht verbundene Portale werden GEZEIGT, nicht verschwiegen —
                sonst sieht es aus, als gäbe es sie nicht. */}
            {gesperrt.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("nichtVerfuegbar")}
                </p>
                {gesperrt.map((k) => (
                  <KanalZeile key={k.code} kanal={k} gewaehlt={false} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <PruefAnsicht
            codes={gewaehlt}
            kanaele={kanaele}
            aktiv={aktiverTab}
            onTab={setAktiverTab}
            vorschauen={vorschauen}
            laedt={laedt}
          />
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("abbrechen")}
          </Button>
          {schritt === "kanaele" ? (
            <Button
              onClick={() => void weiterZuPruefen()}
              disabled={!gewaehlt.length || laedt}
            >
              {t("weiter")}
            </Button>
          ) : (
            <Button
              onClick={() => void onPublish(gewaehlt)}
              disabled={busy || laedt}
            >
              {busy ? t("veroeffentlicht") : t("jetztVeroeffentlichen")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Eine Kanal-Zeile mit echtem Portal-Logo (kein generisches Ersatz-Icon). */
function KanalZeile({
  kanal,
  gewaehlt,
  onToggle,
}: {
  kanal: Kanal;
  gewaehlt: boolean;
  onToggle?: () => void;
}) {
  const t = useTranslations("objects.veroeffentlichen");
  const logo = CHANNEL_LOGO[kanal.code];
  // Zwei verschiedene Gründe, warum nicht geklickt werden kann — sie dürfen
  // NICHT gleich aussehen: der Pflichtkanal ist an (voll sichtbar), ein nicht
  // verbundenes Portal ist aus (gedimmt).
  const pflicht = kanal.pflicht && kanal.waehlbar;
  const gesperrt = !onToggle && !pflicht;
  return (
    <label
      className={
        "flex items-center gap-3 rounded-2xl border p-3 " +
        (gesperrt
          ? "opacity-60"
          : pflicht
            ? "bg-secondary/50"
            : "cursor-pointer hover:bg-secondary")
      }
    >
      <Checkbox
        checked={pflicht ? true : gewaehlt}
        onCheckedChange={onToggle}
        disabled={!onToggle}
      />
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- Portal-Logo aus /public, keine Optimierung nötig
        <img src={logo} alt="" className="size-6 shrink-0 object-contain" />
      ) : (
        <span className="size-6 shrink-0" />
      )}
      <span className="flex flex-col">
        <span className="text-sm font-medium">{kanal.name}</span>
        {pflicht && (
          <span className="text-xs text-muted-foreground">
            {t("immerDabei")}
          </span>
        )}
        {kanal.grund && (
          <span className="text-xs text-muted-foreground">
            {t(`gruende.${kanal.grund}`)}
          </span>
        )}
      </span>
    </label>
  );
}

/** Schritt 2: je Kanal ein Tab mit den Änderungen gegenüber dem Portal. */
function PruefAnsicht({
  codes,
  kanaele,
  aktiv,
  onTab,
  vorschauen,
  laedt,
}: {
  codes: string[];
  kanaele: Kanal[];
  aktiv: string | null;
  onTab: (c: string) => void;
  vorschauen: Record<string, Vorschau>;
  laedt: boolean;
}) {
  const t = useTranslations("objects.veroeffentlichen");
  const v = aktiv ? vorschauen[aktiv] : undefined;
  const name = (c: string) => kanaele.find((k) => k.code === c)?.name ?? c;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {codes.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onTab(c)}
            className={
              "rounded-full border px-3 py-1 text-xs font-medium " +
              (c === aktiv
                ? "border-accent bg-accent/10 text-accent"
                : "text-muted-foreground hover:bg-secondary")
            }
          >
            {name(c)}
          </button>
        ))}
      </div>

      {laedt && (
        <p className="text-sm text-muted-foreground">{t("laedtVorschau")}</p>
      )}

      {!laedt && v && !v.vergleichbar && (
        <p className="rounded-2xl bg-secondary p-3 text-sm text-muted-foreground">
          {v.hinweis || t(`gruende.${v.grund ?? "keinIstAbgleich"}`)}
        </p>
      )}

      {!laedt && v?.vergleichbar && v.felder.length === 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-secondary p-3 text-sm">
          <Icon icon="ph:check-circle-fill" className="size-4 text-success" />
          {t("keineAenderungen")}
        </p>
      )}

      {!laedt && v?.vergleichbar && v.felder.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">{t("spalteFeld")}</th>
                <th className="py-1 pr-3 font-medium">{t("spaltePortal")}</th>
                <th className="py-1 font-medium">{t("spalteNeu")}</th>
              </tr>
            </thead>
            <tbody>
              {v.felder.map((f) => (
                <tr key={f.feld} className="border-t">
                  <td className="py-1.5 pr-3">{f.feld}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {String(f.airbnb ?? "—").slice(0, 60) || "—"}
                  </td>
                  <td className="py-1.5">
                    {String(f.lokal ?? "—").slice(0, 60) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Deaktivieren: nur eine Rückfrage, kein Assistent.
 *
 * Die folgenschwerere Richtung — das Objekt verschwindet aus dem Verkauf.
 * Deshalb ausdrücklich bestätigen statt still umschalten.
 */
export function DeaktivierenDialog({
  open,
  onClose,
  onBestaetigen,
  busy,
  titel,
}: {
  open: boolean;
  onClose: () => void;
  onBestaetigen: () => Promise<void>;
  busy: boolean;
  titel: string | null;
}) {
  const t = useTranslations("objects.veroeffentlichen");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t("deaktivierenTitel")}</DialogTitle>
        <DialogDescription>
          {t("deaktivierenText", { titel: titel ?? "" })}
        </DialogDescription>
        <div className="mt-2 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("abbrechen")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onBestaetigen()}
            disabled={busy}
          >
            {busy ? t("deaktiviert") : t("jetztDeaktivieren")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
