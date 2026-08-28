"use client";

// Die Mediathek als Seite im Baukasten-Rahmen (0479).
//
// Warum eine eigene Client-Hülle und nicht der Manager direkt im Layout: der
// `BaukastenRahmen` ist eine Client-Komponente und nimmt seinen Inhalt als
// Prop, nicht als `children` — und der Manager braucht die volle Fläche ohne
// Polster, anders als jede andere Route (die alle `p-4 md:p-6` setzen).
//
// `modus="verwaltung"`: kein „Auswählen"-Knopf, kein Überlagern. Das ✕ im Kopf
// führt zurück in den Seiten-Editor — nicht ins Nichts, wie ein „schließen"
// auf einer Seite, die nichts überdeckt, sonst tun würde.
import { useRouter } from "next/navigation";

import type { CustomDomain } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";

import { Mediathek } from "./mediathek";
import { BaukastenRahmen } from "./rahmen";
import { REITER_HREF } from "./reiter";

export function MediathekSeite({
  pages,
  domains,
}: {
  pages: Page[];
  domains: CustomDomain[];
}) {
  const router = useRouter();
  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      breit
      inhalt={
        <div className="flex h-full min-h-0 flex-col">
          <Mediathek
            modus="verwaltung"
            onSchliesse={() => router.push(REITER_HREF.seiten)}
          />
        </div>
      }
    />
  );
}
