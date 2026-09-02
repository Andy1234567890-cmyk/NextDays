"use client";

// Stammdaten: Name, Firma, Sprache, Kanäle. Die E-Mail ist hier bewusst nicht
// änderbar (Re-Auth + Doppel-Opt-in wären nötig, Wurzel 7).
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { type KanalEingabe, KanaeleFeld, kanaeleAusProfil, kanaeleZuApi, LEERER_KANAL } from "@/components/kanaele-feld";
import { LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import type { Profil } from "@/lib/partner";
import { profilAendern } from "@/lib/partner-actions";

export function ProfilFormular({ profil }: { profil: Profil }) {
  const t = useTranslations("profil");
  const [laeuft, starte] = useTransition();
  const [name, setName] = useState(profil.full_name);
  const [firma, setFirma] = useState(profil.company ?? "");
  const [sprache, setSprache] = useState(profil.language);
  const [kanaele, setKanaele] = useState<KanalEingabe[]>(
    profil.channels.length ? kanaeleAusProfil(profil.channels) : [{ ...LEERER_KANAL }],
  );

  return (
    <form
      className="rounded-2xl border border-border p-6"
      onSubmit={(e) => {
        e.preventDefault();
        starte(async () => {
          const res = await profilAendern({
            full_name: name.trim(),
            company: firma.trim() || null,
            language: sprache,
            channels: kanaeleZuApi(kanaele),
          });
          if (res.ok) toast.success(t("gespeichert"));
          else toast.error(res.fehler);
        });
      }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("stammdaten")}</h2>
      <div className="mt-4 flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t("name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} className="rounded-full border border-border bg-transparent px-4 py-2 outline-none focus-visible:border-foreground" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t("firma")}</span>
          <input value={firma} onChange={(e) => setFirma(e.target.value)} maxLength={200} className="rounded-full border border-border bg-transparent px-4 py-2 outline-none focus-visible:border-foreground" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t("sprache")}</span>
          <select value={sprache} onChange={(e) => setSprache(e.target.value)} className="rounded-full border border-border bg-transparent pl-4 pr-10 py-2">
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{t("kanal")}</span>
          <KanaeleFeld kanaele={kanaele} onChange={setKanaele} />
        </div>
      </div>
      <button type="submit" disabled={laeuft} className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
        {t("speichern")}
      </button>
    </form>
  );
}
