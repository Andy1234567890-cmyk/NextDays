"use client";

// Rechtsform und USt-IdNr. — mit Passwort-Rückfrage: wer die Steuerdaten
// ändert, ändert die Gutschrift und damit die Steuerlast (Wurzel 7).
//
// Der AUSZAHLUNGSWEG steht seit 0522 nicht mehr hier: es gibt nur noch das
// Verbundkonto (`components/verbundkonto.tsx`), und die Bankverbindung liegt
// bei Stripe, nicht bei uns. Ein zweites IBAN-Feld an dieser Stelle wäre eine
// Attrappe — es würde einen Weg anbieten, den der Auszahlungslauf nicht geht.
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { laenderNachName, vatBeispielFuerLand } from "@nextdays/laender";

import type { Profil } from "@/lib/partner";
import { steuerdatenSetzen } from "@/lib/partner-actions";
import { PasswortFeld } from "./passwort-feld";

export function SteuerdatenFormular({ profil }: { profil: Profil }) {
  const t = useTranslations("profil");
  const locale = useLocale();
  // Ländernamen und Sortierung in der Sprache des Nutzers, nicht auf Deutsch.
  const laender = useMemo(() => laenderNachName(locale), [locale]);
  const [laeuft, starte] = useTransition();
  const [rechtsform, setRechtsform] = useState<"company" | "private">(profil.legal_form);
  const [land, setLand] = useState(profil.country);
  const [ustId, setUstId] = useState(profil.vat_id ?? "");
  const [passwort, setPasswort] = useState("");

  return (
    <form
      className="rounded-2xl border border-border p-6"
      onSubmit={(e) => {
        e.preventDefault();
        starte(async () => {
          const res = await steuerdatenSetzen({
            password: passwort,
            legal_form: rechtsform,
            country: land,
            vat_id: rechtsform === "company" ? ustId.trim() || null : null,
          });
          setPasswort("");
          if (res.ok) {
            toast.success(res.data.vat_id && !res.data.vat_id_verified ? t("gespeichertViesOffen") : t("gespeichert"));
          } else toast.error(res.status === 401 ? t("passwortFalsch") : res.fehler);
        });
      }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("steuerdaten")}</h2>
      {profil.vat_id && (
        <p className="mt-2 text-sm text-muted-foreground">
          {profil.vat_id_verified ? t("viesBestaetigt") : t("viesOffen")}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t("rechtsform")}</span>
          <select value={rechtsform} onChange={(e) => setRechtsform(e.target.value as "company" | "private")} className="rounded-full border border-border bg-transparent pl-4 pr-10 py-2">
            <option value="private">{t("privat")}</option>
            <option value="company">{t("unternehmen")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t("land")}</span>
          <select value={land} onChange={(e) => setLand(e.target.value)} className="rounded-full border border-border bg-transparent pl-4 pr-10 py-2">
            {laender.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>
        </label>
        {rechtsform === "company" && (
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t("ustId")}</span>
            <input value={ustId} onChange={(e) => setUstId(e.target.value.toUpperCase())} required placeholder={vatBeispielFuerLand(land)} maxLength={20} className="rounded-full border border-border bg-transparent px-4 py-2 font-mono outline-none focus-visible:border-foreground" />
            <span className="text-xs text-muted-foreground">{t("ustIdHinweis")}</span>
          </label>
        )}
        {rechtsform === "private" && <p className="text-xs text-muted-foreground">{t("privatHinweis")}</p>}
        <PasswortFeld wert={passwort} setzen={setPasswort} label={t("passwortBestaetigen")} />
      </div>
      <button type="submit" disabled={laeuft} className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
        {t("speichern")}
      </button>
    </form>
  );
}
