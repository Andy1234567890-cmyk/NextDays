"use client";

// Die Seiten der Website in der schmalen linken Leiste, gruppiert nach
// Navigationsbereich: Kopfzeile · Fußzeile · nicht verlinkt.
//
// Die Gruppierung IST die Struktur. Vorher war es eine flache Liste ohne Aussage
// darüber, wo eine Seite auftaucht — und der Renderer zeigte überhaupt kein Menü,
// also war jede angelegte Unterseite für Gäste unerreichbar.
//
// Jede Gruppe hat ein „+" in der Kopfzeile; jede Zeile ein „…"-Menü mit
// Bearbeiten · Einstellungen · Duplizieren · Löschen. Die Startseite trägt ein
// Haus-Symbol und lässt sich nicht löschen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type NavArea,
  type Page,
  type PageType,
  createPage,
  deletePage,
  duplicatePage,
  publishPage,
  reorderPages,
  setHomePage,
  unpublishPage,
  updatePage,
} from "@/lib/site-pages";

import { VorlagenStart } from "../vorlagen-start";
import { NeueSeite } from "./neue-seite";
import { SeitenEinstellungen } from "./seiten-einstellungen";

const BEREICHE: NavArea[] = ["header", "footer", "none"];

export function SeitenLeiste({
  pages,
  websiteSprachen = [],
  domain = null,
}: {
  pages: Page[];
  /** Sprachen, die die Website führt — für den Sprachen-Reiter des Dialogs. */
  websiteSprachen?: string[];
  /** Aktive Domain für die Adress-Vorschau im Dialog. */
  domain?: string | null;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [neuIn, setNeuIn] = useState<NavArea | null>(null);
  const [titel, setTitel] = useState("");
  // Welche Seite ihre Einstellungen offen hat. Als ID und nicht als Objekt: nach
  // einem `router.refresh()` ist das Page-Objekt ein neues, und ein
  // festgehaltenes wäre der Stand von vorher.
  const [einstellungenVon, setEinstellungenVon] = useState<string | null>(null);
  const offeneSeite =
    pages.find((p) => p.id === einstellungenVon) ?? null;

  function fuehreAus(aktion: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await aktion();
      if (!res.ok) toast.error(res.error ?? t("seiten.fehlgeschlagen"));
      else router.refresh();
    });
  }

  function anlegen(
    bereich: NavArea,
    name: string,
    typ: PageType,
    externalUrl: string | null,
    parentId: string | null,
    popup: Parameters<typeof createPage>[6],
    template: string | null,
  ) {
    setTitel("");
    setNeuIn(null);
    fuehreAus(() =>
      createPage(
        name,
        "",
        bereich,
        typ,
        externalUrl,
        parentId,
        popup,
        template,
      ),
    );
  }

  function verschiebe(seite: Page, richtung: -1 | 1) {
    const inBereich = pages
      .filter((p) => p.nav_area === seite.nav_area)
      .sort((a, b) => a.nav_order - b.nav_order);
    const i = inBereich.findIndex((p) => p.id === seite.id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= inBereich.length) return;
    const ids = inBereich.map((p) => p.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    fuehreAus(() => reorderPages(seite.nav_area, ids));
  }

  if (pages.length === 0) {
    return (
      <div className="p-4">
        <VorlagenStart />
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      {BEREICHE.map((bereich) => {
        const imBereich = pages
          .filter((p) => p.nav_area === bereich)
          .sort((a, b) => a.nav_order - b.nav_order);
        return (
          <section key={bereich} className="border-b border-border pb-2 last:border-0">
            <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-4">
              <h3 className="font-display text-sm font-extrabold">
                {t(`seiten.bereichTitel.${bereich}`)}
              </h3>
              <button
                type="button"
                aria-label={t("seiten.neueSeite")}
                title={t("seiten.neueSeite")}
                onClick={() => {
                  setNeuIn(bereich);
                  setTitel("");
                }}
                className="text-muted-foreground transition hover:text-foreground"
              >
                <Icon icon="ph:plus" className="size-4" />
              </button>
            </div>

            {neuIn === bereich ? (
              <NeueSeite
                bereich={bereich}
                pages={pages}
                pending={pending}
                onAnlegen={(name, typ, url, parent, popup, template) =>
                  anlegen(bereich, name, typ, url, parent, popup, template)
                }
                onAbbrechen={() => setNeuIn(null)}
              />
            ) : null}

            {imBereich.length === 0 ? (
              <p className="px-4 pb-2 text-xs text-muted-foreground">
                {t(`seiten.bereichLeer.${bereich}`)}
              </p>
            ) : (
              <ul>
                {imBereich.map((p, i) => (
                  <SeitenZeile
                    key={p.id}
                    seite={p}
                    erste={i === 0}
                    letzte={i === imBereich.length - 1}
                    pending={pending}
                    onVerschiebe={verschiebe}
                    onAktion={fuehreAus}
                    onEinstellungen={(s) => setEinstellungenVon(s.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {offeneSeite ? (
        <SeitenEinstellungen
          seite={offeneSeite}
          websiteSprachen={websiteSprachen}
          domain={domain}
          onSchliessen={() => {
            setEinstellungenVon(null);
            // Nach dem Schließen neu laden: der Dialog hat Titel, Slug oder
            // Sprachen geändert, und die Liste zeigt sie.
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function SeitenZeile({
  seite,
  erste,
  letzte,
  pending,
  onVerschiebe,
  onAktion,
  onEinstellungen,
}: {
  seite: Page;
  erste: boolean;
  letzte: boolean;
  pending: boolean;
  onVerschiebe: (s: Page, r: -1 | 1) => void;
  onAktion: (a: () => Promise<{ ok: boolean; error?: string }>) => void;
  onEinstellungen: (s: Page) => void;
}) {
  const t = useTranslations("website");
  const router = useRouter();
  const [menue, setMenue] = useState(false);
  const huelle = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!menue) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setMenue(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [menue]);

  return (
    <li ref={huelle} className="relative">
      <div className="group flex items-center gap-1.5 px-4 py-1.5 transition hover:bg-secondary/60">
        <Icon
          icon={seite.is_home ? "ph:house-fill" : "ph:file"}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => router.push(`/website/seiten/${seite.id}`)}
          className="min-w-0 flex-1 truncate text-left text-sm"
          title={seite.title}
        >
          {seite.title}
          {!seite.is_published ? (
            <span className="ml-1 text-xs text-muted-foreground">
              · {t("seiten.entwurf")}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={t("seiten.menue")}
          aria-expanded={menue}
          onClick={() => setMenue((m) => !m)}
          className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100"
        >
          <Icon icon="ph:dots-three" className="size-4" />
        </button>
      </div>

      {menue ? (
        <div className="absolute right-2 top-8 z-30 flex w-44 flex-col rounded-(--radius) border border-border bg-background py-1 text-sm shadow-lg">
          <MenuePunkt
            icon="ph:pencil-simple"
            label={t("seiten.bearbeiten")}
            onClick={() => router.push(`/website/seiten/${seite.id}`)}
          />
          <MenuePunkt
            icon="ph:gear"
            label={t("seiten.einstellungen")}
            onClick={() => {
              onEinstellungen(seite);
              setMenue(false);
            }}
          />
          {!erste ? (
            <MenuePunkt
              icon="ph:arrow-up"
              label={t("seiten.nachOben")}
              disabled={pending}
              onClick={() => {
                onVerschiebe(seite, -1);
                setMenue(false);
              }}
            />
          ) : null}
          {!letzte ? (
            <MenuePunkt
              icon="ph:arrow-down"
              label={t("seiten.nachUnten")}
              disabled={pending}
              onClick={() => {
                onVerschiebe(seite, 1);
                setMenue(false);
              }}
            />
          ) : null}

          <div className="my-1 border-t border-border" />

          {/* Bereich wechseln. Die Positionsnummer im Zielbereich setzt das
              Backend selbst neu (Gegenzustand, Wurzel 1). */}
          {BEREICHE.filter((b) => b !== seite.nav_area).map((b) => (
            <MenuePunkt
              key={b}
              icon="ph:arrows-left-right"
              label={t(`seiten.verschiebeNach.${b}`)}
              disabled={pending}
              onClick={() => {
                onAktion(() => updatePage(seite.id, { nav_area: b }));
                setMenue(false);
              }}
            />
          ))}

          {!seite.is_home ? (
            <MenuePunkt
              icon="ph:house"
              label={t("seiten.alsStartseite")}
              disabled={pending}
              onClick={() => {
                onAktion(() => setHomePage(seite.id));
                setMenue(false);
              }}
            />
          ) : null}

          <div className="my-1 border-t border-border" />

          <MenuePunkt
            icon={seite.is_published ? "ph:eye-slash" : "ph:globe"}
            label={
              seite.is_published
                ? t("seiten.zurueckziehen")
                : t("seiten.veroeffentlichen")
            }
            disabled={pending}
            onClick={() => {
              onAktion(() =>
                seite.is_published
                  ? unpublishPage(seite.id)
                  : publishPage(seite.id),
              );
              setMenue(false);
            }}
          />

          {/* Duplizieren gibt es nur für Seiten mit Inhalt (0433): einen Ordner
              zu kopieren hieße eine leere Gruppe zu erzeugen, und einen externen
              Menüpunkt einen zweiten Link auf dasselbe Ziel.

              Die Kopie ist immer ein ENTWURF und ohne die SEO-Felder des
              Originals — sonst stünden zwei Seiten mit demselben Meta-Titel
              live, also genau der Befund, den die SEO-Prüfung meldet. */}
          {seite.page_type === "normal" ? (
            <MenuePunkt
              icon="ph:copy"
              label={t("seiten.duplizieren")}
              disabled={pending}
              onClick={() => {
                onAktion(() => duplicatePage(seite.id));
                setMenue(false);
              }}
            />
          ) : null}

          {/* Die Startseite ist nicht löschbar: ohne sie liefert die Domain
              nichts. Das Backend hat dafür einen eigenen Riegel (genau eine Home
              pro Konto), hier wird der Punkt gar nicht angeboten. */}
          {!seite.is_home ? (
            <MenuePunkt
              icon="ph:trash"
              label={t("seiten.loeschen")}
              disabled={pending}
              gefahr
              onClick={() => {
                onAktion(() => deletePage(seite.id));
                setMenue(false);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function MenuePunkt({
  icon,
  label,
  onClick,
  disabled,
  gefahr,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  gefahr?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "flex items-center gap-2 px-3 py-1.5 text-left transition disabled:opacity-40 " +
        (gefahr
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-secondary")
      }
    >
      <Icon icon={icon} className="size-4 shrink-0" />
      {label}
    </button>
  );
}
