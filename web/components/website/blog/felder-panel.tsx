"use client";

// Der Reiter FELDER — Framers „Fields" (0485).
//
//     Felder                                        [+ Feld hinzufügen]
//     ────────────────────────────────────────────────────────────────
//     T   Project Thumbnail Title              eingebaut
//     ◌   Status                               eingebaut · nicht änderbar
//     ▭   Main Image / Thumbnail Image         eingebaut
//     —   Show on the homepage                 eingebaut
//     /   Slug                                 eingebaut · nicht änderbar
//     ────────────────────────────────────────────────────────────────
//     T   Industry                             eingebaut
//     …
//     ────────────────────────────────────────────────────────────────
//     #   Zimmerzahl            rooms          eigenes Feld    ⋮
//
// WAS AUS DEM VORBILD ÜBERNOMMEN IST
// ==================================
// Am 28.08.2026 im offenen Framer-Projekt abgelesen: die linke Spalte des CMS
// hat drei Reiter (`Collections · Fields · Plugins`); „Fields" zeigt oben die
// Collection, darunter die Überschrift „Fields" mit einem `+`, dann die
// Systemfelder (Project Thumbnail Title, Status, Main Image, Show on the
// homepage, Slug), einen Trenner, und darunter die frei anlegbaren — jedes mit
// einem Typsymbol davor.
//
// WAS ANDERS IST — UND WARUM
// ==========================
// Bei Framer ist JEDES Feld unter dem Trenner löschbar, weil dort jede
// Collection ein freies Schema hat. Bei uns sind die 27 Felder aus `felder.ts`
// EINGEBAUT: der Renderer, der RSS-Feed, die SEO-Ausgabe und die Suche kennen
// sie namentlich. Sie lassen sich umbenennen und einstellen (0481), aber nicht
// entfernen — ein gelöschtes `excerpt` wäre eine Blogübersicht ohne Anrisse.
//
// Deshalb drei Gruppen statt zwei: `Identität` (gar nicht änderbar),
// `eingebaut` (umbenennbar, einstellbar) und `eigene` (alles).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";

import {
  EIGENE_FELD_ARTEN,
  type EigeneFeldArt,
} from "@/lib/blog-feldarten";
import {
  type EigenesFeld,
  createCustomPostField,
  deleteCustomPostField,
  updateCustomPostField,
} from "@/lib/site-pages";

import { FeldKonfigPopover } from "./feld-konfig-popover";
import {
  BEITRAG_FELDER,
  type FeldArt,
  type FeldKonfig,
  konfigVon,
} from "./felder";

/** Das Symbol je Feldart — dieselbe Idee wie im Vorbild, wo jedes Feld sein
 *  Typsymbol trägt (`T` Text, `◌` Status, `▭` Bild, `/` Slug …).
 *
 *  Eine Zuordnung und kein `switch` an der Anzeigestelle: es gibt drei Listen
 *  (Identität, eingebaut, eigene), und drei Kopien desselben `switch` wären
 *  drei Stellen, an denen eine neue Art vergessen wird. */
const SYMBOL: Record<FeldArt | EigeneFeldArt, string> = {
  text: "ph:text-t",
  richtext: "ph:text-align-left",
  bild: "ph:image",
  galerie: "ph:images",
  datum: "ph:calendar-blank",
  liste: "ph:tag",
  link: "ph:link",
  schalter: "ph:toggle-left",
  zahl: "ph:hash",
};

/** Die Felder, die die IDENTITÄT eines Beitrags sind.
 *
 *  Titel, Status und Adresse. Sie stehen im Vorbild ebenfalls oben über dem
 *  Trenner und tragen dort kein Einstellungs-Popover — „nicht Pflicht" wäre
 *  bei einem Titel keine echte Option, und woraus die Adresse entsteht, ist
 *  keine Wahl (Analyse C1). */
const IDENTITAET: { key: string; i18n: string; art: FeldArt }[] = [
  { key: "title", i18n: "blog.titel", art: "text" },
  { key: "status", i18n: "blog.status", art: "text" },
  { key: "slug", i18n: "blog.cm.adresse", art: "link" },
];

export function FelderPanel({
  konfig,
  eigene,
  onKonfig,
  onKonfigZuruecksetzen,
  onNeuLaden,
}: {
  /** Die gespeicherten Abweichungen der EINGEBAUTEN Felder (0481). */
  konfig: readonly FeldKonfig[];
  /** Die EIGENEN Felder dieses Betriebs (0485). */
  eigene: readonly EigenesFeld[];
  onKonfig: (neu: FeldKonfig) => void;
  onKonfigZuruecksetzen: (feldKey: string) => void;
  onNeuLaden: () => void;
}) {
  const t = useTranslations("website");
  const [laeuft, start] = useTransition();
  const [offenesPopover, setOffenesPopover] = useState<string | null>(null);
  const [anlegen, setAnlegen] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState<EigenesFeld | null>(null);
  const [umbenennen, setUmbenennen] = useState<EigenesFeld | null>(null);

  /** Woraus sich eine Vorgabe ABLEITEN lässt (0486, Framers „Based on"):
   *  der Titel, jedes eingebaute Feld und jedes eigene. Das Feld selbst wird
   *  an der Verwendungsstelle herausgefiltert. */
  const quellfelder = [
    { key: "title", name: t("blog.titel") },
    ...BEITRAG_FELDER.map((d) => ({
      key: d.key,
      name: konfigVon(d, konfig).label ?? t(d.i18n),
    })),
    ...eigene.map((f) => ({ key: f.feld_key, name: f.label })),
  ];

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("blog.felderTitel")}</h2>
            <p className="pt-1 text-sm text-muted-foreground">
              {t("blog.felderHinweis")}
            </p>
          </div>
          <Button
            size="sm"
            disabled={laeuft}
            onClick={() => setAnlegen(true)}
          >
            <Icon icon="ph:plus" className="size-4" />
            {t("blog.feldHinzufuegen")}
          </Button>
        </div>

        {/* Gruppe 1: die Identität. Sichtbar, aber ohne Bedienung — wer sie
            nicht sieht, sucht sie und glaubt, sie fehle. */}
        <Gruppe titel={t("blog.felderIdentitaet")}>
          {IDENTITAET.map((feld) => (
            <FeldZeile
              key={feld.key}
              icon={SYMBOL[feld.art]}
              name={t(feld.i18n)}
              hinweis={t("blog.feldNichtAenderbar")}
            />
          ))}
        </Gruppe>

        {/* Gruppe 2: die eingebauten Felder. Umbenennbar und einstellbar
            (0481), aber nicht löschbar — Renderer, Feed und SEO kennen sie
            namentlich. */}
        <Gruppe titel={t("blog.felderEingebaut")}>
          {BEITRAG_FELDER.map((def) => {
            const k = konfigVon(def, konfig);
            return (
              <FeldZeile
                key={def.key}
                icon={SYMBOL[def.art]}
                name={k.label ?? t(def.i18n)}
                schluessel={def.key}
                versteckt={k.versteckt}
                pflicht={k.pflicht}
                aktion={
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={t("blog.feld.konfigurieren")}
                      title={t("blog.feld.konfigurieren")}
                      aria-expanded={offenesPopover === def.key}
                      onClick={() =>
                        setOffenesPopover((o) =>
                          o === def.key ? null : def.key,
                        )
                      }
                      className="inline-flex size-7 items-center justify-center rounded-(--radius) text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <Icon
                        icon="ph:sliders-horizontal"
                        className="size-4"
                      />
                    </button>
                    {offenesPopover === def.key ? (
                      <div className="absolute right-0 top-9 z-50">
                        <FeldKonfigPopover
                          def={def}
                          konfig={k}
                          name={t(def.i18n)}
                          quellfelder={quellfelder.filter(
                            (q) => q.key !== def.key,
                          )}
                          onAendern={onKonfig}
                          onZuruecksetzen={() => {
                            onKonfigZuruecksetzen(def.key);
                            setOffenesPopover(null);
                          }}
                          onSchliessen={() => setOffenesPopover(null)}
                        />
                      </div>
                    ) : null}
                  </div>
                }
              />
            );
          })}
        </Gruppe>

        {/* Gruppe 3: die eigenen Felder. */}
        <Gruppe titel={t("blog.felderEigene")}>
          {eigene.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("blog.felderEigeneLeer")}
            </p>
          ) : (
            eigene.map((feld) => (
              <FeldZeile
                key={feld.id}
                icon={SYMBOL[feld.art]}
                name={feld.label}
                schluessel={feld.feld_key}
                versteckt={feld.versteckt}
                pflicht={feld.pflicht}
                aktion={
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t("blog.feldUmbenennen")}
                      title={t("blog.feldUmbenennen")}
                      disabled={laeuft}
                      onClick={() => setUmbenennen(feld)}
                      className="inline-flex size-7 items-center justify-center rounded-(--radius) text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
                    >
                      <Icon icon="ph:pencil-simple" className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("blog.feldLoeschen")}
                      title={t("blog.feldLoeschen")}
                      disabled={laeuft}
                      onClick={() => setLoeschFrage(feld)}
                      className="inline-flex size-7 items-center justify-center rounded-(--radius) text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      <Icon icon="ph:trash" className="size-4" />
                    </button>
                  </div>
                }
              />
            ))
          )}
        </Gruppe>
      </div>

      {anlegen ? (
        <FeldAnlegen
          laeuft={laeuft}
          onAbbrechen={() => setAnlegen(false)}
          onAnlegen={(eingabe) =>
            start(async () => {
              const res = await createCustomPostField(eingabe);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              setAnlegen(false);
              onNeuLaden();
            })
          }
        />
      ) : null}

      {umbenennen ? (
        <FeldUmbenennen
          feld={umbenennen}
          laeuft={laeuft}
          onAbbrechen={() => setUmbenennen(null)}
          onSpeichern={(label) => {
            const feld = umbenennen;
            setUmbenennen(null);
            start(async () => {
              const res = await updateCustomPostField(feld.id, { label });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              onNeuLaden();
            });
          }}
        />
      ) : null}

      {loeschFrage ? (
        <FeldLoeschen
          feld={loeschFrage}
          laeuft={laeuft}
          onAbbrechen={() => setLoeschFrage(null)}
          onLoeschen={() => {
            const feld = loeschFrage;
            setLoeschFrage(null);
            start(async () => {
              const res = await deleteCustomPostField(feld.id);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              // Die Zahl gehört in die Meldung: „Feld gelöscht" allein
              // verschweigt, dass dabei Werte aus Beiträgen verschwunden sind.
              toast.success(
                t("blog.feldGeloescht", { anzahl: res.data.beitraege }),
              );
              onNeuLaden();
            });
          }}
        />
      ) : null}
    </div>
  );
}

function Gruppe({
  titel,
  children,
}: {
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <h3 className="pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titel}
      </h3>
      <div className="divide-y divide-border rounded-(--radius) border border-border">
        {children}
      </div>
    </section>
  );
}

function FeldZeile({
  icon,
  name,
  schluessel,
  hinweis,
  versteckt,
  pflicht,
  aktion,
}: {
  icon: string;
  name: string;
  /** Der technische Schlüssel. Er steht daneben, weil er in `custom` und in
   *  jeder Fehlermeldung des Servers auftaucht — ein Feld, dessen Schlüssel
   *  man nirgends sieht, macht jede 422 unlesbar. */
  schluessel?: string;
  hinweis?: string;
  versteckt?: boolean;
  pflicht?: boolean;
  aktion?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Icon icon={icon} className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      {schluessel ? (
        <code className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
          {schluessel}
        </code>
      ) : null}
      {pflicht ? <Merker icon="ph:asterisk" /> : null}
      {versteckt ? <Merker icon="ph:eye-slash" /> : null}
      {hinweis ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {hinweis}
        </span>
      ) : null}
      {aktion}
    </div>
  );
}

function Merker({ icon }: { icon: string }) {
  return (
    <Icon icon={icon} className="size-3.5 shrink-0 text-muted-foreground" />
  );
}

/** Ein eigenes Feld anlegen: Name, Schlüssel, Art. Mehr nicht.
 *
 *  Der SCHLÜSSEL wird aus dem Namen vorgeschlagen, aber sichtbar und
 *  änderbar — er ist nach dem Anlegen unveränderlich, also muss man ihn sehen,
 *  bevor er gilt. Ein still erzeugter Schlüssel wäre genau die Sorte
 *  Entscheidung, die man erst bemerkt, wenn man sie nicht mehr ändern kann. */
function FeldAnlegen({
  laeuft,
  onAbbrechen,
  onAnlegen,
}: {
  laeuft?: boolean;
  onAbbrechen: () => void;
  onAnlegen: (eingabe: {
    feld_key: string;
    label: string;
    art: EigeneFeldArt;
  }) => void;
}) {
  const t = useTranslations("website");
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyBeruehrt, setKeyBeruehrt] = useState(false);
  const [art, setArt] = useState<EigeneFeldArt>("text");

  // Vorschlag aus dem Namen — bis der Schlüssel von Hand angefasst wurde.
  // Danach nie wieder: ein Vorschlag, der eine Eingabe überschreibt, ist ein
  // Datenverlust im Kleinen.
  useEffect(() => {
    if (keyBeruehrt) return;
    setKey(schluesselVorschlag(label));
  }, [label, keyBeruehrt]);

  const gueltig = label.trim().length > 0 && /^[a-z][a-z0-9_]{0,39}$/.test(key);

  return (
    <Dialog
      open
      onOpenChange={(auf) => {
        if (!auf) onAbbrechen();
      }}
    >
      <DialogContent className="max-w-md gap-4">
        <DialogTitle>{t("blog.feldHinzufuegen")}</DialogTitle>
        <DialogDescription>{t("blog.feldAnlegenHinweis")}</DialogDescription>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("blog.feldName")}</span>
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("blog.feldNamePlatzhalter")}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("blog.feldSchluessel")}</span>
          <Input
            value={key}
            spellCheck={false}
            onChange={(e) => {
              setKeyBeruehrt(true);
              setKey(e.target.value.toLowerCase());
            }}
            className="font-mono"
          />
          <span className="text-xs text-muted-foreground">
            {t("blog.feldSchluesselHinweis")}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("blog.feldArt")}</span>
          <Select
            value={art}
            onValueChange={(v) => setArt(v as EigeneFeldArt)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EIGENE_FELD_ARTEN.map((a) => (
                <SelectItem key={a} value={a}>
                  {t(`blog.feldArten.${a}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onAbbrechen} disabled={laeuft}>
            {t("blog.abbrechen")}
          </Button>
          <Button
            disabled={!gueltig || laeuft}
            onClick={() =>
              onAnlegen({ feld_key: key, label: label.trim(), art })
            }
          >
            {t("blog.feldAnlegen")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeldLoeschen({
  feld,
  laeuft,
  onAbbrechen,
  onLoeschen,
}: {
  feld: EigenesFeld;
  laeuft?: boolean;
  onAbbrechen: () => void;
  onLoeschen: () => void;
}) {
  const t = useTranslations("website");
  return (
    <Dialog
      open
      onOpenChange={(auf) => {
        if (!auf) onAbbrechen();
      }}
    >
      <DialogContent className="max-w-md gap-4">
        <DialogTitle>{t("blog.feldLoeschen")}</DialogTitle>
        <DialogDescription>
          {t("blog.feldLoeschenFrage", { name: feld.label })}
        </DialogDescription>
        {/* Der Satz, der hier wirklich zählt: es verschwindet nicht nur das
            Feld, sondern sein Wert in JEDEM Beitrag. */}
        <p className="text-sm text-muted-foreground">
          {t("blog.feldLoeschenHinweis")}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onAbbrechen} disabled={laeuft}>
            {t("blog.abbrechen")}
          </Button>
          <Button
            variant="destructive"
            onClick={onLoeschen}
            disabled={laeuft}
          >
            {t("blog.loeschen")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Nur der ANZEIGENAME lässt sich ändern.
 *
 *  Der Schlüssel steht daneben und ist gesperrt — er ist die Adresse des
 *  Wertes in jeder Beitragszeile. Ihn hier änderbar zu zeigen und dann vom
 *  Server ablehnen zu lassen wäre ein Feld, das aussieht wie eine Wahl und
 *  keine ist. */
function FeldUmbenennen({
  feld,
  laeuft,
  onAbbrechen,
  onSpeichern,
}: {
  feld: EigenesFeld;
  laeuft?: boolean;
  onAbbrechen: () => void;
  onSpeichern: (label: string) => void;
}) {
  const t = useTranslations("website");
  const [label, setLabel] = useState(feld.label);
  const sauber = label.trim();
  return (
    <Dialog
      open
      onOpenChange={(auf) => {
        if (!auf) onAbbrechen();
      }}
    >
      <DialogContent className="max-w-md gap-4">
        <DialogTitle>{t("blog.feldUmbenennen")}</DialogTitle>
        <DialogDescription>
          {t("blog.feldSchluesselFest", { key: feld.feld_key })}
        </DialogDescription>
        <Input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && sauber) onSpeichern(sauber);
          }}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onAbbrechen} disabled={laeuft}>
            {t("blog.abbrechen")}
          </Button>
          <Button
            disabled={!sauber || sauber === feld.label || laeuft}
            onClick={() => onSpeichern(sauber)}
          >
            {t("blog.speichern")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Ein Namensvorschlag für den Schlüssel — dieselben Regeln wie im Server
 *  (`_KEY_MUSTER`): Kleinbuchstabe am Anfang, danach a–z, 0–9 und `_`.
 *
 *  Ein Vorschlag und keine Erzwingung: das Feld daneben bleibt änderbar. */
function schluesselVorschlag(name: string): string {
  const roh = name
    .toLowerCase()
    .trim()
    .replace(/[äàáâã]/g, "a")
    .replace(/[öòóôõ]/g, "o")
    .replace(/[üùúû]/g, "u")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  // Muss mit einem Buchstaben beginnen — „2024_umsatz" wäre sonst ein
  // Schlüssel, den der Server ablehnt, ohne dass der Vorschlag es verrät.
  return /^[a-z]/.test(roh) ? roh : roh ? `f_${roh}`.slice(0, 40) : "";
}

