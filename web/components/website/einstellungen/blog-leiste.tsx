"use client";

// Einstellungen → Blog (0457).
//
// Was hier steht, gilt für den GANZEN Blog und nicht für einen Beitrag: sein
// Name, die Navigation am Beitragsende und die Angaben des RSS-Feeds. Die
// Felder eines einzelnen Beitrags (Datum, Autor, Schlagwörter) stehen dort, wo
// der Beitrag steht — im Einstellungen-Dialog der Seite.
//
// Eigener Unterpunkt und kein Kasten in „Anzeige": das sind sechs Felder und
// eine Import-Maske, und wer den Blog einrichtet, sucht sie nicht unter einem
// Punkt, der von Suchfeld und Preisen handelt.
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@nextdays/ui/input";
import {
  type BlogEinstellungen,
  importBlogFeed,
  setBlogSettings,
} from "@/lib/site-pages";

import { SpeicherAnzeige } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { BereichsKopf } from "../bereichs-kopf";
import { Schalter } from "./schalter";

/** Ein Textfeld mit Erklärung. Dieselbe Form wie `Schalter` — die Erklärung ist
 *  auch hier keine Zierde: „RSS-Titel" allein sagt niemandem, wo der Text
 *  erscheint und was passiert, wenn er leer bleibt. */
function Feld({
  titel,
  beschreibung,
  wert,
  platzhalter,
  maxLength,
  onWert,
}: {
  titel: string;
  beschreibung: string;
  wert: string;
  platzhalter?: string;
  maxLength?: number;
  onWert: (wert: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 rounded-(--radius) border border-border p-4 text-sm">
      <span className="font-semibold">{titel}</span>
      <span className="text-sm text-muted-foreground">{beschreibung}</span>
      <Input
        value={wert}
        maxLength={maxLength}
        placeholder={platzhalter}
        onChange={(e) => onWert(e.target.value)}
      />
    </label>
  );
}

export function BlogLeiste({
  einstellungen,
  abschnitt = "alle",
  ohneKopf = false,
}: {
  einstellungen: BlogEinstellungen;
  /** Welcher Teil gezeigt wird.
   *
   *  Im Einstellungen-Reiter steht alles untereinander (`alle`); im Blog-Bereich
   *  sind „Einstellungen" und „Import" zwei Menüpunkte und damit zwei Sichten
   *  auf DIESELBE Leiste. Getrennte Bauteile wären zwei Schreibwege auf
   *  dieselbe Konfigurationszeile (Wurzel 2) — hier ist es eine Filterung der
   *  Darstellung, nicht der Daten. */
  abschnitt?: "alle" | "einstellungen" | "import";
  /** true = ohne den Seitenkopf. Im Blog-Bereich trägt das Großpanel schon
   *  eine Überschrift; eine zweite darunter wäre dieselbe Doppelung, die bei
   *  den Design-Unterseiten gerade entfernt wurde (0468). */
  ohneKopf?: boolean;
}) {
  const t = useTranslations("website");
  const [entwurf, setEntwurf] = useState<BlogEinstellungen>(einstellungen);
  const [bestaetigt, setBestaetigt] = useState<BlogEinstellungen>(einstellungen);

  const auto = useAutospeichern<BlogEinstellungen>({
    wert: entwurf,
    bestaetigt,
    speichern: async (diff) => {
      // Der Server verlangt das ganze Objekt (die Einstellung ist EINE Zeile).
      // Der Unterschied entscheidet nur, OB gespeichert wird.
      const res = await setBlogSettings({ ...entwurf, ...diff });
      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const, data: res.data };
    },
  });

  useEffect(() => {
    if (auto.uebernommen) setBestaetigt(auto.uebernommen);
  }, [auto.uebernommen]);
  useEffect(() => {
    if (auto.fehler) toast.error(auto.fehler);
  }, [auto.fehler]);

  // --- RSS-Import ----------------------------------------------------------
  const [feed, setFeed] = useState("");
  const [laeuft, start] = useTransition();
  const [bericht, setBericht] = useState<string[] | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {ohneKopf ? (
        // Ohne Kopf bleibt die Speicheranzeige — sie ist die einzige Auskunft
        // darüber, ob eine Eingabe angekommen ist, und darf nie mit der
        // Überschrift zusammen verschwinden (Wurzel 5).
        <div className="flex justify-end">
          <SpeicherAnzeige
            stand={auto.stand}
            texte={{
              speichert: t("kopf.speichert"),
              gespeichert: t("kopf.gespeichert"),
              fehler: t("kopf.speicherFehler"),
            }}
          />
        </div>
      ) : (
      <BereichsKopf
        titel={t("einstellungen.blog.titel")}
        beschreibung={t("einstellungen.blog.hinweis")}
        aktion={
          <SpeicherAnzeige
            stand={auto.stand}
            texte={{
              speichert: t("kopf.speichert"),
              gespeichert: t("kopf.gespeichert"),
              fehler: t("kopf.speicherFehler"),
            }}
          />
        }
      />
      )}

      {abschnitt !== "import" ? (
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-extrabold">
          {t("einstellungen.blog.allgemein")}
        </h2>
        <Feld
          titel={t("einstellungen.blog.name")}
          beschreibung={t("einstellungen.blog.nameHinweis")}
          wert={entwurf.blog_name ?? ""}
          maxLength={120}
          onWert={(v) => setEntwurf((e) => ({ ...e, blog_name: v || null }))}
        />
        <Schalter
          titel={t("einstellungen.blog.navigation")}
          beschreibung={t("einstellungen.blog.navigationHinweis")}
          an={entwurf.blog_prev_next}
          onAn={(v) => setEntwurf((e) => ({ ...e, blog_prev_next: v }))}
        />
      </section>
      ) : null}

      {abschnitt !== "import" ? (
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-extrabold">
          {t("einstellungen.blog.rss")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("einstellungen.blog.rssHinweis")}
        </p>
        <Feld
          titel={t("einstellungen.blog.rssTitel")}
          beschreibung={t("einstellungen.blog.rssTitelHinweis")}
          wert={entwurf.rss_title ?? ""}
          maxLength={200}
          onWert={(v) => setEntwurf((e) => ({ ...e, rss_title: v || null }))}
        />
        <Feld
          titel={t("einstellungen.blog.rssText")}
          beschreibung={t("einstellungen.blog.rssTextHinweis")}
          wert={entwurf.rss_description ?? ""}
          maxLength={500}
          onWert={(v) =>
            setEntwurf((e) => ({ ...e, rss_description: v || null }))
          }
        />
        <Feld
          titel={t("einstellungen.blog.rssBild")}
          beschreibung={t("einstellungen.blog.rssBildHinweis")}
          wert={entwurf.rss_image_url ?? ""}
          platzhalter="https://"
          onWert={(v) =>
            setEntwurf((e) => ({ ...e, rss_image_url: v || null }))
          }
        />
        {/* Die Adresse des Feeds. Sie steht hier, weil sie sonst niemand
            kennt — sie ergibt sich aus der Domain und ist nirgends verlinkt.
            Ohne aktive Domain wird sie NICHT geraten (Wurzel 4). */}
        <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-xs">
          {t("einstellungen.blog.rssAdresse")}
        </p>
      </section>
      ) : null}

      {abschnitt !== "einstellungen" ? (
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-extrabold">
          {t("einstellungen.blog.import")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("einstellungen.blog.importHinweis")}
        </p>
        <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-4 sm:flex-row">
          <Input
            value={feed}
            placeholder="https://…/feed.xml"
            maxLength={2000}
            onChange={(e) => setFeed(e.target.value)}
          />
          <button
            type="button"
            disabled={laeuft || !feed.trim()}
            onClick={() =>
              start(async () => {
                setBericht(null);
                const res = await importBlogFeed(feed.trim());
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                // Der Bericht bleibt STEHEN und ist kein Toast: „12 angelegt,
                // 3 übersprungen" ist das Ergebnis eines Vorgangs, den man
                // nachlesen können muss — ein Toast ist nach drei Sekunden weg.
                setBericht([
                  t("einstellungen.blog.importErgebnis", {
                    angelegt: res.data.angelegt,
                    uebersprungen: res.data.uebersprungen,
                    gefunden: res.data.feed_eintraege,
                  }),
                  ...res.data.hinweise,
                  ...res.data.titel,
                ]);
                setFeed("");
              })
            }
            className="shrink-0 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {laeuft
              ? t("einstellungen.blog.importLaeuft")
              : t("einstellungen.blog.importKnopf")}
          </button>
        </div>
        {bericht ? (
          <ul className="flex flex-col gap-1 rounded-(--radius) border border-border p-4 text-sm">
            {bericht.map((zeile, i) => (
              <li
                key={zeile}
                className={i === 0 ? "font-semibold" : "text-muted-foreground"}
              >
                {zeile}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}
