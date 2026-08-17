// Anmelden/Registrieren für Portal-Gäste. Bereits eingeloggt → direkt ins Konto.
import { sicheresZiel } from "@nextdays/auth/weiterleitung";
import { redirect } from "next/navigation";

import { AnmeldenForm } from "@/components/anmelden-form";
import { Logo } from "@/components/logo";
import { isGuestLoggedIn } from "@/lib/guest-session";

export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;
  // Nur interne Pfade als Weiterleitungsziel zulassen (kein Open-Redirect).
  // `startsWith("/")` allein reichte NICHT: "//fremde-domain.tld" beginnt mit
  // "/", ist aber eine absolute URL auf eine fremde Origin.
  const ziel = sicheresZiel(weiter, "/konto");

  if (await isGuestLoggedIn()) redirect(ziel);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Markenspalte */}
      <div className="relative hidden flex-1 flex-col justify-between bg-primary p-12 text-primary-foreground md:flex">
        <Logo variant="light" />
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Deine Reisen an einem Ort.
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/70">
            Buchungen verwalten, mit Gastgebern chatten, Check-in-Infos abrufen
            und Lieblingsunterkünfte merken — alles in deinem myBestDays-Konto.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-primary-foreground/60">
          <span className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3 4 6v6c0 4 3.5 7 8 9 4.5-2 8-5 8-9V6l-8-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>{" "}
            Sichere Zahlung
          </span>
          <span className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-9 8.35 8.5 8.5 0 0 1-3.8-.9L3 20l1.05-4.2A8.38 8.38 0 0 1 12 3.5a8.38 8.38 0 0 1 9 8Z" />
            </svg>{" "}
            Direkter Kontakt
          </span>
        </div>
      </div>

      {/* Formularspalte */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 md:hidden">
          <Logo />
        </div>
        <AnmeldenForm weiter={ziel} />
        <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
          Mit der Anmeldung stimmst du den Nutzungsbedingungen und der
          Datenschutzerklärung von myBestDays zu.
        </p>
      </div>
    </div>
  );
}
