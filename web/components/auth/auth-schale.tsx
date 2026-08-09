"use client";

// Gemeinsame Schale der öffentlichen Auth-Seiten (Einladung annehmen,
// Passwort vergessen, neues Passwort setzen).
//
// Warum eine eigene Komponente: /login bringt seine zweispaltige Optik selbst
// mit (Formular links, Foto rechts). Die neuen Seiten müssen wie derselbe
// Produktbereich aussehen — hier liegt diese Optik EINMAL, statt sie dreimal
// zu kopieren und auseinanderdriften zu lassen.
import Image from "next/image";

import { Logo } from "@/components/logo";
import { SprachUmschalter } from "@/components/auth/sprach-umschalter";

export function AuthSchale({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Linke Spalte: Inhalt */}
      <div className="flex flex-col px-6 py-8 lg:px-16">
        {/* Kopfzeile: Logo links, Sprachumschalter rechts. Die Sprache wird
            automatisch aufgelöst — der Umschalter ist die Korrektur für den
            Fall, dass sie danebenliegt (siehe `sprach-umschalter.tsx`). */}
        <div className="flex items-center justify-between gap-4">
          <Logo heightRem={1.75} />
          <SprachUmschalter />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-sm flex-col gap-5">{children}</div>
        </div>
      </div>

      {/* Rechte Spalte: großes Foto (auf Mobile ausgeblendet) — dasselbe Bild
          wie auf /login, damit der Wechsel nicht wie eine fremde Seite wirkt. */}
      <div className="hidden p-3 lg:block">
        <div className="relative h-full w-full overflow-hidden rounded-2xl">
          <Image
            src="/auth_page/mann_handy.png"
            alt=""
            aria-hidden
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />
        </div>
      </div>
    </main>
  );
}
