// Minimal-Layout für den Auth-Proxy (Login-Seite). Das eigentliche Storybook
// hat sein eigenes HTML und wird separat über /sb ausgeliefert.
import type { ReactNode } from "react";

export const metadata = {
  title: "NextDays — Design-System (geschützt)",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
