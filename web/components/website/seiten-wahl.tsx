"use client";

// Die Seitenwahl in der Kopfzeile des Baukastens.
//
// Zwei Nutzer, ein Bauteil: im Seiten-Reiter schaltet sie die VORSCHAU um, im
// Abschnitts-Editor NAVIGIERT sie zur nächsten Seite. Beides ist derselbe
// Handgriff für den Kunden — „ich will jetzt an dieser Seite arbeiten" —, und
// Hostaway löst es mit demselben einen Auswahlfeld ganz oben („Home ⌄").
//
// Vorher waren die Seiten im Editor die Reiterleiste. Das ging, solange es drei
// Seiten waren; mit den Vorlagen sind es acht bis elf, und eine Vorlage mit
// Rechtsseiten sprengt jede waagerechte Leiste.
//
// DIE BUCHUNGSSTRECKE STEHT HIER MIT (0466/0468)
// Sie ist kein Sonderfall am Rand, sondern der Weg, auf dem gebucht wird — bei
// Hostaway steht die Objektseite als „Listings" in genau diesem Auswahlfeld,
// neben Home und About us. Sie tragen KEINEN Titel in der Datenbank (er stünde
// dort in einer Sprache), deshalb werden sie hier übersetzt. Ohne das standen
// sie als namenlose Zeilen im Menü — sichtbar, aber nicht lesbar.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { Page } from "@/lib/site-pages";

/** Symbol je Seitenart — dieselbe Zuordnung wie im Anlegen-Dialog. */
function symbol(p: Page): string {
  if (p.dynamic_source) return "ph:stack-simple";
  if (p.system_key) return "ph:lock-simple";
  if (p.is_home) return "ph:house";
  if (p.page_type === "popup") return "ph:chat-centered-dots";
  if (p.page_type === "post") return "ph:newspaper";
  if (p.page_type === "error404") return "ph:warning";
  if (p.page_type === "folder") return "ph:folder";
  if (p.page_type === "external") return "ph:arrow-square-out";
  return "ph:file";
}

/** Gehört diese Seite zur Buchungsstrecke? */
function zurStrecke(p: Page): boolean {
  return Boolean(p.dynamic_source || p.system_key);
}

/** Seitenwahl in der Kopfzeile. Ein eigenes Menü statt eines `<select>`:
 *  Pop-ups, Blog-Beiträge und die Buchungsstrecke sollen erkennbar sein, und
 *  dafür braucht jede Zeile ein Symbol — und eine Überschrift über der
 *  Gruppe. */
export function SeitenWahl({
  seiten,
  aktiveId,
  onWahl,
}: {
  seiten: Page[];
  aktiveId: string | null;
  onWahl: (id: string) => void;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [offen]);

  const aktiv = seiten.find((p) => p.id === aktiveId) ?? null;
  if (seiten.length === 0) return null;

  const eigene = seiten.filter((p) => !zurStrecke(p));
  // Die Objektseite zuerst: sie ist der Anfang der Strecke — der Gast sieht ein
  // Objekt an, bevor er bucht.
  const strecke = [
    ...seiten.filter((p) => p.dynamic_source),
    ...seiten.filter((p) => p.system_key),
  ];

  /** Der angezeigte Name. Für Seiten der Buchungsstrecke aus dem Katalog, für
   *  alle anderen aus der Datenbank. */
  function name(p: Page): string {
    if (p.dynamic_source) return t(`seiten.dynamischeSeiten.${p.dynamic_source}`);
    if (p.system_key) return t(`seiten.systemseiten.${p.system_key}`);
    return p.title;
  }

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
        className="flex max-w-56 items-center gap-1.5 rounded-(--radius) px-2 py-1 text-sm font-medium transition hover:bg-secondary"
      >
        <span className="truncate">
          {aktiv ? name(aktiv) : t("vorschau.keineSeite")}
        </span>
        <Icon icon="ph:caret-down" className="size-4 shrink-0" />
      </button>
      {offen ? (
        <div className="absolute left-0 top-9 z-40 flex max-h-96 w-72 flex-col overflow-y-auto rounded-(--radius) border border-border bg-background py-1 shadow-lg">
          {eigene.map((p) => (
            <Zeile
              key={p.id}
              seite={p}
              name={name(p)}
              aktiv={p.id === aktiveId}
              entwurfText={t("seiten.entwurf")}
              onWahl={() => {
                onWahl(p.id);
                setOffen(false);
              }}
            />
          ))}

          {strecke.length > 0 ? (
            <>
              {/* Eine Überschrift und keine bloße Trennlinie: „warum stehen
                  hier vier Seiten, die ich nie angelegt habe" ist die Frage,
                  die sich sonst jeder stellt. */}
              <div className="mt-1 border-t border-border px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("seiten.systemgruppe")}
              </div>
              {strecke.map((p) => (
                <Zeile
                  key={p.id}
                  seite={p}
                  name={name(p)}
                  aktiv={p.id === aktiveId}
                  entwurfText={t("seiten.entwurf")}
                  onWahl={() => {
                    onWahl(p.id);
                    setOffen(false);
                  }}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Zeile({
  seite,
  name,
  aktiv,
  entwurfText,
  onWahl,
}: {
  seite: Page;
  name: string;
  aktiv: boolean;
  entwurfText: string;
  onWahl: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onWahl}
      className={
        "flex items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-secondary/60 " +
        (aktiv ? "font-semibold" : "")
      }
    >
      <Icon
        icon={symbol(seite)}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {/* Bei den Seiten der Buchungsstrecke steht der PFAD statt „Entwurf":
          veröffentlicht sind sie immer, und die Adresse ist die Auskunft, die
          man dort sucht („wo landet der Gast?"). */}
      {zurStrecke(seite) ? (
        <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
          /{seite.slug}
        </span>
      ) : !seite.is_published ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {entwurfText}
        </span>
      ) : null}
    </button>
  );
}
