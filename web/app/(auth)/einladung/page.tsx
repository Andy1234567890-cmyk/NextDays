// Einladung annehmen: der eingeladene Nutzer setzt sein erstes eigenes Passwort.
//
// Bewusst OHNE Anmeldung erreichbar — wer eingeladen wurde, hat noch kein
// Passwort. Die Berechtigung IST der Einmal-Token im Link; geprüft wird er
// ausschließlich serverseitig.
//
// `noindex`: die Seite trägt einen Token in der URL und darf nie in einem
// Suchindex landen.
import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthSchale } from "@/components/auth/auth-schale";
import { PasswortSetzenFormular } from "@/components/auth/passwort-setzen-formular";
import { einladungAnnehmen } from "@/lib/einladung";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function EinladungSeite() {
  return (
    <AuthSchale>
      {/* useSearchParams braucht eine Suspense-Grenze (Next 15). */}
      <Suspense>
        <PasswortSetzenFormular vorgang="einladung" absenden={einladungAnnehmen} />
      </Suspense>
    </AuthSchale>
  );
}
