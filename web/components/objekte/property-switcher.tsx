"use client";

// Objekt wechseln, ohne den Bereich zu verlassen (Lodgify-Muster).
//
// Vorher war der Kopf der Objekt-Navigation nur eine Anzeige: Foto, Titel,
// Status — und wer ein anderes Haus öffnen wollte, musste zurück auf /objekte
// und von dort neu in denselben Unterpunkt navigieren. Bei 18 Objekten ist das
// der häufigste Weg überhaupt (Adresse in Haus 1 prüfen, dann Haus 2, dann 3).
//
// Der Wechsel bleibt IM AKTUELLEN Unterpunkt: steht man auf „Standort", landet
// man beim nächsten Objekt wieder auf „Standort". Der Vergleich zweier Häuser
// ist genau der Grund, aus dem man wechselt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePropertyLabels } from "@/lib/use-property-labels";
import type { PropertyStatus } from "@/lib/properties";

type Eintrag = {
  id: string;
  title: string;
  photo: string | null;
  status: PropertyStatus;
};

// Suche über Titel UND Adresse: die Objekte heißen „001 Højenevej…",
// „002 Højenevej…" — nach dem Ort sucht man schneller als nach der Nummer.
function passt(e: Eintrag, adresse: string, suche: string): boolean {
  const q = suche.trim().toLowerCase();
  if (!q) return true;
  return `${e.title} ${adresse}`.toLowerCase().includes(q);
}

export function PropertySwitcher({
  current,
  properties,
  addresses,
}: {
  current: Eintrag;
  properties: Eintrag[];
  // property_id → Adresszeile, für die Suche und die Zeile unter dem Titel.
  addresses: Record<string, string>;
}) {
  const t = useTranslations("objects");
  const { statusLabel } = usePropertyLabels();
  const router = useRouter();
  const pathname = usePathname();
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // Der Unterpunkt, auf dem man gerade steht („standort", „preise" …). Beim
  // Wechsel wird er beibehalten — sonst landet man immer auf der Übersicht.
  const unterpunkt = useMemo(() => {
    const teile = pathname.split("/").filter(Boolean);
    // ["objekte", "<id>", "<unterpunkt>", …]
    return teile.slice(2).join("/");
  }, [pathname]);

  const gefiltert = useMemo(
    () => properties.filter((e) => passt(e, addresses[e.id] ?? "", suche)),
    [properties, addresses, suche],
  );

  // Klick außerhalb und Escape schließen — ohne das bleibt die Liste offen und
  // verdeckt die Navigation darunter.
  useEffect(() => {
    if (!offen) return;
    const aus = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOffen(false);
      }
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    document.addEventListener("mousedown", aus);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", aus);
      document.removeEventListener("keydown", taste);
    };
  }, [offen]);

  const wechseln = (id: string) => {
    setOffen(false);
    setSuche("");
    router.push(unterpunkt ? `/objekte/${id}/${unterpunkt}` : `/objekte/${id}`);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-3 rounded-(--radius) border p-2.5 text-left transition-colors hover:bg-accent/50"
      >
        <Vorschau eintrag={current} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">
            {current.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {statusLabel(current.status)}
          </span>
        </div>
        <Icon
          icon="ph:caret-up-down"
          className="ml-auto size-4 shrink-0 text-muted-foreground"
        />
      </button>

      {offen && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 flex max-h-[24rem] flex-col overflow-hidden rounded-(--radius) border bg-popover shadow-lg">
          <div className="border-b p-2">
            <input
              type="search"
              autoFocus
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t("switcher.searchPlaceholder")}
              className="w-full rounded-(--radius) border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {gefiltert.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {t("switcher.noMatch")}
            </p>
          ) : (
            <ul className="flex flex-col overflow-y-auto p-1" role="listbox">
              {gefiltert.map((e) => {
                const aktiv = e.id === current.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={aktiv}
                      onClick={() => wechseln(e.id)}
                      className={
                        "flex w-full items-center gap-2.5 rounded-(--radius) p-2 text-left text-sm transition-colors hover:bg-accent " +
                        (aktiv ? "bg-accent/60" : "")
                      }
                    >
                      <Vorschau eintrag={e} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{e.title}</span>
                        {/* Die Adresse unterscheidet gleichnamige Häuser —
                            ohne sie sind „001 Højenevej" und „002 Højenevej"
                            in der Liste kaum auseinanderzuhalten. */}
                        {addresses[e.id] && (
                          <span className="truncate text-xs text-muted-foreground">
                            {addresses[e.id]}
                          </span>
                        )}
                      </span>
                      {aktiv && (
                        <Icon
                          icon="ph:check"
                          className="ml-auto size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Titelbild oder Platzhalter — kein Ersatzbild, das ein Foto vortäuscht.
function Vorschau({ eintrag }: { eintrag: Eintrag }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
      {eintrag.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={eintrag.photo} alt="" className="size-full object-cover" />
      ) : (
        <Icon icon="ph:house-line" className="size-5 text-muted-foreground" />
      )}
    </span>
  );
}

