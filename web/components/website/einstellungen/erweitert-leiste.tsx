"use client";

// Fortgeschritten: Favicon, eigener Code, Rechts-Hinweise, Hauptschalter (0426).
//
// Das ist der Bereich, in dem der Betrieb bewusst Löcher in seine eigene Seite
// bohren darf — Verifizierungs-Tags, ein Analytics-Schnipsel, eigenes CSS. Die
// Oberfläche sagt deshalb an jeder Stelle, WAS die Folge ist, und was NICHT
// geht: kein <script> im HTML-Feld, kein Kundencode in der Zahlungsstrecke.
//
// Die Prüfung selbst läuft serverseitig (nh3-Allowlist im Backend-Schema). Hier
// steht die Erklärung, nicht die Kontrolle — ein Filter im Browser wäre für
// jeden umgehbar, der die API direkt anspricht.
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@nextdays/ui/native-select";
import { type Branding, setBranding } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";

import { BildFeld } from "../editor/bild-feld";
import { SpeicherAnzeige } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { BereichsKopf } from "../bereichs-kopf";
import { Schalter } from "./schalter";

/** Ein mehrzeiliges Code-Feld. `spellCheck=false` und `autoCapitalize=off`,
 *  weil ein Editor, der `<meta>` groß schreibt oder rot unterstreicht, hier nur
 *  im Weg steht. */
function CodeFeld({
  label,
  hinweis,
  wert,
  platzhalter,
  maxLength,
  onWert,
}: {
  label: string;
  hinweis?: string;
  wert: string | null;
  platzhalter: string;
  maxLength: number;
  onWert: (v: string | null) => void;
}) {
  // Die Locale AUSDRÜCKLICH. `toLocaleString()` ohne Argument nimmt auf dem
  // Server Nodes Systemvorgabe („8,000") und im Browser die des Nutzers
  // („8.000") — React verwirft dann den Teilbaum und rendert ihn neu
  // (Hydration-Fehler, Prüfbericht B6).
  const locale = useLocale();
  const rest = maxLength - (wert?.length ?? 0);
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {hinweis ? (
        <span className="text-xs text-muted-foreground">{hinweis}</span>
      ) : null}
      <textarea
        value={wert ?? ""}
        onChange={(e) => onWert(e.target.value || null)}
        placeholder={platzhalter}
        maxLength={maxLength}
        rows={5}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="w-full rounded-(--radius) border border-border bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
      />
      {/* Die Restlänge steht dort, wo sie gebraucht wird: das Backend lehnt zu
          lange Eingaben ab, und ohne Anzeige wäre der 422 die erste
          Rückmeldung. */}
      <span className="self-end text-xs text-muted-foreground">
        {rest.toLocaleString(locale)}
      </span>
    </label>
  );
}

/** Auswahl einer eigenen Seite (für Cookie-/Datenschutz-Verweis).
 *
 *  Es erscheinen NUR veröffentlichte Seiten: ein Verweis auf einen Entwurf wäre
 *  für den Gast eine 404, und der Renderer lässt den Link in diesem Fall
 *  ohnehin weg (Wurzel 1 — der Gegenzustand ist schon gepflegt). */
function SeitenWahl({
  label,
  pages,
  wert,
  keineLabel,
  onWert,
}: {
  label: string;
  pages: Page[];
  wert: string | null;
  keineLabel: string;
  onWert: (id: string | null) => void;
}) {
  const waehlbar = pages.filter((p) => p.is_published);
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <NativeSelect
        value={wert ?? ""}
        onChange={(e) => onWert(e.target.value || null)}
      >
        <option value="">{keineLabel}</option>
        {waehlbar.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

export function ErweitertLeiste({
  branding,
  pages,
}: {
  branding: Branding;
  pages: Page[];
}) {
  const t = useTranslations("website");
  const [entwurf, setEntwurf] = useState<Branding>(branding);
  const [bestaetigt, setBestaetigt] = useState<Branding>(branding);

  const auto = useAutospeichern<Branding>({
    wert: entwurf,
    bestaetigt,
    speichern: async (diff) => {
      const res = await setBranding(diff);
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

  const setze = (patch: Partial<Branding>) =>
    setEntwurf((e) => ({ ...e, ...patch }));

  return (
    <div className="flex flex-col gap-8">
      <BereichsKopf
        titel={t("einstellungen.erweitert.titel")}
        beschreibung={t("einstellungen.erweitert.hinweis")}
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

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-base font-extrabold">
            {t("einstellungen.erweitert.faviconTitel")}
          </h2>
          <p className="pt-1 text-sm text-muted-foreground">
            {t("einstellungen.erweitert.faviconHinweis")}
          </p>
        </div>
        <div className="max-w-xs">
          <BildFeld
            label={t("design.faviconBild")}
            wert={entwurf.favicon_url}
            onWert={(url) => setze({ favicon_url: url })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-extrabold">
            {t("einstellungen.erweitert.codeTitel")}
          </h2>
          <p className="pt-1 text-sm text-muted-foreground">
            {t("einstellungen.erweitert.codeHinweis")}
          </p>
        </div>

        <CodeFeld
          label={t("einstellungen.erweitert.headHtml")}
          hinweis={t("einstellungen.erweitert.headHtmlHinweis")}
          wert={entwurf.head_html}
          platzhalter={'<meta name="google-site-verification" content="…" />'}
          maxLength={8000}
          onWert={(v) => setze({ head_html: v })}
        />
        <CodeFeld
          label={t("einstellungen.erweitert.headCss")}
          hinweis={t("einstellungen.erweitert.headCssHinweis")}
          wert={entwurf.head_css}
          platzhalter=".meine-klasse { color: #1f7a8c; }"
          maxLength={20000}
          onWert={(v) => setze({ head_css: v })}
        />
        <CodeFeld
          label={t("einstellungen.erweitert.customJs")}
          hinweis={t("einstellungen.erweitert.customJsHinweis")}
          wert={entwurf.custom_js}
          platzhalter="console.log('Hallo');"
          maxLength={20000}
          onWert={(v) => setze({ custom_js: v })}
        />
        <CodeFeld
          label={t("einstellungen.erweitert.checkoutJs")}
          hinweis={t("einstellungen.erweitert.checkoutJsHinweis")}
          wert={entwurf.checkout_js}
          platzhalter="// Conversion-Pixel"
          maxLength={8000}
          onWert={(v) => setze({ checkout_js: v })}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-extrabold">
            {t("einstellungen.erweitert.rechtTitel")}
          </h2>
          <p className="pt-1 text-sm text-muted-foreground">
            {t("einstellungen.erweitert.rechtHinweis")}
          </p>
        </div>

        <Schalter
          titel={t("einstellungen.erweitert.cookieBanner")}
          beschreibung={t("einstellungen.erweitert.cookieBannerHinweis")}
          an={entwurf.cookie_banner}
          onAn={(v) => setze({ cookie_banner: v })}
          kinder={
            <SeitenWahl
              label={t("einstellungen.erweitert.cookieSeite")}
              pages={pages}
              wert={entwurf.cookie_policy_page_id}
              keineLabel={t("einstellungen.erweitert.keineSeite")}
              onWert={(id) => setze({ cookie_policy_page_id: id })}
            />
          }
        />

        <Schalter
          titel={t("einstellungen.erweitert.datenschutzHaken")}
          beschreibung={t("einstellungen.erweitert.datenschutzHakenHinweis")}
          an={entwurf.privacy_consent}
          onAn={(v) => setze({ privacy_consent: v })}
          kinder={
            <SeitenWahl
              label={t("einstellungen.erweitert.datenschutzSeite")}
              pages={pages}
              wert={entwurf.privacy_policy_page_id}
              keineLabel={t("einstellungen.erweitert.keineSeite")}
              onWert={(id) => setze({ privacy_policy_page_id: id })}
            />
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-base font-extrabold">
            {t("einstellungen.erweitert.verwaltungTitel")}
          </h2>
        </div>
        <Schalter
          titel={t("einstellungen.erweitert.offline")}
          beschreibung={t("einstellungen.erweitert.offlineHinweis")}
          an={entwurf.is_offline}
          onAn={(v) => setze({ is_offline: v })}
        />
        {entwurf.is_offline ? (
          // Der Hinweis steht NUR im eingeschalteten Zustand und ist deutlich:
          // dieser Schalter nimmt die Verkaufsseite des Betriebs vom Netz, und
          // die Vorschau im Baukasten funktioniert weiter — es wäre also
          // möglich, das gar nicht zu merken.
          <p className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {t("einstellungen.erweitert.offlineWarnung")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
