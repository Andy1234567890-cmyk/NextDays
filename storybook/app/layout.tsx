// Minimal-Layout für den Auth-Proxy (Login-Seite). Das eigentliche Storybook
// hat sein eigenes HTML und wird separat über /sb ausgeliefert.
import type { ReactNode } from "react";
import { IconsRegistrieren } from "@nextdays/icons/registrierung";

export const metadata = {
  title: "NextDays — Design-System (geschützt)",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {/* Icons lokal registrieren, bevor das erste Icon rendert (0410). */}
        <IconsRegistrieren />
        {children}
      </body>
    </html>
  );
}
