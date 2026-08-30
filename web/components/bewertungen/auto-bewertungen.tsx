"use client";

// Auto-Bewertungen — die Texte, mit denen der Betrieb seine Gäste automatisch
// bewertet. Nachgebaut nach Hostaways `AUTO-REVIEWS`: eine Karte je Vorlage,
// links die Angaben, rechts Schalter und drei Symbole (Stift, Kopieren,
// Papierkorb).
//
// Der Kern ist nicht die Optik, sondern die MEHRZAHL DER TEXTE. Hostaway
// verlangt mindestens drei und begründet es in der eigenen Doku:
//
//     „Airbnb may penalize this practice, and it may affect the SEO."
//
// Wer 500-mal denselben Satz an dasselbe Portal schickt, sieht dort aus wie
// ein Bot. Wir haben bis 0503 genau das getan. Deshalb steht die Warnung hier
// sichtbar an der Vorlage und nicht in einer Hilfe, die niemand aufschlägt.
//
// Zwei Stellen weichen bewusst von Hostaway ab:
//   * Die Note ist frei wählbar. Bei ihnen ist sie fest 5 („It is not possible
//     to modify this in the auto-review") — mit unserer `min_gastnote` ist die
//     freie Wahl die reifere Lösung.
//   * Eine Vorlage kann mehrere Objekte bedienen. Ein Betrieb mit 19
//     gleichartigen Ferienhäusern soll nicht 19 Vorlagen pflegen.
import { Icon } from "@iconify/react";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import {
  type AutoTemplate,
  type AutoTemplateRequest,
  copyAutoTemplate,
  createAutoTemplate,
  deleteAutoTemplate,
  listAutoTemplates,
  updateAutoTemplate,
} from "@/lib/reviews";
import { formatDate } from "@/lib/utils";

// Ab so vielen Texten ist die Duplikat-Gefahr entschärft. Hostaway erzwingt
// diese Zahl; wir WARNEN nur — ein Betrieb mit fünf Buchungen im Jahr braucht
// keine drei Varianten, und ein Formular, das ohne erkennbaren Grund
// blockiert, wird umgangen statt befolgt.
const EMPFOHLEN = 3;
const MAX_TEXTE = 10;

type Objekt = { id: string; title: string };

export function AutoBewertungen({
  initial,
  objekte,
  canManage,
}: {
  initial: AutoTemplate[];
  objekte: Objekt[];
  canManage: boolean;
}) {
  const t = useTranslations("reviews");
  const [vorlagen, setVorlagen] = useState(initial);
  const [bearbeitet, setBearbeitet] = useState<AutoTemplate | "neu" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [pending, starte] = useTransition();

  function neuLaden() {
    starte(async () => {
      const res = await listAutoTemplates();
      if (res.ok) setVorlagen(res.data.items);
    });
  }

  const gefiltert = suche.trim()
    ? vorlagen.filter((v) =>
        v.name.toLowerCase().includes(suche.trim().toLowerCase()),
      )
    : vorlagen;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("autoTitle")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("autoSubtitle")}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setBearbeitet("neu")}>
            <Icon icon="ph:plus" className="size-4" />
            {t("autoAdd")}
          </Button>
        )}
      </header>

      {fehler && <Card className="p-4 text-sm text-destructive">{fehler}</Card>}

      {vorlagen.length > 3 && (
        <input
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t("autoSearch")}
          aria-label={t("autoSearch")}
          className="max-w-sm rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:border-foreground/30"
        />
      )}

      {gefiltert.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm text-muted-foreground">
            {vorlagen.length === 0 ? t("autoEmpty") : t("autoNoMatch")}
          </p>
          {canManage && vorlagen.length === 0 && (
            <Button variant="outline" onClick={() => setBearbeitet("neu")}>
              <Icon icon="ph:plus" className="size-4" />
              {t("autoAdd")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {gefiltert.map((v) => (
            <VorlagenKarte
              key={v.id}
              vorlage={v}
              objekte={objekte}
              canManage={canManage}
              onBearbeiten={() => setBearbeitet(v)}
              onGeaendert={neuLaden}
              onFehler={setFehler}
            />
          ))}
        </div>
      )}

      {pending && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

      {bearbeitet && (
        <VorlagenFormular
          vorlage={bearbeitet === "neu" ? null : bearbeitet}
          objekte={objekte}
          onSchliessen={() => setBearbeitet(null)}
          onGespeichert={() => {
            setBearbeitet(null);
            setFehler(null);
            neuLaden();
          }}
        />
      )}
    </div>
  );
}

/** Eine Vorlage als Karte — Hostaways Aufbau: links die Angaben, rechts
 *  abgesetzt der Aktiv-Schalter und drei Symbole. */
function VorlagenKarte({
  vorlage,
  objekte,
  canManage,
  onBearbeiten,
  onGeaendert,
  onFehler,
}: {
  vorlage: AutoTemplate;
  objekte: Objekt[];
  canManage: boolean;
  onBearbeiten: () => void;
  onGeaendert: () => void;
  onFehler: (f: string | null) => void;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const [pending, starte] = useTransition();
  const [loeschenGefragt, setLoeschenGefragt] = useState(false);

  const namen = vorlage.property_ids
    .map((id) => objekte.find((o) => o.id === id)?.title ?? id)
    .sort();

  function umschalten() {
    onFehler(null);
    starte(async () => {
      const res = await updateAutoTemplate(vorlage.id, {
        ...alsAntrag(vorlage),
        aktiv: !vorlage.aktiv,
      });
      if (res.ok) onGeaendert();
      else onFehler(res.error);
    });
  }

  return (
    <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-medium">{vorlage.name}</span>
        <dl className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          <Zeile
            label={t("autoEvent")}
            wert={t("autoAfterDays", { days: vorlage.nach_tagen })}
          />
          <Zeile
            label={t("autoListings")}
            wert={namen.length ? namen.join(", ") : t("autoNoListings")}
          />
          <Zeile
            label={t("autoTexts")}
            wert={
              <span
                className={
                  vorlage.texte.length < EMPFOHLEN && vorlage.aktiv
                    ? "text-amber-600"
                    : ""
                }
              >
                {t("autoTextCount", { count: vorlage.texte.length })}
                {vorlage.texte.length < EMPFOHLEN && vorlage.aktiv && (
                  <> · {t("autoTooFewShort")}</>
                )}
              </span>
            }
          />
          <Zeile
            label={t("autoRatingLabel")}
            wert={
              vorlage.min_gastnote == null
                ? t("autoRatingValue", { rating: vorlage.note })
                : t("autoRatingWithMin", {
                    rating: vorlage.note,
                    min: vorlage.min_gastnote,
                  })
            }
          />
          {vorlage.created_at && (
            <Zeile
              label={t("autoCreated")}
              wert={formatDate(vorlage.created_at, locale)}
            />
          )}
        </dl>
      </div>

      {canManage && (
        <div className="flex items-center gap-3 rounded-(--radius) bg-secondary/50 px-3 py-2">
          <button
            type="button"
            onClick={umschalten}
            disabled={pending}
            aria-pressed={vorlage.aktiv}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className={
                "relative h-5 w-9 shrink-0 rounded-full transition-colors " +
                (vorlage.aktiv ? "bg-emerald-500" : "bg-muted-foreground/30")
              }
            >
              <span
                className={
                  "absolute top-0.5 size-4 rounded-full bg-white transition-all " +
                  (vorlage.aktiv ? "left-4.5" : "left-0.5")
                }
              />
            </span>
            {vorlage.aktiv ? t("autoActive") : t("autoInactive")}
          </button>
          <span className="h-6 w-px bg-border" />
          <IconKnopf
            icon="ph:pencil-simple"
            label={t("edit")}
            onClick={onBearbeiten}
          />
          <IconKnopf
            icon="ph:copy"
            label={t("autoCopy")}
            disabled={pending}
            onClick={() =>
              starte(async () => {
                const res = await copyAutoTemplate(vorlage.id);
                if (res.ok) onGeaendert();
                else onFehler(res.error);
              })
            }
          />
          <IconKnopf
            icon="ph:trash"
            label={t("delete")}
            gefahr
            disabled={pending}
            onClick={() => setLoeschenGefragt(true)}
          />
        </div>
      )}

      {loeschenGefragt && (
        // Nachfragen, weil Löschen nicht rückholbar ist. Der Satz sagt auch,
        // was NICHT passiert — bereits geplante Bewertungen bleiben stehen,
        // sonst würde man sie unbeabsichtigt mit abräumen.
        <div className="flex w-full flex-col gap-2 border-t border-border pt-3">
          <p className="text-sm">{t("autoDeleteConfirm", { name: vorlage.name })}</p>
          <p className="text-xs text-muted-foreground">{t("autoDeleteKeeps")}</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                starte(async () => {
                  const res = await deleteAutoTemplate(vorlage.id);
                  if (res.ok) onGeaendert();
                  else onFehler(res.error);
                  setLoeschenGefragt(false);
                })
              }
            >
              {t("delete")}
            </Button>
            <Button variant="outline" onClick={() => setLoeschenGefragt(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Zeile({ label, wert }: { label: string; wert: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <dt className="shrink-0">{label}:</dt>
      <dd className="min-w-0 text-foreground">{wert}</dd>
    </div>
  );
}

function IconKnopf({
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
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "rounded-full p-1.5 transition-colors disabled:opacity-40 " +
        (gefahr
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

function alsAntrag(v: AutoTemplate): AutoTemplateRequest {
  return {
    name: v.name,
    aktiv: v.aktiv,
    nach_tagen: v.nach_tagen,
    note: v.note,
    min_gastnote: v.min_gastnote,
    texte: v.texte,
    privater_text: v.privater_text,
    property_ids: v.property_ids,
  };
}

/** Anlegen und Ändern. Als Blatt unter der Liste, nicht als Dialog: das
 *  Formular hat sechs Felder und eine variable Zahl Textfelder — ein Dialog
 *  müsste scrollen und verdeckte dabei die Liste. */
function VorlagenFormular({
  vorlage,
  objekte,
  onSchliessen,
  onGespeichert,
}: {
  vorlage: AutoTemplate | null;
  objekte: Objekt[];
  onSchliessen: () => void;
  onGespeichert: () => void;
}) {
  const t = useTranslations("reviews");
  const [name, setName] = useState(vorlage?.name ?? "");
  const [aktiv, setAktiv] = useState(vorlage?.aktiv ?? true);
  const [tage, setTage] = useState(vorlage?.nach_tagen ?? 3);
  const [note, setNote] = useState(vorlage?.note ?? 5);
  const [minNote, setMinNote] = useState<number | null>(
    vorlage?.min_gastnote ?? null,
  );
  // Mindestens ein leeres Feld, damit sofort erkennbar ist, wo der Text hin
  // soll — ein Formular, dessen wichtigstes Feld erst nach einem Klick auf
  // „hinzufügen" erscheint, wird übersehen.
  const [texte, setTexte] = useState<string[]>(
    vorlage?.texte.length ? [...vorlage.texte] : [""],
  );
  const [privat, setPrivat] = useState(vorlage?.privater_text ?? "");
  const [gewaehlt, setGewaehlt] = useState<string[]>(vorlage?.property_ids ?? []);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, starte] = useTransition();

  const echteTexte = texte.map((x) => x.trim()).filter(Boolean);
  const zuWenige = aktiv && echteTexte.length < EMPFOHLEN;
  const speicherbar = name.trim() && (!aktiv || echteTexte.length > 0);

  function speichern() {
    setFehler(null);
    const antrag: AutoTemplateRequest = {
      name: name.trim(),
      aktiv,
      nach_tagen: tage,
      note,
      min_gastnote: minNote,
      texte: echteTexte,
      privater_text: privat.trim() || null,
      property_ids: gewaehlt,
    };
    starte(async () => {
      const res = vorlage
        ? await updateAutoTemplate(vorlage.id, antrag)
        : await createAutoTemplate(antrag);
      if (res.ok) onGespeichert();
      else setFehler(res.error);
    });
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">
          {vorlage ? t("autoEditTitle") : t("autoNewTitle")}
        </h2>
        <IconKnopf icon="ph:x" label={t("cancel")} onClick={onSchliessen} />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("autoName")}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={t("autoNamePlaceholder")}
          className="rounded-(--radius) border border-border bg-card px-3 py-2 text-sm outline-none focus:border-foreground/30"
        />
      </label>

      <div className="flex flex-wrap gap-4">
        <label className="flex min-w-40 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("autoEvent")}
          </span>
          <NativeSelect
            value={String(tage)}
            onChange={(e) => setTage(Number(e.target.value))}
          >
            {[0, 1, 2, 3, 5, 7, 10, 13].map((n) => (
              <option key={n} value={n}>
                {t("autoAfterDays", { days: n })}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex min-w-32 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("autoRatingLabel")}
          </span>
          <NativeSelect
            value={String(note)}
            onChange={(e) => setNote(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {t("autoStars", { count: n })}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex min-w-48 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("autoMinGuest")}
          </span>
          <NativeSelect
            value={minNote == null ? "" : String(minNote)}
            onChange={(e) =>
              setMinNote(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">{t("autoMinGuestAlways")}</option>
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {t("autoMinGuestFrom", { rating: n })}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      {/* Die Texte — der Kern. Die Warnung steht AN der Sache, nicht in einer
          Hilfe: sie ist der Grund, warum es hier überhaupt mehrere Felder
          gibt. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("autoTexts")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("autoTextsHint")}
          </span>
        </div>
        {zuWenige && (
          <p className="flex items-start gap-1.5 rounded-(--radius) bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-500">
            <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0" />
            {t("autoTooFew", { count: EMPFOHLEN })}
          </p>
        )}
        {texte.map((wert, i) => (
          <div key={i} className="flex items-start gap-2">
            <Textarea
              rows={2}
              value={wert}
              onChange={(e) =>
                setTexte(texte.map((x, j) => (j === i ? e.target.value : x)))
              }
              placeholder={t("autoTextPlaceholder", { n: i + 1 })}
            />
            {texte.length > 1 && (
              <IconKnopf
                icon="ph:x"
                label={t("delete")}
                onClick={() => setTexte(texte.filter((_, j) => j !== i))}
              />
            )}
          </div>
        ))}
        {texte.length < MAX_TEXTE && (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => setTexte([...texte, ""])}
          >
            <Icon icon="ph:plus" className="size-4" />
            {t("autoAddText")}
          </Button>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("autoPrivate")}
        </span>
        <Textarea
          rows={2}
          value={privat}
          onChange={(e) => setPrivat(e.target.value)}
          placeholder={t("autoPrivatePlaceholder")}
        />
        <span className="text-xs text-muted-foreground">
          {t("autoPrivateHint")}
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("autoListings")}
        </span>
        {objekte.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("autoNoProperties")}</p>
        ) : (
          <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-(--radius) border border-border p-2">
            {objekte.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded-(--radius) px-2 py-1.5 text-sm hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={gewaehlt.includes(o.id)}
                  onChange={(e) =>
                    setGewaehlt(
                      e.target.checked
                        ? [...gewaehlt, o.id]
                        : gewaehlt.filter((x) => x !== o.id),
                    )
                  }
                />
                {o.title}
              </label>
            ))}
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {t("autoOneActivePerListing")}
        </span>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={aktiv}
          onChange={(e) => setAktiv(e.target.checked)}
        />
        {t("autoActivate")}
      </label>

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      <div className="flex gap-2">
        <Button onClick={speichern} disabled={pending || !speicherbar}>
          {t("save")}
        </Button>
        <Button variant="outline" onClick={onSchliessen}>
          {t("cancel")}
        </Button>
      </div>
    </Card>
  );
}
