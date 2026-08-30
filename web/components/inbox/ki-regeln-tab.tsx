"use client";

// Regeln der KI-Autoantwort (0493) — die Liste.
//
// Eine Regel beantwortet die Frage, die der Betrieb wirklich hat: *Was darf
// die KI von allein schreiben?* Vorher gab es dafür ein einziges Freitextfeld
// für den ganzen Betrieb — damit ließ sich „WLAN-Fragen ja, Erstattungen nie"
// nicht ausdrücken.
//
// Zwei Dinge, die die Oberfläche sichtbar machen MUSS, weil sie sonst
// überraschen:
//
//   1. Eine Regel mit „Automatisch senden" tut nichts, solange der große
//      Schalter oben aus ist. Ohne den Warnkasten legt jemand drei automatische
//      Regeln an und wundert sich.
//   2. Zu Geld, Zahlungsdaten, Sicherheitsvorfällen und Verfügbarkeitszusagen
//      antwortet die KI NIE automatisch — auch nicht mit einer Regel, die es
//      erlaubt. Diese Sperre ist nicht abschaltbar und steht deshalb als
//      Hinweis am Formular, nicht im Kleingedruckten.
//
// Kein Realtime-Abo: `ki_regel` ist für anon/authenticated bewusst gesperrt
// (0493 — die Tabelle steuert, was ohne menschliche Prüfung an Gäste geht).
// Ein Abo darauf wäre eine stumme Attrappe.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Switch } from "@nextdays/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nextdays/ui/tooltip";
import {
  type KiRegel,
  type KiRegelUpsert,
  createKiRegel,
  deleteKiRegel,
  listKiRegeln,
  updateKiRegel,
} from "@/lib/inbox";
import { listProperties } from "@/lib/properties";

import { KiRegelPanel, LEERE_REGEL } from "./ki-regel-panel";
import { KiVorlagenRegeln } from "./ki-vorlagen-regeln";

/** Ein Objekt für die Auswahl im Regel-Dialog.
 *
 *  MIT Foto und Ort: ein Betrieb mit 18 ähnlich benannten Ferienhäusern
 *  („Feriehus Line", „Feriehus Oluf") unterscheidet sie am Bild, nicht am
 *  Namen. Beide Felder sind optional — fehlt das Foto, steht dort ein
 *  Haus-Symbol, kein erfundenes Bild (Wurzel 4). */
export type Objektwahl = {
  id: string;
  title: string;
  ort: string | null;
  foto: string | null;
};

type Sortierung = "name" | "verwendet" | "geaendert";

export function KiRegelnTab({
  autoantwortAktiv,
  onEinschalten,
}: {
  autoantwortAktiv: boolean;
  onEinschalten: () => void;
}) {
  const t = useTranslations("inbox");
  const f = useFormatter();

  const [items, setItems] = useState<KiRegel[]>([]);
  const [objekte, setObjekte] = useState<Objektwahl[]>([]);
  const [panel, setPanel] = useState<{ regel: KiRegel | null; entwurf: KiRegelUpsert } | null>(
    null,
  );
  const [sortierung, setSortierung] = useState<Sortierung>("geaendert");
  const [absteigend, setAbsteigend] = useState(true);
  const [vorlagenWeg, setVorlagenWeg] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const laden = useCallback(async () => {
    const res = await listKiRegeln();
    if (res.ok) setItems(res.data.items);
    else setFehler(res.error);
  }, []);

  useEffect(() => {
    void laden();
    void listProperties().then((p) => {
      if (p.ok) {
        setObjekte(
          p.data.items.map((x) => ({
            id: x.id,
            title: x.title,
            ort: x.city ?? null,
            foto: x.photos?.[0] ?? null,
          })),
        );
      }
    });
  }, [laden]);

  // Serverseitig zu sortieren wäre hier Aufwand ohne Ertrag: die Regelliste
  // eines Betriebs ist zweistellig, sie kommt ohnehin vollständig.
  const sortiert = useMemo(() => {
    const kopie = [...items];
    kopie.sort((a, b) => {
      const wert =
        sortierung === "name"
          ? a.name.localeCompare(b.name)
          : sortierung === "verwendet"
            ? a.verwendet_zaehler - b.verwendet_zaehler
            : (a.zuletzt_verwendet_at ?? "").localeCompare(b.zuletzt_verwendet_at ?? "");
      return absteigend ? -wert : wert;
    });
    return kopie;
  }, [items, sortierung, absteigend]);

  // Der Warnkasten: automatische Regeln bestehen, aber der grosse Schalter ist
  // aus. Ohne ihn ist der häufigste Irrtum unsichtbar.
  const automatischeOhneSchalter =
    !autoantwortAktiv && items.some((r) => r.aktiv && r.zustellart === "automatisch");

  function sortieren(s: Sortierung) {
    if (s === sortierung) setAbsteigend((v) => !v);
    else {
      setSortierung(s);
      setAbsteigend(true);
    }
  }

  function umschalten(regel: KiRegel, aktiv: boolean) {
    // Wirkt sofort ohne Speichern: ein Kippschalter, der erst nach einem
    // zweiten Klick gilt, wird als kaputt gelesen.
    setItems((alt) => alt.map((r) => (r.id === regel.id ? { ...r, aktiv } : r)));
    start(async () => {
      const res = await updateKiRegel(regel.id, { ...alsUpsert(regel), aktiv });
      if (!res.ok) {
        setFehler(res.error);
        await laden();
      }
    });
  }

  function loeschen(regel: KiRegel) {
    if (!window.confirm(t("kiRuleDeleteConfirm", { name: regel.name }))) return;
    start(async () => {
      await deleteKiRegel(regel.id);
      await laden();
    });
  }

  function duplizieren(regel: KiRegel) {
    setPanel({
      regel: null,
      entwurf: {
        ...alsUpsert(regel),
        name: t("kiRuleCopyName", { name: regel.name }),
        // Die Kopie startet AUS: eine duplizierte automatische Regel, die
        // sofort mitsendet, hat niemand bestellt.
        aktiv: false,
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{t("kiRulesCount", { count: items.length })}</h3>
        <Button
          type="button"
          size="sm"
          onClick={() => setPanel({ regel: null, entwurf: LEERE_REGEL })}
        >
          <Icon icon="ph:plus" className="size-4" />
          {t("kiAddRule")}
        </Button>
      </div>

      {automatischeOhneSchalter && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <Icon icon="ph:warning" className="size-5 shrink-0 text-warning" />
          <span className="flex-1">{t("kiRulesAutoButOff")}</span>
          <Button type="button" size="sm" variant="outline" onClick={onEinschalten}>
            {t("kiTurnOnNow")}
          </Button>
        </div>
      )}

      {!vorlagenWeg && items.length === 0 && (
        <KiVorlagenRegeln
          onUebernehmen={(vorlage) =>
            setPanel({ regel: null, entwurf: vorlage })
          }
          onWeg={() => setVorlagenWeg(true)}
        />
      )}

      {fehler && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {fehler}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-3xl text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="w-12 px-4 py-3" />
              <Kopf
                label={t("kiColRule")}
                aktiv={sortierung === "name"}
                absteigend={absteigend}
                onClick={() => sortieren("name")}
              />
              <th className="px-4 py-3 text-right font-normal">
                <TooltipProvider>
                  <button
                    type="button"
                    onClick={() => sortieren("verwendet")}
                    className={`inline-flex items-center gap-1 hover:text-foreground ${
                      sortierung === "verwendet" ? "text-foreground" : ""
                    }`}
                  >
                    {t("kiColUsed")}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Icon icon="ph:question" className="size-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {t("kiColUsedHelp")}
                      </TooltipContent>
                    </Tooltip>
                  </button>
                </TooltipProvider>
              </th>
              <th className="px-4 py-3 text-left font-normal">{t("kiColAppliesTo")}</th>
              <Kopf
                label={t("kiColChanged")}
                aktiv={sortierung === "geaendert"}
                absteigend={absteigend}
                onClick={() => sortieren("geaendert")}
                rechts
              />
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {sortiert.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 align-top">
                  <Switch
                    checked={r.aktiv}
                    onCheckedChange={(an) => umschalten(r, an)}
                    disabled={pending}
                    aria-label={r.name}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="font-medium hover:underline"
                      onClick={() => setPanel({ regel: r, entwurf: alsUpsert(r) })}
                    >
                      {r.name}
                    </button>
                    {r.ist_eskalation ? (
                      <span className="ki-abzeichen-aus rounded-full px-2 py-0.5 text-xs font-medium">
                        {t("kiBadgeEscalation")}
                      </span>
                    ) : r.zustellart === "automatisch" ? (
                      // Grün heisst: diese Regel sendet SELBST an Gäste. Der
                      // Entwurf trägt bewusst KEIN Abzeichen — er ist der
                      // Normalfall, und ein Abzeichen für den Normalfall macht
                      // die Ausnahme unsichtbar.
                      <span className="ki-abzeichen-auto rounded-full border px-2 py-0.5 text-xs font-medium">
                        {t("kiBadgeAutomatic")}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {r.anweisung}
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={r.verwendet_zaehler === 0 ? "text-muted-foreground" : ""}>
                    {t("kiUsedTimes", { count: r.verwendet_zaehler })}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.gilt_fuer === "alle"
                    ? t("knowledgeAllProperties")
                    : t("kiPropertyCount", { count: r.property_ids.length })}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                  {r.zuletzt_verwendet_at
                    ? f.dateTime(new Date(r.zuletzt_verwendet_at), {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="px-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t("kiRowMenu")}
                      >
                        <Icon icon="ph:dots-three-vertical" className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => setPanel({ regel: r, entwurf: alsUpsert(r) })}
                      >
                        <Icon icon="ph:pencil-simple" className="size-4" />
                        {t("kiEdit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => duplizieren(r)}>
                        <Icon icon="ph:copy" className="size-4" />
                        {t("kiDuplicate")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => loeschen(r)}
                        className="text-destructive"
                      >
                        <Icon icon="ph:trash" className="size-4" />
                        {t("kiDelete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("kiRulesEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {panel && (
        <KiRegelPanel
          regel={panel.regel}
          entwurf={panel.entwurf}
          objekte={objekte}
          bestehende={items}
          onSchliessen={() => setPanel(null)}
          onGespeichert={() => {
            setPanel(null);
            void laden();
          }}
          onSpeichern={async (werte) =>
            panel.regel
              ? updateKiRegel(panel.regel.id, werte)
              : createKiRegel(werte)
          }
        />
      )}
    </div>
  );
}

/** Eine geladene Regel in die Form bringen, die das Speichern erwartet. */
function alsUpsert(r: KiRegel): KiRegelUpsert {
  return {
    name: r.name,
    aktiv: r.aktiv,
    gilt_fuer: r.gilt_fuer,
    zustellart: r.zustellart,
    anweisung: r.anweisung,
    ist_eskalation: r.ist_eskalation,
    eskalation_posteingang: r.eskalation_posteingang,
    benachrichtigen: r.benachrichtigen,
    property_ids: r.property_ids,
  };
}

function Kopf({
  label,
  aktiv,
  absteigend,
  onClick,
  rechts,
}: {
  label: string;
  aktiv: boolean;
  absteigend: boolean;
  onClick: () => void;
  rechts?: boolean;
}) {
  return (
    <th className={`px-4 py-3 font-normal ${rechts ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          aktiv ? "text-foreground" : ""
        }`}
      >
        {label}
        <Icon
          icon={aktiv ? (absteigend ? "ph:caret-down" : "ph:caret-up") : "ph:caret-up-down"}
          className="size-3"
        />
      </button>
    </th>
  );
}
