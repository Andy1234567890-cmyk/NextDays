"use client";

// Rendert den Artikel-Body aus typisierten HelpBlock[]. Inline-Links werden aus
// der Schreibweise [Text](https://…) ODER [Text](/hilfe/…) aufgelöst — interne
// Ziele über next/link, externe als neues Tab. Bewusst ohne Markdown-Dependency.
import { Icon } from "@iconify/react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { HelpBlock } from "@/content/help/types";

const LINK_RE = /\[([^\]]+)\]\((https:\/\/[^\s)]+|\/[^\s)]+)\)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, label, href] = match;
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const internal = href.startsWith("/");
    nodes.push(
      internal ? (
        <Link
          key={`${href}-${index}`}
          href={href}
          className="font-medium text-accent underline underline-offset-2 hover:text-accent/80"
        >
          {label}
        </Link>
      ) : (
        <a
          key={`${href}-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent underline underline-offset-2 hover:text-accent/80"
        >
          {label}
        </a>
      ),
    );
    last = index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const NOTE_STYLES: Record<
  NonNullable<Extract<HelpBlock, { type: "note" }>["variant"]>,
  { icon: string; className: string }
> = {
  info: { icon: "ph:info", className: "border-border bg-muted/50 text-foreground" },
  tip: { icon: "ph:lightbulb", className: "border-accent/30 bg-accent/5 text-foreground" },
  warn: {
    icon: "ph:warning",
    className: "border-amber-500/40 bg-amber-500/10 text-foreground",
  },
};

export function ArticleBody({ body }: { body: HelpBlock[] }) {
  return (
    <div className="flex flex-col gap-5">
      {body.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className="text-base leading-relaxed text-muted-foreground">
                {renderInline(block.text)}
              </p>
            );
          case "h2":
            return (
              <h2 key={i} className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-2 text-lg font-semibold text-foreground">
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="flex list-disc flex-col gap-2 pl-5">
                {block.items.map((item, li) => (
                  <li key={li} className="text-base leading-relaxed text-muted-foreground">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="flex flex-col gap-3">
                {block.items.map((item, si) => (
                  <li key={si} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {si + 1}
                    </span>
                    <span className="text-base leading-relaxed text-muted-foreground">
                      {renderInline(item)}
                    </span>
                  </li>
                ))}
              </ol>
            );
          case "note": {
            const style = NOTE_STYLES[block.variant ?? "info"];
            return (
              <div
                key={i}
                className={`flex gap-3 rounded-xl border p-4 ${style.className}`}
              >
                <Icon icon={style.icon} className="mt-0.5 size-5 shrink-0 text-accent" />
                <p className="text-sm leading-relaxed">{renderInline(block.text)}</p>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
