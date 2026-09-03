"use client";

// Kanal-Editor: eine Zeile je Kanal (Plattform mit Original-Logo,
// Benutzername, Reichweite).
//
// Bei den echten Netzwerken ist der BENUTZERNAME das Eingabefeld, nicht die
// Adresse — die baut der Server daraus (03.09.2026, s. lib/kanaele.ts). Klebt
// jemand eine ganze Adresse ein, wird sie erkannt und zerlegt. Generische
// Kanäle (Website, Blog, Newsletter, Podcast, WhatsApp) haben keinen
// Benutzernamen; dort bleibt das Adressfeld stehen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { KanalIcon } from "@/components/kanal-icon";
import {
  handleBeispiel,
  handleEingabeDeuten,
  handleGueltig,
  hatHandle,
  type Plattform,
  PLATTFORM_META,
  PLATTFORMEN,
  plattformAusUrl,
  type SocialKanal,
} from "@/lib/kanaele";

const istSocial = (p: Plattform) => PLATTFORM_META[p].marke;

export type KanalEingabe = { platform: Plattform; url: string; handle: string; followers: string };

export const LEERER_KANAL: KanalEingabe = { platform: "instagram", url: "", handle: "", followers: "" };

export function kanaeleAusProfil(kanaele: SocialKanal[]): KanalEingabe[] {
  return kanaele.map((k) => ({
    platform: k.platform,
    url: k.url,
    handle: k.handle ?? "",
    // Bei verbundenem Konto ist `followers` der verifizierte Wert — bearbeitet
    // wird die eigene Angabe, sonst würde sie beim Speichern überschrieben.
    followers: (() => {
      const eigene = k.verified ? (k.followers_self_reported ?? null) : k.followers;
      return eigene === null ? "" : String(eigene);
    })(),
  }));
}

/** Ausgefüllt = Benutzername ODER Adresse steht (eine Quelle genügt). */
export function kanalGefuellt(k: KanalEingabe): boolean {
  return Boolean(k.handle.trim() || k.url.trim());
}

export function kanaeleZuApi(kanaele: KanalEingabe[]): SocialKanal[] {
  return kanaele.filter(kanalGefuellt).map((k) => ({
    platform: k.platform,
    // Leer lassen, wenn nur der Benutzername steht — der Server baut die
    // Adresse aus dem Profil-Muster. Eine hier zusammengesetzte URL wäre eine
    // zweite Kopie derselben Regel.
    url: k.url.trim(),
    handle: k.handle.trim() || null,
    followers: k.followers.trim() ? Number(k.followers.replace(/\D/g, "")) || 0 : null,
  }));
}

const FELD = "rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus-visible:border-foreground";

export function KanaeleFeld({
  kanaele,
  onChange,
  max = 12,
}: {
  kanaele: KanalEingabe[];
  onChange: (k: KanalEingabe[]) => void;
  max?: number;
}) {
  const t = useTranslations("kanaele");

  const setze = (i: number, patch: Partial<KanalEingabe>) =>
    onChange(kanaele.map((k, j) => (j === i ? { ...k, ...patch } : k)));

  const label = (p: Plattform) => (PLATTFORM_META[p].marke ? PLATTFORM_META[p].label : t(`plattform.${p}`));

  return (
    <div className="flex flex-col gap-3">
      {kanaele.map((k, i) => (
        <div key={i} className="rounded-2xl border border-border p-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_auto]">
            <KanalIcon platform={k.platform} className="size-6" />
            <select
              aria-label={t("plattformLabel")}
              value={k.platform}
              onChange={(e) => setze(i, { platform: e.target.value as Plattform })}
              className={FELD + " min-w-0 pr-10"}
            >
              {PLATTFORMEN.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </select>
            {hatHandle(k.platform) ? (
              <div className="col-span-3 flex min-w-0 items-center gap-0 sm:col-span-1">
                <span aria-hidden className="shrink-0 pl-1 text-sm text-muted-foreground">
                  @
                </span>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={100}
                  aria-label={t("handlePflicht")}
                  aria-invalid={!handleGueltig(k.handle)}
                  placeholder={handleBeispiel(k.platform)}
                  value={k.handle}
                  onChange={(e) => {
                    const gedeutet = handleEingabeDeuten(e.target.value);
                    setze(i, {
                      handle: gedeutet.handle ?? (gedeutet.url ? "" : e.target.value),
                      ...(gedeutet.plattform ? { platform: gedeutet.plattform } : {}),
                      // Eine eingeklebte Adresse gewinnt: Kurz- und
                      // Vanity-Links folgen keinem Muster.
                      ...(gedeutet.url ? { url: gedeutet.url } : { url: "" }),
                    });
                  }}
                  className={FELD + " min-w-0 flex-1"}
                />
              </div>
            ) : (
              <input
                type="url"
                required
                maxLength={500}
                placeholder={PLATTFORM_META[k.platform].beispiel}
                value={k.url}
                onChange={(e) => {
                  const url = e.target.value;
                  const erkannt = plattformAusUrl(url);
                  setze(i, { url, ...(erkannt ? { platform: erkannt } : {}) });
                }}
                className={FELD + " col-span-3 min-w-0 sm:col-span-1"}
              />
            )}
            {kanaele.length > 1 ? (
              <button
                type="button"
                aria-label={t("entfernen")}
                onClick={() => onChange(kanaele.filter((_, j) => j !== i))}
                className="col-start-3 row-start-1 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground sm:col-start-4"
              >
                <Icon icon="ph:x" className="size-4" />
              </button>
            ) : (
              <span className="col-start-3 row-start-1 sm:col-start-4" />
            )}
            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              placeholder={t("reichweite")}
              value={k.followers}
              onChange={(e) => setze(i, { followers: e.target.value.replace(/[^\d]/g, "") })}
              className={FELD + " col-span-3 min-w-0 sm:col-span-2 sm:col-start-2"}
            />
          </div>
          {!handleGueltig(k.handle) && <p className="mt-2 text-xs text-accent">{t("handleUngueltig")}</p>}
        </div>
      ))}
      {!kanaele.some((k) => istSocial(k.platform) && kanalGefuellt(k)) && (
        <p className="text-xs text-accent">{t("socialPflicht")}</p>
      )}
      {kanaele.length < max && (
        <button
          type="button"
          onClick={() => onChange([...kanaele, { ...LEERER_KANAL, platform: "website" }])}
          className="self-start rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-foreground"
        >
          + {t("hinzufuegen")}
        </button>
      )}
    </div>
  );
}

/** Kompakte Anzeige (Übersicht/Profil-Kopf): Logos nebeneinander. */
export function KanaeleLeiste({ kanaele }: { kanaele: SocialKanal[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {kanaele.map((k) => (
        <a
          key={k.url}
          href={k.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
        >
          <KanalIcon platform={k.platform} />
          {k.handle ? `@${k.handle}` : PLATTFORM_META[k.platform].label}
        </a>
      ))}
    </div>
  );
}
