"use client";

// Kontakt & Social der Kunden-Website.
//
// Aufteilung nach HERKUNFT, nicht nach Optik:
//
//  • Die Kontaktdaten (Firmenname, Anschrift, E-Mail, Telefon) pflegt der
//    Betrieb unter Konto → Profil. Hier stehen sie NUR zur Ansicht, mit einem
//    Verweis dorthin. Ein zweites Formular dafür wäre eine zweite Wahrheit: wer
//    umzieht, ändert die Adresse an einer Stelle und wundert sich, dass die
//    Fußzeile die alte zeigt. (Lodgify pflegt sie hier doppelt — genau davon
//    kommt das Problem.)
//
//  • Die Social-Links gibt es NUR für die Website. Sie werden hier bearbeitet
//    und wandern in `social_links`; welche Netzwerke möglich sind, entscheidet
//    die Fußzeile des Renderers (dieselbe Liste, serverseitig als Allowlist).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Input } from "@nextdays/ui/input";
import { type Branding, setBranding } from "@/lib/site-config";

import { SpeicherAnzeige } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { EinstellungenKopf } from "./rahmen";

/** Netzwerke in Anzeigeordnung. Muss mit `SOCIAL` in
 *  `builder/components/site-footer.tsx` und `_SOCIAL_KEYS` im Backend
 *  deckungsgleich sein — ein hier angebotenes Netzwerk, das die Fußzeile nicht
 *  rendert, wäre ein Feld ohne Wirkung. */
const NETZWERKE = [
  { key: "instagram", label: "Instagram", icon: "ph:instagram-logo" },
  { key: "facebook", label: "Facebook", icon: "ph:facebook-logo" },
  { key: "youtube", label: "YouTube", icon: "ph:youtube-logo" },
  { key: "linkedin", label: "LinkedIn", icon: "ph:linkedin-logo" },
  { key: "pinterest", label: "Pinterest", icon: "ph:pinterest-logo" },
  { key: "tiktok", label: "TikTok", icon: "ph:tiktok-logo" },
] as const;

/** Nur vollständige http(s)-Adressen sind gültig — genau die Regel, die das
 *  Backend erzwingt. Hier vorgeprüft, damit der Kunde den Grund SIEHT, statt
 *  einen 422 als roten Toast zu bekommen. */
const URL_RE = /^https?:\/\/\S+$/i;

export type Firmendaten = {
  name: string | null;
  anschrift: string | null;
  email: string | null;
  telefon: string | null;
  logoUrl: string | null;
};

export function KontaktLeiste({
  branding,
  firma,
}: {
  branding: Branding;
  firma: Firmendaten;
}) {
  const t = useTranslations("website");
  const [entwurf, setEntwurf] = useState<Branding>(branding);
  const [bestaetigt, setBestaetigt] = useState<Branding>(branding);

  const auto = useAutospeichern<Branding>({
    wert: entwurf,
    bestaetigt,
    // Nur speichern, wenn jede AUSGEFÜLLTE Adresse vollständig ist. Ein halb
    // getipptes „https://insta" wäre serverseitig ein 422 — und ein roter Toast
    // bei jedem dritten Tastendruck.
    gueltig: (b) =>
      Object.values(b.social_links ?? {}).every(
        (v) => !v.trim() || URL_RE.test(v.trim()),
      ),
    speichern: async (diff) => {
      const res = await setBranding(diff);
      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const, data: res.data };
    },
  });

  useEffect(() => {
    if (auto.uebernommen) {
      setBestaetigt(auto.uebernommen);
    }
  }, [auto.uebernommen]);

  useEffect(() => {
    if (auto.fehler) toast.error(auto.fehler);
  }, [auto.fehler]);

  function setzeNetz(key: string, wert: string) {
    setEntwurf((e) => ({
      ...e,
      social_links: { ...(e.social_links ?? {}), [key]: wert },
    }));
  }

  const zeilen: Array<{ label: string; wert: string | null }> = [
    { label: t("einstellungen.kontakt.firmenname"), wert: firma.name },
    { label: t("einstellungen.kontakt.anschrift"), wert: firma.anschrift },
    { label: t("einstellungen.kontakt.email"), wert: firma.email },
    { label: t("einstellungen.kontakt.telefon"), wert: firma.telefon },
  ];

  return (
    <div className="flex flex-col gap-8">
      <EinstellungenKopf
        titel={t("einstellungen.kontakt.titel")}
        beschreibung={t("einstellungen.kontakt.hinweis")}
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
            {t("einstellungen.kontakt.ausKontoTitel")}
          </h2>
          <p className="pt-1 text-sm text-muted-foreground">
            {t("einstellungen.kontakt.ausKontoHinweis")}
          </p>
        </div>

        <dl className="divide-y divide-border rounded-(--radius) border border-border">
          {zeilen.map((z) => (
            <div
              key={z.label}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
            >
              <dt className="text-sm text-muted-foreground">{z.label}</dt>
              {/* Fehlt ein Wert, steht das auch so da — kein Platzhalter, der
                  wie eine echte Angabe aussieht (Wurzel 4). */}
              <dd
                className={
                  "min-w-0 text-right text-sm " +
                  (z.wert ? "font-medium" : "italic text-muted-foreground")
                }
              >
                {z.wert ?? t("einstellungen.kontakt.nichtGesetzt")}
              </dd>
            </div>
          ))}
        </dl>

        <Link
          href="/konto"
          className="flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
        >
          {t("einstellungen.kontakt.imKontoAendern")}
          <Icon icon="ph:arrow-right" className="size-4" />
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-base font-extrabold">
            {t("einstellungen.kontakt.socialTitel")}
          </h2>
          <p className="pt-1 text-sm text-muted-foreground">
            {t("einstellungen.kontakt.socialHinweis")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {NETZWERKE.map((n) => {
            const wert = entwurf.social_links?.[n.key] ?? "";
            const kaputt = wert.trim() !== "" && !URL_RE.test(wert.trim());
            return (
              <label key={n.key} className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon icon={n.icon} className="size-4" />
                  {n.label}
                </span>
                <Input
                  value={wert}
                  onChange={(e) => setzeNetz(n.key, e.target.value)}
                  placeholder="https://"
                  inputMode="url"
                  maxLength={500}
                  aria-invalid={kaputt || undefined}
                />
                {kaputt ? (
                  <span className="text-xs text-destructive">
                    {t("einstellungen.kontakt.urlUnvollstaendig")}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
