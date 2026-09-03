"use client";

// Neues Passwort setzen — mit dem CODE aus der Reset-Mail.
//
// WARUM DER CODE UND NICHT DER LINK (03.09.2026): Der Link in der Mail zeigte
// auf `{API_EXTERNAL_URL}/verify?token=…`. Jene GoTrue-Variable war auf die
// Kong-Basis OHNE `/auth/v1` gesetzt, unter dem Kong GoTrue aber
// veröffentlicht (`strip_path: true`) — der Link endete in Kongs „no Route
// matched". Gemessen: `/auth/v1/verify?token=x&type=recovery` gibt 303,
// `/verify?…` gibt 404.
//
// Der Code steht in derselben Mail („Alternatively, enter the code: 298259"),
// hängt an keiner URL und funktioniert damit unabhängig von der
// Proxy-Konfiguration. Diese Seite gab es vorher NICHT: `passwort-vergessen`
// verschickte die Mail, und das Ziel des Links existierte in der App nicht —
// der Reset-Weg war also nicht nur falsch verdrahtet, sondern unfertig.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { passwortNeuSetzen } from "@/lib/auth";

export function PasswortNeuFormular({ email: vorbelegt }: { email?: string }) {
  const t = useTranslations("anmelden");
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [email, setEmail] = useState(vorbelegt ?? "");
  const [code, setCode] = useState("");
  const [passwort, setPasswort] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  // Vor dem Absenden prüfen, nicht danach: ein Tippfehler in der Wiederholung
  // würde sonst den Code verbrauchen (GoTrue macht ihn beim Prüfen ungültig)
  // und der Partner müsste eine neue Mail anfordern.
  const passwortZuKurz = passwort.length > 0 && passwort.length < 8;
  const stimmtNicht = wiederholung.length > 0 && passwort !== wiederholung;
  const bereit =
    email.trim() !== "" &&
    code.trim() !== "" &&
    passwort.length >= 8 &&
    passwort === wiederholung;

  const feld =
    "rounded-full border border-border bg-transparent px-4 py-2.5 outline-none focus-visible:border-foreground";

  return (
    <form
      className="mt-8 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setFehler(null);
        starte(async () => {
          const res = await passwortNeuSetzen(
            email.trim(),
            code.trim(),
            passwort,
          );
          if (res.ok) {
            // Die Aktion hat die Sitzungs-Cookies gesetzt — direkt ins
            // Dashboard, kein zweites Anmelden.
            router.replace("/");
            return;
          }
          setFehler(res.fehler === "service_unavailable" ? t("stoerung") : res.fehler);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("email")}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={feld}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("resetCode")}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          className={feld}
        />
        <span className="text-xs font-normal text-muted-foreground">
          {t("resetCodeHinweis")}
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("passwortNeu")}
        <input
          type="password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={feld}
        />
        {passwortZuKurz && (
          <span className="text-xs font-normal text-accent">
            {t("passwortZuKurz")}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("passwortWiederholen")}
        <input
          type="password"
          value={wiederholung}
          onChange={(e) => setWiederholung(e.target.value)}
          required
          autoComplete="new-password"
          className={feld}
        />
        {stimmtNicht && (
          <span className="text-xs font-normal text-accent">
            {t("passwortStimmtNicht")}
          </span>
        )}
      </label>

      {fehler && (
        <p role="alert" className="text-sm text-accent">
          {fehler}
        </p>
      )}

      <button
        type="submit"
        disabled={laeuft || !bereit}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
      >
        {laeuft ? t("passwortWirdGesetzt") : t("passwortSetzen")}
      </button>
    </form>
  );
}
