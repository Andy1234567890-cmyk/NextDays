// Rendert die Bausteine eines Hilfe-Artikels. Inline-Links in der Schreibweise
// [Text](/pfad) werden hier aufgeloest — bewusst nur RELATIVE Pfade und
// http(s): ein Artikel darf keine beliebigen Schemata in die Oberflaeche
// bringen (Wurzel 8, Schema-Whitelist).
import { Icon } from "@iconify/react";
import Link from "next/link";

import type { HilfeBlock } from "@/content/hilfe";

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

function mitLinks(text: string, schluessel: string) {
  const teile: React.ReactNode[] = [];
  let zuletzt = 0;
  for (const m of text.matchAll(LINK)) {
    const [ganz, label, ziel] = m;
    const i = m.index ?? 0;
    if (i > zuletzt) teile.push(text.slice(zuletzt, i));
    const erlaubt = ziel.startsWith("/") || /^https?:\/\//.test(ziel);
    teile.push(
      erlaubt ? (
        <Link
          key={`${schluessel}-${i}`}
          href={ziel}
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          {label}
        </Link>
      ) : (
        // Unerlaubtes Schema: nur den Text zeigen, nie verlinken.
        label
      ),
    );
    zuletzt = i + ganz.length;
  }
  if (zuletzt < text.length) teile.push(text.slice(zuletzt));
  return teile;
}

const HINWEIS_ICON = {
  info: "ph:info-duotone",
  warnung: "ph:warning-duotone",
  tipp: "ph:lightbulb-duotone",
} as const;

export function ArtikelText({ bloecke }: { bloecke: HilfeBlock[] }) {
  return (
    <div className="space-y-5">
      {bloecke.map((b, i) => {
        const k = `b${i}`;
        if (b.art === "h2") {
          return (
            <h2 key={k} className="pt-2 text-xl font-semibold tracking-tight">
              {b.text}
            </h2>
          );
        }
        if (b.art === "p") {
          return (
            <p key={k} className="leading-relaxed text-muted-foreground">
              {mitLinks(b.text, k)}
            </p>
          );
        }
        if (b.art === "ul") {
          return (
            <ul key={k} className="space-y-2">
              {b.punkte.map((p, j) => (
                <li key={j} className="flex gap-3 leading-relaxed text-muted-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                  <span>{mitLinks(p, `${k}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.art === "schritte") {
          return (
            <ol key={k} className="space-y-3">
              {b.punkte.map((p, j) => (
                <li key={j} className="flex gap-3 leading-relaxed text-muted-foreground">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                    {j + 1}
                  </span>
                  <span className="pt-0.5">{mitLinks(p, `${k}-${j}`)}</span>
                </li>
              ))}
            </ol>
          );
        }
        const ton = b.ton ?? "info";
        return (
          <div key={k} className="flex gap-3 rounded-2xl bg-muted/60 p-4">
            <Icon icon={HINWEIS_ICON[ton]} className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm leading-relaxed">{mitLinks(b.text, k)}</p>
          </div>
        );
      })}
    </div>
  );
}
