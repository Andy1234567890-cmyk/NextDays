"use client";

// Mehrfachauswahl von Objekten — EINE Komponente für alle Stellen, an denen
// der Betreiber „mehrere Objekte auf einmal" auswählt.
//
// Vorher gab es dieses Muster nur EINMAL, fest verdrahtet im Preise-Bereich
// (`objekte/pricing/zu-anderen-objekten.tsx`, Block „Zu anderen Objekten
// hinzufügen"): Suchfeld, Zähler „0/18 ausgewählt", „Alle auswählen" und eine
// scrollbare Liste mit Bild, Name und Adresse je Zeile. Die Eigentümer-
// Zuordnung brauchte exakt dasselbe. Statt einer zweiten Kopie liegt die
// Mechanik (Suche, Zählweise, „Alle auswählen" auf die SICHTBAREN Zeilen,
// Zeilendarstellung) hier; `ZuAnderenObjekten` ist nur noch die Preise-
// spezifische Hülle darum (Titel + erklärender Satz + Objektquelle).
//
// Die Komponente ist bewusst PRÄSENTATION ohne eigenen Ladevorgang: WELCHE
// Objekte zur Auswahl stehen, entscheidet die Aufrufstelle. Im Preise-Bereich
// sind das alle Objekte außer dem aktuellen, bei der Eigentümer-Zuordnung nur
// die noch freien (ein Objekt gehört genau EINEM Eigentümer, Migration 0073).
// Ein Ladevorgang hier drin würde diese Unterscheidung verwischen.
//
// Die Auswahl im Browser ist eine Bequemlichkeit, keine Autorisierung: welche
// IDs wirklich erlaubt sind, prüft der Endpunkt beim Speichern erneut
// (Wurzel 3).
import { useTranslations } from "next-intl";

import { Icon } from "@iconify/react";

import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";

/**
 * Ein Objekt in der Auswahlliste.
 *
 * Bewusst schmaler als `Property` aus `lib/properties`: die Eigentümer-Seite
 * bekommt ihre Liste von `/owners/{id}/available-properties` und kennt dort
 * nur `id` und `title`. Ein Pflichtfeld `photos` würde diese Aufrufstelle
 * zwingen, etwas zu erfinden (Wurzel 4) — deshalb sind Bild und Adresse
 * optional und die Zeile zeigt schlicht weniger, wenn sie fehlen.
 */
export type ObjektAuswahlEintrag = {
  id: string;
  title: string;
  /** Zweite Zeile (Adresse) als Unterscheidungsmerkmal. Leer = weglassen. */
  subtitle?: string;
  /** Vorschaubild; fehlt es, steht dort das Haus-Symbol. */
  photo?: string;
  /** Freier Miteigentumsanteil in Prozent (0601). Fehlt oder 100 = unberührt.
   *  Darunter zeigt die Zeile, wer schon beteiligt ist und wie viel bleibt —
   *  sonst hakt man ein Objekt an und bekommt erst danach heraus, dass davon
   *  nur 40 % zu haben sind. */
  freier_anteil?: number;
  /** Wer schon beteiligt ist; leer/fehlend bei einem freien Objekt. */
  beteiligte?: { owner_id: string; name: string; ownership_share: number }[];
};

export function ObjektMehrfachauswahl({
  objekte,
  selected,
  onChange,
  suche,
  onSucheChange,
  disabled = false,
  emptyText,
  countLabel,
}: {
  /** Die auswählbaren Objekte — die Aufrufstelle hat sie bereits gefiltert. */
  objekte: ObjektAuswahlEintrag[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Suchtext; die Aufrufstelle hält ihn, damit sie ihn zurücksetzen kann. */
  suche: string;
  onSucheChange: (next: string) => void;
  disabled?: boolean;
  /** Satz, wenn gar nichts zur Auswahl steht (je Aufrufstelle ein anderer). */
  emptyText: string;
  /**
   * Beschriftung des Zählers. Der Standard „0/18 ausgewählt" beschreibt die
   * AUSWAHL in dieser Liste — auf der Eigentümer-Seite las der Betreiber ihn
   * als „diesem Eigentümer sind 0 von 18 Objekten zugeordnet" und hielt seine
   * bestehende Zuordnung für verloren. Wo die Verwechslung möglich ist, sagt
   * die Aufrufstelle es unmissverständlich.
   */
  countLabel?: (ausgewaehlt: number, gesamt: number) => string;
}) {
  const t = useTranslations("objects.pricingForm");

  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? objekte.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.subtitle ?? "").toLowerCase().includes(q),
      )
    : objekte;
  // „Alle auswählen" wirkt auf die aktuell SICHTBAREN Zeilen (wie die Suche
  // suggeriert), nicht auf ausgeblendete — sonst wählt man blind mit.
  const alleSichtbarGewaehlt =
    gefiltert.length > 0 && gefiltert.every((p) => selected.includes(p.id));

  function umschalten(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
  }

  function alleUmschalten() {
    const ids = gefiltert.map((p) => p.id);
    onChange(
      alleSichtbarGewaehlt
        ? selected.filter((x) => !ids.includes(x))
        : [...new Set([...selected, ...ids])],
    );
  }

  // Steht nichts zur Auswahl, sagt eine Zeile WARUM. Die Liste ersatzlos
  // auszublenden sähe aus wie „nicht gebaut".
  if (objekte.length === 0) {
    return (
      <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Icon
          icon="ph:magnifying-glass"
          className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground"
        />
        <Input
          value={suche}
          onChange={(e) => onSucheChange(e.target.value)}
          placeholder={t("searchPropertiesPlaceholder")}
          className="pl-9"
          disabled={disabled}
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {countLabel
            ? countLabel(selected.length, objekte.length)
            : t("selectedCount", {
                count: selected.length,
                total: objekte.length,
              })}
        </span>
        <button
          type="button"
          onClick={alleUmschalten}
          disabled={disabled || gefiltert.length === 0}
          className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          {alleSichtbarGewaehlt ? t("deselectAll") : t("selectAll")}
        </button>
      </div>
      <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-(--radius) border border-border">
        {gefiltert.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("noMatches")}</p>
        ) : (
          gefiltert.map((p) => (
            <label
              key={p.id}
              className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                disabled ? "opacity-60" : "cursor-pointer hover:bg-secondary"
              }`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" className="size-full object-cover" />
                ) : (
                  <Icon icon="ph:house-line" className="size-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.title}</span>
                {p.subtitle && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.subtitle}
                  </span>
                )}
                {/* Teilbelegt = Miteigentum. Die Zeile sagt VOR dem Anhaken,
                    wer schon beteiligt ist und welcher Anteil bleibt. */}
                {p.freier_anteil != null && p.freier_anteil < 100 && (
                  <span className="block truncate text-xs text-amber-600 dark:text-amber-500">
                    {t("miteigentum", {
                      rest: p.freier_anteil,
                      wer: (p.beteiligte ?? [])
                        .map((b) => `${b.name} ${b.ownership_share} %`)
                        .join(", "),
                    })}
                  </span>
                )}
              </span>
              <Checkbox
                checked={selected.includes(p.id)}
                disabled={disabled}
                onCheckedChange={() => umschalten(p.id)}
              />
            </label>
          ))
        )}
      </div>
    </div>
  );
}
