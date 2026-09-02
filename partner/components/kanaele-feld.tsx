"use client";

// Kanal-Editor: eine Zeile je Kanal (Plattform mit Original-Logo, Adresse,
// Handle, Reichweite). Die Plattform wird aus der eingegebenen Adresse
// erkannt, solange der Partner sie nicht selbst gewählt hat.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { KanalIcon } from "@/components/kanal-icon";
import { type Plattform, PLATTFORM_META, PLATTFORMEN, plattformAusUrl, type SocialKanal } from "@/lib/kanaele";

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

export function kanaeleZuApi(kanaele: KanalEingabe[]): SocialKanal[] {
  return kanaele
    .filter((k) => k.url.trim())
    .map((k) => ({
      platform: k.platform,
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
              maxLength={100}
              placeholder={t("handle")}
              value={k.handle}
              onChange={(e) => setze(i, { handle: e.target.value })}
              className={FELD + " col-span-3 min-w-0 sm:col-span-2 sm:col-start-2"}
            />
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
        </div>
      ))}
      {!kanaele.some((k) => istSocial(k.platform) && k.url.trim()) && (
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
