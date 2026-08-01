"use client";

// Seitenliste des Website-Baukastens: Seiten anlegen, Home setzen, veröffentlichen/
// zurückziehen, löschen, in den Editor öffnen + Start-Templates anwenden.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import {
  type Page,
  applyTemplate,
  createPage,
  deletePage,
  publishPage,
  setHomePage,
  unpublishPage,
} from "@/lib/site-pages";

const TEMPLATES = [
  { id: "klassik", name: "Klassik", desc: "Start + Über uns + Kontakt" },
  { id: "vermittler", name: "Vermittler", desc: "Suche + empfohlene Objekte" },
  { id: "minimal", name: "Minimal", desc: "Nur Start mit Objekt-Grid" },
];

export function WebsitePages({ pages }: { pages: Page[] }) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await action();
      if (!res.ok) toast.error(res.error ?? "Aktion fehlgeschlagen.");
      else router.refresh();
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    setTitle("");
    run(() => createPage(name));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold">Website</h2>
          <p className="text-sm text-muted-foreground">
            Bauen Sie Ihre eigene Buchungs-Website aus Seiten und Blöcken.
          </p>
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-(--radius) border border-border p-6">
          <p className="font-medium">{t("pages.startFromTemplate")}</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Wählen Sie eine Vorlage als Ausgangspunkt — alles bleibt anpassbar.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={pending}
                onClick={() => run(() => applyTemplate(t.id))}
                className="flex flex-col items-start gap-1 rounded-(--radius) border border-border p-4 text-left hover:bg-secondary/60"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* {t("pages.newPage")} anlegen */}
      <form onSubmit={onCreate} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">{t("pages.newPage")}</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("pages.titlePlaceholder")}
          />
        </label>
        <Button type="submit" disabled={pending || !title.trim()}>
          Anlegen
        </Button>
      </form>

      {/* Seitenliste */}
      <ul className="flex flex-col gap-2">
        {pages.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-(--radius) border border-border px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Icon
                icon={p.is_home ? "ph:house-fill" : "ph:file"}
                className="size-5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{p.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  /{p.slug}
                  {p.is_home ? " · Startseite" : ""}
                  {p.is_published ? " · veröffentlicht" : " · Entwurf"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link href={`/website/${p.id}`}>
                <Button variant="outline" size="sm">
                  Bearbeiten
                </Button>
              </Link>
              {!p.is_home ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => setHomePage(p.id))}
                  title={t("pages.setHomepage")}
                >
                  <Icon icon="ph:house" className="size-4" />
                </Button>
              ) : null}
              {p.is_published ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => unpublishPage(p.id))}
                >
                  Zurückziehen
                </Button>
              ) : (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => publishPage(p.id))}
                >
                  Veröffentlichen
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => deletePage(p.id))}
                title={t("pages.delete")}
              >
                <Icon icon="ph:trash" className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
