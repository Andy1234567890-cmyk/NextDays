"use client";

// Bewerbungsformular des Partnerprogramms auf der Marketing-Seite. Pflicht:
// mindestens ein Social-Media-Konto mit BENUTZERNAME und Reichweite — das
// Backoffice prüft es vor der Freigabe (Prüfliste dort). Der Sponsor-Code aus
// dem Team-Link steht sichtbar im Formular (kein Cookie).
//
// Gefragt wird der Benutzername, nicht die Profil-Adresse: die kennen die
// meisten Bewerber nicht, sie steht in keiner App sichtbar (03.09.2026, siehe
// lib/kanaele.ts). Die Adresse baut der Server aus Plattform + Benutzername;
// eine eingeklebte Adresse wird erkannt und zerlegt. Generische Kanäle
// (Website, Blog, Newsletter, Podcast, WhatsApp) haben keinen Benutzernamen —
// dort bleibt das Adressfeld.
//
// Die Newsletter-Box ist die ZWEITE, freiwillige Einwilligung, getrennt von der
// Pflicht-Zustimmung zu den Partner-Bedingungen und nicht vorausgewählt (DSGVO
// Art. 4 Nr. 11). Der angehakte Wortlaut geht als Nachweis mit an den Server.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useEinwilligung } from "@/components/einwilligung/use-einwilligung";
import { KanalIcon } from "@/components/partner/kanal-icon";
import { PARTNER_LOGIN_URL, PARTNER_URL } from "@/lib/app-url";
import { CaptchaEinwilligungFehlt, captchaVorbereiten } from "@/lib/captcha";
import { EINWILLIGUNG_OEFFNEN, NICHTS_ERLAUBT } from "@/lib/einwilligung";
import { RECAPTCHA_SITE_KEY } from "@/lib/config";
import {
  handleBeispiel,
  handleEingabeDeuten,
  handleGueltig,
  hatHandle,
  type Plattform,
  PLATTFORM_META,
  PLATTFORMEN,
  plattformAusUrl,
} from "@/lib/kanaele";
import { BewerbungFehler, bewerbungSenden, LAENDER, landName, PARTNER_TERMS_VERSION, vatBeispielFuerLand } from "@/lib/partner-bewerbung";

type KanalEingabe = { platform: Plattform; url: string; handle: string; followers: string };
const LEER: KanalEingabe = { platform: "instagram", url: "", handle: "", followers: "" };
const FELD = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus-visible:border-foreground";

export function PartnerBewerbungFormular({ sponsorVorgabe }: { sponsorVorgabe: string }) {
  const t = useTranslations("partnerBewerbung");
  // Derselbe Katalog wie im Kontaktformular: der Zweck ist identisch, und zwei
  // Texte für eine Einwilligung würden auseinander laufen.
  const tEin = useTranslations("einwilligung.kontakt");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [name, setName] = useState("");
  const [firma, setFirma] = useState("");
  const [rechtsform, setRechtsform] = useState<"company" | "private">("private");
  const [land, setLand] = useState("DE");
  const [ustId, setUstId] = useState("");
  const [kanaele, setKanaele] = useState<KanalEingabe[]>([{ ...LEER }]);
  const [sponsor, setSponsor] = useState(sponsorVorgabe.toUpperCase());
  const [pitch, setPitch] = useState("");
  const [zustimmung, setZustimmung] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [website, setWebsite] = useState(""); // Honigtopf
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  const captchaGeladen = useRef(false);
  // Reaktiv, damit Hinweis und Knopfsperre verschwinden, sobald zugestimmt
  // wird — ohne Neuladen der Seite.
  const { entscheidung, geladen, speichern } = useEinwilligung();
  // Nur wenn überhaupt ein Schlüssel konfiguriert ist: lokal lädt nichts von
  // Google, dann darf kein Hinweis einen Dienst behaupten, den es nicht gibt.
  // `geladen` verhindert, dass er vor dem Lesen des Speichers aufblitzt.
  const spamschutzFehlt =
    RECAPTCHA_SITE_KEY !== "" && geladen && entscheidung?.auswahl.funktional !== true;

  useEffect(() => {
    if (!captchaGeladen.current) {
      captchaGeladen.current = true;
      void captchaVorbereiten();
    }
  }, []);

  const setze = (i: number, patch: Partial<KanalEingabe>) => setKanaele(kanaele.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const gefuellt = (k: KanalEingabe) => Boolean(k.handle.trim() || k.url.trim());
  const socialDabei = kanaele.some((k) => PLATTFORM_META[k.platform].marke && gefuellt(k));
  const handlesGueltig = kanaele.every((k) => handleGueltig(k.handle));
  const label = (p: Plattform) => (PLATTFORM_META[p].marke ? PLATTFORM_META[p].label : t(`plattform.${p}`));

  if (fertig) {
    return (
      <div className="rounded-3xl border border-border bg-background p-8 text-center">
        <Icon icon="ph:check-circle" className="mx-auto size-12 text-accent" />
        <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">{t("fertig.titel")}</h2>
        <p className="mt-2 text-muted-foreground">{t("fertig.text")}</p>
        {PARTNER_URL && (
          <a href={PARTNER_LOGIN_URL} className="mt-6 inline-block rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background">
            {t("fertig.login")}
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      className="grid gap-5 rounded-3xl border border-border bg-background p-6 sm:p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setFehler(null);
        // Rückhalt: der Knopf ist in diesem Fall schon gesperrt. Ein Absenden
        // per Tastatur oder aus einem Skript soll nicht in einen 403 laufen.
        if (spamschutzFehlt) return;
        if (!socialDabei) {
          setFehler(t("fehler.social"));
          return;
        }
        if (!handlesGueltig) {
          setFehler(t("kanaele.handleUngueltig"));
          return;
        }
        setLaeuft(true);
        try {
          await bewerbungSenden({
            email: email.trim(),
            password: passwort,
            full_name: name.trim(),
            company: firma.trim() || null,
            legal_form: rechtsform,
            country: land,
            vat_id: rechtsform === "company" ? ustId.trim() || null : null,
            language: locale,
            channels: kanaele
              .filter(gefuellt)
              // `url` bleibt leer, wenn nur der Benutzername steht — die
              // Adresse baut der Server aus dem Profil-Muster. Sie hier
              // zusammenzusetzen wäre eine zweite Kopie derselben Regel.
              .map((k) => ({ platform: k.platform, url: k.url.trim(), handle: k.handle.trim() || null, followers: k.followers ? Number(k.followers) : null })),
            sponsor_code: sponsor.trim() || null,
            pitch: pitch.trim() || null,
            terms_accepted: zustimmung,
            terms_version: PARTNER_TERMS_VERSION,
            newsletter_opt_in: newsletter,
            // Der Wortlaut in der Sprache, in der er angehakt wurde — er ist
            // der Nachweis (DSGVO Art. 7 Abs. 1), nicht ein Anzeigetext.
            newsletter_consent_text: newsletter ? t("newsletter") : null,
            website: website || null,
          });
          setFertig(true);
        } catch (exc) {
          // Fehlende Einwilligung zuerst: kein HTTP-Fehler, sondern ein
          // fehlender Vorzustand. Der Hinweis samt Erlauben-Knopf steht durch
          // `spamschutzFehlt` schon im Formular; zusätzlich die Leiste öffnen,
          // damit der Bewerber auch dort entscheiden kann. Kein Fehlertext:
          // „Seite neu laden" wäre eine Anweisung, die nichts ändert.
          if (exc instanceof CaptchaEinwilligungFehlt) {
            window.dispatchEvent(new Event(EINWILLIGUNG_OEFFNEN));
            return;
          }
          // Bei 409 den SERVER-Text zeigen, nicht pauschal „bereits
          // beworben": der Server unterscheidet zwei Fälle, die für den
          // Bewerber ganz verschiedene Schritte bedeuten — eine vorhandene
          // Bewerbung (anmelden) und eine anderweitig vergebene E-Mail
          // (andere Adresse nehmen). Live am 03.09.2026 stand „Melden Sie
          // sich im Partner-Dashboard an", während es dort kein Konto gab:
          // die Adresse hatte ein normales PMS-Konto, aber keine Bewerbung.
          // `fehler.doppelt` bleibt der Rückfall, wenn der Server keinen
          // Text mitschickt.
          if (exc instanceof BewerbungFehler && exc.status === 409) setFehler(exc.detail || t("fehler.doppelt"));
          else if (exc instanceof BewerbungFehler && exc.status === 422) setFehler(exc.detail || t("fehler.eingabe"));
          else if (exc instanceof BewerbungFehler && exc.status === 403) setFehler(t("fehler.captcha"));
          else setFehler((exc instanceof BewerbungFehler && exc.detail) || t("fehler.allgemein"));
        } finally {
          setLaeuft(false);
        }
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">{t("email")}</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FELD + " mt-1"} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("passwort")}</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={passwort} onChange={(e) => setPasswort(e.target.value)} className={FELD + " mt-1"} />
          <span className="mt-1 block text-xs text-muted-foreground">{t("passwortHinweis")}</span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("name")}</span>
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={FELD + " mt-1"} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("firma")}</span>
          <input maxLength={200} value={firma} onChange={(e) => setFirma(e.target.value)} className={FELD + " mt-1"} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("rechtsform")}</span>
          <select value={rechtsform} onChange={(e) => setRechtsform(e.target.value as "company" | "private")} className={FELD + " mt-1"}>
            <option value="private">{t("privat")}</option>
            <option value="company">{t("unternehmen")}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("land")}</span>
          <select value={land} onChange={(e) => setLand(e.target.value)} className={FELD + " mt-1"}>
            {LAENDER.map((c) => (
              <option key={c} value={c}>
                {landName(c, locale)}
              </option>
            ))}
          </select>
        </label>
        {rechtsform === "company" && (
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">{t("ustId")}</span>
            <input required maxLength={20} placeholder={vatBeispielFuerLand(land)} value={ustId} onChange={(e) => setUstId(e.target.value.toUpperCase())} className={FELD + " mt-1 font-mono"} />
            <span className="mt-1 block text-xs text-muted-foreground">{t("ustIdHinweis")}</span>
          </label>
        )}
      </div>

      <div className="text-sm">
        <span className="font-medium">{t("kanaele.titel")}</span>
        <p className="mt-1 text-xs text-muted-foreground">{t("kanaele.hinweis")}</p>
        <div className="mt-3 flex flex-col gap-3">
          {kanaele.map((k, i) => (
            <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_auto]">
              <KanalIcon platform={k.platform} className="size-6" />
              <select aria-label={t("kanaele.plattform")} value={k.platform} onChange={(e) => setze(i, { platform: e.target.value as Plattform })} className={FELD + " min-w-0"}>
                {PLATTFORMEN.map((p) => (
                  <option key={p} value={p}>
                    {label(p)}
                  </option>
                ))}
              </select>
              {hatHandle(k.platform) ? (
                <div className="col-span-3 flex min-w-0 items-center rounded-xl border border-border bg-background focus-within:border-foreground sm:col-span-1">
                  <span aria-hidden className="shrink-0 pl-3 text-sm text-muted-foreground">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={100}
                    aria-label={t("kanaele.handlePflicht")}
                    aria-invalid={!handleGueltig(k.handle)}
                    placeholder={handleBeispiel(k.platform)}
                    value={k.handle}
                    onChange={(e) => {
                      // Wer „Link kopieren" benutzt, klebt eine ganze Adresse
                      // ein — die wird erkannt, zerlegt und behalten.
                      const gedeutet = handleEingabeDeuten(e.target.value);
                      setze(i, {
                        handle: gedeutet.handle ?? (gedeutet.url ? "" : e.target.value),
                        ...(gedeutet.plattform ? { platform: gedeutet.plattform } : {}),
                        ...(gedeutet.url ? { url: gedeutet.url } : { url: "" }),
                      });
                    }}
                    className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none"
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
                    const erkannt = plattformAusUrl(e.target.value);
                    setze(i, { url: e.target.value, ...(erkannt ? { platform: erkannt } : {}) });
                  }}
                  className={FELD + " col-span-3 min-w-0 sm:col-span-1"}
                />
              )}
              {kanaele.length > 1 ? (
                <button type="button" aria-label={t("kanaele.entfernen")} onClick={() => setKanaele(kanaele.filter((_, j) => j !== i))} className="col-start-3 row-start-1 rounded-full p-2 text-muted-foreground hover:bg-muted sm:col-start-4">
                  <Icon icon="ph:x" className="size-4" />
                </button>
              ) : (
                <span className="col-start-3 row-start-1 sm:col-start-4" />
              )}
              <input
                type="text"
                inputMode="numeric"
                required={PLATTFORM_META[k.platform].marke}
                maxLength={12}
                placeholder={t("kanaele.reichweite")}
                value={k.followers}
                onChange={(e) => setze(i, { followers: e.target.value.replace(/[^\d]/g, "") })}
                className={FELD + " col-span-3 min-w-0 sm:col-span-2 sm:col-start-2"}
              />
              {!handleGueltig(k.handle) && (
                <p className="col-span-3 text-xs text-accent sm:col-span-4">{t("kanaele.handleUngueltig")}</p>
              )}
            </div>
          ))}
          {!socialDabei && <p className="text-xs text-accent">{t("kanaele.socialPflicht")}</p>}
          {kanaele.length < 12 && (
            <button type="button" onClick={() => setKanaele([...kanaele, { ...LEER, platform: "website" }])} className="self-start rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-foreground">
              + {t("kanaele.hinzufuegen")}
            </button>
          )}
        </div>
      </div>

      <label className="block text-sm">
        <span className="font-medium">{t("sponsor")}</span>
        <input maxLength={40} placeholder="ANNA-K7P2" value={sponsor} onChange={(e) => setSponsor(e.target.value.toUpperCase())} className={FELD + " mt-1 font-mono sm:max-w-xs"} />
        <span className="mt-1 block text-xs text-muted-foreground">{t("sponsorHinweis")}</span>
      </label>

      <label className="block text-sm">
        <span className="font-medium">{t("pitch")}</span>
        <textarea rows={4} maxLength={2000} value={pitch} onChange={(e) => setPitch(e.target.value)} className={FELD + " mt-1 rounded-2xl"} placeholder={t("pitchPlatzhalter")} />
      </label>

      {/* Honigtopf — für Menschen unsichtbar, Bots füllen es. */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" required checked={zustimmung} onChange={(e) => setZustimmung(e.target.checked)} className="mt-0.5 size-4" />
        <span>
          {t("zustimmung")}{" "}
          <Link href="/partner/agb" target="_blank" className="font-semibold underline-offset-4 hover:underline">
            {t("bedingungen")}
          </Link>{" "}
          <span className="text-muted-foreground">({t("version", { version: PARTNER_TERMS_VERSION })})</span>
        </span>
      </label>

      {/* Zweite, FREIWILLIGE Einwilligung. Bewusst getrennt von der
          Pflicht-Zustimmung darüber und nicht vorausgewählt: eine
          vorangekreuzte Box ist keine Einwilligung (DSGVO Art. 4 Nr. 11,
          EuGH „Planet49"). Sie ist keine Bedingung der Bewerbung — der
          Absende-Knopf hängt allein an `zustimmung`. */}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-0.5 size-4" />
        <span>
          {t("newsletter")} <span className="text-muted-foreground">{t("newsletterFreiwillig")}</span>
        </span>
      </label>

      {/* Als FEHLER erkennbar und für Screenreader angekündigt. Vorher stand
          hier die Akzentfarbe des Absende-Knopfes (`border-accent/40
          bg-accent/5`) — die Meldung sah aus wie ein neutraler Hinweis, und
          weil sie ÜBER dem Knopf steht, klickte man weiter (live gemeldet
          03.09.2026). `role="alert"` liest sie beim Erscheinen vor, ohne dass
          der Fokus springt. */}
      {/* Einwilligung für den externen Spamschutz — GLEICHES Muster wie im
          Kontaktformular, mit demselben Textkatalog (`einwilligung.kontakt`):
          Hinweis samt Erlauben-Knopf IM Formular, und der Absende-Knopf ist
          gesperrt, solange die Erlaubnis fehlt.

          WAS VORHER PASSIERTE (03.09.2026): hier gab es keine dieser beiden
          Vorkehrungen. Ohne Einwilligung lud kein reCAPTCHA, `captchaToken`
          gab still `null` zurück, der Server lehnte mit 403 ab, und der
          Bewerber las „Bitte Seite neu laden und erneut versuchen" — eine
          Anweisung, die am Zustand nichts ändert. Eine echte Bewerbung ist so
          verloren gegangen. Das Kontaktformular hatte die Lösung längst; sie
          fehlte nur an DIESEM Formular. */}
      {spamschutzFehlt && (
        <div className="rounded-2xl border border-border bg-muted/40 p-5 text-sm">
          <p className="leading-relaxed text-muted-foreground">{tEin("hinweis")}</p>
          <button
            type="button"
            onClick={() => speichern({ ...(entscheidung?.auswahl ?? NICHTS_ERLAUBT), funktional: true })}
            className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-foreground"
          >
            {tEin("erlauben")}
          </button>
        </div>
      )}

      {fehler && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {fehler}
        </p>
      )}

      <button type="submit" disabled={laeuft || !zustimmung || spamschutzFehlt} className="rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-foreground disabled:opacity-50">
        {laeuft ? t("sendet") : t("absenden")}
      </button>
      <p className="text-xs text-muted-foreground">{t("pruefungHinweis")}</p>
    </form>
  );
}
