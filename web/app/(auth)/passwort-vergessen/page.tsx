// „Passwort vergessen": Reset-Link anfordern. Öffentlich, ohne Anmeldung.
//
// Die Seite hat bewusst nur EINEN Ausgang (neutrale Bestätigung) — siehe
// `PasswortVergessenFormular`.
import type { Metadata } from "next";

import { AuthSchale } from "@/components/auth/auth-schale";
import { PasswortVergessenFormular } from "@/components/auth/passwort-vergessen-formular";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PasswortVergessenSeite() {
  return (
    <AuthSchale>
      <PasswortVergessenFormular />
    </AuthSchale>
  );
}
