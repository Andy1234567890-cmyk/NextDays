"use client";

// Das Bewerbungsformular. Kanal und Zustimmung sind Pflicht (Backoffice muss
// sehen, WER wirbt; ohne Bedingungen keine Provision). Honigtopf + reCAPTCHA
// (serverseitig bewertet) gegen Bots.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LAENDER } from "@nextdays/laender";

import { type KanalEingabe, KanaeleFeld, kanaeleZuApi, LEERER_KANAL } from "@/components/kanaele-feld";
import { bewerben } from "@/lib/auth";
import { captchaToken } from "@/lib/captcha";
import { PasswortFeld } from "./passwort-feld";

const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ?? "").replace(/\/$/, "");

export function BewerbungsFormular({ termsVersion, sponsorVorgabe = "" }: { termsVersion: string; sponsorVorgabe?: string }) {
  const t = useTranslations("bewerben");
  const locale = useLocale();
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [name, setName] = useState("");
  const [firma, setFirma] = useState("");
  const [rechtsform, setRechtsform] = useState<"company" | "private">("private");
  const [land, setLand] = useState("DE");
  const [ustId, setUstId] = useState("");
  const [kanaele, setKanaele] = useState<KanalEingabe[]>([{ ...LEERER_KANAL }]);
  const [pitch, setPitch] = useState("");
  const [sponsor, setSponsor] = useState(sponsorVorgabe.toUpperCase());
  const [zustimmung, setZustimmung] = useState(false);
  const [website, setWebsite] = useState(""); // Honigtopf

  return (
    <form
      className="mt-8 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFehler(null);
        starte(async () => {
          const token = await captchaToken();
          const res = await bewerben({
            email: email.trim(),
            password: passwort,
            full_name: name.trim(),
            company: firma.trim() || null,
            legal_form: rechtsform,
            country: land,
            vat_id: rechtsform === "company" ? ustId.trim() || null : null,
            language: locale,
            channel_url: null,
            channels: kanaeleZuApi(kanaele),
            sponsor_code: sponsor.trim() || null,
            pitch: pitch.trim() || null,
            terms_accepted: zustimmung,
            terms_version: termsVersion,
            captcha_token: token,
            website: website || null,
          });
          if (res.ok) {
            router.push("/");
            router.refresh();
            return;
          }
          if (res.status === 503) setFehler(t("stoerung"));
          else if (res.status === 409) setFehler(t("emailVergeben"));
          else if (res.status === 403) setFehler(t("captchaFehler"));
          else setFehler(res.fehler);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label={t("name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} className={INPUT} />
        </Feld>
        <Feld label={t("firma")}>
          <input value={firma} onChange={(e) => setFirma(e.target.value)} maxLength={200} className={INPUT} />
        </Feld>
        <Feld label={t("email")}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={INPUT} />
        </Feld>
        <PasswortFeld
          wert={passwort}
          setzen={setPasswort}
          label={t("passwort")}
          autoComplete="new-password"
        />
        <Feld label={t("rechtsform")}>
          <select value={rechtsform} onChange={(e) => setRechtsform(e.target.value as "company" | "private")} className={INPUT + " pr-10"}>
            <option value="private">{t("privat")}</option>
            <option value="company">{t("unternehmen")}</option>
          </select>
        </Feld>
        <Feld label={t("land")}>
          <select value={land} onChange={(e) => setLand(e.target.value)} className={INPUT + " pr-10"}>
            {LAENDER.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>
        </Feld>
        {rechtsform === "company" && (
          <Feld label={t("ustId")} hinweis={t("ustIdHinweis")}>
            <input value={ustId} onChange={(e) => setUstId(e.target.value.toUpperCase())} required placeholder="DE123456789" maxLength={20} className={INPUT + " font-mono"} />
          </Feld>
        )}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("kanal")}</span>
        <KanaeleFeld kanaele={kanaele} onChange={setKanaele} />
        <span className="text-xs text-muted-foreground">{t("kanalHinweis")}</span>
      </div>
      <Feld label={t("sponsor")} hinweis={t("sponsorHinweis")}>
        <input value={sponsor} onChange={(e) => setSponsor(e.target.value.toUpperCase())} maxLength={40} placeholder="ANNA-K7P2" className={INPUT + " font-mono"} />
      </Feld>
      <Feld label={t("pitch")} hinweis={t("pitchHinweis")}>
        <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={4} maxLength={2000} className="rounded-2xl border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus-visible:border-foreground" />
      </Feld>
      {/* Honigtopf — für Menschen unsichtbar, Bots füllen es. */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={zustimmung} onChange={(e) => setZustimmung(e.target.checked)} required className="mt-0.5 size-4" />
        <span>
          {t("zustimmung")}{" "}
          {MARKETING_URL && (
            <a href={`${MARKETING_URL}/partner/agb`} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 hover:underline">
              {t("bedingungen")}
            </a>
          )}
        </span>
      </label>
      <p className="text-xs text-muted-foreground">{t("captchaHinweis")}</p>
      {fehler && <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">{fehler}</p>}
      <button type="submit" disabled={laeuft || !zustimmung} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
        {laeuft ? t("laeuft") : t("absenden")}
      </button>
    </form>
  );
}

const INPUT =
  "rounded-full border border-border bg-transparent px-4 py-2.5 text-sm outline-none focus-visible:border-foreground";

function Feld({ label, hinweis, children }: { label: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hinweis && <span className="text-xs text-muted-foreground">{hinweis}</span>}
    </label>
  );
}
