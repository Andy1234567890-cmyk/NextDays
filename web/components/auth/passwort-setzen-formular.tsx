"use client";

// Gemeinsames Formular „Passwort setzen" für BEIDE Token-Wege: Einladung
// annehmen und Passwort zurücksetzen. Der Ablauf ist identisch (Token aus dem
// Link, zweimal eingeben, gleiche Fehlzustände) — nur die Überschriften und
// der aufgerufene Endpunkt unterscheiden sich. Deshalb liegt er EINMAL hier.
//
// Umgang mit dem Token (bewusst):
//   - Er wird nur aus der URL gelesen und im POST-Body an den Server gegeben.
//   - Er landet in KEINER Fehlermeldung und in keinem Log.
//   - Nach Erfolg wird die URL per `history.replaceState` vom Token befreit,
//     damit er nicht in der Verlaufsliste, im Referer oder in einem Screenshot
//     der Adresszeile überlebt. `router.replace` wäre der Next-Weg, würde die
//     Seite aber neu rendern und den Erfolgszustand verwerfen.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  PASSWORT_MIN_LAENGE,
  PasswortFeld,
  passwortGenuegt,
} from "@/components/auth/passwort-feld";
import { type TokenErgebnis, type TokenFehler, tokenPruefen } from "@/lib/einladung";

/** Welcher der beiden Vorgänge — steuert ausschließlich die Texte. */
export type Vorgang = "einladung" | "reset";

export function PasswortSetzenFormular({
  vorgang,
  absenden,
}: {
  vorgang: Vorgang;
  /** Server-Action des jeweiligen Vorgangs (einladungAnnehmen | passwortNeuSetzen). */
  absenden: (token: string, passwort: string) => Promise<TokenErgebnis>;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [passwort, setPasswort] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [fehler, setFehler] = useState<TokenFehler | "ungleich" | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  // Vorab-Prüfung des Tokens: solange sie läuft, zeigt die Seite nichts
  // Endgültiges. Sonst tippt der Nutzer ein Passwort in ein Formular, dessen
  // Link längst tot ist.
  const [pruefend, setPruefend] = useState(true);

  useEffect(() => {
    if (!token) {
      setPruefend(false);
      return;
    }
    let aktiv = true;
    void tokenPruefen(vorgang, token).then((ergebnis) => {
      if (!aktiv) return;
      // Schon eingelöst = die Person hat ihr Passwort bereits angelegt. Sie
      // gehört zur Anmeldung, nicht auf eine Warnseite: der zweite Klick auf
      // den Link aus der Mail ist ein normaler Vorgang, kein Fehler. Sofort
      // (ohne Zwischenseite), weil es hier nichts zu bestätigen gibt — anders
      // als nach dem erfolgreichen Setzen, wo die Bestätigung die Auskunft ist.
      if (ergebnis === "schonBenutzt") {
        router.replace("/login");
        return;
      }
      if (ergebnis === "ungueltig") setFehler("ungueltig");
      else if (ergebnis === "zuOft") setFehler("zuOft");
      setPruefend(false);
    });
    return () => {
      aktiv = false;
    };
  }, [token, vorgang, router]);

  // Nach Erfolg den Token aus der Adresszeile entfernen (siehe Kopf) und dann
  // zur Anmeldung weiterleiten.
  //
  // Warum mit kurzer Verzögerung und nicht sofort: Der Nutzer soll SEHEN, dass
  // sein Passwort gespeichert wurde — bei sofortigem Sprung wirkt es, als wäre
  // nichts passiert. Der Knopf daneben bleibt, wer nicht warten will, klickt.
  // Bewusst KEIN Auto-Login (OWASP: nach einem Passwort-Vorgang führt der Weg
  // über die reguläre Anmeldung).
  useEffect(() => {
    if (!fertig || typeof window === "undefined") return;
    window.history.replaceState(null, "", window.location.pathname);
    const timer = window.setTimeout(() => router.replace("/login"), 2000);
    return () => window.clearTimeout(timer);
  }, [fertig, router]);

  const passwoerterGleich = passwort.length > 0 && passwort === wiederholung;
  // Der Knopf ist NUR während des Absendens gesperrt, nicht bei unerfüllten
  // Regeln. Sonst ist die Seite eine stumme Sackgasse: `disabled` verhindert
  // den Klick, und die erklärende Meldung erscheint erst NACH einem Absenden,
  // das `disabled` gerade unmöglich macht. Live passiert (14.08.2026): Ein
  // Eigentümer setzte sein Passwort und die Seite blieb ohne Erfolg UND ohne
  // Fehler stehen. `onSubmit` prüft weiterhin alles und zeigt den Grund.
  const absendbar = !laeuft;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    if (!passwoerterGleich) {
      setFehler("ungleich");
      return;
    }
    if (!passwortGenuegt(passwort)) {
      setFehler("schwach");
      return;
    }
    setLaeuft(true);
    const res = await absenden(token, passwort);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.grund);
      // Eingaben leeren: bei ungültigem Token bringt ein erneuter Versuch
      // nichts, und ein stehengebliebenes Passwort im DOM ist unnötig.
      if (res.grund === "ungueltig") {
        setPasswort("");
        setWiederholung("");
      }
      return;
    }
    setFertig(true);
  }

  // --- Zustand: Link ohne Token ---
  // Häufigster Grund: der Link wurde beim Kopieren aus dem Mail-Programm hinter
  // dem `?` abgeschnitten. Beim Reset kommt der Nutzer allein weiter, wenn er
  // sich einen frischen Link holen kann — „Zur Anmeldung" allein ist an dieser
  // Stelle eine Sackgasse (er kennt sein Passwort ja gerade nicht). Bei der
  // Einladung gibt es diesen Selbstbedienungsweg bewusst NICHT: eine Einladung
  // verschickt der Betrieb, nicht der Eingeladene.
  if (!token) {
    return (
      <Zustand
        icon="ph:link-break"
        ton="warnung"
        titel={t("tokenMissing.title")}
        text={t("tokenMissing.text")}
      >
        {vorgang === "reset" && (
          <Button asChild className="w-full">
            <Link href="/passwort-vergessen">{t("tokenInvalid.retry")}</Link>
          </Button>
        )}
        <LinkZurAnmeldung label={t("toLogin")} />
      </Zustand>
    );
  }

  // --- Zustand: Ratelimit (429) ---
  // Bewusst VOR dem „ungültig"-Zustand und getrennt von ihm: der Link ist
  // vermutlich in Ordnung, es wurde nur zu oft geladen. Hier darf KEIN
  // „neuen Link anfordern" stehen — ein neuer Link liefe in dasselbe Limit.
  if (fehler === "zuOft") {
    return (
      <Zustand
        icon="ph:hourglass-medium"
        ton="warnung"
        titel={t("tooMany.title")}
        text={t("tooMany.text")}
      >
        <LinkZurAnmeldung label={t("toLogin")} />
      </Zustand>
    );
  }

  // --- Zustand: Vorab-Prüfung läuft ---
  if (pruefend) {
    return (
      <div
        className="flex w-full flex-col items-center gap-3 py-12 text-center"
        aria-live="polite"
        aria-busy
      >
        <Icon
          icon="ph:spinner"
          className="size-7 animate-spin text-muted-foreground"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">{t("checking")}</p>
      </div>
    );
  }

  // --- Zustand: Token vom Server abgelehnt (ungültig / abgelaufen / benutzt) ---
  // Eigener Vollbild-Zustand statt einer Fehlerzeile unter dem Formular: ein
  // weiterer Versuch mit demselben Link kann nicht gelingen, ein stehendes
  // Formular wäre eine Sackgasse.
  if (fehler === "ungueltig") {
    return (
      <Zustand
        icon="ph:clock-countdown"
        ton="warnung"
        titel={t("tokenInvalid.title")}
        text={t(
          vorgang === "einladung"
            ? "tokenInvalid.textInvite"
            : "tokenInvalid.textReset",
        )}
      >
        {vorgang === "reset" && (
          <Button asChild className="w-full">
            <Link href="/passwort-vergessen">{t("tokenInvalid.retry")}</Link>
          </Button>
        )}
        <LinkZurAnmeldung label={t("toLogin")} />
      </Zustand>
    );
  }

  // --- Zustand: fertig ---
  if (fertig) {
    return (
      <Zustand
        icon="ph:check-circle"
        ton="erfolg"
        titel={t(
          vorgang === "einladung" ? "done.titleInvite" : "done.titleReset",
        )}
        text={t("done.text")}
      >
        <Button asChild className="w-full">
          <Link href="/login">{t("toLogin")}</Link>
        </Button>
      </Zustand>
    );
  }

  // --- Zustand: Formular ---
  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-center font-display text-3xl font-extrabold">
          {t(vorgang === "einladung" ? "invite.title" : "reset.title")}
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          {t(vorgang === "einladung" ? "invite.intro" : "reset.intro", {
            min: PASSWORT_MIN_LAENGE,
          })}
        </p>
      </div>

      <PasswortFeld
        label={t("password.newLabel")}
        value={passwort}
        onChange={setPasswort}
        anforderungenZeigen
        autoFocus
      />
      <PasswortFeld
        label={t("password.repeatLabel")}
        value={wiederholung}
        onChange={setWiederholung}
      />

      {/* Abgleich der Wiederholung schon beim Tippen, nicht erst beim Absenden. */}
      {wiederholung.length > 0 && !passwoerterGleich && (
        <p className="text-sm text-destructive" role="alert">
          {t("password.mismatch")}
        </p>
      )}

      {fehler === "ungleich" && (
        <p className="text-sm text-destructive" role="alert">
          {t("password.mismatch")}
        </p>
      )}
      {fehler === "schwach" && (
        <p className="text-sm text-destructive" role="alert">
          {t("password.tooWeak", { min: PASSWORT_MIN_LAENGE })}
        </p>
      )}
      {fehler === "fehler" && (
        <p className="text-sm text-destructive" role="alert">
          {t("genericError")}
        </p>
      )}
      {/* Was noch fehlt — schon beim Tippen, nicht erst nach dem Absenden.
          Der Knopf ist bewusst klickbar (s. `absendbar`); diese Zeile ist die
          freundliche Vorwarnung, `onSubmit` liefert notfalls dieselbe Auskunft
          als Fehler. */}
      {!laeuft && passwort.length > 0 && !passwortGenuegt(passwort) && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("password.tooWeak", { min: PASSWORT_MIN_LAENGE })}
        </p>
      )}

      <Button type="submit" disabled={!absendbar}>
        {laeuft ? t("password.saving") : t("password.submit")}
      </Button>

      <LinkZurAnmeldung label={t("toLogin")} />
    </form>
  );
}

/** Ganzflächiger Hinweis-Zustand (fehlender/ungültiger Token, Erfolg). */
function Zustand({
  icon,
  ton,
  titel,
  text,
  children,
}: {
  icon: string;
  ton: "erfolg" | "warnung";
  titel: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-4 text-center">
      <span
        className={
          ton === "erfolg"
            ? "flex size-12 items-center justify-center rounded-full bg-accent/10"
            : "flex size-12 items-center justify-center rounded-full bg-destructive/10"
        }
      >
        <Icon
          icon={icon}
          className={
            ton === "erfolg"
              ? "size-7 text-accent"
              : "size-7 text-destructive"
          }
          aria-hidden
        />
      </span>
      <h1 className="font-display text-3xl font-extrabold">{titel}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="flex w-full flex-col gap-3 pt-2">{children}</div>
    </div>
  );
}

function LinkZurAnmeldung({ label }: { label: string }) {
  return (
    <Link
      href="/login"
      className="text-center text-sm font-medium text-accent hover:underline"
    >
      {label}
    </Link>
  );
}
