"use client";

// Einladungs-Wizard für Co-Gastgeber. Vier Schritte wie bei Airbnb:
// Kontakt → Rechte → Notiz → Prüfen & senden.
//
// Warum in Schritten statt als ein Formular: Die Rechtewahl ist die
// folgenreichste Entscheidung und braucht Platz für die vollständige Erklärung,
// was jede Stufe darf und was nicht. In einem Dropdown neben einem E-Mail-Feld
// würde sie überlesen — und im Zweifel vergibt man Vollzugriff.
import { Icon } from "@iconify/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ladeCohostEin } from "@/lib/cohost-actions";
import type { CohostAccess, CohostInvitation } from "@/lib/cohosts";

import { ZUGRIFFS_STUFEN } from "./cohost-katalog";

type Schritt = "kontakt" | "rechte" | "notiz" | "pruefen" | "gesendet";

const REIHENFOLGE: Schritt[] = ["kontakt", "rechte", "notiz", "pruefen"];

/** Länge der optionalen Nachricht — dieselbe Grenze prüft das Backend. */
const NOTIZ_MAX_ZEICHEN = 500;

/** Grobe Plausibilitätsprüfung. Die echte Prüfung macht das Backend. */
function emailPlausibel(wert: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wert.trim());
}

export function CohostWizard({
  propertyId,
  onFertig,
  onAbbrechen,
}: {
  propertyId: string;
  onFertig: (einladung: CohostInvitation) => void;
  onAbbrechen: () => void;
}) {
  const t = useTranslations("objektEditor");
  const reduziert = useReducedMotion();
  const [schritt, setSchritt] = useState<Schritt>("kontakt");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<CohostAccess | null>(null);
  const [notiz, setNotiz] = useState("");
  const [sendet, setSendet] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const index = REIHENFOLGE.indexOf(schritt);
  const gewaehlteStufe = ZUGRIFFS_STUFEN.find((s) => s.key === access);

  const weiterErlaubt =
    (schritt === "kontakt" && emailPlausibel(email)) ||
    (schritt === "rechte" && access !== null) ||
    schritt === "notiz" ||
    schritt === "pruefen";

  async function senden() {
    if (!access) return;
    setSendet(true);
    const res = await ladeCohostEin(
      propertyId,
      email.trim(),
      access,
      notiz.trim() || null,
    );
    setSendet(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setLink(res.data.link);
    setSchritt("gesendet");
    onFertig({
      id: res.data.id,
      property_id: propertyId,
      email: res.data.email,
      access: res.data.access,
      note: notiz.trim() || null,
      expires_at: res.data.expires_at,
      created_at: new Date().toISOString(),
    });
  }

  function zurueck() {
    if (index > 0) setSchritt(REIHENFOLGE[index - 1]);
    else onAbbrechen();
  }

  function weiter() {
    if (schritt === "pruefen") void senden();
    else if (index < REIHENFOLGE.length - 1) setSchritt(REIHENFOLGE[index + 1]);
  }

  // Bestätigung: Der Einladungslink ist hier der einzige Weg zum Empfänger,
  // solange kein Mailversand existiert. Deshalb prominent und kopierbar —
  // nicht als Randnotiz.
  if (schritt === "gesendet") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-12">
          <div className="flex size-14 items-center justify-center rounded-full bg-foreground">
            <Icon icon="ph:check" className="size-7 text-background" />
          </div>
          <h2 className="mt-6 font-sans text-[2rem] font-bold tracking-tight">
            {t("cohostGesendetTitel")}
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t.rich("cohostGesendetText", {
              email,
              hervor: (teile) => (
                <span className="font-medium text-foreground">{teile}</span>
              ),
            })}
          </p>
          {link && (
            <div className="mt-6">
              <div className="flex items-center gap-2 rounded-2xl bg-muted/50 p-3">
                <code className="min-w-0 flex-1 truncate px-2 text-sm">
                  {link}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `${window.location.origin}${link}`,
                    );
                    toast.success(t("cohostLinkKopiert"));
                  }}
                  className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20"
                >
                  {t("cohostKopieren")}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-border px-8 py-5">
          <button
            type="button"
            onClick={onAbbrechen}
            className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            {t("fertig")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Fortschritt: vier gleich breite Balken. Zeigt, wie viel noch kommt —
          ohne Prozentzahl, die hier nichts erklären würde. */}
      <div className="shrink-0 px-8 pt-8">
        <div className="flex gap-1.5">
          {REIHENFOLGE.map((s, i) => (
            <span
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= index ? "bg-foreground" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={schritt}
            initial={reduziert ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduziert ? { opacity: 0 } : { opacity: 0, x: -12 }}
            transition={{ duration: reduziert ? 0 : 0.18 }}
          >
            {schritt === "kontakt" && (
              <>
                <h2 className="font-sans text-[2rem] font-bold tracking-tight">
                  {t("cohostKontaktTitel")}
                </h2>
                <p className="mt-3 text-[0.9375rem] text-muted-foreground">
                  {t("cohostKontaktText")}
                </p>
                <label
                  htmlFor="cohost-email"
                  className="mt-8 block text-sm font-medium"
                >
                  {t("cohostEmailLabel")}
                </label>
                <input
                  id="cohost-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("cohostEmailPlatzhalter")}
                  autoComplete="off"
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-5 py-3.5 outline-none transition-colors focus-visible:border-foreground"
                />
                {email.length > 0 && !emailPlausibel(email) && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("cohostEmailUnvollstaendig")}
                  </p>
                )}
              </>
            )}

            {schritt === "rechte" && (
              <>
                <h2 className="font-sans text-[2rem] font-bold tracking-tight">
                  {t("cohostRechteTitel")}
                </h2>
                <p className="mt-3 text-[0.9375rem] text-muted-foreground">
                  {t("cohostRechteText")}
                </p>
                <div className="mt-8 space-y-3">
                  {ZUGRIFFS_STUFEN.map((s) => {
                    const gewaehlt = access === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setAccess(s.key)}
                        aria-pressed={gewaehlt}
                        className={`block w-full rounded-2xl p-5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                          gewaehlt
                            ? "border-2 border-foreground"
                            : "border border-border hover:shadow-md"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon icon={s.icon} className="size-6 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">
                              {t(s.labelKey)}
                            </span>
                            <span className="mt-0.5 block text-sm text-muted-foreground">
                              {t(s.kurzKey)}
                            </span>
                          </span>
                        </span>
                        {/* Die vollständige Aufzählung erscheint erst bei der
                            Auswahl — sonst wären alle drei Karten Textwände. */}
                        {gewaehlt && (
                          <span className="mt-4 block border-t border-border pt-4">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("cohostDarf")}
                            </span>
                            <ul className="mt-2 space-y-1.5">
                              {s.darfKeys.map((d) => (
                                <li
                                  key={d}
                                  className="flex gap-2 text-sm text-muted-foreground"
                                >
                                  <Icon
                                    icon="ph:check"
                                    className="mt-0.5 size-4 shrink-0"
                                  />
                                  {t(d)}
                                </li>
                              ))}
                            </ul>
                            {s.darfNichtKeys.length > 0 && (
                              <>
                                <span className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {t("cohostDarfNicht")}
                                </span>
                                <ul className="mt-2 space-y-1.5">
                                  {s.darfNichtKeys.map((d) => (
                                    <li
                                      key={d}
                                      className="flex gap-2 text-sm text-muted-foreground"
                                    >
                                      <Icon
                                        icon="ph:x"
                                        className="mt-0.5 size-4 shrink-0"
                                      />
                                      {t(d)}
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {schritt === "notiz" && (
              <>
                <h2 className="font-sans text-[2rem] font-bold tracking-tight">
                  {t("cohostNotizTitel")}
                </h2>
                <p className="mt-3 text-[0.9375rem] text-muted-foreground">
                  {t("cohostNotizText")}
                </p>
                <textarea
                  value={notiz}
                  onChange={(e) =>
                    setNotiz(e.target.value.slice(0, NOTIZ_MAX_ZEICHEN))
                  }
                  rows={5}
                  placeholder={t("cohostNotizPlatzhalter")}
                  className="mt-8 w-full resize-none rounded-2xl border border-border bg-background px-5 py-4 outline-none transition-colors focus-visible:border-foreground"
                />
                <p className="mt-2 text-right text-sm text-muted-foreground">
                  {t("cohostNotizZaehler", {
                    n: notiz.length,
                    max: NOTIZ_MAX_ZEICHEN,
                  })}
                </p>
              </>
            )}

            {schritt === "pruefen" && gewaehlteStufe && (
              <>
                <h2 className="font-sans text-[2rem] font-bold tracking-tight">
                  {t("cohostPruefenTitel")}
                </h2>
                <dl className="mt-8 divide-y divide-border">
                  <div className="flex items-start justify-between gap-4 py-4">
                    <dt className="text-sm text-muted-foreground">
                      {t("cohostPruefenEinladen")}
                    </dt>
                    <dd className="min-w-0 break-words text-right font-medium">
                      {email}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-4">
                    <dt className="text-sm text-muted-foreground">
                      {t("cohostPruefenZugriff")}
                    </dt>
                    <dd className="text-right font-medium">
                      {t(gewaehlteStufe.labelKey)}
                    </dd>
                  </div>
                  {notiz.trim() && (
                    <div className="flex items-start justify-between gap-4 py-4">
                      <dt className="shrink-0 text-sm text-muted-foreground">
                        {t("cohostPruefenNachricht")}
                      </dt>
                      <dd className="min-w-0 whitespace-pre-wrap break-words text-right">
                        {notiz.trim()}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="mt-6 text-sm text-muted-foreground">
                  {t("cohostPruefenHaftung")}
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-8 py-5">
        <button
          type="button"
          onClick={zurueck}
          className="text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foreground/20"
        >
          {index === 0 ? t("abbrechen") : t("zurueck")}
        </button>
        <button
          type="button"
          onClick={weiter}
          disabled={!weiterErlaubt || sendet}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
        >
          {sendet
            ? t("cohostWirdErstellt")
            : schritt === "pruefen"
              ? t("cohostEinladungErstellen")
              : t("cohostWeiter")}
        </button>
      </div>
    </div>
  );
}
