// Neues Passwort setzen (Weg aus „Passwort vergessen"): Token aus der Mail.
//
// Gleiche Maske und dieselben Fehlzustände wie die Einladung — beides läuft
// über `PasswortSetzenFormular`, damit die zwei Wege nicht auseinanderdriften.
//
// `noindex`: die Seite trägt einen Token in der URL.
import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthSchale } from "@/components/auth/auth-schale";
import { PasswortSetzenFormular } from "@/components/auth/passwort-setzen-formular";
import { passwortNeuSetzen } from "@/lib/einladung";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PasswortNeuSeite() {
  return (
    <AuthSchale>
      {/* useSearchParams braucht eine Suspense-Grenze (Next 15). */}
      <Suspense>
        <PasswortSetzenFormular vorgang="reset" absenden={passwortNeuSetzen} />
      </Suspense>
    </AuthSchale>
  );
}
