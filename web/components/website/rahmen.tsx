"use client";

// Der Rahmen des Baukastens: Reiterleiste, Kopfaktionen, Arbeitsfläche.
//
// Warum das keine `layout.tsx` ist: die Schale hat ZWEI Slots (Einstellungen
// links, Vorschau rechts), ein Next-Layout hat nur `children`. Also nimmt jede
// Route diesen Rahmen selbst und füllt beide Slots — die Reiterleiste und die
// Kopfaktionen stehen dabei nur hier, nicht in fünf Routen kopiert.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import type { CustomDomain } from "@/lib/site-config";
import { type Page, createDraftToken, publishPage } from "@/lib/site-pages";

import { REITER_HREF, REITER_IDS, reiterAusPfad } from "./reiter";
import { BaukastenSchale } from "./schale";

const RENDERER = process.env.NEXT_PUBLIC_BUILDER_URL || null;

/** „Website ansehen" mit ZWEI Zielen: dem Entwurf und der Live-Fassung.
 *
 *  Vorher gab es nur einen Link auf die Live-Domain. Damit konnte der Kunde
 *  seinen Entwurf nirgends im ganzen Fenster ansehen — nur im schmalen
 *  iframe der Vorschau. Lodgify unterscheidet dieselben zwei Fassungen
 *  („Vorschau-Version" auf einer eigenen Subdomain, „Live-Version"; live
 *  abgelesen am 23.08.2026).
 *
 *  Der Entwurfs-Link hängt an einem kurzlebigen HMAC-Token (1 h) und wird erst
 *  beim Öffnen des Menüs geholt: ein Token bei jedem Seitenaufruf wäre ein
 *  Request für einen Link, den kaum jemand anklickt. */
function WebsiteAnsehen({
  pages,
  liveDomain,
}: {
  pages: Page[];
  liveDomain: string | null;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  const [entwurfUrl, setEntwurfUrl] = useState<string | null>(null);
  const [holt, setHolt] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);

  const startseite = pages.find((p) => p.is_home) ?? pages[0] ?? null;

  useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [offen]);

  useEffect(() => {
    if (!offen || !startseite || !RENDERER || entwurfUrl || holt) return;
    setHolt(true);
    let lebt = true;
    createDraftToken(startseite.id).then((res) => {
      if (!lebt) return;
      setHolt(false);
      if (res.ok) {
        setEntwurfUrl(
          `${RENDERER}/render/${startseite.id}?token=${encodeURIComponent(res.data.token)}`,
        );
      }
      // Bei einem Fehler bleibt der Entwurfs-Eintrag aus. Ein Link, der auf eine
      // 404 führt, wäre schlechter als keiner — der Live-Eintrag bleibt.
    });
    return () => {
      lebt = false;
    };
  }, [offen, startseite, entwurfUrl, holt]);

  if (!startseite && !liveDomain) return null;

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        {t("kopf.websiteAnsehen")}
        <Icon icon="ph:caret-down" className="size-4" />
      </button>
      {offen ? (
        <div className="absolute right-0 top-8 z-40 flex w-72 flex-col rounded-(--radius) border border-border bg-background py-1 shadow-lg">
          {entwurfUrl ? (
            <a
              href={entwurfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOffen(false)}
              className="flex items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-secondary/60"
            >
              <Icon icon="ph:eye" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t("kopf.entwurfAnsehen")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("kopf.entwurfHinweis")}
                </span>
              </span>
            </a>
          ) : (
            <p className="px-4 py-2.5 text-sm text-muted-foreground">
              {holt ? t("kopf.entwurfLaedt") : t("kopf.entwurfNichtMoeglich")}
            </p>
          )}
          {liveDomain ? (
            <a
              href={`https://${liveDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOffen(false)}
              className="flex items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-secondary/60"
            >
              <Icon icon="ph:globe" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t("kopf.liveAnsehen")}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {liveDomain}
                </span>
              </span>
            </a>
          ) : (
            <p className="px-4 py-2.5 text-sm text-muted-foreground">
              {t("kopf.keineLiveDomain")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function BaukastenRahmen({
  pages,
  domains,
  seitenleiste,
  inhalt,
  breit = false,
  onVeroeffentlicht,
}: {
  pages: Page[];
  domains: CustomDomain[];
  seitenleiste?: ReactNode;
  inhalt: ReactNode;
  breit?: boolean;
  /** Wird nach erfolgreichem Veröffentlichen gerufen — die Route entscheidet
   *  selbst, ob sie ihre Vorschau neu laden muss. */
  onVeroeffentlicht?: () => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const pfad = usePathname();
  const [pending, start] = useTransition();

  const aktiv = reiterAusPfad(pfad);

  function veroeffentlichen() {
    const offen = pages.filter((p) => !p.is_published);
    if (offen.length === 0) {
      toast.info(t("kopf.nichtsZuVeroeffentlichen"));
      return;
    }
    start(async () => {
      for (const p of offen) {
        const res = await publishPage(p.id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
      }
      toast.success(t("kopf.veroeffentlicht", { anzahl: offen.length }));
      router.refresh();
      onVeroeffentlicht?.();
    });
  }

  const liveDomain = domains.find((d) => d.status === "active")?.domain ?? null;

  return (
    <BaukastenSchale
      reiter={REITER_IDS.map((id) => ({
        id,
        label: t(`reiter.${id}`),
        href: REITER_HREF[id],
      }))}
      aktiverReiter={aktiv ?? ""}
      kopfAktionen={
        <>
          <WebsiteAnsehen pages={pages} liveDomain={liveDomain} />
          <Button
            size="sm"
            variant="accent"
            disabled={pending || pages.length === 0}
            onClick={veroeffentlichen}
          >
            {pending ? t("kopf.veroeffentlicht0") : t("kopf.veroeffentlichen")}
          </Button>
        </>
      }
      breit={breit}
      seitenleiste={seitenleiste}
      inhalt={inhalt}
    />
  );
}
